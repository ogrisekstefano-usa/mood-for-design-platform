import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ImpersonationBanner from '../common/ImpersonationBanner';

const DashboardLayout = () => (
  <div className="h-screen flex bg-[#0A0A0B] overflow-hidden">
    <Sidebar />
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Topbar />
      <ImpersonationBanner />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  </div>
);

export default DashboardLayout;
