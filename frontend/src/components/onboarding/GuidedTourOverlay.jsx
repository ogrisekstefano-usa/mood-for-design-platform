/**
 * GuidedTourOverlay — cinematic spotlight.
 *
 * Renders to document.body via createPortal to escape CSS transforms.
 * NOT a tooltip. A soft contemplative spotlight.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GuidedTourStepCard from './GuidedTourStepCard';

const PAD = 12;       // halo padding around the target rect
const VIEW_PAD = 24;  // viewport edge padding for card placement
const CARD_W = 360;   // approx card width
const CARD_H_EST = 230;

function localized(obj, locale) {
  if (!obj) return '';
  return obj[locale] || obj.it || obj.en || Object.values(obj)[0] || '';
}

function useRect(selector) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    let raf = 0;
    const update = () => {
      if (!selector) { setRect(null); return; }
      const el = document.querySelector(selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({
        x: r.x, y: r.y, w: r.width, h: r.height,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2,
      });
    };
    update();
    const onScrollResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    const iv = setInterval(update, 800); // catch async-rendered targets
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
      clearInterval(iv);
    };
  }, [selector]);
  return rect;
}

function computeCardPosition(rect, placement) {
  if (!rect) return { centered: true };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const half = CARD_W / 2;
  // try preferred placement
  let pos = placement || 'bottom';
  if (pos === 'auto') {
    pos = (rect.y + rect.h + CARD_H_EST + VIEW_PAD < vh) ? 'bottom' : 'top';
  }
  let left, top;
  if (pos === 'bottom') {
    top = rect.y + rect.h + 18;
    left = rect.cx - half;
  } else if (pos === 'top') {
    top = rect.y - CARD_H_EST - 18;
    left = rect.cx - half;
  } else if (pos === 'right') {
    top = rect.cy - CARD_H_EST / 2;
    left = rect.x + rect.w + 18;
  } else if (pos === 'left') {
    top = rect.cy - CARD_H_EST / 2;
    left = rect.x - CARD_W - 18;
  } else {
    return { centered: true };
  }
  // clamp to viewport
  left = Math.max(VIEW_PAD, Math.min(left, vw - CARD_W - VIEW_PAD));
  top = Math.max(VIEW_PAD, Math.min(top, vh - CARD_H_EST - VIEW_PAD));
  return { centered: false, top, left };
}

const GuidedTourOverlay = ({
  locale, steps, currentStep, onAdvance, onBack, onSkip, onFinish,
}) => {
  const step = useMemo(
    () => steps.find((s) => s.order === currentStep) || steps[currentStep - 1],
    [steps, currentStep],
  );
  const rect = useRect(step?.target_selector || null);
  const pos = useMemo(() => computeCardPosition(rect, step?.placement || 'auto'), [rect, step?.placement]);

  // Smooth scroll the target into view when entering a step
  useEffect(() => {
    if (!step?.target_selector) return;
    const el = document.querySelector(step.target_selector);
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
    }
  }, [step?.target_selector, step?.order]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (step?.order === steps.length) onFinish(); else onAdvance();
      } else if (e.key === 'ArrowLeft') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step?.order, steps.length, onAdvance, onBack, onSkip, onFinish]);

  if (!step) return null;

  const total = steps.length;
  const isLast = step.order === total;
  const centered = pos.centered || !rect;

  const haloStyle = !centered && rect ? {
    top: rect.y - PAD,
    left: rect.x - PAD,
    width: rect.w + PAD * 2,
    height: rect.h + PAD * 2,
  } : null;

  return createPortal(
    <div
      className="gt-overlay"
      data-testid="guided-tour-overlay"
      data-step-order={step.order}
      data-step-total={total}
    >
      {/* dim layer */}
      <div className="gt-overlay__dim" />
      {/* halo / spotlight cutout */}
      {!centered && rect && (
        <div
          className="gt-overlay__halo"
          style={haloStyle}
          data-testid="guided-tour-halo"
        />
      )}
      {/* step card */}
      <div
        className={`gt-overlay__card-wrap ${centered ? 'gt-overlay__card-wrap--center' : ''}`}
        style={!centered ? { top: pos.top, left: pos.left } : undefined}
      >
        <GuidedTourStepCard
          eyebrow={localized(step.eyebrow, locale)}
          title={localized(step.title, locale)}
          body={localized(step.body, locale)}
          stepOrder={step.order}
          total={total}
          isLast={isLast}
          onAdvance={onAdvance}
          onBack={onBack}
          onSkip={onSkip}
          onFinish={onFinish}
        />
      </div>
    </div>,
    document.body,
  );
};

export default GuidedTourOverlay;
