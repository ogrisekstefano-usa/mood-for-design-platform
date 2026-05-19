/**
 * curatedPalettes.js — 12 preset editoriali SCURI · MOOD for DESIGN™
 *
 * UN SOLO SISTEMA. Niente più dualismo "Temi curati 24 + Preset editoriali".
 * Questa è la fonte unica di verità per tutto il theming editoriale.
 *
 * 12 atmosfere scure editoriali — Financial Times × Architectural Digest × Monocle.
 * Tutte mantengono contrasto AAA 7:1 sul testo primario, 4.5:1 sul secondario.
 *
 * Token emessi compatibili con TenantThemeContext + index.css globali.
 * Cambiando palette TUTTI i componenti che usano `var(--bp-*)` si aggiornano
 * istantaneamente — niente refactor, niente flicker.
 */

const editorialDarkPresets = [
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Grafite istituzionale · default scuro premium.',
    bg: '#0F0F10', surface: '#16171A', surfaceElev: '#1A1B1F',
    border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.14)',
    text: '#EFEBE4', textMuted: '#A19D98', textFaint: '#6B6863',
    primary: '#C9A36E', primarySoft: 'rgba(201,163,110,0.14)',
    accent: '#88c0d0',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Vetro vulcanico · cyan editoriale.',
    bg: '#0A0A0C', surface: '#121215', surfaceElev: '#18181D',
    border: 'rgba(255,255,255,0.07)', borderStrong: 'rgba(255,255,255,0.16)',
    text: '#F3F2EF', textMuted: '#A8A6A1', textFaint: '#6E6C68',
    primary: '#00C9B3', primarySoft: 'rgba(0,201,179,0.16)',
    accent: '#E0C088',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Carbonio · sobrio, tecnico, neutro.',
    bg: '#101113', surface: '#181A1D', surfaceElev: '#1F2126',
    border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.14)',
    text: '#E6E8EC', textMuted: '#969AA2', textFaint: '#5F636B',
    primary: '#CDD3DC', primarySoft: 'rgba(205,211,220,0.12)',
    accent: '#88c0d0',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Notte profonda · cinema editoriale blu.',
    bg: '#0A0F1A', surface: '#10182A', surfaceElev: '#161F36',
    border: 'rgba(180,200,255,0.08)', borderStrong: 'rgba(180,200,255,0.18)',
    text: '#E8ECF5', textMuted: '#9AA2B5', textFaint: '#5E6578',
    primary: '#7AA8E0', primarySoft: 'rgba(122,168,224,0.16)',
    accent: '#C9A36E',
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Ardesia · neutro freddo essenziale.',
    bg: '#0F1418', surface: '#171E24', surfaceElev: '#1F272F',
    border: 'rgba(200,220,240,0.07)', borderStrong: 'rgba(200,220,240,0.16)',
    text: '#E6EBF0', textMuted: '#94A0AC', textFaint: '#5E6973',
    primary: '#88c0d0', primarySoft: 'rgba(136,192,208,0.16)',
    accent: '#C9A36E',
  },
  {
    id: 'forest',
    name: 'Deep Forest',
    description: 'Foresta profonda · materialità organica.',
    bg: '#0C1411', surface: '#142020', surfaceElev: '#1B2A28',
    border: 'rgba(180,220,200,0.08)', borderStrong: 'rgba(180,220,200,0.18)',
    text: '#E6F0EA', textMuted: '#9AB0A6', textFaint: '#607169',
    primary: '#79C7A0', primarySoft: 'rgba(121,199,160,0.16)',
    accent: '#C9A36E',
  },
  {
    id: 'aubergine',
    name: 'Aubergine',
    description: 'Melanzana · viola scuro raffinato.',
    bg: '#120D18', surface: '#1C1525', surfaceElev: '#251D31',
    border: 'rgba(220,200,255,0.08)', borderStrong: 'rgba(220,200,255,0.18)',
    text: '#EEE7F3', textMuted: '#A799B0', textFaint: '#6E6478',
    primary: '#9C7AC9', primarySoft: 'rgba(156,122,201,0.16)',
    accent: '#C9A36E',
  },
  {
    id: 'burgundy',
    name: 'Burgundy',
    description: 'Bordeaux · couture serale.',
    bg: '#170B0E', surface: '#23131A', surfaceElev: '#2E1A22',
    border: 'rgba(255,180,200,0.08)', borderStrong: 'rgba(255,180,200,0.18)',
    text: '#F1E4E6', textMuted: '#B59298', textFaint: '#7C5F64',
    primary: '#CA6A7C', primarySoft: 'rgba(202,106,124,0.16)',
    accent: '#E0C088',
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    description: 'Cobalto profondo · forte ma elegante.',
    bg: '#080D1F', surface: '#0E1530', surfaceElev: '#141F44',
    border: 'rgba(150,180,255,0.10)', borderStrong: 'rgba(150,180,255,0.22)',
    text: '#E6EAF7', textMuted: '#909CC4', textFaint: '#5C6794',
    primary: '#5A8FE5', primarySoft: 'rgba(90,143,229,0.18)',
    accent: '#E0C088',
  },
  {
    id: 'espresso',
    name: 'Espresso',
    description: 'Caffè torrefatto · oro caldo editoriale.',
    bg: '#100C09', surface: '#1A1411', surfaceElev: '#241B16',
    border: 'rgba(230,200,160,0.10)', borderStrong: 'rgba(230,200,160,0.22)',
    text: '#F2EAD9', textMuted: '#B2A284', textFaint: '#776A52',
    primary: '#D9A86A', primarySoft: 'rgba(217,168,106,0.18)',
    accent: '#A0C0B0',
  },
  {
    id: 'pine',
    name: 'Pine Ink',
    description: 'Inchiostro pino · verde editoriale notturno.',
    bg: '#0A1310', surface: '#101E18', surfaceElev: '#162A22',
    border: 'rgba(180,220,200,0.08)', borderStrong: 'rgba(180,220,200,0.18)',
    text: '#E4ECE5', textMuted: '#90A29A', textFaint: '#5C6B65',
    primary: '#4FB58A', primarySoft: 'rgba(79,181,138,0.16)',
    accent: '#D9A86A',
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Nero assoluto · monocromia editoriale.',
    bg: '#050507', surface: '#0C0C0E', surfaceElev: '#141416',
    border: 'rgba(255,255,255,0.05)', borderStrong: 'rgba(255,255,255,0.12)',
    text: '#F0EFEC', textMuted: '#9A9893', textFaint: '#5E5C58',
    primary: '#E8DCC4', primarySoft: 'rgba(232,220,196,0.10)',
    accent: '#A88B5A',
  },
];

