/**
 * toBcp47Storefront — Normalise a public storefront locale code to the
 * BCP-47 code used by the backend (`storefront_content`, `portfolio_*`,
 * `editorial_variants`).
 *
 * SiteContext public locales use compact codes: `it`, `fr`, `de`, `es`,
 * `en-US`, `en-GB`, `ar`. The backend variants store full BCP-47 codes:
 * `it-IT`, `fr-FR`, `de-DE`, `es-ES`, `en-US`, `en-GB`, `ar-AE`.
 *
 * Pass-through when already BCP-47.
 */
const MAP = {
  it: 'it-IT',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  ar: 'ar-AE',
};

export function toBcp47Storefront(locale) {
  if (!locale) return 'it-IT';
  if (MAP[locale]) return MAP[locale];
  // Already BCP-47 ish (e.g. en-US, en-GB) — return as-is.
  if (/^[a-z]{2}-[A-Z]{2}$/.test(locale)) return locale;
  // Defensive: split on '-' and reconstruct.
  const base = locale.split('-')[0].toLowerCase();
  return MAP[base] || locale;
}
