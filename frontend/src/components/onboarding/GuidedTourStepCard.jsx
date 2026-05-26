/**
 * GuidedTourStepCard — editorial card body
 * Serif title, eyebrow cyan, body 17px, soft progression line.
 */
import React from 'react';

const GuidedTourStepCard = ({
  eyebrow, title, body, stepOrder, total, isLast,
  onAdvance, onBack, onSkip, onFinish,
}) => {
  return (
    <article className="gt-card" data-testid={`guided-tour-card-${stepOrder}`}>
      <div className="gt-card__rail" aria-hidden />
      <div className="gt-card__progress" data-testid="guided-tour-progress">
        <span className="gt-card__progress-text">
          <em>{String(stepOrder).padStart(2, '0')}</em>
          <span className="gt-card__progress-divider">·</span>
          <span className="gt-card__progress-total">{String(total).padStart(2, '0')}</span>
        </span>
        <span className="gt-card__progress-bar" aria-hidden>
          <span
            className="gt-card__progress-fill"
            style={{ width: `${(stepOrder / total) * 100}%` }}
          />
        </span>
      </div>

      {eyebrow && (
        <p className="gt-card__eyebrow" data-testid="guided-tour-eyebrow">
          {eyebrow}
        </p>
      )}
      <h2 className="gt-card__title" data-testid="guided-tour-title">
        {title}
      </h2>
      <p className="gt-card__body" data-testid="guided-tour-body">
        {body}
      </p>

      <div className="gt-card__actions">
        <button
          type="button"
          className="gt-card__btn gt-card__btn--ghost"
          onClick={onSkip}
          data-testid="guided-tour-skip"
        >
          Salta il tour
        </button>
        <div className="gt-card__actions-right">
          {stepOrder > 1 && (
            <button
              type="button"
              className="gt-card__btn gt-card__btn--quiet"
              onClick={onBack}
              data-testid="guided-tour-back"
            >
              Indietro
            </button>
          )}
          {!isLast ? (
            <button
              type="button"
              className="gt-card__btn gt-card__btn--primary"
              onClick={onAdvance}
              data-testid="guided-tour-next"
            >
              Avanti
            </button>
          ) : (
            <button
              type="button"
              className="gt-card__btn gt-card__btn--primary"
              onClick={onFinish}
              data-testid="guided-tour-finish"
            >
              Inizia il tuo atelier
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default GuidedTourStepCard;
