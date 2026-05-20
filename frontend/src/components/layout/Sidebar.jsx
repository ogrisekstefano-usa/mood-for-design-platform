/**
 * Sidebar — MOOD for DESIGN™ · Architecture v5 (Sprint G.5).
 *
 * Sidebar Journey-first. NON è più un menu di moduli.
 * È la manifestazione visiva del Design Journey OS™:
 *
 *   01 · HOME                — Studio Pulse™ (ritmo progettuale)
 *   02 · DESIGN JOURNEY™     — i Journey vivi + rail attivo + Inizia
 *   03 · CURATORIAL ATLAS    — archivio culturale globale
 *   04 · CLIENT RELATIONS    — Accounts + Voci aperte + Memoria
 *   05 · CONTENT STUDIO      — publishing (solo admin)
 *   06 · STUDIO OS           — Team, Brand Studio, governance
 *   ⛨   · PLATFORM           — super-admin (impersonation, audit)
 *
 * Rimossi dal root (vivono SOLO via Journey → Step → Artifact):
 * Moodboards, Render, Hotspots, Site Evolution, Documents.
 *
 * Regola ™: usato SOLO su brand identitari rari (Design Journey™,
 * Studio Pulse™, Cultural Editions™, Brand Mode™, Material View™).
 *
 * Active Journey Rail: live list dei viaggi vivi con glow lifecycle.
 *
 * Sezioni collapsible — stato persistente per utente in localStorage.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import Brand from '../common/Brand';
import useSidebarCollapsed from '../../hooks/useSidebarCollapsed';
import ActiveJourneyRail from './ActiveJourneyRail';

// ── Section collapse persistence ─────────────────────────────────
const SECTION_STORAGE_KEY = 'mood.sidebar.sections.v4';
const useSectionCollapse = () => {
  const [state, setState] = useState(() => {
    try {
      const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const toggle = useCallback((key) => {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const isCollapsed = useCallback((key) => Boolean(state[key]), [state]);
  return { isCollapsed, toggle };
};

// ── NavItem ──────────────────────────────────────────────────────
const NavItem = ({ to, icon, label, collapsed, end, testid, soon = false, hasMark = false }) => {
  const Icon = Icons[icon] || Icons.Circle;
  const tid = testid || `sidebar-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={tid}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={({ isActive }) => `
        relative flex items-center
        ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2'}
        rounded-[4px] group
        transition-colors duration-200 ease-out
        ${isActive
          ? 'text-[var(--bp-text-primary)] bg-[rgba(217,178,133,0.05)]'
          : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[rgba(255,255,255,0.018)]'}
      `}
    >
      {({ isActive }) => (
        <>
          {/* Left accent — architectural gold, NO SaaS blue. Hard-coded
              because --bp-primary is bound to teal at the theme root. */}
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition-all duration-300 ${
              isActive ? 'opacity-90' : 'opacity-0'
            }`}
            style={isActive ? {
              backgroundColor: '#d9b285',
              boxShadow: '0 0 6px rgba(217,178,133,0.45)',
            } : undefined}
          />
          <Icon size={14} strokeWidth={1.4} className={isActive ? 'opacity-95' : 'opacity-70 group-hover:opacity-95'} />
          {!collapsed && (
            <span
              className={`flex-1 truncate text-[12.5px] tracking-[0.005em] ${
                isActive ? 'font-medium' : 'font-normal'
              }`}
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              {label}
              {hasMark && (
                <span className="ml-0.5" style={{ color: '#d9b285' }}>™</span>
              )}
            </span>
          )}
          {!collapsed && soon && (
            <span
              className="text-[8.5px] tracking-[0.18em] uppercase font-mono opacity-60"
              style={{ color: 'var(--bp-text-faint,#6e6e6a)' }}
            >
              presto
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};

// ── Section ──────────────────────────────────────────────────────
const Section = ({ id, label, hasMark, collapsed, sectionCollapsed, onToggle, children }) => {
  if (collapsed) {
    return (
      <div className="my-3" data-testid={`sidebar-section-${id}`}>
        <div className="mx-2 h-px bg-[var(--bp-border)] opacity-50" aria-hidden="true" />
        <div className="mt-2 space-y-0.5">{children}</div>
      </div>
    );
  }
  const open = !sectionCollapsed;
  return (
    <div data-testid={`sidebar-section-${id}`}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        data-testid={`sidebar-section-toggle-${id}`}
        className="w-full flex items-center justify-between px-3 mb-2 group hover:opacity-100 opacity-90 transition-opacity"
      >
        <span
          className="text-[9px] uppercase tracking-[0.30em] font-mono"
          style={{ color: 'var(--bp-text-faint,#6e6e6a)' }}
        >
          {label}
          {hasMark && (
            <span className="ml-0.5" style={{ color: '#d9b285' }}>™</span>
          )}
        </span>
        <Icons.ChevronDown
          size={10}
          strokeWidth={1.6}
          className={`transition-transform duration-300 ease-out ${open ? '' : '-rotate-90'}`}
          style={{ color: 'var(--bp-text-faint,#6e6e6a)' }}
        />
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
};

// ── Workspace selector ───────────────────────────────────────────
const WorkspaceSelector = ({ collapsed }) => {
  const { tenant } = useBlueprint();
  const tenantName = tenant?.name || tenant?.slug || 'Workspace';
  const monogram = tenantName.charAt(0).toUpperCase();
  if (collapsed) {
    return (
      <div
        data-testid="workspace-selector"
        title={tenantName}
        className="m-2 mb-3 flex items-center justify-center w-9 h-9 rounded-[5px]
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
      className="mx-2 mb-3 px-3 py-2.5 rounded-[5px] border border-[var(--bp-border)]
                 bg-[var(--bp-surface-1)] flex items-center gap-3"
    >
      <span className="w-7 h-7 rounded-[4px] bg-[var(--bp-surface-2)] flex items-center justify-center text-[11px] font-mono text-[var(--bp-text-secondary)]">
        {monogram}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] text-[var(--bp-text-primary)] font-medium truncate"
           style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
          {tenantName}
        </p>
        <p className="text-[8.5px] uppercase tracking-[0.22em] font-mono"
           style={{ color: 'var(--bp-text-faint,#6e6e6a)' }}>
          Workspace
        </p>
      </div>
    </div>
  );
};

// ── Main Sidebar ─────────────────────────────────────────────────
const Sidebar = () => {
  const { isSuperAdmin, can, impersonating } = useBlueprint();
  const { collapsed, toggle } = useSidebarCollapsed();
  const { isCollapsed: sectionIsCollapsed, toggle: toggleSection } = useSectionCollapse();
  const location = useLocation();
  const inAdmin = location.pathname.startsWith('/admin');
  const width = collapsed ? 60 : 232;

  const isAdmin = can('tenant:settings');

  const sectionProps = useMemo(() => ({
    collapsed,
    onToggle: toggleSection,
  }), [collapsed, toggleSection]);

  return (
    <aside
      data-testid="sidebar-nav"
      style={{ width }}
      className="relative flex-shrink-0 bg-[var(--bp-bg)] border-r border-[var(--bp-border)]
                 flex flex-col h-full transition-[width] duration-300 ease-out"
    >
      {/* Brand monogram — silent, doubles as collapse toggle */}
      <button
        type="button"
        onClick={toggle}
        data-testid="sidebar-brand-toggle"
        title={collapsed ? 'Espandi' : 'Riduci'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-start gap-3 px-5'}
                    pt-5 pb-4 border-b border-[var(--bp-border)]
                    hover:bg-[var(--bp-surface-2)]/30 transition-colors group`}
      >
        <Brand variant="monogram" size={collapsed ? 'sm' : 'md'} />
        {!collapsed && (
          <span className="text-[10px] tracking-[0.28em] uppercase font-mono opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                style={{ color: 'var(--bp-text-muted)' }}>
            <Icons.PanelLeftClose size={13} strokeWidth={1.5} />
          </span>
        )}
        {impersonating && !inAdmin && !collapsed && (
          <span className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-amber-400" aria-label="Impersonating" />
        )}
      </button>

      <nav className={`flex-1 ${collapsed ? 'px-1.5' : 'px-3'} py-6 space-y-7 overflow-y-auto overflow-x-hidden`}>

        {/* ── 01 · HOME ─────────────────────────────────────── */}
        <Section id="home" label="Home" {...sectionProps} sectionCollapsed={sectionIsCollapsed('home')}>
          <NavItem to="/dashboard"          icon="Waves"           label="Studio Pulse" hasMark end collapsed={collapsed} />
        </Section>

        {/* ── 02 · DESIGN JOURNEY™ (dominante) ──────────────── */}
        <Section id="design-journey" label="Design Journey" hasMark {...sectionProps} sectionCollapsed={sectionIsCollapsed('design-journey')}>
          <NavItem to="/workspace/projects"    icon="Compass"      label="I tuoi Journey"      collapsed={collapsed} />
          <NavItem to="/begin-journey"          icon="Sparkles"    label="Inizia un Journey"   collapsed={collapsed} hasMark />
          {!collapsed && <ActiveJourneyRail collapsed={collapsed} />}
        </Section>

        {/* ── 03 · CURATORIAL ATLAS ─────────────────────────── */}
        <Section id="curatorial-atlas" label="Curatorial Atlas" {...sectionProps} sectionCollapsed={sectionIsCollapsed('curatorial-atlas')}>
          <NavItem to="/inspirations"               icon="Bookmark"   label="Inspirations"      collapsed={collapsed} end />
          <NavItem to="/inspirations/brands"        icon="Sparkles"   label="Brand Mode"        collapsed={collapsed} hasMark />
          <NavItem to="/inspirations/materials"     icon="Palette"    label="Material View"     collapsed={collapsed} hasMark
                   testid="sidebar-nav-material-view" />
          <NavItem to="/library"                    icon="FolderOpen" label="Media Library"     collapsed={collapsed} />
          <NavItem to="/workspace/cultural-editions" icon="Globe"     label="Cultural Editions" hasMark collapsed={collapsed} />
        </Section>

        {/* ── 04 · CLIENT RELATIONS ─────────────────────────── */}
        <Section id="client-relations" label="Client Relations" {...sectionProps} sectionCollapsed={sectionIsCollapsed('client-relations')}>
          <NavItem to="/crm/accounts"          icon="Users"      label="Accounts"      collapsed={collapsed} />
          <NavItem to="/crm/follow-ups"        icon="BellRing"   label="Voci aperte"   collapsed={collapsed} />
          <NavItem to="/crm/archived"          icon="Archive"    label="Memoria"       collapsed={collapsed} />
        </Section>

        {/* ── 05 · CONTENT STUDIO ───────────────────────────── */}
        {isAdmin && (
          <Section id="content-studio" label="Content Studio" {...sectionProps} sectionCollapsed={sectionIsCollapsed('content-studio')}>
            <NavItem to="/blueprint/editorial-calendar" icon="CalendarDays" label="Editorial Calendar" collapsed={collapsed} />
            <NavItem to="/blueprint/editorial"          icon="BookOpen"     label="Magazine"           collapsed={collapsed} />
            <NavItem to="/blueprint/projects-studio"    icon="Quote"        label="Design Stories"     collapsed={collapsed} />
            <NavItem to="/editorial/inbox"              icon="Inbox"        label="Publishing Queue"   collapsed={collapsed} />
            <NavItem to="/blueprint/markets"            icon="Globe2"       label="Market Matrix"      collapsed={collapsed} />
            <NavItem to="/blueprint/experience"         icon="LayoutTemplate" label="Web Presence"     collapsed={collapsed} />
          </Section>
        )}

        {/* ── 06 · STUDIO OS ────────────────────────────────── */}
        <Section id="studio-os" label="Studio OS" {...sectionProps} sectionCollapsed={sectionIsCollapsed('studio-os')}>
          <NavItem to="/settings/members"  icon="Users"   label="Team"          collapsed={collapsed} />
          <NavItem to="/insights"          icon="LineChart" label="Insights"    collapsed={collapsed} />
          {isAdmin && (
            <>
              <NavItem to="/settings/brand"             icon="Palette" label="Brand Studio"      collapsed={collapsed} />
              <NavItem to="/blueprint/forms-journeys"   icon="Sparkle" label="Forms & Journeys"  collapsed={collapsed} />
              <NavItem to="/settings/integrations"      icon="Plug"    label="Integrations"      collapsed={collapsed} />
              <NavItem to="/settings/plan"              icon="Receipt" label="Billing"           collapsed={collapsed} />
              <NavItem to="/settings"                   icon="Settings" label="Settings"  end    collapsed={collapsed} />
            </>
          )}
        </Section>

        {/* ── PLATFORM (super-admin only) ───────────────────── */}
        {isSuperAdmin && (
          <Section id="platform" label="Platform" {...sectionProps} sectionCollapsed={sectionIsCollapsed('platform')}>
            <NavItem to="/admin" icon="Shield" label="Super Admin" collapsed={collapsed} />
          </Section>
        )}
      </nav>

      <WorkspaceSelector collapsed={collapsed} />

      {/* Edge collapse handle */}
      <button
        type="button"
        onClick={toggle}
        data-testid="sidebar-collapse-toggle"
        title={collapsed ? 'Espandi' : 'Riduci'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="group absolute top-0 right-[-8px] h-full w-4 flex items-center justify-center
                   cursor-col-resize z-30"
      >
        <span
          aria-hidden="true"
          className="block w-[2px] h-12 rounded-full bg-[var(--bp-border)]
                     group-hover:bg-[var(--bp-primary)] group-hover:h-20
                     transition-all duration-300"
        />
        <span
          aria-hidden="true"
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300
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
