/**
 * MarketPills — cinematic Market Perspective™ rail.
 *
 * NOT a language switcher. A cultural repositioning rail.
 *
 * Phase 1 locale codes: IT_IT, EN_US, EN_GB, EN_AE, DE_DE, FR_FR, ES_ES.
 * EN_US ≠ EN_GB ≠ EN_AE — they share English but each is a fundamentally
 * different cultural positioning with its own vocabulary, focus areas,
 * forbidden patterns and CTA style.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Globe, Check, Loader2 } from 'lucide-react';
import api from '../../lib/api';

// Map: locale_code → market display label shown on the pill
const LOCALE_DISPLAY = {
  IT_IT: 'IT',
  EN_US: 'US',
  EN_GB: 'UK',
  EN_AE: 'UAE',
  DE_DE: 'DE',
  FR_FR: 'FR',
  ES_ES: 'ES',
};

export const MarketPills = ({
  proposalId,
  activeLocaleCode,
  activeMarket,
  onSwitched,
  testid = 'market-pills',
}) => {
  const [profiles, setProfiles] = useState([]);
  const [versions, setVersions] = useState([]);
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api.get('/api/locale-profiles'),
        api.get(`/api/proposals/${proposalId}/perspectives`),
      ]);
      setProfiles(a.data?.profiles || []);
      setVersions(b.data?.versions || []);
    } catch (e) { /* silent */ }
  }, [proposalId]);

  useEffect(() => { refresh(); }, [refresh]);

  const existingLocales = new Set(versions.map((v) => v.locale_code));

  const switchTo = async (code) => {
    if (switching) return;
    setSwitching(code); setError(null);
    try {
      await api.post(`/api/proposals/${proposalId}/perspective`, {
        locale_code: code, set_active: true,
      });
      await refresh();
      onSwitched?.(code);
    } catch (e) {
      setError('Re-composizione non riuscita. Riprova.');
    } finally { setSwitching(null); }
  };

  if (profiles.length === 0) return null;

  return (
    <section data-testid={testid} className="bp-card p-6">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-[10px] tracking-[0.32em] uppercase text-[var(--bp-primary)] font-body inline-flex items-center gap-2">
          <Globe size={11} strokeWidth={1.6} /> Market Perspective™
        </p>
        <p className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-subtle)] font-body">
          {versions.length} version{versions.length === 1 ? 'e' : 'i'} salvate
        </p>
      </div>
      <p className="text-[12.5px] text-[var(--bp-text-secondary)] font-body leading-relaxed mb-5 max-w-2xl">
        Riposizionamento culturale, non traduzione. UAE, UK e US condividono
        l'inglese ma sono tre posizionamenti culturali distinti — ciascuno con
        vocabolario, tono e framing d'investimento dedicati.
      </p>
      <div className="flex flex-wrap gap-2" data-testid={`${testid}-rail`}>
        {profiles.map((p) => {
          const code = p.locale_code;
          const isActive    = activeLocaleCode === code
            || (!activeLocaleCode && activeMarket === p.market);
          const isSwitching = switching === code;
          const hasVersion  = existingLocales.has(code);
          const display     = LOCALE_DISPLAY[code] || p.market;
          return (
            <button key={code}
                    onClick={() => switchTo(code)}
                    disabled={!!switching || isActive}
                    data-testid={`${testid}-${code}`}
                    title={`${p.display_name} — ${p.emotional_style}`}
                    className={`group relative inline-flex items-center gap-2 px-4 py-2.5
                                border transition-all text-left disabled:cursor-not-allowed
                                ${isActive
                                  ? 'border-[var(--bp-primary)] bg-[var(--bp-primary-soft,rgba(196,164,107,0.12))]'
                                  : hasVersion
                                    ? 'border-[var(--bp-border-strong)] bg-[var(--bp-surface-1)] hover:border-[var(--bp-primary)]'
                                    : 'border-[var(--bp-border)] bg-[var(--bp-surface-1)] hover:border-[var(--bp-border-strong)]'}`}>
              <span className="font-heading text-[12.5px] font-light tracking-[0.12em] text-[var(--bp-text-primary)]">
                {display} Perspective
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] font-body">
                {p.emotional_style}
              </span>
              {isSwitching ? (
                <Loader2 size={11} strokeWidth={1.6}
                         className="animate-spin text-[var(--bp-primary)]" />
              ) : isActive ? (
                <Check size={11} strokeWidth={1.6} className="text-[var(--bp-primary)]" />
              ) : hasVersion ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--bp-primary)]"
                      title="Versione disponibile" />
              ) : null}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[12px] text-red-300 font-body mt-3">{error}</p>}
      {switching && (
        <p className="text-[12px] text-[var(--bp-text-muted)] font-body italic mt-3">
          Riposiziono la narrativa per {LOCALE_DISPLAY[switching] || switching}…
        </p>
      )}
    </section>
  );
};
