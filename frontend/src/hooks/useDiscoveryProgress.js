/**
 * useDiscoveryProgress — ITER185 · Phase 1
 *
 * Fetches deterministic progress (0/25/50/75/100) for a discovery row.
 * Refetch on demand (after autosave) via .refetch().
 */
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const auth = () => {
  try {
    const raw = localStorage.getItem('mfd_session');
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.access_token) return { Authorization: `Bearer ${s.access_token}` };
    }
  } catch (_) {}
  const legacy = localStorage.getItem('token');
  return legacy ? { Authorization: `Bearer ${legacy}` } : {};
};

/**
 * @param {string} discoveryId — uuid of discovery_interviews row
 * @param {string} leadId — optional lead_id fallback (uses /api/leads/{id}/discovery/progress)
 */
export default function useDiscoveryProgress(discoveryId, leadId) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetchProgress = useCallback(async () => {
    if (!discoveryId && !leadId) return;
    setLoading(true); setError(null);
    try {
      const url = discoveryId
        ? `${API}/api/discovery/${discoveryId}/progress`
        : `${API}/api/leads/${leadId}/discovery/progress`;
      const r = await axios.get(url, { headers: auth() });
      setData(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail?.message || 'Errore caricamento progress');
    } finally {
      setLoading(false);
    }
  }, [discoveryId, leadId]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  return { progress: data, loading, error, refetch: fetchProgress };
}
