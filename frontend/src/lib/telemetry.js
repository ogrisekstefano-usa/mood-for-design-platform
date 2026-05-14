/**
 * trackEvent — fire-and-forget product event logger.
 *
 *   Uses fetch (NOT the authenticated axios api client) so we can call it
 *   from unauthenticated routes like /review/ without triggering the 401
 *   redirect interceptor. Auth header is added when a session is available.
 *
 *   Failures are swallowed — telemetry must never affect the UX.
 *
 *   Usage:
 *     trackEvent('moodboard.template_applied', { template_id, page_count });
 */
const SESSION_KEY = 'mfd_telemetry_session';

const sessionId = () => {
  if (typeof window === 'undefined') return null;
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return null;
  }
};

export function trackEvent(eventType, payload = {}, opts = {}) {
  if (!eventType) return;
  const url = `${process.env.REACT_APP_BACKEND_URL || ''}/api/events/track`;
  const body = JSON.stringify({
    event_type: eventType,
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    payload,
    session_id: sessionId(),
  });
  const headers = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('mfd_session');
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.access_token) headers.Authorization = `Bearer ${s.access_token}`;
    }
  } catch { /* noop */ }
  // sendBeacon does not allow custom headers — fall back to fetch.
  fetch(url, { method: 'POST', headers, body, keepalive: true })
    .catch(() => { /* silent */ });
}
