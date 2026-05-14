/**
 * Font registry — curated luxury editorial typography for interior designers.
 *
 * Bound via @import in index.css → Google Fonts CDN. The frontend NEVER
 * hard-codes a raw font-family string outside this file; everything else
 * references the registry by id so a future "Global Project Styles" panel
 * can override per-tenant. Inspector pills read this list as well, so adding
 * a font here makes it instantly available in the TextBlock inspector.
 *
 * Categories drive the visual grouping in the inspector picker.
 */
export const FONT_REGISTRY = [
  // ── DISPLAY (headings, eyebrows, hero captions) ─────────────────────────
  { id: 'playfair',   family: '"Playfair Display", serif',          label: 'Playfair Display', category: 'display' },
  { id: 'cormorant',  family: '"Cormorant Garamond", serif',        label: 'Cormorant Garamond', category: 'display' },
  { id: 'dm_serif',   family: '"DM Serif Display", serif',          label: 'DM Serif', category: 'display' },
  { id: 'fraunces',   family: '"Fraunces", serif',                  label: 'Fraunces', category: 'display' },
  { id: 'space_grot', family: '"Space Grotesk", sans-serif',        label: 'Space Grotesk', category: 'display' },

  // ── BODY (running text, body copy, descriptions) ────────────────────────
  { id: 'inter',      family: '"Inter", sans-serif',                label: 'Inter', category: 'body' },
  { id: 'manrope',    family: '"Manrope", sans-serif',              label: 'Manrope', category: 'body' },
  { id: 'jakarta',    family: '"Plus Jakarta Sans", sans-serif',    label: 'Plus Jakarta Sans', category: 'body' },
  { id: 'instrument', family: '"Instrument Sans", sans-serif',      label: 'Instrument Sans', category: 'body' },
  { id: 'general',    family: 'ui-sans-serif, system-ui, "Helvetica Neue", sans-serif', label: 'System Sans', category: 'body' },

  // ── HANDWRITING (annotations, sketch markup) ────────────────────────────
  { id: 'caveat',     family: '"Caveat", cursive',                  label: 'Caveat', category: 'handwriting' },
  { id: 'kalam',      family: '"Kalam", cursive',                   label: 'Kalam', category: 'handwriting' },

  // ── LEGACY (the original 3 — backward compatibility with existing blocks)
  { id: 'heading',    family: 'var(--bp-font-heading)',             label: 'Display (theme)', category: 'theme' },
  { id: 'body',       family: 'var(--bp-font-body)',                label: 'Body (theme)', category: 'theme' },
  { id: 'mono',       family: 'var(--bp-font-mono)',                label: 'Mono (theme)', category: 'theme' },
];

export const FONT_CATEGORIES = [
  { id: 'display',     label: 'Display' },
  { id: 'body',        label: 'Body' },
  { id: 'handwriting', label: 'Handwriting' },
  { id: 'theme',       label: 'Theme' },
];

export const resolveFontFamily = (id) => {
  const f = FONT_REGISTRY.find((x) => x.id === id);
  return f ? f.family : id;  // accept raw CSS family as a passthrough
};
