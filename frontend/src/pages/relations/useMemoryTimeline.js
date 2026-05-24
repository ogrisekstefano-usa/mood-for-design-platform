/**
 * useMemoryTimeline · fetches the editorial Relationship Memory™
 * payload from `/api/relations/memory/{subjectId}`.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';

const useMemoryTimeline = (subjectId) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    if (!subjectId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data: payload } = await api.get(`/api/relations/memory/${subjectId}`);
      setData(payload);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Unable to load relationship memory');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
};

export default useMemoryTimeline;
