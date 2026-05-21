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
import MilestoneDialogue from '../../components/journey/MilestoneDialogue';
import JourneyClosureCeremony from '../../components/journey/JourneyClosureCeremony';
import { useT } from '../../i18n/useT';
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
const InlinePanel = ({ milestone, project }) => {
  const { t: tt } = useT();
  const t = milestone.milestone_type;
  if (t === 'brief') {
    return (
      <div className="dj-inline" data-testid="dj-inline-brief">
        <p className="dj-inline__eyebrow">Brief Cliente</p>
        <h3 className="dj-inline__title">
          <em>{tt('journey.tab.first_conversation')}</em>
        </h3>
        <p className="dj-inline__sub">
          Raccogli obiettivi, atmosfera desiderata, ambienti e timing.
          Il Brief è il seme da cui tutto il Design Journey™ prende forma.
        </p>
        <div className="dj-inline__hint">
          <Icons.Info size={11} />
          <span>{tt('journey.tab.brief_editor_coming')}</span>
        </div>
      </div>
    );
  }
  if (t === 'site_evolution') {
    return (
      <div className="dj-inline" data-testid="dj-inline-site-evolution">
        <p className="dj-inline__eyebrow">Site Evolution™</p>
        <h3 className="dj-inline__title">
          <em>{tt('journey.tab.evolution_real')}</em>
        </h3>
        <p className="dj-inline__sub">
          Fotografie di avanzamento, prima/dopo, dettagli materiali,
          sopralluoghi — il progetto raccontato per immagini, in ordine cronologico.
        </p>
        <div className="dj-inline__hint">
          <Icons.Info size={11} />
          <span>{tt('journey.tab.timeline_coming')}</span>
        </div>
      </div>
    );
  }
  if (t === 'certified_closure') {
    return (
      <JourneyClosureCeremony
        journeyId={project?.journey_id || milestone?.journey_id}
        projectTitle={project?.title || ''}
        onDeposited={() => {
          // Soft refresh: reload the page so the journey reflects archived state
          if (typeof window !== 'undefined') window.location.reload();
        }}
      />
    );
  }
  return null;
};


const FocusPanel = ({ milestone, project, onStatusChange, onOpen, busy }) => {
  const { t: tt } = useT();
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
      {openMode === 'inline' && <InlinePanel milestone={milestone} project={project} />}

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
          <p className="dj-focus__transitions-label">{tt('journey.tab.update_direction')}</p>
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
  const { t: tt } = useT();
  if (!events?.length) return null;
  return (
    <section className="dj-evolution" data-testid="dj-evolution">
      <header className="dj-evolution__head">
        <p className="dj-evolution__eyebrow">{tt('journey.tab.evolution')}</p>
        <h3 className="dj-evolution__title">
          <em>{tt('journey.tab.story')}</em>
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
const DesignJourneyTab = ({ projectId, project }) => {
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

  // Journey Absorption™ — soft progress narrative in editorial italian.
  // No percentages. No "X% complete". Only milestone-counted prose.
  const progressNarrative = useMemo(() => {
    if (!data?.milestones?.length) return null;
    const ms = data.milestones;
    const total = ms.length;
    const completed = ms.filter(m =>
      ['approved', 'closed'].includes(m.status)).length;
    const inProgress = ms.find(m =>
      ['in_progress', 'presented', 'revision_requested', 'partially_approved']
        .includes(m.status));
    const journeyClosed = data.journey?.overall_status === 'closed';

    if (journeyClosed) return 'Chiusura certificata · capitolo concluso';
    if (completed === 0 && !inProgress) return 'Il viaggio è appena iniziato';
    if (completed === 0 && inProgress) return `Direzione in avvio · ${inProgress.title}`;
    if (completed === total) return 'Tutte le pietre miliari sono state approvate';
    const noun = completed === 1 ? 'pietra miliare completata' : 'pietre miliari completate';
    if (inProgress) return `${completed} ${noun} · ora ${inProgress.title}`;
    return `${completed} ${noun}`;
  }, [data]);

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

      // Sprint G.6 — Step-Anchored Artifact Pages™.
      // Per i capitoli che hanno un workspace contestuale, NON navighiamo
      // più alla pagina globale (moodboards / materials). Apriamo lo Step
      // Workspace dentro al Journey.
      const STEP_WORKSPACE_TYPES = new Set([
        'moodboard_direction',
        'material_direction',
        'technical_package',
        'final_presentation',
      ]);
      if (STEP_WORKSPACE_TYPES.has(m.milestone_type)) {
        navigate(`/journey/${projectId}/step/${m.milestone_type}`);
        load();
        return;
      }

      if (open_mode === 'navigate' && linked_route) {
        // Resolve the destination route. When opening a specific moodboard
        // we navigate directly to its canvas; otherwise we land on the
        // module index.
        let route = linked_route;
        if (linked_entity_type === 'moodboard' && linked_entity_id) {
          route = `/moodboards/${linked_entity_id}`;
        }
        // Append ?project=<id> to preserve the Journey Continuity™ context
        // in the satellite module — the JourneyContextHeader™ reads it.
        const sep = route.includes('?') ? '&' : '?';
        const withCtx = `${route}${sep}project=${projectId}&from=journey`;
        navigate(withCtx);
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

  const designer = project?.assigned_designer;

  return (
    <div className="dj-shell" data-testid="dj-shell">
      <header className="dj-shell__head" data-testid="dj-absorption-header">
        <div className="dj-shell__head-row">
          <div className="dj-shell__head-main">
            <p className="dj-shell__eyebrow">Design Journey™</p>
            <h1 className="dj-shell__title" data-testid="dj-project-title">
              <em>{project?.title || 'Progetto'}</em>
            </h1>
            {progressNarrative && (
              <p className="dj-shell__narrative" data-testid="dj-progress-narrative">
                {progressNarrative}
              </p>
            )}
          </div>
          {designer && (
            <aside className="dj-shell__advisor" data-testid="dj-advisor-strip">
              {designer.avatar_url && (
                <img
                  src={designer.avatar_url}
                  alt={designer.first_name || ''}
                  className="dj-shell__advisor-avatar"
                />
              )}
              <div className="dj-shell__advisor-meta">
                <span className="dj-shell__advisor-eyebrow">Seguito da</span>
                <span className="dj-shell__advisor-name">
                  {designer.first_name} {designer.last_name || ''}
                </span>
              </div>
            </aside>
          )}
        </div>
      </header>

      <div className="dj-body">
        <TimelineRail
          milestones={data.milestones}
          currentId={activeId}
          onPick={onPick}
        />
        <FocusPanel
          key={active?.id || 'none'}
          milestone={active}
          project={{
            id: project?.id,
            title: project?.title,
            journey_id: data?.journey?.id,
          }}
          onStatusChange={onStatusChange}
          onOpen={onOpen}
          busy={busy}
        />
        <DetailsPanel milestone={active} />
      </div>

      <EvolutionTimeline events={data.timeline || []} />

      {/* Iter100 · Immersive Project Dialogue.
          Si attiva sulla milestone attiva. Capitoli + voci curatoriali. */}
      {active && (
        <div className="dj-dialogue-wrap">
          <MilestoneDialogue milestoneId={active.id} />
        </div>
      )}
    </div>
  );
};

export default DesignJourneyTab;
