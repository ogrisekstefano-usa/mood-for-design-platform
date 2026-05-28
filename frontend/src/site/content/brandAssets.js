/**
 * Brand logo constants — single source of truth for the MOOD for DESIGN™
 * wordmark across the entire application. Public surfaces (header, footer,
 * begin-journey, login, email) reference these instead of inline `<span>`
 * text marks or random asset URLs.
 *
 * Official asset uploaded by the user (ITER167 R4 follow-up):
 *   /brand/logo-official.jpg  →  full-color editorial wordmark.
 *
 * A tenant can still override the wordmark via
 * `tenant.branding.assets.logo_dark/light`. This file provides ONLY the
 * platform default for the "MOOD for DESIGN" master brand.
 */

// Canonical CDN URL (preferred — keeps the brand asset cacheable on the
// Emergent customer-assets bucket even if the local /public copy is
// missing on a stale deploy).
export const MOOD_BRAND_LOGO_URL =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/4ecnf6t5_logo_mood_for_design_color.jpg';

// Local fallback (bundled in /public/brand/), used by Brand.jsx as last resort.
export const MOOD_BRAND_LOGO_LOCAL = '/brand/logo-official.jpg';

// Alt text — keep accessibility editorial, not "logo image".
export const MOOD_BRAND_ALT = 'MOOD for DESIGN™';
