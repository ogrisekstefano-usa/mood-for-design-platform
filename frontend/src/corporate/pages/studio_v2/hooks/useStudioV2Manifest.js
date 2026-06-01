/**
 * useStudioV2Manifest — DB-driven manifest for the visitor funnel.
 * Resolves archetypes, help topics, countries (with dial codes) and UI
 * copy in one round-trip. Honours BCP-47 locale.
 */
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export function useStudioV2Manifest(locale = 'it-IT') {
  const [manifest, setManifest] = useState(null);
  const [error, setError]       = useState(null);
  const [ready, setReady]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${BACKEND}/api/studio/v2/manifest`,
          { params: { locale } });
        if (!cancelled) { setManifest(r.data); setReady(true); }
      } catch (e) {
        if (!cancelled) { setError(e.message); setReady(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [locale]);

  const t = useCallback((key, fallback = '') => {
    return manifest?.ui?.[key] || fallback;
  }, [manifest]);

  return { manifest, error, ready, t };
}
