/**
 * ClientWelcomeHero — cinematic zero-data hero.
 *
 * Shown when the client has NO project yet. Replaces the typical
 * "No data available" enterprise emptiness with a guided, atelier
 * tone — "il tuo progetto sta arrivando".
 *
 * Right side carries a soft interior background image; left side
 * carries the editorial copy and two CTAs.
 */
import React from 'react';
import { ArrowUpRight } from 'lucide-react';

// Unsplash editorial interior — calm, warm, slightly out of focus.
// Loaded as plain <img> with object-cover so it survives flex resize.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=2000&q=80';

const ClientWelcomeHero = ({ onPrimary, onSecondary, onTertiary }) => {
  return (
    <section
      data-testid="client-welcome-hero"
      className="cp-card relative overflow-hidden grid grid-cols-12 gap-0 min-h-[440px]"
    >
      {/* LEFT — editorial copy */}
      <div className="col-span-12 lg:col-span-6 relative z-10 px-10 lg:px-14 py-12 lg:py-16 flex flex-col justify-center">
        <p
          data-testid="client-welcome-eyebrow"
          className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-6"
        >
          Il tuo spazio progetto
        </p>
        <h2
          data-testid="client-welcome-title"
          className="font-heading text-[40px] lg:text-[52px] leading-[1.04] text-[var(--cp-text-primary)] tracking-[-0.012em] max-w-[16ch]"
        >
          Benvenuto nel tuo spazio progetto.
        </h2>
        <p
          data-testid="client-welcome-subtitle"
          className="mt-7 text-[15px] leading-[1.7] text-[var(--cp-text-secondary)] max-w-[44ch] font-body"
        >
          Qui potrai seguire ogni fase del tuo progetto:
          materiali, moodboard, approvazioni e avanzamento lavori,
          curati passo dopo passo dal nostro studio.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPrimary}
            data-testid="client-welcome-cta-brief"
            className="cp-cta-gold px-6 py-3 text-[12px] uppercase tracking-[0.18em]
                       inline-flex items-center gap-2"
          >
            Completa il briefing
            <ArrowUpRight size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onSecondary}
            data-testid="client-welcome-cta-call"
            className="cp-cta-ghost px-6 py-3 text-[12px] uppercase tracking-[0.18em]"
          >
            Prenota una call
          </button>
          <button
            type="button"
            onClick={onTertiary}
            data-testid="client-welcome-cta-process"
            className="text-[12px] uppercase tracking-[0.18em] text-[var(--cp-text-muted)]
                       hover:text-[var(--cp-text-primary)] transition-colors py-3 px-2"
          >
            Scopri il processo →
          </button>
        </div>
      </div>

      {/* RIGHT — editorial interior image with soft fade overlay */}
      <div className="col-span-12 lg:col-span-6 relative min-h-[260px]">
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Soft right-side fade so copy column reads cleanly even on narrow widths */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, var(--cp-surface-1) 0%, transparent 38%, transparent 100%)',
          }}
        />
        {/* Subtle vignette on the bottom edge */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.32) 100%)',
          }}
        />
      </div>
    </section>
  );
};

export default ClientWelcomeHero;
