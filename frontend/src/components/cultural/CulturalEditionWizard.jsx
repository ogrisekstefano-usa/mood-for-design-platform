/**
 * CulturalEditionWizard — Cultural Edition™ Flow Activation
 *
 * Wizard editoriale a 5 step:
 *   1. Tipo di contenuto base (Progetto · Moodboard · Showcase)
 *   2. Selezione del contenuto
 *   3. Mercato di destinazione (6 mercati curati con descrittori editoriali)
 *   4. Ambito di adattamento (checkbox editoriali)
 *   5. Revisione editoriale prima della creazione
 *
 * Linguaggio: 100% italiano editoriale, niente jargon SaaS, niente "AI".
 * Backend integration: POST /api/cultural-editions/drafts crea la bozza,
 * genera la versione mercato e ritorna l'ID per la review page.
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import './cultural-edition-wizard.css';
import { useT } from '../../i18n/useT';

const STEPS = [
  { key: 'source_type',  label: 'Tipo' },
  { key: 'source',       label: 'Contenuto' },
  { key: 'market',       label: 'Mercato' },
  { key: 'scope',        label: 'Adattamento' },
  { key: 'review',       label: 'Revisione' },
];

// Fallback costanti editoriali (visibili immediatamente, non attendono il fetch)
const SOURCE_TYPES_FALLBACK = [
  { key: 'project',            label: 'Progetto' },
  { key: 'moodboard',          label: 'Moodboard' },
  { key: 'showcase',           label: 'Showcase' },
  { key: 'material_selection', label: 'Selezione materiali' },
];

const ADAPTATION_SCOPES_FALLBACK = [
  { key: 'tone',             label: 'Tono editoriale' },
  { key: 'cta',              label: 'Call to action' },
  { key: 'material_palette', label: 'Palette materica' },
  { key: 'imagery',          label: 'Riferimenti visivi' },
  { key: 'cultural_refs',    label: 'Riferimenti culturali' },
  { key: 'headlines',        label: 'Titoli e cappelli' },
  { key: 'atmosphere',       label: 'Atmosfera narrativa' },
];

// ── Direzioni narrative & intensità (allineate al backend) ───────────
// Lessico editoriale italiano: NESSUN jargon AI/prompt/model.
const NARRATIVE_MODES_OPTS = [
  { key: 'strategic',         label: 'Strategica · sintetica e progettuale' },
  { key: 'technical',         label: 'Tecnica · architettonica, zero metafore' },
  { key: 'emotional',         label: 'Emozionale · misurata, sensoriale' },
  { key: 'cinematic',         label: 'Cinematografica · immersiva' },
  { key: 'hospitality',       label: 'Ospitale · esperienziale' },
  { key: 'luxury_editorial',  label: 'Editorial luxury · magazine alta gamma' },
  { key: 'commercial_soft',   label: 'Commerciale morbida · rassicurante' },
  { key: 'cultural_analyst',  label: 'Consulenziale · culturale internazionale' },
  { key: 'minimal_executive', label: 'Minimal executive · una frase essenziale' },
  { key: 'editorial',         label: 'Editoriale · registro magazine' },
];

const NARRATIVE_INTENSITY_OPTS = [
  { key: 'minimal',   label: 'Minimal · essenziale' },
  { key: 'balanced',  label: 'Bilanciata · misurata' },
  { key: 'editorial', label: 'Editoriale · densa' },
  { key: 'cinematic', label: 'Cinematica · narrativa' },
];

const labelForNarrativeMode = (key) =>
  NARRATIVE_MODES_OPTS.find((o) => o.key === key)?.label || key;
const labelForIntensity = (key) =>
  NARRATIVE_INTENSITY_OPTS.find((o) => o.key === key)?.label || key;

const CulturalEditionWizard = ({ open, onClose, onCreated,
                                 initialSourceType = null, initialSourceId = null,
                                 initialSourceTitle = null }) => {
  const { t } = useT();
  const [stepIdx, setStepIdx] = useState(0);
  const [config, setConfig] = useState(null);
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selections
  const [sourceType, setSourceType] = useState(initialSourceType || '');
  const [sourceId, setSourceId] = useState(initialSourceId || '');
  const [sourceTitle, setSourceTitle] = useState(initialSourceTitle || '');
  const [market, setMarket] = useState('');
  const [locale, setLocale] = useState('');
  const [scope, setScope] = useState([]);
  const [note, setNote] = useState('');

  // ── Market Narrative Profile™ — direzione narrativa contestuale ──
  // Lo stato locale tiene la SCELTA dell'utente. Quando seleziona un
  // mercato, pre-riempiamo con i suggested del profilo; se l'utente
  // modifica → manual_override=true → backend lo salva per Pattern Learning™.
  const [narrativeMode, setNarrativeMode] = useState('');
  const [narrativeIntensity, setNarrativeIntensity] = useState('');
  const [manualOverride, setManualOverride] = useState(false);

  // Carica configurazione (mercati + ambiti + tipi) all'apertura
  useEffect(() => {
    if (!open) return;
    setStepIdx(initialSourceType && initialSourceId ? 2 : 0);
    setSourceType(initialSourceType || '');
    setSourceId(initialSourceId || '');
    setSourceTitle(initialSourceTitle || '');
    setMarket('');
    setLocale('');
    setNote('');
    setNarrativeMode('');
    setNarrativeIntensity('');
    setManualOverride(false);
    // Default scope = tutti gli ambiti (immediatamente disponibile dai fallback)
    setScope(ADAPTATION_SCOPES_FALLBACK.map((s) => s.key));
    api.get('/api/cultural-editions/markets')
      .then((r) => {
        setConfig(r.data);
        // Override con set dal server se più completo
        if (r.data?.adaptation_scopes) {
          setScope(r.data.adaptation_scopes.map((s) => s.key));
        }
      })
      .catch(() => setConfig(null));
  }, [open, initialSourceType, initialSourceId, initialSourceTitle]);

  // Carica i contenuti quando si entra nello step 2 e c'è un tipo selezionato
  useEffect(() => {
    if (!open || !sourceType) return;
    if (sourceType === 'showcase' || sourceType === 'material_selection') {
      setSources([]);
      return;
    }
    setLoadingSources(true);
    api.get(`/api/cultural-editions/sources?type=${sourceType}`)
      .then((r) => setSources(r.data?.items || []))
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  }, [open, sourceType]);

  // Selezione del mercato → imposta locale predefinito + pre-fill Market Narrative Profile™
  useEffect(() => {
    if (!market || !config) return;
    const m = (config.markets || []).find((x) => x.code === market);
    if (m && !locale) setLocale(m.default_locale || 'it-IT');
    // Auto-prefill della direzione narrativa dal profilo del mercato (ibrido):
    // l'utente vede subito "Suggerito dal mercato: Hospitality · Cinematic" ma
    // può sovrascrivere. Se ha già sovrascritto, NON azzeriamo il suo input.
    const np = m?.narrative_profile;
    if (np && !manualOverride) {
      setNarrativeMode(np.suggested_narrative_mode || '');
      setNarrativeIntensity(np.suggested_intensity || '');
    }
  }, [market, config, locale, manualOverride]);

  const selectedMarket = useMemo(
    () => (config?.markets || []).find((m) => m.code === market),
    [market, config]
  );

  const selectedProfile = selectedMarket?.narrative_profile || null;
  const isOverridden = useMemo(() => {
    if (!selectedProfile) return false;
    return (
      (narrativeMode && narrativeMode !== selectedProfile.suggested_narrative_mode) ||
      (narrativeIntensity && narrativeIntensity !== selectedProfile.suggested_intensity)
    );
  }, [narrativeMode, narrativeIntensity, selectedProfile]);

  const resetToSuggested = () => {
    if (!selectedProfile) return;
    setNarrativeMode(selectedProfile.suggested_narrative_mode || '');
    setNarrativeIntensity(selectedProfile.suggested_intensity || '');
    setManualOverride(false);
  };

  const canAdvance = useMemo(() => {
    if (stepIdx === 0) return !!sourceType;
    if (stepIdx === 1) {
      if (sourceType === 'showcase' || sourceType === 'material_selection') {
        return !!sourceId.trim();
      }
      return !!sourceId;
    }
    if (stepIdx === 2) return !!market;
    if (stepIdx === 3) return scope.length > 0;
    return true;
  }, [stepIdx, sourceType, sourceId, market, scope]);

  const toggleScope = (k) => {
    setScope((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  };

  const submit = async () => {
    if (!selectedMarket) return;
    setSubmitting(true);
    try {
      const r = await api.post('/api/cultural-editions/drafts', {
        source_type:      sourceType,
        source_id:        sourceId,
        source_title:     sourceTitle || sources.find((s) => s.id === sourceId)?.title || '',
        target_market:    selectedMarket.code,
        target_locale:    locale || selectedMarket.default_locale,
        adaptation_scope: scope,
        note,
        selected_narrative_mode: narrativeMode || undefined,
        selected_intensity:      narrativeIntensity || undefined,
      });
      toast.success(`Versione mercato pronta · ${selectedMarket.label}`);
      onCreated?.(r.data);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || 'Non è stato possibile creare l\'edizione');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
    else submit();
  };
  const prev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  if (!open) return null;

  return (
    <div className="cew-backdrop" data-testid="cultural-edition-wizard-backdrop"
         onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="cew-modal" data-testid="cultural-edition-wizard">
        <button type="button" className="cew-close" onClick={onClose} aria-label="Chiudi"
                data-testid="cew-close">
          <Icons.X size={16} />
        </button>

        <header className="cew-head">
          <p className="cew-eyebrow">Cultural Edition™</p>
          <h2 className="cew-title">{t('cultural.cultural_edition.adatta_il_tuo_lavoro_a_un_altro_mercato_culturale')}</h2>
          <p className="cew-lede">
            MOOD prende un tuo contenuto e ne prepara una versione editoriale per la cultura del mercato che scegli.
            Niente traduzione automatica — è un atto editoriale guidato.
          </p>
        </header>

        <nav className="cew-stepper" data-testid="cew-stepper">
          {STEPS.map((s, i) => (
            <div key={s.key}
                 className={`cew-step ${i === stepIdx ? 'cew-step--current' : ''} ${i < stepIdx ? 'cew-step--done' : ''}`}
                 data-testid={`cew-step-${s.key}`}>
              <span className="cew-step__index">{i + 1}</span>
              <span className="cew-step__label">{s.label}</span>
            </div>
          ))}
        </nav>

        <div className="cew-body">
          {/* STEP 1 — TIPO */}
          {stepIdx === 0 && (
            <div className="cew-step-panel" data-testid="cew-panel-source-type">
              <p className="cew-question">Da quale contenuto vuoi partire?</p>
              <div className="cew-grid-2">
                {(config?.source_types || SOURCE_TYPES_FALLBACK).map((t) => (
                  <button key={t.key} type="button"
                          onClick={() => { setSourceType(t.key); setSourceId(''); }}
                          className={`cew-card ${sourceType === t.key ? 'cew-card--selected' : ''}`}
                          data-testid={`cew-source-type-${t.key}`}>
                    <span className="cew-card__icon">
                      <Icons.FileText size={18} strokeWidth={1.4} />
                    </span>
                    <span className="cew-card__title">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — CONTENUTO */}
          {stepIdx === 1 && (
            <div className="cew-step-panel" data-testid="cew-panel-source">
              <p className="cew-question">{t('cultural.cultural_edition.scegli_il_contenuto_da_adattare')}</p>
              {(sourceType === 'showcase' || sourceType === 'material_selection') ? (
                <div className="cew-field">
                  <label className="cew-label">
                    {sourceType === 'showcase' ? 'Riferimento dello showcase' : 'Riferimento della selezione materiali'}
                  </label>
                  <input type="text" className="cew-input"
                         value={sourceId}
                         placeholder="Incolla l'identificativo o uno slug"
                         onChange={(e) => { setSourceId(e.target.value); setSourceTitle(e.target.value); }}
                         data-testid="cew-source-id-input" />
                  <p className="cew-hint">
                    Showcase e selezioni materiali sono in lavorazione — al momento puoi inserire un riferimento manuale.
                  </p>
                </div>
              ) : loadingSources ? (
                <div className="cew-loading">{t('cultural.cultural_edition.in_attesa_dei_contenuti_dello_studio')}</div>
              ) : sources.length === 0 ? (
                <div className="cew-empty">
                  <Icons.Folder size={20} strokeWidth={1.2} />
                  <p>Nessun {sourceType === 'project' ? 'progetto' : 'moodboard'} ancora disponibile.</p>
                </div>
              ) : (
                <ul className="cew-source-list" data-testid="cew-source-list">
                  {sources.map((s) => (
                    <li key={s.id}>
                      <button type="button"
                              onClick={() => { setSourceId(s.id); setSourceTitle(s.title); }}
                              className={`cew-source-row ${sourceId === s.id ? 'cew-source-row--selected' : ''}`}
                              data-testid={`cew-source-${s.id}`}>
                        <span className="cew-source-row__cover">
                          {s.cover_url ? (
                            <img src={s.cover_url} alt={s.title} loading="lazy" />
                          ) : (
                            <Icons.Image size={16} strokeWidth={1.2} />
                          )}
                        </span>
                        <span className="cew-source-row__body">
                          <span className="cew-source-row__title">{s.title}</span>
                          <span className="cew-source-row__sub">{s.subtitle}</span>
                        </span>
                        {sourceId === s.id && <Icons.Check size={14} className="cew-source-row__check" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* STEP 3 — MERCATO */}
          {stepIdx === 2 && (
            <div className="cew-step-panel" data-testid="cew-panel-market">
              <p className="cew-question">Per quale mercato vuoi adattarlo?</p>
              <div className="cew-grid-3">
                {(config?.markets || []).map((m) => (
                  <button key={m.code} type="button"
                          onClick={() => setMarket(m.code)}
                          className={`cew-market ${market === m.code ? 'cew-market--selected' : ''}`}
                          data-testid={`cew-market-${m.code}`}>
                    <div className="cew-market__head">
                      <Icons.Globe size={14} strokeWidth={1.4} />
                      <span className="cew-market__city">{m.label}</span>
                    </div>
                    <p className="cew-market__atmosphere">{m.atmosphere}</p>
                    <div className="cew-market__chips">
                      {(m.descriptors || []).slice(0, 3).map((d, i) => (
                        <span key={i} className="cew-market__chip">{d}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {selectedMarket && (
                <div className="cew-field" style={{ marginTop: 22 }}>
                  <label className="cew-label">{t('cultural.cultural_edition.lingua_della_versione_mercato')}</label>
                  <select className="cew-input" value={locale}
                          onChange={(e) => setLocale(e.target.value)}
                          data-testid="cew-locale-select">
                    <option value="it-IT">Italiano</option>
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="fr-FR">Français</option>
                    <option value="de-DE">Deutsch</option>
                    <option value="es-ES">Español</option>
                  </select>
                </div>
              )}

              {/* ── Direzione narrativa del mercato — Market Narrative Profile™ ── */}
              {selectedMarket && selectedProfile && (
                <div className="cew-narrative-profile"
                     data-testid="cew-narrative-profile">
                  <div className="cew-narrative-profile__head">
                    <span className="cew-narrative-profile__badge">
                      <Icons.Compass size={11} strokeWidth={1.6} /> Suggerito dal mercato
                    </span>
                    <span className="cew-narrative-profile__market">{selectedMarket.label}</span>
                  </div>
                  <h4 className="cew-narrative-profile__title">{t('cultural.cultural_edition.direzione_narrativa_del_mercato')}</h4>
                  <p className="cew-narrative-profile__note">{selectedProfile.curator_note}</p>
                  {selectedProfile.narrative_direction?.length > 0 && (
                    <div className="cew-narrative-profile__chips">
                      {selectedProfile.narrative_direction.slice(0, 5).map((d, i) => (
                        <span key={i} className="cew-narrative-profile__chip">{d}</span>
                      ))}
                    </div>
                  )}
                  <div className="cew-narrative-profile__grid">
                    <div className="cew-field">
                      <label className="cew-label">Direzione narrativa</label>
                      <select className="cew-input"
                              value={narrativeMode}
                              onChange={(e) => { setNarrativeMode(e.target.value); setManualOverride(true); }}
                              data-testid="cew-narrative-mode">
                        {NARRATIVE_MODES_OPTS.map((o) => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="cew-field">
                      <label className="cew-label">Intensità narrativa</label>
                      <select className="cew-input"
                              value={narrativeIntensity}
                              onChange={(e) => { setNarrativeIntensity(e.target.value); setManualOverride(true); }}
                              data-testid="cew-narrative-intensity">
                        {NARRATIVE_INTENSITY_OPTS.map((o) => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {isOverridden ? (
                    <div className="cew-narrative-profile__override" data-testid="cew-narrative-override">
                      <span>{t('cultural.cultural_edition.hai_personalizzato_la_direzione_del_mercato')}</span>
                      <button type="button"
                              className="cew-narrative-profile__reset"
                              onClick={resetToSuggested}
                              data-testid="cew-narrative-reset">
                        <Icons.RotateCcw size={10} /> Torna ai suggerimenti del mercato
                      </button>
                    </div>
                  ) : (
                    <p className="cew-narrative-profile__hint">
                      MOOD ha pre-compilato i campi con la cultura narrativa di
                      {' '}{selectedMarket.city || selectedMarket.label}. Puoi
                      cambiarli liberamente — è un suggerimento, non una regola.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — AMBITO */}
          {stepIdx === 3 && (
            <div className="cew-step-panel" data-testid="cew-panel-scope">
              <p className="cew-question">Cosa vuoi adattare?</p>
              <p className="cew-hint cew-hint--inline">
                Puoi selezionare uno o più ambiti. La redazione di MOOD lavorerà solo su questi.
              </p>
              <div className="cew-scope-list">
                {(config?.adaptation_scopes || ADAPTATION_SCOPES_FALLBACK).map((s) => {
                  const on = scope.includes(s.key);
                  return (
                    <button key={s.key} type="button"
                            onClick={() => toggleScope(s.key)}
                            className={`cew-scope ${on ? 'cew-scope--on' : ''}`}
                            data-testid={`cew-scope-${s.key}`}>
                      <span className="cew-scope__check">
                        {on && <Icons.Check size={11} strokeWidth={2.4} />}
                      </span>
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="cew-field" style={{ marginTop: 22 }}>
                <label className="cew-label">{t('cultural.cultural_edition.briefing_al_caporedattore_opzionale')}</label>
                <textarea className="cew-textarea" rows={3}
                          placeholder="Tono che desideri, vincoli, riferimenti culturali da onorare…"
                          value={note} onChange={(e) => setNote(e.target.value)}
                          data-testid="cew-note" />
              </div>
            </div>
          )}

          {/* STEP 5 — REVISIONE */}
          {stepIdx === 4 && (
            <div className="cew-step-panel" data-testid="cew-panel-review">
              <p className="cew-question">{t('cultural.cultural_edition.revisione_editoriale_prima_di_creare')}</p>
              <div className="cew-review">
                <div className="cew-review__row">
                  <span className="cew-review__lbl">Contenuto base</span>
                  <span className="cew-review__val">
                    {sourceTitle || 'Senza titolo'} · <em>{labelForSourceType(config, sourceType)}</em>
                  </span>
                </div>
                <div className="cew-review__row">
                  <span className="cew-review__lbl">Mercato di destinazione</span>
                  <span className="cew-review__val">{selectedMarket?.label}</span>
                </div>
                <div className="cew-review__row">
                  <span className="cew-review__lbl">{t('cultural.cultural_edition.atmosfera')}</span>
                  <span className="cew-review__val cew-review__val--soft">{selectedMarket?.atmosphere}</span>
                </div>
                {(narrativeMode || narrativeIntensity) && (
                  <div className="cew-review__row" data-testid="cew-review-narrative">
                    <span className="cew-review__lbl">Direzione narrativa</span>
                    <span className="cew-review__val">
                      {labelForNarrativeMode(narrativeMode)} · {labelForIntensity(narrativeIntensity)}
                      {isOverridden && (
                        <em className="cew-review__hint"> · personalizzata</em>
                      )}
                      {!isOverridden && selectedProfile && (
                        <em className="cew-review__hint"> · suggerita dal mercato</em>
                      )}
                    </span>
                  </div>
                )}
                <div className="cew-review__row">
                  <span className="cew-review__lbl">Lingua</span>
                  <span className="cew-review__val">{locale || selectedMarket?.default_locale}</span>
                </div>
                <div className="cew-review__row">
                  <span className="cew-review__lbl">Ambiti di adattamento</span>
                  <span className="cew-review__val">
                    {scope.map((k) => (config?.adaptation_scopes || ADAPTATION_SCOPES_FALLBACK).find((s) => s.key === k)?.label).filter(Boolean).join(' · ')}
                  </span>
                </div>
                {note && (
                  <div className="cew-review__row">
                    <span className="cew-review__lbl">Briefing</span>
                    <span className="cew-review__val cew-review__val--soft">"{note}"</span>
                  </div>
                )}
              </div>
              {submitting && (
                <div className="cew-processing" data-testid="cew-processing">
                  <span className="cew-processing__pulse" />
                  La redazione internazionale di MOOD sta preparando l'adattamento…
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="cew-foot">
          <button type="button" className="cew-btn cew-btn--ghost"
                  onClick={stepIdx === 0 ? onClose : prev}
                  disabled={submitting}
                  data-testid="cew-prev">
            {stepIdx === 0 ? 'Annulla' : 'Indietro'}
          </button>
          <button type="button" className="cew-btn cew-btn--primary"
                  onClick={next}
                  disabled={!canAdvance || submitting}
                  data-testid="cew-next">
            {submitting ? 'Creazione…' :
             stepIdx === STEPS.length - 1 ? 'Crea versione mercato' : 'Avanti'}
            {!submitting && <Icons.ArrowRight size={13} />}
          </button>
        </footer>
      </div>
    </div>
  );
};

const labelForSourceType = (config, key) =>
  (config?.source_types || SOURCE_TYPES_FALLBACK).find((t) => t.key === key)?.label || key;

export default CulturalEditionWizard;
