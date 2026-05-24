/**
 * MemoryNarrativeCard · a single editorial narrative card.
 *
 * Editorial · NOT a feed item. Composes a quiet block with:
 *   · italic-serif when label (no timestamp · narrative time)
 *   · prose narrative (curator voice, never raw event copy)
 *   · optional atmosphere / materials chips
 *
 * Variants by `kind`: milestone · atmosphere_shift · material_signal ·
 * lifestyle_signal · interview_signal · designer_message.
 */
import React from 'react';

const MemoryNarrativeCard = ({ card }) => {
  if (!card) return null;
  const kind = card.kind || 'interview_signal';
  return (
    <article
      className={`mem-card mem-card--${kind}`}
      data-testid={`mem-card-${kind}-${(card.occurred_at || '').slice(0, 19)}`}
    >
      <span className="mem-card__when">{card.when_label}</span>
      <p className="mem-card__narrative">{card.narrative}</p>
      {(card.atmosphere || (card.materials && card.materials.length > 0)) && (
        <ul className="mem-card__chips">
          {card.atmosphere && (
            <li className="mem-card__chip mem-card__chip--atmos">
              {String(card.atmosphere).replace(/_/g, ' ')}
            </li>
          )}
          {(card.materials || []).slice(0, 3).map((m, i) => (
            <li key={i} className="mem-card__chip mem-card__chip--material">
              {String(m).replace(/_/g, ' ')}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

export default MemoryNarrativeCard;
