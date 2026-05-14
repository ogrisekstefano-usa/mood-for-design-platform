/**
 * ArrowBlock — editorial markup arrow (straight | curved | sketch).
 *
 *   content.kind:    'straight' | 'curved' | 'sketch'
 *   content.head:    'triangle' | 'open' | 'none'  (default 'triangle')
 *   style.color:     CSS color, default var(--bp-text-primary)
 *   style.thickness: 1..12 px
 *   style.dashed:    boolean
 *   block.opacity / rotation: handled at element level by editor
 *
 *   Renders inside the block's natural width/height via SVG so the arrow
 *   scales with resize. Sketch variant adds a hand-drawn wobble using a
 *   deterministic seeded path so it doesn't flicker between renders.
 */
import React, { useMemo } from 'react';

const seedFromId = (id) => {
  if (!id) return 1;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const ArrowBlock = ({ block }) => {
  const c = block.content || {};
  const s = block.style || {};
  const kind = c.kind || 'straight';
  const head = c.head || 'triangle';
  const color = s.color || 'var(--bp-text-primary)';
  const thickness = s.thickness ?? 2;
  const dashed = !!s.dashed;

  const w = block.width || 200;
  const h = block.height || 60;

  // Path computation. We use the block's local 0..w / 0..h space.
  const x1 = 4, y1 = h / 2;
  const x2 = w - 8, y2 = h / 2;

  const path = useMemo(() => {
    if (kind === 'straight') {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    if (kind === 'curved') {
      const cx = (x1 + x2) / 2;
      const cy = y1 - Math.min(h * 0.4, w * 0.25);
      return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    }
    // sketch — hand-drawn wobble: 12 segments, each jittered by a
    // deterministic function of the block id so the path is stable
    // across renders but still feels "drawn".
    const seed = seedFromId(block.id);
    const N = 14;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const lx = x1 + (x2 - x1) * t;
      const ly = y1 + (y2 - y1) * t;
      const jitter = ((Math.sin(seed * 0.07 + i * 1.31) * 5)
                    + (Math.cos(seed * 0.13 + i * 0.71) * 3));
      pts.push([lx, ly + jitter * 0.5]);
    }
    return pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ');
  }, [kind, x1, y1, x2, y2, w, h, block.id]);

  // Arrowhead — drawn as a small triangle at the path's end angle.
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowSize = Math.max(8, thickness * 3);
  const ax = x2;
  const ay = y2;
  const lx = ax - Math.cos(angle - Math.PI / 6) * arrowSize;
  const ly = ay - Math.sin(angle - Math.PI / 6) * arrowSize;
  const rx = ax - Math.cos(angle + Math.PI / 6) * arrowSize;
  const ry = ay - Math.sin(angle + Math.PI / 6) * arrowSize;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%"
         preserveAspectRatio="none"
         data-testid={`arrow-${kind}`}
         style={{ color, overflow: 'visible' }}>
      <path d={path}
            stroke="currentColor"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashed ? `${thickness * 3} ${thickness * 2}` : undefined}
            fill="none" />
      {head === 'triangle' && (
        <polygon points={`${ax},${ay} ${lx},${ly} ${rx},${ry}`}
                 fill="currentColor" />
      )}
      {head === 'open' && (
        <>
          <line x1={ax} y1={ay} x2={lx} y2={ly}
                stroke="currentColor" strokeWidth={thickness} strokeLinecap="round" />
          <line x1={ax} y1={ay} x2={rx} y2={ry}
                stroke="currentColor" strokeWidth={thickness} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
};

export default ArrowBlock;
