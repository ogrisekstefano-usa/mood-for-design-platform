import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, RefreshCw, ExternalLink } from 'lucide-react';
import { adminAuth, adminApi } from '../adminApi';
import NotificationBell from '../../components/notifications/NotificationBell';
import './functional-luxury.css';

/**
 * Shared chrome for both MOOD workspaces:
 *   • CommandCenterShell  (MOOD Core — advisors, relations, lifecycle)
 *   • BlueprintShell      (Tenant runtime — CMS, media, publishing)
 *
 * The two shells are intentionally separated routes (/command-center vs
 * /blueprint) so MOOD Core is not entangled with the tenant editorial
 * workspace, even though they currently render on the same domain.
 */
const NavItem = ({ to, icon: Icon, label, testid }) => (
  <NavLink
    to={to}
    end={false}
    className={({ isActive }) => `workspace-nav-item ${isActive ? 'active' : ''}`}
    style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: '0.7rem',
      padding: '0.55rem 0.75rem', borderRadius: 6,
      color: isActive ? '#00C9B3' : 'rgba(255,255,255,0.78)',
      background: isActive ? 'rgba(0,201,179,0.08)' : 'transparent',
      fontSize: '0.78rem', fontWeight: 500,
      letterSpacing: '-0.005em', textDecoration: 'none',
      transition: 'all 0.15s',
    })}
    data-testid={testid || `nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <Icon size={15} strokeWidth={1.5} /> {label}
  </NavLink>
);

const WorkspaceShell = ({
  eyebrow,          // small uppercase label above the title
  title,            // serif title (e.g. "Command Center" or "Workspace")
  navItems,         // array of { to, icon, label, testid }
  logoutTo,         // route to navigate to on logout (default '/')
  edgeToEdgeWhen,   // function(pathname) => boolean — disables padding
  logoSrc,          // optional brand logo (rendered above eyebrow/title)
  logoAlt,          // alt text for the brand logo
  children,
}) => {
  const nav = useNavigate();
  const location = useLocation();

  const logout = () => {
    adminAuth.clear();
    nav(logoutTo || '/');
    window.location.reload();
  };
  const refresh = async () => {
    try { await adminApi.invalidate(); window.alert('Cache cleared'); } catch { /* ignore */ }
  };

  const edge = typeof edgeToEdgeWhen === 'function' && edgeToEdgeWhen(location?.pathname || '');
  const mainPadding = edge ? 0 : '2.5rem 3rem';

  return (
    <div className="fl-shell" style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0B', color: '#EDEDED' }}>
      <aside className="fl-aside" style={{
        width: 248, padding: '1.4rem 0.85rem 1rem', borderRight: '1px solid #2A2A30',
        position: 'sticky', top: 0, height: '100vh', background: '#0A0A0B',
      }}>
        <div style={{ padding: '0 0.5rem 1.1rem', borderBottom: '1px solid #2A2A30' }}>
          {logoSrc && (
            <img
              src={logoSrc}
              alt={logoAlt || 'MOOD for DESIGN'}
              data-testid="workspace-brand-logo"
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                maxWidth: 132,
                height: 'auto',
                margin: '0 auto 0.85rem',
                userSelect: 'none',
              }}
            />
          )}
          <p style={{ fontSize: '0.58rem', letterSpacing: '0.34em', textTransform: 'uppercase', color: '#00C9B3', margin: 0 }}
             data-testid="workspace-eyebrow">
            {eyebrow}
          </p>
          <p style={{ fontSize: '0.95rem', fontWeight: 500, color: '#EDEDED', marginTop: 4, letterSpacing: '-0.01em' }}
             data-testid="workspace-title">
            {title}
          </p>
        </div>

        <nav className="fl-aside-nav space-y-0.5 mt-4" data-testid="workspace-nav">
          {(navItems || []).map((it, idx) => {
            const prev = idx > 0 ? navItems[idx - 1] : null;
            const showDivider = prev && prev.group && it.group && prev.group !== it.group;
            return (
              <React.Fragment key={it.to}>
                {showDivider && (
                  <div aria-hidden="true" style={{
                    height: 1, background: '#2A2A30',
                    margin: '10px 8px 10px',
                  }} />
                )}
                <NavItem to={it.to} icon={it.icon} label={it.label} testid={it.testid} />
              </React.Fragment>
            );
          })}
        </nav>

        <div className="fl-aside-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.75rem' }}>
          <a href="/" target="_blank" rel="noopener noreferrer"
             style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textDecoration: 'none', padding: '0.4rem 0.6rem' }}
             data-testid="workspace-view-site">
            <ExternalLink size={13} /> View site
          </a>
          <button onClick={refresh}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.4rem 0.6rem', textAlign: 'left' }}
                  data-testid="workspace-refresh-cache">
            <RefreshCw size={13} /> Clear cache
          </button>
          <button onClick={logout}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,180,162,0.7)', fontSize: '0.72rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.4rem 0.6rem', textAlign: 'left' }}
                  data-testid="workspace-logout">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, position: 'relative' }} data-testid="workspace-main">
        <div
          data-testid="workspace-topbar-bell"
          style={{
            position: 'fixed', top: 14, right: 18, zIndex: 40,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
          <NotificationBell />
        </div>
        <div style={{ padding: mainPadding }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default WorkspaceShell;
