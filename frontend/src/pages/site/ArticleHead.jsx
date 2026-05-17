/**
 * ArticleHead — per-article SEO surface (Phase E-3 / Prompt 3).
 *
 * Owns the <head> for a single Magazine article URL. The generic
 * LocaleHead handles the storefront homepage / category surfaces; once
 * the user lands on `/<locale>/magazine/<slug>` THIS component takes
 * over because:
 *
 *   • hreflang must point to the LOCALIZED variant_slug per market
 *     (NOT just locale-prefix the same slug)
 *   • canonical must use the served variant's target_locale
 *     (not the URL prefix — they may differ on fallback)
 *   • OG title/description/image come from variant.seo (editorial)
 *   • JSON-LD schema.org/Article with extended fields
 *   • Internal Translation / Preview drafts emit
 *     <meta name="robots" content="noindex,nofollow">
 *
 * Internal Translation safety:
 *   The variant prop NEVER contains `internal_translation` (stripped
 *   server-side). This component therefore CANNOT leak it.
 */
import { useEffect } from 'react';
import { tenantConfig } from '../../site/content/tenant';

// All "data-mfd-head" tags are owned by this component so we can wipe
// them between articles without disturbing global head tags.
const OWN_ATTR = 'data-mfd-head';

function setOrCreate(selector, builder) {
  let el = document.head.querySelector(selector);
  if (!el) { el = builder(); document.head.appendChild(el); }
  return el;
}

function clearOwn() {
  document.head.querySelectorAll(`[${OWN_ATTR}]`).forEach((n) => n.remove());
}

function ld(obj) {
  return JSON.stringify(obj, (_k, v) => (v === undefined || v === null || v === '') ? undefined : v);
}

