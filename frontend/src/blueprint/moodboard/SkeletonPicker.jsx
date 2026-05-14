/**
 * SkeletonPicker — Master Layouts™ gallery for the "Add page" flow.
 *
 * Editorial language:
 *  - Cinematic centered modal with cohesive dark surface
 *  - Category sections (cover · narrative · atmosphere · materials · …)
 *  - Wireframe-style previews that draw the skeleton geometry at scale
 *  - Hover lift + soft border accent — same easing as TemplatePicker
 *  - One-click pick → fires onPick(skeletonId)
 *
 * Pure Blueprint-driven: catalog comes from /api/moodboards/_meta/page_skeletons,
 * all labels via t().
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { X, LayoutGrid, Sparkles } from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import EditorialSkeletonPreview from './EditorialSkeletonPreview';
import PremiumTemplatePreview from './PremiumTemplatePreview';
import { PREMIUM_CATEGORIES, getTemplatesByCategory } from './premiumTemplates';

// ── Mini editorial preview (curated per skeleton id) ────────────────────────
// Each skeleton renders a small CURATED composition — real photography +
// real palette + real typography — instead of an abstract wireframe. See
// EditorialSkeletonPreview for the per-id moods (hospitality / japandi /
// materials / etc).
const SkeletonPreview = ({ skeleton }) => (
  <EditorialSkeletonPreview skeleton={skeleton} />
);

// ── Premium pre-built template card (cinematic, editorial) ─────────────────
// One curated visual per template + a short editorial caption. Larger aspect
// (4:5) than regular skeletons so each card reads as a portfolio piece, not
// a UI tile. PREMIUM chip in the corner signals the curation tier.
const PremiumCard = ({ tpl, onPickPremium }) => (
  <button type="button"
          onClick={() => onPickPremium(tpl.id)}
          data-testid={`premium-template-card-${tpl.id}`}
          className="group text-left flex flex-col rounded-[var(--bp-radius-sm)] overflow-hidden
                     border border-[var(--bp-border)] hover:border-[var(--bp-primary)]
                     transition-all duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease-emphasis)]
                     hover:-translate-y-1 hover:shadow-[var(--bp-elevation-lg)]
                     bg-[var(--bp-surface-1)]">
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
      <PremiumTemplatePreview id={tpl.id} />
      <span className="absolute top-2.5 left-2.5 px-2 py-[3px] rounded-full
                       bg-black/55 backdrop-blur-sm text-white
                       text-[8px] tracking-[0.28em] uppercase font-body
                       flex items-center gap-1">
        <Sparkles size={9} strokeWidth={1.6} />
        Premium
      </span>
      {/* hover-only soft vignette so the curated mood reads unobscured at rest */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100
                      transition-opacity duration-300"
           style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.20) 100%)' }} />
    </div>
    <div className="px-5 py-4 border-t border-[var(--bp-border)]">
      <p className="bp-caption !text-[12px] !text-[var(--bp-text-primary)] !font-medium mb-1.5 tracking-[0.01em]">
        {tpl.name}
      </p>
      <p className="bp-caption !text-[10.5px] !text-[var(--bp-text-muted)] leading-[1.55] line-clamp-2">
        {tpl.description}
      </p>
    </div>
  </button>
);

// ── Category-grouped picker grid ─────────────────────────────────────────────
const SkeletonCard = ({ sk, onPick, t }) => {
  // Editorial aspect ratio per skeleton's canvas (real proportions)
  const aspect = `${sk.width} / ${sk.height}`;
  const label = t(sk.label_key);
  // Hide label if i18n key is missing — fallback to id-derived label
  const safeLabel = label && label !== sk.label_key
    ? label
    : sk.id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <button type="button"
            onClick={() => onPick(sk.id)}
            data-testid={`skeleton-card-${sk.id}`}
            className="group text-left flex flex-col rounded-[var(--bp-radius-sm)] overflow-hidden
                       border border-[var(--bp-border)] hover:border-[var(--bp-primary)]
                       transition-all duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease-emphasis)]
                       hover:-translate-y-0.5 hover:shadow-[var(--bp-elevation-md)] bg-[var(--bp-surface-1)]">
      <div className="relative w-full overflow-hidden bg-[var(--bp-bg)]"
           style={{ aspectRatio: aspect }}>
        <SkeletonPreview skeleton={sk} />
        {/* Hover-only soft vignette — kept silent so the curated mood reads
            unobscured at rest. Only on hover do we add a subtle edge fade. */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
             style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%)' }} />
      </div>
      <div className="px-3 py-2.5">
        <h4 className="bp-body !text-[12px] !font-medium text-[var(--bp-text-primary)] truncate">
          {safeLabel}
        </h4>
        <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] mt-0.5 truncate">
          {t(`moodboards.page.type.${sk.page_type}`) || sk.page_type}
        </p>
      </div>
    </button>
  );
};

