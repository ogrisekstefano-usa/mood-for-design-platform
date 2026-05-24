/**
 * useUiDensity · UI Density / Font Size Controller™.
 *
 * Four modes, persisted in localStorage AND (when authenticated) inside
 * `users_profile.metadata_json.ui_density` so the preference travels
 * across devices. Applied as data attribute on <html>, picked up by
 * CSS variables in `ui-density.css`.
 *
 *   compact      · denser studio surface (15px body)
 *   default      · 17px body (current baseline)
 *   comfortable  · 18px body · slightly slower rhythm
 *   editorial    · 19px body · serif-leaning · max breathing room
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';

const STORAGE_KEY = 'mfd.ui_density';
const VALID = ['compact', 'default', 'comfortable', 'editorial'];

const readLocal = () => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return VALID.includes(v) ? v : 'default';
  } catch (_) { return 'default'; }
};

const apply = (mode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-ui-density', mode);
};

const useUiDensity = () => {
  const [density, setDensity] = useState(readLocal);
  const [loaded, setLoaded]   = useState(false);

  // 1 — apply immediately on mount
  useEffect(() => { apply(density); }, [density]);

  // 2 — hydrate from server preference once (overrides local if present)
  useEffect(() => {
    let cancelled = false;
    api.get('/api/profile/me')
      .then(({ data }) => {
        if (cancelled) return;
        const server = data?.profile?.metadata_json?.ui_density;
        if (server && VALID.includes(server) && server !== density) {
          setDensity(server);
          try { window.localStorage.setItem(STORAGE_KEY, server); } catch (_) {}
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(async (mode) => {
    const next = VALID.includes(mode) ? mode : 'default';
    setDensity(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    apply(next);
    try { await api.patch('/api/profile/me/ui-density', { ui_density: next }); }
    catch (_) { /* best-effort · localStorage still authoritative */ }
  }, []);

  return { density, setDensity: update, options: VALID, loaded };
};

export default useUiDensity;
