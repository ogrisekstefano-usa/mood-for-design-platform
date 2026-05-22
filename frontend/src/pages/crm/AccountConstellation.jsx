/**
 * AccountConstellation · Sprint G.3
 *
 * Trasforma l'Account da "scheda CRM" a "costellazione di Journey relazionali".
 *
 * 6 sezioni (in ordine di dominanza visiva):
 *   1. Hero relazionale
 *   2. Active Design Journeys™  ← cuore visivo
 *   3. People & Stakeholders™
 *   4. Project Memory™
 *   5. Shared Artifacts™
 *   6. Relationship Insights™
 *
 * Lessico vietato per design: tutto ciò che evoca funnel commerciale,
 * scoring di contatti, probabilità d'affare, tassi di chiusura.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Users, Sparkles, Layers, Compass } from 'lucide-react';
import api from '../../lib/api';
import './constellation.css';
import { useT } from '../../i18n/useT';
const STATE_TONE = {
  growing: {
    eyebrow: 'In crescita',
    glow: 'teal'
  },
  active: {
    eyebrow: 'Attiva',
    glow: 'teal'
  },
  trusted: {
    eyebrow: 'Di fiducia',
    glow: 'gold'
  },
  dormant: {
    eyebrow: 'In silenzio',
    glow: 'muted'
  },
  strategic: {
    eyebrow: 'Strategica',
    glow: 'gold'
  },
  returning: {
    eyebrow: 'Tornata',
    glow: 'teal'
  }
};
const LIFECYCLE_GLOW = {
  conversation_open: 'teal',
  in_progress: 'teal',
  presenting: 'amber',
  drifting: 'amber',
  on_pause: 'muted',
  approved: 'gold',
  closed: 'gold',
  editioned: 'gold',
  abandoned: 'muted'
};
const fmtSince = iso => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const months = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    if (months === 0) return 'in questi giorni';
    if (months < 12) return `da ${months} ${months === 1 ? 'mese' : 'mesi'}`;
    const y = Math.floor(months / 12);
    return `da ${y} ${y === 1 ? 'anno' : 'anni'}`;
  } catch {
    return null;
  }
};
const fmtWhen = iso => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short'
    });
  } catch {
    return null;
  }
};
const AccountConstellation = ({
  accountId
}) => {
  const {
    t
  } = useT();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    api.get(`/api/relationships/accounts/${accountId}/constellation`).then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [accountId]);
  if (loading) {
    return <div className="ac-loading" data-testid="constellation-loading">
        {t("crm.account_constellation.sto_leggendo_la_costellazione_relazionale")}
      </div>;
  }
  if (!data) return null;
  const {
    hero,
    active_journeys = [],
    people = [],
    memory = {},
    shared_artifacts = [],
    insights = [],
    lexicon = {}
  } = data;
  const stateMeta = STATE_TONE[hero.relationship_state] || STATE_TONE.active;
  const openJourney = j => nav(`/workspace/projects/${j.project_id}`);
  return <div className="ac-shell" data-testid="account-constellation">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <header className={`ac-hero ac-hero--${stateMeta.glow}`} data-testid="ac-hero">
        <div className="ac-hero__eyebrow">
          <span className="ac-hero__state">Relazione · {stateMeta.eyebrow}</span>
          {hero.since && <span className="ac-hero__since">{fmtSince(hero.since)}</span>}
        </div>
        <h1 className="ac-hero__name" data-testid="ac-hero-name">{hero.account_name}</h1>
        <div className="ac-hero__meta">
          <span data-testid="ac-hero-journeys">
            {hero.active_journeys} {hero.active_journeys === 1 ? 'Journey vivo' : 'Journey vivi'}
            {hero.total_journeys > hero.active_journeys && <em> · {hero.total_journeys} totali</em>}
          </span>
          {hero.primary_contact && <span>Riferimento · {hero.primary_contact.first_name}
              {hero.primary_contact.last_name && ` ${hero.primary_contact.last_name}`}</span>}
          {hero.locations && <span>{hero.locations}</span>}
          {hero.language && <span>Lingua · {hero.language.toUpperCase()}</span>}
        </div>
      </header>

      {/* ── ACTIVE DESIGN JOURNEYS (dominante) ──────────────── */}
      <section className="ac-section ac-journeys" data-testid="ac-journeys-section">
        <header className="ac-section__head">
          <span className="ac-section__eyebrow">{t('crm.account_constellation.sezione_dominante')}</span>
          <h2 className="ac-section__title">I Journey condivisi</h2>
        </header>

        {active_journeys.length === 0 ? <div className="ac-empty" data-testid="ac-journeys-empty">
            <p>{t('crm.account_constellation.nessun_journey_aperto_con_questa_relazione')}</p>
            <p className="ac-empty__sub">{t('crm.account_constellation.apri_una_conversazione_progettuale_per_cominciare')}</p>
          </div> : <div className="ac-journey-grid">
            {active_journeys.map(j => {
          const glow = LIFECYCLE_GLOW[j.lifecycle_state] || 'teal';
          return <article key={j.id} className={`ac-journey-card ac-journey-card--${glow}`} onClick={() => openJourney(j)} data-testid={`ac-journey-${j.id}`}>
                  <div className="ac-journey-card__eyebrow">
                    {lexicon.lifecycle_label?.[j.lifecycle_state] || j.lifecycle_state}
                  </div>
                  <div className="ac-journey-card__milestone">
                    {j.current_milestone?.label || 'In apertura'}
                  </div>
                  <div className="ac-journey-card__progress">
                    <div className="ac-journey-card__bar">
                      <div className="ac-journey-card__bar-fill" style={{
                  width: `${j.progress}%`
                }} />
                    </div>
                    <span>{j.milestones_done}/{j.milestones_total} pietre miliari</span>
                  </div>
                  {j.last_event && <p className="ac-journey-card__last">
                      <em>Ultima voce · {fmtWhen(j.last_event.when)}</em><br />
                      {j.last_event.text}
                    </p>}
                  <div className="ac-journey-card__cta">
                    {t("crm.account_constellation.apri_il_journey")} <ArrowRight size={12} />
                  </div>
                </article>;
        })}
          </div>}
      </section>

      {/* ── PEOPLE & STAKEHOLDERS ───────────────────────────── */}
      {people.length > 0 && <section className="ac-section" data-testid="ac-people-section">
          <header className="ac-section__head">
            <span className="ac-section__eyebrow"><Users size={11} /> {t('atelier_voice.account_constellation.people_eyebrow', null, 'Travel companions')}</span>
            <h2 className="ac-section__title">{t('crm.account_constellation.le_persone_della_relazione')}</h2>
          </header>
          <div className="ac-people">
            {people.map(p => <div key={p.id} className="ac-person" data-testid={`ac-person-${p.id}`}>
                <div className="ac-person__name">
                  {p.first_name} {p.last_name || ''}
                  {p.primary && <span className="ac-person__badge">riferimento</span>}
                </div>
                <div className="ac-person__role">
                  {p.role || p.involvement || 'collaboratore'}
                </div>
                {p.email && <div className="ac-person__email">{p.email}</div>}
              </div>)}
          </div>
        </section>}

      {/* ── PROJECT MEMORY ──────────────────────────────────── */}
      {(memory.preferred_materials?.length || memory.rationales?.length) > 0 && <section className="ac-section ac-memory" data-testid="ac-memory-section">
          <header className="ac-section__head">
            <span className="ac-section__eyebrow"><Sparkles size={11} /> {t('atelier_voice.account_constellation.memory_eyebrow', null, 'Design memory')}</span>
            <h2 className="ac-section__title">{t('atelier_voice.account_constellation.memory_title', null, 'What has already been said')}</h2>
          </header>

          {memory.preferred_materials?.length > 0 && <div className="ac-memory__row">
              <div className="ac-memory__label">Materie che ama</div>
              <div className="ac-memory__chips">
                {memory.preferred_materials.map(m => <span key={m} className="ac-chip">{m}</span>)}
              </div>
            </div>}

          {memory.saved_inspirations_count > 0 && <div className="ac-memory__row">
              <div className="ac-memory__label">Ispirazioni raccolte</div>
              <div className="ac-memory__value">{memory.saved_inspirations_count}</div>
            </div>}

          {memory.rationales?.length > 0 && <div className="ac-memory__rationales">
              {memory.rationales.slice(0, 3).map((r, i) => <blockquote key={i} className="ac-rationale" data-testid={`ac-rationale-${i}`}>
                  <div className="ac-rationale__eyebrow">{r.title || r.kind}</div>
                  <p>{r.rationale}</p>
                </blockquote>)}
            </div>}
        </section>}

      {/* ── SHARED ARTIFACTS ────────────────────────────────── */}
      {shared_artifacts.length > 0 && <section className="ac-section" data-testid="ac-artifacts-section">
          <header className="ac-section__head">
            <span className="ac-section__eyebrow"><Layers size={11} /> Artefatti condivisi</span>
            <h2 className="ac-section__title">{t('atelier_voice.account_constellation.artifacts_title', null, 'What has been presented')}</h2>
          </header>
          <div className="ac-artifacts">
            {shared_artifacts.slice(0, 8).map(a => <div key={`${a.artifact_type}-${a.artifact_id}`} className="ac-artifact" data-testid={`ac-artifact-${a.artifact_id}`}>
                <div className="ac-artifact__kind">
                  {a.artifact_type === 'moodboard' ? 'Moodboard' : a.artifact_type === 'proposal' ? 'Proposta' : 'Collezione curata'}
                </div>
                <div className="ac-artifact__title">{a.title || '—'}</div>
                <div className="ac-artifact__when">{fmtWhen(a.created_at)}</div>
              </div>)}
          </div>
        </section>}

      {/* ── RELATIONSHIP INSIGHTS ───────────────────────────── */}
      {insights.length > 0 && <section className="ac-section ac-insights" data-testid="ac-insights-section">
          <header className="ac-section__head">
            <span className="ac-section__eyebrow"><Compass size={11} /> {t("crm.account_constellation.segnali_del_viaggio")}</span>
            <h2 className="ac-section__title">Momenti in attesa</h2>
          </header>
          <div className="ac-insights__list">
            {insights.map((s, i) => <div key={i} className={`ac-insight ac-insight--${s.severity || 'soft'}`} data-testid={`ac-insight-${i}`}>
                <em>{fmtWhen(s.observed_at)}</em>
                <span>{s.note}</span>
              </div>)}
          </div>
        </section>}

    </div>;
};
export default AccountConstellation;