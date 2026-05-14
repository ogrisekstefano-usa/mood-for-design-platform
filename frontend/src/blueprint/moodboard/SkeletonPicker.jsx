/**
 * SkeletonPicker — modal for picking the structural skeleton of a new page
 * OR applying a full multi-page Premium Template.
 *
 * Two clearly separated sections:
 *  1. PREMIUM CURATED ARCHIVE — complete 6-7 page presentations
 *     Applies an entire sequence of pages when picked.
 *  2. SKELETONS & STARTING POINTS — single empty page layouts
 *     Applies a single page when picked.
 *
 * The distinction is editorial and visual:
 *  - Premium cards are LARGE, with a hero preview, page-count badge and a
 *    mini filmstrip strip that signals "complete project" at a glance.
 *  - Skeleton cards are SMALL, compact starting-point tiles.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { X, LayoutGrid, Sparkles, FileText, Layers } from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import EditorialSkeletonPreview from './EditorialSkeletonPreview';
import PremiumTemplatePreview from './PremiumTemplatePreview';
import {
  PREMIUM_CATEGORIES, getTemplatesByCategory, getPremiumTemplatePageCount,
} from './premiumTemplates';

// ── Page-type color tones for the mini-filmstrip inside premium cards.
// Mirrored from PagesFilmstrip.jsx so cards read consistently with the editor.
const PAGE_TONE = {
  cover:            '#E0A458',
  blank:            '#6F6A65',
  mood:             '#8FB3A8',
  material_board:   '#C9AE8C',
  product_grid:     '#A6A3CC',
  palette:          '#D6B79A',
  gallery:          '#9B917F',
  split_story:      '#B59A78',
  quote:            '#7A8C9B',
  technical_board:  '#869099',
  floorplan:        '#7A6B58',
  proposal_summary: '#A8B5B3',
  approval:         '#15AC8B',
};

// ── Mini editorial preview for skeleton tiles ──────────────────────────────
const SkeletonPreview = ({ skeleton }) => (
  <EditorialSkeletonPreview skeleton={skeleton} />
);

// ── Premium pre-built template card — LARGE editorial composition ──────────
// Layout (top→bottom): hero (4:5) · header (title + count) · mini filmstrip.
const PremiumCard = ({ tpl, onPickPremium, t }) => {
  const pageCount = getPremiumTemplatePageCount(tpl.id);
  const pages = tpl.pages || [];
  const pageCountLabel = pageCount === 1
    ? t('moodboards.premium.pageCount.singular', null, 'page')
    : t('moodboards.premium.pageCount.plural', null, 'pages');
  return (
    <button type="button"
            onClick={() => onPickPremium(tpl.id)}
            data-testid={`premium-template-card-${tpl.id}`}
            className="group text-left flex flex-col rounded-[var(--bp-radius-sm)] overflow-hidden
                       border border-[var(--bp-border)] hover:border-[var(--bp-primary)]
                       transition-all duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease-emphasis)]
                       hover:-translate-y-1 hover:shadow-[var(--bp-elevation-lg)]
                       bg-[var(--bp-surface-1)]">
      {/* Hero preview — 4:5 portrait of the cover page */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4 / 5' }}>
        <PremiumTemplatePreview id={tpl.id} />
        {/* PREMIUM chip */}
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full
                         bg-black/60 backdrop-blur-sm text-white
                         text-[8.5px] tracking-[0.32em] uppercase font-body
                         flex items-center gap-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
          <Sparkles size={9.5} strokeWidth={1.6} />
          Premium
        </span>
        {/* Page count badge — top-left, signals "complete project" */}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full
                         bg-[var(--bp-primary)]/95 text-[var(--bp-bg)]
                         text-[8.5px] tracking-[0.32em] uppercase font-body font-semibold
                         flex items-center gap-1.5 shadow-[0_2px_10px_rgba(15,162,132,0.35)]
                         tabular-nums"
              data-testid={`premium-pagecount-${tpl.id}`}>
          <Layers size={9.5} strokeWidth={1.8} />
          {pageCount}&nbsp;{pageCountLabel}
        </span>
        {/* Hover-only soft vignette — kept silent at rest */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100
                        transition-opacity duration-300"
             style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.20) 100%)' }} />
      </div>

      {/* Body — editorial header */}
      <div className="px-5 pt-4 pb-3 border-t border-[var(--bp-border)]">
        <p className="font-mono text-[8.5px] tracking-[0.32em] uppercase
                      text-[var(--bp-text-subtle)] mb-1.5">
          {t(`moodboards.premium.category.${tpl.category}.eyebrow`, null,
            tpl.category.replace(/_/g, ' '))}
        </p>
        <h3 className="!text-[17px] !text-[var(--bp-text-primary)] font-light leading-tight tracking-[0.005em] mb-1.5"
            style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
          {tpl.name}
        </h3>
        <p className="bp-caption !text-[10.5px] !text-[var(--bp-text-muted)] italic leading-[1.5] line-clamp-2"
           style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
          {tpl.description}
        </p>
      </div>

      {/* Mini-filmstrip — shows ALL pages of the template as colored chips */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-1.5" data-testid={`premium-filmstrip-${tpl.id}`}>
          {pages.map((pg, i) => {
            const tone = PAGE_TONE[pg.page_type] || PAGE_TONE.blank;
            return (
              <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                <span className="block w-full h-[26px] rounded-[2px] overflow-hidden relative"
                      style={{
                        background: i === 0
                          ? `linear-gradient(135deg, ${tone}cc 0%, ${tone}88 100%)`
                          : `${tone}40`,
                        boxShadow: i === 0
                          ? `0 0 0 1px ${tone}80, 0 2px 6px ${tone}33`
                          : `0 0 0 1px ${tone}33`,
                      }} />
                <span className="text-[7.5px] font-mono tabular-nums text-[var(--bp-text-subtle)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </button>
  );
};

// ── Skeleton (single-page starting point) — compact tile ───────────────────
const SkeletonCard = ({ sk, onPick, t }) => {
  const aspect = `${sk.width} / ${sk.height}`;
  const label = t(sk.label_key);
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
        {/* Single-page badge — small, only on hover */}
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-[2px] rounded-full
                         bg-black/55 backdrop-blur-sm text-white/85
                         text-[7px] tracking-[0.28em] uppercase font-body
                         flex items-center gap-1 opacity-0 group-hover:opacity-100
                         transition-opacity duration-300">
          <FileText size={8} strokeWidth={1.5} />
          1 {t('moodboards.premium.pageCount.singular', null, 'page')}
        </span>
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
             style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%)' }} />
      </div>
      <div className="px-2.5 py-2">
        <h4 className="bp-body !text-[11px] !font-medium text-[var(--bp-text-primary)] truncate">
          {safeLabel}
        </h4>
        <p className="bp-caption !text-[9px] !text-[var(--bp-text-subtle)] mt-0.5 truncate uppercase tracking-[0.18em]">
          {t(`moodboards.page.type.${sk.page_type}`) || sk.page_type.replace(/_/g, ' ')}
        </p>
      </div>
    </button>
  );
};

const SkeletonPicker = ({ skeletons, onPick, onPickPremium, onClose }) => {
  const { t } = useBlueprint();
  const dialogRef = useRef(null);

  // ESC closes the modal
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Group skeletons by category_key for the lower section
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
  // Count premium templates (across categories) for the eyebrow counter
  const premiumCount = PREMIUM_CATEGORIES.reduce(
    (sum, cat) => sum + getTemplatesByCategory(cat.key).length, 0,
  );

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bp-overlay)] backdrop-blur-md flex items-center justify-center p-6"
         data-testid="skeleton-picker"
         onClick={onClose}>
      <div ref={dialogRef}
           onClick={(e) => e.stopPropagation()}
           className="bp-glass relative w-full max-w-[1200px] max-h-[90vh] flex flex-col
                      rounded-[var(--bp-radius-md)] overflow-hidden">
        {/* Header — editorial title + clear distinction copy */}
        <header className="flex items-start justify-between gap-6 px-9 pt-8 pb-6 border-b border-[var(--bp-border)]">
          <div>
            <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] flex items-center gap-1.5 !tracking-[0.32em]">
              <LayoutGrid size={11} strokeWidth={1.5} />
              {t('moodboards.picker.eyebrow', null, 'Editorial structure')}
            </p>
            <h2 className="!text-[28px] !text-[var(--bp-text-primary)] mt-2 font-light tracking-[0.005em] leading-tight"
                style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
              {t('moodboards.picker.title', null, 'Choose an editorial structure')}
            </h2>
            <p className="bp-caption !text-[12px] !text-[var(--bp-text-muted)] mt-2 max-w-[640px] italic leading-[1.55]"
               style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
              {t('moodboards.picker.subtitle', null,
                'Start from a complete multi-page presentation, or add a single empty page as a starting point.')}
            </p>
          </div>
          <button onClick={onClose} data-testid="skeleton-picker-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] p-1">
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-9 py-7">
          {/* ───────────── PREMIUM CURATED ARCHIVE ───────────── */}
          {onPickPremium && (
            <section className="mb-16" data-testid="premium-section">
              {/* Section header — magazine-grade */}
              <div className="flex items-baseline justify-between gap-6 mb-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={13} strokeWidth={1.5} className="text-[var(--bp-primary)]" />
                  <p className="bp-eyebrow !text-[11px] !text-[var(--bp-text-primary)] !tracking-[0.36em] !font-medium">
                    {t('moodboards.premium.eyebrow', null, 'Premium curated archive')}
                  </p>
                </div>
                <span className="font-mono text-[10px] tracking-[0.30em] text-[var(--bp-text-subtle)] uppercase tabular-nums">
                  {premiumCount.toString().padStart(2, '0')}&nbsp;
                  {t('moodboards.premium.completeTemplates', null, 'complete templates')}
                </span>
              </div>
              <p className="bp-caption !text-[13px] !text-[var(--bp-text-muted)] italic mb-3 max-w-[760px] leading-[1.55]"
                 style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
                {t('moodboards.premium.intro', null,
                  'Complete multi-page presentations — covers, atmospheres, material direction, furniture and approval pages, all in one click. Ready for professional moodboards.')}
              </p>
              <div className="h-px bg-[var(--bp-section-divider)] mb-12" />

              {PREMIUM_CATEGORIES.map((cat, catIdx) => {
                const templates = getTemplatesByCategory(cat.key);
                if (templates.length === 0) return null;
                const catNum = String(catIdx + 1).padStart(2, '0');
                return (
                  <div key={cat.key}
                       data-testid={`premium-category-${cat.key}`}
                       className={catIdx > 0 ? 'mt-16' : ''}>
                    {/* Category header */}
                    <div className="flex items-baseline gap-4 mb-2">
                      <span className="font-mono text-[10px] tracking-[0.32em] text-[var(--bp-primary)] uppercase tabular-nums">
                        {catNum}
                      </span>
                      <h3 className="!text-[22px] !text-[var(--bp-text-primary)] font-light tracking-[0.005em]
                                     leading-none"
                          style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
                        {t(`moodboards.premium.category.${cat.key}.title`, null, cat.title_fallback)}
                      </h3>
                      <div className="flex-1 h-px bg-[var(--bp-border)] mt-1 self-center" />
                      <span className="font-mono text-[9px] tracking-[0.28em] text-[var(--bp-text-subtle)] uppercase tabular-nums">
                        {templates.length.toString().padStart(2, '0')}&nbsp;
                        {t('moodboards.premium.completeTemplates.short', null, 'templates')}
                      </span>
                    </div>
                    <p className="bp-caption !text-[12px] !text-[var(--bp-text-muted)] italic ml-[42px] mb-7 leading-[1.55]"
                       style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
                      {t(`moodboards.premium.category.${cat.key}.subtitle`, null, cat.subtitle_fallback)}
                    </p>
                    {/* Cards row — 3-up minimum, auto-fill at larger viewports */}
                    <div className="grid gap-6"
                         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                      {templates.map((tpl) => (
                        <PremiumCard key={tpl.id} tpl={tpl} onPickPremium={onPickPremium} t={t} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* ───────────── SKELETONS & STARTING POINTS ───────────── */}
          <section data-testid="skeletons-section">
            {/* Section header — clearly DIFFERENT from premium */}
            <div className="flex items-baseline justify-between gap-6 mb-3">
              <div className="flex items-center gap-2.5">
                <LayoutGrid size={13} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
                <p className="bp-eyebrow !text-[11px] !text-[var(--bp-text-primary)] !tracking-[0.36em] !font-medium">
                  {t('moodboards.skeleton.section.eyebrow', null, 'Skeletons & starting points')}
                </p>
              </div>
              {!isLoading && skeletons && (
                <span className="font-mono text-[10px] tracking-[0.30em] text-[var(--bp-text-subtle)] uppercase tabular-nums">
                  {skeletons.length.toString().padStart(2, '0')}&nbsp;
                  {t('moodboards.skeleton.singlePages', null, 'single layouts')}
                </span>
              )}
            </div>
            <p className="bp-caption !text-[13px] !text-[var(--bp-text-muted)] italic mb-3 max-w-[760px] leading-[1.55]"
               style={{ fontFamily: 'Playfair Display, var(--bp-font-heading), serif' }}>
              {t('moodboards.skeleton.section.intro', null,
                'Single empty layouts to add as one new page to the current moodboard. Use them when you want to compose your own structure block by block.')}
            </p>
            <div className="h-px bg-[var(--bp-section-divider)] mb-9" />

            {isLoading ? (
              <div className="py-16 flex justify-center">
                <div className="w-5 h-5 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : grouped.length === 0 ? (
              <p className="bp-caption text-[var(--bp-text-muted)] py-12 text-center">—</p>
            ) : (
              <div className="space-y-8">
                {grouped.map(([categoryKey, items]) => {
                  const catLabel = t(categoryKey);
                  const safeCat = catLabel && catLabel !== categoryKey
                    ? catLabel
                    : categoryKey.split('.').pop();
                  return (
                    <div key={categoryKey}>
                      <p className="bp-eyebrow !text-[9.5px] !text-[var(--bp-text-muted)] mb-3.5 !tracking-[0.30em]">
                        {safeCat}
                      </p>
                      {/* Smaller min width than premium → cards visually compact */}
                      <div className="grid gap-3"
                           style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                        {items.map((sk) => (
                          <SkeletonCard key={sk.id} sk={sk} onPick={onPick} t={t} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SkeletonPicker;
