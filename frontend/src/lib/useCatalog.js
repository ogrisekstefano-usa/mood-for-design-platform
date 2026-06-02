/**
 * useCatalog — light fetch+cache hook for DB-driven catalogs.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const _CACHE = {};

export default function useCatalog(name) {
  const [rows, setRows] = useState(_CACHE[name] || null);
  useEffect(() => {
    if (_CACHE[name]) { setRows(_CACHE[name]); return; }
    const tok = localStorage.getItem('mood_auth_token') || '';
    axios.get(`${BACKEND}/api/catalogs/${name}`, {
      headers: { Authorization: `Bearer ${tok}` },
    }).then((r) => {
      _CACHE[name] = r.data || [];
      setRows(r.data || []);
    }).catch(() => setRows([]));
  }, [name]);
  return rows || [];
}
