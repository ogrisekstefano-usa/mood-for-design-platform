/**
 * useActivationDraft — silent autosave + resume for the Studio Activation flow.
 *
 * Lazy creation policy (P1, Mar 2026):
 *  • On mount: read `mood_studio_draft_token` from localStorage.
 *      - If a token is present → POST /draft to resume (returns the existing draft).
 *      - If no token           → DO NOT create a draft. `ready` flips true
 *                                immediately and `draft` stays null until
 *                                the user actually starts composing.
 *  • First `patch()` call creates the draft on demand (if not yet created)
 *    and then PATCHes it. This eliminates the always-on ~1s POST /draft
 *    that previously ran on /studio even for visitors who never compose.
 *
 *  • All errors are absorbed — the composition never breaks for the user.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'mood_studio_draft_token';

export const useActivationDraft = () => {
  const [draft, setDraft]     = useState(null);
  const [ready, setReady]     = useState(false);
  const [resumed, setResumed] = useState(false);
  const debounceRef           = useRef(null);
  const pendingRef            = useRef({});
  const creatingRef           = useRef(false);

  // Initial fetch — RESUME ONLY. No fresh draft is created on mount.
  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // No prior session — nothing to resume. Mark ready immediately;
      // the draft will be created on the first patch().
      setReady(true);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const res = await axios.post(`${BACKEND}/api/studio/activation/draft`, {
          draft_token: stored,
        });
        if (cancelled) return;
        if (res.data?.draft_token) {
          localStorage.setItem(STORAGE_KEY, res.data.draft_token);
        }
        setDraft(res.data);
        setResumed(Boolean(res.data?.resumed));
      } catch {
        // silent — token may have expired; treat as fresh session.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Ensure a draft exists (lazily). Returns the draft_token.
  const ensureDraft = useCallback(async () => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    if (creatingRef.current) return null;
    creatingRef.current = true;
    try {
      const res = await axios.post(`${BACKEND}/api/studio/activation/draft`, {});
      const tok = res.data?.draft_token;
      if (tok) {
        localStorage.setItem(STORAGE_KEY, tok);
        setDraft(res.data);
      }
      return tok || null;
    } catch {
      return null;
    } finally {
      creatingRef.current = false;
    }
  }, []);

  // Debounced patch — also lazily creates the draft if missing.
  const flush = useCallback(async () => {
    const tok = (await ensureDraft()) || draft?.draft_token;
    if (!tok) return;
    const body = { draft_token: tok, ...pendingRef.current };
    pendingRef.current = {};
    try {
      const res = await axios.patch(`${BACKEND}/api/studio/activation/draft`, body);
      if (res.data && res.data.draft_token) {
        setDraft(res.data);
      }
    } catch {
      // silent
    }
  }, [ensureDraft, draft?.draft_token]);

  const patch = useCallback((partial) => {
    // Apply optimistically. Carries the `payload` deep-merge fix from P0.1.
    setDraft((d) => d ? ({ ...d, ...partial,
                            payload: { ...(d.payload || {}),
                                       ...(partial.payload || {}) } }) : d);
    pendingRef.current = {
      ...pendingRef.current,
      ...partial,
      payload: {
        ...(pendingRef.current.payload || {}),
        ...(partial.payload || {}),
      },
    };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flush, 320);
  }, [flush]);

  // Flush on tab close (best-effort)
  useEffect(() => {
    const onBeforeUnload = () => {
      if (Object.keys(pendingRef.current).length === 0) return;
      const tok = localStorage.getItem(STORAGE_KEY);
      if (!tok) return;
      const body = JSON.stringify({ draft_token: tok, ...pendingRef.current });
      try {
        navigator.sendBeacon?.(
          `${BACKEND}/api/studio/activation/draft`,
          new Blob([body], { type: 'application/json' }),
        );
      } catch { /* noop */ }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { draft, patch, ready, resumed };
};

export default useActivationDraft;
