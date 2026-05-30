/**
 * ClientDashboardLayout · ITER173 · Client Design Journey™ V1 unified
 *
 * Surface-isolated shell for /client/* routes (today: /client/messages,
 * /client/journeys). All Gen-2 narrative chrome (ClientSidebar with 7
 * anchor links, CuratorialTeamCluster) is removed in favour of the
 * single canonical AtelierSidebar — same nav as the Welcome Workspace V1.
 *
 * Hydration: pulls referente + journey_id from /api/client/welcome-summary
 * so the sidebar can drive the "Brief Guidato™" link to the right journey.
 * Failures degrade silently (referente block hidden, brief link disabled).
 */
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ClientThemeProvider from '../../design-system/client/ClientThemeProvider';
import AtelierSidebar from '../../presets/client-profile/atelier/AtelierSidebar';
import NotificationBell from '../notifications/NotificationBell';
import ClientUserMenu from './ClientUserMenu';
import api from '../../lib/api';
import { useT } from '../../i18n/useT';
import '../../presets/client-profile/atelier/atelier.css';

const ClientTopbar = ({ onOpenMenu }) => {
  const { t } = useT();
  const { user } = useAuth();
  const firstName = user?.first_name || (user?.email ? user.email.split('@')[0] : '');
  return (
    <header
      data-testid="client-topbar"
      className="flex items-start justify-between px-6 md:px-10 pt-7 md:pt-10 pb-6 md:pb-8 gap-4"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenMenu}
          data-testid="client-menu-open"
          aria-label={t('client.client_dashboard_layout.apri_menu')}
          className="md:hidden w-9 h-9 rounded-full border border-[var(--cp-border)]
                     flex items-center justify-center text-[var(--cp-text-muted)]
                     hover:text-[var(--cp-text-primary)] transition-colors shrink-0 mt-1"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
        <div className="min-w-0">
          <h1
            data-testid="client-greeting"
            className="font-heading text-[22px] md:text-[28px] leading-[1.05] text-[var(--cp-text-primary)] truncate"
          >
            Bentornato{firstName ? `, ${firstName}` : ''}
          </h1>
          <p
            className="text-[12px] md:text-[13px] text-[var(--cp-text-muted)] font-body mt-1.5 italic"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {t('client.client_dashboard_layout.il_tuo_percorso_progettuale_ti_aspetta')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5 shrink-0">
        <NotificationBell locale="it" />
        <ClientUserMenu />
      </div>
    </header>
  );
};

const ClientDashboardLayout = () => {
  const { t } = useT();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const [referente, setReferente] = useState(null);
  const [journeyId, setJourneyId] = useState(null);

  // Hydrate sidebar context once per session.
  useEffect(() => {
    let alive = true;
    api.get('/api/client/welcome-summary')
      .then((r) => {
        if (!alive) return;
        setReferente(r?.data?.referente || null);
        setJourneyId(r?.data?.journey_id || null);
      })
      .catch(() => { /* degrade silently */ });
    return () => { alive = false; };
  }, []);

  // Close drawer on every route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.hash]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [drawerOpen]);

  const sidebar = (
    <AtelierSidebar
      client={user}
      referente={referente}
      journeyId={journeyId}
    />
  );

  return (
    <ClientThemeProvider className="min-h-screen">
      <div className="flex min-h-screen" data-testid="client-dashboard-layout">
        {/* Desktop sidebar (≥ md) */}
        <div className="hidden md:block">{sidebar}</div>

        {/* Mobile drawer (< md) */}
        {drawerOpen && (
          <div
            data-testid="client-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
        )}
        <div
          data-testid="client-drawer"
          className={`md:hidden fixed inset-y-0 left-0 z-50 transform transition-transform duration-300
                      ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              data-testid="client-drawer-close"
              aria-label={t('client.client_dashboard_layout.chiudi_menu')}
              className="absolute -right-12 top-6 w-9 h-9 rounded-full border border-white/15
                         flex items-center justify-center text-white/80
                         hover:text-white hover:border-white/40 transition-colors"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
            {sidebar}
          </div>
        </div>

        <main className="flex-1 flex flex-col min-w-0">
          <ClientTopbar onOpenMenu={() => setDrawerOpen(true)} />
          <div className="flex-1 px-0 pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </ClientThemeProvider>
  );
};

export default ClientDashboardLayout;
