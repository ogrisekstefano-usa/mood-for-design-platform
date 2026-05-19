/**
 * DashboardPage — Daily Design Operations Cockpit™ · MOOD for DESIGN™
 *
 * NON è una dashboard SaaS, NON è un pannello KPI.
 * È il cockpit operativo dello studio: priorità · relazioni · suggerimenti.
 *
 * Performance strategy (sub-1s perceived):
 *   1. Hero rendered IMMEDIATAMENTE (no fetch, just user.first_name)
 *   2. Cache stale-while-revalidate via sessionStorage (key v3)
 *   3. Skeleton per ogni sezione — mai schermata vuota
 *   4. Lazy code-split per sezioni below-the-fold
 *   5. Fetch parallelo background con AbortController
 *
 * Architettura UX (Phase 1):
 *   • 1 · Daily Studio Status™ (hero operativo + 4 CTA)
 *   • 2 · Suggested Next Actions™ (decisioni intelligenti da dati reali)
 *   • 3 · Quick Actions™ (4 cluster premium)
 *   • 4 · Studio Attention™ (rename projects-requiring-attention)
 *   • 5 · Relationship Engine™ (top relazioni che chiedono presenza)
 *   • 6 · Timeline operativa migliorata
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';
import './dashboard-cockpit.css';

// Lazy below-the-fold sections — ridotti dal bundle iniziale.
const StudioOnboardingPanel = lazy(() => import('../../components/dashboard/StudioOnboardingPanel'));
const AssignedClientsPanel  = lazy(() => import('../../components/dashboard/AssignedClientsPanel'));
const CockpitTimeline       = lazy(() => import('./CockpitTimeline'));

const CACHE_KEY = 'mfd_cockpit_cache_v3';
const CACHE_TTL_MS = 90_000;

// ── utils ────────────────────────────────────────────────────────────
const initials = (name) => (name || '?').split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

const fmtDaysSince = (n) => {
  if (n === null || n === undefined) return 'nessun contatto registrato';
  if (n === 0) return 'oggi';
  if (n === 1) return '1 giorno fa';
  if (n < 30) return `${n} giorni fa`;
  return `oltre ${Math.floor(n / 30)} mese fa`;
};

const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.round(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h fa`;
  if (diff < 604800) return `${Math.round(diff / 86400)}g fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

const greetingFor = () => {
  const h = new Date().getHours();
  return h < 6 ? 'Buona notte' : h < 13 ? 'Buongiorno' : h < 19 ? 'Buon pomeriggio' : 'Buonasera';
};

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.t || (Date.now() - parsed.t) > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch { return null; }
};
const writeCache = (data) => {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); }
  catch { /* sessionStorage may be unavailable in privacy mode */ }
};

