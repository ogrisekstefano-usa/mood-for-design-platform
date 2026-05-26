/**
 * GuidedTourWelcome — first contact, ceremonial.
 *
 * Cinematic full-screen overlay introducing the studio.
 * Two choices: begin the tour, or skip.
 *
 * Semantic note (ITER154 rev): "Atelier" terminology removed —
 * we speak about Studio (workspace), Blueprint (platform),
 * Design Journey (single client path).
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const COPY = {
  it: {
    eyebrow: 'BLUEPRINT OS™ · PRIMA APERTURA',
    title: 'Benvenuto nel tuo studio digitale.',
    lede:
      'Blueprint OS™ è lo spazio dove il tuo studio respira. ' +
      'Non un software da imparare — uno spazio da abitare. ' +
      'Ti accompagno in sette movimenti, con calma.',
    start: 'Inizia il tour',
    skip: 'Esplora da solo',
    footer: 'Potrai riaprire questa introduzione in qualsiasi momento.',
  },
  en: {
    eyebrow: 'BLUEPRINT OS™ · FIRST OPENING',
    title: 'Welcome to your digital studio.',
    lede:
      'Blueprint OS™ is the space where your studio breathes. ' +
      'Not software to learn — a space to inhabit. ' +
      'I will walk you through seven movements, slowly.',
    start: 'Begin the tour',
    skip: 'Explore on my own',
    footer: 'You can reopen this introduction at any time.',
  },
};

const GuidedTourWelcome = ({ locale = 'it', totalSteps = 7, onStart, onSkip }) => {
  const t = COPY[locale] || COPY.it;

  // Lock body scroll while welcome is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div className="gt-welcome" data-testid="guided-tour-welcome" role="dialog" aria-modal="true">
      <div className="gt-welcome__veil" />
      <div className="gt-welcome__shimmer" aria-hidden />
      <div className="gt-welcome__panel">
        <p className="gt-welcome__eyebrow">{t.eyebrow}</p>
        <h1 className="gt-welcome__title">{t.title}</h1>
        <p className="gt-welcome__lede">{t.lede}</p>
        <div className="gt-welcome__steps">
          <span className="gt-welcome__steps-num">{String(totalSteps).padStart(2, '0')}</span>
          <span className="gt-welcome__steps-label">movimenti</span>
        </div>
        <div className="gt-welcome__actions">
          <button
            type="button"
            className="gt-welcome__btn gt-welcome__btn--primary"
            onClick={onStart}
            data-testid="guided-tour-welcome-start"
          >
            {t.start}
          </button>
          <button
            type="button"
            className="gt-welcome__btn gt-welcome__btn--ghost"
            onClick={onSkip}
            data-testid="guided-tour-welcome-skip"
          >
            {t.skip}
          </button>
        </div>
        <p className="gt-welcome__footer">{t.footer}</p>
      </div>
    </div>,
    document.body,
  );
};

export default GuidedTourWelcome;
