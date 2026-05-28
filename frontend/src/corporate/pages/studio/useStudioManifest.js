/**
 * useStudioManifest — single GET /api/studio/activation/manifest.
 * Plus resolves all `copy_keys` from /api/site/block in one parallel batch.
 *
 * Returns { manifest, t, ready }
 *   t['studio.activation.entrance.headline']  → string
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocale } from '../../../contexts/LocaleContext';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const useStudioManifest = () => {
  const { locale } = useLocale();
  const [manifest, setManifest] = useState(null);
  const [t, setT] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await axios.get(`${BACKEND}/api/studio/activation/manifest`);
        if (cancelled) return;
        setManifest(m.data);
        const keys = m.data?.copy_keys || [];
        // Resolve copy in parallel
        const pairs = await Promise.all(
          keys.map((k) => axios
            .get(`${BACKEND}/api/site/block?key=${encodeURIComponent(k)}&locale=${locale}`)
            .then((r) => [k, r.data?.value || ''])
            .catch(() => [k, ''])),
        );
        if (!cancelled) setT(Object.fromEntries(pairs));
      } catch {
        // silent
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [locale]);

  return { manifest, t, ready };
};

export default useStudioManifest;
