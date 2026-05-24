/**
 * useRelations · shared data hook for the 3 stage pages.
 * Returns { items, total, counts, loading, error, refresh }.
 * Each page passes its endpoint + filters.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';

const useRelations = (endpoint, filters = {}) => {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [counts, setCounts]   = useState({ lead: 0, prospect: 0, account: 0, dormant: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchCounts = useCallback(async () => {
    // The `/api/relations/stats` endpoint sometimes returns a transient
    // 503 'Upstream temporarily unavailable' from Supabase. We retry up
    // to 3 times with linear backoff so the stage-nav pills don't get
    // stuck on the initial all-zeros state.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { data } = await api.get('/api/relations/stats');
        if (data && Object.keys(data).length > 0) {
          setCounts(data);
          return;
        }
      } catch (_) { /* try again */ }
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '40');
      Object.entries(filters).forEach(([k, v]) => {
        if (v != null && v !== '' && (!Array.isArray(v) || v.length > 0)) {
          params.set(k, Array.isArray(v) ? v.join(',') : String(v));
        }
      });
      const { data } = await api.get(`${endpoint}?${params.toString()}`);
      setItems(data.data || []);
      setTotal(data.total || 0);
    } catch (e) {
      setItems([]); setTotal(0);
      setError(e?.response?.data?.detail || 'Unable to load');
    } finally {
      setLoading(false);
    }
  }, [endpoint, JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchList(); }, [fetchList]);

  const promote = useCallback(async (leadId, target) => {
    await api.post(`/api/relations/leads/${leadId}/promote`, { target });
    await Promise.all([fetchList(), fetchCounts()]);
  }, [fetchList, fetchCounts]);

  return { items, total, counts, loading, error, refresh: fetchList, refreshCounts: fetchCounts, promote };
};

export default useRelations;
