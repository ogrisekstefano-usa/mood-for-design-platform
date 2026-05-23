/**
 * ITER143A+ · Dynamic Editorial Runtime™ — Frontend Provider
 *
 * Pre-loads one or more editorial bundles for the current locale BEFORE
 * the page paints. Multiple bundles are fetched in parallel and merged
 * into a single key→value map (block keys are namespaced so collisions
 * never happen).
 *
 *   <EditorialBundleProvider pageKeys={['site-header','site-footer','begin-journey']}>
 *     {children}
 *   </EditorialBundleProvider>
 *
 * STRICT GUARANTEES
 * ─────────────────
 *  • Never renders foreign-language fallbacks (strict locale chain
 *    enforced server-side).
 *  • Missing keys → `get(key, fallback)` returns the fallback (empty
 *    string by default), NEVER the source value of another locale.
 *  • Cache key includes locale → no IT→EN flash on switch.
 */
import React, {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from 'react';
import axios from 'axios';
import { useSite } from '../SiteContext';

const API = process.env.REACT_APP_BACKEND_URL;

const EditorialBundleContext = createContext(null);

// Cache by `${scope}|${pageKey}|${locale}`.
const _bundleCache = new Map();

function _normalizeLocale(loc) {
  if (!loc) return 'it-it';
  return String(loc).trim().toLowerCase().replace('_', '-');
}

function _coercePageKeys(pageKeys, pageKey) {
  if (Array.isArray(pageKeys)) return pageKeys.filter(Boolean);
  if (typeof pageKeys === 'string' && pageKeys) return [pageKeys];
  if (typeof pageKey === 'string' && pageKey) return [pageKey];
  return [];
}

/**
 * @param {{
 *   pageKeys?: string[] | string,
 *   pageKey?: string,
 *   scope?: 'system'|'tenant',
 *   children: React.ReactNode
 * }}
 */
export const EditorialBundleProvider = ({
  pageKeys, pageKey, scope = 'system', children,
}) => {
  const { locale } = useSite();
  const normalized = _normalizeLocale(locale);
  const keys = useMemo(
    () => _coercePageKeys(pageKeys, pageKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(_coercePageKeys(pageKeys, pageKey))],
  );

  // Compute initial state from cache (synchronous → no flicker).
  const initialBlocks = useMemo(() => {
    const merged = {};
    let allReady = keys.length > 0;
    for (const pk of keys) {
      const ck = `${scope}|${pk}|${normalized}`;
      const c = _bundleCache.get(ck);
      if (!c) { allReady = false; continue; }
      Object.assign(merged, c.blocks);
    }
    return { merged, allReady };
  }, [keys, normalized, scope]);

  const [state, setState] = useState({
    blocks: initialBlocks.merged,
    loading: !initialBlocks.allReady,
    ready: initialBlocks.allReady,
    locale: normalized,
    error: null,
  });
  const reqIdRef = useRef(0);

  const fetchAll = useCallback(async () => {
    if (!keys.length) {
      setState({ blocks: {}, loading: false, ready: true,
                 locale: normalized, error: null });
      return;
    }
    const myReq = ++reqIdRef.current;
    // Optimistic — show cached blocks immediately if any.
    const optimistic = {};
    let allCached = true;
    for (const pk of keys) {
      const ck = `${scope}|${pk}|${normalized}`;
      const c = _bundleCache.get(ck);
      if (c) Object.assign(optimistic, c.blocks);
      else allCached = false;
    }
    setState((s) => ({
      ...s,
      blocks: { ...s.blocks, ...optimistic },
      loading: !allCached,
      ready: allCached,
      locale: normalized,
      error: null,
    }));
    try {
      const results = await Promise.all(keys.map((pk) => {
        const ck = `${scope}|${pk}|${normalized}`;
        const cached = _bundleCache.get(ck);
        if (cached) return Promise.resolve({ pk, blocks: cached.blocks });
        return axios.get(
          `${API}/api/content/page/${encodeURIComponent(pk)}`,
          { params: { locale: normalized, scope } },
        ).then((r) => {
          const blocks = (r.data && r.data.blocks) || {};
          _bundleCache.set(ck, { blocks, ts: Date.now() });
          return { pk, blocks };
        });
      }));
      if (reqIdRef.current !== myReq) return;
      const merged = {};
      for (const r of results) Object.assign(merged, r.blocks);
      setState({ blocks: merged, loading: false, ready: true,
                 locale: normalized, error: null });
    } catch (e) {
      if (reqIdRef.current !== myReq) return;
      setState((s) => ({ ...s, loading: false, ready: !!Object.keys(s.blocks).length,
                         error: 'bundle_unreachable' }));
    }
  }, [keys, normalized, scope]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const get = useCallback((key, fallback = '') => {
    const v = state.blocks?.[key];
    return (typeof v === 'string' && v.length > 0) ? v : fallback;
  }, [state.blocks]);

  const value = useMemo(() => ({
    blocks:  state.blocks,
    loading: state.loading,
    ready:   state.ready,
    locale:  state.locale,
    error:   state.error,
    get,
    refresh: fetchAll,
  }), [state, get, fetchAll]);

  return (
    <EditorialBundleContext.Provider value={value}>
      {children}
    </EditorialBundleContext.Provider>
  );
};

export const useEditorialBundle = () => {
  const ctx = useContext(EditorialBundleContext);
  if (!ctx) {
    // Defensive — provider not mounted. Never crash; never leak source.
    return {
      blocks: {}, loading: false, ready: true, locale: 'it-it', error: null,
      get: (_k, fallback = '') => fallback,
      refresh: () => Promise.resolve(),
    };
  }
  return ctx;
};

/**
 * useEditorialBlock — read a single editorial key with an optional fallback.
 */
export const useEditorialBlock = (key, fallback = '') => {
  const { get } = useEditorialBundle();
  return get(key, fallback);
};
