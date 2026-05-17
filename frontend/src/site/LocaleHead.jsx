/**
 * LocaleHead — emits hreflang + canonical + OG locale tags into <head>.
 *
 * Mounted GLOBALLY inside <BrowserRouter> so it covers every public
 * surface — storefront, magazine, professionals — without needing
 * SiteProvider context.
 *
 *   • Reads the public market list (active for the tenant) once.
 *   • Generates <link rel="alternate" hreflang="…"> for every active market.
 *   • Sets <link rel="canonical"> to the current `/{locale}/path` URL.
 *   • Sets <meta property="og:locale"> + og:locale:alternate.
 *   • x-default points to the tenant default market.
 *
 * Internal Translation safety:
 *   We ONLY emit hreflang for public markets. Internal translation
 *   locales NEVER live in `/api/storefront/public/{slug}/markets`, so
 *   they can never be tagged here.
 *
 * Auth surfaces (login, dashboard, admin) are excluded — they are not
 * public storefront pages and we don't want to leak canonicals for them.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PLATFORM_DEFAULT_LOCALE, toBcp47 } from '../i18n';
import { useT } from '../i18n';
import { tenantConfig } from './content/tenant';
import api from '../lib/api';

const LOCALE_RE = /^\/([a-z]{2}-[A-Z]{2})(?=\/|$)/;

// Surfaces that SHOULD receive SEO head tags. Anything else (auth, dashboard,
// admin, workspace, settings, client) is skipped entirely — those are not
// indexable storefront URLs.
const STOREFRONT_PREFIXES = ['/projects', '/professionals', '/magazine', '/onboarding'];
function isStorefrontPath(p) {
  if (LOCALE_RE.test(p)) return true;       // /it-IT, /en-US, …
  if (p === '/') return true;
  return STOREFRONT_PREFIXES.some((pre) => p === pre || p.startsWith(`${pre}/`));
}

let CACHED_MARKETS = null;
let CACHED_SLUG = null;
async function fetchMarkets(slug) {
  if (CACHED_MARKETS && CACHED_SLUG === slug) return CACHED_MARKETS;
  try {
    const r = await api.get(`/api/storefront/public/${slug}/markets`);
    CACHED_MARKETS = r.data?.markets || [];
    CACHED_SLUG = slug;
  } catch { CACHED_MARKETS = []; CACHED_SLUG = slug; }
  return CACHED_MARKETS;
}

function setOrCreate(selector, builder) {
  let el = document.head.querySelector(selector);
  if (!el) { el = builder(); document.head.appendChild(el); }
  return el;
}

function clearAllHreflang() {
  document.head.querySelectorAll('link[rel="alternate"][data-mfd-hreflang]').forEach((n) => n.remove());
}

function clearSeoHead() {
  clearAllHreflang();
  document.head.querySelectorAll('link[rel="canonical"][data-mfd-seo]').forEach((n) => n.remove());
  document.head.querySelectorAll('meta[property="og:locale"][data-mfd-seo]').forEach((n) => n.remove());
  document.head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((n) => n.remove());
}

export const LocaleHead = ({ pageMeta }) => {
  const { locale: i18nLocale } = useT();
  const location = useLocation();
  const slug = tenantConfig?.slug || 'mood-demo-studio-81a09e';

  useEffect(() => {
    // Skip non-storefront surfaces entirely — strip any leftover tags.
    if (!isStorefrontPath(location.pathname)) {
      clearSeoHead();
      return undefined;
    }

    let cancelled = false;
    const effectiveLocale = (() => {
      const m = location.pathname.match(LOCALE_RE);
      return m ? m[1] : toBcp47(i18nLocale || PLATFORM_DEFAULT_LOCALE);
    })();

    fetchMarkets(slug).then((markets) => {
      if (cancelled) return;
      clearSeoHead();
      const baseUrl = (typeof window !== 'undefined' ? window.location.origin : '');
      const cleanPath = location.pathname.replace(LOCALE_RE, '');
      // Normalise: root path with no remaining segment becomes empty so
      // canonical reads `/{locale}` (no trailing slash).
      const tail = (cleanPath === '/' || cleanPath === '') ? '' : cleanPath;

      // canonical → /{locale}{cleanPath}
      const canonical = setOrCreate('link[rel="canonical"][data-mfd-seo]', () => {
        const el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        el.setAttribute('data-mfd-seo', '1');
        return el;
      });
      canonical.setAttribute('href', `${baseUrl}/${effectiveLocale}${tail}`);

      // hreflang per market — ONLY public markets, never internal translation.
      const seen = new Set();
      markets.forEach((m) => {
        const bcp = m.primary_locale;
        if (!bcp || seen.has(bcp)) return;
        seen.add(bcp);
        const link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', bcp);
        link.setAttribute('href', `${baseUrl}/${bcp}${tail}`);
        link.setAttribute('data-mfd-hreflang', m.code);
        document.head.appendChild(link);
      });
      // x-default → tenant default market
      const def = markets.find((m) => m.is_default) || markets[0];
      if (def) {
        const xd = document.createElement('link');
        xd.setAttribute('rel', 'alternate'); xd.setAttribute('hreflang', 'x-default');
        xd.setAttribute('href', `${baseUrl}/${def.primary_locale}${tail}`);
        xd.setAttribute('data-mfd-hreflang', 'x-default');
        document.head.appendChild(xd);
      }

      // OG locale (replace - with _ for OG spec)
      const og = setOrCreate('meta[property="og:locale"][data-mfd-seo]', () => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'og:locale');
        el.setAttribute('data-mfd-seo', '1');
        return el;
      });
      og.setAttribute('content', effectiveLocale.replace('-', '_'));

      Array.from(seen).filter((bcp) => bcp !== effectiveLocale).forEach((bcp) => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:locale:alternate');
        meta.setAttribute('content', bcp.replace('-', '_'));
        document.head.appendChild(meta);
      });

      // <html lang>
      try { document.documentElement.setAttribute('lang', effectiveLocale); } catch { /* noop */ }

      if (pageMeta?.title) document.title = pageMeta.title;
      if (pageMeta?.description) {
        const md = setOrCreate('meta[name="description"]', () => {
          const el = document.createElement('meta'); el.setAttribute('name', 'description'); return el;
        });
        md.setAttribute('content', pageMeta.description);
      }
    });
    return () => { cancelled = true; };
  }, [i18nLocale, location.pathname, slug, pageMeta?.title, pageMeta?.description]);

  return null;
};

export default LocaleHead;
