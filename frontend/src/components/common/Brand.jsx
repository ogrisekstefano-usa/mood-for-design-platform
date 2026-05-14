import React from 'react';
import { useBlueprint } from '../../contexts/BlueprintContext';

/**
 * Tenant-aware Brand component.
 *
 * Variants:
 *   - "wordmark" (default): the full MOOD for DESIGN™ logo image, swapped
 *     between dark/light variants via CSS (no React state).
 *   - "monogram": a single editorial "M" letterform — used in the sidebar
 *     so the topbar can carry the full wordmark without duplication.
 *
 * Asset precedence:
 *   1. tenant.branding.assets.logo_{dark|light} (uploaded per-tenant)
 *   2. fallback to bundled MOOD for DESIGN logo from /public/brand/
 *   3. typographic fallback if neither logo source resolves
 */
const Brand = ({ size = 'md', collapsed = false, variant = 'wordmark' }) => {
  const { tenant, t } = useBlueprint();

  // Monogram — the MOOD for DESIGN "OO" interlocking-rings mark.
  // Rendered as a real image (svg/png) so the curatorial brand identity is
  // preserved at every size. Falls back to the first letter of the tenant
  // name if the asset fails to load (silent degradation).
  if (variant === 'monogram') {
    const sizeMap = { sm: 28, md: 34, lg: 40 };
    const dim = sizeMap[size] || sizeMap.md;
    return (
      <div
        data-testid="brand-monogram"
        className="relative flex items-center justify-center select-none"
        style={{ width: dim, height: dim }}
        title={tenant?.name || t('brand.name', null, 'MOOD for DESIGN')}
      >
        <img
          src="/brand/logo-monogram.png"
          alt={tenant?.name || 'MOOD for DESIGN'}
          draggable={false}
          className="w-full h-full object-contain pointer-events-none"
          onError={(e) => {
            // Silent fallback to typographic monogram if the asset is missing
            const fallback = (tenant?.name?.[0] || 'M').toUpperCase();
            e.currentTarget.outerHTML = `<span style="font-family:Playfair Display, serif; font-size:${dim * 0.6}px; line-height:1; color:var(--bp-primary); font-weight:500;">${fallback}</span>`;
          }}
        />
      </div>
    );
  }

  // Wordmark — tenant-uploaded asset takes precedence over bundled mark.
  const tenantDark  = tenant?.branding?.assets?.logo_dark  || tenant?.theme?.logo_url;
  const tenantLight = tenant?.branding?.assets?.logo_light || tenant?.theme?.logo_url;

  const heightMap = {
    sm: collapsed ? 28 : 32,
    md: collapsed ? 32 : 40,
    lg: collapsed ? 36 : 48,
  };
  const h = heightMap[size] || heightMap.md;

  // Two stacked <img> tags swapped via CSS for instant, flicker-free transitions.
  const containerCls = `relative flex items-center ${collapsed ? 'justify-center' : ''}`;

  return (
    <div className={containerCls} data-testid="brand-logo" style={{ height: h }}>
      <img
        src={tenantDark || '/brand/logo-dark.png'}
        alt={tenant?.name || t('brand.name', null, 'MOOD for DESIGN')}
        className="block w-auto h-full object-contain select-none pointer-events-none brand-mark brand-mark--dark"
        draggable={false}
      />
      <img
        src={tenantLight || '/brand/logo-light.png'}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-auto h-full object-contain select-none pointer-events-none brand-mark brand-mark--light"
        draggable={false}
      />
    </div>
  );
};

export default Brand;
