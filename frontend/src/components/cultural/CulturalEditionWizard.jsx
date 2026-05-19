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

const STEPS = [
  { key: 'source_type',  label: 'Tipo' },
  { key: 'source',       label: 'Contenuto' },
  { key: 'market',       label: 'Mercato' },
  { key: 'scope',        label: 'Adattamento' },
  { key: 'review',       label: 'Revisione' },
];

const CulturalEditionWizard = ({ open, onClose, onCreated,
                                 initialSourceType = null, initialSourceId = null,
                                 initialSourceTitle = null }) => {
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

  // Carica configurazione (mercati + ambiti + tipi) all'apertura
  useEffect(() => {
    if (!open) return;
    setStepIdx(initialSourceType && initialSourceId ? 2 : 0);
    setSourceType(initialSourceType || '');
    setSourceId(initialSourceId || '');
    setSourceTitle(initialSourceTitle || '');
    setMarket('');
    setLocale('');
    setScope([]);
    setNote('');
    api.get('/api/cultural-editions/markets')
      .then((r) => {
        setConfig(r.data);
        // default scope = tutti gli ambiti (suggestion editoriale)
        setScope((r.data?.adaptation_scopes || []).map((s) => s.key));
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

  // Selezione del mercato → imposta locale predefinito
  useEffect(() => {
    if (!market || !config) return;
    const m = (config.markets || []).find((x) => x.code === market);
    if (m && !locale) setLocale(m.default_locale || 'it-IT');
  }, [market, config, locale]);

  const selectedMarket = useMemo(
    () => (config?.markets || []).find((m) => m.code === market),
    [market, config]
  );

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
          <h2 className="cew-title">Adatta il tuo lavoro a un altro mercato culturale.</h2>
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
                {(config?.source_types || []).map((t) => (
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
              <p className="cew-question">Scegli il contenuto da adattare.</p>
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
                <div className="cew-loading">In attesa dei contenuti dello studio…</div>
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
                  <label className="cew-label">Lingua della versione mercato</label>
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
                {(config?.adaptation_scopes || []).map((s) => {
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
                <label className="cew-label">Briefing al caporedattore (opzionale)</label>
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
              <p className="cew-question">Revisione editoriale prima di creare.</p>
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
                  <span className="cew-review__lbl">Atmosfera</span>
                  <span className="cew-review__val cew-review__val--soft">{selectedMarket?.atmosphere}</span>
                </div>
                <div className="cew-review__row">
                  <span className="cew-review__lbl">Lingua</span>
                  <span className="cew-review__val">{locale || selectedMarket?.default_locale}</span>
                </div>
                <div className="cew-review__row">
                  <span className="cew-review__lbl">Ambiti di adattamento</span>
                  <span className="cew-review__val">
                    {scope.map((k) => (config?.adaptation_scopes || []).find((s) => s.key === k)?.label).filter(Boolean).join(' · ')}
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
  (config?.source_types || []).find((t) => t.key === key)?.label || key;

export default CulturalEditionWizard;
