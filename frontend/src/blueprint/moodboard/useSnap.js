/**
 * useSnap — magnetic snap for the moodboard canvas.
 *
 * Design language: Framer / Linear / Keynote.
 *  - Subtle proximity threshold (default 6px)
 *  - Snaps to: own canvas edges, canvas center, other blocks' edges + centers
 *  - Returns snapped coordinates + an array of guide lines (vertical / horizontal)
 *    that the canvas overlay fades in only while a snap is engaged
 *
 * No "CAD lines", no rulers, no rigid grid by default.
 */
const THRESHOLD = 6; // pixels

/**
 * Compute snap targets along one axis (x or y).
 *
 * @param {Array<number>} candidates  pixel positions the dragged edge can stick to
 * @param {Array<number>} sources     pixel positions of the dragged block (edges + center)
 * @returns {object|null} { delta, anchor, source }  the smallest delta needed to snap
 */
function pickSnap(candidates, sources) {
  let best = null;
  for (const src of sources) {
    for (const anchor of candidates) {
      const d = anchor - src;
      if (Math.abs(d) <= THRESHOLD && (best === null || Math.abs(d) < Math.abs(best.delta))) {
        best = { delta: d, anchor, source: src };
      }
    }
  }
  return best;
}

/**
 * Compute snapped coordinates + guides for a dragged/resized block.
 *
 * @param {object} dragged  { id, x, y, width, height }
 * @param {Array} blocks    all blocks on the canvas
 * @param {object} canvas   { width, height }
 * @param {string} mode     'move' | 'resize'
 * @returns {{ x, y, width, height, guides }}
 */
export function computeSnap(dragged, blocks, canvas, mode = 'move') {
  const { x, y, width, height } = dragged;
  const others = blocks.filter((b) => b.id !== dragged.id && !b.hidden);

  // Vertical guide candidates (X positions): canvas left, center, right + each other block's left/center/right
  const xCandidates = [
    0, canvas.width / 2, canvas.width,
    ...others.flatMap((b) => [b.x, b.x + b.width / 2, b.x + b.width]),
  ];
  const yCandidates = [
    0, canvas.height / 2, canvas.height,
    ...others.flatMap((b) => [b.y, b.y + b.height / 2, b.y + b.height]),
  ];

  // Dragged block's snap sources depend on mode:
  // - move: left / center / right (and top / middle / bottom) move together
  // - resize: only right + bottom edges move
  const xSources = mode === 'resize'
    ? [x + width]
    : [x, x + width / 2, x + width];
  const ySources = mode === 'resize'
    ? [y + height]
    : [y, y + height / 2, y + height];

  const sx = pickSnap(xCandidates, xSources);
  const sy = pickSnap(yCandidates, ySources);

  const guides = [];
  let nx = x, ny = y, nw = width, nh = height;

  if (sx) {
    if (mode === 'resize') nw = Math.max(40, width + sx.delta);
    else                   nx = x + sx.delta;
    guides.push({
      axis: 'v', position: sx.anchor,
      from: Math.min(...others.flatMap((b) => [b.y, b.y + b.height]), ny),
      to:   Math.max(...others.flatMap((b) => [b.y, b.y + b.height]), ny + nh, 0),
    });
  }
  if (sy) {
    if (mode === 'resize') nh = Math.max(40, height + sy.delta);
    else                   ny = y + sy.delta;
    guides.push({
      axis: 'h', position: sy.anchor,
      from: Math.min(...others.flatMap((b) => [b.x, b.x + b.width]), nx),
      to:   Math.max(...others.flatMap((b) => [b.x, b.x + b.width]), nx + nw, 0),
    });
  }

  return { x: nx, y: ny, width: nw, height: nh, guides };
}

export const SNAP_THRESHOLD = THRESHOLD;
