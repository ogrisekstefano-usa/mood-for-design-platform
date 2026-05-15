/**
 * useStorefrontContent — Hook for public-site components to read CMS content.
 *
 * Behavior:
 *   1. On mount, fetches `/api/storefront/public/:tenant/:page_key`
 *   2. If a published page exists, returns its sections + merged content
 *   3. If NOT (no DB content yet, or page is draft), falls back to the legacy
 *      JS config passed as `fallback` so the public site keeps rendering.
 *   4. SWR-style: stale-while-revalidate via localStorage cache + background refetch.
 *
 * Returns:
 *   {
 *     loading,        // bool
 *     hasDbContent,   // bool — true if a published DB page was loaded
 *     page,           // raw DB page (with sections[]) or null
 *     content,        // SECTION-KEY-INDEXED CMS data for easy access:
 *                     //   { store_hero: { it: {...}, en-US: {...}, ... }, dual_cta: {...} }
 *     fallback,       // legacy JS config (passed in) — always present
 *   }
 */
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const CACHE_PREFIX = 'mfd_storefront_cache_';

const sectionsByType = (sections = []) => {
  const out = {};
  for (const s of sections) {
    out[s.section_type] = {
      ...s.locale_content,
      _settings: s.settings || {},
      _visible:  s.visible,
      _id:       s.id,
      _order:    s.sort_order,
    };
  }
  return out;
};

export function useStorefrontContent(tenantSlug, pageKey, fallback = null) {
  const [state, setState] = useState({
    loading: true,
    hasDbContent: false,
    page: null,
    content: {},
    fallback,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!tenantSlug || !pageKey) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // SWR — try cache first
    const cacheKey = `${CACHE_PREFIX}${tenantSlug}_${pageKey}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.page) {
        setState({
          loading: false,
          hasDbContent: true,
          page: cached.page,
          content: sectionsByType(cached.page.sections),
          fallback,
        });
      }
    } catch (_) {}

    // Always refetch in background
    axios.get(`${BACKEND_URL}/api/storefront/public/${tenantSlug}/pages/${pageKey}`)
      .then((r) => {
        if (!mountedRef.current) return;
        const { page, status } = r.data || {};
        if (page && status === 'ok') {
          try { localStorage.setItem(cacheKey, JSON.stringify({ page })); } catch (_) {}
          setState({
            loading: false,
            hasDbContent: true,
            page,
            content: sectionsByType(page.sections),
            fallback,
          });
        } else {
          setState({ loading: false, hasDbContent: false, page: null, content: {}, fallback });
        }
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setState({ loading: false, hasDbContent: false, page: null, content: {}, fallback });
      });
  }, [tenantSlug, pageKey, fallback]);

  return state;
}

/**
 * Resolve a locale-keyed value with the unified fallback chain.
 * Use ONLY for content that comes from the CMS (use the existing pick() for legacy bags).
 */
export function pickContent(bag, locale, fallbackChain = ['it', 'en-US', 'en-GB', 'fr', 'de', 'es']) {
  if (bag == null) return '';
  if (typeof bag !== 'object') return bag;
  const chain = [locale, ...fallbackChain, '_default'];
  for (const code of chain) {
    if (bag[code] != null && bag[code] !== '') return bag[code];
  }
  return '';
}

/**
 * Helper: get a CMS-resolved value with fallback to a legacy JS-config path.
 * @example getOrFallback(content.store_hero, locale, 'headline', fallback.hero.headline)
 */
export function getOrFallback(sectionBag, locale, field, fallbackBag) {
  if (sectionBag) {
    // sectionBag = { _default, it, en-US, ... }; per-locale fields like { headline, sub }
    const localeBag = sectionBag[locale];
    if (localeBag && localeBag[field] != null && localeBag[field] !== '') return localeBag[field];
    const def = sectionBag._default;
    if (def && def[field] != null && def[field] !== '') return def[field];
    // last resort — any other locale
    for (const k of Object.keys(sectionBag)) {
      if (k.startsWith('_')) continue;
      if (sectionBag[k]?.[field]) return sectionBag[k][field];
    }
  }
  // Fallback to legacy
  if (fallbackBag) {
    if (typeof fallbackBag === 'object' && fallbackBag !== null) {
      // legacy uses simple language codes (it/en/fr/de/es)
      const legacy = locale.split('-')[0];
      if (fallbackBag[legacy] != null) return fallbackBag[legacy];
      if (fallbackBag.en != null) return fallbackBag.en;
      if (fallbackBag.it != null) return fallbackBag.it;
    }
    return fallbackBag;
  }
  return '';
}