// Mantengo i nomi delle export per back-compat con il resto dell'app.
// LIGHT_PALETTES vuoto — non esistono più temi chiari curati.
export const CURATED_PALETTES = editorialDarkPresets;
export const LIGHT_PALETTES = [];
export const DARK_PALETTES  = editorialDarkPresets;
export const EDITORIAL_PRESETS = editorialDarkPresets; // alias semantico
export const PALETTE_BY_ID = Object.fromEntries(CURATED_PALETTES.map((p) => [p.id, p]));

/** Apply a palette by id to <html> as CSS variables + data attributes. */
export const applyPalette = (id) => {
  const p = PALETTE_BY_ID[id];
  if (!p) return;
  const r = document.documentElement;
  // Tutti i preset editoriali sono scuri ora.
  const mode = 'dark';

  r.setAttribute('data-palette', id);
  r.setAttribute('data-palette-mode', mode);
  r.setAttribute('data-workspace-mode', mode);

  const tokens = {
    '--bp-bg':              p.bg,
    '--bp-surface':         p.surface,
    '--bp-surface-1':       p.surface,
    '--bp-surface-2':       p.surfaceElev,
    '--bp-surface-3':       p.surfaceElev,
    '--bp-surface-elev':    p.surfaceElev,
    '--bp-border':          p.border,
    '--bp-border-strong':   p.borderStrong,
    '--bp-border-hover':    p.borderStrong,
    '--bp-text':            p.text,
    '--bp-text-primary':    p.text,
    '--bp-text-secondary':  p.text,
    '--bp-text-muted':      p.textMuted,
    '--bp-text-subtle':     p.textFaint,
    '--bp-text-faint':      p.textFaint,
    '--bp-primary':         p.primary,
    '--bp-primary-soft':    p.primarySoft,
    '--bp-accent':          p.accent,
    '--brand-primary':      p.primary,
    '--brand-bg':           p.bg,
    '--brand-surface':      p.surface,
    '--brand-text':         p.text,
  };
  Object.entries(tokens).forEach(([k, v]) => r.style.setProperty(k, v, 'important'));

  const STYLE_ID = 'palette-switcher-os-overrides';
  let styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  const decls = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v} !important;`).join('\n');
  styleEl.textContent = `html[data-palette] [data-surface="os"],\nhtml[data-palette] [data-surface="storefront"] {\n${decls}\n}`;
};

const STORAGE_KEY = 'mfd_curated_palette';

/** Remove the palette overrides — used when Brand Studio takes over. */
export const clearPalette = () => {
  const r = document.documentElement;
  r.removeAttribute('data-palette');
  const styleEl = document.getElementById('palette-switcher-os-overrides');
  if (styleEl) styleEl.remove();
  const keys = [
    '--bp-bg','--bp-surface','--bp-surface-1','--bp-surface-2','--bp-surface-3','--bp-surface-elev',
    '--bp-border','--bp-border-strong','--bp-border-hover',
    '--bp-text','--bp-text-primary','--bp-text-secondary','--bp-text-muted','--bp-text-subtle','--bp-text-faint',
    '--bp-primary','--bp-primary-soft','--bp-accent',
    '--brand-primary','--brand-bg','--brand-surface','--brand-text',
  ];
  keys.forEach((k) => r.style.removeProperty(k));
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
};

export const getStoredPalette = () => {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && PALETTE_BY_ID[id]) return id;
  } catch { /* SSR safe */ }
  return 'graphite';
};

export const storePalette = (id) => {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* noop */ }
};
