/**
 * usePublicBrand — anonymous hook fetching tenant brand + nav for the
 * public storefront shell. Single call, SWR-cached in memory + localStorage
 * so the header doesn't flash on every nav.
 *
 * Endpoint: GET /api/storefront/public/{slug}/brand
 *
 * Returns:
 *   {
 *     loading,
 *     brand:  { name, tagline, primary_logo_url, monochrome_logo_url },
 *     nav:    { main_links: [...], show_login, show_register, login_href, register_href },
 *   }
 */
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const CACHE_PREFIX = 'mfd_public_brand_';

export function usePublicBrand(tenantSlug) {
  const [state, setState] = useState({ loading: true, brand: null, nav: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!tenantSlug) {
      setState({ loading: false, brand: null, nav: null });
      return;
    }
    const cacheKey = `${CACHE_PREFIX}${tenantSlug}`;
    // 1. Serve from cache first (stale-while-revalidate)
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.brand) {
        setState({ loading: false, brand: cached.brand, nav: cached.nav });
      }
    } catch (_) {}
    // 2. Refetch in background
    axios.get(`${BACKEND_URL}/api/storefront/public/${tenantSlug}/brand`)
      .then((r) => {
        if (!mounted.current) return;
        const { brand, nav } = r.data || {};
        try { localStorage.setItem(cacheKey, JSON.stringify({ brand, nav })); } catch (_) {}
        setState({ loading: false, brand, nav });
      })
      .catch(() => {
        if (!mounted.current) return;
        setState((s) => ({ ...s, loading: false }));
      });
  }, [tenantSlug]);

  return state;
}

export default usePublicBrand;
