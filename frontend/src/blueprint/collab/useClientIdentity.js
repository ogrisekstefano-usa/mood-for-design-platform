/**
 * useClientIdentity — frictionless luxury identity capture for unauth clients
 * inside Review Mode. The first time the client tries to comment/upload we
 * ask for name + email, then persist in localStorage so subsequent actions
 * are completely silent.
 *
 *   shape: { name, email } or null
 *   key:   mfd_client_identity:<entity_id>
 *
 * Per-entity storage avoids cross-project leakage: a client commenting on a
 * different moodboard re-introduces themselves (rare but correct).
 */
import { useCallback, useEffect, useState } from 'react';

const keyFor = (entityId) => `mfd_client_identity:${entityId || 'default'}`;

export default function useClientIdentity(entityId) {
  const [identity, setIdentity] = useState(null);
  const [askingFor, setAskingFor] = useState(null);   // callback to run after capture

  useEffect(() => {
    if (typeof window === 'undefined' || !entityId) return;
    try {
      const raw = localStorage.getItem(keyFor(entityId));
      if (raw) setIdentity(JSON.parse(raw));
    } catch {
      // ignore parse errors — treat as unknown
    }
  }, [entityId]);

  const save = useCallback((name, email) => {
    const next = { name: name?.trim(), email: email?.trim()?.toLowerCase() };
    setIdentity(next);
    try {
      localStorage.setItem(keyFor(entityId), JSON.stringify(next));
    } catch {
      // localStorage may be disabled — proceed in-memory only.
    }
  }, [entityId]);

  // Higher-order helper: call `withIdentity(cb)` from any action. If identity
  // is already known the callback fires immediately with it; otherwise the
  // identity modal opens and the callback fires AFTER the user submits.
  const withIdentity = useCallback((cb) => {
    if (identity?.name && identity?.email) {
      cb(identity);
      return;
    }
    setAskingFor(() => cb);
  }, [identity]);

  const completeAsk = useCallback((name, email) => {
    save(name, email);
    const next = { name: name?.trim(), email: email?.trim()?.toLowerCase() };
    if (askingFor) {
      const fn = askingFor;
      setAskingFor(null);
      fn(next);
    }
  }, [askingFor, save]);

  const cancelAsk = useCallback(() => setAskingFor(null), []);

  const forget = useCallback(() => {
    setIdentity(null);
    try { localStorage.removeItem(keyFor(entityId)); } catch { /* noop */ }
  }, [entityId]);

  return { identity, withIdentity, isAsking: !!askingFor,
           completeAsk, cancelAsk, save, forget };
}
