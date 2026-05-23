import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar, { TopbarSlotsProvider } from './Topbar';
import ImpersonationBanner from '../common/ImpersonationBanner';
import PlatformFooterBar from '../common/PlatformFooterBar';
import BlueprintThemeProvider from '../../design-system/os/BlueprintThemeProvider';
import OwnerIntroductionGate from '../onboarding/OwnerIntroductionGate';
import MobileBlocker from './MobileBlocker';

/**
 * DashboardLayout — Blueprint OS shell.
 *
 * CRITICAL: wrapped in BlueprintThemeProvider so the entire OS subtree
 * carries `data-surface="os"`. Tenant theme variables emitted by
 * TenantThemeContext are scoped to `[data-surface="storefront"]` and
 * therefore cannot leak into this surface — by design.
 *
 * ITER138 · Phase 3 (Responsive Cinematic Hardening): on viewports < 768px
 * we replace the entire OS shell with the Atelier Mobile Blocker (a
 * cinematic still frame + CTA) rather than collapsing every module into a
 * reduced SaaS layout. Desktop-first is intentional and brand-defining.
 */
const MOBILE_MAX = 767;

const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_MAX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

const DashboardLayout = () => {
  const isMobile = useIsMobileViewport();
  if (isMobile) return (
    <BlueprintThemeProvider className="h-screen">
      <MobileBlocker />
    </BlueprintThemeProvider>
  );

  return (
    <BlueprintThemeProvider className="h-screen">
      <TopbarSlotsProvider>
        <div data-surface="os" className="atelier-shell h-screen flex bg-[var(--bp-bg)] overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar />
            <ImpersonationBanner />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <Outlet />
            </main>
            <PlatformFooterBar surface="os" />
          </div>
        </div>
        {/* S.2 — human-first tenant: nudge owners to introduce themselves */}
        <OwnerIntroductionGate />
      </TopbarSlotsProvider>
    </BlueprintThemeProvider>
  );
};

export default DashboardLayout;
