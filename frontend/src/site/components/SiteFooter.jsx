import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin } from 'lucide-react';
import { useSite } from '../SiteContext';
import { navigationContent } from '../content/navigation';

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
  const { pick } = useSite();
  const year = new Date().getFullYear();
  const copy = pick(navigationContent.footer.copyright)
    .replace('{year}', year)
    .replace('{brand}', navigationContent.brand.name);
  const showroom = navigationContent.footer.showroom;

  return (
    <footer className="mfd-footer" data-testid="site-footer" id="showroom">
      <div className="mfd-footer__grid">
        {/* Brand */}
        <div className="mfd-footer__col" data-testid="footer-brand">
          <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" className="mfd-footer__brand-mark" />
          <div className="mfd-footer__tagline">{pick(navigationContent.footer.tagline)}</div>
          <div className="mfd-socials" style={{ marginTop: '1.5rem' }} data-testid="footer-socials">
            {navigationContent.footer.socials.map((s) => (
              <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} data-testid={`footer-social-${s.id}`}>
                <SocialIcon id={s.icon} />
              </a>
            ))}
          </div>
        </div>

        {/* Columns */}
        {navigationContent.footer.columns.map((col) => (
          <div className="mfd-footer__col" key={col.id} data-testid={`footer-col-${col.id}`}>
            <h6>{pick(col.title)}</h6>
            <ul>
              {col.links.map((l, i) => (
                <li key={`${col.id}-${i}`}>
                  {l.href.startsWith('http') || l.href.startsWith('mailto:') || l.href.startsWith('#') ? (
                    <a href={l.href}>{pick(l.label)}</a>
                  ) : (
                    <Link to={l.href}>{pick(l.label)}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Showroom */}
        <div className="mfd-footer__col mfd-footer__showroom" data-testid="footer-showroom">
          <h6>{pick(showroom.title)}</h6>
          <address>
            {showroom.addressLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </address>
          <a href={showroom.bookCta.href} className="mfd-btn mfd-btn--outline-paper" style={{ padding: '0.85rem 1.2rem', fontSize: 11 }} data-testid="footer-book-visit">
            {pick(showroom.bookCta.label)}
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
