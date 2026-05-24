import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { useSiteFooter } from '../hooks/useSiteChrome';
import LocaleSwitcher from './LocaleSwitcher';

const SOCIAL_ICONS = {
  instagram: Instagram,
  linkedin:  Linkedin,
  twitter:   Twitter,
  youtube:   Youtube,
};

/**
 * SlimFooter — ITER149 minimal footer.
 * 100% DB-driven via /api/site/footer.
 * Layout: manifesto line on top, single-row links, locale switcher + social.
 */
const SlimFooter = () => {
  const { manifesto, copyright, links, legal, social } = useSiteFooter();

  return (
    <footer style={{ background: 'var(--mood-black)', color: '#FFFFFF', borderTop: '1px solid rgba(255,255,255,0.06)' }} data-testid="slim-footer">
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 pt-16 pb-10">
        {manifesto && (
          <p
            className="font-serif italic"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 'clamp(1rem, 1.4vw, 1.3rem)',
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.78)',
              maxWidth: 680,
              marginBottom: '3.5rem',
            }}
            data-testid="footer-manifesto"
          >
            {manifesto}
          </p>
        )}

        {/* Single-row link strip */}
        {links?.length > 0 && (
          <div className="flex flex-wrap gap-x-8 gap-y-4 mb-10 pb-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {links.map((L, i) => (
              <Link
                key={L.key || i}
                to={L.href}
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '0.8rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.78)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#00C9B3')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.78)')}
                data-testid={`footer-link-${L.key}`}
              >
                {L.label}
              </Link>
            ))}
          </div>
        )}

        {/* Bottom row: copyright + legal + social + locale */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center flex-wrap gap-x-6 gap-y-2">
            {copyright && (
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)' }}
                 data-testid="footer-copyright">
                {copyright}
              </p>
            )}
            {legal?.length > 0 && legal.map((L, i) => (
              <a
                key={L.key || i}
                href={L.href}
                style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                data-testid={`footer-legal-${L.key}`}
              >
                {L.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-5">
            {social?.length > 0 && (
              <div className="flex items-center gap-4">
                {social.map((s, i) => {
                  const Icon = SOCIAL_ICONS[s.icon] || Instagram;
                  return (
                    <a key={s.key || i} href={s.href} target="_blank" rel="noopener noreferrer"
                       style={{ color: 'rgba(255,255,255,0.45)', transition: 'color 0.2s' }}
                       onMouseEnter={(e) => (e.currentTarget.style.color = '#00C9B3')}
                       onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                       data-testid={`footer-social-${s.key}`}
                    >
                      <Icon size={16} strokeWidth={1.4} />
                    </a>
                  );
                })}
              </div>
            )}
            <LocaleSwitcher dark />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SlimFooter;
