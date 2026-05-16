/**
 * MvpLitePage — Honest, useful placeholder for sidebar modules that
 * are not yet operational. Replaces the previous "Roadmap / Coming
 * soon" pattern with a workflow-aware state:
 *
 *   • clear explanation of what this section will do
 *   • where the connected workflow currently lives
 *   • CTA that takes the user to that real workflow
 *
 * No "Coming soon" copy. No "Roadmap" header. The platform
 * communicates honestly what the user can do RIGHT NOW.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';

const MvpLitePage = ({
  testid,
  icon = 'Sparkles',
  eyebrow,
  title,
  body,
  primaryCta,
  secondaryCta,
}) => {
  const Icon = Icons[icon] || Icons.Sparkles;
  return (
    <div
      data-testid={testid || 'mvp-lite-page'}
      className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[var(--bp-bg)] px-10 py-16 text-center"
    >
      <div className="w-16 h-16 rounded-[3px] border border-[var(--bp-border)] bg-[var(--bp-surface-1)]
                      flex items-center justify-center mb-7">
        <Icon size={22} strokeWidth={1.2} className="text-[var(--bp-text-muted)]" />
      </div>
      {eyebrow && (
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--bp-primary)] font-body mb-3">
          {eyebrow}
        </p>
      )}
      <h1 className="font-heading text-[34px] font-light tracking-[-0.005em] text-[var(--bp-text-primary)] mb-4 max-w-xl leading-[1.1]">
        {title}
      </h1>
      <p className="text-[13.5px] text-[var(--bp-text-secondary)] font-body max-w-lg leading-relaxed mb-9">
        {body}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {primaryCta && (
          <Link
            to={primaryCta.to}
            data-testid={`${testid || 'mvp'}-primary-cta`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--bp-primary)] hover:brightness-110
                       text-[var(--bp-primary-foreground,#0F0F10)] text-[10.5px] uppercase tracking-[0.22em]
                       transition-all"
          >
            {primaryCta.label}
            <Icons.ArrowUpRight size={11} strokeWidth={1.6} />
          </Link>
        )}
        {secondaryCta && (
          <Link
            to={secondaryCta.to}
            data-testid={`${testid || 'mvp'}-secondary-cta`}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]
                       text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]
                       text-[10.5px] uppercase tracking-[0.22em] transition-colors"
          >
            {secondaryCta.label}
          </Link>
        )}
      </div>
    </div>
  );
};

export default MvpLitePage;

// ── Module-specific presets ────────────────────────────────────────────

export const ClientsHub = () => (
  <MvpLitePage
    testid="clients-hub"
    icon="UserCircle"
    eyebrow="STUDIO · CLIENTI"
    title="I tuoi clienti emergono dai Lead."
    body="Ogni lead qualificato che apre un progetto diventa automaticamente un cliente nella tua relazione. La gestione anagrafica dedicata arriverà come estensione del Lead system."
    primaryCta={{ to: '/workspace/leads', label: 'Apri Lead' }}
    secondaryCta={{ to: '/workspace/projects', label: 'Progetti attivi' }}
  />
);

export const MessagesHub = () => (
  <MvpLitePage
    testid="messages-hub"
    icon="MessageSquare"
    eyebrow="STUDIO · CONVERSAZIONI"
    title="Le conversazioni vivono sul progetto."
    body="Ogni progetto contiene la sua sequenza di messaggi: note, briefing, revisioni cliente. Un hub centralizzato verrà attivato quando le conversazioni passeranno una certa soglia volumetrica."
    primaryCta={{ to: '/workspace/projects', label: 'Vai ai progetti' }}
  />
);

export const CalendarHub = () => (
  <MvpLitePage
    testid="calendar-hub"
    icon="Calendar"
    eyebrow="STUDIO · TIMELINE"
    title="Le scadenze sono sul progetto."
    body="Milestone, consegne e revisioni sono già nel timeline di ogni progetto. Un calendario unificato cross-studio arriverà come overlay del modulo Progetti."
    primaryCta={{ to: '/workspace/projects', label: 'Apri progetti' }}
    secondaryCta={{ to: '/dashboard', label: 'Dashboard' }}
  />
);

export const ActivityHub = () => (
  <MvpLitePage
    testid="activity-hub"
    icon="Activity"
    eyebrow="STUDIO · ATTIVITÀ"
    title="Il feed attività vive nella dashboard."
    body="Le ultime azioni di team, clienti e workflow sono nella sezione 'Human follow-ups' della tua dashboard. Un feed cronologico esteso verrà aperto qui."
    primaryCta={{ to: '/dashboard', label: 'Apri dashboard' }}
  />
);

export const ReportsHub = () => (
  <MvpLitePage
    testid="reports-hub"
    icon="FileBarChart"
    eyebrow="STUDIO · INTELLIGENZA"
    title="I tuoi insight sono in Analytics."
    body="Conversioni lead, performance editoriali, materiali più curati: la vista intelligence è in /insights. Report esportabili PDF/CSV arriveranno qui."
    primaryCta={{ to: '/insights', label: 'Apri Analytics' }}
  />
);

export const IntegrationsHub = () => (
  <MvpLitePage
    testid="integrations-hub"
    icon="Plug"
    eyebrow="STUDIO · INTEGRAZIONI"
    title="Integrazioni esterne."
    body="Stripe (fatturazione), ElevenLabs (voce), Resend (email transazionali), Google Calendar: in arrivo come moduli opt-in. Le integrazioni AI editoriali (LLM) sono già attive."
    primaryCta={{ to: '/settings', label: 'Torna in Settings' }}
  />
);

export const CollectionsHub = () => (
  <MvpLitePage
    testid="collections-hub"
    icon="FolderHeart"
    eyebrow="EDITORIAL · COLLEZIONI"
    title="Le collezioni vivono nell'archivio."
    body="Raggruppa i tuoi asset editoriali in collezioni dalla Media Library: ogni asset può essere aggiunto a una o più collezioni curate."
    primaryCta={{ to: '/library', label: 'Apri Media Library' }}
  />
);
