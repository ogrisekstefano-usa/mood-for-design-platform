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

// Section labels localized per market/language. The proposal is composed
// natively in the market's language — the eyebrow + title chrome adapts too,
// so the document feels written-in-place, not translated.
const SECTION_DEF_BY_LOCALE = {
  it: [
    { key: 'opening',             title: 'Apertura editoriale',           eye: '01 — APERTURA' },
    { key: 'strategic_direction', title: 'Direzione strategica',          eye: '02 — DIREZIONE' },
    { key: 'visual_inspirations', title: 'Riferimenti visivi',            eye: '03 — ISPIRAZIONI' },
    { key: 'material_language',   title: 'Linguaggio materico',           eye: '04 — MATERIA' },
    { key: 'project_vision',      title: 'Visione del progetto',          eye: '05 — VISIONE' },
    { key: 'suggested_scope',     title: 'Ambito d\'intervento',          eye: '06 — AMBITO' },
    { key: 'investment',          title: 'Posizionamento d\'investimento', eye: '07 — INVESTIMENTO' },
    { key: 'timeline',            title: 'Direzione temporale',           eye: '08 — TEMPISTICA' },
    { key: 'signature',           title: 'Firma dello studio',            eye: '09 — FIRMA' },
  ],
  en: [
    { key: 'opening',             title: 'Editorial opening',         eye: '01 — OPENING' },
    { key: 'strategic_direction', title: 'Strategic direction',       eye: '02 — DIRECTION' },
    { key: 'visual_inspirations', title: 'Visual references',         eye: '03 — INSPIRATIONS' },
    { key: 'material_language',   title: 'Material language',         eye: '04 — MATERIAL' },
    { key: 'project_vision',      title: 'Project vision',            eye: '05 — VISION' },
    { key: 'suggested_scope',     title: 'Scope of intervention',     eye: '06 — SCOPE' },
    { key: 'investment',          title: 'Investment positioning',    eye: '07 — INVESTMENT' },
    { key: 'timeline',            title: 'Timeline direction',        eye: '08 — TIMELINE' },
    { key: 'signature',           title: 'Studio signature',          eye: '09 — SIGNATURE' },
  ],
  fr: [
    { key: 'opening',             title: 'Ouverture éditoriale',      eye: '01 — OUVERTURE' },
    { key: 'strategic_direction', title: 'Direction stratégique',     eye: '02 — DIRECTION' },
    { key: 'visual_inspirations', title: 'Références visuelles',      eye: '03 — INSPIRATIONS' },
    { key: 'material_language',   title: 'Langage matériel',          eye: '04 — MATIÈRE' },
    { key: 'project_vision',      title: 'Vision du projet',          eye: '05 — VISION' },
    { key: 'suggested_scope',     title: 'Périmètre d\'intervention', eye: '06 — PÉRIMÈTRE' },
    { key: 'investment',          title: 'Positionnement d\'investissement', eye: '07 — INVESTISSEMENT' },
    { key: 'timeline',            title: 'Calendrier indicatif',      eye: '08 — CALENDRIER' },
    { key: 'signature',           title: 'Signature du studio',       eye: '09 — SIGNATURE' },
  ],
  de: [
    { key: 'opening',             title: 'Editorialer Auftakt',       eye: '01 — AUFTAKT' },
    { key: 'strategic_direction', title: 'Strategische Ausrichtung',  eye: '02 — AUSRICHTUNG' },
    { key: 'visual_inspirations', title: 'Visuelle Referenzen',       eye: '03 — INSPIRATIONEN' },
    { key: 'material_language',   title: 'Materialsprache',           eye: '04 — MATERIAL' },
    { key: 'project_vision',      title: 'Projektvision',             eye: '05 — VISION' },
    { key: 'suggested_scope',     title: 'Eingriffsumfang',           eye: '06 — UMFANG' },
    { key: 'investment',          title: 'Investitionspositionierung', eye: '07 — INVESTITION' },
    { key: 'timeline',            title: 'Zeitliche Ausrichtung',     eye: '08 — TIMELINE' },
    { key: 'signature',           title: 'Studio-Signatur',           eye: '09 — SIGNATUR' },
  ],
  es: [
    { key: 'opening',             title: 'Apertura editorial',        eye: '01 — APERTURA' },
    { key: 'strategic_direction', title: 'Dirección estratégica',     eye: '02 — DIRECCIÓN' },
    { key: 'visual_inspirations', title: 'Referencias visuales',      eye: '03 — INSPIRACIONES' },
    { key: 'material_language',   title: 'Lenguaje matérico',         eye: '04 — MATERIA' },
    { key: 'project_vision',      title: 'Visión del proyecto',       eye: '05 — VISIÓN' },
    { key: 'suggested_scope',     title: 'Alcance de intervención',   eye: '06 — ALCANCE' },
    { key: 'investment',          title: 'Posicionamiento de inversión', eye: '07 — INVERSIÓN' },
    { key: 'timeline',            title: 'Dirección temporal',        eye: '08 — CRONOGRAMA' },
    { key: 'signature',           title: 'Firma del estudio',         eye: '09 — FIRMA' },
  ],
};

