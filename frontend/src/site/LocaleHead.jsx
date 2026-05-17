/**
 * LocaleHead — emits hreflang + canonical + OG locale tags into <head>.
 *
 *   • Reads the public market list (active for the tenant) once.
 *   • Generates <link rel="alternate" hreflang="…"> for every active market.
 *   • Sets <link rel="canonical"> to the current `/{locale}/path` URL.
 *   • Sets <meta property="og:locale"> and og:locale:alternate.
 *
 * Uses react-helmet-async if present, falls back to a direct DOM patch
 * (the project does not currently have helmet — we patch <head> directly).
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useT } from '../i18n';
import { useSite } from './SiteContext';
import api from '../lib/api';

let CACHED_MARKETS = null;
async function fetchMarkets(slug) {
  if (CACHED_MARKETS) return CACHED_MARKETS;
  try {
    const r = await api.get(`/api/storefront/public/${slug}/markets`);
    CACHED_MARKETS = r.data?.markets || [];
  } catch { CACHED_MARKETS = []; }
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

export const LocaleHead = ({ pageMeta }) => {
  const { locale } = useT();
  const location = useLocation();
  const { tenant } = useSite() || {};
  const slug = tenant?.slug || 'mood-demo-studio-81a09e';

  useEffect(() => {
    let cancelled = false;
    fetchMarkets(slug).then((markets) => {
      if (cancelled) return;
      clearAllHreflang();
      const baseUrl = (typeof window !== 'undefined' ? window.location.origin : '');
      // Strip leading locale segment from current path for hreflang composition.
      const cleanPath = location.pathname.replace(/^\/[a-z]{2}-[A-Z]{2}(?=\/|$)/, '');

      // canonical → current /{locale}{cleanPath}
      const canonical = setOrCreate('link[rel="canonical"]', () => {
        const el = document.createElement('link'); el.setAttribute('rel', 'canonical'); return el;
      });
      canonical.setAttribute('href', `${baseUrl}/${locale}${cleanPath || ''}`);

      // hreflang per market
      markets.forEach((m) => {
        const link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', m.primary_locale);
        link.setAttribute('href', `${baseUrl}/${m.primary_locale}${cleanPath || ''}`);
        link.setAttribute('data-mfd-hreflang', m.code);
        document.head.appendChild(link);
      });
      // x-default to the tenant default market
      const def = markets.find((m) => m.is_default) || markets[0];
      if (def) {
        const xd = document.createElement('link');
        xd.setAttribute('rel', 'alternate'); xd.setAttribute('hreflang', 'x-default');
        xd.setAttribute('href', `${baseUrl}/${def.primary_locale}${cleanPath || ''}`);
        xd.setAttribute('data-mfd-hreflang', 'x-default');
        document.head.appendChild(xd);
      }

      // OG locale
      const og = setOrCreate('meta[property="og:locale"]', () => {
        const el = document.createElement('meta'); el.setAttribute('property', 'og:locale'); return el;
      });
      og.setAttribute('content', locale.replace('-', '_'));

      document.head.querySelectorAll('meta[property="og:locale:alternate"]').forEach((n) => n.remove());
      markets.filter((m) => m.primary_locale !== locale).forEach((m) => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:locale:alternate');
        meta.setAttribute('content', m.primary_locale.replace('-', '_'));
        document.head.appendChild(meta);
      });

      if (pageMeta?.title) document.title = pageMeta.title;
      if (pageMeta?.description) {
        const md = setOrCreate('meta[name="description"]', () => {
          const el = document.createElement('meta'); el.setAttribute('name', 'description'); return el;
        });
        md.setAttribute('content', pageMeta.description);
      }
    });
    return () => { cancelled = true; };
  }, [locale, location.pathname, slug, pageMeta?.title, pageMeta?.description]);

  return null;
};

export default LocaleHead;
