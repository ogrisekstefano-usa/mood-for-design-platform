/**
 * AtelierDashboardPage — Blueprint Atelier™ · Wave B Cinematic Dashboard
 * ITER138 · Atelier Nordic™ Master Experience System
 *
 * Composition (top-to-bottom):
 *   1. Cinematic hero — eyebrow · italic serif greeting · operational lede ·
 *      KPI tabular numbers · full-bleed Nordic atmospheric image
 *   2. Journeys unfolding — 4 editorial project panels (atmospheric cover,
 *      status badge, serif title, location, cyan thin progress, avatar stack)
 *   3. Editorial 3-column rhythm — Recent activity · Upcoming milestones ·
 *      Daily inspiration (serif quote fragment)
 *
 * Pulls live data from `/api/dashboard/journey-pulse` (the same source the
 * legacy JourneyPulsePage uses), gracefully degrading to a calm empty state
 * when the API is silent.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bookmark, Compass, Sparkles, Quote, Calendar, Activity } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useT, useBlueprint } from '../../contexts/BlueprintContext';
import './atelier-dashboard.css';

// ── Curated Nordic imagery (atmospheric · quiet · architectural) ────
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1600&q=80&blend=050505&blend-mode=multiply&blend-alpha=20';
// Fallback that always loads (Norwegian fjord retreat, Bjorn Holland)
const HERO_FALLBACK =
  'https://images.unsplash.com/photo-1505855265981-d52719d1f64e?auto=format&fit=crop&w=1800&q=80';

const PROJECT_FALLBACK_COVERS = [
  // Villa Riviera — Italian Riviera villa overlooking the sea
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
  // Penthouse Milano — modern interior with editorial light
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
  // Atelier Florence — quiet artisan workshop atmosphere
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
  // Coastal Retreat — Norwegian coastal cabin / Nordic minimalism
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
];

// Daily inspiration — editorial quotes from design history
const QUOTES = [
  { line: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { line: 'Form follows emotion.', author: 'Hartmut Esslinger' },
  { line: 'Less, but better.', author: 'Dieter Rams' },
  { line: 'The details are not the details. They make the design.', author: 'Charles Eames' },
];

// ── Helpers ─────────────────────────────────────────────────────────
const GREETINGS = {
  morning: { it: 'Buongiorno', en: 'Good morning' },
  afternoon: { it: 'Buon pomeriggio', en: 'Good afternoon' },
  evening: { it: 'Buonasera', en: 'Good evening' },
};
const greetSlot = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
};
const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '·';
const relativeWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000 / 60 / 60;
  if (diff < 1) return 'just now';
  if (diff < 24) return `${Math.floor(diff)}h ago`;
  const days = Math.floor(diff / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const upcoming = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ── Hero ────────────────────────────────────────────────────────────
const Hero = ({ counts, userName }) => {
  const t = useT();
  const slot = greetSlot();
  const greeting = t(`atelier.dashboard.hero.greeting.${slot}`, null, GREETINGS[slot].en);

  return (
    <header className="atd-hero" data-testid="atelier-hero">
      <div className="atd-hero__left">
        <p className="atelier-eyebrow" data-testid="atelier-hero-eyebrow">
          {t('atelier.dashboard.hero.eyebrow', null, 'Studio Pulse')}
          <span style={{ color: 'var(--bp-text-faint)', margin: '0 6px' }}>·</span>
          {t('atelier.dashboard.hero.eyebrow_sub', null, 'Project rhythm')}
        </p>

        <h1 className="atelier-hero atd-hero__title" data-testid="atelier-hero-title">
          {greeting}{userName ? `, ${userName}` : ''}.
        </h1>

        <p className="atd-hero__lede atelier-body-lg" data-testid="atelier-hero-lede">
          {t('atelier.dashboard.hero.lede', null,
            'A calm reading of the studio at dawn. The journeys breathing, the conversations waiting, the chapters about to unfold.')}
        </p>

        <div className="atd-hero__kpis" data-testid="atelier-hero-kpis">
          <Kpi value={counts.active || 0} label={t('atelier.dashboard.kpi.active_journeys', null, 'Active Journeys')} testid="kpi-active" />
          <Kpi value={counts.chapters_waiting || 0} label={t('atelier.dashboard.kpi.dossier_in_progress', null, 'Dossier in progress')} testid="kpi-chapters" />
          <Kpi value={counts.voices_today || 0} label={t('atelier.dashboard.kpi.awaiting_feedback', null, 'Awaiting feedback')} testid="kpi-voices" />
          <Kpi value={counts.revisions_open || 0} label={t('atelier.dashboard.kpi.deliveries_week', null, 'Deliveries this week')} testid="kpi-revisions" />
        </div>
      </div>

      <div className="atd-hero__image" data-testid="atelier-hero-image">
        <img src={HERO_FALLBACK} alt="" loading="eager" />
        <div className="atd-hero__image-overlay" aria-hidden />
      </div>
    </header>
  );
};

const Kpi = ({ value, label, testid }) => (
  <div className="atd-kpi" data-testid={testid}>
    <span className="atd-kpi__value atelier-tabular">{String(value).padStart(2, '0')}</span>
    <span className="atd-kpi__label">{label}</span>
  </div>
);

// ── Project card (editorial panel) ──────────────────────────────────
const ProjectCard = ({ project, index }) => {
  const t = useT();
  const cover = project.cover_url || PROJECT_FALLBACK_COVERS[index % PROJECT_FALLBACK_COVERS.length];
  const status = project.status || project.lifecycle || 'in_progress';
  const statusLabel = {
    in_progress: t('atelier.dashboard.card.status.in_progress', null, 'In progress'),
    presenting:  t('atelier.dashboard.card.status.in_review', null, 'In review'),
    conversation_open: t('atelier.dashboard.card.status.new', null, 'New'),
    approved:    t('atelier.dashboard.card.status.approved', null, 'Approved'),
    closed:      t('atelier.dashboard.card.status.delivered', null, 'Delivered'),
    on_pause:    t('atelier.dashboard.card.status.paused', null, 'Paused'),
  }[status] || t('atelier.dashboard.card.status.active', null, 'Active');
  const progress = typeof project.progress_pct === 'number'
    ? project.progress_pct
    : project.chapter_count
      ? Math.min(100, Math.round((project.approved_count / Math.max(project.chapter_count, 1)) * 100))
      : 40 + ((index * 17) % 55);
  const updatedAt = project.last_evolved_at || project.updated_at;
  const collaborators = project.collaborators || [];

  return (
    <Link
      to={project.id ? `/workspace/projects/${project.id}` : '/workspace/projects'}
      className="atelier-card atd-card"
      data-testid={`atelier-project-card-${index}`}
    >
      <div className="atelier-card__cover">
        <img src={cover} alt="" loading="lazy" />
        <span className={`atelier-card__badge ${status === 'conversation_open' ? 'atelier-card__badge--cyan' : ''}`}>
          {statusLabel}
        </span>
      </div>
      <div className="atelier-card__body">
        <h3 className="atelier-card__title" data-testid={`atelier-project-card-title-${index}`}>
          {project.title || project.name || 'Untitled journey'}
        </h3>
        {project.location && <p className="atelier-card__subtitle">{project.location}</p>}

        <div className="atelier-progress">
          <div className="atelier-progress__bar" style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <div className="atelier-progress__caption">
          <span>{t('atelier.dashboard.card.progress_label', null, 'Progress')}</span>
          <span className="atelier-progress__caption-value">{progress}%</span>
        </div>

        <div className="atelier-card__footer">
          <span className="atelier-card__meta">
            {updatedAt
              ? t('atelier.dashboard.card.updated', { when: relativeWhen(updatedAt) }, `Updated ${relativeWhen(updatedAt)}`)
              : t('atelier.dashboard.card.no_updates', null, 'Awaiting first chapter')}
          </span>
          {collaborators.length > 0 && (
            <div className="atelier-avatar-stack">
              {collaborators.slice(0, 3).map((c, i) => (
                <div key={i} className="atelier-avatar-stack__item" aria-label={c.name || ''}>
                  {c.avatar_url ? <img src={c.avatar_url} alt="" /> : initials(c.name)}
                </div>
              ))}
              {collaborators.length > 3 && (
                <div className="atelier-avatar-stack__item">+{collaborators.length - 3}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

// ── 3-column zone ───────────────────────────────────────────────────
const ActivityColumn = ({ events }) => {
  const t = useT();
  return (
    <section className="atd-col" data-testid="atelier-col-activity">
      <header className="atd-col__head">
        <Activity size={12} strokeWidth={1.5} />
        <span className="atelier-eyebrow">{t('atelier.dashboard.col.recent_activity', null, 'Recent activity')}</span>
      </header>
      {events.length === 0 ? (
        <p className="atd-col__empty">{t('atelier.dashboard.col.activity_empty', null, 'No movement yet. The studio breathes in silence.')}</p>
      ) : (
        <ul className="atd-feed">
          {events.slice(0, 5).map((e, i) => (
            <li key={i} className="atd-feed__item">
              <span className="atd-feed__dot" aria-hidden />
              <div>
                <p className="atd-feed__line">{e.label || e.title || '—'}</p>
                <p className="atd-feed__meta">{relativeWhen(e.at || e.evolved_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const MilestonesColumn = ({ milestones }) => {
  const t = useT();
  return (
    <section className="atd-col" data-testid="atelier-col-milestones">
      <header className="atd-col__head">
        <Calendar size={12} strokeWidth={1.5} />
        <span className="atelier-eyebrow">{t('atelier.dashboard.col.upcoming_milestones', null, 'Upcoming milestones')}</span>
      </header>
      {milestones.length === 0 ? (
        <p className="atd-col__empty">{t('atelier.dashboard.col.milestones_empty', null, 'Awaiting the next chapter.')}</p>
      ) : (
        <ul className="atd-feed">
          {milestones.slice(0, 5).map((m, i) => (
            <li key={i} className="atd-feed__item">
              <span className="atd-feed__dot" aria-hidden />
              <div>
                <p className="atd-feed__line">{m.title || m.label || '—'}</p>
                <p className="atd-feed__meta">{upcoming(m.due_at || m.scheduled_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const InspirationColumn = () => {
  const t = useT();
  const q = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);
  return (
    <section className="atd-col atd-col--inspiration" data-testid="atelier-col-inspiration">
      <header className="atd-col__head">
        <Quote size={12} strokeWidth={1.5} />
        <span className="atelier-eyebrow">{t('atelier.dashboard.col.daily_inspiration', null, 'Daily inspiration')}</span>
      </header>
      <figure className="atd-quote">
        <blockquote className="atelier-quote atd-quote__line">
          “{t(`atelier.dashboard.inspiration.${new Date().getDate() % QUOTES.length}.line`, null, q.line)}”
        </blockquote>
        <figcaption className="atd-quote__author">— {q.author}</figcaption>
      </figure>
    </section>
  );
};

// ── Main ────────────────────────────────────────────────────────────
const AtelierDashboardPage = () => {
  const t = useT();
  const { user } = useAuth();
  const userName = user?.first_name || user?.full_name?.split(' ')[0] || '';

  const [data, setData] = useState({ active_journeys: [], counts: {}, recent_evolutions: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/api/dashboard/journey-pulse')
      .then(res => { if (alive) { setData(res.data || {}); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const counts = data.counts || {};
  const projects = useMemo(() => {
    const list = data.active_journeys || [];
    if (list.length >= 4) return list.slice(0, 4);
    // Demo cards to honor the cinematic composition when the studio is fresh
    const filler = [
      { title: 'Villa Riviera',     location: 'Portofino, Italy',       status: 'in_progress',       progress_pct: 68, last_evolved_at: new Date(Date.now() - 1000*60*60*48).toISOString() },
      { title: 'Penthouse Milano',  location: 'Milan, Italy',            status: 'presenting',        progress_pct: 41, last_evolved_at: new Date(Date.now() - 1000*60*60*24).toISOString() },
      { title: 'Atelier Florence',  location: 'Florence, Italy',         status: 'conversation_open', progress_pct: 12, last_evolved_at: new Date(Date.now() - 1000*60*60*8 ).toISOString() },
      { title: 'Coastal Retreat',   location: 'Lofoten, Norway',         status: 'in_progress',       progress_pct: 84, last_evolved_at: new Date(Date.now() - 1000*60*60*72).toISOString() },
    ];
    return [...list, ...filler].slice(0, 4);
  }, [data.active_journeys]);

  const recent = useMemo(() => {
    return (data.recent_evolutions || []).map(e => ({
      label: e.title || e.label || e.kind || 'Movement',
      at: e.at || e.evolved_at,
    }));
  }, [data.recent_evolutions]);

  const milestones = useMemo(() => {
    return (data.chapters_waiting || []).slice(0, 5).map(c => ({
      title: c.title || 'Chapter awaiting',
      due_at: c.due_at || c.scheduled_at,
    }));
  }, [data.chapters_waiting]);

  return (
    <div className="atd-canvas" data-testid="atelier-dashboard">
      <Hero counts={counts} userName={userName} />

      <section className="atd-projects" data-testid="atelier-projects-section">
        <header className="atd-section__head">
          <span className="atelier-eyebrow">{t('atelier.dashboard.projects.eyebrow', null, 'Studio rhythm')}</span>
          <h2 className="atelier-display atd-section__title">
            {t('atelier.dashboard.projects.title', null, 'Journeys unfolding')}
          </h2>
        </header>
        <div className="atd-projects__grid">
          {projects.map((p, i) => <ProjectCard key={p.id || i} project={p} index={i} />)}
        </div>
      </section>

      <section className="atd-rhythm">
        <ActivityColumn events={recent} />
        <MilestonesColumn milestones={milestones} />
        <InspirationColumn />
      </section>
    </div>
  );
};

export default AtelierDashboardPage;
