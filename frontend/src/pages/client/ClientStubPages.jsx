/**
 * ClientStubPage — premium "coming soon" filler for the secondary
 * sidebar entries (project / moodboards / timeline / approvals /
 * files / messages). Keeps the tone calm and reassuring instead of
 * a generic "404" or "not implemented".
 *
 * Each instance is exported as a named coming-soon page so App.js
 * can wire them directly.
 */
import React from 'react';
import { Sparkles } from 'lucide-react';

const Stub = ({ eyebrow, title, body, testId }) => (
  <div data-testid={testId} className="max-w-[920px] mt-2">
    <div className="cp-card p-12 lg:p-14">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-6">
        {eyebrow}
      </p>
      <h2 className="font-heading text-[36px] lg:text-[40px] leading-[1.1] tracking-[-0.012em] text-[var(--cp-text-primary)] max-w-[18ch]">
        {title}
      </h2>
      <div className="mt-6 h-px w-12 bg-[var(--cp-gold)] opacity-50" />
      <p className="mt-7 text-[14px] leading-[1.7] text-[var(--cp-text-secondary)] max-w-[52ch] font-body">
        {body}
      </p>
      <div className="mt-10 flex items-center gap-3 text-[var(--cp-text-muted)]">
        <span
          aria-hidden
          className="w-9 h-9 rounded-full flex items-center justify-center
                     bg-[var(--cp-gold-bg)] border border-[var(--cp-border)]
                     text-[var(--cp-gold-soft)]"
        >
          <Sparkles size={15} strokeWidth={1.5} />
        </span>
        <p className="text-[12px] uppercase tracking-[0.2em]">
          In arrivo
        </p>
      </div>
    </div>
  </div>
);

export const ClientProjectPage = () => (
  <Stub
    testId="client-project-page"
    eyebrow="Il mio progetto"
    title="La pagina del tuo progetto è in preparazione."
    body="A breve troverai qui la sintesi del progetto, gli avanzamenti più recenti e tutti gli aggiornamenti curati dal nostro studio."
  />
);

export const ClientMoodboardsPage = () => (
  <Stub
    testId="client-moodboards-page"
    eyebrow="Moodboard"
    title="Le tue moodboard arriveranno qui."
    body="Il nostro team sta selezionando immagini, materiali e atmosfere per costruire le prime proposte visive del tuo progetto."
  />
);

export const ClientTimelinePage = () => (
  <Stub
    testId="client-timeline-page"
    eyebrow="Timeline"
    title="La timeline completa del progetto sarà pronta a breve."
    body="Qui potrai seguire ogni fase, ogni appuntamento e ogni consegna con la precisione di un piano d'autore."
  />
);

export const ClientApprovalsPage = () => (
  <Stub
    testId="client-approvals-page"
    eyebrow="Approvazioni"
    title="Le prime proposte da approvare stanno arrivando."
    body="Quando una scelta richiederà il tuo via libera — materiali, layout, soluzioni — la troverai qui, sempre chiara e tracciabile."
  />
);

export const ClientFilesPage = () => (
  <Stub
    testId="client-files-page"
    eyebrow="File condivisi"
    title="Documenti, rendering e disegni — in un unico archivio."
    body="Ogni file condiviso dallo studio sarà disponibile qui, ordinato per fase e sempre accessibile."
  />
);

export const ClientMessagesPage = () => (
  <Stub
    testId="client-messages-page"
    eyebrow="Messaggi"
    title="Un filo diretto con il tuo studio."
    body="Comunicazioni, aggiornamenti e domande viaggeranno qui — senza email da cercare e senza chat sparse."
  />
);
