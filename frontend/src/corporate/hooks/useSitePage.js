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
 */
export const useSiteBlocks = (keys) => {
  const { locale } = useLocale();
  const [values, setValues] = useState({});
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
      setValues(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [JSON.stringify(keys), locale]);
  return values;
};
