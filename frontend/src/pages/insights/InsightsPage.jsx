/**
 * InsightsPage — Studio Overview cinematic.
 *
 * Atlas curatoriale dello studio: numeri, ritmo, pulsazioni delle pietre
 * miliari, evoluzione 12 settimane, signature curatoriale. NO mock,
 * NO numeri inventati — tutti i dati arrivano da
 * /api/insights/studio-overview che li aggrega dal DB.
 *
 * Linguaggio: editoriale italiano. Mai "dashboard analytics".
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Compass, Layers, Bookmark, Users, Activity, Sparkles,
  TrendingUp, CircleDot,
} from 'lucide-react';
import api from '../../lib/api';
import './insights.css';
import { useT } from '../../i18n/useT';

// ─── Editorial labels for milestone types ──────────────────────────
const MILESTONE_LABEL = {
  brief:               'Brief Cliente',
  inspirations:        'Ispirazioni',
  moodboard_direction: 'Moodboard Direction',
  material_direction:  'Material Direction',
  concept_design:      'Concept Design',
  technical_package:   'Technical Package',
  curated_selections:  'Curated Selections',
  site_evolution:      'Site Evolution',
  final_presentation:  'Final Presentation',
  certified_closure:   'Chiusura Certificata',
};

const STATUS_TONE = {
  not_started:        '#6e6e6a',
  in_progress:        '#d9b285',
  presented:          '#7fdfff',
  revision_requested: '#e8a558',
  partially_approved: '#7fdfff',
  approved:           '#7fc89f',
  closed:             '#8a8a85',
};

// ─── Sparkline (pure SVG, GPU-safe) ────────────────────────────────
const Sparkline = ({ values, color = '#7fdfff', height = 60, label }) => {
  const { t } = useT();
  if (!values || !values.length) return null;
  const max = Math.max(...values, 1);
  const width = 280;
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${i * step},${height - (v / max) * (height - 8) - 4}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="ins-spark" data-testid={`spark-${(label || '').toLowerCase().replace(/\s+/g, '-')}`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="ins-spark__svg">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={color} stopOpacity="0.28" />
            <stop offset="95%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#grad-${label})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
};

// ─── Activity heatmap (30 days) ────────────────────────────────────
const ActivityHeatmap = ({ surface }) => {
  if (!surface?.days?.length) return null;
  const max = Math.max(...surface.events, 1);
  return (
    <div className="ins-heatmap" data-testid="ins-activity-heatmap">
      {surface.days.map((d, i) => {
        const v = surface.events[i];
        const intensity = v ? Math.max(0.18, v / max) : 0.04;
        return (
          <span
            key={d}
            title={`${d} · ${v} ${v === 1 ? 'evento' : 'eventi'}`}
            className="ins-heatmap__cell"
            style={{ backgroundColor: `rgba(127, 223, 255, ${intensity})` }}
          />
        );
      })}
    </div>
  );
};

// ─── Big stat card ─────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sublabel, tone = 'cyan', testid }) => (
  <div className={`ins-stat ins-stat--${tone}`} data-testid={testid}>
    <div className="ins-stat__icon"><Icon size={15} strokeWidth={1.4} /></div>
    <p className="ins-stat__label">{label}</p>
    <p className="ins-stat__value">{value}</p>
    {sublabel && <p className="ins-stat__sub">{sublabel}</p>}
  </div>
);

// ─── Milestone pulse row ───────────────────────────────────────────
const PulseRow = ({ entry }) => {
  const total = entry.total;
  const segments = Object.entries(entry.by_status || {});
  return (
    <div className="ins-pulse__row" data-testid={`ins-pulse-${entry.milestone_type}`}>
      <div className="ins-pulse__head">
        <span className="ins-pulse__title">
          {MILESTONE_LABEL[entry.milestone_type] || entry.milestone_type}
        </span>
        <span className="ins-pulse__count">{total}</span>
      </div>
      <div className="ins-pulse__bar">
        {segments.map(([status, count]) => {
          const w = (count / total) * 100;
          return (
            <span
              key={status}
              className="ins-pulse__seg"
              title={`${status} · ${count}`}
              style={{ flexBasis: `${w}%`, backgroundColor: STATUS_TONE[status] || '#444' }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─── Main page ─────────────────────────────────────────────────────
const InsightsPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/insights/studio-overview')
      .then((r) => setData(r.data))
      .catch(() => setError('Impossibile caricare le pulsazioni dello studio'));
  }, []);

  const headlineCards = useMemo(() => {
    if (!data) return [];
    const h = data.headline || {};
    return [
      { icon: Compass,  label: 'Progetti vivi',       value: h.projects,            sublabel: `${h.projects_won || 0} chiusi · ${h.projects_in_progress || 0} in lavorazione`, tone: 'gold',   testid: 'stat-projects' },
      { icon: Layers,   label: 'Moodboard',           value: h.moodboards,          sublabel: 'composizioni curatoriali',  tone: 'cyan',   testid: 'stat-moodboards' },
      { icon: Bookmark, label: 'Ispirazioni',         value: h.inspirations,        sublabel: 'memoria visuale',           tone: 'pearl',  testid: 'stat-inspirations' },
      { icon: Sparkles, label: 'Design Journey',      value: h.design_journeys,     sublabel: `${h.milestones_approved || 0} pietre miliari approvate`, tone: 'gold', testid: 'stat-journeys' },
      { icon: Users,    label: 'Accounts',            value: h.accounts,            sublabel: `${h.leads || 0} nuovi contatti`, tone: 'cyan',  testid: 'stat-accounts' },
      { icon: Activity, label: 'Studio attivo',       value: h.members,             sublabel: 'membri',                    tone: 'pearl',  testid: 'stat-members' },
    ];
  }, [data]);

  if (error) {
    return (
      <div className="ins-page ins-page--error" data-testid="ins-error">
        <p>{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="ins-page ins-page--loading" data-testid="ins-loading">
        <p>{t('insights.insights.sto_leggendo_le_pulsazioni_dello_studio')}</p>
      </div>
    );
  }

  return (
    <div className="ins-page" data-testid="insights-page">
      <header className="ins-header">
        <p className="ins-header__eyebrow">{t('insights.insights.studio_insights')}</p>
        <h1 className="ins-header__title"><em>{t('insights.insights.le_pulsazioni_dello_studio')}</em></h1>
        <p className="ins-header__sub">
          Una lettura editoriale di ciò che lo studio sta producendo, dove si sta muovendo
          il pensiero progettuale, quali capitoli del Design Journey™ stanno fiorendo.
        </p>
      </header>

      <section className="ins-stats" data-testid="ins-stats">
        {headlineCards.map((c) => <StatCard key={c.testid} {...c} />)}
      </section>

      <section className="ins-grid">
        {/* ── Evoluzione 12 settimane ─────────────────────── */}
        <article className="ins-card ins-card--evolution" data-testid="ins-evolution">
          <header className="ins-card__head">
            <div>
              <p className="ins-card__eyebrow">Ultime 12 settimane</p>
              <h2 className="ins-card__title"><em>{t('insights.insights.l_evoluzione_dello_studio')}</em></h2>
            </div>
            <TrendingUp size={16} strokeWidth={1.3} className="ins-card__icon" />
          </header>
          <div className="ins-evolution__list">
            <div className="ins-evolution__row">
              <div className="ins-evolution__meta">
                <p className="ins-evolution__label">Progetti</p>
                <p className="ins-evolution__value">{data.timeline.projects.reduce((a, b) => a + b, 0)}</p>
              </div>
              <Sparkline values={data.timeline.projects} color="#d9b285" label="projects" />
            </div>
            <div className="ins-evolution__row">
              <div className="ins-evolution__meta">
                <p className="ins-evolution__label">{t('insights.insights.moodboard')}</p>
                <p className="ins-evolution__value">{data.timeline.moodboards.reduce((a, b) => a + b, 0)}</p>
              </div>
              <Sparkline values={data.timeline.moodboards} color="#7fdfff" label="moodboards" />
            </div>
            <div className="ins-evolution__row">
              <div className="ins-evolution__meta">
                <p className="ins-evolution__label">Pietre miliari</p>
                <p className="ins-evolution__value">{data.timeline.milestones.reduce((a, b) => a + b, 0)}</p>
              </div>
              <Sparkline values={data.timeline.milestones} color="#7fc89f" label="milestones" />
            </div>
          </div>
        </article>

        {/* ── Milestone pulse ─────────────────────────────── */}
        <article className="ins-card ins-card--pulse" data-testid="ins-milestone-pulse">
          <header className="ins-card__head">
            <div>
              <p className="ins-card__eyebrow">Pietre miliari · Pulsazioni</p>
              <h2 className="ins-card__title"><em>{t('insights.insights.dove_si_trova_il_pensiero_progettuale')}</em></h2>
            </div>
            <CircleDot size={16} strokeWidth={1.3} className="ins-card__icon" />
          </header>
          <div className="ins-pulse">
            {data.milestone_pulse.slice(0, 10).map((e) => <PulseRow key={e.milestone_type} entry={e} />)}
            {data.milestone_pulse.length === 0 && (
              <p className="ins-empty">{t('insights.insights.nessuna_pietra_miliare_ancora_attiva')}</p>
            )}
          </div>
        </article>

        {/* ── Activity heatmap ─────────────────────────────── */}
        <article className="ins-card ins-card--activity" data-testid="ins-activity">
          <header className="ins-card__head">
            <div>
              <p className="ins-card__eyebrow">Ultimi 30 giorni</p>
              <h2 className="ins-card__title"><em>{t('insights.insights.la_superficie_viva_del_journey')}</em></h2>
            </div>
            <Activity size={16} strokeWidth={1.3} className="ins-card__icon" />
          </header>
          <p className="ins-activity__total">
            <span className="ins-activity__num">{data.activity_surface.total}</span>
            <span className="ins-activity__lbl">{t('insights.insights.eventi_narrativi_nel_mese')}</span>
          </p>
          <ActivityHeatmap surface={data.activity_surface} />
          <p className="ins-activity__legend">{t('insights.insights.ogni_cella_un_giorno_intensita_numero_di_eventi')}</p>
        </article>

        {/* ── Signature curatoriale ─────────────────────────── */}
        <article className="ins-card ins-card--signature" data-testid="ins-signature">
          <header className="ins-card__head">
            <div>
              <p className="ins-card__eyebrow">Signature curatoriale</p>
              <h2 className="ins-card__title"><em>{t('insights.insights.la_grammatica_dello_studio')}</em></h2>
            </div>
            <Sparkles size={16} strokeWidth={1.3} className="ins-card__icon" />
          </header>
          <div className="ins-sig">
            <div className="ins-sig__col">
              <p className="ins-sig__label">Tag ricorrenti</p>
              <ul className="ins-sig__tags">
                {data.signature.tags.slice(0, 8).map((t) => (
                  <li key={t.label} className="ins-sig__chip">
                    <span>{t.label}</span>
                    <em>{t.count}</em>
                  </li>
                ))}
                {!data.signature.tags.length && <li className="ins-empty">In attesa di letture culturali.</li>}
              </ul>
            </div>
            <div className="ins-sig__col">
              <p className="ins-sig__label">Famiglie cromatiche</p>
              <ul className="ins-sig__tags">
                {data.signature.colors.slice(0, 6).map((t) => (
                  <li key={t.label} className="ins-sig__chip ins-sig__chip--color">
                    <span>{t.label}</span>
                    <em>{t.count}</em>
                  </li>
                ))}
                {!data.signature.colors.length && <li className="ins-empty">Nessun cromatismo dominante.</li>}
              </ul>
            </div>
          </div>
        </article>
      </section>

      <footer className="ins-foot">
        <p>Aggiornato · {new Date(data.generated_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </footer>
    </div>
  );
};

export default InsightsPage;
