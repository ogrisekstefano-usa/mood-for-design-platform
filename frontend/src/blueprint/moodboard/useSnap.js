/**
 * useSnap — Magnetic Moodboards™ proximity engine (Phase D · Sprint D2).
 *
 * Linguaggio: "attrazione morbida", non "snap rigid".
 *
 * Tre zone radiali (in pixel canvas-space) modulano il comportamento:
 *
 *   distance < COMMIT  → commit hard snap (l'elemento si allinea esatto)
 *   COMMIT..ATTRACT     → soft pull (frazione del delta · curva sigmoidale)
 *   > ATTRACT           → nessun effetto
 *
 * In più ritorna `harmonics`: hint di spacing armonico (gap percepiti come
 * equivalenti tra blocchi vicini, suggerimento solo visivo · NON sposta).
 *
 * Output:
 *   { x, y, width, height, guides, harmonics, magnetic }
 *      guides   = linee allineamento committed (cyan flush)
 *      harmonics = badge di spacing armonico (info-only)
 *      magnetic  = soft-pull engaged? (per CSS lift extra)
 */

// Soft hard-commit threshold — quando l'utente è ENTRO questo raggio,
// l'allineamento si "incolla" esattamente. Più piccolo del precedente
// (era 6px) per evitare il feeling "snap aggressivo".
const COMMIT = 3;

// Soft attraction radius — fino a questo raggio l'elemento è attirato
// dolcemente verso l'anchor, ma può ancora superarlo.
const ATTRACT = 16;

// Spacing harmonic tolerance — quando un gap è entro questo dalla media
// dei gap vicini, viene proposto come "armonico".
const HARMONIC_TOL = 4;

/**
 * Curva sigmoidale che mappa la distanza (0..ATTRACT) sul pull factor (1..0).
 * A distanza COMMIT il pull è 1 (commit completo).
 * A distanza ATTRACT il pull è ~0 (nessun effetto).
 */
function pullFactor(absDelta) {
  if (absDelta <= COMMIT) return 1.0;
  if (absDelta >= ATTRACT) return 0.0;
  // Smooth ease-out: 1 - normalized^2
  const norm = (absDelta - COMMIT) / (ATTRACT - COMMIT);
  return Math.max(0, 1 - norm * norm);
}

/**
 * Per ogni source/anchor calcola il candidato migliore (delta minimo).
 * Ritorna { delta, anchor, source, pull }.
 */
function pickMagnetic(candidates, sources) {
  let best = null;
  for (const src of sources) {
    for (const anchor of candidates) {
      const d = anchor - src;
      const abs = Math.abs(d);
      if (abs > ATTRACT) continue;
      if (best === null || abs < Math.abs(best.delta)) {
        best = { delta: d, anchor, source: src, pull: pullFactor(abs) };
      }
    }
  }
  return best;
}

/**
 * Costruisce gli array di anchor candidati per asse X dalle posizioni di
 * canvas + altri blocchi.
 */
function buildCandidates(others, canvasSize, axis) {
  if (axis === 'x') {
    return [
      0, canvasSize.width / 2, canvasSize.width,
      ...others.flatMap((b) => [b.x, b.x + b.width / 2, b.x + b.width]),
    ];
  }
  return [
    0, canvasSize.height / 2, canvasSize.height,
    ...others.flatMap((b) => [b.y, b.y + b.height / 2, b.y + b.height]),
  ];
}

/**
 * Smart Spacing™ — rileva opportunità di spacing armonico tra il blocco
 * draggato e i suoi vicini orizzontali / verticali.
 *
 * Output: array di harmonics → { axis, gap, between: [block_a, block_b] }
 * Renderizzate da SpacingBadges come pill "32 ↔ 32" tra le coppie.
 */
