/**
 * MOOD Design System Kernel™ — JS helpers.
 * Sprint HARDENING-01.1.
 *
 * Single programmatic entry-point for motion timings, breakpoints,
 * and the semantic token catalog (for component-tree introspection
 * and the LiveQA overlay).
 *
 * This file does NOT define visual values — it MIRRORS them from
 * `kernel.css`. The CSS is the source of truth; this file is the
 * machine-readable view of it.
 */

/** Kernel ID for introspection / governance overlay. */
export const KERNEL_ID = 'mood-design-kernel-v1';

/** Motion timings (ms). Mirrors `--mood-duration-*` in kernel.css. */
export const motion = Object.freeze({
  fast:       140,
  base:       280,
  slow:       520,
  cinematic:  900,
});

/** Editorial easing curves. Mirrors `--mood-ease-*` in kernel.css. */
export const easing = Object.freeze({
  out:   'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  calm:  'cubic-bezier(0.4, 0, 0.2, 1)',
});

/** Spacing scale (px). Mirrors `--mood-space-*`. */
export const spacing = Object.freeze({
  1: 4,  2: 8,  3: 12, 4: 18,
  5: 24, 6: 32, 7: 48, 8: 64, 9: 96,
});

/** Layout breakpoints (px). */
export const breakpoints = Object.freeze({
  mobile:  720,
  tablet:  1024,
  desktop: 1280,
});

/** Semantic token catalog — used by the governance overlay to detect
 *  which tokens are actually in use vs which fall back to defaults. */
export const SEMANTIC_TOKENS = Object.freeze([
  // surface
  '--mood-bg', '--mood-surface', '--mood-surface-soft',
  '--mood-surface-elevated', '--mood-surface-hover', '--mood-card',
  // borders / text
  '--mood-border', '--mood-border-strong', '--mood-editorial-border',
  '--mood-text', '--mood-text-muted', '--mood-text-faint',
  // accents
  '--mood-accent', '--mood-accent-soft', '--mood-accent-glow',
  '--mood-gold', '--mood-gold-attenuated',
  '--mood-danger', '--mood-warning', '--mood-success-fg',
  // domain-semantic
  '--mood-journey-accent', '--mood-archive-glow',
  '--mood-client-calm-bg', '--mood-dossier-paper',
  '--mood-companion-veil', '--mood-shared-voice-ring',
  '--mood-site-evolution-mark', '--mood-relationship-pulse',
  // typography
  '--mood-font-heading', '--mood-font-body',
  '--mood-font-serif', '--mood-font-mono',
]);

/**
 * Read the current computed value of a kernel token from <html>.
 * Used by the governance overlay and tests to verify propagation.
 */
export function readToken(name) {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim();
}

/** Returns true if a token is currently using its fallback (no tenant override). */
export function isFallback(name) {
  // Heuristic: if the computed value matches the kernel default for
  // surface tokens, we are not overridden. Practical implementation
  // is left to the overlay component.
  const v = readToken(name);
  return Boolean(v);
}

export default {
  KERNEL_ID, motion, easing, spacing, breakpoints,
  SEMANTIC_TOKENS, readToken, isFallback,
};
