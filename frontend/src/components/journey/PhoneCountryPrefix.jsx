/**
 * PhoneCountryPrefix · ITER168 Hotfix B — Global ISO 3166 dial codes.
 *
 * ARCHITECTURAL SEPARATION (post-hotfix):
 *   • PhoneCountryPrefix     → /api/platform/phone-dial-codes (FULL world list)
 *   • CountryLanguageSelector → /admin/languages (active markets only)
 *
 * A client living in Milan may have a Japanese phone number (+81). We must
 * NEVER restrict the phone prefix to the tenant's active markets.
 *
 * Features:
 *   - Fetch full list from API on mount (196+ countries)
 *   - Locale-aware labels (it/en/fr/de/es)
 *   - Free-text search (country name, ISO code, dial, aliases)
 *   - Preselect default from current document locale (heuristic, not enforced)
 *   - Emits: { country_code, dial_code, flag, label }
 *
 * The PARENT keeps the raw phone number; the normalized value
 * (`+390123456789`) is computed at submit time via `normalizePhone()`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import api from '../../lib/api';

const FALLBACK_DEFAULT = {
  country_code: 'IT', dial_code: '+39', flag: '🇮🇹', label: 'Italia',
};

/** Try to read the current UI locale (it/en/fr/de/es). */
function currentLocale() {
  try {
    const ls = (localStorage.getItem('mfd_locale') || '').toLowerCase();
    if (ls) return ls.split('-')[0];
    const html = (document.documentElement.lang || '').toLowerCase();
    if (html) return html.split('-')[0];
  } catch (_) { /* SSR */ }
  return 'it';
}

/** Heuristic default ISO2 from document locale. */
function inferDefaultISO() {
  try {
    const ls = (localStorage.getItem('mfd_locale') || '').toLowerCase();
    if (ls) {
      const parts = ls.split('-');
      // BCP-47 like 'en-US' → 'US'
      if (parts[1]) return parts[1].toUpperCase();
      const base = parts[0];
      // Base-only locale: best-effort map
      const baseToISO = { it: 'IT', fr: 'FR', de: 'DE', es: 'ES', ar: 'AE' };
      if (baseToISO[base]) return baseToISO[base];
    }
  } catch (_) { /* noop */ }
  return 'IT';
}

export const PhoneCountryPrefix = ({ value, onChange, testid = 'bj-phone-prefix' }) => {
  const [open, setOpen]           = useState(false);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState('');
  const ref      = useRef(null);
  const searchRef = useRef(null);

  // ── Initial fetch ─────────────────────────────────────────────────
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const locale = currentLocale();
    api.get(`/api/platform/phone-dial-codes?locale=${locale}`)
      .then((r) => {
        if (cancel) return;
        const list = (r.data?.codes || []).map((c) => ({
          country_code: c.iso2,
          dial_code:    c.dial_code,
          flag:         c.flag || '',
          label:        c.label,
          region:       c.region,
          priority:     c.priority,
        }));
        setCountries(list);
        setLoading(false);
      })
      .catch(() => { if (!cancel) { setCountries([]); setLoading(false); } });
    return () => { cancel = true; };
  }, []);

  // ── Default selection once list arrives ──────────────────────────
  useEffect(() => {
    if (!value?.country_code && countries.length) {
      const defaultCC = inferDefaultISO();
      const found = countries.find((c) => c.country_code === defaultCC) || countries[0];
      onChange?.(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries.length]);

  // ── Close on outside click ───────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQ('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // ── Auto-focus search on open ────────────────────────────────────
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Filtered view ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter((c) => {
      const hay = `${c.country_code} ${c.label} ${c.dial_code}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [countries, q]);

  const current = useMemo(
    () => value || countries[0] || FALLBACK_DEFAULT,
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
        aria-busy={loading || undefined}
        data-testid={`${testid}-trigger`}
        disabled={loading}
      >
        <span className="bj-phone-prefix__flag" aria-hidden>{current.flag}</span>
        <span className="bj-phone-prefix__dial">{current.dial_code}</span>
        <ChevronDown size={14} strokeWidth={1.6} aria-hidden />
      </button>
      {open && (
        <div
          className="bj-phone-prefix__menu"
          role="listbox"
          data-testid={`${testid}-menu`}
        >
          <div className="bj-phone-prefix__search-wrap">
            <Search size={14} strokeWidth={1.6} aria-hidden
                    className="bj-phone-prefix__search-ic" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Cerca paese o prefisso…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bj-phone-prefix__search"
              data-testid={`${testid}-search`}
              autoComplete="off"
            />
          </div>
          <ul className="bj-phone-prefix__list" role="presentation">
            {filtered.length === 0 && (
              <li className="bj-phone-prefix__empty">Nessun paese trovato</li>
            )}
            {filtered.map((c) => (
              <li key={c.country_code} role="option"
                  aria-selected={c.country_code === current.country_code}>
                <button
                  type="button"
                  className={`bj-phone-prefix__option ${
                    c.country_code === current.country_code ? 'is-active' : ''}`}
                  onClick={() => {
                    onChange?.(c);
                    setOpen(false);
                    setQ('');
                  }}
                  data-testid={`${testid}-option-${c.country_code}`}
                >
                  <span className="bj-phone-prefix__flag" aria-hidden>{c.flag}</span>
                  <span className="bj-phone-prefix__option-label">{c.label}</span>
                  <span className="bj-phone-prefix__option-dial">{c.dial_code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/** Normalize a phone number for storage/transport.
 *  Strips everything but digits and re-attaches the dial code.
 *  Example: ("+39", "0123 456-7890") → "+3901234567890"
 *  Returns null if the local part is empty. */
export function normalizePhone(dial_code, local) {
  if (!local) return null;
  const digits = (local || '').replace(/\D/g, '');
  if (!digits) return null;
  return `${dial_code}${digits}`;
}

export default PhoneCountryPrefix;
