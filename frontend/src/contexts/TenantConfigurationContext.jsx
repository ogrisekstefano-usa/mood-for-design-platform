/**
 * ITER144 · TenantConfigurationProvider™
 *
 * Single source of truth for the runtime-driven SaaS shell. Loads the
 * full configuration bundle (`/api/tenant/configuration`) at boot,
 * exposes hooks consumed by the navigation, theme, and route guards.
 *
 * Hooks
 * ─────
 *   useTenantConfiguration()  → { bundle, loading, refresh, patch }
 *   useModuleEnabled(code)    → boolean
 *   useNavigationTree()       → [{ code, label, items: […] }]
 *   useThemeTokens()          → { color_primary, font_heading, … }
 *
 * Theme tokens are injected as CSS variables on <html> (--mfd-color-primary,
 * --mfd-font-heading, …) so cinematic CSS can consume them without any
 * tenant branching.
 *
 * NOTE: This provider is mounted ONCE inside BlueprintProvider's tree so
 * it can re-fetch on tenant_id / impersonation change.
 */
import React, {
  createContext, useCallback, useContext, useEffect,
  useMemo, useState,
} from 'react';
import { useAuth } from './AuthContext';
import api from '../lib/api';

const TenantConfigurationContext = createContext(null);

/**
 * Apply theme tokens as CSS variables on document.documentElement.
 * Atelier cinematic CSS reads `--mfd-color-primary` etc. and we keep
 * the legacy `--atelier-cyan` / `--bp-text-headline` mapped for back-
 * compat with the existing global stylesheets.
 */
const applyTokens = (tokens) => {
  if (!tokens || typeof document === 'undefined') return;
  const root = document.documentElement;
  const set = (k, v) => { if (v) root.style.setProperty(k, v); };
  set('--mfd-color-primary',  tokens.color_primary);
  set('--mfd-color-secondary', tokens.color_secondary);
  set('--mfd-color-canvas',   tokens.color_canvas);
  set('--mfd-font-heading',   tokens.font_heading ? `"${tokens.font_heading}"` : null);
  set('--mfd-font-body',      tokens.font_body    ? `"${tokens.font_body}"`    : null);
  set('--mfd-radius-scale',   tokens.radius_scale);
  set('--mfd-glass-intensity', tokens.glass_intensity);
  // Legacy bridge (so Atelier Nordic CSS keeps working with no edits)
  set('--atelier-cyan-runtime', tokens.color_primary);
};

/**
 * Apply branding to the document: favicon + tab title.
 * Reads from configuration bundle so it stays DB-driven.
 *
 * ITER154.R fix: when the source favicon image isn't square, we render
 * it onto a 64×64 canvas with object-fit:contain semantics (centered,
 * letterboxed by transparent padding) — no more horizontal squash.
 */
const _renderSquareFavicon = (src) => new Promise((resolve) => {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        // object-fit:contain
        const ratio = Math.min(size / img.width, size / img.height);
        const dw = img.width * ratio;
        const dh = img.height * ratio;
        const dx = (size - dw) / 2;
        const dy = (size - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        resolve(canvas.toDataURL('image/png'));
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  } catch { resolve(src); }
});

const applyBranding = async (branding) => {
  if (!branding || typeof document === 'undefined') return;
  const fav = branding.favicon_url || branding.logo_url;
  if (fav) {
    const squared = await _renderSquareFavicon(fav);
    // Remove any existing icon links so the browser doesn't keep a squashed one
    document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
      .forEach((n) => n.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = squared;
    document.head.appendChild(link);
  }
  if (branding.brand_name) {
    const tagline = branding.tagline ? ` · ${branding.tagline}` : '';
    document.title = `${branding.brand_name}${tagline}`;
  }
};

export const TenantConfigurationProvider = ({ children }) => {
  const { user } = useAuth();
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) {
      setBundle(null); setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/api/tenant/configuration');
      setBundle(data);
      applyTokens(data?.theme);
      applyBranding(data?.branding);
      setError(null);
    } catch (e) {
      // Silent in production — render still proceeds with defaults.
      setError(e?.response?.data?.detail || 'configuration load failed');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // ITER144.1 · cross-page cache invalidation. When any admin page
  // (Blueprint Governance, Tenant settings, …) patches the runtime
  // configuration, it dispatches `mfd:tenant-configuration:changed`
  // and this provider re-fetches immediately — no stale bundle visible.
  useEffect(() => {
    const onChange = () => { load(); };
    window.addEventListener('mfd:tenant-configuration:changed', onChange);
    return () => window.removeEventListener('mfd:tenant-configuration:changed', onChange);
  }, [load]);

  // Re-fetch when navigating back into a previously-blocked route so the
  // user always sees the most recent configuration without a hard reload.
  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  /**
   * Optimistic patch helper used by the Tenant Settings UI and the
   * Blueprint Governance UI. Returns the refreshed bundle.
   */
  const patch = useCallback(async (body, { adminTenantId } = {}) => {
    const url = adminTenantId
      ? `/api/blueprint-admin/tenants/${adminTenantId}/configuration`
      : '/api/tenant/configuration';
    const { data } = await api.patch(url, body);
    if (!adminTenantId) {
      setBundle(data);
      applyTokens(data?.theme);
    }
    return data;
  }, []);

  const value = useMemo(() => ({
    bundle, loading, error, refresh: load, patch,
  }), [bundle, loading, error, load, patch]);

  return (
    <TenantConfigurationContext.Provider value={value}>
      {children}
    </TenantConfigurationContext.Provider>
  );
};

// ── Hooks ──────────────────────────────────────────────────────────
export const useTenantConfiguration = () => {
  const ctx = useContext(TenantConfigurationContext);
  if (!ctx) {
    // Permissive default so that unauth shells don't crash.
    return { bundle: null, loading: false, error: null,
             refresh: () => {}, patch: async () => null };
  }
  return ctx;
};

export const useModuleEnabled = (code) => {
  const { bundle } = useTenantConfiguration();
  if (!bundle?.modules) return true; // permissive while loading
  const m = bundle.modules.find((x) => x.code === code);
  if (!m) return false;
  return m.state === 'enabled' || m.state === 'beta';
};

export const useNavigationTree = () => {
  const { bundle } = useTenantConfiguration();
  return bundle?.navigation || [];
};

export const useThemeTokens = () => {
  const { bundle } = useTenantConfiguration();
  return bundle?.theme || null;
};

export const useModule = (code) => {
  const { bundle } = useTenantConfiguration();
  return bundle?.modules?.find((x) => x.code === code) || null;
};
