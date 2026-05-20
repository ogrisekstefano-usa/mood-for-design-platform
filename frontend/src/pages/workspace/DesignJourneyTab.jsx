/**
 * DesignJourneyTab — Design Journey™ Foundation (Phase F.A).
 *
 * Default landing del Project Detail.
 *
 * Layout cinematic dark luxury (mai enterprise):
 *   ┌─ LEFT ────┬─ CENTER (focus) ──────────┬─ RIGHT ─┐
 *   │  Pietre   │  Milestone attiva grande   │ Dettagli │
 *   │  miliari  │  con preview emotional +   │ + Owner  │
 *   │  numerate │  status + Apri CTA         │ + Note   │
 *   └───────────┴────────────────────────────┴──────────┘
 *   ┌─ BOTTOM · Project Evolution Timeline (narrativa) ─┐
 *   └────────────────────────────────────────────────────┘
 *
 * Italian-only copy. Linguaggio editoriale, mai project management.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './design-journey.css';

const STATUS_META = {
  not_started:        { label: 'Non iniziata',         tone: 'muted' },
  in_progress:        { label: 'In lavorazione',       tone: 'warm' },
  presented:          { label: 'Presentata',           tone: 'cyan' },
  revision_requested: { label: 'Revisione richiesta',  tone: 'amber' },
  partially_approved: { label: 'Approvata parzialmente', tone: 'cyan' },
  approved:           { label: 'Approvata',            tone: 'success' },
  closed:             { label: 'Chiusa',               tone: 'closed' },
};

const STATUS_TRANSITIONS = {
  // Allowed forward transitions
  not_started:        ['in_progress'],
  in_progress:        ['presented', 'approved'],
  presented:          ['revision_requested', 'partially_approved', 'approved'],
  revision_requested: ['in_progress', 'presented'],
  partially_approved: ['approved', 'revision_requested'],
  approved:           ['closed'],
  closed:             [],
};

const MILESTONE_ICON = {
  brief:                Icons.MessageCircle,
  inspirations:         Icons.Sparkles,
  moodboard_direction:  Icons.Layers,
  material_direction:   Icons.Boxes,
  concept_design:       Icons.Compass,
  technical_package:    Icons.FileText,
  curated_selections:   Icons.Bookmark,
  site_evolution:       Icons.Camera,
  final_presentation:   Icons.Sun,
  certified_closure:    Icons.CheckCircle2,
};

const fmtDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('it-IT',
      { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return null; }
};


// ─── Left column · Milestones list ──────────────────────────────────
const TimelineRail = ({ milestones, currentId, onPick }) => (
  <aside className="dj-rail" data-testid="dj-rail">
    <p className="dj-rail__eyebrow">Pietre miliari</p>
    <ol className="dj-rail__list">
      {milestones.map((m, i) => {
        const Icon = MILESTONE_ICON[m.milestone_type] || Icons.Circle;
        const meta = STATUS_META[m.status] || STATUS_META.not_started;
        const isCurrent = currentId === m.id;
        return (
          <li
            key={m.id}
            className={`dj-rail__item ${isCurrent ? 'is-current' : ''} dj-status-${meta.tone}`}
            data-testid={`dj-rail-item-${m.milestone_type}`}
          >
            <button
              type="button"
              className="dj-rail__btn"
              onClick={() => onPick(m.id)}
            >
              <span className="dj-rail__num">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="dj-rail__icon"><Icon size={14} /></span>
              <span className="dj-rail__meta">
                <span className="dj-rail__title">{m.title}</span>
                <span className="dj-rail__status">{meta.label}</span>
              </span>
            </button>
            {i < milestones.length - 1 && <div className="dj-rail__connector" />}
          </li>
        );
      })}
    </ol>
  </aside>
);


// ─── Center · Active milestone focus panel ──────────────────────────
const InlinePanel = ({ milestone }) => {
  const t = milestone.milestone_type;
  if (t === 'brief') {
    return (
      <div className="dj-inline" data-testid="dj-inline-brief">
        <p className="dj-inline__eyebrow">Brief Cliente</p>
        <h3 className="dj-inline__title">
          <em>La prima conversazione</em>
        </h3>
        <p className="dj-inline__sub">
          Raccogli obiettivi, atmosfera desiderata, ambienti e timing.
          Il Brief è il seme da cui tutto il Design Journey™ prende forma.
        </p>
        <div className="dj-inline__hint">
          <Icons.Info size={11} />
          <span>L'editor del Brief arriverà nel prossimo capitolo.</span>
        </div>
      </div>
    );
  }
  if (t === 'site_evolution') {
    return (
      <div className="dj-inline" data-testid="dj-inline-site-evolution">
        <p className="dj-inline__eyebrow">Site Evolution™</p>
        <h3 className="dj-inline__title">
          <em>L'evoluzione reale del progetto</em>
        </h3>
        <p className="dj-inline__sub">
          Fotografie di avanzamento, prima/dopo, dettagli materiali,
          sopralluoghi — il progetto raccontato per immagini, in ordine cronologico.
        </p>
        <div className="dj-inline__hint">
          <Icons.Info size={11} />
          <span>La timeline fotografica arriverà nel prossimo capitolo.</span>
        </div>
      </div>
    );
  }
  if (t === 'certified_closure') {
    return (
      <div className="dj-inline" data-testid="dj-inline-closure">
        <p className="dj-inline__eyebrow">Chiusura Certificata</p>
        <h3 className="dj-inline__title">
          <em>Il progetto entra nella memoria firmata dello studio</em>
        </h3>
        <p className="dj-inline__sub">
          La cerimonia di chiusura riassume pietre miliari completate,
          approvazioni e snapshot finale. Una volta certificato il progetto
          potrà cristallizzare una Cultural Edition™.
        </p>
        <div className="dj-inline__hint">
          <Icons.Info size={11} />
          <span>La cerimonia e la cristallizzazione arriveranno nei capitoli successivi.</span>
        </div>
      </div>
    );
  }
  return null;
};


const FocusPanel = ({ milestone, onStatusChange, onOpen, busy }) => {
  if (!milestone) return null;
  const meta = STATUS_META[milestone.status] || STATUS_META.not_started;
  const Icon = MILESTONE_ICON[milestone.milestone_type] || Icons.Circle;
  const openMode = milestone.metadata?.open_mode || 'inline';
  const transitions = STATUS_TRANSITIONS[milestone.status] || [];

  return (
    <main className="dj-focus" data-testid="dj-focus">
      <header className="dj-focus__head">
        <span className="dj-focus__icon"><Icon size={18} /></span>
        <div className="dj-focus__meta">
          <p className="dj-focus__eyebrow">
            Pietra miliare · <span className={`dj-pill dj-pill--${meta.tone}`}>{meta.label}</span>
          </p>
          <h2 className="dj-focus__title">
            <em>{milestone.title}</em>
          </h2>
          {milestone.description && (
            <p className="dj-focus__desc">{milestone.description}</p>
          )}
        </div>
      </header>

      {/* Inline-rendered milestones get a placeholder body */}
      {openMode === 'inline' && <InlinePanel milestone={milestone} />}

      {/* Navigate-mode milestones get a CTA hero */}
      {openMode === 'navigate' && (
        <div className="dj-focus__hero" data-testid="dj-focus-hero">
          <div className="dj-focus__hero-inner">
            <p className="dj-focus__hero-eyebrow">L'ambiente dedicato è pronto</p>
            <p className="dj-focus__hero-text">
              {milestone.title} si svolge in uno spazio dedicato.
              Aprilo per continuare la direzione progettuale.
            </p>
            <button
              type="button"
              className="dj-btn dj-btn--primary"
              onClick={() => onOpen(milestone)}
              disabled={busy}
              data-testid="dj-focus-open"
            >
              <Icons.ArrowUpRight size={14} />
              <span>Apri {milestone.title}</span>
            </button>
          </div>
        </div>
      )}

      {/* Status transition actions */}
      {transitions.length > 0 && (
        <div className="dj-focus__transitions" data-testid="dj-focus-transitions">
          <p className="dj-focus__transitions-label">Aggiorna direzione</p>
          <div className="dj-focus__transitions-row">
            {transitions.map(s => {
              const m = STATUS_META[s];
              const cls = s === 'approved' ? 'dj-btn--accent'
                : s === 'revision_requested' ? 'dj-btn--ghost-warm'
                : 'dj-btn--ghost';
              return (
                <button
                  key={s}
                  type="button"
                  className={`dj-btn ${cls}`}
                  onClick={() => onStatusChange(milestone, s)}
                  disabled={busy}
                  data-testid={`dj-transition-${s}`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
};


// ─── Right · Details panel ──────────────────────────────────────────
const DetailsPanel = ({ milestone }) => {
  if (!milestone) return null;
  return (
    <aside className="dj-details" data-testid="dj-details">
      <p className="dj-details__eyebrow">Dettagli pietra miliare</p>
      <dl className="dj-details__list">
        <div>
          <dt>Iniziata</dt>
          <dd>{fmtDate(milestone.started_at) || '—'}</dd>
        </div>
        <div>
          <dt>Presentata</dt>
          <dd>{fmtDate(milestone.presented_at) || '—'}</dd>
        </div>
        <div>
          <dt>Approvata</dt>
          <dd>{fmtDate(milestone.approved_at) || '—'}</dd>
        </div>
        <div>
          <dt>Chiusa</dt>
          <dd>{fmtDate(milestone.closed_at) || '—'}</dd>
        </div>
      </dl>
      <div className="dj-details__hint">
        Riscontri cliente e varianti compariranno qui nei prossimi capitoli.
      </div>
    </aside>
  );
};


// ─── Bottom · Project Evolution Timeline ─────────────────────────────
const EvolutionTimeline = ({ events }) => {
  if (!events?.length) return null;
  return (
    <section className="dj-evolution" data-testid="dj-evolution">
      <header className="dj-evolution__head">
        <p className="dj-evolution__eyebrow">Evoluzione del progetto</p>
        <h3 className="dj-evolution__title">
          <em>La storia che il progetto sta scrivendo</em>
        </h3>
      </header>
      <ol className="dj-evolution__list">
        {events.slice(0, 20).map(e => (
          <li key={e.id} className="dj-evolution__item">
            <span className="dj-evolution__dot" />
            <div className="dj-evolution__body">
              <p className="dj-evolution__text">{e.narrative_text}</p>
              <p className="dj-evolution__date">{fmtDate(e.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};


// ─── Main component ────────────────────────────────────────────────
const DesignJourneyTab = ({ projectId }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/projects/${projectId}/journey`)
      .then(r => {
        setData(r.data);
        const cur = r.data.journey?.current_milestone_id
          || r.data.milestones?.[0]?.id;
        setActiveId(prev => prev || cur);
      })
      .catch(() => setError('Impossibile caricare il Design Journey™'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const active = useMemo(
    () => data?.milestones?.find(m => m.id === activeId) || null,
    [data, activeId],
  );

  const onPick = (mid) => setActiveId(mid);

  const onStatusChange = async (m, newStatus) => {
    setBusy(true);
    try {
      await api.patch(`/api/journeys/milestones/${m.id}`, { status: newStatus });
      toast.success(`${m.title} · ${STATUS_META[newStatus].label}`);
      await load();
    } catch (e) {
      toast.error('Aggiornamento non riuscito');
    } finally { setBusy(false); }
  };

  const onOpen = async (m) => {
    setBusy(true);
    try {
      const r = await api.post(`/api/journeys/milestones/${m.id}/open`);
      const { open_mode, linked_route, linked_entity_id, linked_entity_type } = r.data;
      if (open_mode === 'navigate' && linked_route) {
        // Append linked_entity_id if relevant
        let route = linked_route;
        if (linked_entity_type === 'moodboard' && linked_entity_id) {
          route = `/moodboards/${linked_entity_id}`;
        }
        navigate(route);
      } else {
        // Inline mode → just stay on the focus panel (already showing inline body)
        toast.success(`${m.title} aperta`);
      }
      // Refresh journey to pick up the auto-transition not_started → in_progress
      load();
    } catch {
      toast.error('Apertura non riuscita');
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <div className="dj-shell dj-shell--loading" data-testid="dj-loading">
        <p className="dj-loading-text">
          Sto preparando il Design Journey™…
        </p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="dj-shell dj-shell--error" data-testid="dj-error">
        <Icons.AlertCircle size={20} />
        <p>{error || 'Errore'}</p>
      </div>
    );
  }

  return (
    <div className="dj-shell" data-testid="dj-shell">
      <header className="dj-shell__head">
        <p className="dj-shell__eyebrow">Design Journey™</p>
        <h1 className="dj-shell__title">
          <em>L'evoluzione progettuale di questo progetto</em>
        </h1>
      </header>

      <div className="dj-body">
        <TimelineRail
          milestones={data.milestones}
          currentId={activeId}
          onPick={onPick}
        />
        <FocusPanel
          milestone={active}
          onStatusChange={onStatusChange}
          onOpen={onOpen}
          busy={busy}
        />
        <DetailsPanel milestone={active} />
      </div>

      <EvolutionTimeline events={data.timeline || []} />
    </div>
  );
};

export default DesignJourneyTab;
