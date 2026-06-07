/**
 * AtelierDashboardPage — "Editorial Studio" redesign (Feb 2026 · Stefano brief)
 *
 * Trasformazione: da console amministrativa a "spazio che ispira azione,
 * progettazione e crescita del business" (Apple / Notion / AD / Mohd refs).
 *
 * Struttura:
 *   1. HERO IMMERSIVO       — full-width · overlay · headline editoriale (NO KPI)
 *   2. IN EVIDENZA OGGI     — single card · spotlight da /dashboard/ecosystem-snapshot
 *   3. COSA PUOI FARE ADESSO — 4 destinazioni visuali (Netflix-style)
 *   4. I TUOI PROGETTI ATTIVI — max 5 · card immagine + nome + stato + ultimo movimento + cliente
 *   5. MOOD INTELLIGENCE™   — suggerimenti calcolati live (no LLM)
 *   6. ECOSISTEMA MOOD™     — 8 KPI patrimonio digitale
 *   7. Sidebar destra        — PendingBookings + RelationshipLiveTimeline
 *
 * Endpoint:
 *   GET /api/atelier/dashboard/config        (hero media · invariato)
 *   GET /api/dashboard/pulse                 (active journeys · invariato)
 *   GET /api/dashboard/ecosystem-snapshot    (NUOVO · spotlight + intel + ecosystem)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, Sparkles, Compass, Layers, FileSignature, Layout,
  Package, Users, TrendingUp, Folder, AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useT, useBlueprint } from '../../contexts/BlueprintContext';
import RelationshipLiveTimeline from '../../components/dashboard/RelationshipLiveTimeline';
import PendingBookingsPanel from '../../components/booking/PendingBookingsPanel';
import './atelier-dashboard.css';
import './atelier-dashboard-editorial.css';

// ── Helpers ─────────────────────────────────────────────────────────
const greetSlot = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
};

const relativeWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000 / 60 / 60;
  if (diff < 1) return 'pochi minuti fa';
  if (diff < 24) return `${Math.floor(diff)}h fa`;
  const days = Math.floor(diff / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} giorni fa`;
  return d.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
};

const statusLabel = (status) => {
  const map = {
    in_progress:        { label: 'IN CORSO',     tone: 'cyan' },
    active:             { label: 'ATTIVA',       tone: 'cyan' },
    presenting:         { label: 'IN REVISIONE', tone: 'amber' },
    in_review:          { label: 'IN REVISIONE', tone: 'amber' },
    conversation_open:  { label: 'NUOVO',        tone: 'cyan' },
    drifting:           { label: 'IN ASCOLTO',   tone: 'mute' },
    approved:           { label: 'APPROVATA',    tone: 'cyan' },
    closed:             { label: 'CONSEGNATA',   tone: 'mute' },
    on_pause:           { label: 'IN PAUSA',     tone: 'mute' },
    draft:              { label: 'BOZZA',        tone: 'mute' },
  };
  return map[status] || { label: 'ATTIVO', tone: 'cyan' };
};

// ── Hero (no KPI) ──────────────────────────────────────────────────
const Hero = ({ config, userName }) => {
  const slot = greetSlot();
  const greeting = slot === 'morning' ? 'Buongiorno' : slot === 'afternoon' ? 'Buon pomeriggio' : 'Buonasera';
  const heroSrc = config?.hero_media?.file_url;
  const heroAlt = config?.hero_media?.alt_text || '';
  const focal = config?.hero_media
    ? `${(config.hero_media.focal_point_x * 100).toFixed(1)}% ${(config.hero_media.focal_point_y * 100).toFixed(1)}%`
    : '50% 50%';

  return (
    <header className="atd-hero atd-hero--editorial" data-testid="atelier-hero">
      <div className="atd-hero__bg">
        {heroSrc && (
          <img src={heroSrc} alt={heroAlt} loading="eager"
               style={{ objectPosition: focal }} />
        )}
        <div className="atd-hero__veil" aria-hidden />
      </div>
      <div className="atd-hero__caption">
        <p className="atd-hero__eyebrow" data-testid="atelier-hero-eyebrow">Lo studio · oggi</p>
        <h1 className="atd-hero__title" data-testid="atelier-hero-title">
          {greeting}, {userName || ''}.
        </h1>
        <p className="atd-hero__lede" data-testid="atelier-hero-lede">
          Ecco cosa sta accadendo oggi nel tuo studio.
        </p>
      </div>
    </header>
  );
};

// ── Spotlight · IN EVIDENZA OGGI ──────────────────────────────────
const Spotlight = ({ data }) => {
  if (!data) return null;
  const toneClass = `atd-spotlight--${data.tone || 'cyan'}`;
  return (
    <section className={`atd-spotlight ${toneClass}`} data-testid="atelier-spotlight">
      <div className="atd-spotlight__eyebrow">In evidenza oggi</div>
      <div className="atd-spotlight__body">
        <h2 className="atd-spotlight__title" data-testid="atelier-spotlight-title">
          {data.title}
        </h2>
        <p className="atd-spotlight__subtitle">{data.subtitle}</p>
      </div>
      <Link to={data.cta_href || '#'} className="atd-spotlight__cta"
            data-testid="atelier-spotlight-cta">
        {data.cta_label || 'Apri'}
        <ArrowUpRight size={16} strokeWidth={1.6} />
      </Link>
    </section>
  );
};

// ── Cosa puoi fare adesso · 4 destinations (Netflix/Apple TV style) ──
const ACTION_DESTINATIONS = [
  {
    id: 'new-journey',
    eyebrow: 'Apri un nuovo capitolo',
    title: 'Nuovo Design Journey',
    description: 'Avvia un progetto e guida il cliente attraverso ogni passaggio creativo.',
    href: '/workspace/projects?new=1',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'new-moodboard',
    eyebrow: 'Componi l\'ispirazione',
    title: 'Crea una Moodboard',
    description: 'Comporre un racconto visivo utilizzando prodotti e materiali certificati.',
    href: '/moodboards',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'material-board',
    eyebrow: 'Costruisci la palette',
    title: 'Material Board',
    description: 'Una selezione professionale di materiali, finiture e campioni.',
    href: '/material-boards',
    image: 'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'client-presentation',
    eyebrow: 'Prepara il momento',
    title: 'Presentazione Cliente',
    description: 'Una presentazione elegante, costruita per chiudere il progetto.',
    href: '/project-stories',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
  },
];

const ActionDestinationsGrid = () => (
  <section className="atd-destinations" data-testid="atelier-destinations">
    <header className="atd-section__head">
      <div>
        <p className="atd-section__eyebrow">Apertura</p>
        <h2 className="atd-section__title">Cosa puoi fare adesso</h2>
      </div>
    </header>
    <div className="atd-destinations__grid">
      {ACTION_DESTINATIONS.map((d) => (
        <Link key={d.id} to={d.href} className="atd-dest-card"
              data-testid={`atelier-destination-${d.id}`}>
          <div className="atd-dest-card__bg" aria-hidden>
            <img src={d.image} alt="" loading="lazy" />
            <div className="atd-dest-card__veil" />
          </div>
          <div className="atd-dest-card__body">
            <p className="atd-dest-card__eyebrow">{d.eyebrow}</p>
            <h3 className="atd-dest-card__title">{d.title}</h3>
            <p className="atd-dest-card__desc">{d.description}</p>
            <span className="atd-dest-card__cta">
              Entra <ArrowUpRight size={14} strokeWidth={1.6} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  </section>
);

// ── Progetti attivi · card editoriali ──────────────────────────────
const ProjectsRail = ({ projects, fallbackMedia }) => {
  if (!projects || projects.length === 0) {
    return (
      <section className="atd-projects atd-projects--editorial" data-testid="atelier-projects-section">
        <header className="atd-section__head">
          <div>
            <p className="atd-section__eyebrow">In atelier</p>
            <h2 className="atd-section__title">I tuoi progetti attivi</h2>
          </div>
        </header>
        <div className="atd-projects__empty" data-testid="atelier-projects-empty">
          <p>Nessun progetto attivo. Avvia il primo Design Journey per iniziare il racconto.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="atd-projects atd-projects--editorial" data-testid="atelier-projects-section">
      <header className="atd-section__head">
        <div>
          <p className="atd-section__eyebrow">In atelier</p>
          <h2 className="atd-section__title">I tuoi progetti attivi</h2>
        </div>
        <Link to="/workspace/projects" className="atd-section__cta"
              data-testid="atd-see-all-projects">
          Vedi tutti i progetti
          <ArrowUpRight size={13} strokeWidth={1.6} />
        </Link>
      </header>
      <div className="atd-projects-rail">
        {projects.slice(0, 5).map((p, i) => {
          const fallback = fallbackMedia?.[i % Math.max(fallbackMedia.length, 1)];
          const cover = p.cover_url || fallback?.file_url;
          const focal = fallback
            ? `${(fallback.focal_point_x * 100).toFixed(1)}% ${(fallback.focal_point_y * 100).toFixed(1)}%`
            : '50% 50%';
          const { label, tone } = statusLabel(p.lifecycle_state || p.status || 'in_progress');
          const title = p.title || p.account_name || 'Progetto senza nome';
          const client = p.account_name || p.client_name || '—';
          const lastMove = p.last_event?.label || p.current_milestone?.label || 'Avviato';
          const lastWhen = relativeWhen(p.last_event?.when || p.last_evolved_at || p.updated_at);

          return (
            <Link
              key={p.journey_id || p.id || i}
              to={p.project_id ? `/workspace/projects/${p.project_id}` : '/workspace/projects'}
              className="atd-proj-card"
              data-testid={`atelier-project-card-${i}`}
            >
              <div className="atd-proj-card__cover">
                {cover && <img src={cover} alt="" loading="lazy" style={{ objectPosition: focal }} />}
                <div className="atd-proj-card__veil" />
                <span className={`atd-proj-card__badge atd-proj-card__badge--${tone}`}>{label}</span>
              </div>
              <div className="atd-proj-card__body">
                <h3 className="atd-proj-card__title">{title}</h3>
                <p className="atd-proj-card__client">{client}</p>
                <p className="atd-proj-card__move">
                  <span className="atd-proj-card__move-label">{lastMove}</span>
                  {lastWhen && <span className="atd-proj-card__move-when"> · {lastWhen}</span>}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

// ── Mood Intelligence ──────────────────────────────────────────────
const INTEL_ICON = {
  users: Users, layout: Layout, compass: Compass, folder: Folder,
  package: Package, 'trending-up': TrendingUp, default: AlertCircle,
};
const IntelligenceGrid = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <section className="atd-intelligence" data-testid="atelier-intelligence">
        <header className="atd-section__head">
          <div>
            <p className="atd-section__eyebrow">Mood Intelligence™</p>
            <h2 className="atd-section__title">MOOD suggerisce per te</h2>
          </div>
        </header>
        <div className="atd-intelligence__empty">
          Lo studio è in equilibrio. Nessun suggerimento per oggi.
        </div>
      </section>
    );
  }
  return (
    <section className="atd-intelligence" data-testid="atelier-intelligence">
      <header className="atd-section__head">
        <div>
          <p className="atd-section__eyebrow">Mood Intelligence™</p>
          <h2 className="atd-section__title">MOOD suggerisce per te</h2>
        </div>
        <span className="atd-section__cta atd-section__cta--passive">
          Calcolato dal Knowledge Engine
          <Sparkles size={13} strokeWidth={1.6} />
        </span>
      </header>
      <div className="atd-intelligence__grid">
        {items.slice(0, 4).map((s) => {
          const Icon = INTEL_ICON[s.icon] || INTEL_ICON.default;
          return (
            <Link key={s.id} to={s.cta_href || '#'} className="atd-intel-card"
                  data-testid={`atelier-intel-${s.id}`}>
              <span className="atd-intel-card__icon">
                <Icon size={18} strokeWidth={1.6} />
              </span>
              <div className="atd-intel-card__body">
                <h4 className="atd-intel-card__title">{s.title}</h4>
                <p className="atd-intel-card__subtitle">{s.subtitle}</p>
              </div>
              <span className="atd-intel-card__cta">
                {s.cta_label}
                <ArrowUpRight size={13} strokeWidth={1.5} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

// ── Ecosistema MOOD™ ───────────────────────────────────────────────
const ECOSYSTEM_TILES = [
  { key: 'brands',        label: 'Brand certificati' },
  { key: 'products',      label: 'Prodotti' },
  { key: 'materials',     label: 'Materiali' },
  { key: 'designers',     label: 'Designer' },
  { key: 'images',        label: 'Immagini' },
  { key: 'moodboards',    label: 'Moodboard' },
  { key: 'journeys',      label: 'Design Journey' },
  { key: 'presentations', label: 'Presentazioni' },
];
const Ecosystem = ({ data }) => (
  <section className="atd-ecosystem" data-testid="atelier-ecosystem">
    <header className="atd-section__head">
      <div>
        <p className="atd-section__eyebrow">Patrimonio</p>
        <h2 className="atd-section__title">Il tuo ecosistema MOOD™</h2>
      </div>
    </header>
    <div className="atd-ecosystem__grid">
      {ECOSYSTEM_TILES.map((t) => {
        const v = (data && data[t.key]) || 0;
        return (
          <div key={t.key} className="atd-eco-tile" data-testid={`atelier-eco-${t.key}`}>
            <div className="atd-eco-tile__value">{Number(v).toLocaleString('it-IT')}</div>
            <div className="atd-eco-tile__label">{t.label}</div>
          </div>
        );
      })}
    </div>
  </section>
);

// ── Recent Activity · timeline narrativa ──────────────────────────
const friendlyActivity = (e) => {
  // Normalizza l'evento in una frase comprensibile per il titolare
  if (e.chapter) return e.chapter;
  if (e.text)    return e.text;
  if (e.label)   return e.label;
  const k = (e.kind || e.chapter_kind || e.canon || '').toLowerCase();
  if (k.includes('moodboard')) return 'Aggiornamento moodboard';
  if (k.includes('milestone')) return 'Tappa raggiunta';
  if (k.includes('message') || k.includes('voice')) return 'Nuovo messaggio';
  if (k.includes('approval') || k.includes('approv')) return 'Approvazione ricevuta';
  return 'Movimento nello studio';
};
const ActivityNarrative = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <section className="atd-activity-narrative" data-testid="atelier-activity-narrative">
        <header className="atd-section__head">
          <div>
            <p className="atd-section__eyebrow">Movimento</p>
            <h2 className="atd-section__title">Attività recenti</h2>
          </div>
        </header>
        <p className="atd-activity-narrative__empty">
          Nessun movimento recente nello studio.
        </p>
      </section>
    );
  }
  return (
    <section className="atd-activity-narrative" data-testid="atelier-activity-narrative">
      <header className="atd-section__head">
        <div>
          <p className="atd-section__eyebrow">Movimento</p>
          <h2 className="atd-section__title">Attività recenti</h2>
        </div>
      </header>
      <ul className="atd-activity-list">
        {events.slice(0, 6).map((e, i) => (
          <li key={i} className="atd-activity-item">
            <span className="atd-activity-item__dot" aria-hidden />
            <div className="atd-activity-item__body">
              <p className="atd-activity-item__line">{friendlyActivity(e)}</p>
              <p className="atd-activity-item__meta">
                {e.account ? `${e.account} · ` : ''}{relativeWhen(e.when)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ── Main ────────────────────────────────────────────────────────────
const AtelierDashboardPage = () => {
  const t = useT();
  const { locale } = useBlueprint();
  const { user } = useAuth();
  const userName = user?.first_name || user?.full_name?.split(' ')[0] || '';

  const [config, setConfig] = useState(null);
  const [pulse, setPulse]   = useState({ active_journeys: [], counts: {}, recent_evolutions: [] });
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get(`/api/atelier/dashboard/config?locale=${encodeURIComponent(locale || 'it-IT')}`)
        .then(r => r.data).catch(() => null),
      api.get(`/api/dashboard/pulse?locale=${encodeURIComponent(locale || 'it-IT')}`)
        .then(r => r.data).catch(() => ({ active_journeys: [], recent_evolutions: [] })),
      api.get('/api/dashboard/ecosystem-snapshot')
        .then(r => r.data).catch(() => null),
    ]).then(([cfg, p, snap]) => {
      if (!alive) return;
      setConfig(cfg); setPulse(p || {}); setSnapshot(snap);
    });
    return () => { alive = false; };
  }, [locale]);

  const projects = useMemo(() => pulse.active_journeys || [], [pulse.active_journeys]);
  const recent   = useMemo(() => pulse.recent_evolutions || [], [pulse.recent_evolutions]);
  void t;

  return (
    <div className="atd-canvas atd-canvas--editorial" data-testid="atelier-dashboard">
      {/* 1. HERO */}
      <Hero config={config} userName={userName} />

      {/* 2. IN EVIDENZA OGGI */}
      <Spotlight data={snapshot?.spotlight} />

      {/* 3. COSA PUOI FARE ADESSO */}
      <ActionDestinationsGrid />

      {/* 4. I TUOI PROGETTI ATTIVI */}
      <ProjectsRail projects={projects}
                     fallbackMedia={config?.project_card_fallback_media || []} />

      {/* 5. MOOD INTELLIGENCE™ */}
      <IntelligenceGrid items={snapshot?.intelligence || []} />

      {/* 6. ATTIVITÀ RECENTI */}
      <ActivityNarrative events={recent} />

      {/* 7. ECOSISTEMA MOOD™ */}
      <Ecosystem data={snapshot?.ecosystem} />

      {/* Sidebar relazionale (mantenuta) */}
      <section className="atd-live-relationships" data-testid="atelier-live-relationships">
        <PendingBookingsPanel locale="it" />
        <RelationshipLiveTimeline locale="it" />
      </section>
    </div>
  );
};

export default AtelierDashboardPage;
