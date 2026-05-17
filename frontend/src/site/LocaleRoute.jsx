/**
 * LocaleRoute — public locale subpath wrapper.
 *
 * Wraps any public route so URLs become `/:locale/...` where `:locale` is a
 * strict BCP-47 supported code. The component:
 *   1. Validates the URL `:locale` segment against SUPPORTED_LOCALES.
 *   2. Synchronises LocaleRuntimeContext with the URL on every navigation.
 *   3. Redirects unsupported locales to the tenant default (or it-IT).
 *
 * Legacy URLs without locale prefix (`/`, `/magazine`, …) still work and
 * use the LocaleRuntime's resolved locale (browser → cookie → tenant
 * default → it-IT). Phase R-MARKET-1B keeps both forms operational.
 */
import React, { useEffect } from 'react';
import { Navigate, useParams, useLocation } from 'react-router-dom';
import { SUPPORTED_LOCALES, PLATFORM_DEFAULT_LOCALE, toBcp47 } from '../i18n';
import { useLocaleRuntime } from '../contexts/LocaleRuntimeContext';

export const LocaleRoute = ({ children }) => {
  const { locale: urlLocale } = useParams();
  const location = useLocation();
  const runtime = useLocaleRuntime();
  const normalised = toBcp47(urlLocale);
  const supported = SUPPORTED_LOCALES.includes(normalised);

  useEffect(() => {
    if (supported && runtime?.setLocale && runtime.localeCode !== normalised.replace('-', '_').toUpperCase()) {
      // LocaleRuntime stores composite (IT_IT) — bridge from BCP-47.
      try { runtime.setLocale(normalised); } catch { /* noop */ }
    }
  }, [supported, normalised, runtime]);

  if (!supported) {
    const fallback = PLATFORM_DEFAULT_LOCALE;
    const rest = location.pathname.replace(/^\/[^/]+/, '');
    return <Navigate to={`/${fallback}${rest}${location.search}`} replace />;
  }
  return children;
};

export default LocaleRoute;
