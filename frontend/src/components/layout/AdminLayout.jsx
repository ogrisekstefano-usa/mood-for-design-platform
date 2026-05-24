/**
 * AdminLayout — Blueprint OS™ Control Center.
 *
 * SuperAdmin Refactor v2 (Feb 2026):
 *   • Hard-coded graphite foundation (#0A0B0E → #14161B)
 *   • Cyan intelligence accent (#C9A26B) — never amber/gold
 *   • MOOD dual-circle inline SVG icon — editorial-tech, no gradients
 *   • Tenant theme is BYPASSED here: this is platform-level chrome
 *   • Removed "Pagine" navigation (legacy)
 *   • Renamed "Moduli" → "Platform Capabilities™"
 *
 * Tone: international editorial operating system, not an admin panel.
 */
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity, Building2, Handshake, Layers, Languages, ScrollText,
  ArrowLeft, LogOut, Menu, X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import MoodDualCircleIcon from '../common/MoodDualCircleIcon';
import PlatformFooterBar from '../common/PlatformFooterBar';
import './admin-control-center.css';

const AdminNavItem = ({ to, icon: Icon, labelKey, fallback, end }) => {
  const { t } = useBlueprint();
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={`admin-nav-${labelKey.replace(/\./g, '-')}`}
      className={({ isActive }) =>
        `acc-nav__item ${isActive ? 'is-active' : ''}`
      }
    >
      <Icon size={14} strokeWidth={1.4} />
      <span>{t(labelKey, null, fallback)}</span>
    </NavLink>
  );
};

const AdminLayout = () => {
  const { user, signOut } = useAuth();
  const { t } = useBlueprint();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="acc-shell" data-surface="control-center"
         data-mobile-nav={mobileOpen ? 'open' : 'closed'}
         data-testid="admin-shell">
      {/* Mobile backdrop overlay (closes nav on tap) */}
      <div className="acc-mobile-backdrop"
           onClick={() => setMobileOpen(false)}
           data-testid="admin-mobile-backdrop"
           aria-hidden />
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="acc-sidebar" data-testid="admin-sidebar"
             onClick={() => setMobileOpen(false)}>
        <div className="acc-brand">
          <span className="acc-brand__mark" aria-hidden>
            <MoodDualCircleIcon size={26} strokeWidth={1.5} />
          </span>
          <div className="acc-brand__text">
            <p className="acc-brand__product">Blueprint OS</p>
            <p className="acc-brand__eyebrow">Control Center</p>
          </div>
        </div>

        <nav className="acc-nav" aria-label="Control Center navigation">
          <p className="acc-nav__section">Orchestrazione</p>
          <AdminNavItem to="/admin" end icon={Activity}
                        labelKey="admin.nav.overview" fallback="Panoramica" />
          <AdminNavItem to="/admin/tenants" icon={Building2}
                        labelKey="admin.nav.tenants" fallback="Studi" />

          <p className="acc-nav__section">Network</p>
          <AdminNavItem to="/admin/advisors" icon={Handshake}
                        labelKey="admin.nav.advisors" fallback="Advisor Network™" />

          <p className="acc-nav__section">Piattaforma</p>
          <AdminNavItem to="/admin/modules" icon={Layers}
                        labelKey="admin.nav.capabilities" fallback="Platform Capabilities™" />
          <AdminNavItem to="/admin/languages" icon={Languages}
                        labelKey="admin.nav.languages" fallback="Lingue" />
          <AdminNavItem to="/admin/audit" icon={ScrollText}
                        labelKey="admin.nav.audit" fallback="Audit log" />
        </nav>

        <div className="acc-foot">
          <button type="button" onClick={() => navigate('/dashboard')}
                  className="acc-foot__btn"
                  data-testid="admin-exit-workspace">
            <ArrowLeft size={12} strokeWidth={1.5} />
            <span>{t('admin.exit', null, 'Torna al workspace')}</span>
          </button>
          <button type="button"
                  onClick={async () => { await signOut(); navigate('/auth/login'); }}
                  className="acc-foot__btn acc-foot__btn--danger"
                  data-testid="admin-logout">
            <LogOut size={12} strokeWidth={1.5} />
            <span>{t('common.logout', null, 'Esci')}</span>
          </button>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────── */}
      <div className="acc-main">
        <header className="acc-topbar">
          <div className="acc-topbar__title">
            <button type="button"
                    className="acc-mobile-toggle"
                    onClick={() => setMobileOpen((v) => !v)}
                    data-testid="admin-mobile-toggle"
                    aria-label={mobileOpen ? 'Chiudi menu' : 'Apri menu'}>
              {mobileOpen ? <X size={13} /> : <Menu size={13} />}
              <span>Menu</span>
            </button>
            <span className="acc-topbar__chip">Platform · Super Admin</span>
          </div>
          <div className="acc-topbar__meta">
            <span className="acc-topbar__email">{user?.email}</span>
          </div>
        </header>

        <main className="acc-content">
          <Outlet />
        </main>

        <PlatformFooterBar surface="os" />
      </div>
    </div>
  );
};

export default AdminLayout;
