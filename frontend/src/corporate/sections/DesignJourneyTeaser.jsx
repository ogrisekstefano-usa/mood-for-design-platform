/**
 * DesignJourneyTeaser.jsx
 * Phase 3 — Task 4.
 *
 * Static teaser banner injected between the hero and the first body section
 * of the HomePage. Announces "Design Journey™ — Coming soon" with editorial
 * gravitas. Fully responsive (mobile-first).
 *
 * No props required. Self-contained. The "/design-journey" route is LOCKED
 * and must NOT be linked until the Trust Layer is published.
 */
import React, { useEffect, useRef } from 'react';
import { useLocale } from '../../contexts/LocaleContext';

const COPY = {
  it: {
    eyebrow:   'Prossimamente',
    headline:  'Design Journey™',
    body:      'Il metodo che guida il progetto contemporaneo — dalla prima ispirazione alla consegna. Sette fasi. Una narrazione continua.',
    badge:     'In arrivo',
  },
  en: {
    eyebrow:   'Coming soon',
    headline:  'Design Journey™',
    body:      'The methodology that guides the contemporary project — from first inspiration to delivery. Seven phases. One continuous narrative.',
    badge:     'Upcoming',
  },
};

const DesignJourneyTeaser = () => {
  const { locale } = useLocale();
  // Fallback al valore in localStorage per evitare flash di EN su prima visita IT
  const resolvedLocale = locale || (() => {
    try { return localStorage.getItem('mood-locale') || localStorage.getItem('mood_locale') || ''; } catch { return ''; }
  })();
  const isIT = resolvedLocale.startsWith('it');
  const copy = isIT ? COPY.it : COPY.en;
  const barRef = useRef(null);

  // Entrance animation — fade + rise on mount
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      ref={barRef}
      data-testid="design-journey-teaser"
      aria-label={copy.headline}
      style={{
        background: 'linear-gradient(105deg, #0D0D0D 0%, #111111 60%, #0A1A17 100%)',
        borderTop:    '1px solid rgba(0,201,179,0.18)',
        borderBottom: '1px solid rgba(0,201,179,0.18)',
        padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1.5rem, 6vw, 6rem)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative glow */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '-60px', right: '-60px',
        width: 320, height: 320,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,201,179,0.09) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 'clamp(1.5rem, 4vw, 3rem)',
        alignItems: 'center',
      }}
        className="design-journey-teaser-grid"
      >
        {/* Left — eyebrow + headline + body */}
        <div style={{ gridColumn: '1 / 3' }}>
          <p
            data-testid="teaser-eyebrow"
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#00C9B3',
              marginBottom: '0.6rem',
              fontWeight: 600,
            }}
          >
            {copy.eyebrow}
          </p>

          <h2
            data-testid="teaser-headline"
            style={{
              fontFamily: "'Playfair Display', 'Georgia', serif",
              fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)',
              fontWeight: 700,
              fontStyle: 'italic',
              color: '#FFFFFF',
              lineHeight: 1.15,
              margin: '0 0 0.75rem',
              letterSpacing: '-0.01em',
            }}
          >
            {copy.headline}
          </h2>

          <p
            data-testid="teaser-body"
            style={{
              fontSize: 'clamp(0.88rem, 1.5vw, 1rem)',
              color: 'rgba(255,255,255,0.58)',
              lineHeight: 1.7,
              maxWidth: 580,
              margin: 0,
            }}
          >
            {copy.body}
          </p>
        </div>

        {/* Right — "Coming soon" badge */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.5rem',
          flexShrink: 0,
        }}>
          <span
            data-testid="teaser-badge"
            style={{
              display: 'inline-block',
              padding: '0.45rem 1rem',
              border: '1px solid rgba(0,201,179,0.4)',
              borderRadius: 2,
              fontSize: '0.72rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#00C9B3',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {copy.badge}
          </span>

          {/* Decorative number */}
          <span aria-hidden="true" style={{
            fontSize: '3.5rem',
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontStyle: 'italic',
            color: 'rgba(0,201,179,0.08)',
            lineHeight: 1,
            userSelect: 'none',
          }}>
            07
          </span>
        </div>
      </div>

      {/* Mobile: stack layout */}
      <style>{`
        @media (max-width: 640px) {
          .design-journey-teaser-grid {
            grid-template-columns: 1fr !important;
          }
          .design-journey-teaser-grid > :last-child {
            align-items: flex-start !important;
            flex-direction: row !important;
            gap: 0.75rem !important;
          }
        }
      `}</style>
    </section>
  );
};

export default DesignJourneyTeaser;
