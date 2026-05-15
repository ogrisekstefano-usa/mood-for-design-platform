import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FOOTER_COLS = {
  platform: {
    heading: { it: 'Piattaforma', 'en-us': 'Platform' },
    links: [
      { label: { it: 'Panoramica', 'en-us': 'Overview' }, href: '/platform' },
      { label: { it: 'Funzionalità', 'en-us': 'Features' }, href: '/platform#features' },
      { label: { it: 'Blueprint Editor', 'en-us': 'Blueprint Editor' }, href: '/blueprint' },
      { label: { it: 'Template', 'en-us': 'Templates' }, href: '/templates' },
      { label: { it: 'Integrazioni', 'en-us': 'Integrations' }, href: '#' },
    ],
  },
  resources: {
    heading: { it: 'Risorse', 'en-us': 'Resources' },
    links: [
      { label: { it: 'Centro Assistenza', 'en-us': 'Help Center' }, href: '#' },
      { label: { it: 'Guide', 'en-us': 'Guides' }, href: '#' },
      { label: { it: 'Journal', 'en-us': 'Journal' }, href: '/journal' },
      { label: { it: 'API Docs', 'en-us': 'API Docs' }, href: '#' },
      { label: { it: 'Status', 'en-us': 'Status' }, href: '#' },
    ],
  },
  company: {
    heading: { it: 'Azienda', 'en-us': 'Company' },
    links: [
      { label: { it: 'Chi siamo', 'en-us': 'About Us' }, href: '/about' },
      { label: { it: 'Carriere', 'en-us': 'Careers' }, href: '#' },
      { label: { it: 'Journal', 'en-us': 'Journal' }, href: '/journal' },
      { label: { it: 'Stampa', 'en-us': 'Press' }, href: '#' },
      { label: { it: 'Contatti', 'en-us': 'Contact' }, href: '/contact' },
    ],
  },
};

const L = (obj, locale) => obj?.[locale] || obj?.['en-us'] || '';

const CorporateFooter = () => {
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleNewsletter = async (e) => {
    e.preventDefault();
    if (!email) return;
    try {
      await axios.post(`${BACKEND_URL}/api/corporate/newsletter`, { email, locale });
      setSubscribed(true);
      setEmail('');
    } catch { setSubscribed(true); }
  };

  return (
    <footer style={{ background: 'var(--mood-onyx)', color: '#FFFFFF' }} data-testid="corporate-footer">
      <div className="max-w-screen-xl mx-auto px-8 md:px-16 pt-20 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-16" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Brand */}
          <div className="lg:col-span-3">
            {/* MOOD logo */}
            <div className="flex items-center mb-5">
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '1.3rem', color: '#FFFFFF', letterSpacing: '-0.01em' }}>M</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ margin: '0 1px' }}>
                <circle cx="8" cy="12" r="7.5" stroke="#3DDAD0" strokeWidth="2" fill="none" />
                <circle cx="16" cy="12" r="7.5" stroke="#3DDAD0" strokeWidth="2" fill="none" />
              </svg>
              <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '1.3rem', color: '#FFFFFF', letterSpacing: '-0.01em' }}>D</span>
              <span style={{ marginLeft: '8px', display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)' }}>for</span>
                <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '0.5rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)' }}>DESIGN</span>
              </span>
            </div>
            <p style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, marginBottom: '1.5rem', maxWidth: '180px' }}>
              Inspiration. Design. Solutions.
            </p>
            <div className="flex gap-4">
              {[Instagram, Linkedin, Twitter, Youtube].map((Icon, i) => (
                <a key={i} href="#" style={{ color: 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.color = '#3DDAD0'}
                   onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                   data-testid={`footer-social-${i}`}>
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Nav cols */}
          {Object.entries(FOOTER_COLS).map(([key, col]) => (
            <div key={key} className="lg:col-span-2">
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#3DDAD0', marginBottom: '1.5rem' }}>
                {L(col.heading, locale)}
              </p>
              <ul className="space-y-3">
                {col.links.map((link, i) => (
                  <li key={i}>
                    <Link
                      to={link.href}
                      style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', fontWeight: 400, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.target.style.color = '#FFFFFF'}
                      onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.45)'}
                      data-testid={`footer-link-${key}-${i}`}
                    >
                      {L(link.label, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter */}
          <div className="lg:col-span-3">
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#3DDAD0', marginBottom: '1.5rem' }}>
              Newsletter
            </p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {locale === 'it' ? 'Rimani ispirato. Aggiornamenti ed editoriali da MOOD.' : 'Stay inspired. News and editorial from MOOD.'}
            </p>
            {subscribed ? (
              <p style={{ fontSize: '0.72rem', color: '#3DDAD0' }}>
                {locale === 'it' ? 'Grazie! Sei nella lista.' : 'Thank you! You\'re on the list.'}
              </p>
            ) : (
              <form onSubmit={handleNewsletter} className="flex" data-testid="newsletter-form">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={locale === 'it' ? 'La tua email' : 'Your email'}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRight: 'none', padding: '0.75rem 1rem', fontSize: '0.72rem', color: '#FFFFFF', outline: 'none', fontFamily: 'Montserrat, sans-serif' }}
                  onFocus={e => e.target.style.borderColor = '#3DDAD0'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
                  required
                  data-testid="newsletter-email-input"
                />
                <button
                  type="submit"
                  style={{ background: '#3DDAD0', color: '#FFFFFF', padding: '0 1rem', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, transition: 'background 0.2s' }}
                  onMouseEnter={e => e.target.style.background = '#2BB9B0'}
                  onMouseLeave={e => e.target.style.background = '#3DDAD0'}
                  data-testid="newsletter-submit"
                >
                  →
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'Montserrat, sans-serif' }}>
            © 2025 MOOD for DESIGN. {locale === 'it' ? 'Tutti i diritti riservati.' : 'All rights reserved.'}
          </p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Cookies'].map((t, i) => (
              <a key={i} href="#"
                 style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'Montserrat, sans-serif', textDecoration: 'none', transition: 'color 0.2s' }}
                 onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.7)'}
                 onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.25)'}
                 data-testid={`footer-legal-${i}`}>
                {t}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default CorporateFooter;
