/**
 * AtelierNextStep · ITER162
 *
 * Card "Prossimo passo" — testo editoriale + immagine accessoria.
 */
import React from 'react';

const AtelierNextStep = ({ nextStep }) => {
  if (!nextStep) return null;
  return (
    <section className="atelier-next" data-testid="atelier-next-step">
      <div className="atelier-next__body">
        <p className="atelier-next__title" data-testid="atelier-next-title">
          {nextStep.title}
        </p>
        <p className="atelier-next__lede" data-testid="atelier-next-lede">
          {nextStep.body}
        </p>
        {nextStep.hint && (
          <p className="atelier-next__hint" data-testid="atelier-next-hint">
            <em>{nextStep.hint}</em>
          </p>
        )}
      </div>
      {nextStep.image && (
        <div className="atelier-next__image">
          <img src={nextStep.image} alt="" loading="lazy" decoding="async" />
        </div>
      )}
    </section>
  );
};

export default AtelierNextStep;
