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

// ── Surface-scoped runtime stylesheet ────────────────────────────────
//   CRITICAL: tenant branding may NEVER leak into Blueprint OS surfaces.
//   We mount a single <style> tag and emit a CSS rule scoped to
//   `[data-surface="storefront"]`. The storefront subtree (and ONLY the
//   storefront subtree) reads these variables. The OS subtree, which
//   carries `data-surface="os"`, is unaffected by design.
const RUNTIME_STYLE_ID = 'mfd-storefront-runtime-theme';

function _runtimeStyleEl() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(RUNTIME_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = RUNTIME_STYLE_ID;
    el.setAttribute('data-mfd-scope', 'storefront');
    document.head.appendChild(el);
  }
  return el;
}

export function applyThemeVarsToRoot(theme) {
  if (typeof document === 'undefined') return;
  const styleEl = _runtimeStyleEl();
  if (!styleEl) return;
  if (!theme) {
    styleEl.textContent = '';
    document.documentElement.removeAttribute('data-tenant-theme');
    return;
  }
  const decls = [];
  Object.entries(VAR_MAP).forEach(([path, cssVar]) => {
    let value = dig(theme, path);
    if (cssVar === '--brand-font-display' || cssVar === '--brand-font-body') {
      value = fontFamilyFor(value);
    }
    if (value != null && value !== '') {
      decls.push(`${cssVar}: ${String(value)};`);
    }
  });
  // Single CSS rule, scoped to the storefront surface ONLY.
  styleEl.textContent = `[data-surface="storefront"] {\n  ${decls.join('\n  ')}\n}`;
  if (theme.preset_key) document.documentElement.setAttribute('data-tenant-theme', theme.preset_key);
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
