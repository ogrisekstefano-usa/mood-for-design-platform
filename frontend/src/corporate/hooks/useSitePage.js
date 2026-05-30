import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocale } from '../../contexts/LocaleContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * useSitePage — fetches a fully-resolved page from /api/site/pages/{slug}.
 * Returns: { page, sections, loading, error }
 * Each section has shape: { id, type, sort, content:{...}, media:{key:{url,alt,...}}, links:{...}, options:{...} }
 */
export const useSitePage = (slug) => {
  const { locale } = useLocale();
  const [page, setPage] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(`${BACKEND_URL}/api/site/pages/${slug}?locale=${locale}`)
      .then((res) => {
        if (cancelled) return;
        setPage(res.data.page || null);
        setSections(res.data.sections || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, locale]);

  return { page, sections, loading, error };
};

/**
 * useSiteBlock — resolves a single editorial_block.
 * Useful for the login page or any out-of-page copy.
 */
export const useSiteBlock = (key) => {
  const { locale } = useLocale();
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!key) return;
    axios.get(`${BACKEND_URL}/api/site/block?key=${encodeURIComponent(key)}&locale=${locale}`)
      .then((r) => setValue(r.data?.value || ''))
      .catch(() => setValue(''));
  }, [key, locale]);
  return value;
};

/**
 * useSiteBlocks — batch-fetch multiple blocks (1 call per key — backend caches).
 *
 * `defaults` (optional): inline localized text used as the initial state and
 * as fallback for keys that resolve empty/missing from the API. This keeps
 * the page readable on first paint (zero black screen waiting for 29 round-trips)
 * while the editorial copy hydrates from the DB in the background. The same
 * pattern used by the /studio funnel.
 */
export const useSiteBlocks = (keys, defaults = {}) => {
  const { locale } = useLocale();
  const [values, setValues] = useState(defaults);
  useEffect(() => {
    if (!keys || keys.length === 0) return;
    let cancelled = false;
    Promise.all(
      keys.map((k) =>
        axios
          .get(`${BACKEND_URL}/api/site/block?key=${encodeURIComponent(k)}&locale=${locale}`)
          .then((r) => [k, r.data?.value || ''])
          .catch(() => [k, '']),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      // Merge: API value wins if non-empty; otherwise keep the inline default.
      const merged = { ...defaults };
      for (const [k, v] of pairs) {
        if (v) merged[k] = v;
      }
      setValues(merged);
    });
    return () => { cancelled = true; };
  }, [JSON.stringify(keys), locale]);  // eslint-disable-line react-hooks/exhaustive-deps
  return values;
};
