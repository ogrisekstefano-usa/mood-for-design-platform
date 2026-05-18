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
//   TIERED THEME PROPAGATION:
//
//   STOREFRONT  (data-surface="storefront"):
//     Full theme — primary, secondary, accent, bg, surface, text, border,
//     status colors, fonts, radius, density, shadow.
//
//   BLUEPRINT OS  (data-surface="os"):
//     SAFE SUBSET only — accent color + heading/body fonts override the
//     OS chrome. Backgrounds, surfaces, borders remain OS-controlled so
//     even an acid-pink tenant palette keeps the editor usable. The
//     designer still SEES their identity in the chrome (heading typeface,
//     accent CTA color) without compromising operational legibility.
//
//   Both rules live in a single <style> tag.
const RUNTIME_STYLE_ID = 'mfd-tenant-runtime-theme';

function _runtimeStyleEl() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(RUNTIME_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = RUNTIME_STYLE_ID;
    el.setAttribute('data-mfd-scope', 'tenant-runtime');
    document.head.appendChild(el);
  }
  return el;
}

// Subset of tokens that propagate to the OS surface. These tokens are
// usability-safe: tinting the accent and fonts does not break editor
// readability (unlike overriding background/surface/border).
const OS_SAFE_VAR_MAP = {
  'palette.primary':        '--bp-primary',
  'palette.accent':         '--bp-accent',
  'typography.display':     '--bp-font-heading',
  'typography.body':        '--bp-font-body',
};

export function applyThemeVarsToRoot(theme) {
  if (typeof document === 'undefined') return;
  const styleEl = _runtimeStyleEl();
  if (!styleEl) return;
  if (!theme) {
    styleEl.textContent = '';
    document.documentElement.removeAttribute('data-tenant-theme');
    document.documentElement.removeAttribute('data-tenant-mode');
    return;
  }

  // ── Storefront (full theme) ────────────────────────────────────
  const storefrontDecls = [];
  Object.entries(VAR_MAP).forEach(([path, cssVar]) => {
    let value = dig(theme, path);
    if (cssVar === '--brand-font-display' || cssVar === '--brand-font-body') {
      value = fontFamilyFor(value);
    }
    if (value != null && value !== '') {
      storefrontDecls.push(`${cssVar}: ${String(value)};`);
    }
  });

  // ── Blueprint OS (safe subset only) ─────────────────────────────
  const osDecls = [];
  Object.entries(OS_SAFE_VAR_MAP).forEach(([path, cssVar]) => {
    let value = dig(theme, path);
    if (cssVar === '--bp-font-heading' || cssVar === '--bp-font-body') {
      value = fontFamilyFor(value);
    }
    if (value != null && value !== '') {
      osDecls.push(`${cssVar}: ${String(value)};`);
    }
  });
  // Derive primary-soft and primary-glow tints from the tenant primary
  // so hover/active states feel cohesive across the editor chrome.
  const p = dig(theme, 'palette.primary');
  if (typeof p === 'string' && /^#[0-9a-f]{6}$/i.test(p)) {
    const r = parseInt(p.slice(1, 3), 16);
    const g = parseInt(p.slice(3, 5), 16);
    const b = parseInt(p.slice(5, 7), 16);
    osDecls.push(`--bp-primary-soft: rgba(${r}, ${g}, ${b}, 0.12);`);
    osDecls.push(`--bp-primary-glow: rgba(${r}, ${g}, ${b}, 0.18);`);
    osDecls.push(`--bp-border-hover: rgba(${r}, ${g}, ${b}, 0.28);`);
    osDecls.push(`--bp-border-active: rgba(${r}, ${g}, ${b}, 0.40);`);
    osDecls.push(`--bp-selection-bg: rgba(${r}, ${g}, ${b}, 0.20);`);
  }

  styleEl.textContent = `[data-surface="storefront"] {\n  ${storefrontDecls.join('\n  ')}\n}\n[data-surface="os"] {\n  ${osDecls.join('\n  ')}\n}`;

  if (theme.preset_key) document.documentElement.setAttribute('data-tenant-theme', theme.preset_key);
  if (theme.mode)       document.documentElement.setAttribute('data-tenant-mode', theme.mode);
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
