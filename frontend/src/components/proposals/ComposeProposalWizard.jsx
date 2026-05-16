/**
 * ComposeProposalWizard — 3-step modal that transforms Strategic Direction™
 * into a cinematic editorial proposal draft.
 *
 * Step 1: Project style (Residential / Hospitality / Retail / Developer / …)
 * Step 2: Narrative tone (Minimal Editorial / Warm Mediterranean / …)
 * Step 3: Investment positioning + sections + composition
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import api from '../../lib/api';

const STYLES = [
  { id: 'residential',    label: 'Residenziale',     blurb: 'Casa privata, appartamento, villa.' },
  { id: 'hospitality',    label: 'Ospitalità',       blurb: 'Hotel, ristorante, boutique stay.' },
  { id: 'retail',         label: 'Retail',           blurb: 'Showroom, flagship, esperienza commerciale.' },
  { id: 'developer',      label: 'Sviluppatore',     blurb: 'Operazione immobiliare, scala edificio.' },
  { id: 'investor',       label: 'Investitore',      blurb: 'Asset progettuale, scenario rendimento.' },
  { id: 'private_client', label: 'Cliente privato',  blurb: 'Collector, mecenate, multi-residenza.' },
];

const TONES = [
  { id: 'minimal_editorial',  label: 'Minimale editoriale', blurb: 'Calmo, asciutto, ritmo sospeso.' },
  { id: 'warm_mediterranean', label: 'Caldo mediterraneo',  blurb: 'Sensoriale, terra, gesto antico.' },
  { id: 'quiet_luxury',       label: 'Lusso silenzioso',    blurb: 'Materiali nobili senza ostentazione.' },
  { id: 'architectural',      label: 'Architettonico',      blurb: 'Rigore, geometria, materia onesta.' },
  { id: 'bold_hospitality',   label: 'Ospitalità d\'autore', blurb: 'Scenografia, presenza forte.' },
  { id: 'collector_level',    label: 'Livello collezionismo', blurb: 'Dialogo con l\'autore, opera unica.' },
];

const TIERS = [
  { id: 'essential_direction',   label: 'Essential Direction',     blurb: 'Direzione progettuale essenziale.' },
  { id: 'elevated_residential',  label: 'Elevated Residential',    blurb: 'Residenziale curato, finiture nobili.' },
  { id: 'signature_hospitality', label: 'Signature Hospitality',   blurb: 'Ospitalità firmata, scala progetto.' },
  { id: 'collector_level',       label: 'Collector-Level',         blurb: 'Esecuzione da collezionismo.' },
];

const MARKETS = [
  { code: 'IT',  label: 'Italia' }, { code: 'US',  label: 'Stati Uniti' },
  { code: 'FR',  label: 'Francia' }, { code: 'DE',  label: 'Germania' },
  { code: 'UK',  label: 'Regno Unito' }, { code: 'UAE', label: 'Emirati Arabi' },
  { code: 'ES',  label: 'Spagna' },
];

const Pill = ({ active, onClick, label, blurb, testid }) => (
  <button onClick={onClick} type="button" data-testid={testid}
          className={`text-left p-5 border transition-all ${
            active
              ? 'border-[var(--bp-primary)] bg-[var(--bp-primary-soft,rgba(196,164,107,0.08))]'
              : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)] hover:border-[var(--bp-border-strong)]'
          }`}>
    <p className="font-heading text-[16px] font-light text-[var(--bp-text-primary)] leading-tight">
      {label}
    </p>
    <p className="text-[12px] text-[var(--bp-text-muted)] font-body mt-1.5 leading-relaxed">
      {blurb}
    </p>
  </button>
);

const StepDot = ({ active, done }) => (
  <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
    active ? 'bg-[var(--bp-primary)]' : done ? 'bg-[var(--bp-text-muted)]' : 'bg-[var(--bp-border)]'
  }`} />
);

export const ComposeProposalWizard = ({ projectId, defaultMarket = 'IT', onClose }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [style, setStyle] = useState('residential');
  const [tone, setTone] = useState('minimal_editorial');
  const [tier, setTier] = useState('elevated_residential');
  const [market, setMarket] = useState((defaultMarket || 'IT').toUpperCase());
  const [showNumeric, setShowNumeric] = useState(false);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState(null);

  const canNext = useMemo(() => {
    if (step === 1) return !!style;
    if (step === 2) return !!tone;
    if (step === 3) return !!tier && !!market;
    return false;
  }, [step, style, tone, tier, market]);

  const compose = async () => {
    setComposing(true); setError(null);
    try {
      // Locale is auto-derived server-side from `market` —
      // each market is composed natively in its language.
      const r = await api.post(`/api/projects/${projectId}/compose-proposal`, {
        style, narrative_tone: tone, investment_tier: tier,
        market, show_numeric_pricing: showNumeric,
      });
      const proposalId = r.data?.proposal?.id;
      if (proposalId) {
        onClose?.();
        navigate(`/workspace/proposals/${proposalId}/compose`);
      } else {
        setError('Composizione non riuscita.');
      }
    } catch (e) {
      setError('Composizione non riuscita. Riprova fra qualche istante.');
    } finally { setComposing(false); }
  };

  return (
    <div onClick={onClose} data-testid="compose-proposal-wizard"
         className="fixed inset-0 z-50 bg-[var(--bp-overlay,rgba(0,0,0,0.65))] backdrop-blur-sm flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()}
           className="bp-glass w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-[var(--bp-radius-md)]">
        {/* Header */}
        <header className="flex items-start justify-between p-7 pb-5 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-primary)] font-body mb-2 inline-flex items-center gap-2">
              <Sparkles size={11} strokeWidth={1.6} /> Compose Proposal™
            </p>
            <h2 className="font-heading text-[24px] font-light text-[var(--bp-text-primary)] leading-[1.15]">
              {step === 1 && 'Che tipo di progetto stiamo presentando?'}
              {step === 2 && 'Quale tono editoriale scegli?'}
              {step === 3 && 'Come vuoi posizionare l\'investimento?'}
            </h2>
            <div className="flex items-center gap-1.5 mt-4">
              <StepDot active={step === 1} done={step > 1} />
              <StepDot active={step === 2} done={step > 2} />
              <StepDot active={step === 3} done={false} />
              <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body ml-2">
                Passo {step} di 3
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]"
                  data-testid="wizard-close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="p-7">
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="wizard-step-style">
              {STYLES.map((s) => (
                <Pill key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}
                      label={s.label} blurb={s.blurb} testid={`style-${s.id}`} />
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="wizard-step-tone">
              {TONES.map((s) => (
                <Pill key={s.id} active={tone === s.id} onClick={() => setTone(s.id)}
                      label={s.label} blurb={s.blurb} testid={`tone-${s.id}`} />
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6" data-testid="wizard-step-tier">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {TIERS.map((s) => (
                  <Pill key={s.id} active={tier === s.id} onClick={() => setTier(s.id)}
                        label={s.label} blurb={s.blurb} testid={`tier-${s.id}`} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[var(--bp-border)]">
                <label className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
                  Mercato di posizionamento
                </label>
                <select value={market} onChange={(e) => setMarket(e.target.value)}
                        data-testid="wizard-market"
                        className="bg-[var(--bp-surface-1)] border border-[var(--bp-border)] text-[12px] px-3 py-2 text-[var(--bp-text-primary)] font-body">
                  {MARKETS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                </select>
                <label className="inline-flex items-center gap-2 text-[12px] text-[var(--bp-text-secondary)] font-body ml-auto">
                  <input type="checkbox" checked={showNumeric}
                         onChange={(e) => setShowNumeric(e.target.checked)}
                         data-testid="wizard-numeric-toggle"
                         className="accent-[var(--bp-primary)]" />
                  Mostra range numerico
                </label>
              </div>
              <p className="text-[11.5px] text-[var(--bp-text-muted)] font-body italic leading-relaxed">
                Per default la proposta mostra il posizionamento d'investimento, non un listino.
                Attiva il range numerico solo quando la conversazione con il cliente lo richiede.
              </p>
            </div>
          )}
          {error && <p className="text-[12px] text-red-300 mt-4">{error}</p>}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between p-6 border-t border-[var(--bp-border)]">
          <button onClick={() => setStep((s) => Math.max(1, s - 1))}
                  disabled={step === 1 || composing}
                  data-testid="wizard-back"
                  className="bp-btn bp-btn-ghost text-[10.5px] uppercase tracking-[0.22em] disabled:opacity-30">
            <ChevronLeft size={11} strokeWidth={1.6} /> Indietro
          </button>
          {step < 3 ? (
            <button onClick={() => setStep((s) => Math.min(3, s + 1))}
                    disabled={!canNext}
                    data-testid="wizard-next"
                    className="bp-btn bp-btn-primary text-[10.5px] uppercase tracking-[0.22em]">
              Continua <ChevronRight size={11} strokeWidth={1.6} />
            </button>
          ) : (
            <button onClick={compose} disabled={!canNext || composing}
                    data-testid="wizard-compose"
                    className="bp-btn bp-btn-primary text-[10.5px] uppercase tracking-[0.22em]">
              {composing ? 'Componendo proposta…' : 'Componi proposta'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
