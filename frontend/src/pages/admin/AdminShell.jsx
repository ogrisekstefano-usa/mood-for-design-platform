/**
 * ITER143C · Blueprint Command Center™ — Cinematic Admin Shell.
 *
 * Black glass · whisper UI · silent interface · floating metrics.
 * NOT enterprise SaaS. NOT bootstrap admin. NOT WordPress.
 *
 * Mood references: Linear · Raycast · Notion AI · cinematic terminal.
 *
 * Mounts under `/admin/*` and is gated by RootSuperAdminRoute on the
 * App router level — so any descendant page can assume the user
 * holds is_root_superadmin = TRUE.
 */
import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  EditorialBundleProvider,
  useEditorialBlock,
} from '../../site/editorial/EditorialBundleProvider';
import { SiteProvider } from '../../site/SiteContext';
import {
  LayoutGrid, Building2, Users, Sparkles, FileText, Languages,
  Mail, FlaskConical, LogOut, Circle,
} from 'lucide-react';
import './admin-shell.css';

const NS = 'admin.shell';
const k = (s) => `${NS}.${s}`;

const NAV = [
  { to: '/admin/dashboard',           Icon: LayoutGrid,    keyName: 'nav.dashboard'  },
  { to: '/admin/tenants',             Icon: Building2,     keyName: 'nav.tenants'    },
  { to: '/admin/users',               Icon: Users,         keyName: 'nav.users'      },
  { to: '/admin/presets',             Icon: Sparkles,      keyName: 'nav.presets'    },
  { to: '/admin/editorial-runtime',   Icon: FileText,      keyName: 'nav.editorial'  },
  { to: '/admin/language-governance', Icon: Languages,     keyName: 'nav.language'   },
  { to: '/admin/email-governance',    Icon: Mail,          keyName: 'nav.email'      },
  { to: '/admin/demo-governance',     Icon: FlaskConical,  keyName: 'nav.demo'       },
];

const AdminShellInner = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const labelFor = (key) => useEditorialBlock(k(key)); // eslint-disable-line react-hooks/rules-of-hooks

  const onLogout = async () => {
    try { await logout(); } catch (_) {}
    navigate('/auth/login');
  };

  return (
    <div className="bp-admin" data-testid="bp-admin-shell">
      <aside className="bp-admin__rail" aria-label="Blueprint Command Center navigation">
        <div className="bp-admin__brand">
          <div className="bp-admin__brand-mark" aria-hidden>
            <Circle size={9} strokeWidth={1.4} />
          </div>
          <div className="bp-admin__brand-text">
            <span className="bp-admin__brand-eyebrow">BLUEPRINT</span>
            <span className="bp-admin__brand-title">COMMAND CENTER™</span>
          </div>
        </div>

        <nav className="bp-admin__nav">
          {NAV.map(({ to, Icon, keyName }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                'bp-admin__nav-item' + (isActive ? ' bp-admin__nav-item--active' : '')
              }
              data-testid={`bp-admin-nav-${keyName.split('.').pop()}`}
            >
              <Icon size={15} strokeWidth={1.3} aria-hidden />
              <span><AdminLabel keyName={keyName} /></span>
            </NavLink>
          ))}
        </nav>

        <div className="bp-admin__identity">
          <div className="bp-admin__identity-user">
            <span className="bp-admin__identity-dot" />
            <div className="bp-admin__identity-meta">
              <span className="bp-admin__identity-email">{user?.email || ''}</span>
              <span className="bp-admin__identity-role">ROOT SUPERADMIN™</span>
            </div>
          </div>
          <button
            type="button"
            className="bp-admin__signout"
            onClick={onLogout}
            data-testid="bp-admin-signout"
            aria-label="Sign out"
          >
            <LogOut size={13} strokeWidth={1.3} />
          </button>
        </div>
      </aside>

      <main className="bp-admin__main">
        <Outlet />
      </main>
    </div>
  );
};

// Helper component because hooks can't be called inline in a JSX map.
const AdminLabel = ({ keyName }) => {
  const v = useEditorialBlock(k(keyName));
  return v || '\u00A0';
};

const AdminShell = () => (
  <SiteProvider>
    <EditorialBundleProvider pageKeys={['blueprint-admin-shell']}>
      <AdminShellInner />
    </EditorialBundleProvider>
  </SiteProvider>
);

export default AdminShell;
