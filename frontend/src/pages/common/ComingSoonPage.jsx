/**
 * ComingSoonPage — elegant placeholder for sidebar routes not yet built.
 *
 * Used by /workspace/calendar, /workspace/activity, /workspace/team,
 * /workspace/clients, /workspace/messages, /workspace/reports,
 * /settings/integrations, /library/collections.
 *
 * NOT marketing copy. Looks like an OS surface in graceful waiting state.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';

const ComingSoonPage = ({
  title = 'Coming soon',
  subtitle = 'Stiamo costruendo questa parte del sistema operativo.',
  icon = 'Sparkles',
  hint,
  backTo = '/dashboard',
  backLabel = 'Torna alla dashboard',
}) => {
  const Icon = Icons[icon] || Icons.Sparkles;
  return (
    <div
      data-testid={`coming-soon-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className="h-full flex flex-col items-center justify-center bg-[var(--bp-bg)] px-10 py-16 text-center"
    >
      <div className="w-14 h-14 rounded-[12px] border border-[var(--bp-border)] bg-[var(--bp-surface-1)]
                      flex items-center justify-center mb-6">
        <Icon size={20} strokeWidth={1.3} className="text-[var(--bp-text-muted)]" />
      </div>
      <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-2">
        Roadmap
      </p>
      <h1 className="text-[28px] font-medium tracking-tight text-[var(--bp-text-primary)] mb-3 max-w-md leading-tight">
        {title}
      </h1>
      <p className="text-[13px] text-[var(--bp-text-muted)] font-body max-w-md leading-relaxed">
        {subtitle}
      </p>
      {hint && (
        <p className="mt-5 px-4 py-2.5 rounded-[8px] bg-[var(--bp-surface-1)] border border-[var(--bp-border)]
                      text-[12px] text-[var(--bp-text-secondary)] font-body max-w-md">
          {hint}
        </p>
      )}
      <Link
        to={backTo}
        data-testid="coming-soon-back-btn"
        className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-[8px] border border-[var(--bp-border)]
                   text-[12px] text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]
                   hover:border-[var(--bp-border-strong)] font-body transition-colors"
      >
        <Icons.ArrowLeft size={12} />
        {backLabel}
      </Link>
    </div>
  );
};

// Surface-specific presets — keep configuration close to the routes.
export const CalendarComingSoon = () => (
  <ComingSoonPage
    title="Calendario integrato"
    subtitle="Riunioni cliente, consegne proposte, milestone progetto e timeline operative — in arrivo."
    icon="Calendar"
    hint="Nel frattempo, le scadenze attività sono visibili nella Dashboard e nelle pagine progetto."
  />
);

export const ActivityComingSoon = () => (
  <ComingSoonPage
    title="Feed attività dello studio"
    subtitle="Cronologia completa di ogni azione cliente, designer e di sistema."
    icon="Activity"
  />
);

export const TeamComingSoon = () => (
  <ComingSoonPage
    title="Gestione team"
    subtitle="Membri, permessi, ruoli di studio, attività individuale, carichi di lavoro."
    icon="Users"
    hint="Per ora, la gestione utenti è in Impostazioni → Membri."
    backTo="/settings"
  />
);

export const ClientsComingSoon = () => (
  <ComingSoonPage
    title="Anagrafica clienti"
    subtitle="Storico clienti, progetti collegati, comunicazioni, fatturazione."
    icon="UserCircle"
    hint="I lead attivi sono già in Workspace → Lead."
  />
);

export const MessagesComingSoon = () => (
  <ComingSoonPage
    title="Messaggi"
    subtitle="Conversazioni client-studio integrate, allegati, notifiche."
    icon="MessageSquare"
  />
);

export const ReportsComingSoon = () => (
  <ComingSoonPage
    title="Report"
    subtitle="Report esportabili: progetti, fatturato, performance team, materiali più utilizzati."
    icon="FileBarChart"
  />
);

export const IntegrationsComingSoon = () => (
  <ComingSoonPage
    title="Integrazioni"
    subtitle="Connetti Stripe, Google Calendar, Slack, Dropbox, fornitori e cataloghi."
    icon="Plug"
    backTo="/settings"
  />
);

export const CollectionsComingSoon = () => (
  <ComingSoonPage
    title="Pagina dedicata Collezioni"
    subtitle="Una vista a sé per le tue raccolte curate di asset. Per ora le collezioni vivono nell'Archivio."
    icon="FolderHeart"
    hint="Nel frattempo, gestisci le tue collezioni dal pannello sinistro dell'Archivio."
    backTo="/library"
    backLabel="Vai all'Archivio"
  />
);

export default ComingSoonPage;
