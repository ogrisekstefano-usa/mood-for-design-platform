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
import { X, LayoutGrid } from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';

// ── Mini wireframe preview ───────────────────────────────────────────────────
// Renders the skeleton blocks as solid tinted rectangles inside an SVG whose
// viewBox matches the page's reference frame. Adapts perfectly to any
// container size, no JS math needed.
const SkeletonPreview = ({ skeleton }) => {
  const w = skeleton.width || 1400;
  const h = skeleton.height || 1866;
  const blocks = skeleton.blocks_preview || [];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet"
         className="block w-full h-full" role="img" aria-hidden="true">
      <rect x="0" y="0" width={w} height={h} fill="var(--bp-bg)" />
      {blocks.map((b, idx) => {
        const tint = b.type === 'image'    ? 'rgba(255,255,255,0.14)'
                   : b.type === 'palette'  ? 'rgba(255,255,255,0.08)'
                   : b.type === 'material' ? 'rgba(214,197,168,0.20)'
                   : b.type === 'product'  ? 'rgba(255,255,255,0.10)'
                   : 'rgba(255,255,255,0.06)';
        return (
          <rect key={idx}
                x={b.x} y={b.y} width={b.width} height={b.height}
                fill={tint} stroke="rgba(255,255,255,0.08)" strokeWidth="2" rx="6" />
        );
      })}
    </svg>
  );
};

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
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.32) 100%)' }} />
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

const SkeletonPicker = ({ skeletons, onPick, onClose }) => {
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
