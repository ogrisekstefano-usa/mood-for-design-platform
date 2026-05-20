import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const STORAGE_KEY = 'mfd_session';

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

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
      const isPublicSurface =
        localePrefix ||
        p === '/' ||
        p === '/auth/login' ||
        p.startsWith('/auth/') ||
        p === '/projects' ||
        p.startsWith('/projects/') ||
        p === '/professionals' ||
        p === '/platform' ||
        p === '/start-project' ||
        p === '/begin-journey' ||
        p.startsWith('/journey/welcome/') ||
        p === '/magazine' ||
        p.startsWith('/magazine/') ||
        p.startsWith('/onboarding/') ||
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
