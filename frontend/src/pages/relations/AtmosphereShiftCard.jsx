/**
 * AtmosphereShiftCard · accent card for atmosphere transitions.
 *
 * Used inline within a chapter when the relationship moves between
 * atmospheres. Rendered with a left rule + larger serif type to
 * mark the shift visually — a "chapter break inside a chapter".
 */
import React from 'react';

const AtmosphereShiftCard = ({ from, to, narrative, whenLabel }) => (
  <article className="mem-shift" data-testid="mem-atmosphere-shift">
    <span className="mem-shift__rule" aria-hidden="true" />
    <span className="mem-shift__eyebrow">Atmosphere shift</span>
    <h4 className="mem-shift__line">
      {from ? <em>{String(from).replace(/_/g, ' ')}</em> : 'no register'}
      <span className="mem-shift__arrow" aria-hidden="true">→</span>
      <em>{String(to).replace(/_/g, ' ')}</em>
    </h4>
    {narrative && <p className="mem-shift__narrative">{narrative}</p>}
    {whenLabel && <span className="mem-shift__when">{whenLabel}</span>}
  </article>
);

export default AtmosphereShiftCard;
