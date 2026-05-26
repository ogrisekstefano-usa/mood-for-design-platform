import { useEffect } from 'react';
import { useLocale } from '../../contexts/LocaleContext';
import { LOCALIZED_SLUGS, slugToCanonical } from '../routes/localizedSlugs';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://www.moodfordesign.com';

/**
 * SEOHead — imperative head manager.
 *
 *  - <title>
 *  - <meta name="description">
 *  - <meta property="og:title|description|image">
 *  - <meta name="twitter:image">
 *  - <link rel="canonical">                   (locale-aware absolute URL)
 *  - <link rel="alternate" hreflang="...">    (one per active locale + x-default)
 *
 * Hreflang/canonical are emitted using the LOCALIZED_SLUGS map so that
 * Google can connect equivalent pages across locales (e.g. /dedicato-a
 * ↔ /audience ↔ /dedie-a). Removes any previously-emitted alternates so
 * route changes don't leak stale links into <head>.
 */
const setMeta = (selector, factory, value, attr = 'content') => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = factory();
    document.head.appendChild(el);
  }
  if (value) el.setAttribute(attr, value);
};

const SEOHead = ({ title, description, ogImage }) => {
  const { locale, locales } = useLocale();
  const { pathname } = useLocation();

  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      setMeta(
        'meta[name="description"]',
        () => { const m = document.createElement('meta'); m.setAttribute('name','description'); return m; },
        description,
      );
    }
    setMeta('meta[property="og:title"]',
      () => { const m = document.createElement('meta'); m.setAttribute('property','og:title'); return m; },
      title);
    setMeta('meta[property="og:description"]',
      () => { const m = document.createElement('meta'); m.setAttribute('property','og:description'); return m; },
      description);
    if (ogImage) {
      setMeta('meta[property="og:image"]',
        () => { const m = document.createElement('meta'); m.setAttribute('property','og:image'); return m; },
        ogImage);
      setMeta('meta[name="twitter:image"]',
        () => { const m = document.createElement('meta'); m.setAttribute('name','twitter:image'); return m; },
        ogImage);
    }

    // ── Canonical + hreflang ─────────────────────────────────────────
    // Remove existing alternates we previously added
    document.head.querySelectorAll('link[data-mood-seo="1"]').forEach((el) => el.remove());

    const canonicalKey = slugToCanonical(pathname);
    const buildHref = (loc) => {
      if (canonicalKey && LOCALIZED_SLUGS[canonicalKey]?.[loc]) {
        return `${SITE_URL}${LOCALIZED_SLUGS[canonicalKey][loc]}`;
      }
      return `${SITE_URL}${pathname}`;
    };

    // canonical = current locale URL
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute('data-mood-seo', '1');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', buildHref(locale));

    // hreflang per locale
    (locales || []).forEach((l) => {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', l.code);
      link.setAttribute('href', buildHref(l.code));
      link.setAttribute('data-mood-seo', '1');
      document.head.appendChild(link);
    });
    // x-default → en-us if available, else first
    const xDefaultLoc = (locales || []).find((l) => l.code === 'en-us')?.code || (locales || [])[0]?.code;
    if (xDefaultLoc) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', 'x-default');
      link.setAttribute('href', buildHref(xDefaultLoc));
      link.setAttribute('data-mood-seo', '1');
      document.head.appendChild(link);
    }

    document.documentElement.setAttribute('lang', locale);
  }, [title, description, ogImage, locale, locales, pathname]);

  return null;
};

export default SEOHead;
