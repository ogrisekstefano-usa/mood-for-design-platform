/**
 * TenantThemeProvider — runtime CSS-variable injector for tenant theme.
 *
 * Reads `theme_settings` from /api/branding once at boot, then maps the payload
 * to a flat set of CSS variables and writes them on `document.documentElement`.
 *
 * TIERED THEME PROPAGATION (rev2 — Feb 2026):
 *
 *   STOREFRONT  (data-surface="storefront"):
 *     Full theme — primary, secondary, accent, bg, surface, text, border,
 *     status colors, fonts, radius, density, shadow.
 *
 *   BLUEPRINT OS  (data-surface="os"):
 *     Now mirrors the FULL theme (palette + fonts + radius + density +
 *     shadow). When the tenant picks a light preset the editor flips to
 *     light too. When they switch to dark, vice versa. The previous
 *     "safe subset only" approach was hiding the user's identity.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

const TenantThemeContext = createContext({
  theme: null, branding: null, loading: true,
  refresh: () => {}, applyDraft: () => {}, clearDraft: () => {},
});

// Font catalog — single source of truth for kind (serif vs sans).
// Used to emit the correct CSS fallback chain.
const FONT_KIND = {
  // Serif
  'Playfair Display': 'serif', 'Cormorant Garamond': 'serif',
  'DM Serif Display': 'serif', 'Bodoni Moda': 'serif', 'Fraunces': 'serif',
  'EB Garamond': 'serif', 'Cardo': 'serif', 'Lora': 'serif',
  // Sans
  'Inter': 'sans', 'Inter Tight': 'sans', 'Montserrat': 'sans',
  'Manrope': 'sans', 'Plus Jakarta Sans': 'sans', 'Space Grotesk': 'sans',
  'DM Sans': 'sans', 'Archivo': 'sans', 'Outfit': 'sans',
  'Work Sans': 'sans', 'Karla': 'sans', 'Sora': 'sans',
};

const fontFamilyFor = (name) => {
  if (!name) return undefined;
  const kind = FONT_KIND[name] || (/\s/.test(name) ? 'serif' : 'sans');
  const stack = kind === 'serif' ? 'serif' : 'system-ui, sans-serif';
  return `'${name}', ${stack}`;
};

// Shadow strength multipliers (consumed by --bp-shadow-strength)
const SHADOW_STRENGTH = { none: 0, soft: 0.6, medium: 1.0, strong: 1.5 };

// Density tokens (consumed via body class in index.css)
const DENSITY_CLASSES = ['density-compact', 'density-comfortable', 'density-spacious'];

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

// Full map: writes both --brand-* (storefront tokens) and --bp-* (OS tokens)
const VAR_MAP = [
  // path                 storefront var       OS var
  ['palette.primary',         '--brand-primary',    '--bp-primary'],
  ['palette.secondary',       '--brand-secondary',  '--bp-secondary'],
  ['palette.accent',          '--brand-accent',     '--bp-accent'],
  ['palette.background',      '--brand-bg',         '--bp-bg'],
  ['palette.surface',         '--brand-surface',    '--bp-surface'],
  ['palette.surface',         null,                 '--bp-surface-2'],
  ['palette.text_primary',    '--brand-text',       '--bp-text-primary'],
  ['palette.text_secondary',  '--brand-text-2',     '--bp-text-secondary'],
  ['palette.text_secondary',  null,                 '--bp-text-muted'],
  ['palette.border',          '--brand-border',     '--bp-border'],
  ['palette.success',         '--brand-success',    '--bp-success'],
  ['palette.warning',         '--brand-warning',    '--bp-warning'],
  ['palette.danger',          '--brand-danger',     '--bp-danger'],
  ['typography.display',      '--brand-font-display', '--bp-font-heading'],
  ['typography.body',         '--brand-font-body',  '--bp-font-body'],
  ['radius',                  '--brand-radius',     '--bp-radius-sm'],
];

const dig = (obj, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);

export function applyThemeVarsToRoot(theme) {
  if (typeof document === 'undefined') return;
  const styleEl = _runtimeStyleEl();
  if (!styleEl) return;

  // Clear density classes on body — always reset first
  const body = document.body;
  if (body) DENSITY_CLASSES.forEach((c) => body.classList.remove(c));

  if (!theme) {
    styleEl.textContent = '';
    document.documentElement.removeAttribute('data-tenant-theme');
    document.documentElement.removeAttribute('data-tenant-mode');
    return;
  }

  const storefrontDecls = [];
  const osDecls = [];

  VAR_MAP.forEach(([path, sfVar, osVar]) => {
    let value = dig(theme, path);
    if (path === 'typography.display' || path === 'typography.body') {
      value = fontFamilyFor(value);
    }
    if (value != null && value !== '') {
      if (sfVar) storefrontDecls.push(`${sfVar}: ${String(value)};`);
      if (osVar) osDecls.push(`${osVar}: ${String(value)};`);
    }
  });

  // Derive primary tints (soft / glow / border-hover / selection)
  const p = dig(theme, 'palette.primary');
  if (typeof p === 'string' && /^#[0-9a-f]{6}$/i.test(p)) {
    const r = parseInt(p.slice(1, 3), 16);
    const g = parseInt(p.slice(3, 5), 16);
    const b = parseInt(p.slice(5, 7), 16);
    const tints = [
      `--bp-primary-soft: rgba(${r}, ${g}, ${b}, 0.12);`,
      `--bp-primary-glow: rgba(${r}, ${g}, ${b}, 0.18);`,
      `--bp-border-hover: rgba(${r}, ${g}, ${b}, 0.28);`,
      `--bp-border-active: rgba(${r}, ${g}, ${b}, 0.40);`,
      `--bp-selection-bg: rgba(${r}, ${g}, ${b}, 0.20);`,
    ];
    osDecls.push(...tints);
    storefrontDecls.push(
      `--brand-primary-soft: rgba(${r}, ${g}, ${b}, 0.12);`,
      `--brand-primary-glow: rgba(${r}, ${g}, ${b}, 0.18);`,
    );
  }

  // Shadow strength — multiplier consumed by index.css shadow tokens
  const shadowKey = theme.shadow || 'soft';
  const strength = SHADOW_STRENGTH[shadowKey] ?? 0.6;
  osDecls.push(`--bp-shadow-strength: ${strength};`);
  storefrontDecls.push(`--brand-shadow-strength: ${strength};`);

  styleEl.textContent =
    `[data-surface="storefront"] {\n  ${storefrontDecls.join('\n  ')}\n}\n` +
    `[data-surface="os"] {\n  ${osDecls.join('\n  ')}\n}`;

  // Density → body class (consumed by existing index.css rules)
  if (body) {
    const density = theme.density || 'comfortable';
    body.classList.add(`density-${density}`);
  }

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
