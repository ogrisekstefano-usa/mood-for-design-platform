/**
 * MoodSiteFooter — Editorial 4-col + colophon footer (CMS-driven end-to-end).
 *
 * Reads from 3 CMS sources:
 *   1. `navigation.nav_top.settings.links` → first "Navigazione" column
 *   2. `home.editorial_footer.locale_content.<locale>.cols` → custom columns
 *   3. `home.editorial_footer.settings.logo_url` → footer brand logo
 *   4. `home.editorial_footer.settings.social_links` → icon row under the logo
 *
 * Layout: brand block (logo + social icons) on the left, cols distributed
 * edge-to-edge on the right with equal weighting.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Facebook, Youtube, Twitter, Mail, Globe } from 'lucide-react';
import { useStorefrontContent } from '../useStorefrontContent';
import { useSite } from '../SiteContext';
import { MOOD_BRAND_LOGO_URL, MOOD_BRAND_ALT } from '../content/brandAssets';
import { CountryLanguageSelector } from './CountryLanguageSelector';

const resolveTenantSlug = () => {
  if (typeof window === 'undefined') return 'studio';
  const host = (window.location.hostname || '').toLowerCase();
  const first = host.split('.')[0] || '';
  const PLATFORM = ['studio', 'blueprint', 'www', 'localhost'];
  if (first.startsWith('content-hub-pro-')) return 'studio';
  if (host.includes('.preview.emergentagent.com')) return 'studio';
  if (PLATFORM.some((h) => first === h || first.startsWith(h))) return 'studio';
  return first || 'studio';
};

const L = (obj, locale) => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  const norm = (locale || 'it').toLowerCase();
  const candidates = [
    locale,
    norm,
    norm === 'it' ? 'it-IT' : null,
    norm === 'en' ? 'en-US' : null,
    norm === 'en' ? 'en-GB' : null,
    norm === 'fr' ? 'fr-FR' : null,
    norm === 'de' ? 'de-DE' : null,
    norm === 'es' ? 'es-ES' : null,
    'it-IT', '_default', 'en-US', 'en', 'it',
  ].filter(Boolean);
  for (const k of candidates) if (obj[k]) return obj[k];
  return Object.values(obj)[0] || '';
};

const resolveBag = (bag, locale) => {
  if (!bag || typeof bag !== 'object') return {};
  const norm = (locale || 'it').toLowerCase();
  if (norm.startsWith('en')) return { ...(bag._default || {}), ...(bag['en-US'] || bag.en || {}) };
  if (norm.startsWith('it')) return { ...(bag._default || {}), ...(bag.it || {}) };
  if (norm.startsWith('fr')) return { ...(bag._default || {}), ...(bag.fr || {}) };
  if (norm.startsWith('de')) return { ...(bag._default || {}), ...(bag.de || {}) };
  if (norm.startsWith('es')) return { ...(bag._default || {}), ...(bag.es || {}) };
  return { ...(bag._default || {}) };
};

const SHELL_COLOPHON = {
  enabled: false,
};

// Map a social platform code to an icon component (lucide-react).
// Editors set `kind` in the CMS, the visual icon is rendered here.
const SOCIAL_ICON_MAP = {
  instagram: Instagram,
  linkedin:  Linkedin,
  facebook:  Facebook,
  youtube:   Youtube,
  twitter:   Twitter,
  x:         Twitter,
  email:     Mail,
  website:   Globe,
};
const inferKindFromHref = (href = '') => {
  const h = href.toLowerCase();
  if (h.includes('instagram')) return 'instagram';
  if (h.includes('linkedin'))  return 'linkedin';
  if (h.includes('facebook'))  return 'facebook';
  if (h.includes('youtube'))   return 'youtube';
  if (h.includes('twitter') || h.startsWith('https://x.com') || h.startsWith('https://www.x.com')) return 'twitter';
  if (h.startsWith('mailto:')) return 'email';
  return 'website';
};

const FooterColophon = ({ locale, colophon }) => {
  const c = colophon;
  if (!c || c.enabled === false) return null;
  const center = (c.center && (c.center[locale] || c.center.en || c.center.it)) || null;
  const linkHref = c.center_link_href || 'https://www.moodfordesign.com';
  return (
    <div className="mfd-colophon" role="contentinfo" data-testid="footer-colophon">
      <div className="mfd-colophon__inner">
        <p className="mfd-colophon__col mfd-colophon__col--left" data-testid="colophon-left">
          {L(c.left, locale)}
        </p>
        <p className="mfd-colophon__col mfd-colophon__col--center" data-testid="colophon-center">
          {center ? (
            <>
              <span>{center.prefix}</span>
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mfd-colophon__link"
                data-testid="colophon-center-link"
              >
                {center.link_label}
              </a>
              {center.suffix ? <span>{center.suffix}</span> : null}
            </>
          ) : null}
        </p>
        <p className="mfd-colophon__col mfd-colophon__col--right" data-testid="colophon-right">
          {L(c.right, locale)}
        </p>
      </div>
    </div>
  );
};

const MoodSiteFooter = () => {
  const site = useSite();
  const locale = (site?.locale || 'it').slice(0, 2);
  const i18nLocale = locale === 'en' ? 'en-US' : (locale === 'it' ? 'it-IT' : locale);
  const [pickerOpen, setPickerOpen] = useState(false);

  const tenantSlug = useMemo(() => resolveTenantSlug(), []);
  const cmsHome = useStorefrontContent(tenantSlug, 'home');
  const cmsNav  = useStorefrontContent(tenantSlug, 'navigation');

  // Settings layer of the editorial_footer section (logo + socials).
  const footerSettings = useMemo(() => {
    const sec = cmsHome?.content?.editorial_footer || {};
    return sec._settings || sec.settings || {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cmsHome?.content?.editorial_footer)]);

  const brandLogoUrl = (footerSettings.logo_url && String(footerSettings.logo_url).trim()) || null;

  const socialLinks = Array.isArray(footerSettings.social_links)
    ? footerSettings.social_links.filter((s) => s && s.href)
    : [];

  // Editorial cols come from per-locale locale_content. SEGUICI col is
  // intentionally skipped here because the same data is rendered as icons
  // under the logo (avoids duplication).
  const cols = useMemo(() => {
    const out = [];

    // 1 · Navigation mirror
    const navSection = cmsNav?.content?.nav_top
                    || cmsNav?.content?.navigation_main
                    || cmsNav?.content?.main_links;
    const navLinks = navSection?._settings?.links || navSection?.settings?.links || [];
    if (Array.isArray(navLinks) && navLinks.length) {
      const navCol = {
        title: { it: 'Navigazione', en: 'Navigation' },
        links: navLinks
          .filter((l) => l.visible !== false)
          .map((l) => ({ href: l.href, label: l.label_i18n || l.label || {} })),
      };
      if (navCol.links.length) out.push(navCol);
    }

    // 2 · Editorial cols
    const footerBag = resolveBag(cmsHome?.content?.editorial_footer, i18nLocale);
    const editorialCols = Array.isArray(footerBag.cols) ? footerBag.cols : [];
    for (const c of editorialCols) {
      const titleNorm = L(c.title, locale).toLowerCase();
      // Skip the "Seguici"/"Follow" column — we render socials as icons
      // under the logo to avoid duplication.
      if (/segu|follow|social/i.test(titleNorm)) continue;
      out.push({
        title: c.title,
        links: Array.isArray(c.links) ? c.links : [],
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cmsNav?.content?.nav_top || cmsNav?.content?.navigation_main),
      JSON.stringify(cmsHome?.content?.editorial_footer),
      i18nLocale, locale]);

  return (
    <footer id="footer" className="mfd-footer" data-testid="site-footer">
      <div className="mfd-footer__inner">
        <div className="mfd-footer__top">
          <div className="mfd-footer__brand">
            {brandLogoUrl
              ? <img src={brandLogoUrl} alt="Studio" className="mfd-footer__brand-img" draggable={false} data-testid="site-footer-brand-img" />
              : <span className="mfd-footer__brand-wordmark" data-testid="site-footer-brand-wordmark">Studio</span>
            }
            {socialLinks.length > 0 && (
              <ul className="mfd-footer__socials" data-testid="footer-socials">
                {socialLinks.map((s, i) => {
                  const kind = (s.kind || inferKindFromHref(s.href)).toLowerCase();
                  const Icon = SOCIAL_ICON_MAP[kind] || Globe;
                  return (
                    <li key={i}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label || kind}
                        title={s.label || kind}
                        className="mfd-footer__social"
                        data-testid={`footer-social-${kind}`}
                      >
                        <Icon size={16} strokeWidth={1.6} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* ITER171.9 · Country & language picker — sits inside the brand
                stack, slightly detached from the social icons. */}
            <button
              type="button"
              className="mfd-footer__locale-btn"
              onClick={() => setPickerOpen(true)}
              data-testid="footer-locale-picker"
            >
              <Globe size={14} strokeWidth={1.6} />
              <span>
                {locale.startsWith('it') ? 'Paese · Lingua'
                 : locale.startsWith('fr') ? 'Pays · Langue'
                 : locale.startsWith('de') ? 'Land · Sprache'
                 : locale.startsWith('es') ? 'País · Idioma'
                 : 'Country · Language'}
              </span>
              <span className="mfd-footer__locale-current">
                · {(i18nLocale || locale).toUpperCase()}
              </span>
            </button>
          </div>
          {cols.length > 0 && (
            <div className="mfd-footer__cols" data-cols={cols.length}>
              {cols.map((col, ci) => (
                <div key={ci} className="mfd-footer__col">
                  <h4 className="mfd-footer__col-title">{L(col.title, locale)}</h4>
                  <ul>
                    {(col.links || []).map((l, li) => (
                      <li key={li}>
                        {l.href?.startsWith('http')
                          ? <a href={l.href} target="_blank" rel="noopener noreferrer">{L(l.label, locale)}</a>
                          : <Link to={l.href || '#'}>{L(l.label, locale)}</Link>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <FooterColophon locale={locale} colophon={SHELL_COLOPHON} />
      <CountryLanguageSelector open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </footer>
  );
};

export default MoodSiteFooter;
