/**
 * Sidebar — ITER144 · NAVIGATION RUNTIME™
 *
 * Re-written: NO hardcoded menu arrays · NO tenant conditionals · NO
 * static sections. The entire navigation tree is consumed at runtime
 * from `useNavigationTree()` (which is fed by /api/tenant/configuration).
 *
 * Visual DNA preserved 1:1 with the pre-ITER144 Sidebar (Atelier Nordic,
 * cyan active state, italic Cormorant brand mark, Sections + NavItems).
 */
import React, { useState, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import {
  useNavigationTree,
  useTenantConfiguration,
} from '../../contexts/TenantConfigurationContext';
import useSidebarCollapsed from '../../hooks/useSidebarCollapsed';
import ActiveJourneyRail from './ActiveJourneyRail';
import { useNewRelationship } from '../../hooks/useNewRelationship';

const SECTION_STORAGE_KEY = 'mood.sidebar.sections.v6';
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
const NavItem = ({ item, collapsed }) => {
  const Icon = Icons[item.icon] || Icons.Circle;
  const tid = item.test_id
    || `sidebar-nav-${item.code.replace(/_/g, '-')}`;
  const isSoon = item.state === 'beta' || item.state === 'locked';
  // Open Super Admin / Command Center entries in a new tab — they're
  // platform-level surfaces and shouldn't replace the studio session.
  const openInNewTab = item.code === 'blueprint_admin'
    || (item.route && item.route.startsWith('/admin'));
  if (openInNewTab) {
    return (
      <a
        href={item.route}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={tid}
        data-module-code={item.code}
        data-module-state={item.state}
        aria-label={item.label}
        title={collapsed ? item.label : undefined}
        className={`atelier-nav-item ${collapsed ? 'atelier-nav-item--collapsed' : ''}`}
        style={collapsed ? { justifyContent: 'center', padding: '10px 0' } : undefined}
      >
        <Icon size={15} strokeWidth={1.5} className="atelier-nav-item__icon" />
        {!collapsed && (
          <span className="atelier-nav-item__label">
            {item.label}
            {item.has_mark && <span className="atelier-nav-item__mark">™</span>}
          </span>
        )}
      </a>
    );
  }
  return (
    <NavLink
      to={item.route}
      end={item.end}
      data-testid={tid}
      data-module-code={item.code}
      data-module-state={item.state}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `atelier-nav-item ${isActive ? 'atelier-nav-item--active' : ''} ${collapsed ? 'atelier-nav-item--collapsed' : ''}`
      }
      style={collapsed ? { justifyContent: 'center', padding: '10px 0' } : undefined}
    >
      <Icon size={15} strokeWidth={1.5} className="atelier-nav-item__icon" />
      {!collapsed && (
        <span className="atelier-nav-item__label">
          {item.label}
          {item.has_mark && <span className="atelier-nav-item__mark">™</span>}
        </span>
      )}
      {!collapsed && isSoon && (
        <span
          data-testid={`sidebar-nav-state-${item.code}`}
          style={{
            fontFamily: 'var(--atelier-mono)',
            fontSize: 8.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--bp-text-faint)',
            opacity: 0.7,
          }}
        >
          {item.state}
        </span>
      )}
    </NavLink>
  );
};

