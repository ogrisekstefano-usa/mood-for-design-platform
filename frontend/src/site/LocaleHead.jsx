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
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PLATFORM_DEFAULT_LOCALE, SUPPORTED_LOCALES, toBcp47 } from '../i18n';
import { useT } from '../i18n';
import { langCode as getLangCode } from './localeResolver';
import { tenantConfig } from './content/tenant';
import { navigationContent } from './content/navigation';
import api from '../lib/api';

const LOCALE_RE = /^\/([a-z]{2}-[A-Z]{2})(?=\/|$)/;

// Surfaces that SHOULD receive SEO head tags. Anything else (auth, dashboard,
// admin, workspace, settings, client) is skipped entirely — those are not
// indexable storefront URLs.
const STOREFRONT_PREFIXES = ['/projects', '/professionals', '/magazine', '/onboarding'];
// Article-detail pages own their <head> via ArticleHead (per-article
// slug_map hreflang, JSON-LD, canonical-to-served-locale). LocaleHead
// MUST NOT emit on those URLs to avoid duplicate / contradicting tags.
const ARTICLE_DETAIL_RE = /^(\/[a-z]{2}-[A-Z]{2})?\/magazine\/[^/]+\/?$/;
function isArticleDetail(p) { return ARTICLE_DETAIL_RE.test(p); }
function isStorefrontPath(p) {
  if (isArticleDetail(p)) return false;       // owned by ArticleHead
  const m = p.match(LOCALE_RE);
  if (m && SUPPORTED_LOCALES.includes(m[1])) return true;  // /it-IT, /en-US, …
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
  const [cmsSeo, setCmsSeo] = useState(null);

  // CMS-driven homepage SEO. We pull the storefront "navigation" block
  // ONCE — it carries per-locale brand.tagline + name that drive the
  // homepage <title> and <meta description> in the absence of a more
  // specific page-level seo block.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/api/storefront/public/${slug}/pages/navigation`);
        if (alive) setCmsSeo(r.data?.content || null);
      } catch { /* fall back to navigationContent module */ }
    })();
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    // Skip non-storefront surfaces entirely — strip any leftover tags.
    if (!isStorefrontPath(location.pathname)) {
      clearSeoHead();
      return undefined;
    }

    let cancelled = false;
    const effectiveLocale = (() => {
      const m = location.pathname.match(LOCALE_RE);
      const seg = m ? m[1] : null;
      if (seg && SUPPORTED_LOCALES.includes(seg)) return seg;
      return toBcp47(i18nLocale || PLATFORM_DEFAULT_LOCALE);
    })();

    fetchMarkets(slug).then((rawMarkets) => {
      if (cancelled) return;
      // Defend against backend/frontend drift: ONLY emit hreflang for
      // markets whose locale has a frontend route registered. Backend
      // catalog ⊋ frontend routes (e.g. gcc_luxury / en-AE seeded server
      // side but not in the supported subpath list) — without this filter
      // we would publish hreflang links that 404 on crawl.
      const markets = (rawMarkets || []).filter(
        (m) => m.primary_locale && SUPPORTED_LOCALES.includes(m.primary_locale),
      );
      clearSeoHead();
      const baseUrl = (typeof window !== 'undefined' ? window.location.origin : '');
      // Strip the leading locale segment ONLY if it's a supported BCP-47
      // code. An unsupported one (e.g. /en-AE) should not be carried over.
      const leadMatch = location.pathname.match(LOCALE_RE);
      const stripLead = leadMatch && SUPPORTED_LOCALES.includes(leadMatch[1]);
      const cleanPath = stripLead
        ? location.pathname.replace(LOCALE_RE, '')
        : location.pathname;
      const tail = (cleanPath === '/' || cleanPath === '') ? '' : cleanPath;

      // When the URL has no /<supported-locale> prefix (legacy root or an
      // unsupported segment like /en-AE), the canonical MUST point to the
      // tenant default market — not the user's sticky session locale.
      const matched = location.pathname.match(LOCALE_RE);
      const isLegacy = !matched || !SUPPORTED_LOCALES.includes(matched[1]);
      const defaultMarket = markets.find((m) => m.is_default) || markets[0];
      const canonicalLocale = isLegacy && defaultMarket
        ? defaultMarket.primary_locale
        : effectiveLocale;

      // canonical → /{locale}{cleanPath}
      const canonical = setOrCreate('link[rel="canonical"][data-mfd-seo]', () => {
        const el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        el.setAttribute('data-mfd-seo', '1');
        return el;
      });
      canonical.setAttribute('href', `${baseUrl}/${canonicalLocale}${tail}`);

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
      // x-default → tenant default market (already filtered & resolved above)
      if (defaultMarket) {
        const xd = document.createElement('link');
        xd.setAttribute('rel', 'alternate'); xd.setAttribute('hreflang', 'x-default');
        xd.setAttribute('href', `${baseUrl}/${defaultMarket.primary_locale}${tail}`);
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
      og.setAttribute('content', canonicalLocale.replace('-', '_'));

      Array.from(seen).filter((bcp) => bcp !== canonicalLocale).forEach((bcp) => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:locale:alternate');
        meta.setAttribute('content', bcp.replace('-', '_'));
        document.head.appendChild(meta);
      });

      // <html lang>
      try { document.documentElement.setAttribute('lang', canonicalLocale); } catch { /* noop */ }

      if (pageMeta?.title) document.title = pageMeta.title;
      else {
        // Homepage SEO from storefront CMS (locale-aware tagline → title).
        const cms = cmsSeo || navigationContent || {};
        const brandName = cms.brand?.name || tenantConfig?.brand?.name || 'MOOD for DESIGN';
        const langKey = getLangCode(canonicalLocale); // 'it-IT' → 'it', 'en-US' → 'en'
        const taglineMap = cms.brand?.tagline || {};
        const tagline = taglineMap[langKey] || taglineMap.it || taglineMap.en || '';
        // Tab title format: "{brand} · {tagline}"
        document.title = tagline ? `${brandName} · ${tagline}` : brandName;
        // <meta description> = tagline (calm editorial register)
        if (tagline) {
          const md = setOrCreate('meta[name="description"]', () => {
            const el = document.createElement('meta');
            el.setAttribute('name', 'description');
            return el;
          });
          md.setAttribute('content', tagline);
        }
      }
      if (pageMeta?.description) {
        const md = setOrCreate('meta[name="description"]', () => {
          const el = document.createElement('meta'); el.setAttribute('name', 'description'); return el;
        });
        md.setAttribute('content', pageMeta.description);
      }
    });
    return () => { cancelled = true; };
  }, [i18nLocale, location.pathname, slug, pageMeta?.title, pageMeta?.description, cmsSeo]);

  return null;
};

export default LocaleHead;
