/**
 * useOperatingMarkets — fetch DB-driven public-facing markets.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export function useOperatingMarkets(locale = 'it-IT') {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${BACKEND}/api/geo/operating-markets`,
          { params: { locale } });
        if (!cancelled) { setItems(r.data?.items || []); setReady(true); }
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [locale]);
  return { items, ready };
}
