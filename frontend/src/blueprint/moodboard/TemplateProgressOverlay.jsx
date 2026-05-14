/**
 * TemplateProgressOverlay — cinematic overlay shown while a multi-page
 * premium template is being applied.
 *
 * The overlay is intentionally theatrical: dark glass, a slow editorial
 * line, page-counter tabular-nums and a chapter-aware micro-copy that
 * changes with the progress stage. It transforms a slow API loop into
 * the feeling of "watching a presentation come alive".
 *
 * Renders ONLY when `state.active` is true. The parent owns the state
 * (so it can drive progress as the apply loop iterates).
 */
import React from 'react';
import { Sparkles } from 'lucide-react';

// Editorial chapter copy — driven by progress ratio (0..1).
// Pure functions: pure-render, no side effects.
const stageCopy = (i, total) => {
  if (total <= 1) return { title: 'Preparing your structure…', sub: 'A moment.' };
  const ratio = (i + 1) / total;
  if (ratio <= 0.18) return {
    title: 'Creating editorial structure…',
    sub: 'Laying the cover and opening voice.',
  };
  if (ratio <= 0.42) return {
    title: 'Building mood narrative…',
    sub: 'Composing the atmosphere of the project.',
  };
  if (ratio <= 0.72) return {
    title: 'Composing material pages…',
    sub: 'Stone, wood, textile and palette direction.',
  };
  if (ratio < 1) return {
    title: 'Finalizing presentation…',
    sub: 'Furniture, gallery and the closing chapter.',
  };
  return {
    title: 'Presentation ready.',
    sub: 'Your editorial moodboard is composed.',
  };
};

// Page-type tone palette — mirrored from PagesFilmstrip / SkeletonPicker.
const PAGE_TONE = {
  cover: '#E0A458', blank: '#6F6A65', mood: '#8FB3A8',
  material_board: '#C9AE8C', product_grid: '#A6A3CC', palette: '#D6B79A',
  gallery: '#9B917F', split_story: '#B59A78', quote: '#7A8C9B',
  technical_board: '#869099', floorplan: '#7A6B58',
  proposal_summary: '#A8B5B3', approval: '#15AC8B',
};

const TemplateProgressOverlay = ({ state }) => {
  if (!state || !state.active) return null;
  const { templateName, total = 1, current = 0, pages = [] } = state;
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(current, safeTotal);
  const pct = Math.round((safeCurrent / safeTotal) * 100);
  const { title, sub } = stageCopy(Math.max(0, safeCurrent - 1), safeTotal);

  return (
    <div
      data-testid="template-progress-overlay"
      className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
      style={{ animation: 'fadeIn 240ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
      {/* Dark glass backdrop */}
      <div className="absolute inset-0 pointer-events-auto"
           style={{
             background: 'rgba(8, 7, 6, 0.78)',
             backdropFilter: 'blur(24px) saturate(120%)',
             WebkitBackdropFilter: 'blur(24px) saturate(120%)',
           }} />

      {/* Editorial content card */}
      <div className="relative z-10 w-[min(640px,90vw)] px-10 py-14 text-center pointer-events-auto">
        {/* Eyebrow */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles size={11} strokeWidth={1.5} style={{ color: 'var(--bp-primary)' }} />
          <span className="font-mono text-[10px] tracking-[0.42em] uppercase"
                style={{ color: 'var(--bp-primary)' }}>
            Premium template · applying
          </span>
        </div>

        {/* Template name — small italic over the big title */}
        {templateName && (
          <p className="text-[12px] tracking-[0.20em] uppercase opacity-50 mb-5"
             style={{ color: '#E6DBC6', fontFamily: 'Inter, sans-serif' }}>
            {templateName}
          </p>
        )}

        {/* Big chapter title — Playfair italic, key-framed for soft entry */}
        <h2 key={title}
            className="text-[32px] leading-tight italic font-light mb-3"
            style={{
              color: '#F8F4ED',
              fontFamily: 'Playfair Display, serif',
              animation: 'softRise 420ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}>
          {title}
        </h2>

        {/* Sub */}
        <p className="text-[14px] italic opacity-65 mb-10 leading-[1.6]"
           style={{ color: '#D7CFC0', fontFamily: 'Playfair Display, serif' }}>
          {sub}
        </p>

        {/* Progress bar — thin teal line */}
        <div className="relative h-[2px] w-full rounded-full overflow-hidden mb-3"
             style={{ background: 'rgba(245, 242, 236, 0.10)' }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-[600ms]"
               data-testid="template-progress-bar"
               style={{
                 width: `${pct}%`,
                 background: 'linear-gradient(90deg, rgba(15,162,132,0.85) 0%, rgba(15,162,132,1) 100%)',
                 boxShadow: '0 0 12px rgba(15, 162, 132, 0.5)',
               }} />
        </div>

        {/* Counter row */}
        <div className="flex items-center justify-between text-[10px] tracking-[0.32em] uppercase mb-9"
             style={{ color: 'rgba(245, 242, 236, 0.55)' }}>
          <span className="tabular-nums font-mono">
            Page {String(safeCurrent).padStart(2, '0')} / {String(safeTotal).padStart(2, '0')}
          </span>
          <span className="tabular-nums font-mono">{pct}%</span>
        </div>

        {/* Mini-filmstrip — chips appear progressively as pages are built */}
        {pages.length > 0 && (
          <div className="flex items-center justify-center gap-1.5"
               data-testid="template-progress-strip">
            {pages.map((p, i) => {
              const tone = PAGE_TONE[p.page_type] || PAGE_TONE.blank;
              const ready = i < safeCurrent;
              return (
                <div key={i} className="flex flex-col items-center gap-1"
                     style={{ width: 26 }}>
                  <span className="block w-full h-[34px] rounded-[2px] transition-all duration-[400ms]"
                        style={{
                          background: ready
                            ? `linear-gradient(135deg, ${tone}E0 0%, ${tone}A0 100%)`
                            : 'rgba(245, 242, 236, 0.06)',
                          boxShadow: ready
                            ? `0 0 0 1px ${tone}66, 0 4px 12px ${tone}44`
                            : '0 0 0 1px rgba(245,242,236,0.10)',
                          transform: i === safeCurrent - 1 ? 'translateY(-2px)' : 'translateY(0)',
                        }} />
                  <span className="font-mono text-[8px] tracking-[0.20em] tabular-nums"
                        style={{ color: ready ? tone : 'rgba(245,242,236,0.30)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyframes scoped to this overlay — declared inline so we don't
          touch the global index.css. */}
      <style>{`
        @keyframes softRise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default TemplateProgressOverlay;
