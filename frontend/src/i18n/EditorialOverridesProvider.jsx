/**
 * EditorialOverridesProvider — ITER155.R2 · Runtime Editorial Overrides™
 *
 * Boots the in-memory runtime override registry consumed by `useT()`.
 *
 * Resolution order in `pickString()`:
 *   1. tenant runtime override (this provider)  ← NEW
 *   2. requested locale static JSON
 *   3. fallback locale chain
 *   4. visible `⟦key⟧` token (strict mode) or bare key
 *
 * Invalidation: components fire `mfd:editorial-overrides:invalidate`
 * after saving in the CMS, and this provider refetches.
 *
 * P0-C FIX: The provider is now locale-aware. It derives the active base
 * language from LocaleRuntimeContext (e.g. IT_IT → 'it', EN_US → 'en')
 * instead of using the hardcoded 'it' default. When the user switches
 * locale, the effect re-runs and loads overrides for the new language.
 * The explicit `locale` prop still takes precedence when provided (backward compat).
 */
import { useEffect } from 'react';
import api from '../lib/api';
import { setRuntimeOverrides } from './engine';
import { useLocaleRuntime } from '../contexts/LocaleRuntimeContext';

const STORAGE_FLAG = 'mfd-editorial-overrides-disabled';

const EditorialOverridesProvider = ({ children, locale: localeProp = null }) => {
  // P0-C: read composite locale from context (IT_IT, EN_US, FR_FR, …).
  // Falls back to 'IT_IT' when called outside the provider (defensive default
  // from useLocaleRuntime's internal fallback — never throws).
  const { localeCode } = useLocaleRuntime();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.sessionStorage?.getItem(STORAGE_FLAG) === '1') return undefined;

    // Derive base language code:
    //   explicit prop (e.g. 'it', 'en-US') → first segment lowercased
    //   runtime composite (IT_IT, EN_US)   → first segment lowercased
    //   safety fallback                    → 'it'
    const base = localeProp
      ? localeProp.split(/[-_]/)[0].toLowerCase()
      : (localeCode || 'IT_IT').split('_')[0].toLowerCase();

    let alive = true;

    const load = async () => {
      try {
        const { data } = await api.get('/api/editorial-copy/runtime', { params: { locale: base } });
        if (!alive) return;
        const map = data?.overrides || {};
        setRuntimeOverrides(base, map);
        // Fire a custom event so subscribers (legacy hooks) can react
        window.dispatchEvent(new CustomEvent('mfd:editorial-overrides:loaded', {
          detail: { locale: base, size: Object.keys(map).length },
        }));
      } catch (_) {
        // Silent — overrides are optional, the static JSON still works
      }
    };

    load();
    const onInvalidate = () => load();
    window.addEventListener('mfd:editorial-overrides:invalidate', onInvalidate);

    return () => {
      alive = false;
      window.removeEventListener('mfd:editorial-overrides:invalidate', onInvalidate);
    };
  }, [localeCode, localeProp]);

  return children;
};

export default EditorialOverridesProvider;
