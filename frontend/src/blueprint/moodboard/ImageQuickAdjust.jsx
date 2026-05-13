/**
 * ImageQuickAdjust — "Camera framing tool" modal that opens RIGHT AFTER a
 * successful image upload. Re-architected from a settings form into an
 * editorial cinema framer:
 *
 *  - Oversized preview, full-bleed background blur
 *  - Drag the focal handle anywhere on the preview (no per-click jumps)
 *  - Minimal control rail on the right (fit · focal presets · 3 sliders)
 *  - Reset is a single quiet text link, no admin-style icon button
 *
 *  Output (passed back via onConfirm): { fit_mode, focal_point, adjustments }.
 *  All copy via t(), all colors via theme tokens.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const DEFAULT_ADJ = { brightness: 1, contrast: 1, saturation: 1 };

const ImageQuickAdjust = ({ src, defaults = {}, onConfirm, onSkip, t }) => {
  const [fit, setFit] = useState(defaults.fit_mode || 'cover');
  const [focal, setFocal] = useState(defaults.focal_point || 'center');
  const [adj, setAdj] = useState({ ...DEFAULT_ADJ, ...(defaults.adjustments || {}) });
  const previewRef = useRef(null);
  const draggingRef = useRef(false);

  const filterCss = [
    adj.brightness !== 1 ? `brightness(${adj.brightness})` : null,
    adj.contrast   !== 1 ? `contrast(${adj.contrast})`     : null,
    adj.saturation !== 1 ? `saturate(${adj.saturation})`   : null,
  ].filter(Boolean).join(' ') || 'none';

  // Resolve focal_point string → object-position CSS value for the preview
  const objectPosition = focal === 'center' ? 'center'
    : focal === 'top' ? 'center top'
    : focal === 'bottom' ? 'center bottom'
    : focal === 'left' ? 'left center'
    : focal === 'right' ? 'right center'
    : focal;

  const showsCustomFocal = !!focal && /\d+%\s+\d+%/.test(focal);
  const handleXY = showsCustomFocal
    ? focal.split(' ').map((p) => parseFloat(p))
    : [50, 50];

  const setFocalFromEvent = useCallback((e) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setFocal(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }, []);

  // Pointer-based drag — eliminates the click-jump UX of the previous version.
  // rAF-throttled so dragging the focal across the preview stays buttery
  // even with heavy CSS filters layered on the underlying <img>.
  useEffect(() => {
    let rafId = null;
    let lastEvent = null;
    const apply = () => { rafId = null; if (lastEvent) setFocalFromEvent(lastEvent); };
    const onMove = (e) => {
      if (!draggingRef.current) return;
      lastEvent = e;
      if (rafId === null) rafId = requestAnimationFrame(apply);
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setFocalFromEvent]);

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    setFocalFromEvent(e);
  };

  const reset = () => {
    setFit('cover');
    setFocal('center');
    setAdj({ ...DEFAULT_ADJ });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0"
         data-testid="image-quick-adjust"
         onClick={onSkip}>
      {/* Cinematic blurred backdrop — the uploaded image bleeds behind the
          framer, generating the modal's ambient color. */}
      <div className="absolute inset-0"
           style={{
             backgroundImage: `url(${src})`,
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             filter: 'blur(60px) brightness(0.5) saturate(1.1)',
             transform: 'scale(1.1)',
           }} />
      <div className="absolute inset-0 bg-black/55" />

      <div onClick={(e) => e.stopPropagation()}
           className="relative w-full h-full flex flex-col md:flex-row">
        {/* Preview pane — fills viewport for cinema feel */}
        <div className="flex-1 relative flex items-center justify-center p-6 md:p-10 min-h-0">
          {/* Floating close button */}
          <button onClick={onSkip} data-testid="quick-adjust-close"
                  className="absolute top-5 left-5 z-10 w-8 h-8 rounded-full flex items-center justify-center
                             bg-white/8 hover:bg-white/14 backdrop-blur text-white/80 hover:text-white
                             transition-colors">
            <X size={14} strokeWidth={1.5} />
          </button>

          {/* Eyebrow + Title floating over the cinema */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-[10px] tracking-[0.32em] uppercase text-white/55 font-medium">
              {t('moodboards.editor.quickAdjust.eyebrow')}
            </p>
            <h2 className="font-light text-white/95 text-[15px] mt-1 tracking-tight"
                style={{ fontFamily: 'var(--bp-font-heading)' }}>
              {t('moodboards.editor.quickAdjust.title')}
            </h2>
          </div>

          <div ref={previewRef}
               onPointerDown={handlePointerDown}
               data-testid="quick-adjust-preview"
               className="relative w-full max-w-[1100px] aspect-[16/10] rounded-[2px]
                          overflow-hidden cursor-crosshair select-none
                          shadow-[0_50px_140px_rgba(0,0,0,0.6),inset_0_0_120px_rgba(0,0,0,0.45)]">
            <img src={src} alt=""
                 draggable={false}
                 className="w-full h-full select-none"
                 style={{
                   objectFit: fit,
                   objectPosition,
                   filter: filterCss,
                   transition: draggingRef.current
                     ? 'none'
                     : 'object-position 220ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                 }} />
            {/* Editorial vignette over the preview */}
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.38) 100%)' }} />

            {/* Focal handle — concentric editorial cross */}
            <div className="absolute pointer-events-none"
                 style={{
                   left: `${handleXY[0]}%`,
                   top:  `${handleXY[1]}%`,
                   transform: 'translate(-50%,-50%)',
                   transition: draggingRef.current ? 'none' : 'left 200ms cubic-bezier(0.22, 1, 0.36, 1), top 200ms cubic-bezier(0.22, 1, 0.36, 1)',
                 }}>
              <div className="w-7 h-7 rounded-full border border-white/70 backdrop-blur-[2px]
                              shadow-[0_0_22px_rgba(255,255,255,0.35)] relative">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-3.5 bg-white/70" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[1px] w-3.5 bg-white/70" />
              </div>
            </div>
          </div>
        </div>

        {/* Control rail — minimal, floating panel */}
        <aside className="md:w-[320px] flex-shrink-0 flex flex-col gap-7
                          p-6 md:p-7 md:pr-8 md:pt-20
                          bg-black/30 backdrop-blur-[18px] border-l border-white/8 text-white/85
                          overflow-y-auto">
          {/* Fit */}
          <div>
            <p className="text-[10px] tracking-[0.28em] uppercase text-white/45 mb-2.5">
              {t('moodboards.editor.quickAdjust.fit')}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {['cover', 'contain', 'fill'].map((m) => (
                <button key={m} type="button"
                        data-testid={`quick-adjust-fit-${m}`}
                        onClick={() => setFit(m)}
                        className={`py-2 text-[11px] tracking-wider transition-all rounded-[2px]
                          ${fit === m
                            ? 'bg-white/14 text-white border border-white/35'
                            : 'border border-white/10 text-white/50 hover:text-white/80 hover:border-white/25'}`}>
                  {t(`moodboards.field.fit.${m}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Focal presets */}
          <div>
            <p className="text-[10px] tracking-[0.28em] uppercase text-white/45 mb-2.5">
              {t('moodboards.editor.quickAdjust.focal')}
            </p>
            <div className="grid grid-cols-5 gap-1">
              {['top', 'left', 'center', 'right', 'bottom'].map((p) => (
                <button key={p} type="button"
                        data-testid={`quick-adjust-focal-${p}`}
                        onClick={() => setFocal(p)}
                        className={`py-2 text-[10px] tracking-wider transition-all rounded-[2px]
                          ${focal === p
                            ? 'bg-white/14 text-white border border-white/35'
                            : 'border border-white/10 text-white/50 hover:text-white/80 hover:border-white/25'}`}>
                  {t(`moodboards.field.focal.${p}`)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-2 leading-relaxed">
              {t('moodboards.editor.quickAdjust.focalHint')}
            </p>
          </div>

          {/* Adjustments */}
          <div>
            <p className="text-[10px] tracking-[0.28em] uppercase text-white/45 mb-3">
              {t('moodboards.editor.quickAdjust.adjust')}
            </p>
            <AdjSlider label={t('moodboards.field.brightness')} value={adj.brightness}
                       min={0.5} max={1.5} step={0.02}
                       onChange={(v) => setAdj((a) => ({ ...a, brightness: v }))}
                       testid="quick-adjust-brightness" />
            <AdjSlider label={t('moodboards.field.contrast')} value={adj.contrast}
                       min={0.5} max={1.5} step={0.02}
                       onChange={(v) => setAdj((a) => ({ ...a, contrast: v }))}
                       testid="quick-adjust-contrast" />
            <AdjSlider label={t('moodboards.field.saturation')} value={adj.saturation}
                       min={0} max={1.6} step={0.02}
                       onChange={(v) => setAdj((a) => ({ ...a, saturation: v }))}
                       testid="quick-adjust-saturation" />
          </div>

          {/* Quiet reset link */}
          <button type="button" onClick={reset} data-testid="quick-adjust-reset"
                  className="self-start text-[10px] tracking-[0.22em] uppercase
                             text-white/40 hover:text-white/80 transition-colors">
            {t('moodboards.editor.quickAdjust.reset')}
          </button>

          <div className="flex-1" />

          {/* Footer — single CTA, ghost skip */}
          <div className="flex items-center gap-2 pt-4 border-t border-white/8">
            <button type="button" onClick={onSkip} data-testid="quick-adjust-skip"
                    className="flex-1 py-2.5 text-[11px] tracking-wider
                               border border-white/15 text-white/65 hover:text-white hover:border-white/35
                               transition-colors rounded-[2px]">
              {t('moodboards.editor.quickAdjust.skip')}
            </button>
            <button type="button"
                    onClick={() => onConfirm({ fit_mode: fit, focal_point: focal, adjustments: adj })}
                    data-testid="quick-adjust-confirm"
                    className="flex-1 py-2.5 text-[11px] tracking-wider font-medium
                               bg-[var(--bp-primary)] hover:brightness-110
                               text-black rounded-[2px] transition-all">
              {t('moodboards.editor.quickAdjust.confirm')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

const AdjSlider = ({ label, value, min, max, step, onChange, testid }) => (
  <label className="block mb-3 last:mb-0">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] tracking-[0.22em] uppercase text-white/55">{label}</span>
      <span className="text-[10px] text-white/70 font-mono tabular-nums">
        {Number(value).toFixed(2)}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           data-testid={testid}
           className="w-full accent-[var(--bp-primary)] h-[2px]" />
  </label>
);

export default ImageQuickAdjust;
