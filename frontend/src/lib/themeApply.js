/**
 * themeApply.js — Util condiviso per applicare un theme PRESET ovunque.
 *
 * Usato sia da PaletteSwitcher (topbar) sia da BrandStudioPage.applyPreset.
 *
 * Strategia robusta:
 *   1. setAttribute data-workspace-mode + data-palette-mode su <html>
 *   2. setProperty su :root, <body>, e TUTTI i [data-surface] elements
 *      (le var --bp-* sono dichiarate sotto `[data-surface="os"]` in tokens.css)
 *   3. Calcola dinamicamente --bp-on-primary in base alla luminance del
 *      primary color (bianco se primary scuro, nero se primary chiaro)
 *      così i bottoni primary restano leggibili in ogni combinazione.
 *   4. Calcola anche --bp-warning-bg/-text adattivi per pill "IN RITARDO" ecc.
 */

// Hex/rgba → luminance 0..1 (formula WCAG sRGB)
const parseColorTo01 = (input) => {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  let r, g, b;
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return null;
    r = parseInt(m[1], 10); g = parseInt(m[2], 10); b = parseInt(m[3], 10);
  }
  return [r / 255, g / 255, b / 255];
};

const luminance = (rgb01) => {
  if (!rgb01) return 0.5;
  const [r, g, b] = rgb01.map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const isLightColor = (color) => luminance(parseColorTo01(color)) > 0.55;

export const applyThemeEverywhere = (theme) => {
  if (!theme) return;
  const p = theme.palette || {};
  const isDark = (theme.mode || '').toLowerCase() === 'dark';
  const root = document.documentElement;

  root.setAttribute('data-theme-mode', isDark ? 'dark' : 'light');
  root.setAttribute('data-workspace-mode', isDark ? 'dark' : 'light');
  root.setAttribute('data-palette-mode', isDark ? 'dark' : 'light');

  // Contrasto on-primary: nero su primary chiaro, bianco su primary scuro
  const onPrimary = isLightColor(p.primary) ? '#0A0B0D' : '#FFFFFF';
  const onAccent  = isLightColor(p.accent)  ? '#0A0B0D' : '#FFFFFF';

  // Warning pill adattiva — fondo soft trasparente del warning + testo warning saturo
  const warningBase = p.warning || (isDark ? '#E0C088' : '#B5523B');
  const dangerBase  = p.danger  || (isDark ? '#CA6A7C' : '#B5523B');
  const successBase = p.success || (isDark ? '#79C7A0' : '#6F8C5A');

  const primarySoft = isLightColor(p.background)
    ? `${p.primary || '#888'}1F`   // 12% opacity in hex
    : `${p.primary || '#888'}29`;  // 16% opacity in hex
  const warningSoft = isLightColor(p.background) ? `${warningBase}24` : `${warningBase}33`;
  const dangerSoft  = isLightColor(p.background) ? `${dangerBase}24`  : `${dangerBase}33`;
  const successSoft = isLightColor(p.background) ? `${successBase}24` : `${successBase}33`;

  const tokens = {
    '--bp-bg':              p.background,
    '--bp-bg-deep':         p.background,
    '--bp-surface':         p.surface,
    '--bp-surface-1':       p.surface,
    '--bp-surface-2':       p.surface,
    '--bp-surface-3':       p.surface,
    '--bp-surface-elev':    p.surface,
    '--bp-surface-elevated':p.surface,
    '--bp-border':          p.border,
    '--bp-border-strong':   p.border,
    '--bp-text':            p.text_primary,
    '--bp-text-primary':    p.text_primary,
    '--bp-text-secondary':  p.text_secondary,
    '--bp-text-muted':      p.text_secondary,
    '--bp-primary':         p.primary,
    '--bp-primary-soft':    primarySoft,
    '--bp-accent':          p.accent,
    '--bp-on-primary':      onPrimary,
    '--bp-on-accent':       onAccent,
    '--bp-success':         successBase,
    '--bp-success-soft':    successSoft,
    '--bp-warning':         warningBase,
    '--bp-warning-soft':    warningSoft,
    '--bp-danger':          dangerBase,
    '--bp-danger-soft':     dangerSoft,
    '--brand-primary':      p.primary,
    '--brand-bg':           p.background,
    '--brand-surface':      p.surface,
    '--brand-text':         p.text_primary,
  };

  const applyTokens = (el) => {
    Object.entries(tokens).forEach(([k, v]) => v && el.style.setProperty(k, v, 'important'));
  };

  applyTokens(root);
  if (document.body) applyTokens(document.body);
  document.querySelectorAll('[data-surface]').forEach(applyTokens);
};

export default applyThemeEverywhere;
