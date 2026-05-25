/**
 * AtelierDashboardPage — Blueprint Atelier™ · Wave B (DB-driven · Cinematic)
 * ITER138 · Phase 2 (post-cinematic refinement, DB-driven content model)
 *
 * NO hardcoded mock content. ALL copy + imagery + KPI labels + inspiration
 * quotes resolve from:
 *   GET /api/atelier/dashboard/config   (config + media bindings + quote)
 *   GET /api/dashboard/pulse            (real journey data, ALE-localized)
 *
 * Elegant fallback path:
 *   - When DB returns nothing, the inline empty states render
 *     ("Awaiting first journey", "No movement yet", etc.) localized via t()
 *   - System default rows (tenant_id=NULL) seed the demo experience,
 *     scoped & overridable per tenant via Command Center.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, MessageSquare, CheckSquare, FileText,
  CalendarDays, ClipboardCheck, Package, FileSignature,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useT, useBlueprint } from '../../contexts/BlueprintContext';
import RelationshipLiveTimeline from '../../components/dashboard/RelationshipLiveTimeline';
import PendingBookingsPanel from '../../components/booking/PendingBookingsPanel';
import DesignerPresencePicker from '../../components/presence/DesignerPresencePicker';
import './atelier-dashboard.css';

// ── Helpers ─────────────────────────────────────────────────────────
const greetSlot = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
};

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '·';

const relativeWhen = (iso, t) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000 / 60 / 60;
  if (diff < 1) return t('atelier.dashboard.time.just_now', null, 'just now');
  if (diff < 24) return t('atelier.dashboard.time.hours_ago', { n: Math.floor(diff) }, `${Math.floor(diff)}h ago`);
  const days = Math.floor(diff / 24);
  if (days === 1) return t('atelier.dashboard.time.yesterday', null, 'yesterday');
  if (days < 7) return t('atelier.dashboard.time.days_ago', { n: days }, `${days} days ago`);
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

const iconForActivity = (e) => {
  const k = (e.kind || e.chapter_kind || e.canon || '').toLowerCase();
  if (k.includes('message') || k.includes('feedback') || k.includes('voice')) return MessageSquare;
  if (k.includes('approv'))                                                    return CheckSquare;
  if (k.includes('file') || k.includes('upload') || k.includes('chapter'))     return FileText;
  return MessageSquare;
};

const iconForMilestone = (m) => {
  const k = (m.kind || m.milestone || '').toLowerCase();
  if (k.includes('approv') || k.includes('final')) return ClipboardCheck;
  if (k.includes('render') || k.includes('delivery') || k.includes('deliver')) return Package;
  if (k.includes('material') || k.includes('moodboard')) return FileSignature;
  return CalendarDays;
};

// Format hero summary template "{active} Journeys unfolding · {voices} voices..."
const fillTemplate = (tpl, vars) =>
  (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));

// Format card status into editorial chip label via i18n
const statusLabel = (status, t) => {
  const map = {
    in_progress:        t('atelier.dashboard.card.status.in_progress', null, 'IN PROGRESS'),
    presenting:         t('atelier.dashboard.card.status.in_review',   null, 'IN REVIEW'),
    conversation_open:  t('atelier.dashboard.card.status.new',         null, 'NEW'),
    drifting:           t('atelier.dashboard.card.status.listening',   null, 'LISTENING'),
    approved:           t('atelier.dashboard.card.status.approved',    null, 'APPROVED'),
    closed:             t('atelier.dashboard.card.status.delivered',   null, 'DELIVERED'),
    on_pause:           t('atelier.dashboard.card.status.paused',      null, 'PAUSED'),
  };
  return { label: map[status] || t('atelier.dashboard.card.status.active', null, 'ACTIVE'),
           tone: (status === 'closed' || status === 'on_pause') ? 'mute' : 'cyan' };
};

// ── Hero ────────────────────────────────────────────────────────────
const Hero = ({ config, counts, userName }) => {
  const t = useT();
  const slot = greetSlot();
  // i18n always wins; DB config is admin-override only (passed as fallback to t())
  const greeting = t(`atelier.dashboard.hero.greeting.${slot}`, null,
    config?.[`hero_greeting_${slot}`] ||
    (slot === 'morning' ? 'Good morning' : slot === 'afternoon' ? 'Good afternoon' : 'Good evening'));
  const eyebrow = t('atelier.dashboard.hero.eyebrow', null,
    config?.hero_eyebrow || 'Studio Pulse™ · Project Rhythm');
  const signature = t('atelier.dashboard.hero.signature', null,
    config?.hero_signature || "Let's shape beautiful spaces.");
  const summary = fillTemplate(
    t('atelier.dashboard.hero.summary_template', null,
      config?.hero_summary_template || '{active} Journeys unfolding · {voices} voices received today'),
    { active: counts.active || 0, voices: counts.voices_today || 0 }
  );

  const heroSrc = config?.hero_media?.file_url;
  const heroAlt = config?.hero_media?.alt_text || '';
  const focal = config?.hero_media
    ? `${(config.hero_media.focal_point_x * 100).toFixed(1)}% ${(config.hero_media.focal_point_y * 100).toFixed(1)}%`
    : '50% 50%';

  return (
    <header className="atd-hero" data-testid="atelier-hero">
      <div className="atd-hero__left">
        <p className="atd-hero__eyebrow" data-testid="atelier-hero-eyebrow">{eyebrow}</p>

        <h1 className="atd-hero__title" data-testid="atelier-hero-title">
          {greeting},<br />{userName || ''}.
        </h1>

        <p className="atd-hero__lede" data-testid="atelier-hero-lede">{summary}</p>
        <p className="atd-hero__signature">{signature}</p>

        <div className="atd-hero__kpis" data-testid="atelier-hero-kpis">
          <Kpi value={counts.active || 0}
               label={t('atelier.dashboard.kpi.active_journeys', null,
                        config?.kpi_active_label || 'Active Journeys')}
               testid="kpi-active" />
          <Kpi value={counts.chapters_waiting || 0}
               label={t('atelier.dashboard.kpi.dossier_in_progress', null,
                        config?.kpi_dossier_label || 'Dossier in progress')}
               testid="kpi-chapters" />
          <Kpi value={counts.voices_today || 0}
               label={t('atelier.dashboard.kpi.awaiting_feedback', null,
                        config?.kpi_awaiting_label || 'Awaiting feedback')}
               testid="kpi-voices" />
          <Kpi value={counts.revisions_open || 0}
               label={t('atelier.dashboard.kpi.deliveries_week', null,
                        config?.kpi_deliveries_label || 'Deliveries this week')}
               testid="kpi-revisions" />
        </div>
      </div>

      <div className="atd-hero__image" data-testid="atelier-hero-image">
        {heroSrc && (
          <img src={heroSrc} alt={heroAlt} loading="eager"
               style={{ objectPosition: focal }} />
        )}
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

// ── Project card · DB-driven ────────────────────────────────────────
const ProjectCard = ({ project, index, fallbackMedia }) => {
  const t = useT();
  // 1. project.cover_url (real project upload) > 2. tenant fallback media > 3. invisible
  const fallback = fallbackMedia?.[index % Math.max(fallbackMedia.length, 1)];
  const cover = project.cover_url || fallback?.file_url;
  const coverAlt = project.cover_alt || fallback?.alt_text || project.title || '';
  const focal = fallback
    ? `${(fallback.focal_point_x * 100).toFixed(1)}% ${(fallback.focal_point_y * 100).toFixed(1)}%`
    : '50% 50%';

  const status = project.lifecycle_state || project.status || 'in_progress';
  const { label, tone } = statusLabel(status, t);
  const progress = typeof project.progress === 'number'
    ? project.progress
    : typeof project.progress_pct === 'number'
      ? project.progress_pct
      : 0;
  const updatedAt = project.last_event?.when || project.last_evolved_at || project.updated_at;
  const collaborators = project.collaborators || [];

  // Project title: real project name → milestone label → fallback
  const title = project.title || project.account_name || project.current_milestone?.label
                || t('atelier.dashboard.card.untitled', null, 'Untitled journey');
  const subtitle = project.subtitle || project.location || project.current_milestone?.label || '';

  return (
    <Link
      to={project.project_id ? `/workspace/projects/${project.project_id}` : '/workspace/projects'}
      className="atd-card"
      data-testid={`atelier-project-card-${index}`}
    >
      <div className="atd-card__cover">
        {cover && (
          <img src={cover} alt={coverAlt} loading="lazy"
               style={{ objectPosition: focal }} />
        )}
        <span className={`atd-card__badge atd-card__badge--${tone}`}>{label}</span>
        <div className="atd-card__cover-veil" aria-hidden />
        <div className="atd-card__body">
          <h3 className="atd-card__title" data-testid={`atelier-project-card-title-${index}`}>{title}</h3>
          {subtitle && <p className="atd-card__subtitle">{subtitle}</p>}

          <div className="atd-card__progress">
            <div className="atd-card__progress-track">
              <div className="atd-card__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="atd-card__progress-pct">{progress}%</span>
          </div>

          <div className="atd-card__foot">
            <span className="atd-card__meta">
              {updatedAt
                ? t('atelier.dashboard.card.updated', { when: relativeWhen(updatedAt, t) },
                    `Updated ${relativeWhen(updatedAt, t)}`)
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

// ── Operational 3-column ────────────────────────────────────────────
const ActivityColumn = ({ title, events, t }) => (
  <section className="atd-panel" data-testid="atelier-col-activity">
    <h3 className="atd-panel__title">{title}</h3>
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
                <p className="atd-feed__line">{e.chapter || e.text || e.label || '—'}</p>
                <p className="atd-feed__meta">
                  {e.account ? `${e.account} · ` : ''}{relativeWhen(e.when, t)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const MilestonesColumn = ({ title, milestones, t }) => (
  <section className="atd-panel" data-testid="atelier-col-milestones">
    <h3 className="atd-panel__title">{title}</h3>
    {milestones.length === 0 ? (
      <p className="atd-panel__empty">{t('atelier.dashboard.col.milestones_empty', null, 'Awaiting the next chapter.')}</p>
    ) : (
      <ul className="atd-feed">
        {milestones.slice(0, 4).map((m, i) => {
          const Icon = iconForMilestone(m);
          const { day, month } = upcomingParts(m.due_at || m.presented_at || m.when);
          return (
            <li key={i} className="atd-feed__item atd-feed__item--milestone">
              <span className="atd-feed__icon"><Icon size={14} strokeWidth={1.6} /></span>
              <div className="atd-feed__body">
                <p className="atd-feed__line">{m.chapter_title || m.milestone || m.title || '—'}</p>
                <p className="atd-feed__meta">{m.account || m.project_name || ''}</p>
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

const InspirationColumn = ({ title, quote, ambient, t }) => (
  <section className="atd-panel atd-panel--inspiration" data-testid="atelier-col-inspiration">
    <h3 className="atd-panel__title">{title}</h3>
    {quote ? (
      <figure className="atd-quote">
        {ambient?.file_url && (
          <img className="atd-quote__image"
               src={ambient.file_url}
               alt={ambient.alt_text || ''}
               loading="lazy"
               style={{ objectPosition:
                 `${(ambient.focal_point_x * 100).toFixed(1)}% ${(ambient.focal_point_y * 100).toFixed(1)}%` }} />
        )}
        <div className="atd-quote__overlay" aria-hidden />
        <figcaption className="atd-quote__caption">
          <blockquote className="atd-quote__line">{quote.quote_text}</blockquote>
          {quote.quote_author && <p className="atd-quote__author">— {quote.quote_author}</p>}
        </figcaption>
      </figure>
    ) : (
      <p className="atd-panel__empty">
        {t('atelier.dashboard.col.inspiration_empty', null, 'No quote curated yet.')}
      </p>
    )}
  </section>
);

// ── Main ────────────────────────────────────────────────────────────
const AtelierDashboardPage = () => {
  const t = useT();
  const { locale } = useBlueprint();
  const { user } = useAuth();
  const userName = user?.first_name || user?.full_name?.split(' ')[0] || '';

  const [config, setConfig] = useState(null);
  const [pulse, setPulse]   = useState({ active_journeys: [], counts: {}, recent_evolutions: [], chapters_waiting: [] });

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get(`/api/atelier/dashboard/config?locale=${encodeURIComponent(locale || 'en-US')}`)
        .then(r => r.data).catch(() => null),
      api.get(`/api/dashboard/pulse?locale=${encodeURIComponent(locale || 'en-US')}`)
        .then(r => r.data).catch(() => ({ active_journeys: [], counts: {} })),
    ]).then(([cfg, p]) => {
      if (!alive) return;
      setConfig(cfg);
      setPulse(p || {});
    });
    return () => { alive = false; };
  }, [locale]);

  const counts = pulse.counts || {};
  const projects = useMemo(() => (pulse.active_journeys || []).slice(0, 4), [pulse.active_journeys]);
  const recent   = useMemo(() => pulse.recent_evolutions || [], [pulse.recent_evolutions]);
  const milestones = useMemo(() => pulse.chapters_waiting || [], [pulse.chapters_waiting]);

  return (
    <div className="atd-canvas" data-testid="atelier-dashboard">
      <Hero config={config} counts={counts} userName={userName} />

      <section className="atd-projects" data-testid="atelier-projects-section">
        <header className="atd-section__head">
          <h2 className="atd-section__title">
            {t('atelier.dashboard.projects.title', null,
               config?.section_projects_title || 'Journeys unfolding')}
          </h2>
          <Link to="/workspace/projects" className="atd-section__cta" data-testid="atd-see-all-projects">
            {t('atelier.dashboard.projects.see_all', null,
               config?.section_projects_cta || 'See all')}
            <ArrowUpRight size={13} strokeWidth={1.6} />
          </Link>
        </header>
        {projects.length === 0 ? (
          <div className="atd-projects__empty" data-testid="atelier-projects-empty">
            <p>{t('atelier.dashboard.projects.empty',
                  null,
                  'Your atelier is in silence. The next journey is waiting to begin.')}</p>
            <Link to="/workspace/projects" className="atd-projects__empty-cta">
              {t('atelier.dashboard.projects.empty_cta', null, 'Begin a new journey')}
              <ArrowUpRight size={13} strokeWidth={1.6} />
            </Link>
          </div>
        ) : (
          <div className="atd-projects__grid">
            {projects.map((p, i) => (
              <ProjectCard key={p.journey_id || p.id || i}
                           project={p} index={i}
                           fallbackMedia={config?.project_card_fallback_media || []} />
            ))}
          </div>
        )}
      </section>

      <section className="atd-desk">
        <ActivityColumn
          title={t('atelier.dashboard.col.recent_activity', null,
                   config?.section_activity_title || 'Recent activity')}
          events={recent} t={t} />
        <MilestonesColumn
          title={t('atelier.dashboard.col.upcoming_milestones', null,
                   config?.section_milestones_title || 'Upcoming milestones')}
          milestones={milestones} t={t} />
        <InspirationColumn
          title={t('atelier.dashboard.col.daily_inspiration', null,
                   config?.section_inspiration_title || 'Daily inspiration')}
          quote={config?.inspiration_quote}
          ambient={config?.inspiration_media}
          t={t} />
      </section>

      {/* ITER150 · Sprint A · Real Relationship Engine™ — live polling 5s */}
      <section className="atd-live-relationships" data-testid="atelier-live-relationships">
        <div className="atd-live-relationships__head">
          <div style={{ flex: 1 }} />
          <DesignerPresencePicker locale="it" />
        </div>
        <PendingBookingsPanel locale="it" />
        <RelationshipLiveTimeline locale="it" />
      </section>
    </div>
  );
};

export default AtelierDashboardPage;
