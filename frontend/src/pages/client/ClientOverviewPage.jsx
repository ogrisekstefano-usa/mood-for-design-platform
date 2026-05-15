/**
 * ClientOverviewPage — the heart of the Client Portal.
 *
 * Two states, one component:
 *   1. ZERO-DATA — when /api/client/overview returns `zero_data:true`
 *      → cinematic welcome experience (hero + how-it-works + what-you-will-find).
 *   2. HAS-DATA — when the client has at least one project
 *      → project hero card + ProjectProgressTracker + light cards
 *        (approvals_pending, moodboards, files stub).
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import ClientWelcomeHero from '../../components/client/ClientWelcomeHero';
import HowItWorksSection from '../../components/client/HowItWorksSection';
import WhatYouWillFindSection from '../../components/client/WhatYouWillFindSection';
import ProjectProgressTracker from '../../components/client/ProjectProgressTracker';

const ClientOverviewPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: d } = await api.get('/api/client/overview');
        if (alive) setData(d);
      } catch (e) {
        if (alive) {
          toast.error('Impossibile caricare il portale.');
          setData({ zero_data: true });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div data-testid="client-overview-loading" className="py-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-[var(--cp-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--cp-text-muted)]">
            Caricamento del tuo spazio
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.zero_data) {
    return <ZeroDataExperience />;
  }

  return <HasDataExperience data={data} />;
};

/* ─── Zero-data ─────────────────────────────────────────────────── */

