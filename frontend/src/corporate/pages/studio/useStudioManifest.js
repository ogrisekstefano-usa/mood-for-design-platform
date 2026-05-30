/**
 * useStudioManifest — single GET /api/studio/activation/manifest.
 * Returns { manifest, t, ready }
 *
 * Performance strategy (Mar 2026):
 *  • localStorage cache, locale-keyed, TTL 24h. On mount, hydrate
 *    state SYNCHRONOUSLY from cache → text is visible at the very
 *    first paint for returning visitors (which is most of them in a
 *    typical funnel).
 *  • Background refresh: still hit the network to invalidate within
 *    the same TTL window if copy changed.
 *  • IT fallback strings for the keys used on /studio entrance are
 *    bundled in this hook so even the first-ever visit shows text.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocale } from '../../../contexts/LocaleContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const CACHE_PREFIX = 'mood_studio_manifest_v1::';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Editorial IT defaults — bundled so the page is never blank on cold visit.
const IT_DEFAULTS = {
  'studio.activation.entrance.eyebrow':            'Composizione',
  'studio.activation.entrance.headline':           'Componi il tuo Studio.',
  'studio.activation.entrance.sublead':            'Una sequenza editoriale di sei movimenti per attivare il tuo Blueprint™ con MOOD.',
  'studio.activation.entrance.cta':                'Inizia la composizione',
  'studio.activation.entrance.return_link':        'Hai già iniziato?',
  'studio.activation.entrance.return_destination': 'Riprendi da dove sei',
};

const readCache = (locale) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + locale);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || (Date.now() - parsed.ts) > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};
const writeCache = (locale, data) => {
  try {
    localStorage.setItem(CACHE_PREFIX + locale, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota / disabled — silent */ }
};

export const useStudioManifest = () => {
  const { locale } = useLocale();

  // Synchronous hydration from cache → first paint already has text.
  const cached = readCache(locale);
  const [manifest, setManifest] = useState(cached || null);
  const [t, setT] = useState({ ...IT_DEFAULTS, ...(cached?.copy || {}) });
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(
          `${BACKEND}/api/studio/activation/manifest?locale=${locale}`,
        );
        if (cancelled) return;
        setManifest(r.data);
        setT({ ...IT_DEFAULTS, ...(r.data?.copy || {}) });
        writeCache(locale, r.data);
      } catch {
        // silent — cached defaults already shown.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [locale]);

  return { manifest, t, ready };
};

export default useStudioManifest;
