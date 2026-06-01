/**
 * useCountries — fetch global country catalog from /api/geo/countries.
 * Caches in module scope for the session (locale-keyed).
 */
import { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const CACHE = new Map();

export function useCountries(locale = 'it-IT') {
  const [items, setItems] = useState(() => CACHE.get(locale) || []);
  const [ready, setReady] = useState(() => CACHE.has(locale));

  useEffect(() => {
    if (CACHE.has(locale)) { setItems(CACHE.get(locale)); setReady(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${BACKEND}/api/geo/countries`, { params: { locale } });
        if (cancelled) return;
        const list = r.data?.items || [];
        CACHE.set(locale, list);
        setItems(list);
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [locale]);

  return { items, ready };
}
