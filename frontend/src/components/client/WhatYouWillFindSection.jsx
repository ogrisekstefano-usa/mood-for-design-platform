/**
 * WhatYouWillFindSection — 6 mini cards previewing the sections the
 * client will use throughout the project.
 *
 * Sits BELOW HowItWorksSection. Visually lighter (smaller cards,
 * less copy) so it reads as a soft map, not a CTA grid.
 */
import React from 'react';
import {
  CalendarClock, Layers, ShieldCheck, FileText, MessageSquare, Gem,
} from 'lucide-react';

const ITEMS = [
  { id: 'timeline',  title: 'Timeline progetto',     body: 'Ogni fase, sempre aggiornata.',           icon: CalendarClock },
  { id: 'materials', title: 'Materiali selezionati', body: 'Le scelte che faremo insieme.',           icon: Gem },
  { id: 'files',     title: 'File condivisi',        body: 'Disegni, rendering e documenti.',         icon: FileText },
  { id: 'appts',     title: 'Appuntamenti',          body: 'Call e incontri in studio.',              icon: CalendarClock },
  { id: 'moodboard', title: 'Moodboard approvate',   body: 'La direzione visiva del progetto.',       icon: Layers },
  { id: 'messages',  title: 'Comunicazioni studio',  body: 'Un filo diretto con il tuo team.',        icon: MessageSquare },
];

const WhatYouWillFindSection = () => (
  <section data-testid="client-what-find" className="mt-20">
    <header className="mb-10">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-4">
        Cosa troverai qui
      </p>
      <h3 className="font-heading text-[28px] leading-[1.15] text-[var(--cp-text-primary)] tracking-[-0.01em] max-w-[32ch]">
        Tutto il tuo progetto, organizzato con cura.
      </h3>
    </header>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ITEMS.map((it) => (
        <MiniCard key={it.id} {...it} />
      ))}
    </div>
  </section>
);

const MiniCard = ({ id, title, body, icon: Icon }) => (
  <div
    data-testid={`client-find-${id}`}
    className="cp-card p-6 flex items-start gap-4 group"
  >
    <span
      aria-hidden
      className="w-10 h-10 rounded-full flex items-center justify-center
                 bg-[var(--cp-gold-bg)] border border-[var(--cp-border)]
                 text-[var(--cp-gold-soft)]
                 group-hover:bg-[var(--cp-gold-bg-strong)] transition-colors"
    >
      <Icon size={16} strokeWidth={1.5} />
    </span>
    <div>
      <p className="text-[14px] text-[var(--cp-text-primary)] font-body leading-tight mb-1">
        {title}
      </p>
      <p className="text-[12px] text-[var(--cp-text-muted)] font-body leading-[1.55]">
        {body}
      </p>
    </div>
  </div>
);

export default WhatYouWillFindSection;
