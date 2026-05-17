/**
 * Locale-aware formatters — date, number, currency, relative time.
 * All consumers MUST pass a BCP-47 locale (use `toBcp47()` first if needed).
 * No hardcoded format strings: we delegate to `Intl.*` for native locale rules.
 */
import { toBcp47, PLATFORM_DEFAULT_LOCALE } from './engine';

/** Locale → ISO 4217 currency hint (used when caller doesn't specify). */
const LOCALE_CURRENCY_HINT = {
  'it-IT': 'EUR',
  'es-ES': 'EUR',
  'fr-FR': 'EUR',
  'de-DE': 'EUR',
  'en-US': 'USD',
  'en-GB': 'GBP',
  'en-AE': 'AED',
  'ar-AE': 'AED',
  'pt-BR': 'BRL',
  'es-MX': 'MXN',
};

export function defaultCurrencyForLocale(locale) {
  return LOCALE_CURRENCY_HINT[toBcp47(locale)] || 'EUR';
}

/** Absolute date (locale-aware, short by default). */
export function fmtDate(iso, locale = PLATFORM_DEFAULT_LOCALE, opts = {}) {
  if (!iso) return '—';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(toBcp47(locale), {
    day: '2-digit', month: 'short', year: 'numeric', ...opts,
  }).format(date);
}

/** Relative time ("3h ago", "il y a 3 h") via Intl.RelativeTimeFormat. */
export function fmtRelative(iso, locale = PLATFORM_DEFAULT_LOCALE) {
  if (!iso) return '—';
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(toBcp47(locale), { numeric: 'auto', style: 'short' });
  if (abs < 60_000)         return rtf.format(Math.round(diffMs / 1000),    'second');
  if (abs < 3_600_000)      return rtf.format(Math.round(diffMs / 60_000),  'minute');
  if (abs < 86_400_000)     return rtf.format(Math.round(diffMs / 3_600_000),'hour');
  if (abs < 2_592_000_000)  return rtf.format(Math.round(diffMs / 86_400_000),'day');
  if (abs < 31_536_000_000) return rtf.format(Math.round(diffMs / 2_592_000_000),'month');
  return rtf.format(Math.round(diffMs / 31_536_000_000), 'year');
}

/** Pure number with locale separators. */
export function fmtNumber(value, locale = PLATFORM_DEFAULT_LOCALE, opts = {}) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(toBcp47(locale), opts).format(Number(value));
}

/** Currency with locale rules + ISO 4217 hint (defaults via LOCALE_CURRENCY_HINT). */
export function fmtCurrency(value, locale = PLATFORM_DEFAULT_LOCALE, currency = null, opts = {}) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(toBcp47(locale), {
    style: 'currency',
    currency: currency || defaultCurrencyForLocale(locale),
    maximumFractionDigits: 0,
    ...opts,
  }).format(Number(value));
}
