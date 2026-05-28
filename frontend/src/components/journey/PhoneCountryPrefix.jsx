/**
 * PhoneCountryPrefix · ITER167 Round 4 — Phone Country Prefix dropdown
 *
 * Step 3 of `/begin-journey`. NO free-text prefix. Country list curated
 * from the active public locales (the SAME source of truth that powers
 * `/admin/languages` via `publicLanguages()`). Preselect derives from
 * the current document locale.
 *
 * Emits on change:
 *   { country_code: 'IT', dial_code: '+39', flag: '🇮🇹', label: 'Italia' }
 *
 * The PARENT keeps the raw phone number; the normalized value
 * (`+39 0123 456 7890`) is computed at submit time.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { publicLanguages } from '../../site/content/languages';

// ── Country registry (DB-driven via languages.js) ─────────────────────
// Country / dial / flag mapping. Each region code MUST appear here for the
// language registry to render its country in the phone prefix dropdown.
// Source of truth: /admin/languages (LANGUAGE_REGISTRY entry.region + dial_code).
const COUNTRY_REGISTRY = {
  IT: { dial: '+39',  flag: '🇮🇹', label: 'Italia' },
  US: { dial: '+1',   flag: '🇺🇸', label: 'United States' },
  GB: { dial: '+44',  flag: '🇬🇧', label: 'United Kingdom' },
  FR: { dial: '+33',  flag: '🇫🇷', label: 'France' },
  DE: { dial: '+49',  flag: '🇩🇪', label: 'Deutschland' },
  ES: { dial: '+34',  flag: '🇪🇸', label: 'España' },
  AE: { dial: '+971', flag: '🇦🇪', label: 'United Arab Emirates' },
  CH: { dial: '+41',  flag: '🇨🇭', label: 'Schweiz' },
  AT: { dial: '+43',  flag: '🇦🇹', label: 'Österreich' },
  CN: { dial: '+86',  flag: '🇨🇳', label: '中国' },
  JP: { dial: '+81',  flag: '🇯🇵', label: '日本' },
};

/** Build the visible country list from the currently-enabled public locales.
 *  Each language entry carries an explicit `region` (ISO 3166-1 alpha-2)
 *  field. We map region → COUNTRY_REGISTRY entry for the visible row.
 *  Languages without a known region are silently skipped. */
function buildCountries() {
  const langs = publicLanguages();
  const out = [];
  const seen = new Set();
  for (const l of langs) {
    // Primary path: explicit region on the language entry
    let region = (l.region || '').toUpperCase();
    // Legacy path: derive from BCP-47 like 'en-US' → 'US'
    if (!region && typeof l.code === 'string' && l.code.includes('-')) {
      region = l.code.split('-')[1].toUpperCase();
    }
    const entry = COUNTRY_REGISTRY[region];
    if (!entry || seen.has(region)) continue;
    seen.add(region);
    // Prefer the dial_code from the language entry (DB-aligned) when present.
    const dial = l.dial_code || entry.dial;
    out.push({
      country_code: region,
      dial_code:    dial,
      flag:         entry.flag,
      label:        entry.label,
    });
  }
  // Always include Italia as a graceful default even if locale registry
  // didn't return it yet (avoids an empty dropdown during cold-boot).
  if (!seen.has('IT')) {
    out.unshift({ country_code: 'IT', dial_code: '+39', flag: '🇮🇹', label: 'Italia' });
  }
  return out;
}

/** Preselect the country from the document locale (fallback: IT). */
function inferDefault() {
  try {
    const docLocale = (document.documentElement.lang || 'it').toLowerCase();
    const region = (docLocale.split('-')[1] || '').toUpperCase();
    if (region && COUNTRY_REGISTRY[region]) return region;
    // Italian doc → Italia
    if (docLocale.startsWith('it')) return 'IT';
  } catch (_) {/* SSR / no DOM */}
  return 'IT';
}

export const PhoneCountryPrefix = ({ value, onChange, testid = 'bj-phone-prefix' }) => {
  const [open, setOpen] = useState(false);
  const [countries, setCountries] = useState(() => buildCountries());
  const ref = useRef(null);

  // Live re-read when /admin/languages saves new toggles
  useEffect(() => {
    const refresh = () => setCountries(buildCountries());
    window.addEventListener('mfd:languages:change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('mfd:languages:change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Initialise default value if parent hasn't provided one
  useEffect(() => {
    if (!value?.country_code && countries.length) {
      const defaultCC = inferDefault();
      const found = countries.find((c) => c.country_code === defaultCC) || countries[0];
      onChange?.(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length]);

  const current = useMemo(
    () => value || countries[0] || { dial_code: '+39', flag: '🇮🇹', country_code: 'IT', label: 'Italia' },
    [value, countries]
  );

  return (
    <div className="bj-phone-prefix" ref={ref} data-testid={testid}>
      <button
        type="button"
        className="bj-phone-prefix__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={`${testid}-trigger`}
      >
        <span className="bj-phone-prefix__flag" aria-hidden>{current.flag}</span>
        <span className="bj-phone-prefix__dial">{current.dial_code}</span>
        <ChevronDown size={14} strokeWidth={1.6} aria-hidden />
      </button>
      {open && (
        <ul className="bj-phone-prefix__menu" role="listbox" data-testid={`${testid}-menu`}>
          {countries.map((c) => (
            <li key={c.country_code} role="option" aria-selected={c.country_code === current.country_code}>
              <button
                type="button"
                className={`bj-phone-prefix__option ${c.country_code === current.country_code ? 'is-active' : ''}`}
                onClick={() => { onChange?.(c); setOpen(false); }}
                data-testid={`${testid}-option-${c.country_code}`}
              >
                <span className="bj-phone-prefix__flag" aria-hidden>{c.flag}</span>
                <span className="bj-phone-prefix__option-label">{c.label}</span>
                <span className="bj-phone-prefix__option-dial">{c.dial_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Normalize a phone number for storage/transport.
 *  Strips everything but digits and re-attaches the dial code.
 *  Example: ("+39", "0123 456-7890") → "+390123 4567890"
 *  Returns null if the local part is empty. */
export function normalizePhone(dial_code, local) {
  if (!local) return null;
  const digits = (local || '').replace(/\D/g, '');
  if (!digits) return null;
  return `${dial_code}${digits}`;
}

export default PhoneCountryPrefix;
