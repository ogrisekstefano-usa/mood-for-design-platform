/**
 * SpacingBadges — Smart Spacing™ harmonic hints.
 *
 * Renderizza piccole pill di spacing tra il blocco draggato e i suoi
 * vicini. Se due gap sono entro tolleranza tra loro (HARMONIC_TOL),
 * vengono evidenziati come "armonici" (cyan tenue, glow).
 *
 * NON sposta nulla — è solo un'art direction invisibile, come un
 * direttore creativo che ti dice "guarda che qui c'è equilibrio".
 *
 * Le pill restano sempre dentro al canvas (overflow:visible sul SVG
 * parent), in monofont per leggibilità tecnica delicata.
 */
import React from 'react';

const Badge = ({ x, y, label, harmonic }) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect
      x={-18} y={-9}
      width={36} height={18} rx={9}
      fill={harmonic ? "color-mix(in srgb, var(--bp-primary) 22%, transparent)" : "rgba(20,20,22,0.78)"}
      stroke={harmonic ? "var(--bp-primary)" : "color-mix(in srgb, var(--bp-text-primary) 18%, transparent)"}
      strokeWidth={harmonic ? 1 : 0.5}
      style={{
        filter: harmonic
          ? 'drop-shadow(0 0 6px color-mix(in srgb, var(--bp-primary) 50%, transparent))'
          : 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))',
      }}
    />
    <text
      x={0} y={3}
      textAnchor="middle"
      fontFamily="ui-monospace, 'JetBrains Mono', monospace"
      fontSize={9.5}
      letterSpacing="0.04em"
      fill={harmonic ? "var(--bp-primary)" : "rgba(255,255,255,0.88)"}>
      {label}
    </text>
  </g>
);

const SpacingBadges = ({ harmonics, canvasWidth, canvasHeight }) => {
  if (!harmonics || harmonics.length === 0) return null;

  return (
    <svg
      data-testid="spacing-badges"
      width={canvasWidth} height={canvasHeight}
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      {harmonics.map((h, i) => {
        // Posiziona la badge a metà del gap
        const cx = h.axis === 'x' ? (h.x + h.x2) / 2 : (h.x + h.x2) / 2;
        const cy = h.axis === 'x' ? (h.y + h.y2) / 2 : (h.y + h.y2) / 2;
        // Soft connector line lungo l'asse del gap
        return (
          <g key={`sp-${i}`} className="spacing-badge-group">
            {h.axis === 'x' && (
              <line
                x1={h.x} y1={cy} x2={h.x2} y2={cy}
                stroke={h.harmonic ? 'var(--bp-primary)' : 'color-mix(in srgb, var(--bp-text-primary) 35%, transparent)'}
                strokeWidth={h.harmonic ? 1 : 0.6}
                strokeOpacity={h.harmonic ? 0.85 : 0.55}
                strokeDasharray={h.harmonic ? '' : '3 3'} />
            )}
            {h.axis === 'y' && (
              <line
                x1={cx} y1={h.y} x2={cx} y2={h.y2}
                stroke={h.harmonic ? 'var(--bp-primary)' : 'color-mix(in srgb, var(--bp-text-primary) 35%, transparent)'}
                strokeWidth={h.harmonic ? 1 : 0.6}
                strokeOpacity={h.harmonic ? 0.85 : 0.55}
                strokeDasharray={h.harmonic ? '' : '3 3'} />
            )}
            <Badge x={cx} y={cy} label={`${h.gap}`} harmonic={!!h.harmonic} />
          </g>
        );
      })}
    </svg>
  );
};

export default SpacingBadges;
