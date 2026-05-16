/**
 * ProposalComposerPage — cinematic editorial editor for a composed proposal.
 *
 * Renders the 9 editorial sections as full-bleed editorial cards.
 * Click any section to edit inline (textarea swap). Cover hero, hydrated
 * moodboards strip, hydrated material cards, advisor signature footer.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Save, Edit3, Check, Sparkles,
} from 'lucide-react';
import api from '../../lib/api';

const SECTION_DEF = [
  { key: 'opening',             title: 'Apertura editoriale',     eye: '01 — APERTURA' },
  { key: 'strategic_direction', title: 'Direzione strategica',    eye: '02 — DIREZIONE' },
  { key: 'visual_inspirations', title: 'Riferimenti visivi',      eye: '03 — ISPIRAZIONI' },
  { key: 'material_language',   title: 'Linguaggio materico',     eye: '04 — MATERIA' },
  { key: 'project_vision',      title: 'Visione del progetto',    eye: '05 — VISIONE' },
  { key: 'suggested_scope',     title: 'Ambito d\'intervento',    eye: '06 — AMBITO' },
  { key: 'investment',          title: 'Posizionamento d\'investimento', eye: '07 — INVESTIMENTO' },
  { key: 'timeline',            title: 'Direzione temporale',     eye: '08 — TEMPISTICA' },
  { key: 'signature',           title: 'Firma dello studio',      eye: '09 — FIRMA' },
];

const TIER_LABEL = {
  essential_direction:   'Essential Direction',
  elevated_residential:  'Elevated Residential',
  signature_hospitality: 'Signature Hospitality',
  collector_level:       'Collector-Level Execution',
};

const STYLE_LABEL = {
  residential: 'Residenziale', hospitality: 'Ospitalità', retail: 'Retail',
  developer: 'Sviluppatore', investor: 'Investitore', private_client: 'Cliente privato',
};

const TONE_LABEL = {
  minimal_editorial: 'Minimale editoriale', warm_mediterranean: 'Caldo mediterraneo',
  quiet_luxury: 'Lusso silenzioso', architectural: 'Architettonico',
  bold_hospitality: 'Ospitalità d\'autore', collector_level: 'Livello collezionismo',
};

// Localized fields may arrive as a string OR as a multilingual object
// {it, en, _default, ...}. Always coerce to string for React rendering.
const localized = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    return v.it || v.en || v['en-US'] || v._default
        || Object.values(v).find((x) => typeof x === 'string') || '';
  }
  return String(v);
};

const SectionCard = ({ s, value, onSave, testid }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => { if (!editing) setDraft(value || ''); }, [value, editing]);

  const save = async () => {
    if (draft !== value) await onSave(draft);
    setEditing(false);
  };

  return (
    <article data-testid={testid} className="bp-card p-8 group">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body">
          {s.eye}
        </p>
        {!editing && (
          <button onClick={() => setEditing(true)}
                  data-testid={`${testid}-edit`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity
                             text-[10.5px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)]
                             hover:text-[var(--bp-primary)] inline-flex items-center gap-1.5 font-body">
            <Edit3 size={11} strokeWidth={1.6} /> Modifica
          </button>
        )}
      </div>
      <h3 className="font-heading text-[22px] font-light text-[var(--bp-text-primary)] mb-5 leading-tight">
        {s.title}
      </h3>
      {editing ? (
        <div className="space-y-3">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                    rows={6} autoFocus data-testid={`${testid}-textarea`}
                    className="input-luxury w-full px-4 py-3 text-[14.5px] font-body leading-[1.7]
                               text-[var(--bp-text-primary)] resize-y rounded-[var(--bp-radius-sm)]" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditing(false); setDraft(value || ''); }}
                    className="bp-btn bp-btn-ghost text-[10.5px] uppercase tracking-[0.22em]">
              Annulla
            </button>
            <button onClick={save}
                    data-testid={`${testid}-save`}
                    className="bp-btn bp-btn-primary text-[10.5px] uppercase tracking-[0.22em]">
              <Check size={11} strokeWidth={1.6} /> Salva
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[15px] text-[var(--bp-text-secondary)] font-body leading-[1.75] whitespace-pre-line">
          {value || '—'}
        </p>
      )}
    </article>
  );
};

const MoodboardStrip = ({ moodboards }) => {
  if (!moodboards || moodboards.length === 0) return null;
  return (
    <article className="bp-card p-8" data-testid="composer-moodboards-strip">
      <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-5">
        Moodboard collegati
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {moodboards.map((m) => (
          <Link key={m.id} to={`/moodboards/${m.id}`}
                data-testid={`composer-moodboard-${m.id}`}
                className="group block">
            <div className="aspect-[5/4] bg-[var(--bp-surface-2)] overflow-hidden border border-[var(--bp-border)]">
              {m.cover_url ? (
                <img src={m.cover_url} alt={m.title}
                     className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--bp-text-subtle)] text-[10px] uppercase tracking-[0.18em]">
                  Senza copertina
                </div>
              )}
            </div>
            <p className="text-[12.5px] text-[var(--bp-text-primary)] font-body mt-2 leading-tight">
              {m.title || 'Moodboard'}
            </p>
          </Link>
        ))}
      </div>
    </article>
  );
};

const MaterialCards = ({ materials }) => {
  if (!materials || materials.length === 0) return null;
  return (
    <article className="bp-card p-8" data-testid="composer-materials">
      <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-5">
        Materiali integrati
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {materials.map((m) => (
          <div key={m.id} data-testid={`composer-material-${m.id}`}
               className="flex gap-4 p-4 border border-[var(--bp-border)] bg-[var(--bp-surface-1)]">
            <div className="w-20 h-20 shrink-0 bg-[var(--bp-surface-2)] overflow-hidden">
              {m.cover_url ? (
                <img src={m.cover_url} alt={m.name} className="w-full h-full object-cover" />
              ) : m.dominant_color ? (
                <div className="w-full h-full" style={{ backgroundColor: m.dominant_color }} />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] font-body mb-1">
                {m.category || 'Materiale'}{m.finish ? ` · ${m.finish}` : ''}
              </p>
              <p className="font-heading text-[16px] font-light text-[var(--bp-text-primary)] leading-tight">
                {m.name}
              </p>
              {m.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-[9.5px] uppercase tracking-[0.18em] px-2 py-0.5
                                             border border-[var(--bp-border)] text-[var(--bp-text-secondary)] font-body">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
};

const ProposalComposerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingMsg, setSavingMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get(`/api/proposals/${id}/composer`);
      setData(r.data);
    } catch (e) { setError('Caricamento proposta non riuscito.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patchSection = async (key, text) => {
    try {
      await api.patch(`/api/proposals/${id}/sections`, { sections: { [key]: text } });
      setData((d) => ({ ...d, proposal: { ...d.proposal, sections: { ...d.proposal.sections, [key]: text } } }));
      setSavingMsg('Salvato');
      setTimeout(() => setSavingMsg(null), 2500);
    } catch (e) { setSavingMsg('Salvataggio fallito'); }
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--bp-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-10 max-w-2xl mx-auto bp-card text-center" data-testid="composer-error">
        <p className="text-[13px] text-red-300 font-body mb-4">{error || 'Proposta non trovata.'}</p>
        <button onClick={load} className="bp-btn bp-btn-ghost text-[10.5px] uppercase tracking-[0.22em]">
          <RefreshCw size={11} strokeWidth={1.6} /> Riprova
        </button>
      </div>
    );
  }

  const { proposal, moodboards, materials, advisor, project } = data;
  const sections = proposal.sections || {};
  const includedKeys = (proposal.sections_included && proposal.sections_included.length
    ? proposal.sections_included : SECTION_DEF.map((s) => s.key));
  const visibleSections = SECTION_DEF.filter((s) => includedKeys.includes(s.key));

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto" data-testid="proposal-composer-page">
      <button onClick={() => navigate(`/workspace/projects/${proposal.project_id}`)}
              data-testid="composer-back"
              className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] mb-6 inline-flex items-center gap-1.5 font-body">
        <ArrowLeft size={12} strokeWidth={1.6} /> Torna al progetto
      </button>

      {/* Hero — cinematic header */}
      <header className="bp-card p-10 mb-8 relative overflow-hidden" data-testid="composer-hero">
        {proposal.cover_image_url && (
          <div className="absolute inset-0 opacity-[0.18]">
            <img src={proposal.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--bp-bg)] via-transparent to-[var(--bp-bg)]" />
          </div>
        )}
        <div className="relative">
          <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-primary)] font-body mb-3 inline-flex items-center gap-2">
            <Sparkles size={11} strokeWidth={1.6} /> Compose Proposal™
          </p>
          <h1 className="font-heading text-[36px] sm:text-[42px] font-light text-[var(--bp-text-primary)] leading-[1.08] max-w-3xl">
            {sections.headline || proposal.title}
          </h1>
          {project && (
            <p className="text-[13px] text-[var(--bp-text-muted)] font-body mt-3">
              Progetto · {project.title}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6 text-[10.5px] uppercase tracking-[0.22em] text-[var(--bp-text-secondary)] font-body">
            <span>Stile · {STYLE_LABEL[proposal.style] || proposal.style}</span>
            <span>Tono · {TONE_LABEL[proposal.narrative_tone] || proposal.narrative_tone}</span>
            <span>Tier · {TIER_LABEL[proposal.investment_tier] || proposal.investment_tier}</span>
            <span>Mercato · {proposal.market || 'IT'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-7">
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body">
              Export PDF · Link condivisibile · Versione client portal — disponibili a breve
            </span>
            {savingMsg && (
              <span className="text-[10.5px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body inline-flex items-center gap-1.5 ml-auto">
                <Save size={11} strokeWidth={1.6} /> {savingMsg}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Sections */}
      <div className="space-y-5" data-testid="composer-sections">
        {visibleSections.map((s) => {
          // After section 03 (visual_inspirations), inject moodboards strip
          // After section 04 (material_language), inject materials cards
          const node = (
            <SectionCard key={s.key} s={s}
                         value={sections[s.key]}
                         onSave={(t) => patchSection(s.key, t)}
                         testid={`composer-section-${s.key}`} />
          );
          if (s.key === 'visual_inspirations') {
            return <React.Fragment key={s.key}>{node}<MoodboardStrip moodboards={moodboards} /></React.Fragment>;
          }
          if (s.key === 'material_language') {
            return <React.Fragment key={s.key}>{node}<MaterialCards materials={materials} /></React.Fragment>;
          }
          return node;
        })}
      </div>

      {/* Studio signature footer */}
      {advisor && (
        <article className="bp-card p-8 mt-8" data-testid="composer-signature">
          <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-4">
            Curato da
          </p>
          <div className="flex items-center gap-4">
            {advisor.avatar_url && (
              <img src={advisor.avatar_url} alt={advisor.name}
                   className="w-14 h-14 rounded-full object-cover" />
            )}
            <div>
              <p className="font-heading text-[18px] font-light text-[var(--bp-text-primary)]">
                {advisor.name}
              </p>
              {advisor.role_label && (
                <p className="text-[11.5px] text-[var(--bp-text-muted)] font-body">
                  {localized(advisor.role_label)}
                </p>
              )}
            </div>
          </div>
          {advisor.bio_short && (
            <p className="text-[13px] italic text-[var(--bp-text-secondary)] font-body leading-relaxed mt-4 max-w-2xl">
              {localized(advisor.bio_short)}
            </p>
          )}
        </article>
      )}
    </div>
  );
};

export default ProposalComposerPage;
