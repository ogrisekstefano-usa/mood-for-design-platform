/**
 * LocaleRoute — public locale subpath wrapper.
 *
 * Wraps any public route so URLs become `/<bcp47-locale>/...`. The locale
 * segment is registered statically per supported code (it-IT, en-US,
 * en-GB, es-ES, fr-FR, de-DE) — unknown segments fall through to the
 * legacy `/:tenantSlug` catch-all. No regex matching here.
 *
 * Responsibilities:
 *   • Bridge URL locale → LocaleRuntimeContext (composite IT_IT format)
 *   • Bridge URL locale → SiteContext (BCP-47 format) when available
 *   • Set <html lang> + <html dir>
 *
 * Internal Translation:
 *   The URL space NEVER exposes `internal_translation`. This component
 *   is ONLY concerned with the published locale subpath.
 */
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocaleRuntime } from '../contexts/LocaleRuntimeContext';

const bcp47ToComposite = (code) => String(code || '').replace('-', '_').toUpperCase();

export const LocaleRoute = ({ locale, children }) => {
  const location = useLocation();
  const runtime = useLocaleRuntime();
  const composite = bcp47ToComposite(locale);

  // Sync LocaleRuntime (composite codes). Avoid loops by only updating when different.
  useEffect(() => {
    if (!locale || !runtime?.setLocale) return;
    if (runtime.localeCode !== composite) {
      try { runtime.setLocale(composite); } catch { /* noop */ }
    }
  }, [locale, composite, runtime?.localeCode]);

  // <html lang> + dir for accessibility + SEO crawlers.
  useEffect(() => {
    if (!locale) return;
    try {
      document.documentElement.setAttribute('lang', locale);
      document.documentElement.setAttribute('dir', 'ltr');
    } catch { /* noop */ }
  }, [locale, location.pathname]);

  return children;
};

export default LocaleRoute;
