import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Globe, ChevronDown } from 'lucide-react';
import { useLocale } from '../../contexts/LocaleContext';
import LocaleSwitcher from './LocaleSwitcher';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * MOOD Logo — brand-accurate wordmark.
 * M + teal OO circles + D with "for DESIGN" subtitle
 */
const MoodLogo = ({ compact = false }) => (
  <Link to="/" className="flex items-center" style={{ textDecoration: 'none', gap: '0px' }} data-testid="corporate-nav-logo">
    <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: compact ? '1.15rem' : '1.25rem', color: '#1A1A1A', letterSpacing: '-0.01em' }}>
      M
    </span>
    <svg width={compact ? 20 : 24} height={compact ? 20 : 24} viewBox="0 0 24 24" fill="none" style={{ margin: '0 1px', display: 'inline-block', verticalAlign: 'middle' }}>
      <circle cx="8" cy="12" r="7.5" stroke="#00C9B3" strokeWidth="2" fill="none" />
      <circle cx="16" cy="12" r="7.5" stroke="#00C9B3" strokeWidth="2" fill="none" />
    </svg>
    <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: compact ? '1.15rem' : '1.25rem', color: '#1A1A1A', letterSpacing: '-0.01em' }}>
      D
    </span>
    {!compact && (
      <span style={{ marginLeft: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.1 }}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '0.52rem', color: '#6B6E71', lineHeight: 1 }}>for</span>
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '0.52rem', letterSpacing: '0.12em', color: '#1A1A1A', lineHeight: 1 }}>DESIGN</span>
      </span>
    )}
  </Link>
);

/**
 * CorporateNav — Minimal editorial nav for www.moodfordesign.com
 * Transparent on hero, glassmorphism on scroll.
 * Locale switcher, teal-outlined CTA.
 */
const CorporateNav = () => {
  const location = useLocation();
  const { locale } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navItems, setNavItems] = useState([]);
  const [ctaItem, setCtaItem] = useState({ label: 'Start Your Studio', href: '/start-studio' });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/corporate/navigation?locale=${locale}`)
      .then(res => {
        if (res.data?.main) setNavItems(res.data.main);
        if (res.data?.cta) setCtaItem(res.data.cta);
      })
      .catch(() => {});
  }, [locale]);

  const isOnHero = location.pathname === '/';
  const showSolid = scrolled || mobileOpen || !isOnHero;

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: showSolid ? 'rgba(255,255,255,0.96)' : 'transparent',
          backdropFilter: showSolid ? 'blur(24px)' : 'none',
          borderBottom: showSolid ? '1px solid rgba(26,26,26,0.08)' : '1px solid transparent',
        }}
        data-testid="corporate-nav"
      >
        <div className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 flex items-center h-[68px]">

          {/* Logo */}
          <MoodLogo />

          {/* Desktop nav — centered */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8 mx-auto">
            {navItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                className="transition-colors duration-200"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  color: location.pathname === item.href ? '#00C9B3' : '#1A1A1A',
                }}
                data-testid={`nav-link-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right: locale + CTA */}
          <div className="hidden lg:flex items-center gap-5 ml-auto">
            <LocaleSwitcher />
            <Link
              to={ctaItem.href || '/start-studio'}
              className="btn-secondary"
              style={{ padding: '0.6rem 1.4rem', fontSize: '0.68rem' }}
              data-testid="corporate-nav-cta"
            >
              {ctaItem.label || 'Start Your Studio'}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden ml-auto p-2"
            style={{ color: '#1A1A1A' }}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div
            className="lg:hidden px-6 py-8 space-y-5 border-t"
            style={{ background: '#FFFFFF', borderColor: 'rgba(26,26,26,0.08)' }}
          >
            {navItems.map(item => (
              <Link
                key={item.key}
                to={item.href}
                style={{ display: 'block', fontFamily: 'Montserrat, sans-serif', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1A1A1A', textDecoration: 'none' }}
                data-testid={`mobile-nav-${item.key}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(26,26,26,0.08)' }}>
              <LocaleSwitcher />
              <Link to="/start-studio" className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.68rem' }} data-testid="mobile-nav-cta">
                {ctaItem.label || 'Start Your Studio'}
              </Link>
            </div>
          </div>
        )}
      </nav>
      {/* Spacer for non-hero pages */}
      {!isOnHero && <div style={{ height: '68px' }} />}
    </>
  );
};

export default CorporateNav;
