// MOOD for DESIGN™ — Tenant Configuration Layer (placeholder)
// Mirrors future DB table:
//   `tenants_config(tenant_id, branding jsonb, languages jsonb, externals jsonb)`
// SuperAdmin will edit this from /settings/branding + /settings/languages.

export const tenantConfig = {
  // Studio external URL — used by Professional Gateway "Explore the studio" CTA.
  // Set per tenant in /settings (future). For demo: route to /projects.
  studioExternal: {
    url: '/projects',
    target: '_self', // _blank when real external URL is configured
  },
  // Brand display in chrome
  brand: {
    name: 'MOOD for DESIGN',
    suffix: '\u2122',
    logoSrc: '/brand/mood-for-design-mark.png',
  },
  // Tenant slug — single source of truth for the CMS public endpoints.
  // For the demo store this is the MOOD Demo Studio tenant.
  // In multi-tenant production this will be derived from the URL or domain.
  slug: 'studio',
  // Project category overrides (tenant may hide categories)
  enabledProjectCategories: ['all', 'residential', 'hospitality', 'retail'],
  // Email contact for fallback CTAs
  contactEmail: 'hello@moodfordesign.com',
};
