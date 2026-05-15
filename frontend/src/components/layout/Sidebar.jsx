import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import Brand from '../common/Brand';
import useSidebarCollapsed from '../../hooks/useSidebarCollapsed';

/**
 * Sidebar — workspace navigation ONLY.
 *
 * Strict scope (the user-locked information architecture):
 *   - Dashboard · Leads · Projects · Moodboards · Inspirations · Insights · Settings
 *   - NEVER: block insertion, page management, canvas tools, inspector
 *
 * Visual rules:
 *   - Ultra-slim left rail (icon-only by default, like Figma)
 *   - Monogram "M" lives at the very top, doubles as the expand/collapse trigger
 *   - User profile + logout live in the Topbar avatar menu (NOT here)
 *   - Edge collapse handle on the right border for users who prefer that pattern
 *   - Default state: COLLAPSED (icon-only). User can pin it open; choice persists.
 */
const NavItem = ({ to, icon, labelKey, collapsed, end }) => {
  const { t } = useBlueprint();
  const Icon = Icons[icon] || Icons.Square;
  const testid = `sidebar-nav-${labelKey.replace(/\./g, '-')}`;
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={testid}
      title={collapsed ? t(labelKey) : undefined}
      className={({ isActive }) =>
        `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} ${collapsed ? 'px-0 py-2.5' : 'px-2.5 py-1.5'}
         rounded-[7px] relative group transition-colors duration-150 ${
          isActive
            ? 'text-[var(--bp-primary)]'
            : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`absolute left-0 top-1 bottom-1 w-[2px] rounded-full transition-all duration-200 ${isActive ? 'bg-[var(--bp-primary)]' : 'bg-transparent'}`} />
          <Icon size={15} strokeWidth={1.5} />
          {!collapsed && (
            <span className="font-body tracking-[0.005em] truncate text-[12.5px]">{t(labelKey)}</span>
          )}
        </>
      )}
    </NavLink>
  );
};

const SectionLabel = ({ children, collapsed }) => {
  if (collapsed) {
    return <div className="my-2 mx-2 h-px bg-[var(--bp-border)]" aria-hidden="true" />;
  }
  return (
    <p className="px-2.5 mb-2 text-[9px] uppercase tracking-[0.28em] text-[var(--bp-text-faint)] font-body font-medium">
      {children}
    </p>
  );
};

const WorkspaceSelector = ({ collapsed }) => {
  const { tenant } = useBlueprint();
  const tenantName = tenant?.name || tenant?.slug || 'Workspace';
  const monogram = tenantName.charAt(0).toUpperCase();
  if (collapsed) {
    return (
      <div
        data-testid="workspace-selector"
        title={tenantName}
        className="m-2 mb-3 flex items-center justify-center w-9 h-9 rounded-[7px]
                   border border-[var(--bp-border)] bg-[var(--bp-surface-1)]
                   text-[11px] font-mono text-[var(--bp-text-secondary)]"
      >
        {monogram}
      </div>
    );
  }
  return (
    <div
      data-testid="workspace-selector"
      className="mx-2 mb-3 px-2.5 py-2 rounded-[8px] border border-[var(--bp-border)]
                 bg-[var(--bp-surface-1)] flex items-center gap-2.5 transition-colors
                 hover:border-[var(--bp-border-strong)] cursor-pointer"
    >
      <span className="w-7 h-7 rounded-[5px] bg-[var(--bp-surface-2)] flex items-center justify-center text-[11px] font-mono text-[var(--bp-text-secondary)]">
        {monogram}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] text-[var(--bp-text-primary)] font-medium truncate font-body">
          {tenantName}
        </p>
        <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] font-body">
          Workspace
        </p>
      </div>
      <Icons.ChevronsUpDown size={11} className="text-[var(--bp-text-muted)] flex-shrink-0" />
    </div>
  );
};

const Sidebar = () => {
  const { t, modules, isSuperAdmin, can, impersonating } = useBlueprint();
  const { collapsed, toggle } = useSidebarCollapsed();
  const location = useLocation();

  const moduleList = modules?.modules || [];
  const workspaceModules = moduleList.filter((m) => m.id === 'workspace');
  const contentModules = moduleList.filter((m) => ['library', 'moodboards', 'inspirations'].includes(m.id));
  const intelligenceModules = moduleList.filter((m) => m.id === 'insights');

  const wsRoutes = workspaceModules.flatMap((m) => m.routes);
  const contentRoutes = contentModules.flatMap((m) => m.routes);
  const intelligenceRoutes = intelligenceModules.flatMap((m) => m.routes);

  const inAdmin = location.pathname.startsWith('/admin');
  const width = collapsed ? 60 : 212;

  return (
    <aside
      data-testid="sidebar-nav"
      style={{ width }}
      className="relative flex-shrink-0 bg-[var(--bp-bg)] border-r border-[var(--bp-border)]
                 flex flex-col h-full transition-[width] duration-200 ease-out"
    >
      {/* Monogram — pinned at the top, doubles as the expand/collapse trigger.
          A single, silent brand mark. No subtitle, no tagline. */}
      <button
        type="button"
        onClick={toggle}
        data-testid="sidebar-brand-toggle"
        title={collapsed ? t('common.expand', null, 'Espandi') : t('common.collapse', null, 'Riduci')}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-start gap-3 px-4'}
                    pt-5 pb-4 border-b border-[var(--bp-border)] hover:bg-[var(--bp-surface-2)]/30
                    transition-colors group`}
      >
        <Brand variant="monogram" size={collapsed ? 'sm' : 'md'} />
        {!collapsed && (
          <span className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
            <Icons.PanelLeftClose size={13} strokeWidth={1.5} />
          </span>
        )}
        {impersonating && !inAdmin && !collapsed && (
          <span className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-amber-400" aria-label="Impersonating" />
        )}
      </button>

      <nav className={`flex-1 ${collapsed ? 'px-1.5' : 'px-2.5'} py-5 space-y-6 overflow-y-auto overflow-x-hidden`}>
        <div>
          <NavItem to="/dashboard" icon="LayoutDashboard" labelKey="nav.dashboard" end collapsed={collapsed} />
        </div>

        {wsRoutes.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.workspace')}</SectionLabel>
            <div className="space-y-0.5">
              {wsRoutes.map((r) => <NavItem key={r.to} {...r} collapsed={collapsed} />)}
              <NavItem to="/moodboards" icon="Layers" labelKey="nav.moodboards" collapsed={collapsed} />
              <NavItem to="/workspace/calendar" icon="Calendar" labelKey="nav.calendar" collapsed={collapsed} />
            </div>
          </div>
        )}

        {contentRoutes.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.content')}</SectionLabel>
            <div className="space-y-0.5">
              {contentRoutes.filter((r) => r.to !== '/moodboards').map((r) => (
                <NavItem key={r.to} {...r} end={r.to === '/library'} collapsed={collapsed} />
              ))}
              <NavItem to="/library/collections" icon="FolderHeart" labelKey="nav.collections" collapsed={collapsed} />
            </div>
          </div>
        )}

        <div>
          <SectionLabel collapsed={collapsed}>{t('nav.section.collaboration', null, 'Collaborazione')}</SectionLabel>
          <div className="space-y-0.5">
            <NavItem to="/workspace/activity" icon="Activity" labelKey="nav.activity" collapsed={collapsed} />
            <NavItem to="/workspace/team" icon="Users" labelKey="nav.team" collapsed={collapsed} />
            <NavItem to="/workspace/clients" icon="UserCircle" labelKey="nav.clients" collapsed={collapsed} />
            <NavItem to="/workspace/messages" icon="MessageSquare" labelKey="nav.messages" collapsed={collapsed} />
          </div>
        </div>

        {intelligenceRoutes.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.intelligence')}</SectionLabel>
            <div className="space-y-0.5">
              {intelligenceRoutes.map((r) => <NavItem key={r.to} {...r} collapsed={collapsed} />)}
              <NavItem to="/workspace/reports" icon="FileBarChart" labelKey="nav.reports" collapsed={collapsed} />
            </div>
          </div>
        )}

        {can('tenant:settings') && (
          <div>
            <SectionLabel collapsed={collapsed}>{t('nav.section.system')}</SectionLabel>
            <div className="space-y-0.5">
              <NavItem to="/settings" icon="Settings" labelKey="nav.settings" end collapsed={collapsed} />
              <NavItem to="/settings/plan" icon="Receipt" labelKey="nav.billing" collapsed={collapsed} />
              <NavItem to="/settings/integrations" icon="Plug" labelKey="nav.integrations" collapsed={collapsed} />
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

      {/* Workspace selector — pinned at the bottom. Shows the current tenant
          and acts as a future entry point for tenant switching / workspace
          management. */}
      <WorkspaceSelector collapsed={collapsed} />


      {/* Edge collapse handle — pinned to the right border. Generous 16px
          hit area, subtle 2px rail that brightens on hover. NOT hover-expand:
          users must click to toggle. State is persisted. */}
      <button
        type="button"
        onClick={toggle}
        data-testid="sidebar-collapse-toggle"
        title={collapsed ? t('common.expand', null, 'Espandi') : t('common.collapse', null, 'Riduci')}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="group absolute top-0 right-[-8px] h-full w-4 flex items-center justify-center
                   cursor-col-resize z-30"
      >
        <span
          aria-hidden="true"
          className="block w-[2px] h-12 rounded-full bg-[var(--bp-border)]
                     group-hover:bg-[var(--bp-primary)] group-hover:h-20
                     transition-all duration-200"
        />
        <span
          aria-hidden="true"
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200
                     flex items-center justify-center w-5 h-5 rounded-full
                     bg-[var(--bp-bg)] border border-[var(--bp-border-strong)] shadow-[var(--bp-shadow-sm)]"
        >
          {collapsed
            ? <Icons.ChevronRight size={11} strokeWidth={2} className="text-[var(--bp-text-primary)]" />
            : <Icons.ChevronLeft  size={11} strokeWidth={2} className="text-[var(--bp-text-primary)]" />}
        </span>
      </button>
    </aside>
  );
};

export default Sidebar;