// Market → locale fallback when proposal.locale is missing
const LOCALE_FROM_MARKET = {
  IT: 'it', US: 'en', UK: 'en', FR: 'fr', DE: 'de', ES: 'es', UAE: 'en',
};

const META_LABELS = {
  it: { style: 'Stile',  tone: 'Tono',  tier: 'Tier', market: 'Mercato', back: 'Torna al progetto', curated_by: 'Curato da',
        disclosure: 'Export PDF · Link condivisibile · Versione client portal — disponibili a breve',
        edit: 'Modifica', cancel: 'Annulla', save: 'Salva', saved: 'Salvato' },
  en: { style: 'Style',  tone: 'Tone',  tier: 'Tier', market: 'Market',  back: 'Back to project',   curated_by: 'Curated by',
        disclosure: 'PDF export · Shareable link · Client portal version — available soon',
        edit: 'Edit', cancel: 'Cancel', save: 'Save', saved: 'Saved' },
  fr: { style: 'Style',  tone: 'Ton',   tier: 'Niveau', market: 'Marché', back: 'Retour au projet', curated_by: 'Curaté par',
        disclosure: 'Export PDF · Lien partageable · Version portail client — bientôt disponibles',
        edit: 'Modifier', cancel: 'Annuler', save: 'Enregistrer', saved: 'Enregistré' },
  de: { style: 'Stil',   tone: 'Ton',   tier: 'Stufe', market: 'Markt',  back: 'Zum Projekt', curated_by: 'Kuratiert von',
        disclosure: 'PDF-Export · Teilbarer Link · Kundenportal-Version — in Kürze verfügbar',
        edit: 'Bearbeiten', cancel: 'Abbrechen', save: 'Speichern', saved: 'Gespeichert' },
  es: { style: 'Estilo', tone: 'Tono',  tier: 'Nivel', market: 'Mercado', back: 'Volver al proyecto', curated_by: 'Curado por',
        disclosure: 'Exportación PDF · Enlace compartible · Versión portal cliente — próximamente',
        edit: 'Editar', cancel: 'Cancelar', save: 'Guardar', saved: 'Guardado' },
};

const STYLE_LABEL_I18N = {
  it: { residential: 'Residenziale', hospitality: 'Ospitalità', retail: 'Retail',  developer: 'Sviluppatore', investor: 'Investitore', private_client: 'Cliente privato' },
  en: { residential: 'Residential',   hospitality: 'Hospitality', retail: 'Retail', developer: 'Developer',    investor: 'Investor',    private_client: 'Private client' },
  fr: { residential: 'Résidentiel',   hospitality: 'Hospitalité', retail: 'Retail', developer: 'Promoteur',    investor: 'Investisseur', private_client: 'Client privé' },
  de: { residential: 'Wohnen',        hospitality: 'Hospitality', retail: 'Retail', developer: 'Entwickler',    investor: 'Investor',    private_client: 'Privatkunde' },
  es: { residential: 'Residencial',   hospitality: 'Hospitalidad', retail: 'Retail', developer: 'Promotor',     investor: 'Inversor',    private_client: 'Cliente privado' },
};

