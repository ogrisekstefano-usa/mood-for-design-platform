/**
 * StorefrontThemeProvider — surface gate for tenant-branded public sites.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  This wrapper marks its subtree with `data-surface="storefront"` ║
 * ║  so the runtime tenant theme (--brand-*) emitted by              ║
 * ║  TenantThemeContext can take effect HERE — and only here.        ║
 * ║                                                                   ║
 * ║  Allowed customisation: logo · palette · fonts · spacing ·       ║
 * ║  hero · animations · motion · branding tokens.                   ║
 * ║                                                                   ║
 * ║  FORBIDDEN: do NOT import any Blueprint OS visual primitives     ║
 * ║  underneath this provider. Use storefront-scoped components      ║
 * ║  only (under `/components/storefront/*` or `/site/components`).  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import React from 'react';
import './tokens.css';

const StorefrontThemeProvider = ({ children, className = '' }) => (
  <div data-surface="storefront" data-mfd-theme="storefront" className={className}>
    {children}
  </div>
);

export default StorefrontThemeProvider;
