/**
 * JourneyOperatingPage · STORE-009
 * "The Daily Operating Workspace™" for showroom teams.
 *
 * Replaces the editorial chapter language with operational phases:
 *   DISCOVER → INSPIRE → CURATE → SPECIFY → APPROVE → DELIVER → CELEBRATE
 *
 * Pure UX/IA layer. Reuses existing endpoints:
 *   GET /api/journeys/{jid}/overview
 *   GET /api/projects/{pid}
 *   GET /api/moodboards?project_id={pid}
 *   GET /api/material-boards?project_id={pid}
 *   GET /api/specifications?project_id={pid}
 *   GET /api/project-stories?project_id={pid}
 *
 * No new tables, no new APIs, no new entities.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, Loader2, ExternalLink, Compass,
  Sparkles, Palette, FileText, BookOpen, ArrowUpRight,
  Briefcase, Calendar, Wallet, Activity,
} from 'lucide-react';
import api from '../../lib/api';
import './journey-operating.css';

/* ════════════════════════════════════════════════════════════════════
 *  Phase mapping — existing milestone_types → 7 operational phases
 * ════════════════════════════════════════════════════════════════════ */
const PHASES = [
  { key: 'DISCOVER',  label: 'Discover',  objective: 'Understand the client.',                    milestones: ['brief'] },
  { key: 'INSPIRE',   label: 'Inspire',   objective: 'Collect inspiration.',                       milestones: ['inspirations'] },
  { key: 'CURATE',    label: 'Curate',    objective: 'Build design direction.',                    milestones: ['moodboard_direction', 'material_direction', 'concept_design', 'curated_selections'] },
  { key: 'SPECIFY',   label: 'Specify',   objective: 'Transform ideas into decisions.',            milestones: ['technical_package'] },
  { key: 'APPROVE',   label: 'Approve',   objective: 'Client validation.',                         milestones: ['final_presentation'] },
  { key: 'DELIVER',   label: 'Deliver',   objective: 'Execution.',                                  milestones: ['site_evolution'] },
  { key: 'CELEBRATE', label: 'Celebrate', objective: 'Generate future business.',                  milestones: ['certified_closure'] },
];

const milestoneTitleMap = {
  brief: 'Brief & Questionnaire',
  inspirations: 'Inspiration Collected',
  moodboard_direction: 'Moodboard Direction',
  material_direction: 'Material Direction',
  concept_design: 'Concept Alternatives',
  curated_selections: 'Curated Selections',
  technical_package: 'Specification Package',
  final_presentation: 'Project Story & Sign-off',
  site_evolution: 'Delivery & Installation',
  certified_closure: 'Published Success Story',
};

const phaseKeyForMilestoneType = (type) => {
  for (const p of PHASES) if (p.milestones.includes(type)) return p.key;
  return null;
};

const isMilestoneDone   = (m) => ['approved', 'completed', 'closed', 'skipped'].includes((m?.status || '').toLowerCase());
const isMilestoneActive = (m) => ['in_progress', 'started', 'presented', 'review', 'pending'].includes((m?.status || '').toLowerCase());

const computePhaseStatus = (phaseKey, milestonesByPhase) => {
  const list = milestonesByPhase[phaseKey] || [];
  if (!list.length) return 'pending';
  if (list.every(isMilestoneDone))   return 'done';
  if (list.some(isMilestoneActive))  return 'current';
  if (list.some(isMilestoneDone))    return 'current';
  return 'pending';
};

const currentPhaseFromMilestones = (milestonesByPhase) => {
  for (const p of PHASES) {
    if (computePhaseStatus(p.key, milestonesByPhase) === 'current') return p.key;
  }
  for (const p of PHASES) {
    if (computePhaseStatus(p.key, milestonesByPhase) === 'pending') return p.key;
  }
  return 'CELEBRATE';
};

/* ════════════════════════════════════════════════════════════════════
 *  Utilities
 * ════════════════════════════════════════════════════════════════════ */
const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return 'oggi';
    if (days === 1) return 'ieri';
    if (days < 7)  return `${days}g fa`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
};

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase();

