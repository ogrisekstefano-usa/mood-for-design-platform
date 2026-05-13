/**
 * PresentationMode V2™ — Blueprint Presentation Engine.
 *
 * Cinematic, fullscreen, page-aware, transition-driven. Designed to render
 * the SAME multi-page data model as the editor (zero parallel rendering).
 *
 * Architecture:
 *  - Receives `mb` (moodboard), `pages`, `blocks`, `transitions` registry,
 *    `clientSafe` flag, `onExit` callback.
 *  - Filters pages by visibility rules (clientSafe → drop `hidden_from_client`,
 *    designer-preview → drop `hidden_in_presentation`).
 *  - Letterboxing: each page scales to fit the viewport preserving its
 *    aspect ratio. NEVER crops, NEVER mutates stored coordinates.
 *  - Transition: every page advance applies the destination page's
 *    `transition_in` from the registry (default `fade`) with GPU-only
 *    properties (opacity / transform / filter).
 *  - Adjacent-page preloader: mounts current ± 1 so transitions never flash.
 *  - Keyboard: → ← space (advance) · Esc (exit) · Home/End (jump)
 *  - Auto-hide overlays after 2.5s idle. Mouse move / key reveals them again.
 *  - Editor chrome: 100% hidden — no inspector, sidebars, drag handles.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { resolveBlock } from './BlockRegistry';

const DEFAULT_TRANSITION = {
  id: 'fade',
  duration_ms: 700,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  css: { from: { opacity: 0 }, to: { opacity: 1 } },
};

// Render a single moodboard page as a scaled-to-viewport canvas, with NO
// editor chrome. Block-level `hidden_from_client` is honored when clientSafe.
const PageStage = ({ page, blocks, viewportSize, clientSafe, blockT }) => {
  if (!page || !viewportSize) return null;
  const pw = page.width || 1400;
  const ph = page.height || 2400;
  // Letterbox: scale so the entire page is visible within the viewport, with
  // a comfortable 4% gutter so nothing kisses the edge.
  const gutter = 0.96;
  const sx = (viewportSize.w * gutter) / pw;
  const sy = (viewportSize.h * gutter) / ph;
  const scale = Math.min(sx, sy);
  const renderBlocks = (blocks || []).filter((b) => {
    if (b.hidden) return false;
    if (clientSafe && b.metadata?.hidden_from_client) return false;
    return true;
  });
  // Order: ascending z_index (bottom first), tie-break by created_at — same
  // comparator used in the editor canvas, so visual stacking matches exactly.
  const ordered = [...renderBlocks].sort((a, b) => {
    const dz = (a.z_index || 0) - (b.z_index || 0);
    if (dz !== 0) return dz;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });
  return (
    <div className="relative"
         style={{
           width: pw * scale,
           height: ph * scale,
         }}
         data-testid={`presentation-page-${page.id}`}>
      <div className="absolute inset-0 bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                      rounded-[var(--bp-radius-md)] overflow-hidden">
        <div className="absolute"
             style={{
               left: 0, top: 0,
               width: pw, height: ph,
               transform: `scale(${scale})`,
               transformOrigin: 'top left',
             }}>
          {ordered.map((b) => {
            const Component = resolveBlock(b.type);
            if (!Component) return null;
            return (
              <div key={b.id}
                   className="absolute"
                   style={{
                     left: b.x, top: b.y, width: b.width, height: b.height,
                     zIndex: b.z_index || 0,
                     opacity: (b.opacity !== undefined ? b.opacity : 1),
                     transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
                   }}>
                <Component block={b} readOnly t={blockT || ((k) => k)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Inline-style transition applicator — animates from `css.from` to `css.to`
// by toggling a class on next frame.
const useEnterAnimation = (transition) => {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(false);
    const id = requestAnimationFrame(() => {
      // double-rAF to ensure the `from` frame has been committed
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [transition]);
  const t = transition || DEFAULT_TRANSITION;
  const easing = t.easing || DEFAULT_TRANSITION.easing;
  const d = t.duration_ms || DEFAULT_TRANSITION.duration_ms;
  const style = {
    ...((entered ? t.css?.to : t.css?.from) || {}),
    transition: `opacity ${d}ms ${easing}, transform ${d}ms ${easing}, filter ${d}ms ${easing}`,
    willChange: 'opacity, transform, filter',
  };
  return style;
};

// Wraps PageStage with the active transition style.
const TransitionWrapper = ({ transitionKey, transition, children }) => {
  const style = useEnterAnimation(`${transitionKey}|${transition?.id || 'fade'}`);
  return <div style={style} className="flex items-center justify-center w-full h-full">{children}</div>;
};

const PresentationMode = ({
  mb,
  pages,
  blocks,
  transitions = [],
  clientSafe = false,
  startIndex = 0,
  showExit = true,
  onExit,
  t,
}) => {
  const navigate = useNavigate();

  // Filter pages per mode. Designers see all except their own `hidden_in_presentation`;
  // clients additionally drop `settings.hidden_from_client`.
  const visiblePages = useMemo(() => (pages || []).filter((p) => {
    if (p.hidden_in_presentation) return false;
    if (clientSafe && p.settings?.hidden_from_client) return false;
    return true;
  }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [pages, clientSafe]);

  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, visiblePages.length - 1)));
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const idleTimer = useRef(null);

  // Resolve transition from page settings → registry → safe default
  const txMap = useMemo(() => {
    const m = new Map();
    (transitions || []).forEach((tx) => m.set(tx.id, tx));
    return m;
  }, [transitions]);

  const pageTransition = useCallback((page) => {
    const id = page?.settings?.transition_in || 'fade';
    return txMap.get(id) || DEFAULT_TRANSITION;
  }, [txMap]);

  // Auto-hide overlays after idle
  const bumpIdle = useCallback(() => {
    setOverlaysVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setOverlaysVisible(false), 2800);
  }, []);
  useEffect(() => {
    bumpIdle();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [bumpIdle]);

  // Keyboard navigation
  const advance = useCallback((dir) => {
    setIndex((i) => {
      const next = Math.max(0, Math.min(visiblePages.length - 1, i + dir));
      return next;
    });
    bumpIdle();
  }, [visiblePages.length, bumpIdle]);

  const handleExit = useCallback(() => {
    if (onExit) onExit();
    else navigate(-1);
  }, [onExit, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && showExit) { handleExit(); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
      if (e.key === 'Home') { e.preventDefault(); setIndex(0); bumpIdle(); }
      if (e.key === 'End') { e.preventDefault(); setIndex(Math.max(0, visiblePages.length - 1)); bumpIdle(); }
      if (e.key.toLowerCase() === 'c') { setChaptersOpen((v) => !v); bumpIdle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, handleExit, visiblePages.length, bumpIdle, showExit]);

  // Viewport size — drives letterboxing
  const stageRef = useRef(null);
  const [viewportSize, setViewportSize] = useState(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const compute = () => {
      const r = el.getBoundingClientRect();
      setViewportSize({ w: r.width, h: r.height });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Group blocks by page_id (legacy elements without page_id fall on first page)
  const firstPageId = visiblePages[0]?.id;
  const blocksByPage = useMemo(() => {
    const m = {};
    (blocks || []).forEach((b) => {
      const pid = b.page_id || firstPageId;
      if (!pid) return;
      (m[pid] = m[pid] || []).push(b);
    });
    return m;
  }, [blocks, firstPageId]);

  if (!visiblePages.length) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white/60"
           data-testid="presentation-mode-empty">
        <p>{t ? t('moodboards.presentation.empty') : '—'}</p>
      </div>
    );
  }

  const currentPage = visiblePages[index];
  const currentBlocks = blocksByPage[currentPage.id] || [];
  const tx = pageTransition(currentPage);

  // Compute chapter list — only pages that explicitly declare a chapter_label
  const chapters = visiblePages
    .map((p, i) => ({ idx: i, page: p, label: p.settings?.chapter_label }))
    .filter((c) => !!c.label);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col"
         data-testid="presentation-mode"
         onMouseMove={bumpIdle}
         onClick={bumpIdle}>
      {/* Stage */}
      <div ref={stageRef} className="flex-1 relative overflow-hidden">
        {/* Adjacent preloader — mount current ±1 OFF-screen so transitions
            don't flash unloaded content. */}
        {[index - 1, index + 1].map((i) => {
          if (i < 0 || i >= visiblePages.length) return null;
          const p = visiblePages[i];
          return (
            <div key={p.id} aria-hidden="true"
                 style={{ position: 'absolute', left: '-99999px', top: 0 }}>
              <PageStage page={p} blocks={blocksByPage[p.id] || []}
                         viewportSize={viewportSize} clientSafe={clientSafe} blockT={t} />
            </div>
          );
        })}
        {viewportSize && (
          <TransitionWrapper transitionKey={currentPage.id} transition={tx}>
            <PageStage page={currentPage} blocks={currentBlocks}
                       viewportSize={viewportSize} clientSafe={clientSafe} blockT={t} />
          </TransitionWrapper>
        )}
      </div>

      {/* Top overlay — minimal, fades on idle */}
      <header className={`absolute top-0 left-0 right-0 px-8 pt-6 flex items-start justify-between
                          transition-opacity duration-500 pointer-events-none
                          ${overlaysVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="pointer-events-auto">
          {currentPage.settings?.chapter_label && (
            <p className="bp-eyebrow !text-[10px] !text-white/45">
              {currentPage.settings.chapter_label}
            </p>
          )}
          <h1 className="bp-h3 !text-white/85 !font-light mt-1 max-w-[60vw] truncate">
            {currentPage.title || mb?.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {chapters.length > 0 && (
            <button onClick={() => setChaptersOpen((v) => !v)}
                    data-testid="presentation-chapters-btn"
                    className="text-white/55 hover:text-white/90 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08]">
              <BookOpen size={12} strokeWidth={1.5} />
              <span className="bp-caption !text-[10px]">
                {t ? t('moodboards.presentation.chapters') : 'Chapters'}
              </span>
            </button>
          )}
          <button onClick={handleExit} data-testid="presentation-exit-btn"
                  className={`text-white/55 hover:text-white/90 transition-colors p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] ${showExit ? '' : 'hidden'}`}>
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Bottom overlay — page counter + arrows + thin progress line */}
      <footer className={`absolute bottom-0 left-0 right-0 transition-opacity duration-500
                          ${overlaysVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-[2px] bg-white/8 relative">
          <div className="absolute left-0 top-0 h-full bg-white/55 transition-all duration-500"
               style={{ width: `${((index + 1) / visiblePages.length) * 100}%` }}
               data-testid="presentation-progress" />
        </div>
        <div className="flex items-center justify-between px-8 py-5">
          <button onClick={() => advance(-1)} disabled={index === 0}
                  data-testid="presentation-prev"
                  className="text-white/55 hover:text-white/90 disabled:opacity-25 transition-colors p-2 rounded-full">
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <span className="bp-caption !text-[11px] !text-white/55 font-mono tabular-nums">
            {index + 1} / {visiblePages.length}
          </span>
          <button onClick={() => advance(1)} disabled={index >= visiblePages.length - 1}
                  data-testid="presentation-next"
                  className="text-white/55 hover:text-white/90 disabled:opacity-25 transition-colors p-2 rounded-full">
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      </footer>

      {/* Chapter navigation overlay */}
      {chaptersOpen && chapters.length > 0 && (
        <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-md flex items-center justify-center"
             data-testid="presentation-chapters-panel"
             onClick={() => setChaptersOpen(false)}>
          <div className="max-w-md w-full px-8" onClick={(e) => e.stopPropagation()}>
            <p className="bp-eyebrow !text-[10px] !text-white/40 mb-4">
              {t ? t('moodboards.presentation.chapters') : 'Chapters'}
            </p>
            <ul className="space-y-1">
              {chapters.map((c) => (
                <li key={c.page.id}>
                  <button onClick={() => { setIndex(c.idx); setChaptersOpen(false); bumpIdle(); }}
                          data-testid={`chapter-jump-${c.page.id}`}
                          className={`w-full text-left px-4 py-3 rounded-[var(--bp-radius-sm)] transition-colors
                                      ${c.idx === index
                                        ? 'bg-white/12 text-white'
                                        : 'text-white/55 hover:bg-white/[0.06] hover:text-white/90'}`}>
                    <span className="bp-caption !text-[10px] !text-white/35 mr-3 font-mono tabular-nums">
                      {String(c.idx + 1).padStart(2, '0')}
                    </span>
                    <span className="bp-body !text-[14px] !font-light">{c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresentationMode;
