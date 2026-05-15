/**
 * ClientHumanCard — "Il tuo referente" card.
 *
 * Phase S.1: shows the real human assigned to this client (NOT a fake
 * "support agent", NOT a chatbot). Loads /api/human-assignment/me and
 * renders the public-safe assignee profile with calm CTAs.
 *
 * Visual rules (Client Portal aesthetic):
 *   - warm graphite card with gold border-active hover
 *   - circular avatar (96px) or initials fallback in gold-soft
 *   - Playfair name (22px), Inter role + bio
 *   - 3 CTAs: gold "Scrivi al tuo referente" + ghost "Prenota call" + link "Completa il briefing"
 *   - When assignee is null → calm hint "Il team dello studio sta assegnando il referente"
 *   - NO neon, NO "AI assistant" tone, NO support-agent chrome.
 */
import React, { useEffect, useState } from 'react';
import { Mail, CalendarClock, FileText, Clock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import MessageReferentModal from './MessageReferentModal';

const ClientHumanCard = ({ onBriefClick }) => {
  const [state, setState] = useState({ loading: true, assignment: null });
  const [msgOpen, setMsgOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/api/human-assignment/me');
        if (alive) setState({ loading: false, assignment: data?.assignment || null });
      } catch (_) {
        if (alive) setState({ loading: false, assignment: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  if (state.loading) {
    return <SkeletonCard />;
  }

  const a = state.assignment?.assignee;
  if (!a) {
    return <UnassignedHint />;
  }

  const initials = (a.first_name?.[0] || a.name?.[0] || '·').toUpperCase();
  const greetFirstName = a.first_name || a.name?.split(' ')[0] || '';

  return (
    <article data-testid="client-human-card"
             className="cp-card p-8 lg:p-10 grid grid-cols-12 gap-6 items-start">
      {/* Avatar */}
      <div className="col-span-12 sm:col-span-3 flex sm:block">
        <div
          aria-hidden
          className="w-[96px] h-[96px] rounded-full overflow-hidden
                     bg-[var(--cp-surface-2)] border border-[var(--cp-border)]
                     flex items-center justify-center"
        >
          {a.avatar_url ? (
            <img src={a.avatar_url} alt={a.name || 'Referent'} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[28px] tracking-[0.06em] text-[var(--cp-gold-soft)] font-heading">
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* Copy + CTAs */}
      <div className="col-span-12 sm:col-span-9">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-3">
          Il tuo referente
        </p>
        <h3 data-testid="client-human-card-name"
            className="font-heading text-[24px] leading-[1.15] text-[var(--cp-text-primary)] tracking-[-0.005em]">
          Ciao, sono {greetFirstName}.
        </h3>
        {a.role_label && (
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--cp-text-muted)] mt-2">
            {a.role_label}
          </p>
        )}
        {a.short_bio && (
          <p data-testid="client-human-card-bio"
             className="mt-5 text-[14px] leading-[1.7] text-[var(--cp-text-secondary)] font-body max-w-[58ch]">
            {a.short_bio}
          </p>
        )}

        {/* Response time */}
        <div className="mt-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--cp-text-muted)]">
          <Clock size={11} strokeWidth={1.5} />
          {a.response_time_label || 'Risponde in giornata'}
        </div>

        {/* CTAs */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="client-human-card-message"
            onClick={() => setMsgOpen(true)}
            className="cp-cta-gold inline-flex items-center gap-2 px-5 py-2.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <Mail size={13} strokeWidth={1.8} />
            {a.contact_cta_label || 'Scrivi al tuo referente'}
          </button>
          <button
            type="button"
            data-testid="client-human-card-call"
            onClick={() => toast.info(`${greetFirstName} ti contatterà per fissare la call.`)}
            className="cp-cta-ghost inline-flex items-center gap-2 px-5 py-2.5 text-[11px] uppercase tracking-[0.18em]"
          >
            <CalendarClock size={13} strokeWidth={1.8} />
            Prenota una call
          </button>
          {onBriefClick && (
            <button
              type="button"
              data-testid="client-human-card-brief"
              onClick={onBriefClick}
              className="inline-flex items-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.18em]
                         text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)] transition-colors"
            >
              <FileText size={13} strokeWidth={1.8} />
              Completa il briefing
            </button>
          )}
        </div>
      </div>
      <MessageReferentModal open={msgOpen} onClose={() => setMsgOpen(false)} assignee={a} />
    </article>
  );
};

const UnassignedHint = () => (
  <article data-testid="client-human-card-unassigned"
           className="cp-card p-8 lg:p-10 flex items-start gap-5">
    <div
      aria-hidden
      className="w-[64px] h-[64px] rounded-full
                 bg-[var(--cp-gold-bg)] border border-[var(--cp-border)]
                 flex items-center justify-center text-[var(--cp-gold-soft)]"
    >
      <Clock size={20} strokeWidth={1.4} />
    </div>
    <div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-2">
        Il tuo referente
      </p>
      <h3 className="font-heading text-[20px] leading-[1.2] text-[var(--cp-text-primary)] mb-2 tracking-[-0.005em]">
        Il team dello studio sta assegnando il referente più adatto al tuo progetto.
      </h3>
      <p className="text-[13px] text-[var(--cp-text-secondary)] font-body leading-relaxed max-w-[48ch]">
        Riceverai una conferma personale appena la persona giusta sarà disponibile.
      </p>
    </div>
  </article>
);

const SkeletonCard = () => (
  <article data-testid="client-human-card-loading"
           className="cp-card p-8 lg:p-10 grid grid-cols-12 gap-6 items-start">
    <div className="col-span-3">
      <div className="w-[96px] h-[96px] rounded-full bg-[var(--cp-surface-2)] animate-pulse" />
    </div>
    <div className="col-span-9 space-y-3">
      <div className="h-2 w-24 bg-[var(--cp-surface-2)] rounded animate-pulse" />
      <div className="h-7 w-72 bg-[var(--cp-surface-2)] rounded animate-pulse" />
      <div className="h-3 w-32 bg-[var(--cp-surface-2)] rounded animate-pulse" />
      <div className="h-3 w-full max-w-[42ch] bg-[var(--cp-surface-2)] rounded animate-pulse" />
    </div>
  </article>
);

export default ClientHumanCard;
