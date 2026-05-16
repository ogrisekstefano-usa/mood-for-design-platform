// ──────────────────────────────────────────────────────────────────────
// Blueprint OS™ — Studio Palette Memory™ context (Phase AA.1)
// Tenant-scoped, team-shared, cross-device color memory.
// One provider mounted at the app root → every BlueprintColorPicker
// instance reads/writes through this single source of truth.
// ──────────────────────────────────────────────────────────────────────
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import api from '../lib/api';

const StudioPaletteContext = createContext(null);

const ENDPOINT = '/api/branding/studio-palette';

export const StudioPaletteProvider = ({ children, enabled = true }) => {
  const [entries, setEntries] = useState([]);   // [{hex, name, mood, last_used_at, ...}]
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Lazy-load on first mount when the user is authenticated.
  // (When `enabled` is false — e.g. anonymous storefront — we stay quiet.)
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      try {
        const r = await api.get(ENDPOINT);
        if (alive) {
          setEntries(r.data?.palette || []);
          setLoaded(true);
        }
      } catch (e) {
        // 401/403 just means we don't have brand permission yet — silent
        if (alive) { setLoaded(true); setError(null); }
      }
    })();
    return () => { alive = false; };
  }, [enabled]);

  const touch = useCallback(async (hex, meta = {}) => {
    if (!enabled || !hex) return;
    // Optimistic update — bump existing or prepend
    setEntries((prev) => {
      const others = prev.filter((e) => (e.hex || '').toLowerCase() !== hex.toLowerCase());
      return [{ hex: hex.toLowerCase(), ...meta, last_used_at: new Date().toISOString() }, ...others];
    });
    try {
      const r = await api.post(ENDPOINT, { hex, ...meta });
      setEntries(r.data?.palette || []);
    } catch (_) { /* keep optimistic */ }
  }, [enabled]);

  const remove = useCallback(async (hex) => {
    if (!enabled || !hex) return;
    setEntries((prev) => prev.filter((e) => (e.hex || '').toLowerCase() !== hex.toLowerCase()));
    try {
      const r = await api.delete(`${ENDPOINT}/${encodeURIComponent(hex.replace('#', ''))}`);
      setEntries(r.data?.palette || []);
    } catch (_) { /* ignore */ }
  }, [enabled]);

  const reorder = useCallback(async (orderedHexes) => {
    if (!enabled) return;
    setEntries((prev) => {
      const byHex = new Map(prev.map((e) => [(e.hex || '').toLowerCase(), e]));
      const next = [];
      const seen = new Set();
      for (const h of orderedHexes) {
        const k = (h || '').toLowerCase();
        if (byHex.has(k) && !seen.has(k)) { next.push(byHex.get(k)); seen.add(k); }
      }
      for (const e of prev) {
        const k = (e.hex || '').toLowerCase();
        if (!seen.has(k)) { next.push(e); seen.add(k); }
      }
      return next;
    });
    try {
      const r = await api.patch(`${ENDPOINT}/reorder`, { order: orderedHexes });
      setEntries(r.data?.palette || []);
    } catch (_) { /* keep optimistic */ }
  }, [enabled]);

  const value = useMemo(() => ({
    entries, loaded, error, touch, remove, reorder,
  }), [entries, loaded, error, touch, remove, reorder]);

  return (
    <StudioPaletteContext.Provider value={value}>
      {children}
    </StudioPaletteContext.Provider>
  );
};

export const useStudioPalette = () => {
  const ctx = useContext(StudioPaletteContext);
  // Provider-less callers (storefront, anonymous pages) get a no-op shape
  if (!ctx) {
    return {
      entries: [], loaded: false, error: null,
      touch: () => {}, remove: () => {}, reorder: () => {},
    };
  }
  return ctx;
};
