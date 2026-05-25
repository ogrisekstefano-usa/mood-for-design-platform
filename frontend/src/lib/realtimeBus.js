/**
 * realtimeBus.js — Sprint F · F1
 *
 * Singleton Supabase Realtime manager.
 * Editorial principles:
 *   - silenzioso · no console noise
 *   - cleanup robusto · ref-counted channels, no leak
 *   - tab-aware · pause/resume su visibilityState
 *   - dedup-friendly · le callback ricevono il payload nativo
 *     postgres_changes (commit_timestamp, eventType, new, old)
 *
 * Realtime non sostituisce mai il backend REST: il polling 15s
 * resta come safety net invisibile (gestito dal componente).
 */
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getRealtimeClient() {
  if (_client) return _client;
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _client;
}

// channel registry: key → { channel, listeners:Set, status }
const channels = new Map();

/**
 * Subscribe to postgres_changes on a given table.
 *
 * @param {Object} opts
 * @param {string} opts.key         unique channel key (e.g. `notif:<uid>`)
 * @param {string} opts.table       table name (public schema)
 * @param {'*'|'INSERT'|'UPDATE'|'DELETE'} [opts.event]
 * @param {string} [opts.filter]    e.g. "recipient_user_id=eq.<uuid>"
 * @param {(payload)=>void} opts.onPayload
 * @param {(status:string)=>void} [opts.onStatus]
 * @returns {() => void} unsubscribe
 */
export function subscribe({ key, table, event = '*', filter = '', onPayload, onStatus }) {
  const client = getRealtimeClient();
  if (!client || !key || !table || typeof onPayload !== 'function') {
    return () => {};
  }

  let entry = channels.get(key);
  if (!entry) {
    const channel = client.channel(key, { config: { broadcast: { ack: false }, presence: { key: '' } } });
    const opts = { event, schema: 'public', table };
    if (filter) opts.filter = filter;

    channel.on('postgres_changes', opts, (payload) => {
      const e = channels.get(key);
      if (!e) return;
      e.listeners.forEach(cb => {
        try { cb(payload); } catch { /* silent */ }
      });
    });

    channel.subscribe((status) => {
      const e = channels.get(key);
      if (!e) return;
      e.status = status;
      e.statusListeners.forEach(cb => {
        try { cb(status); } catch { /* silent */ }
      });
    });

    entry = {
      channel,
      listeners: new Set(),
      statusListeners: new Set(),
      status: 'CONNECTING',
    };
    channels.set(key, entry);
  }

  entry.listeners.add(onPayload);
  if (onStatus) entry.statusListeners.add(onStatus);

  return () => {
    const e = channels.get(key);
    if (!e) return;
    e.listeners.delete(onPayload);
    if (onStatus) e.statusListeners.delete(onStatus);
    if (e.listeners.size === 0) {
      try { client.removeChannel(e.channel); } catch { /* silent */ }
      channels.delete(key);
    }
  };
}

export function isTabVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}
