/**
 * MoodDualCircleIcon — Brand mark for the Blueprint OS™ control center.
 *
 * Two interlocking circles, editorial-tech feel:
 *   • Outer ring — graphite stroke, the "platform" boundary
 *   • Inner ring — cyan accent (offset), the "intelligence" core
 *   • Mid-point glow — minimal, refined, never gaming/neon
 *
 * Designed for 14–32px sizes. Stroke scales naturally.
 */
import React from 'react';

const MoodDualCircleIcon = ({
  size = 22,
  accent = 'var(--mood-accent, #C9A26B)',
  ink    = 'var(--mood-ink-strong, #EFEBE4)',
  strokeWidth = 1.5,
  className = '',
  ...rest
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    role="img"
    aria-label="MOOD for DESIGN"
    className={className}
    {...rest}
  >
    {/* Outer platform circle */}
    <circle cx="13" cy="16" r="7.5" stroke={ink} strokeWidth={strokeWidth} opacity={0.65} />
    {/* Inner intelligence circle */}
    <circle cx="19" cy="16" r="7.5" stroke={accent} strokeWidth={strokeWidth} />
    {/* Intersection accent point */}
    <circle cx="16" cy="16" r="0.9" fill={accent} />
  </svg>
);

export default MoodDualCircleIcon;
