/**
 * useLicense — shared license/usage state for plan-aware UI.
 *
 * One fetch on mount + manual refresh + cross-page sync via window event.
 * Pages call `refresh()` after any mutation that changes usage (create /
 * delete a project, moodboard, domain, asset upload).
 *
 * The shape mirrors `/api/license`:
 *   {
 *     plan_key, plan_label, subscription_status,
 *     limits: { max_users, max_projects, max_moodboards, max_storage_gb,
 *               max_domains, max_ai_credits },
 *     usage:  { users, projects, moodboards, storage_gb, storage_bytes,
 *               domains, ai_credits_used },
 *     enabled_modules: [...]
 *   }
 *
 * The hook also exposes a small `helpers` bag with `capacityFor(resource)`
 * which returns `{ current, limit, atCap, nearCap, unlimited, pct }` so
 * pages don't redo the math.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';

const REFRESH_EVENT = 'mfd:license:refresh';

// Module-level cache — multiple pages mounted at once share the same data.
let cache = null;
let inflight = null;

async function fetchLicense({ force = false } = {}) {
  if (cache && !force) return cache;
  if (inflight) return inflight;
  inflight = api.get('/api/license')
    .then((r) => { cache = r.data; return cache; })
    .catch(() => { cache = null; return null; })
    .finally(() => { inflight = null; });
  return inflight;
}

export function refreshLicense() {
  cache = null;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function useLicense() {
  const [license, setLicense] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  const load = useCallback(async ({ force = false } = {}) => {
    setLoading(true);
    const data = await fetchLicense({ force });
    setLicense(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onRefresh = () => load({ force: true });
    window.addEventListener(REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh);
  }, [load]);

  const refresh = useCallback(() => load({ force: true }), [load]);

  const capacityFor = useCallback((resource) => {
    if (!license) return { current: 0, limit: null, atCap: false, nearCap: false, unlimited: true, pct: 0 };
    const limits = license.limits || {};
    const usage  = license.usage  || {};
    // map resource → (limitKey, usageKey)
    const map = {
      users:      ['max_users',      'users'],
      projects:   ['max_projects',   'projects'],
      moodboards: ['max_moodboards', 'moodboards'],
      storage_gb: ['max_storage_gb', 'storage_gb'],
      domains:    ['max_domains',    'domains'],
      ai_credits: ['max_ai_credits', 'ai_credits_used'],
    };
    const [lk, uk] = map[resource] || [];
    const limit   = lk ? limits[lk] : null;
    const current = uk ? (usage[uk] || 0) : 0;
    const unlimited = limit == null;
    const pct = unlimited ? 0 : Math.min(100, Math.round((current / Math.max(limit, 1)) * 100));
    return {
      current, limit, unlimited, pct,
      atCap:   !unlimited && current >= limit,
      nearCap: !unlimited && pct >= 80 && pct < 100,
    };
  }, [license]);

  return { license, loading, refresh, capacityFor };
}
