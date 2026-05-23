/**
 * Sidebar — Atelier Nordic™ · Architectural Navigation Rail (ITER138 · Wave A)
 *
 * Reference: master visual governance image — left rail with brand mark
 * at top, sectioned navigation in tracking-wide caps, cyan-glow active
 * state, no SaaS sidebar feeling. All visual decisions inherit from
 * `/design-system/atelier/*.css`. No hardcoded colors.
 *
 * Preserves React behavior of the previous Sidebar: collapse, sections
 * persistence, NavLink active matching, super-admin gating, journey rail.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import useSidebarCollapsed from '../../hooks/useSidebarCollapsed';
import ActiveJourneyRail from './ActiveJourneyRail';

const SECTION_STORAGE_KEY = 'mood.sidebar.sections.v5';
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

// ── NavItem (Atelier Nordic) ─────────────────────────────────────
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
      className={({ isActive }) =>
        `atelier-nav-item ${isActive ? 'atelier-nav-item--active' : ''} ${collapsed ? 'atelier-nav-item--collapsed' : ''}`
      }
      style={collapsed ? { justifyContent: 'center', padding: '10px 0' } : undefined}
    >
      <Icon size={15} strokeWidth={1.5} className="atelier-nav-item__icon" />
      {!collapsed && (
        <span className="atelier-nav-item__label">
          {label}
          {hasMark && <span className="atelier-nav-item__mark">™</span>}
        </span>
      )}
      {!collapsed && soon && (
        <span
          style={{
            fontFamily: 'var(--atelier-mono)',
            fontSize: 8.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--bp-text-faint)',
            opacity: 0.7,
          }}
        >
          soon
        </span>
      )}
    </NavLink>
  );
};

// ── Section ──────────────────────────────────────────────────────
const Section = ({ id, label, collapsed, sectionCollapsed, onToggle, children, hasMark }) => {
  if (collapsed) {
    return (
      <div data-testid={`sidebar-section-${id}`} style={{ marginBottom: 14 }}>
        <hr className="atelier-divider" style={{ margin: '6px 12px 10px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
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
        className="atelier-rail__section-label"
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '0 12px',
          marginBottom: 12,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          {label}
          {hasMark && <span style={{ color: 'var(--atelier-cyan)', marginLeft: 4 }}>™</span>}
        </span>
        <Icons.ChevronDown
          size={10}
          strokeWidth={1.6}
          style={{
            transition: 'transform var(--bp-dur-base) var(--bp-ease-cinema)',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            color: 'var(--bp-text-faint)',
          }}
        />
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>}
    </div>
  );
};

// ── Workspace pill (bottom-left) ─────────────────────────────────
const WorkspacePill = ({ collapsed }) => {
  const { tenant, t } = useBlueprint();
  const tenantName = tenant?.name || tenant?.slug || 'Workspace';
  const monogram = tenantName.charAt(0).toUpperCase();
  if (collapsed) {
    return (
      <div
        data-testid="workspace-selector"
        title={tenantName}
        style={{
          margin: '8px 10px 16px',
          width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--bp-border)',
          borderRadius: 'var(--bp-radius-sm)',
          background: 'var(--bp-surface-1)',
          fontFamily: 'var(--atelier-serif)',
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--bp-text-headline)',
        }}
      >
        {monogram}
      </div>
    );
  }
  return (
    <div
      data-testid="workspace-selector"
      style={{
        margin: '8px 14px 18px',
        padding: '12px 14px',
        border: '1px solid var(--bp-border)',
        borderRadius: 'var(--bp-radius-md)',
        background: 'var(--bp-surface-1)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{
        width: 32, height: 32,
        borderRadius: 'var(--bp-radius-sm)',
        background: 'var(--bp-surface-2)',
        border: '1px solid var(--bp-border-strong)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
        fontSize: 14, color: 'var(--bp-text-headline)',
        flexShrink: 0,
      }}>
        {monogram}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
          fontWeight: 500, fontSize: 14,
          color: 'var(--bp-text-headline)',
          margin: 0, lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {tenantName}
        </p>
        <p className="atelier-section-label" style={{ marginTop: 4, padding: 0 }}>
          {t('common.workspace', null, 'Workspace')}
        </p>
      </div>
    </div>
  );
};

// ── Brand mark (top of rail) ─────────────────────────────────────
const RailBrand = ({ collapsed, onToggle, impersonating }) => (
  <button
    type="button"
    onClick={onToggle}
    data-testid="sidebar-brand-toggle"
    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    style={{
      width: '100%',
      background: 'transparent',
      border: 'none',
      borderBottom: '1px solid var(--bp-border-soft)',
      cursor: 'pointer',
      padding: collapsed ? '24px 0 20px' : '28px 24px 22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'flex-start',
      gap: 12,
      position: 'relative',
    }}
  >
    <span className="atelier-rail__brand-mark">
      <span style={{
        fontFamily: 'var(--atelier-serif)',
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: 18,
        color: 'var(--bp-text-headline)',
        lineHeight: 1,
      }}>M</span>
    </span>
    {!collapsed && (
      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
        <span className="atelier-rail__brand-name">MOOD <em>for</em> DESIGN</span>
        <span className="atelier-rail__brand-meta">BLUEPRINT ATELIER™</span>
      </div>
    )}
    {impersonating && !collapsed && (
      <span
        style={{
          position: 'absolute', right: 16, top: 16,
          width: 6, height: 6, borderRadius: 999,
          background: 'var(--atelier-cyan)',
          boxShadow: 'var(--atelier-glow-cyan-sm)',
        }}
        aria-label="Impersonating"
      />
    )}
  </button>
);

// ── Main Sidebar ─────────────────────────────────────────────────
const Sidebar = () => {
  const { isSuperAdmin, can, impersonating, t } = useBlueprint();
  const { collapsed, toggle } = useSidebarCollapsed();
  const { isCollapsed: sectionIsCollapsed, toggle: toggleSection } = useSectionCollapse();
  const location = useLocation();
  const inAdmin = location.pathname.startsWith('/admin');
  const width = collapsed ? 68 : 270;
  const isAdmin = can('tenant:settings');

  const sectionProps = useMemo(() => ({
    collapsed,
    onToggle: toggleSection,
  }), [collapsed, toggleSection]);

  return (
    <aside
      data-testid="sidebar-nav"
      style={{ width, flexShrink: 0, transition: 'width 300ms var(--bp-ease-cinema)' }}
      className="atelier-rail"
    >
      <RailBrand collapsed={collapsed} onToggle={toggle} impersonating={impersonating && !inAdmin} />

      <nav className="atelier-rail__sections">

        <Section id="studio-pulse" label={t('nav.section.studio_pulse', null, 'Studio Pulse')} hasMark {...sectionProps} sectionCollapsed={sectionIsCollapsed('studio-pulse')}>
          <NavItem to="/dashboard" icon="LayoutDashboard" label={t('nav.dashboard', null, 'Dashboard')} end collapsed={collapsed} />
        </Section>

        <Section id="design-journey" label={t('nav.section.design_journey', null, 'Design Journey')} hasMark {...sectionProps} sectionCollapsed={sectionIsCollapsed('design-journey')}>
          <NavItem to="/workspace/projects" icon="Compass" label={t('nav.your_journeys', null, 'All Journeys')} collapsed={collapsed} />
          <NavItem to="/begin-journey" icon="Sparkles" label={t('nav.begin_journey', null, 'Start a Journey')} collapsed={collapsed} hasMark />
          {!collapsed && <ActiveJourneyRail collapsed={collapsed} />}
        </Section>

        <Section id="curatorial-atlas" label={t('nav.section.curatorial_atlas', null, 'Curatorial Atlas')} {...sectionProps} sectionCollapsed={sectionIsCollapsed('curatorial-atlas')}>
          <NavItem to="/inspirations" icon="Bookmark" label={t('nav.inspirations', null, 'Inspirations')} collapsed={collapsed} end />
          <NavItem to="/inspirations/brands" icon="Sparkles" label={t('nav.brand_atlas', null, 'Brand Atlas')} collapsed={collapsed} hasMark testid="sidebar-nav-brand-atlas" />
          <NavItem to="/inspirations/materials" icon="Palette" label={t('nav.material_view', null, 'Material View')} collapsed={collapsed} hasMark testid="sidebar-nav-material-view" />
          <NavItem to="/library" icon="FolderOpen" label={t('nav.media_library', null, 'Media Library')} collapsed={collapsed} />
          <NavItem to="/workspace/cultural-editions" icon="Globe" label={t('nav.cultural_editions', null, 'Cultural Editions')} hasMark collapsed={collapsed} />
        </Section>

        <Section id="client-relations" label={t('nav.section.client_relations', null, 'Client Relations')} {...sectionProps} sectionCollapsed={sectionIsCollapsed('client-relations')}>
          <NavItem to="/crm/accounts" icon="Users" label={t('nav.accounts', null, 'Accounts')} collapsed={collapsed} />
          <NavItem to="/crm/follow-ups" icon="BellRing" label={t('nav.open_voices', null, 'Voice Log')} collapsed={collapsed} />
          <NavItem to="/crm/archived" icon="Archive" label={t('nav.memory', null, 'Memory')} collapsed={collapsed} />
        </Section>

        {isAdmin && (
          <Section id="content-studio" label={t('nav.section.content_studio', null, 'Content Studio')} {...sectionProps} sectionCollapsed={sectionIsCollapsed('content-studio')}>
            <NavItem to="/blueprint/editorial-calendar" icon="CalendarDays" label={t('nav.editorial_calendar', null, 'Editorial Calendar')} collapsed={collapsed} />
            <NavItem to="/blueprint/editorial" icon="BookOpen" label={t('nav.magazine', null, 'Magazine')} collapsed={collapsed} />
            <NavItem to="/blueprint/projects-studio" icon="Quote" label={t('nav.design_stories', null, 'Design Stories')} collapsed={collapsed} />
            <NavItem to="/editorial/inbox" icon="Inbox" label={t('nav.publishing_queue', null, 'Publishing Queue')} collapsed={collapsed} />
            <NavItem to="/blueprint/markets" icon="Globe2" label={t('nav.market_matrix', null, 'Market Matrix')} collapsed={collapsed} />
            <NavItem to="/blueprint/experience" icon="LayoutTemplate" label={t('nav.web_presence', null, 'Web Presence')} collapsed={collapsed} />
          </Section>
        )}

        <Section id="studio-os" label={t('nav.section.studio_os', null, 'Studio OS')} {...sectionProps} sectionCollapsed={sectionIsCollapsed('studio-os')}>
          <NavItem to="/settings/members" icon="Users" label={t('nav.team', null, 'Team')} collapsed={collapsed} />
          <NavItem to="/insights" icon="LineChart" label={t('nav.insights', null, 'Insights')} collapsed={collapsed} />
          {isAdmin && (
            <>
              <NavItem to="/settings/brand" icon="Palette" label={t('nav.studio_identity', null, 'Studio Identity')} collapsed={collapsed} testid="sidebar-nav-studio-identity" hasMark />
              <NavItem to="/blueprint/forms-journeys" icon="Sparkle" label={t('nav.forms_journeys', null, 'Forms & Journeys')} collapsed={collapsed} />
              <NavItem to="/blueprint/studio-voice" icon="Mic2" label={t('nav.studio_voice', null, 'Studio Voice')} collapsed={collapsed} testid="sidebar-nav-studio-voice" />
              <NavItem to="/admin/language/heatmap" icon="Languages" label={t('nav.language_command_center', null, 'Language Command Center')} collapsed={collapsed} testid="sidebar-nav-language-cc" />
              <NavItem to="/settings/integrations" icon="Plug" label={t('nav.integrations', null, 'Integrations')} collapsed={collapsed} />
              <NavItem to="/settings/plan" icon="Receipt" label={t('nav.billing', null, 'Billing')} collapsed={collapsed} />
              <NavItem to="/settings" icon="Settings" label={t('nav.settings', null, 'Workspace')} end collapsed={collapsed} />
            </>
          )}
        </Section>

        {isSuperAdmin && (
          <Section id="platform" label={t('nav.section.platform', null, 'Platform')} {...sectionProps} sectionCollapsed={sectionIsCollapsed('platform')}>
            <NavItem to="/admin" icon="Shield" label={t('nav.super_admin', null, 'Super Admin')} collapsed={collapsed} />
          </Section>
        )}
      </nav>

      <WorkspacePill collapsed={collapsed} />

      {/* Edge collapse handle */}
      <button
        type="button"
        onClick={toggle}
        data-testid="sidebar-collapse-toggle"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute',
          top: 0, right: -8,
          height: '100%', width: 16,
          background: 'transparent', border: 'none',
          cursor: 'col-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 30,
        }}
        className="group"
      >
        <span
          aria-hidden
          style={{
            width: 2, height: 48,
            borderRadius: 999,
            background: 'var(--bp-border)',
            transition: 'background var(--bp-dur-base) var(--bp-ease-cinema), height var(--bp-dur-base) var(--bp-ease-cinema)',
          }}
        />
      </button>
    </aside>
  );
};

export default Sidebar;
