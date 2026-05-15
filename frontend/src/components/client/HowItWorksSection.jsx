/**
 * HowItWorksSection — 4 cinematic step cards explaining the studio
 * process to a first-time client. Pure guidance, zero data.
 *
 * Visual: 4 columns on desktop, 2 on tablet, 1 on mobile. Each card
 * shows a numbered eyebrow (01–04), a title in Playfair, and one
 * confident sentence of body copy.
 */
import React from 'react';
import { PenLine, Layers, ShieldCheck, Package } from 'lucide-react';

const STEPS = [
  {
    id: 'brief',
    no: '01',
    title: 'Brief iniziale',
    body: 'Raccontaci il tuo stile, i tuoi spazi e le tue esigenze. Il nostro team ascolta prima di proporre.',
    icon: PenLine,
  },
  {
    id: 'moodboard',
    no: '02',
    title: 'Moodboard & concept',
    body: 'Riceverai proposte visive curate, costruite intorno al tuo gusto e al carattere del progetto.',
    icon: Layers,
  },
  {
    id: 'review',
    no: '03',
    title: 'Revisione progetto',
    body: 'Potrai approvare materiali, layout e soluzioni — un passo alla volta, sempre con visibilità totale.',
    icon: ShieldCheck,
  },
  {
    id: 'delivery',
    no: '04',
    title: 'Consegna finale',
    body: 'Tutto il progetto resta organizzato in un unico spazio. Documenti, file, decisioni — accessibili a vita.',
    icon: Package,
  },
];

const HowItWorksSection = () => (
  <section data-testid="client-how-it-works" className="mt-16">
    <header className="mb-10">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-4">
        Come funziona
      </p>
      <h3 className="font-heading text-[32px] leading-[1.1] text-[var(--cp-text-primary)] tracking-[-0.01em] max-w-[28ch]">
        Quattro tappe pensate per accompagnarti senza fretta.
      </h3>
    </header>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {STEPS.map((s) => (
        <StepCard key={s.id} {...s} />
      ))}
    </div>
  </section>
);

const StepCard = ({ no, title, body, icon: Icon, id }) => (
  <article
    data-testid={`client-how-step-${id}`}
    className="cp-card p-7 flex flex-col gap-5 group"
  >
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-mono tracking-[0.18em] text-[var(--cp-gold)]">
        {no}
      </span>
      <Icon
        size={18}
        strokeWidth={1.4}
        className="text-[var(--cp-text-muted)] group-hover:text-[var(--cp-gold-soft)] transition-colors duration-300"
      />
    </div>
    <h4 className="font-heading text-[22px] leading-[1.15] text-[var(--cp-text-primary)] tracking-[-0.005em]">
      {title}
    </h4>
    <p className="text-[13px] leading-[1.65] text-[var(--cp-text-secondary)] font-body">
      {body}
    </p>
  </article>
);

export default HowItWorksSection;
