/**
 * MaterialEvolutionStrip · horizontal material progression strip.
 *
 * Renders the dedupe'd materials of a chapter as a quiet horizontal
 * sequence — each material is a small editorial pill, the row reads
 * as a palette emerging through the chapter, NOT a tag cloud.
 */
import React from 'react';

const MaterialEvolutionStrip = ({ materials = [] }) => {
  if (!materials.length) return null;
  return (
    <ul className="mem-materials" data-testid="mem-materials-strip" aria-label="Material evolution">
      <li className="mem-materials__eyebrow">Palette emerging</li>
      {materials.map((m, i) => (
        <li key={i} className="mem-materials__item">
          {String(m).replace(/_/g, ' ')}
        </li>
      ))}
    </ul>
  );
};

export default MaterialEvolutionStrip;
