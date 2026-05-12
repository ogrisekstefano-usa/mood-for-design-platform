import React from 'react';
import { useBlueprint } from '../../contexts/BlueprintContext';

/**
 * Tenant-aware Brand component.
 * Renders tenant logo if uploaded, otherwise typographic fallback.
 */
const Brand = ({ size = 'md', variant = 'dark' }) => {
  const { tenant, t } = useBlueprint();
  const logoUrl = variant === 'light'
    ? tenant?.branding?.assets?.logo_light || tenant?.theme?.logo_url
    : tenant?.branding?.assets?.logo_dark  || tenant?.theme?.logo_url;

  const sizes = {
    sm: { logo: 'h-7', text: 'text-[10px]', sub: 'text-[8px]' },
    md: { logo: 'h-9', text: 'text-sm',     sub: 'text-[10px]' },
    lg: { logo: 'h-12', text: 'text-base',  sub: 'text-[11px]' },
  };
  const s = sizes[size] || sizes.md;

  if (logoUrl) {
    return (
      <div className="flex items-center" data-testid="brand-logo">
        <img src={logoUrl} alt={tenant?.name || 'Brand'} className={`${s.logo} w-auto object-contain`} />
      </div>
    );
  }

  // Typographic fallback — uses tenant primary color as accent
  return (
    <div className="flex items-center gap-2.5" data-testid="brand-text">
      <div className="w-7 h-7 rounded-[var(--bp-radius-sm)] flex items-center justify-center flex-shrink-0"
           style={{ backgroundColor: 'var(--bp-primary)' }}>
        <span className="text-[var(--bp-bg)] font-bold font-body text-xs">
          {(tenant?.name || 'M').charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0">
        <p className={`text-[var(--bp-text-primary)] ${s.text} font-semibold font-body tracking-[0.1em] uppercase leading-tight`}>
          {tenant?.name || t('brand.name', null, 'MOOD for Design')}
        </p>
        <p className={`text-[var(--bp-text-subtle)] ${s.sub} font-body tracking-[0.2em] uppercase`}>
          Blueprint OS™
        </p>
      </div>
    </div>
  );
};

export default Brand;
