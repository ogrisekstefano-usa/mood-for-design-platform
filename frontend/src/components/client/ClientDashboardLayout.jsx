/**
 * ClientDashboardLayout — surface-isolated shell for the Client Portal.
 *
 * Renders ClientThemeProvider so the entire subtree carries
 * `data-surface="client"` and is fully isolated from Blueprint OS.
 *
 * Layout:
 *   ┌──────────┬──────────────────────────────────────────────┐
 *   │ Sidebar  │  Topbar (greeting + bell + avatar)            │
 *   │  260px   │                                                │
 *   │          │  <Outlet/>  (the active client page)           │
 *   └──────────┴──────────────────────────────────────────────┘
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ClientThemeProvider from '../../design-system/client/ClientThemeProvider';
import ClientSidebar from './ClientSidebar';

const initialsOf = (user) => {
  if (!user) return '·';
  const fn = (user.first_name || '').trim();
  const ln = (user.last_name || '').trim();
  if (fn || ln) return ((fn[0] || '') + (ln[0] || '')).toUpperCase();
  return (user.email || '·')[0].toUpperCase();
};

const ClientTopbar = () => {
  const { user } = useAuth();
  const firstName = user?.first_name || (user?.email ? user.email.split('@')[0] : '');
  return (
    <header
      data-testid="client-topbar"
      className="flex items-start justify-between px-10 pt-10 pb-8"
    >
      <div>
        <h1
          data-testid="client-greeting"
          className="font-heading text-[28px] leading-[1.05] text-[var(--cp-text-primary)]"
        >
          Bentornato{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-[13px] text-[var(--cp-text-muted)] font-body mt-1.5 italic" style={{fontFamily: "'Playfair Display', serif"}}>
          Il tuo percorso progettuale ti aspetta.
        </p>
      </div>

      <div className="flex items-center gap-5">
        <button
          type="button"
          data-testid="client-notifications-btn"
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-full border border-[var(--cp-border)]
                     flex items-center justify-center text-[var(--cp-text-muted)]
                     hover:text-[var(--cp-text-primary)] hover:border-[var(--cp-border-hover)]
                     transition-colors"
        >
          <Bell size={15} strokeWidth={1.5} />
        </button>
        <div
          data-testid="client-avatar"
          className="w-9 h-9 rounded-full bg-[var(--cp-surface-2)]
                     border border-[var(--cp-border)]
                     flex items-center justify-center
                     text-[12px] tracking-[0.08em]
                     text-[var(--cp-gold-soft)] font-body uppercase"
        >
          {initialsOf(user)}
        </div>
      </div>
    </header>
  );
};

const ClientDashboardLayout = () => {
  return (
    <ClientThemeProvider className="min-h-screen">
      <div className="flex min-h-screen" data-testid="client-dashboard-layout">
        <ClientSidebar />
        <main className="flex-1 flex flex-col">
          <ClientTopbar />
          <div className="flex-1 px-10 pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </ClientThemeProvider>
  );
};

export default ClientDashboardLayout;
