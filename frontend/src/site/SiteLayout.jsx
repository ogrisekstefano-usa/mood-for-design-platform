import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import SiteFooter from './components/SiteFooter';
import { SiteProvider } from './SiteContext';
import StorefrontThemeProvider from '../design-system/storefront/StorefrontThemeProvider';
import PlatformFooterBar from '../components/common/PlatformFooterBar';
import './site.css';
import './exe.css';
import './mood.css';
import '../components/demo/demo.css';

const ScrollToTopOnNav = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); } catch (_) { window.scrollTo(0,0); }
  }, [pathname]);
  return null;
};

/**
 * SiteLayout — Storefront (tenant-branded public site) shell.
 *
 * CRITICAL: wrapped in StorefrontThemeProvider so the subtree carries
 * `data-surface="storefront"`. The runtime tenant theme variables
 * (`--brand-*`) emitted by TenantThemeContext apply here — and ONLY
 * here. Blueprint OS surfaces (DashboardLayout, AdminLayout) cannot
 * inherit storefront branding by design.
 */
const SiteLayout = ({ children }) => {
  return (
    <SiteProvider>
      <StorefrontThemeProvider>
        <div className="mfd-site" data-testid="mfd-site-root">
          <ScrollToTopOnNav />
          <SiteHeader />
          <main className="mfd-site__container">
            {children || <Outlet />}
          </main>
          <SiteFooter />
          <PlatformFooterBar surface="storefront" />
        </div>
      </StorefrontThemeProvider>
    </SiteProvider>
  );
};

export default SiteLayout;
