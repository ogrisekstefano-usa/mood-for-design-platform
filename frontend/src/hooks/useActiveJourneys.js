/**
 * useActiveJourneys — Sprint G.5
 *
 * Lista compatta dei Journey "vivi" per il rail laterale.
 * Re-fetch ogni 60s. Tollerante agli errori (ritorna []).
 */
import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function useActiveJourneys(enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancel = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/dashboard/pulse');
        if (cancel) return;
        const arr = (r.data?.active_journeys || []).slice(0, 6);
        setItems(arr);
      } catch (_) {
        if (!cancel) setItems([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancel = true; clearInterval(t); };
  }, [enabled]);

  return { items, loading };
}
