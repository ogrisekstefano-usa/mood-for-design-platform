// ──────────────────────────────────────────────────────────────────────
// Storefront renderers — shared primitives (Phase W refactor)
// ──────────────────────────────────────────────────────────────────────
// Extracted from the original SectionRenderers.jsx (~1450 LOC) so each
// Phase U inline editor lives in its own dedicated file. Behavior is
// 100% preserved — this module only re-exports the helpers.
//
import React from 'react';
import { Image as ImageIcon, Plus, Gem, Users, Sparkles, Globe, ShieldCheck } from 'lucide-react';
import { pickLocale } from '../storefrontApi';

// Standard locale fallback chain used across every renderer.
export const FALLBACK_CHAIN = ['it', 'en-US', 'en-GB', 'fr', 'de', 'es'];

// Pillar icon registry used by ValueProps + a couple of legacy bags.
export const PILLAR_ICONS = [
  { key: 'gem',          Icon: Gem },
  { key: 'users',        Icon: Users },
  { key: 'sparkles',     Icon: Sparkles },
  { key: 'globe',        Icon: Globe },
  { key: 'shield-check', Icon: ShieldCheck },
];
export const ICON_MAP = Object.fromEntries(PILLAR_ICONS.map(({ key, Icon }) => [key, Icon]));

// Resolve a localized field from `draft` (autosaved overrides) first,
// then fall back through the FALLBACK_CHAIN of locales stored in the
// section's persisted `locale_content`.
export const getField = (section, draft, locale, field) => {
  const bag = draft || section.locale_content || {};
  if (bag[locale] && bag[locale][field] != null) return bag[locale][field];
  return pickLocale(
    Object.fromEntries(
      Object.entries(bag).filter(([, v]) => v && typeof v === 'object' && field in v).map(([k, v]) => [k, v[field]])
    ),
    locale,
    FALLBACK_CHAIN,
  );
};

export const getSetting = (section, key) => (section.settings || {})[key];

// Replace-image overlay used inside Hero, ProjectsPreview, MagazineGrid, etc.
export const EditableImage = ({ url, openAssetPicker, onPick, label = 'Replace image', testid, aspect = 'aspect-[16/9]' }) => (
  <button
    onClick={() => openAssetPicker(onPick)}
    data-testid={testid}
    className={`relative w-full ${aspect} overflow-hidden bg-[var(--bp-surface-2)] border border-[var(--bp-border)] group cursor-pointer block`}
  >
    {url ? (
      <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageIcon size={36} strokeWidth={1} className="text-[var(--bp-text-muted)]" />
      </div>
    )}
    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
      <p className="text-white text-[10px] font-body uppercase tracking-[0.2em] flex items-center gap-2">
        <Plus size={12} strokeWidth={1.6} /> {label}
      </p>
    </div>
  </button>
);

// ─── FLOATING BLOCK TOOLBAR PRIMITIVES (Phase U) ────────────────────────
// Shared by StatsBand, MagazineGrid, BrandLogos and TeamIdentityCard.
// Calm dark glass-morphism pill, hover-revealed via group-hover state on
// the enclosing renderer wrapper.

export const BlockToolbar = ({ children, testid }) => (
  <div
    className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-[3px] bg-black/85 backdrop-blur-xl border border-white/12 text-white shadow-2xl opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
    data-testid={testid}
  >
    {children}
  </div>
);

export const ToolbarSegment = ({ label, children }) => (
  <div className="flex items-center gap-1.5 px-2 border-r border-white/10 last:border-0 last:pr-0 first:pl-0">
    <span className="text-white/45 text-[9px] uppercase tracking-[0.22em] hidden md:inline">{label}</span>
    <div className="flex items-center gap-1">{children}</div>
  </div>
);

export const ToolbarChip = ({ active, onClick, testid, children }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`inline-flex items-center px-2 py-1 rounded-[2px] border text-[9px] uppercase tracking-[0.18em] transition-colors
      ${active
        ? 'border-[var(--bp-primary)] text-[var(--bp-primary)] bg-[var(--bp-primary)]/10'
        : 'border-white/12 text-white/75 hover:text-white hover:border-white/30'}`}
  >
    {children}
  </button>
);
