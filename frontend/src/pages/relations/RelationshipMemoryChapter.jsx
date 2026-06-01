/**
 * RelationshipMemoryChapter · a single editorial chapter of the
 * Relationship Memory™ timeline.
 *
 * Layout: large chapter rule + serif italic title + curator intro,
 * followed by the chapter's narrative cards. Atmosphere shifts get
 * promoted to AtmosphereShiftCard, others to MemoryNarrativeCard.
 * The chapter closes with an optional MaterialEvolutionStrip.
 */
import React from 'react';
import MemoryNarrativeCard from './MemoryNarrativeCard';
import AtmosphereShiftCard from './AtmosphereShiftCard';
import MaterialEvolutionStrip from './MaterialEvolutionStrip';

const RelationshipMemoryChapter = ({ chapter, index }) => {
  if (!chapter) return null;
  const { key, title, intro, cards = [], atmospheres = [], materials = [] } = chapter;

  // Detect atmosphere transitions inside the chapter (consecutive
  // atmosphere_shift cards with different atmosphere values).
  const blocks = [];
  let prevAtmos = null;
  cards.forEach((c, i) => {
    if (c.kind === 'atmosphere_shift' && c.atmosphere && prevAtmos && c.atmosphere !== prevAtmos) {
      blocks.push(
        <AtmosphereShiftCard
          key={`shift-${i}`}
          from={prevAtmos}
          to={c.atmosphere}
          narrative={c.narrative}
          whenLabel={c.when_label}
        />
      );
    } else {
      blocks.push(<MemoryNarrativeCard key={i} card={c} />);
    }
    if (c.atmosphere) prevAtmos = c.atmosphere;
  });

  return (
    <section className="mem-chapter" data-testid={`mem-chapter-${key}`}>
      <header className="mem-chapter__head">
        <span className="mem-chapter__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <span className="mem-chapter__rule" aria-hidden="true" />
        <h3 className="mem-chapter__title">{title}</h3>
        {intro && <p className="mem-chapter__intro">{intro}</p>}
      </header>

      <div className="mem-chapter__cards" data-testid={`mem-chapter-cards-${key}`}>
        {blocks}
      </div>

      {(atmospheres.length > 0 || materials.length > 0) && (
        <footer className="mem-chapter__foot">
          {atmospheres.length > 0 && (
            <ul className="mem-chapter__chips" data-testid={`mem-chapter-atmos-${key}`}>
              <li className="mem-chapter__chips-label">stili</li>
              {atmospheres.map((a, i) => (
                <li key={i} className="mem-chapter__chip">{String(a).replace(/_/g, ' ')}</li>
              ))}
            </ul>
          )}
          {materials.length > 0 && <MaterialEvolutionStrip materials={materials} />}
        </footer>
      )}
    </section>
  );
};

export default RelationshipMemoryChapter;
