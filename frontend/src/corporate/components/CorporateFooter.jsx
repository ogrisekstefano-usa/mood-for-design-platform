import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Linkedin, Globe } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';

const FOOTER_SECTIONS = {
  platform: {
    heading: { it: 'Piattaforma', 'en-us': 'Platform' },
    links: [
      { label: { it: 'Panoramica', 'en-us': 'Overview' }, href: '/platform' },
      { label: { it: 'Funzionalità', 'en-us': 'Features' }, href: '/platform#features' },
      { label: { it: 'Template', 'en-us': 'Templates' }, href: '/templates' },
      { label: { it: 'Blueprint Editor', 'en-us': 'Blueprint Editor' }, href: '/blueprint' },
      { label: { it: 'Prezzi', 'en-us': 'Pricing' }, href: '/pricing' },
    ],
  },
  resources: {
    heading: { it: 'Risorse', 'en-us': 'Resources' },
    links: [
      { label: { it: 'Centro Assistenza', 'en-us': 'Help Center' }, href: '#' },
      { label: { it: 'Guide', 'en-us': 'Guides' }, href: '#' },
      { label: { it: 'Journal', 'en-us': 'Journal' }, href: '/journal' },
      { label: { it: 'API Docs', 'en-us': 'API Docs' }, href: '#' },
    ],
  },
  company: {
    heading: { it: 'Azienda', 'en-us': 'Company' },
    links: [
      { label: { it: 'Chi siamo', 'en-us': 'About Us' }, href: '/about' },
      { label: { it: 'Journal', 'en-us': 'Journal' }, href: '/journal' },
      { label: { it: 'Contatti', 'en-us': 'Contact' }, href: '/contact' },
      { label: { it: 'Carriere', 'en-us': 'Careers' }, href: '#' },
    ],
  },
};

const l = (obj, locale) => obj?.[locale] || obj?.['en-us'] || '';

/**
 * CorporateFooter — 4-column editorial footer.
 * Dark background, multilingual, newsletter signup.
 */
const CorporateFooter = () => {
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleNewsletter = (e) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#0A0A0A] text-[#F9F9F8]" data-testid="corporate-footer">
      <div className="max-w-7xl mx-auto px-8 md:px-16 pt-20 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 pb-16 border-b border-[rgba(249,249,248,0.1)]">

          {/* Brand column */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-0 mb-6">
              <span className="font-serif text-2xl text-[#F9F9F8]" style={{ letterSpacing: '-0.02em' }}>M</span>
              <svg width="24" height="24" viewBox="0 0 22 22" fill="none" className="inline mx-0.5">
                <circle cx="8" cy="11" r="7" stroke="#3DDAD0" strokeWidth="2" fill="none" />
                <circle cx="14" cy="11" r="7" stroke="#3DDAD0" strokeWidth="2" fill="none" />
              </svg>
              <span className="font-serif text-2xl text-[#F9F9F8]" style={{ letterSpacing: '-0.02em' }}>D</span>
            </div>
            <p className="text-xs text-[rgba(249,249,248,0.4)] leading-relaxed mb-6 max-w-[200px]">
              {locale === 'it'
                ? 'Il sistema operativo per il mondo dell\'architettura e del design.'
                : 'The operating system for the architecture and design world.'}
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-[rgba(249,249,248,0.4)] hover:text-[#3DDAD0] transition-colors" aria-label="Instagram" data-testid="footer-instagram">
                <Instagram size={16} />
              </a>
              <a href="#" className="text-[rgba(249,249,248,0.4)] hover:text-[#3DDAD0] transition-colors" aria-label="LinkedIn" data-testid="footer-linkedin">
                <Linkedin size={16} />
              </a>
              <a href="#" className="text-[rgba(249,249,248,0.4)] hover:text-[#3DDAD0] transition-colors" aria-label="Website" data-testid="footer-website">
                <Globe size={16} />
              </a>
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(FOOTER_SECTIONS).map(([key, section]) => (
            <div key={key} className="lg:col-span-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3DDAD0] mb-6">
                {l(section.heading, locale)}
              </p>
              <ul className="space-y-3">
                {section.links.map((link, i) => (
                  <li key={i}>
                    <Link
                      to={link.href}
                      className="text-xs text-[rgba(249,249,248,0.5)] hover:text-[#F9F9F8] transition-colors"
                      data-testid={`footer-link-${key}-${i}`}
                    >
                      {l(link.label, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter */}
          <div className="lg:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3DDAD0] mb-6">
              {locale === 'it' ? 'Newsletter' : 'Newsletter'}
            </p>
            <p className="text-xs text-[rgba(249,249,248,0.5)] leading-relaxed mb-6">
              {locale === 'it'
                ? 'Rimani ispirato. Le ultime notizie e aggiornamenti da MOOD.'
                : 'Stay inspired. The latest news and updates from MOOD.'}
            </p>
            {submitted ? (
              <p className="text-xs text-[#3DDAD0]">
                {locale === 'it' ? 'Grazie! Sei nella lista.' : 'Thank you! You\'re on the list.'}
              </p>
            ) : (
              <form onSubmit={handleNewsletter} className="flex" data-testid="newsletter-form">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={locale === 'it' ? 'La tua email' : 'Your email'}
                  className="flex-1 bg-[rgba(249,249,248,0.08)] border border-[rgba(249,249,248,0.15)] px-4 py-3 text-xs text-[#F9F9F8] placeholder:text-[rgba(249,249,248,0.3)] focus:outline-none focus:border-[#3DDAD0] transition-colors"
                  data-testid="newsletter-email-input"
                  required
                />
                <button
                  type="submit"
                  className="bg-[#3DDAD0] text-[#0A0A0A] px-4 py-3 hover:bg-white transition-colors"
                  data-testid="newsletter-submit"
                  aria-label="Subscribe"
                >
                  →
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[rgba(249,249,248,0.3)]">
            © 2025 MOOD for DESIGN. {locale === 'it' ? 'Tutti i diritti riservati.' : 'All rights reserved.'}
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-[rgba(249,249,248,0.3)] hover:text-[#F9F9F8] transition-colors" data-testid="footer-privacy">
              {locale === 'it' ? 'Privacy Policy' : 'Privacy Policy'}
            </a>
            <a href="#" className="text-xs text-[rgba(249,249,248,0.3)] hover:text-[#F9F9F8] transition-colors" data-testid="footer-terms">
              {locale === 'it' ? 'Termini di Servizio' : 'Terms of Service'}
            </a>
            <a href="#" className="text-xs text-[rgba(249,249,248,0.3)] hover:text-[#F9F9F8] transition-colors" data-testid="footer-cookies">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default CorporateFooter;
