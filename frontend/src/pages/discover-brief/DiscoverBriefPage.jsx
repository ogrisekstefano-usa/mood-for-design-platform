/**
 * DiscoverBriefPage · STORE-011 · Design Discovery™ Engine
 * The first design conversation. Visual-first. 5–8 minutes.
 *
 * Layout
 *   ┌─────────────────────────────────────────┬────────────────┐
 *   │ STEP HEADER · progress bar              │  BLUEPRINT AI  │
 *   ├─────────────────────────────────────────┤  PANEL         │
 *   │ STEP BODY · chips / image grid / forms  │  · Profile     │
 *   │                                         │  · Style DNA   │
 *   │                                         │  · Material DNA│
 *   │                                         │  · Investment  │
 *   └─────────────────────────────────────────┴────────────────┘
 *   STEP RAIL  ◯ ◯ ● ◯ ◯ ◯ ◯
 *   ─────────────────────── Save · Back · Continue ───────────
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Compass, Sparkles, Wind, Layers, ListOrdered, Bookmark, NotebookPen,
  Check, ArrowLeft, ArrowRight, X, Loader2, Plus, Upload, Globe,
} from 'lucide-react';
import api from '../../lib/api';
import './discover-brief.css';

const STEPS = [
  { key: 'snapshot',     label: 'Snapshot',     icon: Compass,    title: 'Project Snapshot',  subtitle: 'Set the scene in 4 quick chips.' },
  { key: 'style',        label: 'Style',        icon: Sparkles,   title: 'Style Discovery',   subtitle: 'Pick the images that resonate. No labels needed.' },
  { key: 'atmosphere',   label: 'Feel',         icon: Wind,       title: 'How should it feel?',subtitle: 'The atmosphere comes first.' },
  { key: 'materials',    label: 'Materials',    icon: Layers,     title: 'Material Affinity', subtitle: 'Which families speak to you?' },
  { key: 'priorities',   label: 'Priorities',   icon: ListOrdered,title: 'Project Priorities',subtitle: 'What matters most.' },
  { key: 'inspirations', label: 'Inspirations', icon: Bookmark,   title: 'Inspirations',      subtitle: 'Bring any reference. We will look at it together.' },
  { key: 'notes',        label: 'Notes',        icon: NotebookPen,title: 'Anything else?',    subtitle: "What should we absolutely know before starting?" },
];

const DEFAULT_INSPIRATIONS = { website_urls: [], pinterest_urls: [], instagram_urls: [], media_ids: [], doc_ids: [] };

/* ─────────────────────────────────────────────────────────────
 *  ROOT
 * ───────────────────────────────────────────────────────────── */
