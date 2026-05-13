import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import Brand from '../common/Brand';
import useSidebarCollapsed from '../../hooks/useSidebarCollapsed';

/**
 * Dynamic sidebar — composed from:
 * - Always: Dashboard
 * - For each enabled module: its routes (filtered by permission)
 * - Settings (if user has tenant:settings)
 * - Super Admin entry (if super_admin)
 *
 * Collapsible: persists via `useSidebarCollapsed`. When collapsed the
 * sidebar shrinks to 64px and renders icon-only navigation. The user
 * profile chip moved entirely to the Topbar — no more duplicate.
 */
const NavItem = ({ to, icon, labelKey, collapsed }) => {
  const { t } = useBlueprint();
  const Icon = Icons[icon] || Icons.Square;
  const testid = `sidebar-nav-${labelKey.replace(/\./g, '-')}`;
  return (
    <NavLink
      to={to}
      data-testid={testid}
      title={collapsed ? t(labelKey) : undefined}
      className={({ isActive }) =>
        `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm rounded-[3px] relative group transition-all duration-150 ${
          isActive
            ? 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'
            : 'text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/40'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full transition-all ${isActive ? 'bg-[var(--bp-primary)]' : 'bg-transparent'}`} />
          <Icon size={15} strokeWidth={1.5} />
          {!collapsed && (
            <span className="font-body font-medium tracking-wide truncate">{t(labelKey)}</span>
          )}
        </>
      )}
    </NavLink>
  );
};

const SectionLabel = ({ children, collapsed }) => {
  if (collapsed) {
    // Use a thin horizontal divider instead of a label when collapsed.
    return (
      <div className="my-2 mx-3 h-px bg-[var(--bp-border)]" aria-hidden="true" />
    );
  }
  return (
    <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
      {children}
    </p>
  );
};

const Sidebar = () => {
  const { user, signOut } = useAuth();
  const { t, modules, isSuperAdmin, can, impersonating } = useBlueprint();
  const { collapsed, toggle } = useSidebarCollapsed();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/login');
  };

  // Group modules by section keys
  const moduleList = modules?.modules || [];
  const workspaceModules = moduleList.filter((m) => m.id === 'workspace');
  const contentModules = moduleList.filter((m) => ['moodboards', 'inspirations'].includes(m.id));
  const intelligenceModules = moduleList.filter((m) => m.id === 'insights');

  const wsRoutes = workspaceModules.flatMap((m) => m.routes);
  const contentRoutes = contentModules.flatMap((m) => m.routes);
  const intelligenceRoutes = intelligenceModules.flatMap((m) => m.routes);

  const inAdmin = location.pathname.startsWith('/admin');
  const width = collapsed ? 64 : 220;

  return (
    <aside
      data-testid="sidebar-nav"
      style={{ width }}
      className="flex-shrink-0 bg-[var(--bp-bg)] border-r border-[var(--bp-border)] flex flex-col h-full transition-[width] duration-200 ease-out"
    >
      <div className={`${collapsed ? 'px-2' : 'px-4'} pt-5 pb-4 border-b border-[var(--bp-border)]`}>
        <Brand size="sm" collapsed={collapsed} />
        {impersonating && !inAdmin && !collapsed && (
          <div className="mt-3 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-[3px]">
            <p className="text-amber-400 text-[9px] font-body uppercase tracking-wider">Impersonating</p>
          </div>
        )}
      </div>

      <nav className={`flex-1 ${collapsed ? 'px-1.5' : 'px-2'} py-4 space-y-5 overflow-y-auto overflow-x-hidden`}>
        <div>
          <NavItem to="/dashboard" icon="LayoutDashboard" labelKey="nav.dashboard" collapsed={collapsed} />
        </div>

        {wsRoutes.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.workspace')}</SectionLabel>
            <div className="space-y-0.5">
              {wsRoutes.map((r) => <NavItem key={r.to} {...r} collapsed={collapsed} />)}
            </div>
          </div>
        )}

        {contentRoutes.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.content')}</SectionLabel>
            <div className="space-y-0.5">
              {contentRoutes.map((r) => <NavItem key={r.to} {...r} collapsed={collapsed} />)}
            </div>
          </div>
        )}

        {intelligenceRoutes.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.intelligence')}</SectionLabel>
            <div className="space-y-0.5">
              {intelligenceRoutes.map((r) => <NavItem key={r.to} {...r} collapsed={collapsed} />)}
            </div>
          </div>
        )}

        {can('tenant:settings') && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.system')}</SectionLabel>
            <div className="space-y-0.5">
              <NavItem to="/settings" icon="Settings" labelKey="nav.settings" collapsed={collapsed} />
            </div>
          </div>
        )}

        {isSuperAdmin && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.platform', null, 'Platform')}</SectionLabel>
            <div className="space-y-0.5">
              <NavItem to="/admin" icon="Shield" labelKey="nav.superAdmin" collapsed={collapsed} />
            </div>
          </div>
        )}
      </nav>

      {/* Bottom utility row — collapse toggle + logout. The user profile
          chip now lives ONLY in the Topbar (no more duplicate). */}
      <div className="border-t border-[var(--bp-border)] py-2 flex items-center justify-between"
           style={{ paddingInline: collapsed ? 8 : 12 }}>
        <button
          type="button"
          onClick={toggle}
          data-testid="sidebar-collapse-toggle"
          title={collapsed ? t('common.expand', null, 'Espandi') : t('common.collapse', null, 'Riduci')}
          className="p-2 rounded-[3px] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/40 transition-colors"
        >
          {collapsed
            ? <Icons.PanelLeftOpen size={14} strokeWidth={1.5} />
            : <Icons.PanelLeftClose size={14} strokeWidth={1.5} />}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          data-testid="sidebar-logout-btn"
          title={t('nav.logout', null, 'Esci')}
          aria-label={t('nav.logout', null, 'Esci')}
          className="p-2 rounded-[3px] text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] hover:bg-[var(--bp-surface-2)]/40 transition-colors"
        >
          <Icons.LogOut size={14} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