function detectHarmonics(dragged, others) {
  const harmonics = [];
  const dx0 = dragged.x;
  const dx1 = dragged.x + dragged.width;
  const dy0 = dragged.y;
  const dy1 = dragged.y + dragged.height;

  // Vertical band overlap → orizzontale (horizontal gap)
  for (const b of others) {
    const verticalOverlap = !(b.y + b.height < dy0 - 60 || b.y > dy1 + 60);
    if (!verticalOverlap) continue;
    const gapLeft  = dx0 - (b.x + b.width);
    const gapRight = b.x - dx1;
    if (gapLeft > 0 && gapLeft < 200) {
      harmonics.push({
        axis: 'x', side: 'left', gap: Math.round(gapLeft),
        x: b.x + b.width, y: Math.max(dy0, b.y),
        x2: dx0, y2: Math.min(dy1, b.y + b.height),
        peer: b.id,
      });
    }
    if (gapRight > 0 && gapRight < 200) {
      harmonics.push({
        axis: 'x', side: 'right', gap: Math.round(gapRight),
        x: dx1, y: Math.max(dy0, b.y),
        x2: b.x, y2: Math.min(dy1, b.y + b.height),
        peer: b.id,
      });
    }
  }
  // Horizontal band overlap → verticale (vertical gap)
  for (const b of others) {
    const horizontalOverlap = !(b.x + b.width < dx0 - 60 || b.x > dx1 + 60);
    if (!horizontalOverlap) continue;
    const gapTop    = dy0 - (b.y + b.height);
    const gapBottom = b.y - dy1;
    if (gapTop > 0 && gapTop < 200) {
      harmonics.push({
        axis: 'y', side: 'top', gap: Math.round(gapTop),
        x: Math.max(dx0, b.x), y: b.y + b.height,
        x2: Math.min(dx1, b.x + b.width), y2: dy0,
        peer: b.id,
      });
    }
    if (gapBottom > 0 && gapBottom < 200) {
      harmonics.push({
        axis: 'y', side: 'bottom', gap: Math.round(gapBottom),
        x: Math.max(dx0, b.x), y: dy1,
        x2: Math.min(dx1, b.x + b.width), y2: b.y,
        peer: b.id,
      });
    }
  }

  // Mark "harmonic" pairs — gaps within HARMONIC_TOL of each other along
  // the same axis are considered armonici (suggerimento equilibrio).
  for (const axis of ['x', 'y']) {
    const same = harmonics.filter((h) => h.axis === axis);
    same.forEach((h, i) => {
      const peer = same.find((o, j) =>
        i !== j && Math.abs(o.gap - h.gap) <= HARMONIC_TOL
      );
      if (peer) h.harmonic = true;
    });
  }

  return harmonics;
}

/**
 * Magnetic Moodboards™ engine.
 *
 * @param {object} dragged  { id, x, y, width, height }
 * @param {Array}  blocks   tutti i blocchi attivi sulla pagina
 * @param {object} canvas   { width, height }
 * @param {string} mode     'move' | 'resize'
 * @returns {{x,y,width,height,guides,harmonics,magnetic}}
 */
export function computeSnap(dragged, blocks, canvas, mode = 'move') {
  const { x, y, width, height } = dragged;
  const others = blocks.filter((b) => b.id !== dragged.id && !b.hidden);

  const xCandidates = buildCandidates(others, canvas, 'x');
  const yCandidates = buildCandidates(others, canvas, 'y');

  const xSources = mode === 'resize'
    ? [x + width]
    : [x, x + width / 2, x + width];
  const ySources = mode === 'resize'
    ? [y + height]
    : [y, y + height / 2, y + height];

  const sx = pickMagnetic(xCandidates, xSources);
  const sy = pickMagnetic(yCandidates, ySources);

  const guides = [];
  let nx = x, ny = y, nw = width, nh = height;
  let magnetic = false;

  if (sx) {
    const applied = sx.delta * sx.pull;
    if (mode === 'resize') nw = Math.max(40, width + applied);
    else                   nx = x + applied;
    // Committed guides only when very close (visual contract)
    if (Math.abs(sx.delta) <= COMMIT) {
      guides.push({
        axis: 'v', position: sx.anchor,
        from: Math.min(...others.flatMap((b) => [b.y, b.y + b.height]), ny),
        to:   Math.max(...others.flatMap((b) => [b.y, b.y + b.height]), ny + nh, 0),
      });
    }
    if (sx.pull > 0.05) magnetic = true;
  }
  if (sy) {
    const applied = sy.delta * sy.pull;
    if (mode === 'resize') nh = Math.max(40, height + applied);
    else                   ny = y + applied;
    if (Math.abs(sy.delta) <= COMMIT) {
      guides.push({
        axis: 'h', position: sy.anchor,
        from: Math.min(...others.flatMap((b) => [b.x, b.x + b.width]), nx),
        to:   Math.max(...others.flatMap((b) => [b.x, b.x + b.width]), nx + nw, 0),
      });
    }
    if (sy.pull > 0.05) magnetic = true;
  }

  // Smart Spacing™ — calcola harmonics solo durante move (non resize)
  const harmonics = mode === 'move'
    ? detectHarmonics({ x: nx, y: ny, width: nw, height: nh }, others)
    : [];

  return { x: nx, y: ny, width: nw, height: nh, guides, harmonics, magnetic };
}

export const SNAP_THRESHOLD = COMMIT;
export const MAGNETIC_RADIUS = ATTRACT;
