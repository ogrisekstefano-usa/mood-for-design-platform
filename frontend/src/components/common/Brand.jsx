import React from 'react';
import { useBlueprint } from '../../contexts/BlueprintContext';

/**
 * Tenant-aware Brand component.
 *
 * Order of precedence:
 *   1. tenant.branding.assets.logo_{dark|light} (uploaded per-tenant)
 *   2. fallback to bundled MOOD for DESIGN logo from /public/brand/
 *      — mode swap handled in pure CSS via [data-workspace-mode="light"]
 *        so no React state is needed when the user toggles the workspace mode.
 *   3. typographic fallback if neither logo source resolves
 */
const Brand = ({ size = 'md', collapsed = false }) => {
  const { tenant, t } = useBlueprint();

  // Tenant-uploaded asset (if any) takes precedence over the bundled mark.
  const tenantDark  = tenant?.branding?.assets?.logo_dark  || tenant?.theme?.logo_url;
  const tenantLight = tenant?.branding?.assets?.logo_light || tenant?.theme?.logo_url;

  const heightMap = {
    sm: collapsed ? 28 : 32,
    md: collapsed ? 32 : 40,
    lg: collapsed ? 36 : 48,
  };
  const h = heightMap[size] || heightMap.md;

  // We render TWO <img> tags layered on top of each other and let CSS show
  // the right one based on the workspace mode attribute. This avoids any
  // React subscription and keeps the swap instant + flicker-free.
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
