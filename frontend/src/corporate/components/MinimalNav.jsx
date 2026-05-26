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
 * MinimalNav — ITER151 navigation.
 * Left: Logo.
 * Center: main items (Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione).
 * Right: secondary links (Supporto · Accedi) — no pill CTAs.
 * Driven by /api/site/navigation → { main, right }.
 */
const MinimalNav = () => {
  const location = useLocation();
  const { main, right } = useSiteNavigation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const showSolid = true;
  const linkColor = (active) => (active ? 'var(--mood-teal)' : 'var(--mood-text-1)');

  const NavLink = ({ item, testid, fontSize = '0.98rem' }) => {
    const active = location.pathname === item.href;
    return (
      <Link
        to={item.href}
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize,
          fontWeight: 500,
          textDecoration: 'none',
          color: linkColor(active),
          transition: 'color 0.2s',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mood-teal)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = linkColor(active))}
        data-testid={testid}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: showSolid ? 'rgba(18,18,18,0.78)' : 'transparent',
        backdropFilter: showSolid ? 'blur(18px) saturate(140%)' : 'none',
        WebkitBackdropFilter: showSolid ? 'blur(18px) saturate(140%)' : 'none',
        borderBottom: showSolid ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
      data-testid="minimal-nav"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 flex items-center h-[92px] gap-6">
        <LogoLink />

        {/* Center: main */}
        <div className="hidden lg:flex items-center gap-9 mx-auto">
          {main.map((item) => (
            <NavLink key={item.key} item={item} testid={`nav-link-${item.key}`} />
          ))}
        </div>

        {/* Right: secondary links — plain, no pills */}
        <div className="hidden lg:flex items-center gap-7 ml-auto">
          {right.map((item, idx) => (
            <NavLink
              key={item.key}
              item={item}
              testid={`nav-right-${item.key}`}
              fontSize={idx === right.length - 1 ? '0.92rem' : '0.92rem'}
            />
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden ml-auto p-2"
          style={{ color: 'var(--mood-text-1)' }}
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
          data-testid="mobile-menu-toggle"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden px-6 py-8 space-y-5 border-t"
          style={{ background: 'rgba(18,18,18,0.92)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderColor: 'rgba(255,255,255,0.06)' }}
          data-testid="mobile-nav-panel"
        >
          {[...main, ...right].map((item) => (
            <Link
              key={item.key}
              to={item.href}
              style={{
                display: 'block', fontFamily: 'Inter, sans-serif',
                fontSize: '1.05rem', fontWeight: 500,
                color: 'var(--mood-text-1)', textDecoration: 'none',
              }}
              data-testid={`mobile-nav-${item.key}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default MinimalNav;
