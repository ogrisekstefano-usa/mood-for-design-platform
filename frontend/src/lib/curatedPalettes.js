/**
 * curatedPalettes.js — 24 curated palettes for the MOOD for DESIGN™ theme switcher.
 *
 * Two families:
 *   • LIGHT (15) — chiari/colorati, editorial paper / Kinfolk / Notion / AD calm
 *   • DARK   (9) — cinematic dark, never pure #000, sempre con un'anima cromatica
 *
 * Tutti i temi mantengono il MINIMO 7:1 di contrasto AAA per il testo primario
 * e 4.5:1 per il secondario. "Aggressive" (Cobalt · Burgundy · Cinnabar · Forest)
 * vengono comunque attenuati in modo da non affaticare per uso quotidiano.
 *
 * Ogni palette espone esattamente i token consumati da TenantThemeContext +
 * index.css globali, così quando l'utente cambia palette TUTTI i componenti
 * che usano `var(--bp-*)` si aggiornano istantaneamente — niente refactor lato
 * pagina, niente flicker.
 */

const lightPalettes = [
  {
    id: 'ivory',
    name: 'Ivory',
    description: 'Carta editoriale calda — il default Kinfolk/Aesop.',
    bg: '#F2ECE0', surface: '#E8E0D0', surfaceElev: '#DCD2BE',
    border: 'rgba(20,17,14,0.10)', borderStrong: 'rgba(20,17,14,0.24)',
    text: '#0F0D0A', textMuted: '#5A5147', textFaint: '#8A7F70',
    primary: '#0D8A70', primarySoft: 'rgba(13,138,112,0.16)',
    accent: '#7A5530',
  },
  {
    id: 'linen',
    name: 'Linen',
    description: 'Lino naturale · trame artigianali.',
    bg: '#EFE9DA', surface: '#E1D9C5', surfaceElev: '#D3C8B0',
    border: 'rgba(22,18,14,0.10)', borderStrong: 'rgba(22,18,14,0.22)',
    text: '#1B1611', textMuted: '#564B3D', textFaint: '#8C7E69',
    primary: '#7A5A33', primarySoft: 'rgba(122,90,51,0.16)',
    accent: '#3A6056',
  },
  {
    id: 'pearl',
    name: 'Pearl',
    description: 'Bianco perlato · fotografia da catalogo.',
    bg: '#F5F2EC', surface: '#EAE6DD', surfaceElev: '#DEDACE',
    border: 'rgba(15,15,15,0.09)', borderStrong: 'rgba(15,15,15,0.20)',
    text: '#161513', textMuted: '#54514A', textFaint: '#8B877D',
    primary: '#22302E', primarySoft: 'rgba(34,48,46,0.14)',
    accent: '#A88B5A',
  },
  {
    id: 'champagne',
    name: 'Champagne',
    description: 'Oro tenue · luxury hospitality.',
    bg: '#F4EDDC', surface: '#E9DEC4', surfaceElev: '#DCCFAB',
    border: 'rgba(70,55,30,0.12)', borderStrong: 'rgba(70,55,30,0.24)',
    text: '#1E1810', textMuted: '#5A4A30', textFaint: '#8A7752',
    primary: '#A37432', primarySoft: 'rgba(163,116,50,0.16)',
    accent: '#22302E',
  },
  {
    id: 'sand',
    name: 'Sand',
    description: 'Sabbia mediterranea · materiali tattili.',
    bg: '#EFE3D0', surface: '#E2D2B6', surfaceElev: '#D2BE9A',
    border: 'rgba(50,38,20,0.12)', borderStrong: 'rgba(50,38,20,0.24)',
    text: '#1C160E', textMuted: '#4F4128', textFaint: '#857354',
    primary: '#8B5A2B', primarySoft: 'rgba(139,90,43,0.16)',
    accent: '#2A4B3F',
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Verde salvia · interior calmness.',
    bg: '#E8EBE0', surface: '#D9DECD', surfaceElev: '#C7CFB6',
    border: 'rgba(30,40,28,0.12)', borderStrong: 'rgba(30,40,28,0.24)',
    text: '#15201C', textMuted: '#3F4F3F', textFaint: '#6F8276',
    primary: '#3D6A50', primarySoft: 'rgba(61,106,80,0.16)',
    accent: '#7A5A33',
  },
  {
    id: 'mint',
    name: 'Mint',
    description: 'Verde menta · freschezza editoriale.',
    bg: '#E6F0EA', surface: '#D2E6DA', surfaceElev: '#B8D7C6',
    border: 'rgba(20,50,40,0.10)', borderStrong: 'rgba(20,50,40,0.22)',
    text: '#0E2018', textMuted: '#365044', textFaint: '#688576',
    primary: '#0D8A70', primarySoft: 'rgba(13,138,112,0.18)',
    accent: '#2A4F4E',
  },
  {
    id: 'sky',
    name: 'Sky',
    description: 'Azzurro cielo · spaziosità.',
    bg: '#E7EEF2', surface: '#D5E1E8', surfaceElev: '#BCCFD9',
    border: 'rgba(15,40,55,0.10)', borderStrong: 'rgba(15,40,55,0.22)',
    text: '#0D1A22', textMuted: '#365062', textFaint: '#6B7E8A',
    primary: '#2E6E8E', primarySoft: 'rgba(46,110,142,0.16)',
    accent: '#7E5E32',
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Rosa cipria · couture morbida.',
    bg: '#F2E5E2', surface: '#E6D4D0', surfaceElev: '#D7BDB7',
    border: 'rgba(50,25,25,0.12)', borderStrong: 'rgba(50,25,25,0.22)',
    text: '#1F1311', textMuted: '#553A38', textFaint: '#896C68',
    primary: '#9D4E5A', primarySoft: 'rgba(157,78,90,0.16)',
    accent: '#3F4F3F',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    description: 'Lavanda francese · soft elegance.',
    bg: '#EBE7F0', surface: '#DED6E5', surfaceElev: '#C9BED5',
    border: 'rgba(30,20,50,0.10)', borderStrong: 'rgba(30,20,50,0.22)',
    text: '#170F22', textMuted: '#3F3556', textFaint: '#6F627E',
    primary: '#6B4B9D', primarySoft: 'rgba(107,75,157,0.16)',
    accent: '#7A6F4F',
  },
  {
    id: 'peach',
    name: 'Peach',
    description: 'Pesca delicata · accoglienza.',
    bg: '#F3E4D6', surface: '#E8D2BD', surfaceElev: '#DBBA9D',
    border: 'rgba(55,30,15,0.10)', borderStrong: 'rgba(55,30,15,0.22)',
    text: '#211410', textMuted: '#553F2E', textFaint: '#8B7561',
    primary: '#C16A3D', primarySoft: 'rgba(193,106,61,0.18)',
    accent: '#3D6A50',
  },
  {
    id: 'pistachio',
    name: 'Pistachio',
    description: 'Pistacchio · accent giocoso ma raffinato.',
    bg: '#EEF1DC', surface: '#E0E6C6', surfaceElev: '#CFD7A8',
    border: 'rgba(40,50,15,0.12)', borderStrong: 'rgba(40,50,15,0.24)',
    text: '#1B1F0C', textMuted: '#475330', textFaint: '#7A8559',
    primary: '#6E8C2B', primarySoft: 'rgba(110,140,43,0.18)',
    accent: '#7A5A33',
  },
  {
    id: 'coral',
    name: 'Coral',
    description: 'Corallo · energia editoriale (sobria).',
    bg: '#F4E7DD', surface: '#EBD3C2', surfaceElev: '#DFB7A0',
    border: 'rgba(65,25,15,0.12)', borderStrong: 'rgba(65,25,15,0.24)',
    text: '#241410', textMuted: '#5A3528', textFaint: '#8C6A5C',
    primary: '#CE5944', primarySoft: 'rgba(206,89,68,0.18)',
    accent: '#2A4B3F',
  },
  {
    id: 'aqua',
    name: 'Aqua',
    description: 'Acquamarina · freschezza marina.',
    bg: '#E1EEEC', surface: '#CCE0DD', surfaceElev: '#AECBC6',
    border: 'rgba(10,45,40,0.10)', borderStrong: 'rgba(10,45,40,0.22)',
    text: '#0B1E1C', textMuted: '#345352', textFaint: '#67807F',
    primary: '#1E8E8A', primarySoft: 'rgba(30,142,138,0.16)',
    accent: '#7A6F4F',
  },
  {
    id: 'sunshine',
    name: 'Sunshine',
    description: 'Giallo solare · ottimismo discreto.',
    bg: '#F5EDD2', surface: '#EADEB1', surfaceElev: '#DBC988',
    border: 'rgba(60,45,10,0.12)', borderStrong: 'rgba(60,45,10,0.24)',
    text: '#221A0A', textMuted: '#5A4827', textFaint: '#8C7B4F',
    primary: '#B88C20', primarySoft: 'rgba(184,140,32,0.18)',
    accent: '#3D6A50',
  },
];

