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

// White-label: no platform logo is shown as fallback.
// Each tenant must configure their logo via CMS → navigation → nav_top → logo_url.
// When no logo is configured, the site shows the studio name as text.
export const MOOD_BRAND_LOGO_URL = null;

// Local fallback (bundled in /public/brand/) used by Brand.jsx as last resort.
export const MOOD_BRAND_LOGO_LOCAL = '/brand/logo-official.png';

// Alt text — neutral, white-label safe.
export const MOOD_BRAND_ALT = 'Studio';
