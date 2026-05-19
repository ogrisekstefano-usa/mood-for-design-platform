/**
 * useMarketSignal — Lightweight signal hook for the Market Intelligence
 * Engine™. POSTs anonymous behavioral signals via the public events
 * endpoint. Privacy-by-design — never sends PII.
 *
 * Usage:
 *   const signal = useMarketSignal();
 *   useEffect(() => { signal('project_view', { resource_id: id }); }, [id]);
 *
 *   // Or as imperative call:
 *   <button onClick={() => signal('cta_open', { cta: 'consultation' })}>...
 *
 * Opt-out: set localStorage['mfd_signal_optout'] = '1' to disable.
 * The hook becomes a no-op without errors.
 */
import { useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const ENDPOINT = `${BACKEND_URL}/api/market-intelligence/events`;

// PII guard — same blocklist as the server, defense in depth.
const PII_KEYS = new Set([
  'email', 'phone', 'name', 'first_name', 'last_name', 'address',
  'ip', 'ip_address', 'lat', 'lng', 'latitude', 'longitude',
  'user_id', 'session_id', 'cookie', 'device_id', 'fingerprint',
]);

const stripPii = (obj) => {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (!PII_KEYS.has(k.toLowerCase())) out[k] = obj[k];
  });
  return out;
};

/**
 * @param {object} [opts]
 * @param {string} [opts.tenantId]       — fallback when not auto-detected
 * @param {string} [opts.marketCode]
 * @param {string} [opts.submarketCode]
 * @param {string} [opts.locale]
 */
export function useMarketSignal(opts = {}) {
  return useCallback(async (eventType, eventData = {}) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage?.getItem('mfd_signal_optout') === '1') {
        return; // opt-out: silent no-op
      }
      const tenantId = opts.tenantId
        || (typeof window !== 'undefined' && window.__MFD_TENANT_ID__)
        || null;
      if (!tenantId) return; // not yet bound to a tenant — skip

      const payload = {
        tenant_id:      tenantId,
        event_type:     eventType,
        market_code:    opts.marketCode || null,
        submarket_code: opts.submarketCode || null,
        locale_code:    opts.locale || (typeof navigator !== 'undefined' ? navigator.language : null),
        event_data:     stripPii(eventData),
      };

      // Use fetch with keepalive so signals fire even on page-unload.
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit',
      });
    } catch {
      // Fire-and-forget — never break visitor UX.
    }
  }, [opts.tenantId, opts.marketCode, opts.submarketCode, opts.locale]);
}

export default useMarketSignal;