// ═══════════════════════════════════════════════════════════════════════
// 1 · DAILY STUDIO STATUS™ — Hero operativo
// ═══════════════════════════════════════════════════════════════════════
const DailyStudioStatus = ({ firstName, summary, suggested, attentionCount, relCount, loading }) => {
  const runtime = useLocaleRuntime();
  const greeting = greetingFor();

  // Costruisce frasi operative editoriali dai dati reali aggregati.
  const sentences = [];
  if (Array.isArray(summary)) {
    summary.slice(0, 3).forEach((s) => sentences.push({ text: s.text, to: s.to, icon: s.icon }));
  }
  if (sentences.length < 3 && attentionCount > 0) {
    sentences.push({
      text: `${attentionCount} ${attentionCount === 1 ? 'progetto richiede' : 'progetti richiedono'} attenzione.`,
      to: '/workspace/projects', icon: 'Folder',
    });
  }
  if (sentences.length < 3 && relCount > 0) {
    sentences.push({
      text: `${relCount} ${relCount === 1 ? 'relazione attende' : 'relazioni attendono'} un gesto.`,
      to: '/crm/accounts', icon: 'Users',
    });
  }

  return (
    <section className="cck-hero" data-testid="cockpit-hero">
      <div className="cck-hero__glow" />
      <p className="cck-hero__eyebrow" data-testid="cockpit-hero-eyebrow">
        Daily Studio Status™ · {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
      </p>
      <h1 className="cck-hero__greeting" data-testid="cockpit-hero-greeting">
        {greeting}, <span className="cck-hero__name">{firstName || 'Designer'}.</span>
      </h1>

      {loading && sentences.length === 0 ? (
        <ul className="cck-hero__sentences" aria-busy="true">
          <li className="cck-skel cck-skel--line cck-skel--w70" />
          <li className="cck-skel cck-skel--line cck-skel--w55" />
          <li className="cck-skel cck-skel--line cck-skel--w60" />
        </ul>
      ) : sentences.length > 0 ? (
        <ul className="cck-hero__sentences" data-testid="cockpit-hero-sentences">
          {sentences.slice(0, 3).map((s, i) => {
            const Icon = Icons[s.icon] || Icons.ChevronRight;
            return (
              <li key={i}>
                <Link to={s.to || '#'} className="cck-hero__sentence">
                  <Icon size={13} strokeWidth={1.6} className="cck-hero__sentence-icon" />
                  <span>{s.text}</span>
                  <Icons.ArrowUpRight size={11} strokeWidth={1.6} className="cck-hero__sentence-arrow" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cck-hero__quiet" data-testid="cockpit-hero-quiet">
          {runtime.copy('dashboard.hero.empty') ||
           'Studio in quiete editoriale. È il momento ideale per iniziare un nuovo progetto o riaprire una relazione.'}
        </p>
      )}

      <div className="cck-hero__ctas" data-testid="cockpit-hero-ctas">
        <Link to="/workspace/projects?new=1" className="cck-cta cck-cta--paper" data-testid="cck-hero-cta-project">
          <Icons.Plus size={12} /> Nuovo progetto
        </Link>
        <Link to="/moodboards?new=1" className="cck-cta" data-testid="cck-hero-cta-moodboard">
          <Icons.Layers size={12} /> Nuova moodboard
        </Link>
        <Link to="/crm/accounts?new=1" className="cck-cta" data-testid="cck-hero-cta-account">
          <Icons.UserPlus size={12} /> Nuovo account
        </Link>
        <Link to="/workspace/cultural-editions?new=1" className="cck-cta cck-cta--accent" data-testid="cck-hero-cta-edition">
          <Icons.Globe size={12} /> Cultural Edition™
        </Link>
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 2 · SUGGESTED NEXT ACTIONS™ — Decisioni editoriali intelligenti
// ═══════════════════════════════════════════════════════════════════════
const KIND_ICON = {
  stale_project:    'Folder',
  lead_followup:    'Sparkles',
  proposal_silent:  'FileText',
  moodboard_warm:   'Layers',
};

const SuggestedNextActions = ({ suggestions, loading }) => (
  <section className="cck-block" data-testid="cockpit-suggested-actions">
    <header className="cck-block__head">
      <div>
        <p className="cck-block__eyebrow">Suggested Next Actions™</p>
        <h3 className="cck-block__title">Decisioni che la giornata sussurra</h3>
      </div>
    </header>
    {loading && (!suggestions || suggestions.length === 0) ? (
      <div className="cck-grid-3" data-testid="cockpit-suggested-skeleton">
        {[0, 1, 2].map((i) => (
          <div key={i} className="cck-suggest cck-suggest--skel">
            <div className="cck-skel cck-skel--icon" />
            <div className="cck-skel cck-skel--line cck-skel--w90" />
            <div className="cck-skel cck-skel--line cck-skel--w70" />
            <div className="cck-skel cck-skel--line cck-skel--w40" />
          </div>
        ))}
      </div>
    ) : suggestions && suggestions.length > 0 ? (
      <div className="cck-grid-3">
        {suggestions.slice(0, 3).map((s) => {
          const Icon = Icons[KIND_ICON[s.kind]] || Icons.Sparkles;
          return (
            <Link key={s.id} to={s.cta_to} className="cck-suggest" data-testid={`cockpit-suggest-${s.kind}-${s.id}`}>
              <span className="cck-suggest__ring">
                <Icon size={14} strokeWidth={1.6} />
              </span>
              <h4 className="cck-suggest__headline">{s.headline}</h4>
              <p className="cck-suggest__reason">{s.reason}</p>
              <span className="cck-suggest__cta">
                {s.cta_label} <Icons.ArrowUpRight size={11} strokeWidth={1.7} />
              </span>
            </Link>
          );
        })}
      </div>
    ) : (
      <div className="cck-empty">
        <Icons.Compass size={22} strokeWidth={1.2} className="cck-empty__icon" />
        <p className="cck-empty__title">MOOD sta iniziando a leggere il ritmo del tuo studio.</p>
        <p className="cck-empty__hint">I primi suggerimenti appariranno con l'utilizzo reale della piattaforma.</p>
      </div>
    )}
  </section>
);

// ═══════════════════════════════════════════════════════════════════════
// 3 · QUICK ACTIONS™ — 4 cluster editoriali premium
// ═══════════════════════════════════════════════════════════════════════
const QUICK_CLUSTERS = [
  {
    id: 'relationship',
    title: 'Relationship',
    glyph: 'Users',
    items: [
      { label: 'Nuovo Account',         to: '/crm/accounts?new=1',         icon: 'UserPlus' },
      { label: 'Nuovo Contatto',        to: '/crm/contacts?new=1',         icon: 'User' },
      { label: 'Registra visita',       to: '/crm/accounts?action=visit',  icon: 'MapPin' },
      { label: 'Registra chiamata',     to: '/crm/accounts?action=call',   icon: 'Phone' },
      { label: 'Nuovo follow-up',       to: '/crm/accounts?action=note',   icon: 'MessageCircle' },
    ],
  },
  {
    id: 'projects',
    title: 'Progetti',
    glyph: 'Folder',
    items: [
      { label: 'Nuovo progetto',        to: '/workspace/projects?new=1',   icon: 'Plus' },
      { label: 'Nuova moodboard',       to: '/moodboards?new=1',           icon: 'Layers' },
      { label: 'Apri progetti in corso',to: '/workspace/projects',         icon: 'FolderOpen' },
    ],
  },
  {
    id: 'international',
    title: 'Internazionalizzazione',
    glyph: 'Globe',
    items: [
      { label: 'Crea Cultural Edition™', to: '/workspace/cultural-editions?new=1', icon: 'Globe2' },
      { label: 'Market Resonance™',      to: '/admin/market-matrix',               icon: 'Compass' },
    ],
  },
  {
    id: 'editorial',
    title: 'Editorial',
    glyph: 'BookOpen',
    items: [
      { label: 'Apri Inspirations™',    to: '/inspirations',               icon: 'Sparkles' },
      { label: 'Nuovo contenuto',       to: '/magazine?new=1',             icon: 'Feather' },
      { label: 'Carica riferimenti',    to: '/library?upload=1',           icon: 'Upload' },
    ],
  },
];

const QuickActions = () => (
  <section className="cck-block" data-testid="cockpit-quick-actions">
    <header className="cck-block__head">
      <div>
        <p className="cck-block__eyebrow">Quick Actions™</p>
        <h3 className="cck-block__title">Cosa vuoi fare ora?</h3>
      </div>
    </header>
    <div className="cck-quick-grid">
      {QUICK_CLUSTERS.map((c) => {
        const Glyph = Icons[c.glyph] || Icons.Square;
        return (
          <div key={c.id} className="cck-quick-cluster" data-testid={`cockpit-quick-cluster-${c.id}`}>
            <div className="cck-quick-cluster__head">
              <Glyph size={12} className="cck-quick-cluster__glyph" />
              <span>{c.title}</span>
            </div>
            <div className="cck-quick-cluster__items">
              {c.items.map((it, i) => {
                const Icon = Icons[it.icon] || Icons.Circle;
                return (
                  <Link key={i} to={it.to} className="cck-quick-item"
                        data-testid={`cockpit-quick-${c.id}-${i}`}>
                    <span className="cck-quick-item__icon"><Icon size={12} strokeWidth={1.6} /></span>
                    <span className="cck-quick-item__label">{it.label}</span>
                    <Icons.ArrowUpRight size={10} className="cck-quick-item__arrow" />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

// ═══════════════════════════════════════════════════════════════════════
// 4 · STUDIO ATTENTION™ — progetti che chiedono presenza
// ═══════════════════════════════════════════════════════════════════════
const StudioAttention = ({ projects, staleIds = [], loading }) => {
  const staleSet = new Set(staleIds);
  return (
    <section className="cck-block" data-testid="cockpit-studio-attention">
      <header className="cck-block__head">
        <div>
          <p className="cck-block__eyebrow">Studio Attention™</p>
          <h3 className="cck-block__title">Progetti che chiedono la tua presenza</h3>
        </div>
        <Link to="/workspace/projects" className="cck-block__link" data-testid="cockpit-attention-all">
          Vedi tutti <Icons.ArrowUpRight size={11} />
        </Link>
      </header>
      {loading && (!projects || projects.length === 0) ? (
        <div className="cck-grid-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="cck-attn cck-attn--skel">
              <div className="cck-skel cck-skel--cover" />
              <div className="cck-skel cck-skel--line cck-skel--w80" />
              <div className="cck-skel cck-skel--line cck-skel--w50" />
            </div>
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="cck-grid-4">
          {projects.slice(0, 4).map((p) => {
            const stale = staleSet.has(p.id);
            return (
              <Link key={p.id} to={`/workspace/projects/${p.id}`}
                    className={`cck-attn ${stale ? 'cck-attn--stale' : ''}`}
                    data-testid={`cockpit-attention-project-${p.id}`}>
                <div className="cck-attn__cover">
                  {p.cover_url ? (
                    <img src={p.cover_url} alt={p.title} loading="lazy" />
                  ) : (
                    <Icons.FolderOpen size={22} strokeWidth={1.2} className="cck-attn__cover-fallback" />
                  )}
                  {stale && (
                    <span className="cck-attn__pill">
                      <span className="cck-pulse" /> Da riprendere
                    </span>
                  )}
                </div>
                <h4 className="cck-attn__title">{p.title}</h4>
                <p className="cck-attn__meta">{p.project_type || p.status || 'progetto'}</p>
                <div className="cck-attn__bar">
                  <div className="cck-attn__bar-fill" style={{ width: `${p.progress || 0}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="cck-empty">
          <Icons.FolderOpen size={22} strokeWidth={1.2} className="cck-empty__icon" />
          <p className="cck-empty__title">Nessun progetto richiede attenzione ora.</p>
          <p className="cck-empty__hint">I progetti convertiti dai lead appariranno qui.</p>
        </div>
      )}
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 5 · RELATIONSHIP ENGINE™ — top relazioni
// ═══════════════════════════════════════════════════════════════════════
const REL_KIND_LABEL = {
  meeting:      'incontro',
  call:         'chiamata',
  email:        'email',
  visit:        'visita',
  note:         'nota',
  voice_note:   'memo',
  ai_summary:   'edizione culturale',
  showroom_visit: 'visita showroom',
};

const RelationshipEngine = ({ rows, loading }) => {
  const navigate = useNavigate();
  return (
    <section className="cck-block" data-testid="cockpit-relationship-engine">
      <header className="cck-block__head">
        <div>
          <p className="cck-block__eyebrow">Relationship Engine™</p>
          <h3 className="cck-block__title">Le relazioni che attendono un gesto</h3>
        </div>
        <Link to="/crm/accounts" className="cck-block__link" data-testid="cockpit-rel-all">
          Tutti gli account <Icons.ArrowUpRight size={11} />
        </Link>
      </header>
      {loading && (!rows || rows.length === 0) ? (
        <div className="cck-rel-list">
          {[0,1,2,3].map((i) => (
            <div key={i} className="cck-rel cck-rel--skel">
              <div className="cck-skel cck-skel--avatar" />
              <div className="cck-skel cck-skel--line cck-skel--w60" />
              <div className="cck-skel cck-skel--line cck-skel--w30" />
            </div>
          ))}
        </div>
      ) : rows && rows.length > 0 ? (
        <div className="cck-rel-list">
          {rows.slice(0, 6).map((r) => {
            const cold = (r.days_since || 0) >= 14;
            return (
              <div key={r.account_id} className="cck-rel" data-testid={`cockpit-rel-${r.account_id}`}>
                <span className={`cck-rel__avatar ${cold ? 'cck-rel__avatar--cold' : ''}`}>
                  {initials(r.name)}
                </span>
                <div className="cck-rel__body">
                  <div className="cck-rel__row1">
                    <Link to={`/crm/accounts/${r.account_id}`} className="cck-rel__name">{r.name}</Link>
                    {r.market_code && (
                      <span className="cck-rel__market">
                        <Icons.MapPin size={9} /> {r.market_code}
                      </span>
                    )}
                  </div>
                  <p className="cck-rel__meta">
                    Ultimo {REL_KIND_LABEL[r.last_kind] || 'contatto'} · {fmtDaysSince(r.days_since)}
                  </p>
                </div>
                <div className="cck-rel__actions">
                  <button type="button" title="Registra nota" onClick={() => navigate(`/crm/accounts/${r.account_id}?action=note`)}
                          className="cck-rel__act" data-testid={`cockpit-rel-act-note-${r.account_id}`}>
                    <Icons.MessageCircle size={11} />
                  </button>
                  <button type="button" title="Apri timeline" onClick={() => navigate(`/crm/accounts/${r.account_id}`)}
                          className="cck-rel__act cck-rel__act--primary" data-testid={`cockpit-rel-act-open-${r.account_id}`}>
                    <Icons.ArrowUpRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cck-empty">
          <Icons.Users size={22} strokeWidth={1.2} className="cck-empty__icon" />
          <p className="cck-empty__title">Nessuna relazione raffreddata.</p>
          <p className="cck-empty__hint">Quando un account passa giorni senza un gesto, apparirà qui.</p>
        </div>
      )}
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN — Cockpit Page
// ═══════════════════════════════════════════════════════════════════════
const DashboardPage = () => {
  const { user } = useAuth();
  const firstName = user?.first_name || (user?.email || '').split('@')[0];

  // Cache stale-while-revalidate — dati istantanei al mount se presenti
  const [data, setData] = useState(() => readCache());
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);
  const reloadRef = useRef(0);

  useEffect(() => {
    const ctrl = new AbortController();
    if (!data) setLoading(true);
    api.get('/api/dashboard/summary', { signal: ctrl.signal })
      .then((r) => {
        setData(r.data);
        writeCache(r.data);
        setError(null);
      })
      .catch((e) => {
        if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
        const status = e?.response?.status;
        // Se ho già dati da cache, NON mostro errore (background refresh)
        if (!data) {
          setError({
            status,
            message: status === 403
              ? 'Questa dashboard è riservata ai membri dello studio.'
              : 'Impossibile caricare il cockpit in questo momento.',
          });
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [reloadRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Error full-page solo se non c'è nulla in cache
  if (error && !data) {
    return (
      <div data-testid="dashboard-error" className="cck-error">
        <div className="cck-error__icon">
          <Icons.AlertCircle size={20} strokeWidth={1.3} />
        </div>
        <p className="cck-error__eyebrow">{error.status === 403 ? 'Accesso limitato' : 'Errore'}</p>
        <h1 className="cck-error__title">{error.message}</h1>
        {error.status !== 403 && (
          <button type="button" onClick={() => { reloadRef.current += 1; setError(null); }}
                  data-testid="dashboard-retry-btn" className="cck-error__btn">
            <Icons.RotateCcw size={12} /> Riprova
          </button>
        )}
      </div>
    );
  }

  const d = data || {};

  return (
    <div data-testid="dashboard-page" className="cck-page">
      {/* 1 · Daily Studio Status™ — render immediato anche senza fetch */}
      <DailyStudioStatus
        firstName={firstName}
        summary={d.operational_summary}
        suggested={d.suggested_actions}
        attentionCount={(d.stale_project_ids || []).length}
        relCount={(d.relationship_engine || []).length}
        loading={loading}
      />

      {/* Studio onboarding (lazy) — auto-hide */}
      <Suspense fallback={null}>
        <StudioOnboardingPanel />
      </Suspense>
      <Suspense fallback={null}>
        <AssignedClientsPanel />
      </Suspense>

      {/* 2 · Suggested Next Actions™ */}
      <SuggestedNextActions suggestions={d.suggested_actions} loading={loading} />

      {/* 3 · Quick Actions™ */}
      <QuickActions />

      {/* 4 · Studio Attention™ */}
      <StudioAttention
        projects={d.featured_projects}
        staleIds={d.stale_project_ids}
        loading={loading}
      />

      {/* 5 · Relationship Engine™ */}
      <RelationshipEngine rows={d.relationship_engine} loading={loading} />

      {/* 6 · Timeline operativa migliorata (lazy) */}
      <Suspense fallback={<div className="cck-block cck-block--skel" style={{ height: 220 }} />}>
        <CockpitTimeline events={d.timeline} activity={d.recent_activity} />
      </Suspense>
    </div>
  );
};

export default DashboardPage;
