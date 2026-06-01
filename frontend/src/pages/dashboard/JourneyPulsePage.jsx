/**
 * JourneyPulsePage · Sprint G.4 — Studio Pulse™.
 *
 * NON è analytics. NON è KPI. NON è BI.
 * È il ritmo progettuale dello studio: dove siamo, dove le voci attendono,
 * dove serve un capitolo, dove un viaggio respira in silenzio.
 *
 * 7 sezioni: I Journey vivi · Le voci di oggi · Capitoli in attesa ·
 * Revisioni aperte · Ultime evoluzioni · Journey in silenzio · Prossimi gesti.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useT, useBlueprint } from '../../contexts/BlueprintContext';
import { useNewRelationship } from '../../hooks/useNewRelationship';
import './journey-pulse.css';

// ITER179 · empty-state CTA che apre il modale CRM (Nuovo Lead)
const NewRelationshipCta = () => {
  const { open } = useNewRelationship();
  return (
    <button
      type="button"
      onClick={() => open({ choice: 'lead' })}
      className="jp-empty__cta"
      data-testid="jp-empty-new-relationship-cta"
    >
      <Plus size={13} strokeWidth={1.5} style={{ marginRight: 6, verticalAlign: '-2px' }} />
      Nuovo Lead
    </button>
  );
};

const LIFECYCLE_GLOW = {
  conversation_open: 'teal',
  in_progress:       'teal',
  presenting:        'amber',
  drifting:          'amber',
  on_pause:          'muted',
  approved:          'gold',
  closed:            'gold',
  editioned:         'gold',
  abandoned:         'muted',
};

const TONE_GLOW = {
  embrace:  'gold',
  curious:  'teal',
  reorient: 'amber',
  voice:    'muted',
};

const fmtWhen = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

// fmtDaysAgo now lives inside the component to access the t() function.

const JourneyPulsePage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const t = useT();
  const { locale } = useBlueprint();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    // Sprint JOURNEY-TAXONOMY-I18N: pass the active locale so the backend
    // resolves lifecycle / milestone labels via the editorial taxonomy.
    api.get('/api/dashboard/pulse', { params: { locale } })
       .then((r) => { if (!cancel) setData(r.data); })
       .catch(() => {})
       .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [locale]);

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.pulse.greet.morning');
    if (h < 18) return t('dashboard.pulse.greet.afternoon');
    return t('dashboard.pulse.greet.evening');
  };

  const fmtDaysAgo = (n) => {
    if (n === 0) return t('dashboard.pulse.relative.today');
    if (n === 1) return t('dashboard.pulse.relative.yesterday');
    return t('dashboard.pulse.relative.days_ago', { n });
  };

  const openJourney = (project_id) => nav(`/workspace/projects/${project_id}`);

  if (loading) {
    return (
      <div className="jp-shell" data-testid="pulse-loading">
        <div className="jp-container">
          <div className="jp-hero__eyebrow">{t('dashboard.pulse.eyebrow').split(' · ')[0]}</div>
          <h1 className="jp-hero__title">{t('dashboard.pulse.loading_title')}</h1>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const {
    active_journeys = [],
    voices_today = [],
    chapters_waiting = [],
    revisions_open = [],
    recent_evolutions = [],
    silent_journeys = [],
    next_actions = [],
    counts = {},
  } = data;

  return (
    <div className="jp-shell" data-testid="journey-pulse-page">
      <div className="jp-container">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className="jp-hero" data-testid="jp-hero">
          <div className="jp-hero__eyebrow">{t('dashboard.pulse.eyebrow')}</div>
          <h1 className="jp-hero__title">
            {greet()}{user?.first_name ? `, ${user.first_name}` : ''}.
          </h1>
          <p className="jp-hero__sub">
            {counts.active === 0 ? (
              <>{t('dashboard.pulse.summary.empty')}</>
            ) : (
              <>
                {counts.active === 1
                  ? t('dashboard.pulse.summary.one', { n: counts.active })
                  : t('dashboard.pulse.summary.many', { n: counts.active })}
                {counts.voices_today > 0 && <> · {t('dashboard.pulse.summary.voices_today', { n: counts.voices_today })}</>}
                {counts.chapters_waiting > 0 && <> · {t('dashboard.pulse.summary.chapters_waiting', { n: counts.chapters_waiting })}</>}
                {counts.revisions_open > 0 && <> · {t('dashboard.pulse.summary.revisions_open', { n: counts.revisions_open })}</>}
              </>
            )}
          </p>
        </header>

        {/* ── 1 · ACTIVE DESIGN JOURNEYS™ (dominante) ─────────── */}
        <section className="jp-section" data-testid="jp-active-section">
          <header className="jp-section__head">
            <span className="jp-section__eyebrow">{t('dashboard.pulse.sections.active.eyebrow')}</span>
            <h2 className="jp-section__title">{t('dashboard.pulse.sections.active.title')}</h2>
          </header>

          {active_journeys.length === 0 ? (
            <div className="jp-empty" data-testid="jp-active-empty">
              <p>{t('dashboard.pulse.sections.active.empty')}</p>
              <NewRelationshipCta />
            </div>
          ) : (
            <div className="jp-journey-grid">
              {active_journeys.slice(0, 8).map((j) => {
                const glow = LIFECYCLE_GLOW[j.lifecycle_state] || 'teal';
                return (
                  <article key={j.journey_id}
                           className={`jp-card jp-card--${glow}`}
                           onClick={() => openJourney(j.project_id)}
                           data-testid={`jp-journey-${j.journey_id}`}>
                    <div className="jp-card__meta">
                      <span className="jp-card__account">{j.account_name}</span>
                      <span className="jp-card__lifecycle">{j.lifecycle_label}</span>
                    </div>
                    <div className="jp-card__milestone">
                      {j.current_milestone?.label || t('dashboard.pulse.card.opening')}
                    </div>
                    <div className="jp-card__progress">
                      <div className="jp-card__bar">
                        <div className="jp-card__bar-fill" style={{ width: `${j.progress}%` }} />
                      </div>
                      <span>{j.milestones_done}/{j.milestones_total}</span>
                    </div>
                    {j.last_event && (
                      <p className="jp-card__last">
                        <em>{t('dashboard.pulse.card.last_voice', { when: fmtWhen(j.last_event.when) })}</em>
                        {j.last_event.text}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 2 · LE VOCI DI OGGI ─────────────────────────────── */}
        {voices_today.length > 0 && (
          <section className="jp-section" data-testid="jp-voices-section">
            <header className="jp-section__head">
              <span className="jp-section__eyebrow">{t('dashboard.pulse.sections.voices.eyebrow')}</span>
              <h2 className="jp-section__title">{t('dashboard.pulse.sections.voices.title')}</h2>
            </header>
            <div className="jp-voices">
              {voices_today.slice(0, 8).map((v) => (
                <article key={v.feedback_id}
                         className={`jp-voice jp-voice--${TONE_GLOW[v.tone] || 'muted'}`}
                         onClick={() => openJourney(v.project_id)}
                         data-testid={`jp-voice-${v.feedback_id}`}>
                  <div className="jp-voice__when">{fmtWhen(v.when)}</div>
                  <div className="jp-voice__body">
                    <div className="jp-voice__phrase">{v.voice_phrase}</div>
                    {v.quote && (<div className="jp-voice__quote">«{v.quote}»</div>)}
                  </div>
                  <div className="jp-voice__ctx">
                    <span>{v.account}</span>
                    <span className="jp-voice__milestone">{v.milestone}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── 3 · CAPITOLI IN ATTESA ──────────────────────────── */}
        {chapters_waiting.length > 0 && (
          <section className="jp-section" data-testid="jp-waiting-section">
            <header className="jp-section__head">
              <span className="jp-section__eyebrow">{t('dashboard.pulse.sections.waiting.eyebrow')}</span>
              <h2 className="jp-section__title">{t('dashboard.pulse.sections.waiting.title')}</h2>
            </header>
            <div className="jp-list">
              {chapters_waiting.slice(0, 6).map((c, i) => (
                <div key={i} className="jp-line"
                     onClick={() => openJourney(c.project_id)}
                     data-testid={`jp-waiting-${i}`}>
                  <em>{c.account}</em>
                  <span className="jp-line__main">{c.chapter_title} · {c.milestone}</span>
                  <span className="jp-line__hint">{t('dashboard.pulse.action.presented_relative', { when: fmtDaysAgo(c.since_days) })}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 4 · REVISIONI APERTE ────────────────────────────── */}
        {revisions_open.length > 0 && (
          <section className="jp-section" data-testid="jp-revisions-section">
            <header className="jp-section__head">
              <span className="jp-section__eyebrow">{t('dashboard.pulse.sections.revisions.eyebrow')}</span>
              <h2 className="jp-section__title">{t('dashboard.pulse.sections.revisions.title')}</h2>
            </header>
            <div className="jp-list">
              {revisions_open.slice(0, 6).map((r) => (
                <div key={r.feedback_id} className="jp-line jp-line--amber"
                     onClick={() => openJourney(r.project_id)}
                     data-testid={`jp-revision-${r.feedback_id}`}>
                  <em>{r.account}</em>
                  <span className="jp-line__main">{r.voice_phrase} · {r.milestone}</span>
                  <span className="jp-line__hint">{fmtWhen(r.when)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 5 · ULTIME EVOLUZIONI ───────────────────────────── */}
        {recent_evolutions.length > 0 && (
          <section className="jp-section" data-testid="jp-evolutions-section">
            <header className="jp-section__head">
              <span className="jp-section__eyebrow">{t('dashboard.pulse.sections.evolutions.eyebrow')}</span>
              <h2 className="jp-section__title">{t('dashboard.pulse.sections.evolutions.title')}</h2>
            </header>
            <div className="jp-list">
              {recent_evolutions.slice(0, 6).map((e) => (
                <div key={e.version_id} className="jp-line"
                     onClick={() => openJourney(e.project_id)}
                     data-testid={`jp-evolution-${e.version_id}`}>
                  <em>{e.account}</em>
                  <span className="jp-line__main">{e.chapter} · {e.milestone}</span>
                  <span className="jp-line__hint">{fmtWhen(e.when)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 6 · JOURNEY SILENZIOSI ──────────────────────────── */}
        {silent_journeys.length > 0 && (
          <section className="jp-section" data-testid="jp-silent-section">
            <header className="jp-section__head">
              <span className="jp-section__eyebrow">{t('dashboard.pulse.sections.silent.eyebrow')}</span>
              <h2 className="jp-section__title">{t('dashboard.pulse.sections.silent.title')}</h2>
            </header>
            <div className="jp-list">
              {silent_journeys.slice(0, 6).map((s) => (
                <div key={s.journey_id} className="jp-line jp-line--muted"
                     onClick={() => openJourney(s.project_id)}
                     data-testid={`jp-silent-${s.journey_id}`}>
                  <em>{s.account_name}</em>
                  <span className="jp-line__main">
                    {s.current_milestone?.label || s.lifecycle_label}
                  </span>
                  <span className="jp-line__hint">{s.silence_phrase}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 7 · PROSSIMI GESTI (next actions) ───────────────── */}
        {next_actions.length > 0 && (
          <section className="jp-section" data-testid="jp-actions-section">
            <header className="jp-section__head">
              <span className="jp-section__eyebrow">{t('dashboard.pulse.sections.actions.eyebrow')}</span>
              <h2 className="jp-section__title">{t('dashboard.pulse.sections.actions.title')}</h2>
            </header>
            <div className="jp-actions">
              {next_actions.map((a) => (
                <div key={a.journey_id} className="jp-action"
                     onClick={() => openJourney(a.project_id)}
                     data-testid={`jp-action-${a.journey_id}`}>
                  <div className="jp-action__suggestion">{a.suggestion}</div>
                  <div className="jp-action__ctx">{a.account}</div>
                  <div className="jp-action__cta">
                    {t('dashboard.pulse.action.open_journey')} <ArrowRight size={11} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default JourneyPulsePage;