const darkPalettes = [
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
    id: 'midnight',
    name: 'Midnight',
    description: 'Notte profonda · cinema editoriale.',
    bg: '#0A0F1A', surface: '#10182A', surfaceElev: '#161F36',
    border: 'rgba(180,200,255,0.08)', borderStrong: 'rgba(180,200,255,0.18)',
    text: '#E8ECF5', textMuted: '#9AA2B5', textFaint: '#5E6578',
    primary: '#7AA8E0', primarySoft: 'rgba(122,168,224,0.16)',
    accent: '#C9A36E',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Vetro vulcanico · contrasti netti.',
    bg: '#0A0A0C', surface: '#121215', surfaceElev: '#18181D',
    border: 'rgba(255,255,255,0.07)', borderStrong: 'rgba(255,255,255,0.16)',
    text: '#F3F2EF', textMuted: '#A8A6A1', textFaint: '#6E6C68',
    primary: '#00C9B3', primarySoft: 'rgba(0,201,179,0.16)',
    accent: '#E0C088',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Carbonio · sobrio, tecnico.',
    bg: '#101113', surface: '#181A1D', surfaceElev: '#1F2126',
    border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.14)',
    text: '#E6E8EC', textMuted: '#969AA2', textFaint: '#5F636B',
    primary: '#CDD3DC', primarySoft: 'rgba(205,211,220,0.12)',
    accent: '#88c0d0',
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
    id: 'burgundy',
    name: 'Burgundy',
    description: 'Bordeaux · couture serale (intenso ma calmo).',
    bg: '#170B0E', surface: '#23131A', surfaceElev: '#2E1A22',
    border: 'rgba(255,180,200,0.08)', borderStrong: 'rgba(255,180,200,0.18)',
    text: '#F1E4E6', textMuted: '#B59298', textFaint: '#7C5F64',
    primary: '#CA6A7C', primarySoft: 'rgba(202,106,124,0.16)',
    accent: '#E0C088',
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
    id: 'cobalt',
    name: 'Cobalt',
    description: 'Cobalto profondo · aggressive ma elegante.',
    bg: '#080D1F', surface: '#0E1530', surfaceElev: '#141F44',
    border: 'rgba(150,180,255,0.10)', borderStrong: 'rgba(150,180,255,0.22)',
    text: '#E6EAF7', textMuted: '#909CC4', textFaint: '#5C6794',
    primary: '#5A8FE5', primarySoft: 'rgba(90,143,229,0.18)',
    accent: '#E0C088',
  },
];

