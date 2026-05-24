/**
 * useMediaLibrary · light wrapper over /api/media list endpoint.
 *
 * Returns the unified asset list backed by `media_library` — every
 * Picker/Selector across MOOD must use THIS as its source. No new
 * upload modal or mini-library may bypass it.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';

const useMediaLibrary = ({ q = '', limit = 60, mediaType } = {}) => {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (q) params.set('q', q);
      if (mediaType) params.set('media_type', mediaType);
      const { data } = await api.get(`/api/media?${params.toString()}`);
      setItems(data.items || data.assets || data.data || []);
      setTotal(data.total ?? data.count ?? (data.data || data.items || []).length);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Unable to load library');
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  }, [q, limit, mediaType]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, total, loading, error, refresh };
};

export default useMediaLibrary;