const TONE_LABEL_I18N = {
  it: { minimal_editorial: 'Minimale editoriale', warm_mediterranean: 'Caldo mediterraneo', quiet_luxury: 'Lusso silenzioso',
        architectural: 'Architettonico', bold_hospitality: 'Ospitalità d\'autore', collector_level: 'Livello collezionismo' },
  en: { minimal_editorial: 'Minimal editorial', warm_mediterranean: 'Warm Mediterranean', quiet_luxury: 'Quiet luxury',
        architectural: 'Architectural', bold_hospitality: 'Bold hospitality', collector_level: 'Collector level' },
  fr: { minimal_editorial: 'Minimal éditorial', warm_mediterranean: 'Méditerranéen chaleureux', quiet_luxury: 'Luxe discret',
        architectural: 'Architectural', bold_hospitality: 'Hospitalité d\'auteur', collector_level: 'Niveau collectionneur' },
  de: { minimal_editorial: 'Minimal-editorial', warm_mediterranean: 'Warm-mediterran', quiet_luxury: 'Stiller Luxus',
        architectural: 'Architektonisch', bold_hospitality: 'Markante Hospitality', collector_level: 'Sammler-Niveau' },
  es: { minimal_editorial: 'Minimal editorial', warm_mediterranean: 'Cálido mediterráneo', quiet_luxury: 'Lujo silencioso',
        architectural: 'Arquitectónico', bold_hospitality: 'Hospitalidad de autor', collector_level: 'Nivel coleccionista' },
};

const TIER_LABEL_I18N = {
  it: { essential_direction: 'Essential Direction', elevated_residential: 'Elevated Residential',
        signature_hospitality: 'Signature Hospitality', collector_level: 'Collector-Level Execution' },
  en: { essential_direction: 'Essential Direction', elevated_residential: 'Elevated Residential',
        signature_hospitality: 'Signature Hospitality', collector_level: 'Collector-Level Execution' },
  fr: { essential_direction: 'Direction essentielle', elevated_residential: 'Résidentiel élevé',
        signature_hospitality: 'Hospitalité signature', collector_level: 'Exécution niveau collectionneur' },
  de: { essential_direction: 'Wesentliche Ausrichtung', elevated_residential: 'Gehobenes Wohnen',
        signature_hospitality: 'Signature Hospitality', collector_level: 'Sammler-Ausführung' },
  es: { essential_direction: 'Dirección esencial', elevated_residential: 'Residencial elevado',
        signature_hospitality: 'Hospitalidad signature', collector_level: 'Ejecución coleccionista' },
};

// Localized fields may arrive as a string OR as a multilingual object
// {it, en, _default, ...}. Always coerce to string for React rendering,
// preferring the proposal's output locale when provided.
const localized = (v, preferLocale = null) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const order = preferLocale
      ? [preferLocale, 'it', 'en', 'en-US', '_default']
      : ['it', 'en', 'en-US', '_default'];
    for (const k of order) if (typeof v[k] === 'string' && v[k]) return v[k];
    return Object.values(v).find((x) => typeof x === 'string') || '';
  }
  return String(v);
};

// Resolve the proposal's output locale from explicit sections._locale
// (saved by backend), falling back to the market mapping.
const resolveLocale = (proposal) => {
  const explicit = (proposal?.sections?._locale || '').toLowerCase();
  if (explicit && SECTION_DEF_BY_LOCALE[explicit]) return explicit;
  const m = (proposal?.market || 'IT').toUpperCase();
  return LOCALE_FROM_MARKET[m] || 'en';
};

