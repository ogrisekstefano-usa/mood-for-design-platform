/**
 * useActivationDraft — silent autosave + resume for the Studio Activation flow.
 *
 * Behaviour:
 *  • On mount, reads `mood_studio_draft_token` from localStorage and calls
 *    POST /api/studio/activation/draft (resume or fresh).
 *  • Returns { draft, patch, ready, resumed }.
 *  • `patch(partial)` is debounced (320ms) and PATCHes silently. Failures
 *    are absorbed — the composition never breaks for the user.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'mood_studio_draft_token';

export const useActivationDraft = () => {
  const [draft, setDraft]   = useState(null);
  const [ready, setReady]   = useState(false);
  const [resumed, setResumed] = useState(false);
  const debounceRef = useRef(null);
  const pendingRef  = useRef({});

  // Initial fetch / creation
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      try {
        const res = await axios.post(`${BACKEND}/api/studio/activation/draft`, {
          draft_token: stored || undefined,
        });
        if (cancelled) return;
        if (res.data?.draft_token) {
          localStorage.setItem(STORAGE_KEY, res.data.draft_token);
        }
        setDraft(res.data);
        setResumed(Boolean(res.data?.resumed));
      } catch {
        // silent — UI continues without a draft
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced patch
  const flush = useCallback(async () => {
    const tok = draft?.draft_token || localStorage.getItem(STORAGE_KEY);
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
  }, [draft?.draft_token]);

  const patch = useCallback((partial) => {
    // Apply optimistically
    setDraft((d) => d ? ({ ...d, ...partial,
                            payload: { ...(d.payload || {}),
                                       ...(partial.payload || {}) } }) : d);
    pendingRef.current = { ...pendingRef.current, ...partial };
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
      } catch {}
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { draft, patch, ready, resumed };
};

export default useActivationDraft;
