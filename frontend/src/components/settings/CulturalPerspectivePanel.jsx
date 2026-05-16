/**
 * CulturalPerspectivePanel — Phase P0.2.B.
 *
 * Settings → Account · "How your studio speaks to its market."
 *
 * Surfaces the active locale_profile and lets the user switch their
 * personal Cultural Perspective™ (NOT a language switcher — a runtime
 * cultural repositioning preference). The label is intentionally
 * "Cultural Perspective" / "Market Perspective", never "Language".
 *
 * Persistence: PUT /api/locale-runtime/preference. The provider
 * re-resolves automatically on success.
 */
import React, { useState } from 'react';
import { Check, Globe, Loader2 } from 'lucide-react';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';

// Local registry of locale meta — same shape as backend locale_profiles
// listing. We don't fetch the full profiles here; the provider already
// hydrated `runtime.supported`. The descriptions are runtime.copy() tokens
// resolved against the *target* locale so the user previews the actual
// register they're about to switch to.
const LOCALES_META = {
  IT_IT: { display: 'Italia',         market: 'IT',  register: 'Editorial craftsmanship',     example: 'Materia, artigianalità, equilibrio, tempo lungo.' },
  EN_US: { display: 'United States',  market: 'US',  register: 'Aspirational lifestyle',      example: 'Elevated lifestyle, entertaining flow, signature moments.' },
  EN_GB: { display: 'United Kingdom', market: 'GB',  register: 'Restrained editorial luxury', example: 'Understated luxury, layered sophistication, quiet authority.' },
  EN_AE: { display: 'UAE',            market: 'AE',  register: 'Sensorial prestige',          example: 'Iconic presence, sensorial atmosphere, private hospitality.' },
  DE_DE: { display: 'Deutschland',    market: 'DE',  register: 'Architectural precision',     example: 'Materialdisziplin, konstruktive Klarheit, präzise Geste.' },
  FR_FR: { display: 'France',         market: 'FR',  register: 'Editorial sophistication',    example: 'Raffinement, élégance discrète, sophistication culturelle.' },
  ES_ES: { display: 'España',         market: 'ES',  register: 'Warm experiential Mediterranean', example: 'Calidez, luz natural, convivencia, ritmo mediterráneo.' },
};

const SOURCE_LABELS = {
  user:     'la tua preferenza personale',
  project:  'il progetto attivo',
  lead:     'il lead di riferimento',
  tenant:   'lo studio',
  browser:  'il browser',
  system:   'il sistema',
};

export const CulturalPerspectivePanel = () => {
  const runtime = useLocaleRuntime();
  const [switching, setSwitching] = useState(null);
  const [err, setErr] = useState(null);

  const handleSelect = async (code) => {
    if (switching || code === runtime.localeCode) return;
    setSwitching(code); setErr(null);
    try {
      await runtime.setLocale(code);
    } catch (e) {
      setErr('Aggiornamento prospettiva non riuscito.');
    } finally {
      setSwitching(null);
    }
  };

  const supported = runtime.supported && runtime.supported.length
    ? runtime.supported
    : Object.keys(LOCALES_META);
  // Stable order: IT first, then US/GB/AE (the three English-but-distinct
  // markets), then continental EU.
  const orderedCodes = ['IT_IT', 'EN_US', 'EN_GB', 'EN_AE', 'DE_DE', 'FR_FR', 'ES_ES']
    .filter((c) => supported.includes(c));

  const sourceClean = (runtime.source || 'system').split(':')[0];
  const sourceLabel = SOURCE_LABELS[sourceClean] || sourceClean;

  return (
    <section data-testid="cultural-perspective-panel"
             data-locale-code={runtime.localeCode}
             className="mb-12">
      <header className="mb-6">
        <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">
          {runtime.copy('settings.cultural.kicker')}
        </p>
        <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] leading-tight mb-2"
            data-testid="cultural-perspective-title">
          {runtime.copy('settings.cultural.title')}
        </h2>
        <p className="text-[var(--bp-text-muted)] text-[13px] font-body max-w-2xl leading-relaxed">
          {runtime.copy('settings.cultural.body')}
        </p>
      </header>

      <div className="bp-card p-5 flex items-center gap-3 mb-5"
           data-testid="cultural-perspective-active">
        <Globe size={14} strokeWidth={1.6} className="text-[var(--bp-primary)]" />
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] font-body">
          {runtime.copy('settings.cultural.label.active')}
        </p>
        <p className="font-heading text-[16px] text-[var(--bp-text-primary)] tracking-tight">
          {LOCALES_META[runtime.localeCode]?.display} · <span className="text-[var(--bp-primary)]">{runtime.localeCode}</span>
        </p>
        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body">
          via {sourceLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3"
           data-testid="cultural-perspective-grid">
        {orderedCodes.map((code) => {
          const meta = LOCALES_META[code] || {};
          const isActive = runtime.localeCode === code;
          const isSwitching = switching === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => handleSelect(code)}
              disabled={isActive || !!switching}
              data-testid={`cultural-perspective-option-${code}`}
              className={`text-left p-5 border transition-all rounded-[var(--bp-radius-md)]
                          ${isActive
                            ? 'border-[var(--bp-primary)] bg-[var(--bp-primary-soft,rgba(196,164,107,0.08))] cursor-default'
                            : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)] hover:border-[var(--bp-border-strong)] cursor-pointer'}`}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <p className="text-[10.5px] uppercase tracking-[0.22em] text-[var(--bp-primary)] font-body">
                  {code}
                </p>
                {isSwitching ? (
                  <Loader2 size={11} className="animate-spin text-[var(--bp-primary)]" strokeWidth={1.6} />
                ) : isActive ? (
                  <Check size={11} className="text-[var(--bp-primary)]" strokeWidth={1.8} />
                ) : null}
              </div>
              <h3 className="font-heading text-[18px] font-light text-[var(--bp-text-primary)] leading-tight mb-2">
                {meta.display} <span className="text-[var(--bp-text-muted)]">· {meta.market}</span>
              </h3>
              <p className="text-[11.5px] uppercase tracking-[0.18em] text-[var(--bp-text-secondary)] font-body mb-2">
                {meta.register}
              </p>
              <p className="text-[12.5px] text-[var(--bp-text-muted)] font-body italic leading-relaxed">
                {meta.example}
              </p>
            </button>
          );
        })}
      </div>

      {err && (
        <p className="text-[12px] text-red-300 mt-3 font-body" data-testid="cultural-perspective-error">
          {err}
        </p>
      )}
    </section>
  );
};

export default CulturalPerspectivePanel;