// ── Section ──────────────────────────────────────────────────────
const Section = ({ group, collapsed, sectionCollapsed, onToggle, t, children }) => {
  // Resolve i18n: prefer `nav.section.<group_code>` if it exists,
  // otherwise fall back to the server-provided group label.
  const sectionKey = `nav.section.${group.code.replace(/-/g, '_')}`;
  const label = t(sectionKey, null, group.label);
  const hasMark = group.code === 'studio-pulse' || group.code === 'design-journey';
  if (collapsed) {
    return (
      <div data-testid={`sidebar-section-${group.code}`} style={{ marginBottom: 14 }}>
        <hr className="atelier-divider" style={{ margin: '6px 12px 10px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
      </div>
    );
  }
  const open = !sectionCollapsed;
  return (
    <div data-testid={`sidebar-section-${group.code}`}>
      <button
        type="button"
        onClick={() => onToggle(group.code)}
        data-testid={`sidebar-section-toggle-${group.code}`}
        className="atelier-rail__section-label"
        style={{
          width: '100%', background: 'transparent', border: 'none',
          padding: '0 12px', marginBottom: 12, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>
          {label}
          {hasMark && <span style={{ color: 'var(--atelier-cyan)', marginLeft: 4 }}>™</span>}
        </span>
        <Icons.ChevronDown
          size={10} strokeWidth={1.6}
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

// ── Workspace pill ───────────────────────────────────────────────
const WorkspacePill = ({ collapsed, monogram }) => {
  const { tenant, t } = useBlueprint();
  const tenantName = tenant?.name || tenant?.slug || 'Workspace';
  const mark = monogram || tenantName.charAt(0).toUpperCase();
  if (collapsed) {
    return (
      <div data-testid="workspace-selector" title={tenantName}
        style={{
          margin: '8px 10px 16px', width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--bp-border)', borderRadius: 'var(--bp-radius-sm)',
          background: 'var(--bp-surface-1)',
          fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
          fontSize: 14, color: 'var(--bp-text-headline)',
        }}>{mark}</div>
    );
  }
  return (
    <div data-testid="workspace-selector"
      style={{
        margin: '8px 14px 18px', padding: '12px 14px',
        border: '1px solid var(--bp-border)', borderRadius: 'var(--bp-radius-md)',
        background: 'var(--bp-surface-1)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
      <span style={{
        width: 32, height: 32, borderRadius: 'var(--bp-radius-sm)',
        background: 'var(--bp-surface-2)', border: '1px solid var(--bp-border-strong)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
        fontSize: 14, color: 'var(--bp-text-headline)', flexShrink: 0,
      }}>{mark}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
          fontWeight: 500, fontSize: 14, color: 'var(--bp-text-headline)',
          margin: 0, lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{tenantName}</p>
        <p className="atelier-section-label" style={{ marginTop: 4, padding: 0 }}>
          {t('common.workspace', null, 'Workspace')}
        </p>
      </div>
    </div>
  );
};

// ── Brand mark ──────────────────────────────────────────────────
const RailBrand = ({ collapsed, onToggle, impersonating, monogram }) => (
  <button
    type="button" onClick={onToggle}
    data-testid="sidebar-brand-toggle"
    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    style={{
      width: '100%', background: 'transparent', border: 'none',
      borderBottom: '1px solid var(--bp-border-soft)', cursor: 'pointer',
      padding: collapsed ? '24px 0 20px' : '28px 24px 22px',
      display: 'flex', alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'flex-start',
      gap: 12, position: 'relative',
    }}>
    <span className="atelier-rail__brand-mark">
      <span style={{
        fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
        fontWeight: 500, fontSize: 18, color: 'var(--bp-text-headline)',
        lineHeight: 1,
      }}>{monogram || 'M'}</span>
    </span>
    {!collapsed && (
      <img
        src="https://customer-assets.emergentagent.com/job_content-hub-pro-22/artifacts/iow4xdfw_logo_mood_for_design_color.png"
        alt="MOOD for DESIGN™"
        className="atelier-rail__brand-logo"
        draggable={false}
        style={{ height: 64, width: 'auto', objectFit: 'contain' }}
      />
    )}
    {impersonating && !collapsed && (
      <span aria-label="Impersonating"
        style={{
          position: 'absolute', right: 16, top: 16,
          width: 6, height: 6, borderRadius: 999,
          background: 'var(--atelier-cyan)', boxShadow: 'var(--atelier-glow-cyan-sm)',
        }} />
    )}
  </button>
);

// ── Main Sidebar — fully runtime-driven ───────────────────────────
const Sidebar = () => {
  const { impersonating, t } = useBlueprint();
  const { bundle } = useTenantConfiguration();
  const groups = useNavigationTree();
  const { collapsed, toggle } = useSidebarCollapsed();
  const { isCollapsed: sectionIsCollapsed, toggle: toggleSection } = useSectionCollapse();
  const location = useLocation();
  const inAdmin = location.pathname.startsWith('/admin');
  const width = collapsed ? 68 : 270;
  const monogram = bundle?.theme?.monogram;

  const sectionProps = useMemo(() => ({
    collapsed, onToggle: toggleSection,
  }), [collapsed, toggleSection]);

  return (
    <aside
      data-testid="sidebar-nav"
      data-nav-runtime="iter144"
      style={{ width, flexShrink: 0, transition: 'width 300ms var(--bp-ease-cinema)' }}
      className="atelier-rail"
    >
      <RailBrand collapsed={collapsed} onToggle={toggle}
                 impersonating={impersonating && !inAdmin}
                 monogram={monogram} />

      <NewRelationshipCta collapsed={collapsed} />


      <nav className="atelier-rail__sections">
        {(groups || []).map((group) => (
          <Section key={group.code} group={group} t={t}
                   {...sectionProps}
                   sectionCollapsed={sectionIsCollapsed(group.code)}>
            {group.items.map((item) => (
              <React.Fragment key={item.code}>
                <NavItem item={{
                  ...item,
                  label: t(`nav.${item.code}`, null, item.label),
                }} collapsed={collapsed} />
                {/* Special-case: design-journey · all-journeys gets the
                    Active Journey Rail injected below it.  Runtime-safe:
                    the rail is purely additive UI and does not affect
                    navigation visibility. */}
                {item.code === 'begin_journey' && !collapsed && (
                  <ActiveJourneyRail collapsed={collapsed} />
                )}
              </React.Fragment>
            ))}
          </Section>
        ))}

        {(!groups || groups.length === 0) && (
          <div data-testid="sidebar-nav-empty"
            style={{
              padding: '40px 22px', color: 'var(--bp-text-faint)',
              fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
              fontSize: 13, lineHeight: 1.5,
            }}>
            {t('nav.runtime.loading', null, 'L’atelier sta riprendendo respiro…')}
          </div>
        )}
      </nav>

      <WorkspacePill collapsed={collapsed} monogram={monogram} />

      <button type="button" onClick={toggle}
        data-testid="sidebar-collapse-toggle"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          position: 'absolute', top: 0, right: -8,
          height: '100%', width: 16,
          background: 'transparent', border: 'none', cursor: 'col-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30,
        }}
        className="group">
        <span aria-hidden style={{
          width: 2, height: 48, borderRadius: 999,
          background: 'var(--bp-border)',
          transition: 'background var(--bp-dur-base) var(--bp-ease-cinema), height var(--bp-dur-base) var(--bp-ease-cinema)',
        }} />
      </button>
    </aside>
  );
};

export default Sidebar;

// ── Nuova Relazione CTA (ITER177.B) ─────────────────────────────
const NewRelationshipCta = ({ collapsed }) => {
  const { open } = useNewRelationship();
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => open()}
        data-testid="sidebar-new-relationship-trigger"
        aria-label="Nuova Relazione"
        title="Nuova Relazione"
        style={{
          margin: '10px 10px 6px', padding: '10px 0',
          background: '#0c0e12', color: '#ffffff',
          border: 0, borderRadius: 8, cursor: 'pointer',
          fontSize: 18, fontWeight: 400,
        }}
      >+</button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => open()}
      data-testid="sidebar-new-relationship-trigger"
      style={{
        margin: '12px 14px 8px', padding: '10px 14px',
        background: '#0c0e12', color: '#ffffff',
        border: 0, borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 500, letterSpacing: '0.01em',
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'background 160ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#1f2329'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#0c0e12'; }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>+</span>
      <span>Nuova Relazione</span>
    </button>
  );
};