/* Humanize raw backend event_type strings · keep operational language */
const EVENT_TYPE_LABELS = {
  journey_started:     'Journey started',
  journey_completed:   'Journey completed',
  milestone_started:   'Step started',
  milestone_completed: 'Step completed',
  milestone_approved:  'Step approved',
  milestone_skipped:   'Step skipped',
  milestone_reopened:  'Step reopened',
  brief_submitted:     'Brief submitted',
  moodboard_created:   'Moodboard created',
  moodboard_approved:  'Moodboard approved',
  material_board_created: 'Material board created',
  specification_created:  'Specification created',
  project_story_created:  'Project story created',
};
const humanizeEvent = (e) => {
  if (!e) return 'Activity';
  if (e.title) return e.title;
  return EVENT_TYPE_LABELS[e.event_type] || (e.event_type || 'Activity')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase());
};

const safeList = (resp) => {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  return resp.items || resp.data || [];
};

/* ════════════════════════════════════════════════════════════════════
 *  Page
 * ════════════════════════════════════════════════════════════════════ */
const JourneyOperatingPage = () => {
  const { jid } = useParams();
  const [overview, setOverview] = useState(null);
  const [project, setProject]   = useState(null);
  const [moodboards, setMoodboards] = useState([]);
  const [materialBoards, setMaterialBoards] = useState([]);
  const [specifications, setSpecifications] = useState([]);
  const [projectStories, setProjectStories] = useState([]);
  const [activePhase, setActivePhase] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    api.get(`/api/journeys/${jid}/overview`)
      .then(async (r) => {
        if (cancel) return;
        const ov = r.data;
        setOverview(ov);
        const pid = ov?.journey?.project_id;
        if (!pid) { setLoading(false); return; }
        const [pj, mb, mtb, sp, ps] = await Promise.all([
          api.get(`/api/projects/${pid}`).catch(() => null),
          api.get(`/api/moodboards?project_id=${pid}`).catch(() => null),
          api.get(`/api/material-boards?project_id=${pid}`).catch(() => null),
          api.get(`/api/specifications?project_id=${pid}`).catch(() => null),
          api.get(`/api/project-stories?project_id=${pid}`).catch(() => null),
        ]);
        if (cancel) return;
        setProject(pj?.data || null);
        setMoodboards(safeList(mb?.data));
        setMaterialBoards(safeList(mtb?.data));
        setSpecifications(safeList(sp?.data));
        setProjectStories(safeList(ps?.data));
        setLoading(false);
      })
      .catch(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [jid]);

  /* Compute milestones grouped by phase */
  const milestonesByPhase = useMemo(() => {
    const grouped = Object.fromEntries(PHASES.map(p => [p.key, []]));
    const ms = overview?.milestones_flat || [];
    for (const m of ms) {
      const pk = phaseKeyForMilestoneType(m.milestone_type);
      if (pk) grouped[pk].push(m);
    }
    return grouped;
  }, [overview]);

  const currentPhase = useMemo(
    () => activePhase || currentPhaseFromMilestones(milestonesByPhase),
    [activePhase, milestonesByPhase]
  );

  const currentPhaseDef = useMemo(
    () => PHASES.find(p => p.key === currentPhase) || PHASES[0],
    [currentPhase]
  );

  /* Related assets for the current phase */
  const relatedAssets = useMemo(() => {
    const key = currentPhase;
    if (key === 'DISCOVER') return [];
    if (key === 'INSPIRE')  return [];
    if (key === 'CURATE')   return [
      ...moodboards.map(x => ({ ...x, _t: 'Moodboard', _href: `/moodboards/${x.id}/edit`, _img: x.cover_url || x.cover_image_url })),
      ...materialBoards.map(x => ({ ...x, _t: 'Material Board', _href: `/material-boards/${x.id}`, _img: x.cover_url })),
    ];
    if (key === 'SPECIFY')  return specifications.map(x => ({ ...x, _t: 'Specification', _href: `/specifications/${x.id}`, _img: null }));
    if (key === 'APPROVE')  return projectStories.map(x => ({ ...x, _t: 'Project Story', _href: `/project-stories/${x.id}`, _img: x.cover_image_url }));
    if (key === 'CELEBRATE') return projectStories.map(x => ({ ...x, _t: 'Project Story', _href: `/project-stories/${x.id}`, _img: x.cover_image_url }));
    return [];
  }, [currentPhase, moodboards, materialBoards, specifications, projectStories]);

  /* Next action — first non-done milestone of current phase, else next phase */
  const nextAction = useMemo(() => {
    const list = milestonesByPhase[currentPhase] || [];
    const open = list.find(m => !isMilestoneDone(m));
    if (open) return milestoneTitleMap[open.milestone_type] || open.title || open.milestone_type;
    const idx = PHASES.findIndex(p => p.key === currentPhase);
    if (idx >= 0 && idx < PHASES.length - 1) return `Begin ${PHASES[idx + 1].label}`;
    return 'All steps completed';
  }, [milestonesByPhase, currentPhase]);

  /* Combined "Curate · In Progress" status reading per the brief (kept BEFORE
     the early return so the hook order is stable across renders). */
  const statusLabel = useMemo(() => {
    const raw = (overview?.journey?.overall_status || 'in_progress').replace('_', ' ');
    const pretty = raw.charAt(0).toUpperCase() + raw.slice(1);
    return `${currentPhaseDef.label} · ${pretty}`;
  }, [overview, currentPhaseDef]);

  if (loading) {
    return <div className="jop-shell"><div className="jop-loading">Loading the operating workspace…</div></div>;
  }

  const account = overview?.account || {};
  const clientName = account.account_name || account.email || 'Client';
  const projectTitle = project?.title || overview?.journey?.title || 'Untitled Journey';

  return (
    <div className="jop-shell" data-testid="journey-operating">
      {/* HERO */}
      <header className="jop-hero">
        <p className="jop-hero__eyebrow">Design Journey™</p>
        <h1 className="jop-hero__title" data-testid="jop-project-title">{projectTitle}</h1>
        <div className="jop-hero__meta">
          <div className="jop-hero__meta-item">
            <span className="jop-hero__meta-label">Client</span>
            <span className="jop-hero__meta-value" data-testid="jop-client-name">{clientName}</span>
          </div>
          <div className="jop-hero__meta-item">
            <span className="jop-hero__meta-label">Status</span>
            <span className="jop-hero__meta-value jop-hero__meta-value--amber" data-testid="jop-current-phase">
              {statusLabel}
            </span>
          </div>
          <div className="jop-hero__meta-item">
            <span className="jop-hero__meta-label">Next Action</span>
            <span className="jop-hero__meta-value jop-hero__meta-value--cyan" data-testid="jop-next-action">{nextAction}</span>
          </div>
        </div>
      </header>

      {/* PHASE RAIL · clean dot indicators, no numbers, no decoration */}
      <nav className="jop-rail" aria-label="Journey phases" data-testid="jop-phase-rail">
        <div className="jop-rail__track">
          {PHASES.map((p) => {
            const status = computePhaseStatus(p.key, milestonesByPhase);
            const isCurrent = currentPhase === p.key;
            const cls = ['jop-rail__step'];
            if (status === 'done') cls.push('jop-rail__step--done');
            if (isCurrent) cls.push('jop-rail__step--current');
            return (
              <button
                key={p.key}
                className={cls.join(' ')}
                onClick={() => setActivePhase(p.key)}
                data-testid={`jop-rail-${p.key.toLowerCase()}`}
              >
                <span className="jop-rail__dot">
                  {status === 'done' ? <CheckCircle2 size={14} strokeWidth={2} /> : null}
                </span>
                <span className="jop-rail__label">{p.label}</span>
                <span className="jop-rail__connector" />
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3-COLUMN BODY */}
      <div className="jop-body">
        {/* LEFT · Roadmap */}
        <aside className="jop-roadmap" data-testid="jop-roadmap">
          <p className="jop-roadmap__title">Journey Roadmap</p>
          {PHASES.map((p) => {
            const status = computePhaseStatus(p.key, milestonesByPhase);
            const isCurrent = currentPhase === p.key;
            const cls = ['jop-phase-item', `jop-phase-item--${status}`];
            if (isCurrent) cls.push('jop-phase-item--current');
            const list = milestonesByPhase[p.key] || [];
            const sub = isCurrent
              ? 'In progress'
              : status === 'done'
              ? `${list.length} step${list.length !== 1 ? 's' : ''} done`
              : status === 'pending'
              ? 'Upcoming'
              : 'Open';
            return (
              <button key={p.key} className={cls.join(' ')} onClick={() => setActivePhase(p.key)}>
                <span className="jop-phase-item__icon">
                  {status === 'done' ? <CheckCircle2 size={16} strokeWidth={2} /> :
                   isCurrent      ? <Loader2 size={16} strokeWidth={2} className="jop-spin" /> :
                                    <Circle size={16} strokeWidth={1.5} />}
                </span>
                <span className="jop-phase-item__body">
                  <span className="jop-phase-item__label">{p.label}</span>
                  <span className="jop-phase-item__sub">{sub}</span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* CENTER · Current phase workspace */}
        <main className="jop-center" data-testid="jop-center">
          <section className="jop-section">
            <p className="jop-section__eyebrow">Phase {PHASES.findIndex(p => p.key === currentPhase) + 1} of {PHASES.length}</p>
            <h2 className="jop-section__title">{currentPhaseDef.label}</h2>
            <p className="jop-section__obj">{currentPhaseDef.objective}</p>
          </section>

          {/* STORE-011 · Discover Brief Engine entry — only when DISCOVER is current phase */}
          {currentPhase === 'DISCOVER' && (
            <section className="jop-block" data-testid="jop-discover-cta">
              <header className="jop-block__hdr">
                <h3 className="jop-block__title">Design Discovery™</h3>
              </header>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 22px', borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(217,177,108,0.08), rgba(217,177,108,0.02))',
                border: '1px solid rgba(217,177,108,0.25)',
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, color: '#f1f4f9', fontWeight: 500 }}>
                    Open the first design conversation.
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8c95a5' }}>
                    Visual-first wizard · 5–8 minutes · generates Style DNA™, Material DNA™ and AI Recommendations.
                  </p>
                </div>
                <Link
                  to={`/studio/journey/${overview?.journey?.id}/discover`}
                  data-testid="jop-open-discover"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 999,
                    background: 'linear-gradient(135deg, #d9b16c, #c69a52)',
                    color: '#0a0d12', fontSize: 13, fontWeight: 500,
                    textDecoration: 'none', letterSpacing: '0.02em',
                  }}
                >
                  <Sparkles size={14} /> Open Discovery Engine
                </Link>
              </div>
            </section>
          )}

          {/* Checklist */}
          <section className="jop-block" data-testid="jop-checklist">
            <header className="jop-block__hdr">
              <h3 className="jop-block__title">Checklist</h3>
            </header>
            <ul className="jop-checklist">
              {(milestonesByPhase[currentPhase] || []).length === 0 && (
                <li className="jop-empty">No checklist items yet for this phase.</li>
              )}
              {(milestonesByPhase[currentPhase] || []).map(m => {
                const done = isMilestoneDone(m);
                const active = isMilestoneActive(m);
                return (
                  <li key={m.id} className={`jop-checklist__item ${done ? 'jop-checklist__item--done' : ''}`}>
                    <span className={`jop-checklist__icon jop-checklist__icon--${done ? 'done' : active ? 'current' : 'pending'}`}>
                      {done   ? <CheckCircle2 size={16} strokeWidth={2} /> :
                       active ? <Loader2 size={16} strokeWidth={2} className="jop-spin" /> :
                                <Circle size={16} strokeWidth={1.5} />}
                    </span>
                    <span className="jop-checklist__label">
                      {milestoneTitleMap[m.milestone_type] || m.title || m.milestone_type}
                    </span>
                    <span className="jop-checklist__when">
                      {done ? `Done ${fmtDate(m.approved_at || m.closed_at)}` :
                       active ? `Started ${fmtDate(m.started_at)}` : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Related Assets */}
          <section className="jop-block" data-testid="jop-assets">
            <header className="jop-block__hdr">
              <h3 className="jop-block__title">Related Assets</h3>
            </header>
            {relatedAssets.length === 0 ? (
              <div className="jop-empty">No assets are linked to this phase yet.</div>
            ) : (
              <div className="jop-assets">
                {relatedAssets.map((a) => (
                  <Link key={`${a._t}-${a.id}`} to={a._href} className="jop-asset" data-testid={`jop-asset-${a.id}`}>
                    <div className="jop-asset__thumb">
                      {a._img ? <img src={a._img} alt="" /> : null}
                      <span className="jop-asset__type">{a._t}</span>
                    </div>
                    <div className="jop-asset__body">
                      <p className="jop-asset__title">{a.title || a.name || 'Untitled'}</p>
                      <span className="jop-asset__meta">{(a.status || 'draft').replace('_', ' ')} · upd. {fmtDate(a.updated_at)}</span>
                      <span className="jop-asset__cta">Open <ArrowUpRight size={12} strokeWidth={2} /></span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* RIGHT · Client snapshot */}
        <aside className="jop-snapshot" data-testid="jop-client-snapshot">
          <div className="jop-snapshot__hdr">
            <div className="jop-snapshot__avatar">{initials(clientName)}</div>
            <div>
              <p className="jop-snapshot__client">{clientName}</p>
              <p className="jop-snapshot__type">{(account.account_type || 'private_client').replace('_', ' ')}</p>
            </div>
          </div>

          <div className="jop-snapshot__field">
            <p className="jop-snapshot__label">Project</p>
            <p className="jop-snapshot__value">{projectTitle}</p>
          </div>
          <div className="jop-snapshot__field">
            <p className="jop-snapshot__label">Project Type</p>
            <p className={`jop-snapshot__value ${(project?.project_type || account.account_type) ? '' : 'jop-snapshot__value--mute'}`}>
              {project?.project_type || (account.account_type || 'Not set').replace(/_/g, ' ')}
            </p>
          </div>
          <div className="jop-snapshot__field">
            <p className="jop-snapshot__label">Budget Range</p>
            <p className={`jop-snapshot__value ${project?.budget_range ? '' : 'jop-snapshot__value--mute'}`}>
              {project?.budget_range || 'Not set'}
            </p>
          </div>
          <div className="jop-snapshot__field">
            <p className="jop-snapshot__label">Timeline</p>
            <p className={`jop-snapshot__value ${project?.timeline ? '' : 'jop-snapshot__value--mute'}`}>
              {project?.timeline || 'Not set'}
            </p>
          </div>
          <div className="jop-snapshot__field">
            <p className="jop-snapshot__label">Next Action</p>
            <p className="jop-snapshot__value jop-snapshot__value--cyan">{nextAction}</p>
          </div>

          <div className="jop-snapshot__field">
            <p className="jop-snapshot__label">Recent Activity</p>
            <ul className="jop-snapshot__timeline">
              {(overview?.timeline_recent || []).slice(0, 5).map((t, i) => (
                <li key={t.id || i}>
                  {humanizeEvent(t)}
                  <span className="jop-snapshot__timeline-when">{fmtDate(t.created_at)}</span>
                </li>
              ))}
              {(!overview?.timeline_recent || overview.timeline_recent.length === 0) && (
                <li style={{ borderLeft: 'none', paddingLeft: 0, fontStyle: 'italic' }}>No recent activity yet.</li>
              )}
            </ul>
          </div>

          <div className="jop-snapshot__field" data-testid="jop-internal-notes">
            <p className="jop-snapshot__label">Internal Notes</p>
            <p className={`jop-snapshot__value ${account.notes ? '' : 'jop-snapshot__value--mute'}`}
               style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, fontWeight: 400 }}>
              {account.notes || 'No internal notes yet.'}
            </p>
          </div>
        </aside>
      </div>

      {/* Spin keyframes (inline so we don't pollute global CSS) */}
      <style>{`
        @keyframes jop-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .jop-spin { animation: jop-spin 1.4s linear infinite; }
      `}</style>
    </div>
  );
};

export default JourneyOperatingPage;
