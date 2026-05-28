import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../adminApi';

/**
 * Resolves an editorial namespace into a flat key→value map.
 * Falls back to the key itself if a value is missing — so the UI never
 * shows raw empty strings while seeds are still being authored.
 */
export const useEditorialCopy = (namespace, locale = 'it') => {
  const [copy, setCopy] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    adminApi.copyManifest(namespace, locale)
      .then((r) => { if (alive) { setCopy(r.data?.values || {}); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [namespace, locale]);

  const t = useCallback(
    (key, fallback = '') => (copy[key] && copy[key].length > 0 ? copy[key] : fallback || key),
    [copy],
  );
  return { t, loaded };
};
