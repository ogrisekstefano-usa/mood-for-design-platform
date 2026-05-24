import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useSiteNavigation } from '../hooks/useSiteChrome';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_editorial-platform-4/artifacts/chlucgqo_Artboard%201.png";

const LogoLink = ({ compact = false }) => (
  <Link to="/" className="inline-flex items-center" style={{ textDecoration: 'none' }} data-testid="nav-logo">
    <img
      src={LOGO_URL}
      alt="MOOD for DESIGN"
      style={{ height: compact ? 40 : 50, width: 'auto', display: 'block' }}
      draggable={false}
    />
  </Link>
);

/**
 * MinimalNav — ITER149 navigation matching the official mockup.
 * Left: Logo. Center: Magazine · Projects · Materials · About.
 * Right: Sign in · Begin your Journey (outline) · Professional Access (cyan filled).
 */
const MinimalNav = () => {
  const location = useLocation();
  const { main, cta, secondary_cta } = useSiteNavigation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const centerMain = main.filter((m) => m.key !== 'sign_in');
  const signIn     = main.find((m) => m.key === 'sign_in');

  const showSolid = scrolled || mobileOpen;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: showSolid ? '#000000' : 'transparent',
        borderBottom: showSolid ? '1px solid var(--mood-line-soft)' : '1px solid transparent',
      }}
      data-testid="minimal-nav"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 flex items-center h-[92px] gap-6">
        <LogoLink />

        <div className="hidden lg:flex items-center gap-9 mx-auto">
          {centerMain.map(item => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.key}
                to={item.href}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.98rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive ? 'var(--mood-teal)' : 'var(--mood-text-1)',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? 'var(--mood-teal)' : 'var(--mood-text-1)')}
                data-testid={`nav-link-${item.key}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-4 ml-auto">
          {signIn && (
            <Link
              to={signIn.href}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.95rem',
                fontWeight: 500,
                color: 'var(--mood-text-1)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mood-text-1)')}
              data-testid="nav-sign-in"
            >
              {signIn.label}
            </Link>
          )}
          {cta && (
            <Link to={cta.href} className="btn-pill-outline" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }} data-testid="nav-primary-cta">
              {cta.label}
            </Link>
          )}
          {secondary_cta && (
            <Link to={secondary_cta.href} className="btn-pill-teal" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }} data-testid="nav-secondary-cta">
              {secondary_cta.label}
            </Link>
          )}
        </div>

        <button
          className="lg:hidden ml-auto p-2"
          style={{ color: 'var(--mood-text-1)' }}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
          data-testid="mobile-menu-toggle"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden px-6 py-8 space-y-5 border-t"
          style={{ background: '#000000', borderColor: 'var(--mood-line-soft)' }}
        >
          {main.map(item => (
            <Link
              key={item.key}
              to={item.href}
              style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '1.05rem', fontWeight: 500, color: 'var(--mood-text-1)', textDecoration: 'none' }}
              data-testid={`mobile-nav-${item.key}`}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--mood-line-soft)' }}>
            {cta && <Link to={cta.href} className="btn-pill-outline" style={{ padding: '0.7rem 1.4rem', fontSize: '0.85rem', justifyContent: 'center' }}>{cta.label}</Link>}
            {secondary_cta && <Link to={secondary_cta.href} className="btn-pill-teal" style={{ padding: '0.7rem 1.4rem', fontSize: '0.85rem', justifyContent: 'center' }}>{secondary_cta.label}</Link>}
          </div>
        </div>
      )}
    </nav>
  );
};

export default MinimalNav;
