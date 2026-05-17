/**
 * SiteFooter — MOOD for DESIGN™ cinematic dark footer.
 *
 * 6-column layout (mockup-aligned):
 *   • Brand block (wordmark + tagline + socials)
 *   • AZIENDA
 *   • SERVIZI
 *   • RISORSE
 *   • SUPPORTO
 *   • SHOWROOM (address + phone + email + book-visit button)
 *
 * Driven by:
 *   • /api/storefront/public/{slug}/brand    → wordmark + tagline + showroom
 *   • useStorefrontContent('navigation')     → column copy (CMS-editable)
 *   • navigationContent fallback             → ships with the app
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Mail, Phone } from 'lucide-react';
import { useSite } from '../SiteContext';
import { usePublicBrand } from '../usePublicBrand';
import { tenantConfig } from '../content/tenant';
import { useStorefrontContent, pickContent } from '../useStorefrontContent';
import { navigationContent } from '../content/navigation';

const pickLocale = (bag, locale) => {
  if (bag == null) return '';
  if (typeof bag === 'string') return bag;
  const chain = [locale, locale?.split('-')[0], 'it', 'en-US', 'en', 'fr', 'de', 'es'];
  for (const c of chain) if (c && bag[c]) return bag[c];
  return Object.values(bag)[0] || '';
};

const SocialIcon = ({ id }) => {
  switch (id) {
    case 'instagram': return <Instagram size={16} strokeWidth={1.5} aria-hidden />;
    case 'linkedin':  return <Linkedin size={16} strokeWidth={1.5} aria-hidden />;
    case 'pinterest':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.5 2 2 6.5 2 12c0 4.1 2.5 7.6 6 9.2-.1-.8-.2-2 0-2.9.2-.8 1.2-5.2 1.2-5.2s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.2-.9 3.5-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.8 0-2.5-1.8-4.3-4.5-4.3-3 0-4.8 2.3-4.8 4.6 0 .9.3 1.9.8 2.4.1.1.1.2.1.3l-.3 1.3c0 .2-.2.2-.4.1-1.3-.6-2.1-2.6-2.1-4.1 0-3.4 2.4-6.4 7-6.4 3.7 0 6.5 2.6 6.5 6.2 0 3.7-2.3 6.7-5.5 6.7-1.1 0-2.1-.6-2.4-1.2 0 0-.5 2-.7 2.5-.2.9-.9 2-1.3 2.7.9.3 1.9.4 2.9.4 5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19 8.3c-1.7 0-3.2-.7-4.3-1.8v9.1c0 3.6-2.9 6.5-6.5 6.5S1.7 19.2 1.7 15.6 4.6 9.1 8.2 9.1c.5 0 1 .1 1.5.2v3.4c-.5-.2-1-.3-1.5-.3-1.7 0-3.1 1.4-3.1 3.1s1.4 3.1 3.1 3.1 3.1-1.4 3.1-3.1V1.5h3.4c0 2.5 2 4.5 4.5 4.5V8.3Z"/>
        </svg>
      );
    default: return null;
  }
};

// Default 4 footer columns matching the mockup. The tenant admin can override
// each one via the CMS `navigation` page → `footer_columns` section.
const DEFAULT_COLUMNS = [
  { id: 'azienda', title: { it: 'Azienda', en: 'Company' }, links: [
    { href: '#about',    label: { it: 'Chi siamo',      en: 'About us' } },
    { href: '#showroom', label: { it: 'Showroom',        en: 'Showroom' } },
    { href: '#careers',  label: { it: 'Lavora con noi', en: 'Careers' } },
    { href: '#press',    label: { it: 'Press',           en: 'Press' } },
  ]},
  { id: 'servizi', title: { it: 'Servizi', en: 'Services' }, links: [
    { href: '#design',       label: { it: 'Progettazione',     en: 'Design' } },
    { href: '#consultancy',  label: { it: 'Consulenza',         en: 'Consultancy' } },
    { href: '#styling',      label: { it: 'Interior Styling',   en: 'Interior Styling' } },
    { href: '#contract',     label: { it: 'Contract',           en: 'Contract' } },
  ]},
  { id: 'risorse', title: { it: 'Risorse', en: 'Resources' }, links: [
    { href: '#materials', label: { it: 'Materiali', en: 'Materials' } },
    { href: '#brand',     label: { it: 'Brand',     en: 'Brands' } },
    { href: '/magazine',  label: { it: 'Journal',   en: 'Journal' } },
    { href: '#faq',       label: { it: 'FAQ',       en: 'FAQ' } },
  ]},
  { id: 'supporto', title: { it: 'Supporto', en: 'Support' }, links: [
    { href: '#contact', label: { it: 'Contatti',             en: 'Contact' } },
    { href: '#privacy', label: { it: 'Privacy Policy',       en: 'Privacy Policy' } },
    { href: '#cookies', label: { it: 'Cookie Policy',        en: 'Cookie Policy' } },
    { href: '#terms',   label: { it: 'Termini e Condizioni', en: 'Terms & Conditions' } },
  ]},
];

const DEFAULT_SOCIALS = [
  { id: 'instagram', href: 'https://instagram.com/' },
  { id: 'pinterest', href: 'https://pinterest.com/' },
  { id: 'linkedin',  href: 'https://linkedin.com/'  },
  { id: 'tiktok',    href: 'https://tiktok.com/'    },
];

const renderLink = (link, locale, key) => {
  const label = pickLocale(link.label, locale);
  if (link.href && link.href.startsWith('/')) {
    return <Link to={link.href} key={key}>{label}</Link>;
  }
  return <a href={link.href || '#'} key={key}>{label}</a>;
};


const SiteFooter = () => {
  const { locale } = useSite();
  const slug = tenantConfig?.slug || 'mood-demo-studio-81a09e';
  const { brand, showroom } = usePublicBrand(slug);
  const { content: cms, hasDbContent } = useStorefrontContent(slug, 'navigation', navigationContent);

  // Footer columns — CMS overrides, else defaults.
  const cmsCols = (cms?.footer_columns?._settings?.columns) || null;
  const columns = (Array.isArray(cmsCols) && cmsCols.length ? cmsCols : DEFAULT_COLUMNS)
    .filter((c) => c.visible !== false);

  // Showroom — branding settings own this; legacy CMS bag is a fallback.
  const cmsShowroom = (cms?.footer_columns?._settings?.showroom) || (hasDbContent ? null : navigationContent.footer.showroom);
  const showroomBlock = {
    title:         pickLocale(cmsShowroom?.title, locale) || (locale?.startsWith('it') ? 'Showroom' : 'Showroom'),
    address_lines: showroom?.address_lines || cmsShowroom?.addressLines || navigationContent.footer.showroom.addressLines,
    phone:         showroom?.phone || null,
    email:         showroom?.email || null,
    book_visit:    pickLocale(showroom?.book_visit_label, locale) || pickLocale(cmsShowroom?.bookCta?.label, locale) || (locale?.startsWith('it') ? 'Prenota una visita' : 'Book a visit'),
    book_href:     cmsShowroom?.bookCta?.href || '#book',
  };

  const socials = (cms?.footer_columns?._settings?.socials) || DEFAULT_SOCIALS;

  const year = new Date().getFullYear();
  const brandName = brand?.name || 'Studio';
  const brandSuffix = brand?.suffix || '';
  const parts = brandName.split(/\s+/);
  const stacked = parts.length >= 3;
  const copyrightRaw = pickLocale(navigationContent.footer.copyright, locale).replace('{year}', String(year));

  return (
    <footer className="mfd-footer" data-testid="site-footer" data-surface="storefront">
      <div className="mfd-footer__cols">
        {/* Brand block */}
        <div className="mfd-footer__brand-block">
          <Link to="/" data-testid="footer-brand">
            <span className="mfd-footer__brand-wordmark">
              {stacked ? (
                <>
                  <span>{parts[0]}</span>
                  <span className="mid">{parts[1]}</span>
                  <span>{parts.slice(2).join(' ')}{brandSuffix}</span>
                </>
              ) : <span>{brandName}{brandSuffix}</span>}
            </span>
          </Link>
          {brand?.tagline && (
            <p className="mfd-footer__tagline" data-testid="footer-tagline">{brand.tagline}</p>
          )}
          <div className="mfd-footer__socials" data-testid="footer-socials">
            {socials.map((s) => (
              <a key={s.id} href={s.href} aria-label={s.id} target="_blank" rel="noopener noreferrer">
                <SocialIcon id={s.id} />
              </a>
            ))}
          </div>
        </div>

        {/* Column groups */}
        {columns.map((col) => (
          <div key={col.id} className="mfd-footer__col" data-testid={`footer-col-${col.id}`}>
            <h4 className="mfd-footer__col-title">{pickLocale(col.title, locale) || col.id}</h4>
            <ul>
              {(col.links || []).filter((l) => l.visible !== false).map((l, i) => (
                <li key={`${col.id}-${i}`}>{renderLink(l, locale, `${col.id}-${i}`)}</li>
              ))}
            </ul>
          </div>
        ))}

        {/* Showroom column */}
        <div className="mfd-footer__col" data-testid="footer-col-showroom">
          <h4 className="mfd-footer__col-title mfd-footer__showroom-title">{showroomBlock.title}</h4>
          <div>
            {(showroomBlock.address_lines || []).map((ln, i) => (
              <p className="mfd-footer__showroom-line" key={i}>{ln}</p>
            ))}
            {showroomBlock.phone && (
              <p className="mfd-footer__showroom-line">
                <Phone size={12} strokeWidth={1.6} style={{ verticalAlign: '-2px', marginRight: 6, opacity: .65 }} aria-hidden />
                <a href={`tel:${showroomBlock.phone.replace(/\s+/g, '')}`}>{showroomBlock.phone}</a>
              </p>
            )}
            {showroomBlock.email && (
              <p className="mfd-footer__showroom-line">
                <Mail size={12} strokeWidth={1.6} style={{ verticalAlign: '-2px', marginRight: 6, opacity: .65 }} aria-hidden />
                <a href={`mailto:${showroomBlock.email}`}>{showroomBlock.email}</a>
              </p>
            )}
          </div>
          <a href={showroomBlock.book_href} className="mfd-footer__book" data-testid="footer-book-visit">
            {showroomBlock.book_visit}
          </a>
        </div>
      </div>

      <p className="mfd-footer__copyright" data-testid="footer-copyright">
        {copyrightRaw}
      </p>
    </footer>
  );
};

export default SiteFooter;