export const ArticleHead = ({ article, locale, isPreview }) => {
  useEffect(() => {
    if (!article) { clearOwn(); return undefined; }
    clearOwn();
    const baseUrl = (typeof window !== 'undefined') ? window.location.origin : '';
    const slugMap = article.slug_map_by_locale || {};
    const served = article._locale?.served || locale;
    const localizedSlug = slugMap[served] || article.slug || '';
    const tenantName = tenantConfig?.brand?.name || 'MOOD for DESIGN';

    // ── 1. <title> + meta description ─────────────────────────────
    const seoTitle = article.seo_title || article.title || 'Magazine';
    const seoDesc  = article.seo_description || article.intro || article.subtitle || '';
    document.title = `${seoTitle} · ${tenantName}`;
    const md = setOrCreate(`meta[name="description"][${OWN_ATTR}]`, () => {
      const el = document.createElement('meta');
      el.setAttribute('name', 'description');
      el.setAttribute(OWN_ATTR, 'description');
      return el;
    });
    md.setAttribute('content', seoDesc);

    // ── 2. canonical → /<served-locale>/magazine/<localized-slug> ─
    const canonicalHref = `${baseUrl}/${served}/magazine/${localizedSlug}`;
    const canonical = setOrCreate(`link[rel="canonical"][${OWN_ATTR}]`, () => {
      const el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      el.setAttribute(OWN_ATTR, 'canonical');
      return el;
    });
    canonical.setAttribute('href', canonicalHref);

    // ── 3. hreflang → per-locale localized slug ───────────────────
    const localesEmitted = [];
    Object.entries(slugMap).forEach(([loc, slug]) => {
      if (!loc || !slug) return;
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', loc);
      link.setAttribute('href', `${baseUrl}/${loc}/magazine/${slug}`);
      link.setAttribute(OWN_ATTR, `hreflang-${loc}`);
      document.head.appendChild(link);
      localesEmitted.push(loc);
    });
    // x-default → served (or 'it-IT' from tenantConfig)
    if (localizedSlug) {
      const xd = document.createElement('link');
      xd.setAttribute('rel', 'alternate');
      xd.setAttribute('hreflang', 'x-default');
      xd.setAttribute('href', canonicalHref);
      xd.setAttribute(OWN_ATTR, 'hreflang-x-default');
      document.head.appendChild(xd);
    }

    // ── 4. OG / Twitter card from variant.seo ─────────────────────
    const og = (prop, content, key) => {
      if (!content) return;
      const m = document.createElement('meta');
      m.setAttribute('property', prop);
      m.setAttribute('content', content);
      m.setAttribute(OWN_ATTR, key);
      document.head.appendChild(m);
    };
    og('og:type', 'article', 'og-type');
    og('og:title', seoTitle, 'og-title');
    og('og:description', seoDesc, 'og-description');
    og('og:locale', String(served).replace('-', '_'), 'og-locale');
    og('og:url', canonicalHref, 'og-url');
    const cover = article.cover_url || article.hero_url;
    if (cover) og('og:image', cover, 'og-image');
    localesEmitted.filter((l) => l !== served).forEach((l) => {
      og('og:locale:alternate', l.replace('-', '_'), `og-locale-alt-${l}`);
    });

    // Twitter card
    const tw = (name, content, key) => {
      if (!content) return;
      const m = document.createElement('meta');
      m.setAttribute('name', name);
      m.setAttribute('content', content);
      m.setAttribute(OWN_ATTR, key);
      document.head.appendChild(m);
    };
    tw('twitter:card', cover ? 'summary_large_image' : 'summary', 'tw-card');
    tw('twitter:title', seoTitle, 'tw-title');
    tw('twitter:description', seoDesc, 'tw-description');
    if (cover) tw('twitter:image', cover, 'tw-image');

    // ── 5. robots: noindex on preview drafts + internal translation ──
    const noindex = isPreview || article._locale?.preview;
    const robots = setOrCreate(`meta[name="robots"][${OWN_ATTR}]`, () => {
      const el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      el.setAttribute(OWN_ATTR, 'robots');
      return el;
    });
    robots.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

    // ── 6. JSON-LD schema.org/Article (extended) ─────────────────
    const author = {
      '@type': 'Organization',
      'name':  tenantName,
    };
    const publisher = {
      '@type': 'Organization',
      'name':  tenantName,
      'logo':  tenantConfig?.brand?.logoSrc ? {
        '@type': 'ImageObject', 'url': tenantConfig.brand.logoSrc,
      } : undefined,
    };
    const articleBodyPreview = (() => {
      const blocks = article.body_blocks || [];
      const text = blocks
        .map((b) => (typeof b === 'string') ? b : (b?.text || ''))
        .filter(Boolean)
        .join(' ');
      return text ? text.slice(0, 400) : undefined;
    })();
    const jsonLd = {
      '@context':         'https://schema.org',
      '@type':            'Article',
      'headline':         seoTitle,
      'description':      seoDesc,
      'inLanguage':       served,
      'mainEntityOfPage': { '@type': 'WebPage', '@id': canonicalHref },
      'image':            cover || undefined,
      'datePublished':    article.published_at || article.created_at || undefined,
      'dateModified':     article.updated_at || article.published_at || undefined,
      'author':           author,
      'publisher':        publisher,
      'articleSection':   article.category_slug || article.target_sub_region || undefined,
      'keywords':         (article.seo?.focus_intent || article.cultural_angle || undefined),
      'about':            article.target_sub_region || article.category_slug || undefined,
      'articleBody':      articleBodyPreview,
    };
    const ldScript = document.createElement('script');
    ldScript.setAttribute('type', 'application/ld+json');
    ldScript.setAttribute(OWN_ATTR, 'jsonld');
    ldScript.textContent = ld(jsonLd);
    document.head.appendChild(ldScript);

    return () => {
      // Don't strip on unmount — the next page's component will clear/replace.
      // This avoids a brief flicker between SPA transitions.
    };
  }, [article, locale, isPreview]);

  return null;
};

export default ArticleHead;
