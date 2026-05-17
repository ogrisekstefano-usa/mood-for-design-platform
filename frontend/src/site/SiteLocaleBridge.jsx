/**
 * SiteLocaleBridge — URL → SiteContext locale bridge.
 *
 * Lives INSIDE <SiteLayout> (under <SiteProvider>) so it can push the
 * URL locale segment into SiteContext. This is what makes the
 * storefront copy (header / footer / hero) hot-switch when the user
 * lands on `/it-IT` vs `/en-US`.
 *
 * Mirrors the same change into LocaleRuntimeContext for any surface
 * that reads `runtime.localeCode` directly (CRM-style or editorial).
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { SUPPORTED_LOCALES } from '../i18n';
import { useSite } from './SiteContext';
import { useLocaleRuntime } from '../contexts/LocaleRuntimeContext';

const LOCALE_RE = /^\/([a-z]{2}-[A-Z]{2})(?=\/|$)/;

export const SiteLocaleBridge = () => {
  const location = useLocation();
  const site = useSite();
  const runtime = useLocaleRuntime();
  const lastRef = useRef(null);

  useEffect(() => {
    const m = location.pathname.match(LOCALE_RE);
    const urlLocale = m ? m[1] : null;
    if (!urlLocale || !SUPPORTED_LOCALES.includes(urlLocale)) return;
    if (lastRef.current === urlLocale) return;
    lastRef.current = urlLocale;
    try { site?.setLocale?.(urlLocale); } catch { /* noop */ }
    try {
      const composite = urlLocale.replace('-', '_').toUpperCase();
      if (runtime?.localeCode !== composite) runtime?.setLocale?.(composite);
    } catch { /* noop */ }
  }, [location.pathname, site, runtime]);

  return null;
};

export default SiteLocaleBridge;
