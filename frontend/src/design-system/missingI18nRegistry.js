/**
 * MissingI18nRegistry — Sprint HARDENING-I18N-GUARD™ (iter117).
 *
 * Module-level singleton that records every translation lookup that fell
 * through to a fallback (or to the bare key itself). Powers the
 * `Missing translations · N` row in the GovernanceOverlay LiveQA panel.
 *
 * Recorded fields per missing key:
 *   - key:           dotted i18n key, e.g. 'dashboard.pulse.eyebrow'
 *   - locale:        active locale at the time of lookup
 *   - fallback_src:  which dictionary actually served the value (if any)
 *                    — 'frontend-static' | 'backend-fallback' | 'key-literal'
 *   - page:          window.location.pathname when the miss happened
 *   - count:         number of times this missing combo was hit
 *
 * No mutation, no side-effects, no PII. The registry is purely observational
 * and lives only in browser memory.
 */
const _missing = new Map();
let _listeners = new Set();

const _emit = () => {
  try { _listeners.forEach((fn) => fn(_missing.size)); } catch (_) { /* noop */ }
};

export function recordMissing({ key, locale, fallbackSrc = 'key-literal' }) {
  if (!key) return;
  // The key literally returned by t() when nothing else matched is the
  // canonical signal of "missing translation". We don't record cases where
  // the frontend static dictionary did serve a value.
  const sig = `${locale}|${key}`;
  const prev = _missing.get(sig);
  if (prev) {
    prev.count += 1;
    prev.last_seen = Date.now();
  } else {
    _missing.set(sig, {
      key,
      locale,
      fallback_src: fallbackSrc,
      page: (typeof window !== 'undefined' && window.location?.pathname) || '/',
      first_seen: Date.now(),
      last_seen: Date.now(),
      count: 1,
      is_taxonomy: key.startsWith('taxonomy.') || fallbackSrc === 'taxonomy-missing',
    });
    _emit();
  }
}

export function getMissing() {
  return Array.from(_missing.values()).sort((a, b) => b.count - a.count);
}

export function getMissingCount() {
  return _missing.size;
}

/** Sprint JOURNEY-TAXONOMY-I18N · count of missing TAXONOMY keys only.
 *  Surfaced as a separate row in the GovernanceOverlay so the editorial
 *  vocabulary gaps are visible distinctly from generic i18n gaps. */
export function getMissingTaxonomyCount() {
  let n = 0;
  for (const v of _missing.values()) {
    if (v.is_taxonomy) n += 1;
  }
  return n;
}

export function clearMissing() {
  _missing.clear();
  _emit();
}

export function subscribeMissing(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
