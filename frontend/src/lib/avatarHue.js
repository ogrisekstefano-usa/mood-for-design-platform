/**
 * avatarHueOf — deterministic editorial color from a name/seed.
 *
 * Shared "relationship memory" anchor across surfaces that represent
 * a person/account/contact. Same seed always produces the same hue,
 * so a designer recognises "this is Maya" by colour, not just by name.
 *
 *   import { avatarHueOf, initialsOf, avatarPalette } from '../../lib/avatarHue';
 *
 * Use sparingly — this is NOT a color system, it is recognition
 * affordance. Apply only on avatar-like surfaces (circle initial,
 * thin border accent), never as a dominant background.
 *
 * Palette returns paired bg/fg colors tuned for the dark Blueprint
 * surface. Light-mode is handled implicitly via CSS variables.
 */

export const avatarHueOf = (seed) => {
  if (!seed) return 220;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
};

export const initialsOf = (name) => {
  if (!name) return '··';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Returns a paired { bg, fg, border } palette for a given seed.
 * Tuned for dark surfaces. Saturation/lightness are restrained on
 * purpose so the hue is *recognisable* but never visually loud.
 */
export const avatarPalette = (seed) => {
  const hue = avatarHueOf(seed);
  return {
    hue,
    bg:     `hsl(${hue} 28% 22%)`,
    fg:     `hsl(${hue} 56% 78%)`,
    border: `hsl(${hue} 32% 28%)`,
  };
};
