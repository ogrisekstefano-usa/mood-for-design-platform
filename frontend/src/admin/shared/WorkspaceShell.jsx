import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, RefreshCw, ExternalLink } from 'lucide-react';
import { adminAuth, adminApi } from '../adminApi';

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
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.65rem 0.9rem', borderRadius: 8,
      color: isActive ? '#00C9B3' : 'rgba(255,255,255,0.75)',
      background: isActive ? 'rgba(0,201,179,0.08)' : 'transparent',
      fontFamily: 'Montserrat, sans-serif', fontSize: '0.82rem', fontWeight: 500,
      letterSpacing: '0.04em', textDecoration: 'none',
      transition: 'all 0.2s',
    })}
    data-testid={testid || `nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <Icon size={16} strokeWidth={1.6} /> {label}
  </NavLink>
);

const WorkspaceShell = ({
  eyebrow,          // small uppercase label above the title
  title,            // serif title (e.g. "Command Center" or "Workspace")
  navItems,         // array of { to, icon, label, testid }
  logoutTo,         // route to navigate to on logout (default '/')
  edgeToEdgeWhen,   // function(pathname) => boolean — disables padding
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
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0B', color: '#FFFFFF' }}>
      <aside style={{
        width: 260, padding: '2rem 1rem', borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', background: '#0A0A0B',
      }}>
        <div style={{ padding: '0 0.5rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.6rem', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#00C9B3' }}
             data-testid="workspace-eyebrow">
            {eyebrow}
          </p>
          <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', color: '#FFFFFF', marginTop: 2 }}
             data-testid="workspace-title">
            {title}
          </p>
        </div>

        <nav className="space-y-1 mt-6" data-testid="workspace-nav">
          {(navItems || []).map((it) => (
            <NavItem key={it.to} to={it.to} icon={it.icon} label={it.label} testid={it.testid} />
          ))}
        </nav>

        <div style={{ position: 'absolute', bottom: '2rem', left: '1rem', right: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <a href="/" target="_blank" rel="noopener noreferrer"
             style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', textDecoration: 'none', padding: '0.5rem 0.6rem' }}
             data-testid="workspace-view-site">
            <ExternalLink size={14} /> View site
          </a>
          <button onClick={refresh}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem 0.6rem', textAlign: 'left' }}
                  data-testid="workspace-refresh-cache">
            <RefreshCw size={14} /> Clear cache
          </button>
          <button onClick={logout}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,180,162,0.7)', fontSize: '0.78rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem 0.6rem', textAlign: 'left' }}
                  data-testid="workspace-logout">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }} data-testid="workspace-main">
        <div style={{ padding: mainPadding }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default WorkspaceShell;
