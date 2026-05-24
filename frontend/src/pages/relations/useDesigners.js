/**
 * useDesigners · roster + presence (Sprint C · Designer Presence™).
 * Stable round-robin assignment by subject id is performed in `pickDesigner`.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../../lib/api';

const useDesigners = () => {
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRoster = useCallback(async () => {
    try {
      const { data } = await api.get('/api/relations/designers');
      setRoster(data?.designers || []);
    } catch (_) { setRoster([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  /** Deterministic round-robin slot from subject id — keeps the chosen
   *  designer stable until real lead_assignments wires through (Sprint D). */
  const pickDesigner = useCallback((subjectId) => {
    if (!roster.length) return null;
    const code = String(subjectId || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return roster[code % roster.length];
  }, [roster]);

  return { roster, pickDesigner, loading };
};

export default useDesigners;