const DiscoverBriefPage = () => {
  const { jid } = useParams();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState(null);
  const [state, setState] = useState(null);          // server state
  const [intel, setIntel] = useState(null);          // intelligence panel
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const initialJump = useRef(false);
  const saveTimer = useRef(null);

  /* Load catalog + state in parallel */
  useEffect(() => {
    let cancel = false;
    Promise.all([
      api.get('/api/discover/catalog'),
      api.get(`/api/journeys/${jid}/discover-brief`),
      api.get(`/api/journeys/${jid}/discover-brief/intelligence`),
    ]).then(([cat, st, intl]) => {
      if (cancel) return;
      setCatalog(cat.data);
      setState(normalizeState(st.data));
      setIntel(intl.data);
      // STORE-012A · auto-jump to Summary when Discovery is already completed
      if (!initialJump.current && st.data?.discovery_status === 'completed') {
        setStepIdx(STEPS.length);
        initialJump.current = true;
      }
    }).catch(() => {});
    return () => { cancel = true; };
  }, [jid]);

  /* Debounced autosave on state changes (skip first load) */
  const lastPayload = useRef(null);
  const persist = useCallback((patch) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const r = await api.put(`/api/journeys/${jid}/discover-brief`, patch);
        setState((s) => ({ ...s, completion: r.data.completion, discovery_status: r.data.discovery_status }));
        // Refresh intelligence opportunistically (cheap)
        try {
          const i = await api.get(`/api/journeys/${jid}/discover-brief/intelligence`);
          setIntel(i.data);
        } catch { /* non-blocking */ }
      } finally {
        setSaving(false);
      }
    }, 350);
  }, [jid]);

  /* Field updaters */
  const setSnapshot = (key, value) => {
    setState((s) => ({ ...s, project_snapshot: { ...s.project_snapshot, [key]: value } }));
    persist({ project_snapshot: { [key]: value } });
  };
  const toggleListItem = (field, value) => {
    setState((s) => {
      const cur = s[field] || [];
      const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
      persist({ [field]: next });
      return { ...s, [field]: next };
    });
  };
  const reorderPriority = (key, dir) => {
    setState((s) => {
      const cur = [...(s.priorities || [])];
      const idx = cur.indexOf(key);
      if (idx === -1) return s;
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= cur.length) return s;
      [cur[idx], cur[swap]] = [cur[swap], cur[idx]];
      persist({ priorities: cur });
      return { ...s, priorities: cur };
    });
  };
  const setInspirationList = (key, list) => {
    setState((s) => {
      const next = { ...s.inspirations, [key]: list };
      persist({ inspirations: { [key]: list } });
      return { ...s, inspirations: next };
    });
  };
  const setNotes = (text) => {
    setState((s) => ({ ...s, notes: text }));
    persist({ notes: text });
  };

  /* Complete */
  const handleComplete = async () => {
    setCompleting(true);
    try {
      const r = await api.post(`/api/journeys/${jid}/discover-brief/complete`, { force: true });
      setIntel(r.data.intelligence);
      setState((s) => ({ ...s, discovery_status: 'completed', completion: r.data.completion }));
      setStepIdx(STEPS.length); // jump to summary
    } catch (e) {
      console.error('complete failed', e?.response?.data || e);
    } finally {
      setCompleting(false);
    }
  };

  if (!catalog || !state) {
    return (
      <div className="dbe-shell" data-testid="discover-brief-loading">
        <div className="dbe-loading"><Loader2 size={20} className="dbe-spin" /> Loading Design Discovery…</div>
      </div>
    );
  }

  const progress = state.completion?.progress_pct ?? 0;
  const totalSteps = STEPS.length;
  const isSummary = stepIdx >= totalSteps;
  const step = isSummary ? null : STEPS[stepIdx];

  return (
    <div className="dbe-shell" data-testid="discover-brief">

      {/* TOP BAR */}
      <header className="dbe-topbar">
        <button
          type="button"
          className="dbe-topbar__close"
          onClick={() => navigate(`/studio/journey/${jid}`)}
          data-testid="dbe-close"
        >
          <X size={16} /> Close
        </button>
        <div className="dbe-topbar__title">
          <p className="dbe-topbar__eyebrow">Design Journey™ · Discover</p>
          <h1 className="dbe-topbar__heading">Design Discovery™</h1>
        </div>
        <div className="dbe-topbar__progress" data-testid="dbe-progress">
          <span className="dbe-topbar__progress-pct">{progress}%</span>
          <div className="dbe-topbar__progress-bar">
            <div className="dbe-topbar__progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className={`dbe-topbar__save ${saving ? 'dbe-topbar__save--on' : ''}`}>
            {saving ? <><Loader2 size={11} className="dbe-spin" /> saving</> : 'saved'}
          </span>
        </div>
      </header>

      {/* RAIL */}
      <nav className="dbe-rail" data-testid="dbe-rail">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = stepIdx === i;
          const isDone = (state.completion?.sections?.[i]?.done) || false;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStepIdx(i)}
              className={`dbe-rail__item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
              data-testid={`dbe-rail-${s.key}`}
            >
              <span className="dbe-rail__icon">
                {isDone ? <Check size={14} strokeWidth={2.5} /> : <Icon size={14} strokeWidth={1.8} />}
              </span>
              <span className="dbe-rail__label">{s.label}</span>
            </button>
          );
        })}
      </nav>

      {/* BODY */}
      <div className="dbe-body">
        <main className="dbe-main">
          {!isSummary && (
            <>
              <section className="dbe-step__hdr">
                <p className="dbe-step__eyebrow">Step {stepIdx + 1} of {totalSteps}</p>
                <h2 className="dbe-step__title">{step.title}</h2>
                <p className="dbe-step__subtitle">{step.subtitle}</p>
              </section>

              <section className="dbe-step__body" data-testid={`dbe-step-${step.key}`}>
                {step.key === 'snapshot'     && <StepSnapshot     catalog={catalog} state={state} onSet={setSnapshot} />}
                {step.key === 'style'        && <StepStyle        catalog={catalog} state={state} onToggle={(id) => toggleListItem('style_selections', id)} />}
                {step.key === 'atmosphere'   && <StepAtmosphere   catalog={catalog} state={state} onToggle={(k) => toggleListItem('atmosphere_signals', k)} />}
                {step.key === 'materials'    && <StepMaterials    catalog={catalog} state={state} onToggle={(k) => toggleListItem('material_signals', k)} />}
                {step.key === 'priorities'   && <StepPriorities   catalog={catalog} state={state} onToggle={(k) => toggleListItem('priorities', k)} onReorder={reorderPriority} />}
                {step.key === 'inspirations' && <StepInspirations state={state} onList={setInspirationList} />}
                {step.key === 'notes'        && <StepNotes        state={state} onChange={setNotes} />}
              </section>

              <footer className="dbe-step__footer">
                <button
                  type="button"
                  className="dbe-btn dbe-btn--ghost"
                  onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
                  disabled={stepIdx === 0}
                  data-testid="dbe-prev"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                {stepIdx < totalSteps - 1 ? (
                  <button
                    type="button"
                    className="dbe-btn dbe-btn--primary"
                    onClick={() => setStepIdx(stepIdx + 1)}
                    data-testid="dbe-next"
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="dbe-btn dbe-btn--primary"
                    onClick={handleComplete}
                    disabled={completing}
                    data-testid="dbe-complete"
                  >
                    {completing ? <Loader2 size={14} className="dbe-spin" /> : <Sparkles size={14} />}
                    Generate Design Intelligence™
                  </button>
                )}
              </footer>
            </>
          )}

          {isSummary && (
            <SummaryView intel={intel} jid={jid} onBack={() => setStepIdx(totalSteps - 1)} />
          )}
        </main>

        {/* BLUEPRINT AI PANEL */}
        <aside className="dbe-aside" data-testid="dbe-blueprint-panel">
          <BlueprintPanel intel={intel} state={state} catalog={catalog} />
        </aside>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 *  HELPERS
 * ───────────────────────────────────────────────────────────── */
function normalizeState(d) {
  return {
    brief_id:           d.brief_id,
    project_snapshot:   d.project_snapshot || {},
    style_selections:   d.style_selections || [],
    atmosphere_signals: d.atmosphere_signals || [],
    material_signals:   d.material_signals || [],
    priorities:         d.priorities || [],
    inspirations:       { ...DEFAULT_INSPIRATIONS, ...(d.inspirations || {}) },
    notes:              d.notes || '',
    discovery_status:   d.discovery_status,
    completion:         d.completion,
  };
}

/* ─────────────────────────────────────────────────────────────
 *  STEPS
 * ───────────────────────────────────────────────────────────── */
const ChipGroup = ({ items, value, onSelect, multi = false, selectedList = [], testidPrefix = 'chip' }) => (
  <div className="dbe-chips">
    {items.map((it) => {
      const isSel = multi ? selectedList.includes(it.key) : value === it.key;
      return (
        <button
          key={it.key}
          type="button"
          onClick={() => onSelect(it.key)}
          className={`dbe-chip ${isSel ? 'is-selected' : ''}`}
          data-testid={`${testidPrefix}-${it.key}`}
        >
          {it.label}
        </button>
      );
    })}
  </div>
);

const StepSnapshot = ({ catalog, state, onSet }) => {
  const snap = state.project_snapshot || {};
  return (
    <div className="dbe-snapshot">
      <div className="dbe-field">
        <label className="dbe-field__label">Project Type</label>
        <ChipGroup items={catalog.project_types} value={snap.project_type} onSelect={(k) => onSet('project_type', k)} testidPrefix="snap-type" />
      </div>
      <div className="dbe-field">
        <label className="dbe-field__label">Space Status</label>
        <ChipGroup items={catalog.space_statuses} value={snap.space_status} onSelect={(k) => onSet('space_status', k)} testidPrefix="snap-space" />
      </div>
      <div className="dbe-field">
        <label className="dbe-field__label">Timeline</label>
        <ChipGroup items={catalog.timelines} value={snap.timeline} onSelect={(k) => onSet('timeline', k)} testidPrefix="snap-timeline" />
      </div>
      <div className="dbe-field">
        <label className="dbe-field__label">Investment Range</label>
        <ChipGroup items={catalog.investment_ranges} value={snap.investment_range} onSelect={(k) => onSet('investment_range', k)} testidPrefix="snap-inv" />
      </div>
    </div>
  );
};

const StepStyle = ({ catalog, state, onToggle }) => (
  <div className="dbe-style">
    <p className="dbe-style__hint">Pick any image that resonates · {state.style_selections.length} selected</p>
    <div className="dbe-style__grid">
      {catalog.style_images.map((img) => {
        const sel = state.style_selections.includes(img.id);
        return (
          <button
            key={img.id}
            type="button"
            onClick={() => onToggle(img.id)}
            className={`dbe-style__tile ${sel ? 'is-selected' : ''}`}
            data-testid={`style-img-${img.id}`}
          >
            <img src={img.url} alt="" loading="lazy" />
            {sel && <span className="dbe-style__check"><Check size={14} strokeWidth={3} /></span>}
          </button>
        );
      })}
    </div>
  </div>
);

const StepAtmosphere = ({ catalog, state, onToggle }) => (
  <div className="dbe-field">
    <label className="dbe-field__label">Atmosphere · multi-select</label>
    <ChipGroup items={catalog.atmospheres} multi selectedList={state.atmosphere_signals} onSelect={onToggle} testidPrefix="atm" />
  </div>
);

const StepMaterials = ({ catalog, state, onToggle }) => (
  <div className="dbe-field">
    <label className="dbe-field__label">Material families · multi-select</label>
    <div className="dbe-materials">
      {catalog.materials.map((m) => {
        const sel = state.material_signals.includes(m.key);
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onToggle(m.key)}
            className={`dbe-material ${sel ? 'is-selected' : ''}`}
            data-testid={`mat-${m.key}`}
          >
            <span className="dbe-material__label">{m.label}</span>
            {sel && <Check size={14} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  </div>
);

const StepPriorities = ({ catalog, state, onToggle, onReorder }) => (
  <div className="dbe-field">
    <label className="dbe-field__label">Rank the most important · order matters</label>
    <div className="dbe-priorities">
      <div className="dbe-priorities__col">
        <p className="dbe-priorities__col-label">Available</p>
        <div className="dbe-priorities__pool">
          {catalog.priorities
            .filter(p => !state.priorities.includes(p.key))
            .map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => onToggle(p.key)}
                className="dbe-priorities__item"
                data-testid={`prio-add-${p.key}`}
              >
                <Plus size={12} /> {p.label}
              </button>
            ))}
        </div>
      </div>
      <div className="dbe-priorities__col">
        <p className="dbe-priorities__col-label">Selected · top {state.priorities.length}</p>
        <div className="dbe-priorities__list">
          {state.priorities.map((k, i) => {
            const p = catalog.priorities.find(x => x.key === k);
            return (
              <div key={k} className="dbe-priorities__pick" data-testid={`prio-${k}`}>
                <span className="dbe-priorities__rank">{i + 1}</span>
                <span className="dbe-priorities__name">{p?.label || k}</span>
                <span className="dbe-priorities__moves">
                  <button type="button" onClick={() => onReorder(k, 'up')}   disabled={i === 0} data-testid={`prio-up-${k}`}>▲</button>
                  <button type="button" onClick={() => onReorder(k, 'down')} disabled={i === state.priorities.length - 1} data-testid={`prio-down-${k}`}>▼</button>
                  <button type="button" onClick={() => onToggle(k)} aria-label="remove" data-testid={`prio-rm-${k}`}>×</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

const StepInspirations = ({ state, onList }) => {
  const fields = [
    { key: 'website_urls',   label: 'Website URLs',   hint: 'https://...' },
    { key: 'pinterest_urls', label: 'Pinterest URLs', hint: 'https://pinterest.com/...' },
    { key: 'instagram_urls', label: 'Instagram handles or URLs', hint: '@studio_xy' },
  ];
  const onAdd = (key, value) => {
    const cur = state.inspirations[key] || [];
    onList(key, [...cur, value.trim()]);
  };
  const onRemove = (key, idx) => {
    const cur = [...(state.inspirations[key] || [])];
    cur.splice(idx, 1);
    onList(key, cur);
  };
  return (
    <div className="dbe-insp">
      {fields.map((f) => (
        <UrlInputList key={f.key} label={f.label} hint={f.hint} values={state.inspirations[f.key] || []} onAdd={(v) => onAdd(f.key, v)} onRemove={(i) => onRemove(f.key, i)} testid={f.key} />
      ))}
      <div className="dbe-insp__note">
        <Upload size={13} />
        <span>Image &amp; document upload coming from your Media Library — open the journey workspace to attach files.</span>
      </div>
    </div>
  );
};

const UrlInputList = ({ label, hint, values, onAdd, onRemove, testid }) => {
  const [v, setV] = useState('');
  return (
    <div className="dbe-field">
      <label className="dbe-field__label"><Globe size={12} /> {label}</label>
      <div className="dbe-insp__row">
        <input
          type="text"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={hint}
          className="dbe-input"
          data-testid={`insp-input-${testid}`}
          onKeyDown={(e) => { if (e.key === 'Enter' && v.trim()) { onAdd(v); setV(''); } }}
        />
        <button type="button" className="dbe-btn dbe-btn--ghost" onClick={() => { if (v.trim()) { onAdd(v); setV(''); } }} data-testid={`insp-add-${testid}`}>
          <Plus size={13} /> Add
        </button>
      </div>
      {values.length > 0 && (
        <ul className="dbe-insp__list">
          {values.map((val, i) => (
            <li key={`${val}-${i}`} data-testid={`insp-item-${testid}-${i}`}>
              <span className="dbe-insp__url">{val}</span>
              <button type="button" onClick={() => onRemove(i)} aria-label="remove">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const StepNotes = ({ state, onChange }) => (
  <div className="dbe-field">
    <label className="dbe-field__label">What should we absolutely know before starting?</label>
    <textarea
      value={state.notes || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Anything personal, constraints, family routines, allergies, prized possessions… 1–3 lines is enough."
      className="dbe-textarea"
      rows={6}
      data-testid="notes-textarea"
    />
  </div>
);

/* ─────────────────────────────────────────────────────────────
 *  BLUEPRINT AI PANEL (always visible)
 * ───────────────────────────────────────────────────────────── */
const BlueprintPanel = ({ intel, state, catalog }) => {
  const snap = state.project_snapshot || {};
  const ptype = catalog.project_types.find(x => x.key === snap.project_type)?.label;
  const inv   = catalog.investment_ranges.find(x => x.key === snap.investment_range)?.label;
  const tl    = catalog.timelines.find(x => x.key === snap.timeline)?.label;

  const styleDna = intel?.style_dna || [];
  const matDna   = intel?.material_dna || [];
  const profile  = intel?.project_profile;

  return (
    <div className="dbe-bp">
      <header className="dbe-bp__hdr">
        <span className="dbe-bp__brand">Blueprint AI™</span>
        <p className="dbe-bp__live">live</p>
      </header>

      <section className="dbe-bp__box" data-testid="bp-project-profile">
        <p className="dbe-bp__box-eyebrow">Project Profile™</p>
        <p className="dbe-bp__headline">
          {profile?.headline && profile.headline !== 'Project profile pending'
            ? profile.headline
            : [inv, ptype].filter(Boolean).join(' · ') || <em className="dbe-bp__mute">Awaiting your first picks…</em>}
        </p>
        <div className="dbe-bp__meta">
          {tl && <span className="dbe-bp__pill">{tl}</span>}
          {(state.atmosphere_signals || []).slice(0, 2).map(a => {
            const lbl = catalog.atmospheres.find(x => x.key === a)?.label;
            return lbl ? <span key={a} className="dbe-bp__pill">{lbl}</span> : null;
          })}
        </div>
      </section>

      <section className="dbe-bp__box" data-testid="bp-style-dna">
        <p className="dbe-bp__box-eyebrow">Style DNA™</p>
        {styleDna.length === 0 && <p className="dbe-bp__mute">Pick at least 3 images.</p>}
        {styleDna.slice(0, 5).map((s) => (
          <div key={s.key} className="dbe-bp__bar">
            <div className="dbe-bp__bar-row">
              <span className="dbe-bp__bar-label">{s.label}</span>
              <span className="dbe-bp__bar-score">{s.score}%</span>
            </div>
            <div className="dbe-bp__bar-track">
              <div className="dbe-bp__bar-fill" style={{ width: `${s.score}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className="dbe-bp__box" data-testid="bp-material-dna">
        <p className="dbe-bp__box-eyebrow">Material DNA™</p>
        {matDna.length === 0 && <p className="dbe-bp__mute">Choose 2+ material families.</p>}
        <ul className="dbe-bp__matlist">
          {matDna.map((m) => (
            <li key={m.key}>
              <span className="dbe-bp__matname">{m.label}</span>
              {m.atlas_matches.length > 0 && (
                <span className="dbe-bp__matrefs">
                  {m.atlas_matches.slice(0, 3).map(x => x.name).join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="dbe-bp__box" data-testid="bp-investment">
        <p className="dbe-bp__box-eyebrow">Investment Profile™</p>
        <p className="dbe-bp__headline" style={{ fontSize: '1rem' }}>
          {inv || <em className="dbe-bp__mute">To be defined</em>}
        </p>
      </section>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 *  SUMMARY VIEW (post-completion)
 *  STORE-012A · Replace "Begin Inspire" with Generate Concept Directions™
 * ───────────────────────────────────────────────────────────── */
const SummaryView = ({ intel, jid, onBack }) => {
  const recs = intel?.recommendations || {};
  const tpls = recs.moodboard_templates || [];
  const atlas = recs.brand_atlas || [];

  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sharingSetId, setSharingSetId] = useState(null);

  useEffect(() => {
    let cancel = false;
    api.get(`/api/journeys/${jid}/concept-directions`)
      .then(r => { if (!cancel) setSets(r.data.sets || []); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoadingSets(false); });
    return () => { cancel = true; };
  }, [jid]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post(`/api/journeys/${jid}/concept-directions/generate`, {});
      const r = await api.get(`/api/journeys/${jid}/concept-directions`);
      setSets(r.data.sets || []);
    } catch (e) {
      console.error('generate concept directions failed', e?.response?.data || e);
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async (setId) => {
    setSharingSetId(setId);
    try {
      await api.post(`/api/journeys/${jid}/concept-directions/${setId}/share`, {});
      const r = await api.get(`/api/journeys/${jid}/concept-directions`);
      setSets(r.data.sets || []);
    } catch (e) {
      console.error('share failed', e?.response?.data || e);
    } finally {
      setSharingSetId(null);
    }
  };

  const hasSets = sets.length > 0;

  return (
    <div className="dbe-summary" data-testid="dbe-summary">
      <header className="dbe-summary__hdr">
        <p className="dbe-summary__eyebrow">Discovery complete</p>
        <h2 className="dbe-summary__title">Design Intelligence™ is ready.</h2>
        <p className="dbe-summary__subtitle">
          Blueprint AI prepared the foundations. Let it now compose three Concept Directions you can refine instead of starting from a blank canvas.
        </p>
      </header>

      {/* Primary CTA · Generate Concept Directions */}
      {!hasSets && !loadingSets && (
        <section className="dbe-gencta" data-testid="dbe-gencta">
          <div className="dbe-gencta__copy">
            <p className="dbe-gencta__eyebrow">Blueprint AI · Next Step</p>
            <h3 className="dbe-gencta__title">Generate Concept Directions™</h3>
            <p className="dbe-gencta__hint">
              Three ready-to-edit Concept Boards in seconds — preloaded with materials from your Brand Atlas, images from your Media Library and a tailored color palette.
            </p>
          </div>
          <button
            type="button"
            className="dbe-btn dbe-btn--primary dbe-btn--xl"
            onClick={handleGenerate}
            disabled={generating}
            data-testid="dbe-generate-concepts"
          >
            {generating ? <><Loader2 size={16} className="dbe-spin" /> Composing 3 Concept Boards…</> : <><Sparkles size={16} /> Generate Concept Directions™</>}
          </button>
        </section>
      )}

      {/* Generated sets */}
      {hasSets && (
        <section className="dbe-sets" data-testid="dbe-sets">
          {sets.map((s) => (
            <div key={s.set_id} className="dbe-set" data-testid={`dbe-set-${s.set_index}`}>
              <header className="dbe-set__hdr">
                <p className="dbe-set__eyebrow">Concept</p>
                <h3 className="dbe-set__title">{s.set_label}</h3>
                <p className="dbe-set__date">{s.set_created_at ? new Date(s.set_created_at).toLocaleString() : ''}</p>
                <div className="dbe-set__share" data-testid={`dbe-set-share-${s.set_index}`}>
                  {s.shared_at ? (
                    <span className="dbe-set__shared-pill" title={`Shared on ${new Date(s.shared_at).toLocaleString()}`}>
                      <Check size={11} strokeWidth={3} /> Shared with client
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="dbe-btn dbe-btn--primary dbe-btn--sm"
                      onClick={() => handleShare(s.set_id)}
                      disabled={sharingSetId === s.set_id}
                      data-testid={`dbe-share-${s.set_index}`}
                    >
                      {sharingSetId === s.set_id ? <><Loader2 size={12} className="dbe-spin" /> Sharing…</> : <>Send to client for review</>}
                    </button>
                  )}
                </div>
              </header>
              <div className="dbe-set__grid">
                {s.directions.map((d) => (
                  <article key={d.moodboard_id} className={`dbe-concept ${d.is_preferred ? 'is-preferred' : ''}`} data-testid={`dbe-concept-${d.moodboard_id}`}>
                    <header className="dbe-concept__hdr">
                      <span className="dbe-concept__letter">{d.direction_letter}</span>
                      <p className="dbe-concept__name">{d.direction_name}</p>
                      {d.is_preferred && (
                        <span className="dbe-concept__preferred" title="Client preferred direction">
                          ★
                        </span>
                      )}
                    </header>

                    {/* mini palette */}
                    {d.color_palette?.length > 0 && (
                      <div className="dbe-concept__palette" aria-label="palette">
                        {d.color_palette.map((hex, i) => (
                          <span key={i} className="dbe-concept__swatch" style={{ background: hex }} title={hex} />
                        ))}
                      </div>
                    )}

                    {/* mini style DNA */}
                    {d.style_dna_snapshot?.length > 0 && (
                      <div className="dbe-concept__style">
                        {d.style_dna_snapshot.slice(0, 2).map((sd) => (
                          <div key={sd.key} className="dbe-concept__dna">
                            <span>{sd.label}</span>
                            <span className="dbe-concept__dna-score">{sd.score}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <ul className="dbe-concept__counts">
                      <li><strong>{d.counts.materials}</strong> materials</li>
                      <li><strong>{d.counts.products}</strong> products</li>
                      <li><strong>{d.counts.images}</strong> images</li>
                    </ul>

                    {d.needs_flags?.length > 0 && (
                      <div className="dbe-concept__needs">
                        {d.needs_flags.map(f => (
                          <span key={f} className="dbe-concept__need-pill">{f.replace('NEEDS_', '').replace('_', ' ')}</span>
                        ))}
                      </div>
                    )}

                    {/* client reactions count (studio side) */}
                    {d.reaction_counts && (d.reaction_counts.interested + d.reaction_counts.explore_further + d.reaction_counts.preferred + d.reaction_counts.comment > 0) && (
                      <div className="dbe-concept__reactions" data-testid={`dbe-reactions-${d.moodboard_id}`}>
                        {d.reaction_counts.interested > 0 && <span title="Interested">◉ {d.reaction_counts.interested}</span>}
                        {d.reaction_counts.explore_further > 0 && <span title="Explore further">↻ {d.reaction_counts.explore_further}</span>}
                        {d.reaction_counts.comment > 0 && <span title="Comments">✎ {d.reaction_counts.comment}</span>}
                      </div>
                    )}

                    {/* STORE-012B · Working Moodboard generation */}
                    <WorkingMoodboardLauncher
                      jid={jid}
                      conceptMbId={d.moodboard_id}
                      directionName={d.direction_name}
                    />
                  </article>
                ))}
              </div>
            </div>
          ))}

          <div className="dbe-sets__regen">
            <button
              type="button"
              className="dbe-btn dbe-btn--ghost"
              onClick={handleGenerate}
              disabled={generating}
              data-testid="dbe-generate-more"
            >
              {generating ? <><Loader2 size={14} className="dbe-spin" /> Composing alternatives…</> : <><Sparkles size={14} /> Propose 3 alternative directions</>}
            </button>
          </div>
        </section>
      )}

      {loadingSets && (
        <p className="dbe-bp__mute" data-testid="dbe-loading-sets">Loading concept directions…</p>
      )}

      {/* Existing recommendations */}
      <section className="dbe-summary__block">
        <p className="dbe-summary__block-title">Recommended Moodboard Templates</p>
        {tpls.length === 0 && <p className="dbe-bp__mute">No matching templates yet — start a blank moodboard from Curate.</p>}
        <div className="dbe-summary__cards">
          {tpls.map((t) => (
            <Link to="/moodboards" key={t.id} className="dbe-summary__card" data-testid={`rec-template-${t.id}`}>
              <span className="dbe-summary__card-eyebrow">Template</span>
              <p className="dbe-summary__card-title">{t.name}</p>
              {t.category && <span className="dbe-summary__card-meta">{t.category}</span>}
            </Link>
          ))}
        </div>
      </section>

      <section className="dbe-summary__block">
        <p className="dbe-summary__block-title">Brand Atlas Picks</p>
        {atlas.length === 0 && <p className="dbe-bp__mute">No Brand Atlas matches yet — add materials in Discovery.</p>}
        <div className="dbe-summary__atlas">
          {atlas.map((a, i) => (
            <div key={`${a.id}-${i}`} className="dbe-summary__atlas-pill" data-testid={`rec-atlas-${a.id}`}>
              <span className="dbe-summary__atlas-name">{a.name}</span>
              <span className="dbe-summary__atlas-meta">{a.matched_for} · {a.entity_type}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="dbe-summary__footer">
        <button type="button" className="dbe-btn dbe-btn--ghost" onClick={onBack} data-testid="dbe-summary-back">
          <ArrowLeft size={14} /> Edit Discovery
        </button>
      </footer>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
 *  STORE-012B · Working Moodboard launcher button
 *  Replaces the old "Open Direction" CTA. If a Working Moodboard
 *  has already been derived from this Concept Board, opens it
 *  directly; otherwise it generates one and then navigates.
 * ───────────────────────────────────────────────────────────── */
const WorkingMoodboardLauncher = ({ jid, conceptMbId, directionName }) => {
  const [existingId, setExistingId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    api.get(`/api/journeys/${jid}/working-moodboards`)
      .then((r) => {
        if (cancel) return;
        const match = (r.data?.working_moodboards || []).find(
          (w) => w.source_concept_id === conceptMbId
        );
        if (match) setExistingId(match.moodboard_id);
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [jid, conceptMbId]);

  if (existingId) {
    return (
      <Link
        to={`/studio/moodboards/working/${existingId}`}
        className="dbe-concept__open"
        data-testid={`dbe-open-working-${conceptMbId}`}
      >
        Open Working Moodboard <ArrowRight size={13} />
      </Link>
    );
  }

  const generate = async () => {
    setBusy(true);
    try {
      const r = await api.post(
        `/api/journeys/${jid}/working-moodboards/from-concept/${conceptMbId}`,
        {}
      );
      const newId = r.data?.moodboard_id;
      if (newId) window.location.href = `/studio/moodboards/working/${newId}`;
    } catch (e) {
      console.error('generate working moodboard failed', e?.response?.data || e);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={generate}
      disabled={busy}
      className="dbe-concept__open"
      data-testid={`dbe-generate-working-${conceptMbId}`}
      title={`Generate Working Moodboard for ${directionName}`}
    >
      {busy ? <><Loader2 size={13} className="dbe-spin" /> Generating…</> :
        <><Sparkles size={13} /> Generate Working Moodboard™</>}
    </button>
  );
};


export default DiscoverBriefPage;
