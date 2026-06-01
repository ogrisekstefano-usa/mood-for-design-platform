/**
 * Shared auth header helper.
 *
 * ITER185.P1 · single source of truth for token retrieval to prevent
 * the auth-localStorage-key drift bug (4 components had divergent
 * implementations before this util).
 *
 * Token is stored as JSON in localStorage under key 'mfd_session'.
 * Legacy 'token' fallback retained for older code paths.
 */
const STORAGE_KEY = 'mfd_session';

export function getAuthToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.access_token) return s.access_token;
    }
  } catch (_) {}
  return localStorage.getItem('token') || null;
}

export function getAuthHeader() {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