const SectionCard = ({ s, value, onSave, testid, t }) => {
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
            <Edit3 size={11} strokeWidth={1.6} /> {t.edit}
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
              {t.cancel}
            </button>
            <button onClick={save}
                    data-testid={`${testid}-save`}
                    className="bp-btn bp-btn-primary text-[10.5px] uppercase tracking-[0.22em]">
              <Check size={11} strokeWidth={1.6} /> {t.save}
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

const STRIP_LABELS = {
  it: { moodboards: 'Moodboard collegati',    materials: 'Materiali integrati',  no_cover: 'Senza copertina' },
  en: { moodboards: 'Linked moodboards',      materials: 'Integrated materials', no_cover: 'No cover' },
  fr: { moodboards: 'Moodboards liés',        materials: 'Matériaux intégrés',   no_cover: 'Sans couverture' },
  de: { moodboards: 'Verknüpfte Moodboards',  materials: 'Integrierte Materialien', no_cover: 'Ohne Cover' },
  es: { moodboards: 'Moodboards vinculados',  materials: 'Materiales integrados', no_cover: 'Sin portada' },
};

const MoodboardStrip = ({ moodboards, locale }) => {
  if (!moodboards || moodboards.length === 0) return null;
  const labels = STRIP_LABELS[locale] || STRIP_LABELS.en;
  return (
    <article className="bp-card p-8" data-testid="composer-moodboards-strip">
      <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-5">
        {labels.moodboards}
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
                  {labels.no_cover}
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

const MaterialCards = ({ materials, locale }) => {
  if (!materials || materials.length === 0) return null;
  const labels = STRIP_LABELS[locale] || STRIP_LABELS.en;
  return (
    <article className="bp-card p-8" data-testid="composer-materials">
      <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-5">
        {labels.materials}
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
      const locale = resolveLocale(data?.proposal);
      setSavingMsg((META_LABELS[locale] || META_LABELS.en).saved);
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
  // Locale of the proposal output = market's native language (it/en/fr/de/es).
  // All chrome (eyebrows, titles, meta strip, disclosure) adapts.
  const locale = resolveLocale(proposal);
  const labels = META_LABELS[locale] || META_LABELS.en;
  const styleMap = STYLE_LABEL_I18N[locale] || STYLE_LABEL_I18N.en;
  const toneMap  = TONE_LABEL_I18N[locale]  || TONE_LABEL_I18N.en;
  const tierMap  = TIER_LABEL_I18N[locale]  || TIER_LABEL_I18N.en;
  const sectionDef = SECTION_DEF_BY_LOCALE[locale] || SECTION_DEF_BY_LOCALE.en;
  const includedKeys = (proposal.sections_included && proposal.sections_included.length
    ? proposal.sections_included : sectionDef.map((s) => s.key));
  const visibleSections = sectionDef.filter((s) => includedKeys.includes(s.key));

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto" data-testid="proposal-composer-page"
         lang={locale}>
      <button onClick={() => navigate(`/workspace/projects/${proposal.project_id}`)}
              data-testid="composer-back"
              className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] mb-6 inline-flex items-center gap-1.5 font-body">
        <ArrowLeft size={12} strokeWidth={1.6} /> {labels.back}
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
              {project.title}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6 text-[10.5px] uppercase tracking-[0.22em] text-[var(--bp-text-secondary)] font-body">
            <span>{labels.style} · {styleMap[proposal.style] || proposal.style}</span>
            <span>{labels.tone} · {toneMap[proposal.narrative_tone] || proposal.narrative_tone}</span>
            <span>{labels.tier} · {tierMap[proposal.investment_tier] || proposal.investment_tier}</span>
            <span>{labels.market} · {proposal.market || 'IT'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-7">
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body">
              {labels.disclosure}
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
          const node = (
            <SectionCard key={s.key} s={s} t={labels}
                         value={sections[s.key]}
                         onSave={(text) => patchSection(s.key, text)}
                         testid={`composer-section-${s.key}`} />
          );
          if (s.key === 'visual_inspirations') {
            return <React.Fragment key={s.key}>{node}<MoodboardStrip moodboards={moodboards} locale={locale} /></React.Fragment>;
          }
          if (s.key === 'material_language') {
            return <React.Fragment key={s.key}>{node}<MaterialCards materials={materials} locale={locale} /></React.Fragment>;
          }
          return node;
        })}
      </div>

      {/* Studio signature footer */}
      {advisor && (
        <article className="bp-card p-8 mt-8" data-testid="composer-signature">
          <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] font-body mb-4">
            {labels.curated_by}
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
                  {localized(advisor.role_label, locale)}
                </p>
              )}
            </div>
          </div>
          {advisor.bio_short && (
            <p className="text-[13px] italic text-[var(--bp-text-secondary)] font-body leading-relaxed mt-4 max-w-2xl">
              {localized(advisor.bio_short, locale)}
            </p>
          )}
        </article>
      )}
    </div>
  );
};

export default ProposalComposerPage;
