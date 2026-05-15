import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar, { TopbarSlotsProvider } from './Topbar';
import ImpersonationBanner from '../common/ImpersonationBanner';
import PlatformFooterBar from '../common/PlatformFooterBar';
import BlueprintThemeProvider from '../../design-system/os/BlueprintThemeProvider';
import OwnerIntroductionGate from '../onboarding/OwnerIntroductionGate';

/**
 * DashboardLayout — Blueprint OS shell.
 *
 * CRITICAL: wrapped in BlueprintThemeProvider so the entire OS subtree
 * carries `data-surface="os"`. Tenant theme variables emitted by
 * TenantThemeContext are scoped to `[data-surface="storefront"]` and
 * therefore cannot leak into this surface — by design.
 */
const DashboardLayout = () => (
  <BlueprintThemeProvider className="h-screen">
    <TopbarSlotsProvider>
      <div className="h-screen flex bg-[var(--bp-bg)] overflow-hidden">
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

export default DashboardLayout;
