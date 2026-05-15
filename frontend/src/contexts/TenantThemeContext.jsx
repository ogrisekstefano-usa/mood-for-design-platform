/**
 * TenantThemeProvider — runtime CSS-variable injector for tenant theme.
 *
 * Reads `theme_settings` from /api/branding once at boot, then maps the payload
 * to a flat set of `--brand-*` CSS variables and writes them on
 * `document.documentElement`. Other components / pages can also bridge a theme
 * payload to vars without persisting via `applyThemeVarsToRoot()`.
 *
 *   --brand-primary  --brand-secondary  --brand-accent
 *   --brand-bg       --brand-surface    --brand-border
 *   --brand-text     --brand-text-2
 *   --brand-success  --brand-warning    --brand-danger
 *   --brand-radius   --brand-font-display  --brand-font-body
 *   --brand-shadow   --brand-density
 *
 * Falls back gracefully: when a key is missing, the var is *not* set so
 * the global stylesheet defaults (index.css `--bp-*`) win.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

const TenantThemeContext = createContext({
  theme: null, branding: null, loading: true,
  refresh: () => {}, applyDraft: () => {}, clearDraft: () => {},
});

const VAR_MAP = {
  'palette.primary':         '--brand-primary',
  'palette.secondary':       '--brand-secondary',
  'palette.accent':          '--brand-accent',
  'palette.background':      '--brand-bg',
  'palette.surface':         '--brand-surface',
  'palette.text_primary':    '--brand-text',
  'palette.text_secondary':  '--brand-text-2',
  'palette.border':          '--brand-border',
  'palette.success':         '--brand-success',
  'palette.warning':         '--brand-warning',
  'palette.danger':          '--brand-danger',
  'typography.display':      '--brand-font-display',
  'typography.body':         '--brand-font-body',
  'radius':                  '--brand-radius',
  'density':                 '--brand-density',
  'shadow':                  '--brand-shadow',
};

const dig = (obj, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);

const fontFamilyFor = (name) => {
  if (!name) return undefined;
  // Wrap unquoted multi-word names so the browser parses correctly
  return /\s/.test(name) ? `'${name}', serif` : `${name}, sans-serif`;
};

export function applyThemeVarsToRoot(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!theme) {
    // Clear previously injected brand vars
    Object.values(VAR_MAP).forEach((v) => root.style.removeProperty(v));
    root.removeAttribute('data-tenant-theme');
    return;
  }
  Object.entries(VAR_MAP).forEach(([path, cssVar]) => {
    let value = dig(theme, path);
    if (cssVar === '--brand-font-display' || cssVar === '--brand-font-body') {
      value = fontFamilyFor(value);
    }
    if (value == null || value === '') {
      root.style.removeProperty(cssVar);
    } else {
      root.style.setProperty(cssVar, String(value));
    }
  });
  if (theme.preset_key) root.setAttribute('data-tenant-theme', theme.preset_key);
}

export const TenantThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(null);
  const [branding, setBranding] = useState(null);
  const [draft, setDraft] = useState(null);   // unsaved live preview
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/branding');
      setTheme(r.data?.theme || null);
      setBranding(r.data?.branding || null);
    } catch {
      setTheme(null);
      setBranding(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Apply theme (draft wins for live preview)
  useEffect(() => {
    applyThemeVarsToRoot(draft || theme);
  }, [draft, theme]);

  return (
    <TenantThemeContext.Provider value={{
      theme, branding, loading,
      refresh,
      applyDraft: setDraft,
      clearDraft: () => setDraft(null),
    }}>
      {children}
    </TenantThemeContext.Provider>
  );
};

export const useTenantTheme = () => useContext(TenantThemeContext);
