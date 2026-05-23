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
const CACHE_PREFIX = 'mfd_storefront_cache_v2_';

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
 * Resolve a locale-keyed value with the **strict, anti-leak** chain.
 *
 * ITER143A · LANGUAGE GOVERNANCE HARDENING™
 *   • Italian is NEVER inserted into a non-Italian chain.
 *   • Fallback always terminates at English (en-US) — never cross-language.
 *   • Same-family siblings honoured (en-AE → en-GB → en-US, fr-CA → fr-FR).
 *   • Supports BOTH BCP-47 keys (`en-US`) and legacy base keys (`en`,`it`,`fr`).
 */
function _strictFallback(locale) {
  const target = (locale || 'en-US').toLowerCase();
  const lang = target.split('-')[0];
  const chain = [target];
  // Same-language regional siblings
  if (lang === 'en') {
    if (target !== 'en-gb') chain.push('en-gb');
    if (target !== 'en-us') chain.push('en-us');
  } else if (lang === 'es' && target !== 'es-es') {
    chain.push('es-es');
  } else if (lang === 'fr' && target !== 'fr-fr') {
    chain.push('fr-fr');
  } else if (lang === 'de' && target !== 'de-de') {
    chain.push('de-de');
  } else if (lang === 'it' && target !== 'it-it') {
    chain.push('it-it');
  }
  // Legacy base-code (used by professionals.js / homepage.js legacy bags)
  if (!chain.includes(lang)) chain.push(lang);
  // Italian-only chains keep IT; all others jump to EN safety net.
  if (lang === 'it') {
    // it → keep 'en-us' as universal last resort
    chain.push('en-us', 'en');
  } else {
    chain.push('en-us', 'en-gb', 'en');
  }
  chain.push('_default');
  return chain;
}

export function pickContent(bag, locale) {
  if (bag == null) return '';
  if (typeof bag !== 'object') return bag;
  const chain = _strictFallback(locale);
  // First, exact-match probe (case-preserving for BCP-47 keys like 'en-US').
  for (const code of chain) {
    if (bag[code] != null && bag[code] !== '') return bag[code];
    // Case-insensitive variant
    const upper = code.replace(/-(.+)$/, (_, r) => `-${r.toUpperCase()}`);
    if (bag[upper] != null && bag[upper] !== '') return bag[upper];
  }
  return '';
}

/**
 * Helper: get a CMS-resolved value with fallback to a legacy JS-config path.
 * Same strict chain as `pickContent` — never leaks Italian into a non-IT UI.
 *
 * @example getOrFallback(content.store_hero, locale, 'headline', fallback.hero.headline)
 */
export function getOrFallback(sectionBag, locale, field, fallbackBag) {
  const chain = _strictFallback(locale);
  if (sectionBag) {
    for (const code of chain) {
      const upper = code.replace(/-(.+)$/, (_, r) => `-${r.toUpperCase()}`);
      const localeBag = sectionBag[code] || sectionBag[upper];
      if (localeBag && localeBag[field] != null && localeBag[field] !== '') {
        return localeBag[field];
      }
    }
    const def = sectionBag._default;
    if (def && def[field] != null && def[field] !== '') return def[field];
  }
  if (fallbackBag) {
    if (typeof fallbackBag === 'object' && fallbackBag !== null) {
      for (const code of chain) {
        if (fallbackBag[code] != null && fallbackBag[code] !== '') return fallbackBag[code];
      }
      return '';   // strict: NEVER drop into cross-language random pick
    }
    return fallbackBag;
  }
  return '';
}
