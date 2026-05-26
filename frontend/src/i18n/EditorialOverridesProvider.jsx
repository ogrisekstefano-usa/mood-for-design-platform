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
 */
import { useEffect } from 'react';
import api from '../lib/api';
import { setRuntimeOverrides } from './engine';

const STORAGE_FLAG = 'mfd-editorial-overrides-disabled';

const EditorialOverridesProvider = ({ children, locale = 'it' }) => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.sessionStorage?.getItem(STORAGE_FLAG) === '1') return undefined;

    let alive = true;
    const base = (locale || 'it').split('-')[0].toLowerCase();

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
  }, [locale]);

  return children;
};

export default EditorialOverridesProvider;