const SkeletonPicker = ({ skeletons, onPick, onPickPremium, onClose }) => {
  const { t } = useBlueprint();
  const dialogRef = useRef(null);

  // ESC closes the modal — keyboard-first like the rest of the editor
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Group by category_key so the gallery has editorial sections
  const grouped = useMemo(() => {
    const map = new Map();
    (skeletons || []).forEach((sk) => {
      const k = sk.category_key || 'moodboards.skeleton.category.other';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(sk);
    });
    return Array.from(map.entries());
  }, [skeletons]);

  const isLoading = skeletons === null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-md flex items-center justify-center p-6"
         data-testid="skeleton-picker"
         onClick={onClose}>
      <div ref={dialogRef}
           onClick={(e) => e.stopPropagation()}
           className="bp-glass relative w-full max-w-[1100px] max-h-[88vh] flex flex-col
                      rounded-[var(--bp-radius-md)] overflow-hidden">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 px-8 pt-7 pb-5 border-b border-[var(--bp-border)]">
          <div>
            <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] flex items-center gap-1.5">
              <LayoutGrid size={11} strokeWidth={1.5} />
              {t('moodboards.skeleton.eyebrow', null, 'Add a page')}
            </p>
            <h2 className="bp-h2 !text-[24px] text-[var(--bp-text-primary)] mt-1 font-light">
              {t('moodboards.skeleton.title', null, 'Choose your narrative structure')}
            </h2>
            <p className="bp-caption !text-[11px] !text-[var(--bp-text-subtle)] mt-1.5 max-w-[560px]">
              {t('moodboards.skeleton.subtitle', null,
                'Each layout is a starting point for a chapter of your story — covers, mood directions, material studies, atmospheres. Pick the rhythm, refine the details later.')}
            </p>
          </div>
          <button onClick={onClose} data-testid="skeleton-picker-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] p-1">
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* PREMIUM PRE-BUILT TEMPLATES — top of the picker, organised by
              editorial family so the modal reads as a curated archive rather
              than a flat grid. Each category renders only if it has at least
              one template. */}
          {onPickPremium && (
            <section className="mb-12">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={11} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
                  <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-primary)]">
                    {t('moodboards.premium.eyebrow', null, 'Premium pre-built templates')}
                  </p>
                </div>
                <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] hidden md:block">
                  {t('moodboards.premium.subtitle', null,
                     'A curated archive of finished moodboards — one click to start.')}
                </p>
              </div>
              {/* Hero divider — sets the editorial rhythm */}
              <div className="h-px bg-[var(--bp-section-divider)] mb-8" />

              {PREMIUM_CATEGORIES.map((cat, catIdx) => {
                const templates = getTemplatesByCategory(cat.key);
                if (templates.length === 0) return null;
                return (
                  <div key={cat.key}
                       data-testid={`premium-category-${cat.key}`}
                       className={catIdx > 0 ? 'mt-12' : ''}>
                    {/* Category header — editorial type + subtle rule */}
                    <div className="flex items-baseline justify-between mb-1 gap-6">
                      <h3 className="bp-h3 !text-[15px] !text-[var(--bp-text-primary)] font-light tracking-[0.04em]">
                        {t(`moodboards.premium.category.${cat.key}.title`, null, cat.title_fallback)}
                      </h3>
                      <p className="bp-caption !text-[10px] !text-[var(--bp-text-muted)] hidden md:block flex-1 text-right">
                        {t(`moodboards.premium.category.${cat.key}.subtitle`, null, cat.subtitle_fallback)}
                      </p>
                    </div>
                    <div className="h-px bg-[var(--bp-border)] mb-5" />
                    {/* Cards row — auto-fill so the rhythm always feels filled */}
                    <div className="grid gap-5"
                         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                      {templates.map((tpl) => (
                        <PremiumCard key={tpl.id} tpl={tpl} onPickPremium={onPickPremium} />
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="mt-12 mb-2 h-px bg-[var(--bp-section-divider)]" />
              <p className="bp-eyebrow !text-[9.5px] !text-[var(--bp-text-muted)] mt-3">
                {t('moodboards.skeleton.fromScratchEyebrow', null, 'Or start from a blank skeleton')}
              </p>
            </section>
          )}

          {isLoading ? (
            <div className="py-16 flex justify-center">
              <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="bp-caption text-[var(--bp-text-muted)] py-12 text-center">—</p>
          ) : (
            <div className="space-y-9">
              {grouped.map(([categoryKey, items]) => {
                const catLabel = t(categoryKey);
                const safeCat = catLabel && catLabel !== categoryKey
                  ? catLabel
                  : categoryKey.split('.').pop();
                return (
                  <section key={categoryKey}>
                    <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-3">
                      {safeCat}
                    </p>
                    <div className="grid gap-3.5"
                         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                      {items.map((sk) => (
                        <SkeletonCard key={sk.id} sk={sk} onPick={onPick} t={t} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkeletonPicker;
