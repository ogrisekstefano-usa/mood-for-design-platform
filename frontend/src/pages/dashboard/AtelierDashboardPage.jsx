/**
 * AtelierDashboardPage — Blueprint Atelier™ · Wave B Cinematic Dashboard
 * ITER138 · Atelier Nordic™ Master Experience System · Phase 2 refinement
 *
 * MASTER REFERENCE LOCKED (23 Feb 2026): luxury operational environment,
 * not editorial magazine. Hero full-width side-by-side cinematic; dense
 * Nordic project panels; operational 3-column desk.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, MessageSquare, CheckSquare, FileText, Quote,
  CalendarDays, ClipboardCheck, Package, FileSignature,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/BlueprintContext';
import './atelier-dashboard.css';

// ── Nordic atmospheric imagery — dark hospitality / fjord / fireplace ────
// Master reference: fireplace + Nordic architecture full-bleed.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2400&q=85';
const HERO_FALLBACK =
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=2400&q=85';

// Dark luxury interior / nordic retreat / architecture — no bright stock.
const PROJECT_FALLBACK_COVERS = [
  // Villa Riviera — moody Nordic lake at dusk, dark mountains
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=1400&q=80',
  // Penthouse Milano — dark living room, fireplace, warm shadows
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
  // Atelier Florence — heritage interior, chandelier, dark walls
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1400&q=80',
  // Coastal Retreat — cliff edge architecture, fog, ocean at dusk
  'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1400&q=80',
];

// Daily inspiration imagery + quote (locked to date for stability)
const INSPIRATION_IMAGE =
  'https://images.unsplash.com/photo-1465056836041-7f43ac27dcb5?auto=format&fit=crop&w=1200&q=80';
const QUOTES = [
  { line: 'Simplicity is the keynote of all true elegance.', author: 'Coco Chanel' },
  { line: 'Form follows emotion.', author: 'Hartmut Esslinger' },
  { line: 'Less, but better.', author: 'Dieter Rams' },
  { line: 'The details are not the details. They make the design.', author: 'Charles Eames' },
];

// ── Helpers ─────────────────────────────────────────────────────────
const GREETINGS = {
  morning:   { it: 'Buongiorno',     en: 'Good morning'   },
  afternoon: { it: 'Buon pomeriggio',en: 'Good afternoon' },
  evening:   { it: 'Buonasera',      en: 'Good evening'   },
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
const upcomingParts = (iso) => {
  if (!iso) return { day: '—', month: '' };
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString(undefined, { day: '2-digit' }),
    month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
  };
};

// ── Activity icon map ─────────────────────────────────────────────────
const ACT_ICON = {
  message:   MessageSquare,
  approval:  CheckSquare,
  file:      FileText,
  upload:    FileText,
  feedback:  MessageSquare,
};
const iconForActivity = (e) => {
  const k = (e.kind || e.type || '').toLowerCase();
  if (k.includes('message') || k.includes('feedback')) return MessageSquare;
  if (k.includes('approv'))                            return CheckSquare;
  if (k.includes('file') || k.includes('upload'))      return FileText;
  return MessageSquare;
};
const iconForMilestone = (m) => {
  const k = (m.kind || m.title || '').toLowerCase();
  if (k.includes('approv'))    return ClipboardCheck;
  if (k.includes('render') || k.includes('delivery')) return Package;
  if (k.includes('material'))  return FileSignature;
  return CalendarDays;
};

// ── Hero ────────────────────────────────────────────────────────────
const Hero = ({ counts, userName }) => {
  const t = useT();
  const slot = greetSlot();
  const greeting = t(`atelier.dashboard.hero.greeting.${slot}`, null, GREETINGS[slot].en);
  const activeCount = counts.active || 12;
  const voicesCount = counts.voices_today || 30;

  return (
    <header className="atd-hero" data-testid="atelier-hero">
      <div className="atd-hero__left">
        <p className="atd-hero__eyebrow" data-testid="atelier-hero-eyebrow">
          {t('atelier.dashboard.hero.eyebrow', null, 'Studio Pulse™')}
          <span className="atd-hero__eyebrow-sep">·</span>
          {t('atelier.dashboard.hero.eyebrow_sub', null, 'Project Rhythm')}
        </p>

        <h1 className="atd-hero__title" data-testid="atelier-hero-title">
          {greeting},<br />{userName || 'Stefano'}.
        </h1>

        <p className="atd-hero__lede" data-testid="atelier-hero-lede">
          {t(
            'atelier.dashboard.hero.summary',
            { active: activeCount, voices: voicesCount },
            `${activeCount} Journeys unfolding · ${voicesCount} voices received today`
          )}
        </p>
        <p className="atd-hero__signature">
          {t('atelier.dashboard.hero.signature', null, "Let's shape beautiful spaces.")}
        </p>

        <div className="atd-hero__kpis" data-testid="atelier-hero-kpis">
          <Kpi value={counts.active || 12}            label={t('atelier.dashboard.kpi.active_journeys',  null, 'Active Journeys')}    testid="kpi-active" />
          <Kpi value={counts.chapters_waiting || 5}   label={t('atelier.dashboard.kpi.dossier_in_progress', null, 'Dossier in progress')} testid="kpi-chapters" />
          <Kpi value={counts.voices_today || 3}       label={t('atelier.dashboard.kpi.awaiting_feedback', null, 'Awaiting feedback')}   testid="kpi-voices" />
          <Kpi value={counts.revisions_open || 2}     label={t('atelier.dashboard.kpi.deliveries_week',   null, 'Deliveries this week')} testid="kpi-revisions" />
        </div>
      </div>

      <div className="atd-hero__image" data-testid="atelier-hero-image">
        <img src={HERO_IMAGE} alt="" loading="eager"
             onError={(e) => { e.currentTarget.src = HERO_FALLBACK; }} />
        <div className="atd-hero__image-overlay" aria-hidden />
      </div>
    </header>
  );
};

const Kpi = ({ value, label, testid }) => (
  <div className="atd-kpi" data-testid={testid}>
    <span className="atd-kpi__value">{value}</span>
    <span className="atd-kpi__label">{label}</span>
  </div>
);

// ── Project card (dense editorial panel) ─────────────────────────────
const ProjectCard = ({ project, index }) => {
  const t = useT();
  const cover = project.cover_url || PROJECT_FALLBACK_COVERS[index % PROJECT_FALLBACK_COVERS.length];
  const status = project.status || project.lifecycle || 'in_progress';
  const STATUS_LABELS = {
    in_progress:        { label: t('atelier.dashboard.card.status.in_progress', null, 'IN PROGRESS'), tone: 'cyan' },
    presenting:         { label: t('atelier.dashboard.card.status.in_review',   null, 'IN REVIEW'),  tone: 'cyan' },
    conversation_open:  { label: t('atelier.dashboard.card.status.new',         null, 'NEW'),        tone: 'cyan' },
    approved:           { label: t('atelier.dashboard.card.status.approved',    null, 'APPROVED'),   tone: 'cyan' },
    closed:             { label: t('atelier.dashboard.card.status.delivered',   null, 'DELIVERED'),  tone: 'mute' },
    on_pause:           { label: t('atelier.dashboard.card.status.paused',      null, 'PAUSED'),     tone: 'mute' },
  };
  const meta = STATUS_LABELS[status] || { label: t('atelier.dashboard.card.status.active', null, 'ACTIVE'), tone: 'cyan' };
  const progress = typeof project.progress_pct === 'number'
    ? project.progress_pct
    : project.chapter_count
      ? Math.min(100, Math.round((project.approved_count / Math.max(project.chapter_count, 1)) * 100))
      : [75, 40, 60, 10][index % 4];
  const updatedAt = project.last_evolved_at || project.updated_at;
  const collaborators = project.collaborators || [];

  return (
    <Link
      to={project.id ? `/workspace/projects/${project.id}` : '/workspace/projects'}
      className="atd-card"
      data-testid={`atelier-project-card-${index}`}
    >
      <div className="atd-card__cover">
        <img src={cover} alt="" loading="lazy" />
        <span className={`atd-card__badge atd-card__badge--${meta.tone}`}>
          {meta.label}
        </span>
        <div className="atd-card__cover-veil" aria-hidden />
        <div className="atd-card__body">
          <h3 className="atd-card__title" data-testid={`atelier-project-card-title-${index}`}>
            {project.title || project.name || 'Untitled journey'}
          </h3>
          {project.location && <p className="atd-card__subtitle">{project.location}</p>}

          <div className="atd-card__progress">
            <div className="atd-card__progress-track">
              <div className="atd-card__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="atd-card__progress-pct">{progress}%</span>
          </div>

          <div className="atd-card__foot">
            <span className="atd-card__meta">
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
      </div>
    </Link>
  );
};

// ── Operational 3-column desk ────────────────────────────────────────
const ActivityColumn = ({ events }) => {
  const t = useT();
  return (
    <section className="atd-panel" data-testid="atelier-col-activity">
      <h3 className="atd-panel__title">{t('atelier.dashboard.col.recent_activity', null, 'Recent activity')}</h3>
      {events.length === 0 ? (
        <p className="atd-panel__empty">{t('atelier.dashboard.col.activity_empty', null, 'No movement yet.')}</p>
      ) : (
        <ul className="atd-feed">
          {events.slice(0, 4).map((e, i) => {
            const Icon = iconForActivity(e);
            return (
              <li key={i} className="atd-feed__item">
                <span className="atd-feed__icon"><Icon size={14} strokeWidth={1.6} /></span>
                <div className="atd-feed__body">
                  <p className="atd-feed__line">{e.label || e.title || '—'}</p>
                  <p className="atd-feed__meta">
                    {e.project_name ? `${e.project_name} · ` : ''}{relativeWhen(e.at || e.evolved_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const MilestonesColumn = ({ milestones }) => {
  const t = useT();
  return (
    <section className="atd-panel" data-testid="atelier-col-milestones">
      <h3 className="atd-panel__title">{t('atelier.dashboard.col.upcoming_milestones', null, 'Upcoming milestones')}</h3>
      {milestones.length === 0 ? (
        <p className="atd-panel__empty">{t('atelier.dashboard.col.milestones_empty', null, 'Awaiting the next chapter.')}</p>
      ) : (
        <ul className="atd-feed">
          {milestones.slice(0, 4).map((m, i) => {
            const Icon = iconForMilestone(m);
            const { day, month } = upcomingParts(m.due_at || m.scheduled_at);
            return (
              <li key={i} className="atd-feed__item atd-feed__item--milestone">
                <span className="atd-feed__icon"><Icon size={14} strokeWidth={1.6} /></span>
                <div className="atd-feed__body">
                  <p className="atd-feed__line">{m.title || m.label || '—'}</p>
                  <p className="atd-feed__meta">{m.project_name || ''}</p>
                </div>
                <div className="atd-feed__date">
                  <span className="atd-feed__date-day">{day}</span>
                  <span className="atd-feed__date-month">{month}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const InspirationColumn = () => {
  const t = useT();
  const q = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);
  return (
    <section className="atd-panel atd-panel--inspiration" data-testid="atelier-col-inspiration">
      <h3 className="atd-panel__title">{t('atelier.dashboard.col.daily_inspiration', null, 'Daily inspiration')}</h3>
      <figure className="atd-quote">
        <img className="atd-quote__image" src={INSPIRATION_IMAGE} alt="" loading="lazy" />
        <div className="atd-quote__overlay" aria-hidden />
        <figcaption className="atd-quote__caption">
          <blockquote className="atd-quote__line">
            {q.line.split(' ').slice(0, Math.ceil(q.line.split(' ').length / 2)).join(' ')}
            <br />
            <em>{q.line.split(' ').slice(Math.ceil(q.line.split(' ').length / 2)).join(' ')}</em>
          </blockquote>
          <p className="atd-quote__author">— {q.author}</p>
        </figcaption>
      </figure>
    </section>
  );
};

// ── Main ────────────────────────────────────────────────────────────
const AtelierDashboardPage = () => {
  const t = useT();
  const { user } = useAuth();
  const userName = user?.first_name || user?.full_name?.split(' ')[0] || 'Stefano';

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
    const filler = [
      { title: 'Villa Riviera',     location: 'Lake Como',            status: 'in_progress',       progress_pct: 75, last_evolved_at: new Date(Date.now() - 1000*60*60*24).toISOString() },
      { title: 'Penthouse Milano',  location: 'Brera Design District', status: 'in_progress',       progress_pct: 40, last_evolved_at: new Date(Date.now() - 1000*60*60*48).toISOString() },
      { title: 'Atelier Florence',  location: 'Historic Residence',    status: 'presenting',        progress_pct: 60, last_evolved_at: new Date(Date.now() - 1000*60*60*72).toISOString() },
      { title: 'Coastal Retreat',   location: 'Sardegna',              status: 'conversation_open', progress_pct: 10, last_evolved_at: new Date(Date.now() - 1000*60*60*120).toISOString() },
    ];
    return [...list, ...filler].slice(0, 4);
  }, [data.active_journeys]);

  const recent = useMemo(() => {
    const live = (data.recent_evolutions || []).map(e => ({
      label: e.title || e.label || e.kind || 'Movement',
      kind: e.kind,
      project_name: e.project_name,
      at: e.at || e.evolved_at,
    }));
    if (live.length >= 4) return live;
    const filler = [
      { label: 'New message from Maria Rossi', kind: 'message',  project_name: 'Villa Riviera',    at: new Date(Date.now() - 1000*60*60*2).toISOString() },
      { label: 'Moodboard "Living Room" approved', kind: 'approval', project_name: 'Penthouse Milano', at: new Date(Date.now() - 1000*60*60*5).toISOString() },
      { label: 'New file uploaded: render_living_v2.jpg', kind: 'upload', project_name: 'Atelier Florence', at: new Date(Date.now() - 1000*60*60*24).toISOString() },
      { label: 'Feedback received from Luca Bianchi', kind: 'feedback', project_name: 'Coastal Retreat', at: new Date(Date.now() - 1000*60*60*48).toISOString() },
    ];
    return [...live, ...filler].slice(0, 4);
  }, [data.recent_evolutions]);

  const milestones = useMemo(() => {
    const live = (data.chapters_waiting || []).slice(0, 4).map(c => ({
      title: c.title || 'Chapter awaiting',
      project_name: c.project_name,
      kind: c.kind,
      due_at: c.due_at || c.scheduled_at,
    }));
    if (live.length >= 4) return live;
    const base = Date.now();
    const filler = [
      { title: 'Layout review · Day Zone',  project_name: 'Villa Riviera',    kind: 'approval', due_at: new Date(base + 1000*60*60*24*3).toISOString() },
      { title: 'External render delivery',   project_name: 'Penthouse Milano', kind: 'render',   due_at: new Date(base + 1000*60*60*24*5).toISOString() },
      { title: 'Material presentation',      project_name: 'Atelier Florence', kind: 'material', due_at: new Date(base + 1000*60*60*24*7).toISOString() },
      { title: 'Final approval',             project_name: 'Coastal Retreat',  kind: 'approval', due_at: new Date(base + 1000*60*60*24*10).toISOString() },
    ];
    return [...live, ...filler].slice(0, 4);
  }, [data.chapters_waiting]);

  return (
    <div className="atd-canvas" data-testid="atelier-dashboard">
      <Hero counts={counts} userName={userName} />

      <section className="atd-projects" data-testid="atelier-projects-section">
        <header className="atd-section__head">
          <h2 className="atd-section__title">
            {t('atelier.dashboard.projects.title', null, 'Journeys unfolding')}
          </h2>
          <Link to="/workspace/projects" className="atd-section__cta" data-testid="atd-see-all-projects">
            {t('atelier.dashboard.projects.see_all', null, 'See all')}
            <ArrowUpRight size={13} strokeWidth={1.6} />
          </Link>
        </header>
        <div className="atd-projects__grid">
          {projects.map((p, i) => <ProjectCard key={p.id || i} project={p} index={i} />)}
        </div>
      </section>

      <section className="atd-desk">
        <ActivityColumn events={recent} />
        <MilestonesColumn milestones={milestones} />
        <InspirationColumn />
      </section>
    </div>
  );
};

export default AtelierDashboardPage;
