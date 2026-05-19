/**
 * AdminLayout — separate control-center experience for super_admin.
 * Premium dark, Linear/Vercel/Raycast inspired.
 */
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Shield, Building2, ToggleRight, Activity, ScrollText, ArrowLeft, LogOut, Languages, Layers, Handshake } from 'lucide-react';
import BlueprintThemeProvider from '../../design-system/os/BlueprintThemeProvider';
import PlatformFooterBar from '../common/PlatformFooterBar';

const AdminNavItem = ({ to, icon: Icon, labelKey, fallback, end }) => {
  const { t } = useBlueprint();
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={`admin-nav-${labelKey.replace(/\./g, '-')}`}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 text-sm rounded-[3px] transition-all ${
          isActive
            ? 'bg-white/[0.05] text-[#EFEBE4]'
            : 'text-[#6B6863] hover:text-[#A19D98] hover:bg-white/[0.03]'
        }`
      }
    >
      <Icon size={14} strokeWidth={1.5} />
      <span className="font-body font-medium tracking-wide">{t(labelKey, null, fallback)}</span>
    </NavLink>
  );
};

const AdminLayout = () => {
  const { user, signOut } = useAuth();
  const { t } = useBlueprint();
  const navigate = useNavigate();

  return (
    <BlueprintThemeProvider className="h-screen">
    <div className="h-screen flex bg-[#08080A] text-[#EFEBE4]">
      <aside data-testid="admin-sidebar" className="w-[240px] flex-shrink-0 bg-[#0A0A0B] border-r border-white/[0.05] flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-amber-300 to-amber-500 rounded-[3px] flex items-center justify-center">
              <Shield size={14} className="text-[#0A0A0B]" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[#EFEBE4] text-[11px] font-semibold font-body tracking-[0.1em] uppercase">Blueprint OS</p>
              <p className="text-amber-400/70 text-[9px] font-body tracking-[0.2em] uppercase">Control Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          <AdminNavItem to="/admin" end icon={Activity} labelKey="admin.nav.overview" fallback="Panoramica" />
          <AdminNavItem to="/admin/tenants" icon={Building2} labelKey="admin.nav.tenants" fallback="Studi" />
          <AdminNavItem to="/admin/advisors" icon={Handshake} labelKey="admin.nav.advisors" fallback="Advisor Network" />
          <AdminNavItem to="/admin/modules" icon={ToggleRight} labelKey="admin.nav.modules" fallback="Moduli" />
          <AdminNavItem to="/admin/languages" icon={Languages} labelKey="admin.nav.languages" fallback="Lingue" />
          <AdminNavItem to="/admin/pages" icon={Layers} labelKey="admin.nav.pages" fallback="Pagine" />
          <AdminNavItem to="/admin/audit" icon={ScrollText} labelKey="admin.nav.audit" fallback="Audit log" />
        </nav>

        <div className="border-t border-white/[0.05] p-3 space-y-2">
          <button onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#6B6863] hover:text-[#A19D98] hover:bg-white/[0.03] rounded-[3px] transition-colors">
            <ArrowLeft size={12} strokeWidth={1.5} /> {t('admin.exit', null, 'Exit to workspace')}
          </button>
          <button onClick={async () => { await signOut(); navigate('/auth/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#6B6863] hover:text-red-400 hover:bg-white/[0.03] rounded-[3px] transition-colors">
            <LogOut size={12} strokeWidth={1.5} /> {t('common.logout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-13 flex items-center justify-between px-6 border-b border-white/[0.05] bg-[#08080A]/80 backdrop-blur-xl flex-shrink-0" style={{ height: '52px' }}>
          <div className="flex items-center gap-2">
            <span className="text-amber-400/80 text-[10px] font-body uppercase tracking-[0.2em] font-semibold">Super Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#A19D98] text-xs font-body">{user?.email}</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <PlatformFooterBar surface="os" />
      </div>
    </div>
    </BlueprintThemeProvider>
  );
};

export default AdminLayout;
