import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin } from 'lucide-react';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';
import { tenantConfig } from '../content/tenant';
import { useStorefrontContent, pickContent } from '../useStorefrontContent';

const SocialIcon = ({ id }) => {
  switch (id) {
    case 'instagram': return <Instagram size={16} />;
    case 'linkedin':  return <Linkedin size={16} />;
    case 'pinterest':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-3.6 19.32c-.05-.78-.1-2 0-2.85.1-.76 1.2-4.84 1.2-4.84s-.3-.62-.3-1.53c0-1.43.83-2.5 1.87-2.5.88 0 1.31.66 1.31 1.45 0 .88-.56 2.21-.85 3.44-.24 1.03.52 1.87 1.55 1.87 1.86 0 3.29-1.96 3.29-4.79 0-2.5-1.8-4.25-4.37-4.25-2.98 0-4.73 2.24-4.73 4.55 0 .9.35 1.86.78 2.39.1.1.1.2.07.31-.08.32-.27 1.03-.31 1.18-.05.2-.17.24-.4.15-1.47-.68-2.39-2.83-2.39-4.55 0-3.7 2.69-7.1 7.76-7.1 4.07 0 7.24 2.91 7.24 6.79 0 4.05-2.55 7.31-6.1 7.31-1.19 0-2.31-.62-2.69-1.36l-.73 2.79c-.27 1.03-1 2.32-1.48 3.11A10 10 0 1 0 12 2Z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19 8.3c-1.7 0-3.2-.7-4.3-1.8v9.1c0 3.6-2.9 6.5-6.5 6.5S1.7 19.2 1.7 15.6 4.6 9.1 8.2 9.1c.5 0 1 .1 1.5.2v3.4c-.5-.2-1-.3-1.5-.3-1.7 0-3.1 1.4-3.1 3.1s1.4 3.1 3.1 3.1 3.1-1.4 3.1-3.1V1.5h3.4c0 2.5 2 4.5 4.5 4.5V8.3Z"/>
        </svg>
      );
    default: return null;
  }
};

const SiteFooter = () => {
  const { pick, locale } = useSite();
  const year = new Date().getFullYear();
  const { content: cmsContent, hasDbContent } = useStorefrontContent(
    tenantConfig.slug, 'navigation', navigationContent,
  );

  const footerCms = hasDbContent ? cmsContent.footer_columns : null;
  const settings = footerCms?._settings || {};

  // Resolve per-locale strings from CMS bag with fallback to legacy
  const fromCms = (field) => {
    if (!footerCms) return null;
    const local = footerCms[locale]?.[field];
    if (local) return local;
    for (const code of ['_default', 'it', 'en-US', 'en-GB', 'fr', 'de', 'es']) {
      if (footerCms[code]?.[field]) return footerCms[code][field];
    }
    return null;
  };

  const columns = Array.isArray(settings.columns) && settings.columns.length
    ? settings.columns.filter((c) => c.visible !== false).map((c) => ({
        id: c.id || c.title,
        title: pickContent(c.title, locale),
        links: (c.links || []).filter((l) => l.visible !== false).map((l, i) => ({
          key: `${c.id}-${i}`,
          href: l.href,
          label: pickContent(l.label, locale),
          target: l.open_in_new_tab ? '_blank' : undefined,
        })),
      }))
    : navigationContent.footer.columns.map((c) => ({
        id: c.id,
        title: pick(c.title),
        links: c.links.map((l, i) => ({ key: `${c.id}-${i}`, href: l.href, label: pick(l.label) })),
      }));

  const socials = Array.isArray(settings.socials) && settings.socials.length
    ? settings.socials.filter((s) => s.visible !== false)
    : navigationContent.footer.socials;

  const addrLines = Array.isArray(settings.showroom_address_lines) && settings.showroom_address_lines.length
    ? settings.showroom_address_lines
    : navigationContent.footer.showroom.addressLines;

  const showroomTitle  = fromCms('showroom_title')  || pick(navigationContent.footer.showroom.title);
  const bookCtaLabel   = fromCms('book_cta_label')  || pick(navigationContent.footer.showroom.bookCta.label);
  const bookCtaHref    = settings.book_cta_href     || navigationContent.footer.showroom.bookCta.href;
  const tagline        = fromCms('tagline')         || pick(navigationContent.footer.tagline);
  const copyrightTpl   = fromCms('copyright')       || pick(navigationContent.footer.copyright);
  const copy           = copyrightTpl.replace('{year}', year).replace('{brand}', navigationContent.brand.name);

  return (
    <footer className="mfd-footer" data-testid="site-footer" id="showroom">
      <div className="mfd-footer__grid">
        {/* Brand */}
        <div className="mfd-footer__col" data-testid="footer-brand">
          <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" className="mfd-footer__brand-mark" />
          <div className="mfd-footer__tagline">{tagline}</div>
          <div className="mfd-socials" style={{ marginTop: '1.5rem' }} data-testid="footer-socials">
            {socials.map((s) => (
              <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label || s.id} data-testid={`footer-social-${s.id}`}>
                <SocialIcon id={s.icon || s.id} />
              </a>
            ))}
          </div>
        </div>

        {/* Columns */}
        {columns.map((col) => (
          <div className="mfd-footer__col" key={col.id} data-testid={`footer-col-${col.id}`}>
            <h6>{col.title}</h6>
            <ul>
              {col.links.map((l) => (
                <li key={l.key}>
                  {l.href?.startsWith('http') || l.href?.startsWith('mailto:') || l.href?.startsWith('#') ? (
                    <a href={l.href} target={l.target}>{l.label}</a>
                  ) : (
                    <Link to={l.href || '#'}>{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Showroom */}
        <div className="mfd-footer__col mfd-footer__showroom" data-testid="footer-showroom">
          <h6>{showroomTitle}</h6>
          <address>
            {addrLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </address>
          <a href={bookCtaHref} className="mfd-btn mfd-btn--outline-paper" style={{ padding: '0.85rem 1.2rem', fontSize: 11 }} data-testid="footer-book-visit">
            {bookCtaLabel}
          </a>
        </div>
      </div>

      <div className="mfd-footer__bottom">
        <span>{copy}</span>
      </div>
    </footer>
  );
};

export default SiteFooter;