export const CURATED_PALETTES = [...lightPalettes, ...darkPalettes];
export const LIGHT_PALETTES = lightPalettes;
export const DARK_PALETTES  = darkPalettes;
export const PALETTE_BY_ID = Object.fromEntries(CURATED_PALETTES.map((p) => [p.id, p]));

/** Apply a palette by id to <html> as CSS variables + data attributes. */
export const applyPalette = (id) => {
  const p = PALETTE_BY_ID[id];
  if (!p) return;
  const r = document.documentElement;
  const mode = darkPalettes.includes(p) ? 'dark' : 'light';

  r.setAttribute('data-palette', id);
  r.setAttribute('data-palette-mode', mode);
  // Keep legacy attr in sync so existing CSS rules still match.
  r.setAttribute('data-workspace-mode', mode);

  // Map palette → CSS vars consumed across the app (bp-* tokens).
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

  // ALSO override the [data-surface="os"] scope so the palette wins over
  // tenant theme variables emitted by TenantThemeContext. The user-picked
  // palette is the source of truth at the workspace level.
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

export const getStoredPalette = () => {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && PALETTE_BY_ID[id]) return id;
  } catch { /* SSR safe */ }
  // Honor existing workspace-mode if present (back-compat).
  const legacy = (typeof document !== 'undefined')
    ? document.documentElement.getAttribute('data-workspace-mode')
    : null;
  return legacy === 'light' ? 'ivory' : 'graphite';
};

export const storePalette = (id) => {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* noop */ }
};