const ZeroDataExperience = () => {
  const handleBrief = () => toast.info('Il briefing arriverà a breve dal tuo studio.');
  const handleCall  = () => toast.info('Il tuo studio ti contatterà per fissare la call.');
  const handleProc  = () => {
    const el = document.querySelector('[data-testid="client-how-it-works"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div data-testid="client-overview-zero" className="max-w-[1280px]">
      <ClientWelcomeHero
        onPrimary={handleBrief}
        onSecondary={handleCall}
        onTertiary={handleProc}
      />
      <HowItWorksSection />
      <WhatYouWillFindSection />
    </div>
  );
};

/* ─── Has-data ──────────────────────────────────────────────────── */

const HasDataExperience = ({ data }) => {
  const { project, pipeline, moodboards = [], approvals_pending = [], counts = {} } = data;
  const currentStage = (pipeline || []).find((s) => s.status === 'current');
  const currentLabel = currentStage?.label_it || 'In avvio';

  return (
    <div data-testid="client-overview-data" className="max-w-[1280px] space-y-8">
      {/* HERO PROJECT CARD */}
      <section
        data-testid="client-project-hero"
        className="cp-card relative overflow-hidden grid grid-cols-12 gap-0 min-h-[400px]"
      >
        <div className="col-span-12 lg:col-span-7 relative z-10 px-10 lg:px-12 py-10 lg:py-12 flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-5">
            Il tuo progetto
          </p>
          <h2 className="font-heading text-[44px] lg:text-[54px] leading-[1.05] tracking-[-0.012em] text-[var(--cp-text-primary)] max-w-[16ch]">
            {project.title || 'Il tuo progetto'}
          </h2>
          <div className="mt-5 h-px w-16 bg-[var(--cp-gold)] opacity-60" />
          {project.project_type && (
            <p className="mt-5 text-[14px] text-[var(--cp-text-secondary)] font-body">
              {project.project_type}
            </p>
          )}
          {project.location && (
            <p className="mt-1 text-[14px] text-[var(--cp-text-muted)] font-body">
              {project.location}
            </p>
          )}
          <div className="mt-8">
            <a
              href="/client/project"
              data-testid="client-project-cta"
              className="cp-cta-gold inline-flex items-center gap-2 px-6 py-3 text-[12px] uppercase tracking-[0.18em]"
            >
              Vai al progetto
              <ArrowUpRight size={14} strokeWidth={1.8} />
            </a>
          </div>
        </div>

        {/* Right side: cover */}
        <div className="col-span-12 lg:col-span-5 relative min-h-[260px]">
          {project.cover_url ? (
            <img
              src={project.cover_url}
              alt=""
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--cp-surface-3)] to-[var(--cp-surface-2)]" />
          )}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg, var(--cp-surface-1) 0%, transparent 36%, transparent 100%)' }}
          />
        </div>

        {/* Inset side card "Stato attuale" — desktop only */}
        <aside
          data-testid="client-status-card"
          className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 z-20
                     w-[300px] flex-col gap-2
                     bg-[var(--cp-surface-2)] border border-[var(--cp-border)]
                     rounded-[var(--cp-radius-md)]
                     px-6 py-6"
        >
          <ProjectProgressTracker pipeline={pipeline} currentLabel={currentLabel} variant="compact" />
        </aside>
      </section>

      {/* TIMELINE (full width) */}
      <section data-testid="client-timeline-card" className="cp-card px-10 py-10">
        <header className="mb-9 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-3">
              Timeline del progetto
            </p>
            <h3 className="font-heading text-[24px] leading-[1.15] text-[var(--cp-text-primary)] tracking-[-0.005em]">
              Sei a <span className="text-[var(--cp-gold)]">{currentLabel.toLowerCase()}</span>.
            </h3>
          </div>
          <a
            href="/client/timeline"
            data-testid="client-timeline-full-link"
            className="text-[11px] uppercase tracking-[0.18em] text-[var(--cp-text-muted)]
                       hover:text-[var(--cp-text-primary)] transition-colors"
          >
            Vedi timeline completa →
          </a>
        </header>
        <ProjectProgressTracker pipeline={pipeline} />
      </section>

      {/* GRID CARDS — moodboards + approvals */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Moodboards */}
        <article data-testid="client-moodboards-card" className="cp-card p-8 lg:col-span-7">
          <header className="flex items-baseline justify-between mb-6">
            <h4 className="font-heading text-[20px] text-[var(--cp-text-primary)]">Le tue moodboard</h4>
            <a href="/client/moodboards" className="text-[11px] uppercase tracking-[0.18em] text-[var(--cp-gold-soft)] hover:text-[var(--cp-gold)] transition-colors">
              Visualizza tutte →
            </a>
          </header>
          {moodboards.length === 0 ? (
            <EmptyHint
              icon={Sparkles}
              copy="Il nostro team sta preparando le tue moodboard."
            />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {moodboards.slice(0, 3).map((mb) => (
                <a key={mb.id} href={`/client/moodboards`} className="block group">
                  <div className="aspect-[4/3] rounded-[var(--cp-radius-sm)] overflow-hidden border border-[var(--cp-border)] bg-[var(--cp-surface-3)]">
                    {mb.cover_url ? (
                      <img src={mb.cover_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[var(--cp-text-subtle)]">
                        <Sparkles size={20} strokeWidth={1.2} />
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-[13px] text-[var(--cp-text-primary)] font-body leading-tight">{mb.title}</p>
                  {mb.status && (
                    <p className="text-[11px] text-[var(--cp-text-muted)] mt-0.5 capitalize">{mb.status}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </article>

        {/* Approvals */}
        <article data-testid="client-approvals-card" className="cp-card p-8 lg:col-span-5">
          <header className="flex items-baseline justify-between mb-6">
            <h4 className="font-heading text-[20px] text-[var(--cp-text-primary)]">Da approvare</h4>
            <a href="/client/approvals" className="text-[11px] uppercase tracking-[0.18em] text-[var(--cp-gold-soft)] hover:text-[var(--cp-gold)] transition-colors">
              Tutte →
            </a>
          </header>
          {approvals_pending.length === 0 ? (
            <EmptyHint
              icon={Sparkles}
              copy="Le prime proposte del tuo progetto stanno arrivando."
            />
          ) : (
            <ul className="space-y-4">
              {approvals_pending.slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 pb-4 border-b border-[var(--cp-border)] last:border-b-0 last:pb-0">
                  <div>
                    <p className="text-[14px] text-[var(--cp-text-primary)] font-body leading-tight">{p.title || 'Proposta'}</p>
                    <p className="text-[11px] text-[var(--cp-text-muted)] mt-1 capitalize">{(p.status || '').replace('_', ' ')}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--cp-gold)] shrink-0">v{p.version || 1}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
};

/* ─── Empty hint — premium copy for in-card empty states ─────── */
const EmptyHint = ({ icon: Icon, copy }) => (
  <div className="flex items-center gap-3 py-2">
    <span
      aria-hidden
      className="w-9 h-9 rounded-full flex items-center justify-center
                 bg-[var(--cp-gold-bg)] border border-[var(--cp-border)]
                 text-[var(--cp-gold-soft)]"
    >
      <Icon size={15} strokeWidth={1.5} />
    </span>
    <p className="text-[13px] text-[var(--cp-text-secondary)] leading-relaxed font-body italic">
      {copy}
    </p>
  </div>
);

export default ClientOverviewPage;
