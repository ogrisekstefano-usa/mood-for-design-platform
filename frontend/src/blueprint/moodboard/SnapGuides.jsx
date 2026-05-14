/**
 * SnapGuides — editorial guide overlay rendered above the canvas.
 *
 * Premium feel: thin solid lines (no CAD dashes), low opacity, a soft teal
 * glow via CSS filter, and a 180ms fade-in. The lines extend slightly past
 * the snapped edge for a magazine-grade alignment hint, then vanish the
 * moment the snap disengages.
 */
import React from 'react';

const SnapGuides = ({ guides, canvasWidth, canvasHeight }) => {
  if (!guides || guides.length === 0) return null;

  return (
    <svg
      data-testid="snap-guides"
      width={canvasWidth} height={canvasHeight}
      className="absolute inset-0 pointer-events-none snap-guides-layer"
      style={{ overflow: 'visible' }}
    >
      {guides.map((g, i) => {
        if (g.axis === 'v') {
          return (
            <line
              key={`v-${i}`}
              x1={g.position} x2={g.position}
              y1={Math.max(0, g.from - 16)} y2={Math.min(canvasHeight, g.to + 16)}
              stroke="var(--bp-primary)"
              strokeWidth="0.75"
              strokeOpacity="0.85"
            />
          );
        }
        return (
          <line
            key={`h-${i}`}
            y1={g.position} y2={g.position}
            x1={Math.max(0, g.from - 16)} x2={Math.min(canvasWidth, g.to + 16)}
            stroke="var(--bp-primary)"
            strokeWidth="0.75"
            strokeOpacity="0.85"
          />
        );
      })}
    </svg>
  );
};

export default SnapGuides;
