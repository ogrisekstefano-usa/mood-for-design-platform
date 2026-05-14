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
import { PREMIUM_TEMPLATE_IDS, getPremiumTemplate } from './premiumTemplates';

// ── Mini editorial preview (curated per skeleton id) ────────────────────────
// Each skeleton renders a small CURATED composition — real photography +
// real palette + real typography — instead of an abstract wireframe. See
// EditorialSkeletonPreview for the per-id moods (hospitality / japandi /
// materials / etc).
const SkeletonPreview = ({ skeleton }) => (
  <EditorialSkeletonPreview skeleton={skeleton} />
);

// ── Premium pre-built template card (large, cinematic) ──────────────────────
// Visually distinct from the regular skeleton cards: bigger, with the eyebrow
// "PREMIUM" + a description below the preview. One-click apply via onPickPremium.
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
      <span className="absolute top-2 left-2 px-2 py-[3px] rounded-full
                       bg-black/55 backdrop-blur-sm text-white
                       text-[8px] tracking-[0.28em] uppercase font-body
                       flex items-center gap-1">
        <Sparkles size={9} strokeWidth={1.6} />
        Premium
      </span>
    </div>
    <div className="px-4 py-3 border-t border-[var(--bp-border)]">
      <p className="bp-caption !text-[12px] !text-[var(--bp-text-primary)] !font-medium mb-1">
        {tpl.name}
      </p>
      <p className="bp-caption !text-[10px] !text-[var(--bp-text-muted)] leading-[1.45] line-clamp-2">
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
          {/* PREMIUM PRE-BUILT TEMPLATES — top of the picker. These are
              fully-composed moodboards (real imagery + palette + typography).
              One click applies all blocks to a brand-new page. */}
          {onPickPremium && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={11} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
                  <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-primary)]">
                    {t('moodboards.premium.eyebrow', null, 'Premium pre-built templates')}
                  </p>
                </div>
                <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] hidden md:block">
                  {t('moodboards.premium.subtitle', null, 'A finished moodboard in one click — edit anything.')}
                </p>
              </div>
              <div className="grid gap-4"
                   style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {PREMIUM_TEMPLATE_IDS.map((tplId) => {
                  const tpl = getPremiumTemplate(tplId);
                  return tpl ? <PremiumCard key={tplId} tpl={tpl} onPickPremium={onPickPremium} /> : null;
                })}
              </div>
              <div className="mt-8 mb-2 h-px bg-[var(--bp-section-divider)]" />
              <p className="bp-eyebrow !text-[9.5px] !text-[var(--bp-text-muted)] mt-2">
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
