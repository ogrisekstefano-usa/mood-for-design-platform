import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const STORAGE_KEY = 'mfd_session';

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

/**
 * ITER154 · Request deduplication for GET calls.
 *
 * Wraps `api.get` so duplicate GETs to the same URL+config within
 * `_DEDUPE_TTL_MS` SHARE the in-flight promise. Safer than touching
 * the axios adapter (which broke routing on first attempt).
 *
 * Audit before fix on /dashboard:
 *   /api/profile/me × 4 · /api/atelier/dashboard/config × 2
 *   /api/auth/me × 2 · /api/branding × 2 · /api/blueprint/i18n × 4
 *   → 17 duplicates, ~10s wasted.
 */
const _inflight = new Map();
const _cache = new Map();      // url → { data, until }  for short TTL re-use
const _DEDUPE_TTL_MS = 1500;
const _SHORT_CACHE_MS = 3000;  // serve same response if requested again within 3s

function _dedupeKey(url, config) {
  const cfg = config || {};
  const tenant = cfg.headers?.['X-Tenant-Override'] || '';
  const lang = cfg.headers?.['Accept-Language'] || '';
  const params = cfg.params ? JSON.stringify(cfg.params) : '';
  const cleanUrl = String(url || '').replace(/([?&])(_t|bust|cb|nocache)=[^&]*/g, '$1');
  return `${cleanUrl}|${params}|${tenant}|${lang}`;
}

const _origGet = api.get.bind(api);
api.get = function dedupedGet(url, config) {
  const key = _dedupeKey(url, config);

  // Hot cache hit — return the previous successful response (cloned)
  const cached = _cache.get(key);
  if (cached && cached.until > Date.now()) {
    return Promise.resolve(cached.response);
  }

  // In-flight share
  const existing = _inflight.get(key);
  if (existing) return existing;

  const p = _origGet(url, config).then((response) => {
    _cache.set(key, { response, until: Date.now() + _SHORT_CACHE_MS });
    return response;
  }).finally(() => {
    setTimeout(() => _inflight.delete(key), _DEDUPE_TTL_MS);
  });
  _inflight.set(key, p);
  return p;
};

/** Invalidate the short TTL cache for a URL pattern (or all). */
api.invalidate = function (pattern) {
  if (!pattern) { _cache.clear(); return; }
  for (const k of _cache.keys()) {
    if (k.startsWith(pattern)) _cache.delete(k);
  }
};

api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.access_token) config.headers.Authorization = `Bearer ${s.access_token}`;
    }
    // Tenant impersonation header (super_admin only — backend enforces role check)
    const impersonate = sessionStorage.getItem('mfd_impersonate_tenant');
    if (impersonate) config.headers['X-Tenant-Override'] = impersonate;
    // ITER132 · Always send the active locale so the backend can apply
    // ALE-on-read on editorial / DB-seeded content before serving the payload.
    const locale = localStorage.getItem('mfd_locale') || 'it-IT';
    if (locale && !config.headers['Accept-Language']) {
      config.headers['Accept-Language'] = locale;
    }
  } catch (_) {}
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // Skip auth-redirect on public surfaces (share / presentation / forms /
      // tenant public pages) so a transient 401 never tears a visitor out of
      // the read-only client experience.
      const p = window.location.pathname || '';
      // Locale-prefixed public storefront (Phase R-MARKET-1B): /it-IT, /en-US, …
      const localePrefix = /^\/[a-z]{2}-[A-Z]{2}(\/|$)/.test(p);
      // ── PUBLIC EXPERIENCE surfaces — NEVER force /auth/login on 401.
      //    These are narrative / transitional pages that belong to the
      //    Design Journey™ public layer (concierge UX, not app UX).
      //    A 401 from a background provider call (Blueprint, Tenant, i18n)
      //    must NEVER tear the visitor out of the cinematic experience.
      const isPublicSurface =
        localePrefix ||
        p === '/' ||
        p === '/auth/login' ||
        p.startsWith('/auth/') ||                  // /auth/callback /auth/recovery /auth/reset-password …
        p === '/projects' ||
        p.startsWith('/projects/') ||
        p === '/professionals' ||
        p === '/platform' ||
        p === '/start-project' ||
        p === '/begin-journey' ||
        p === '/begin-partnership' ||
        p.startsWith('/journey/welcome/') ||
        p === '/journey/preparing' ||              // ITER166 · cinematic post-onboarding screen
        p.startsWith('/journey/preparing') ||      // safety: querystring variants
        p === '/magazine' ||
        p.startsWith('/magazine/') ||
        p.startsWith('/onboarding/') ||
        p.startsWith('/preview/') ||               // Client Preview Link™ public surface
        p.startsWith('/presentation/') ||
        p.startsWith('/moodboard/share/') ||
        p.startsWith('/review/') ||
        p.startsWith('/f/') ||
        p.startsWith('/form/');
      if (!isPublicSurface) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(err);
  }
);

export const formatError = (e) => {
  const detail = e?.response?.data?.detail;
  if (!detail) return e?.message || 'An error occurred';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || String(d)).join(' ');
  return String(detail);
};

export default api;
