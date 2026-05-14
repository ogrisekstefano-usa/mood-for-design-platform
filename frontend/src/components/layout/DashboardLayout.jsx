import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar, { TopbarSlotsProvider } from './Topbar';
import ImpersonationBanner from '../common/ImpersonationBanner';

const DashboardLayout = () => (
  <TopbarSlotsProvider>
    <div className="h-screen flex bg-[var(--bp-bg)] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <ImpersonationBanner />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  </TopbarSlotsProvider>
);

export default DashboardLayout;
