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

  // Monogram is rendered as styled type — no image asset needed. The letter
  // adapts to mode via the same CSS variables that drive the rest of the UI.
  if (variant === 'monogram') {
    const sizeMap = { sm: 28, md: 34, lg: 40 };
    const dim = sizeMap[size] || sizeMap.md;
    const monogramLetter = (tenant?.name?.[0] || 'M').toUpperCase();
    return (
      <div
        data-testid="brand-monogram"
        className="relative flex items-center justify-center rounded-[6px] border border-[var(--bp-border)]
                   bg-[var(--bp-surface-2)]/50 select-none"
        style={{ width: dim, height: dim }}
        title={tenant?.name || t('brand.name', null, 'MOOD for DESIGN')}
      >
        <span
          className="font-display leading-none text-[var(--bp-text-primary)]"
          style={{ fontSize: dim * 0.55, fontWeight: 500, letterSpacing: '-0.02em' }}
        >
          {monogramLetter}
        </span>
        <span
          aria-hidden="true"
          className="absolute -bottom-[3px] right-[3px] w-[5px] h-[5px] rounded-full bg-[var(--bp-primary)]"
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
