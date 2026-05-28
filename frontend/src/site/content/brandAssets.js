/**
 * Brand logo constants — single source of truth for the MOOD for DESIGN™
 * wordmark across the entire application. Public surfaces (header, footer,
 * begin-journey, login, email) reference these instead of inline `<span>`
 * text marks or random asset URLs.
 *
 * Official asset uploaded by the user (ITER167 R4 follow-up):
 *   /brand/logo-official.png  →  black square with mint MOOD wordmark
 *                                and editorial tagline.
 *
 * The asset is a SQUARE BLACK PNG → it already contains all the brand
 * text inside the image. NEVER add subtitle copy ("Italian Design Studios",
 * "BLUEPRINT OS™", etc.) next to the logo — that's hardcoded text the
 * user explicitly asked to remove.
 *
 * A tenant can still override the wordmark via
 * `tenant.branding.assets.logo_dark/light`. This file provides ONLY the
 * platform default for the "MOOD for DESIGN" master brand.
 */

// Canonical CDN URL (preferred — cacheable on the Emergent customer-assets bucket).
export const MOOD_BRAND_LOGO_URL =
  'https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/iow4xdfw_logo_mood_for_design_color.png';

// Local fallback (bundled in /public/brand/) used by Brand.jsx as last resort.
export const MOOD_BRAND_LOGO_LOCAL = '/brand/logo-official.png';

// Alt text — keep accessibility editorial, not "logo image".
export const MOOD_BRAND_ALT = 'MOOD for DESIGN™';
