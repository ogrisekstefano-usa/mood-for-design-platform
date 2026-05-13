/**
 * SnapGuides — editorial guide overlay rendered above the canvas.
 *
 * No persistent rulers, no rigid axis ticks. Lines fade in only while a snap
 * is engaged, then fade out after the mouse releases. Color uses the brand
 * primary, opacity is kept low so the canvas keeps the editorial feel.
 */
import React from 'react';

const SnapGuides = ({ guides, canvasWidth, canvasHeight }) => {
  if (!guides || guides.length === 0) return null;

  return (
    <svg
      data-testid="snap-guides"
      width={canvasWidth} height={canvasHeight}
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      {guides.map((g, i) => {
        if (g.axis === 'v') {
          return (
            <line
              key={`v-${i}`}
              x1={g.position} x2={g.position}
              y1={Math.max(0, g.from - 12)} y2={Math.min(canvasHeight, g.to + 12)}
              stroke="var(--bp-primary)"
              strokeWidth="1"
              strokeOpacity="0.55"
              strokeDasharray="2 3"
            />
          );
        }
        return (
          <line
            key={`h-${i}`}
            y1={g.position} y2={g.position}
            x1={Math.max(0, g.from - 12)} x2={Math.min(canvasWidth, g.to + 12)}
            stroke="var(--bp-primary)"
            strokeWidth="1"
            strokeOpacity="0.55"
            strokeDasharray="2 3"
          />
        );
      })}
    </svg>
  );
};

export default SnapGuides;
