/**
 * ImageQuickAdjust — first-pass preview modal that opens RIGHT AFTER a
 * successful image upload. Lets the designer commit a few decisions before
 * the asset lands on the canvas:
 *
 *  - Fit mode  : cover · contain · fill
 *  - Focal point : click anywhere on the preview to mark the focal point
 *                  (stored as "x% y%" in style.focal_point)
 *  - Adjustments: brightness · contrast · saturation (the rest stays in the
 *                 sidebar for fine-tuning later, per the user request)
 *
 * All controls also remain available in the right-sidebar Block Inspector,
 * so this dialog is a SHORTCUT, never a lock-in.
 *
 * Output: an object { fit_mode, focal_point, adjustments } merged into the
 * block.style by the parent (MoodboardEditor BlockInspector → ImageUploader).
 */
import React, { useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';

const DEFAULT_ADJ = { brightness: 1, contrast: 1, saturation: 1 };

const ImageQuickAdjust = ({ src, defaults = {}, onConfirm, onSkip, t }) => {
  const [fit, setFit] = useState(defaults.fit_mode || 'cover');
  const [focal, setFocal] = useState(defaults.focal_point || 'center');
  const [adj, setAdj] = useState({ ...DEFAULT_ADJ, ...(defaults.adjustments || {}) });
  const previewRef = useRef(null);

  const filterCss = [
    adj.brightness !== 1 ? `brightness(${adj.brightness})` : null,
    adj.contrast   !== 1 ? `contrast(${adj.contrast})`     : null,
    adj.saturation !== 1 ? `saturate(${adj.saturation})`   : null,
  ].filter(Boolean).join(' ') || 'none';

  const handleClick = (e) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setFocal(`${x}% ${y}%`);
  };

  // Resolve focal_point string → object-position CSS value for the preview
  const objectPosition = focal === 'center' ? 'center'
    : focal === 'top' ? 'center top'
    : focal === 'bottom' ? 'center bottom'
    : focal === 'left' ? 'left center'
    : focal === 'right' ? 'right center'
    : focal;

  const showsCustomFocal = !!focal && /\d+%\s+\d+%/.test(focal);

  const reset = () => {
    setFit('cover');
    setFocal('center');
    setAdj({ ...DEFAULT_ADJ });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--bp-overlay)] backdrop-blur-md flex items-center justify-center p-6"
         data-testid="image-quick-adjust"
         onClick={onSkip}>
      <div onClick={(e) => e.stopPropagation()}
           className="bp-glass relative w-full max-w-[920px] max-h-[90vh] flex flex-col
                      rounded-[var(--bp-radius-md)] overflow-hidden">
        {/* Header */}
        <header className="flex items-start justify-between gap-6 px-7 pt-6 pb-4 border-b border-[var(--bp-border)]">
          <div>
            <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">
              {t('moodboards.editor.quickAdjust.eyebrow')}
            </p>
            <h2 className="bp-h2 !text-[22px] text-[var(--bp-text-primary)] mt-1 font-light">
              {t('moodboards.editor.quickAdjust.title')}
            </h2>
            <p className="bp-caption !text-[11px] !text-[var(--bp-text-subtle)] mt-1 max-w-[460px]">
              {t('moodboards.editor.quickAdjust.subtitle')}
            </p>
          </div>
          <button onClick={onSkip} data-testid="quick-adjust-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] p-1">
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body: preview + controls split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6 px-7 py-6 overflow-y-auto">
          {/* Preview */}
          <div>
            <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-2">
              {t('moodboards.editor.quickAdjust.preview')}
            </p>
            <div ref={previewRef}
                 onClick={handleClick}
                 data-testid="quick-adjust-preview"
                 className="relative w-full aspect-[4/3] bg-black rounded-[var(--bp-radius-sm)] overflow-hidden cursor-crosshair">
              <img src={src} alt=""
                   className="w-full h-full"
                   style={{
                     objectFit: fit,
                     objectPosition,
                     filter: filterCss,
                   }} />
              {showsCustomFocal && (
                <div className="absolute pointer-events-none"
                     style={{
                       left: `calc(${focal.split(' ')[0]} - 8px)`,
                       top:  `calc(${focal.split(' ')[1]} - 8px)`,
                     }}>
                  <div className="w-4 h-4 rounded-full ring-2 ring-white shadow-lg" />
                </div>
              )}
            </div>
            <p className="bp-caption !text-[10px] !text-[var(--bp-text-subtle)] mt-2">
              {t('moodboards.editor.quickAdjust.focalHint')}
              {showsCustomFocal && (
                <span className="ml-2 font-mono text-[var(--bp-text-secondary)]">{focal}</span>
              )}
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            {/* Fit mode */}
            <div>
              <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-2">
                {t('moodboards.editor.quickAdjust.fit')}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {['cover', 'contain', 'fill'].map((m) => (
                  <button key={m} type="button"
                          data-testid={`quick-adjust-fit-${m}`}
                          onClick={() => setFit(m)}
                          className={`py-1.5 bp-caption !text-[11px] rounded-[var(--bp-radius-xs)] border transition-colors
                            ${fit === m
                              ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/10 text-[var(--bp-text-primary)]'
                              : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                    {t(`moodboards.field.fit.${m}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Focal presets */}
            <div>
              <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-2">
                {t('moodboards.editor.quickAdjust.focal')}
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {['top', 'left', 'center', 'right', 'bottom'].map((p) => (
                  <button key={p} type="button"
                          data-testid={`quick-adjust-focal-${p}`}
                          onClick={() => setFocal(p)}
                          className={`py-1.5 bp-caption !text-[10px] rounded-[var(--bp-radius-xs)] border transition-colors
                            ${focal === p
                              ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/10 text-[var(--bp-text-primary)]'
                              : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
                    {t(`moodboards.field.focal.${p}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Adjustments */}
            <div className="pt-4 border-t border-[var(--bp-border)]">
              <p className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)] mb-3">
                {t('moodboards.editor.quickAdjust.adjust')}
              </p>
              <AdjSlider label={t('moodboards.field.brightness')} value={adj.brightness}
                         min={0.5} max={1.5} step={0.05}
                         onChange={(v) => setAdj((a) => ({ ...a, brightness: v }))}
                         testid="quick-adjust-brightness" />
              <AdjSlider label={t('moodboards.field.contrast')} value={adj.contrast}
                         min={0.5} max={1.5} step={0.05}
                         onChange={(v) => setAdj((a) => ({ ...a, contrast: v }))}
                         testid="quick-adjust-contrast" />
              <AdjSlider label={t('moodboards.field.saturation')} value={adj.saturation}
                         min={0} max={1.6} step={0.05}
                         onChange={(v) => setAdj((a) => ({ ...a, saturation: v }))}
                         testid="quick-adjust-saturation" />
              <button type="button" onClick={reset} data-testid="quick-adjust-reset"
                      className="flex items-center gap-1 mt-2 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] bp-caption !text-[10px]">
                <RotateCcw size={10} strokeWidth={1.5} />
                {t('moodboards.editor.quickAdjust.reset')}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 px-7 py-4 border-t border-[var(--bp-border)]">
          <button type="button" onClick={onSkip} data-testid="quick-adjust-skip"
                  className="bp-btn bp-btn-ghost !text-[11px]">
            {t('moodboards.editor.quickAdjust.skip')}
          </button>
          <button type="button"
                  onClick={() => onConfirm({ fit_mode: fit, focal_point: focal, adjustments: adj })}
                  data-testid="quick-adjust-confirm"
                  className="bp-btn bp-btn-primary !text-[11px]">
            {t('moodboards.editor.quickAdjust.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
};

const AdjSlider = ({ label, value, min, max, step, onChange, testid }) => (
  <label className="block mb-2.5">
    <div className="flex items-center justify-between mb-1">
      <span className="bp-eyebrow !text-[10px] !text-[var(--bp-text-muted)]">{label}</span>
      <span className="bp-caption !text-[10px] text-[var(--bp-text-secondary)] font-mono tabular-nums">
        {Number(value).toFixed(2)}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
           onChange={(e) => onChange(parseFloat(e.target.value))}
           data-testid={testid}
           className="w-full accent-[var(--bp-primary)]" />
  </label>
);

export default ImageQuickAdjust;
