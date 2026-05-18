/**
 * usePublicBrand — anonymous hook fetching tenant brand + nav for the
 * public storefront shell. Locale-aware so Brand Studio multilingue values
 * resolve server-side for the active market.
 *
 * Endpoint: GET /api/storefront/public/{slug}/brand?locale_code=<bcp47>
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { toBcp47Storefront } from './localeBcp47';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function usePublicBrand(tenantSlug, locale = 'it-IT') {
  const [state, setState] = useState({ loading: true, brand: null, nav: null });

  useEffect(() => {
    if (!tenantSlug) {
      setState({ loading: false, brand: null, nav: null });
      return;
    }
    let alive = true;
    const bcp = toBcp47Storefront(locale);
    axios.get(`${BACKEND_URL}/api/storefront/public/${tenantSlug}/brand?locale_code=${encodeURIComponent(bcp)}`)
      .then((r) => {
        if (!alive) return;
        const { brand, nav } = r.data || {};
        setState({ loading: false, brand, nav });
      })
      .catch(() => {
        if (!alive) return;
        setState((s) => ({ ...s, loading: false }));
      });
    return () => { alive = false; };
  }, [tenantSlug, locale]);

  return state;
}

export default usePublicBrand;
