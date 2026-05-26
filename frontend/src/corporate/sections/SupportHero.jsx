import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, HelpCircle, MessageSquare, Activity, Search } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';
import { linkTarget } from '../utils/linkTarget';

/**
 * SupportHero — panoramic hero with search bar + 4 quick-access cards.
 *
 * Layout: full-width photograph as background, horizontal left-to-right
 * black veil. Text overlay top-left contains:
 *   eyebrow · serif title · body · search input · 4 small icon cards
 *
 * content: { eyebrow, title, body, search_placeholder, quick_label,
 *            link_01_label, link_02_label, link_03_label, link_04_label }
 * media:   { background: { url, alt } }
 * links:   { link_01_href, link_02_href, link_03_href, link_04_href,
 *            search_action }
 */
const QUICK_ICONS = [BookOpen, HelpCircle, MessageSquare, Activity];

const SupportHero = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const [query, setQuery] = useState('');
  const bg = media.background;

  const quickLinks = [1, 2, 3, 4].map((n) => {
    const k = String(n).padStart(2, '0');
    return {
      n: k,
      label: content[`link_${k}_label`],
      href:  links[`link_${k}_href`] || '#',
      target: links[`link_${k}_target`],
      Icon:  QUICK_ICONS[n - 1],
    };
  }).filter((q) => q.label && q.label.trim());

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
      style={{ background: '#000000', minHeight: 'clamp(640px, 84vh, 920px)' }}
      data-testid="support-hero"
    >
      {bg && bg.url && (
        <img
          src={bg.url} alt={bg.alt || ''}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 40%',
          }}
          loading="eager"
        />
      )}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.94) 22%, rgba(0,0,0,0.78) 42%, rgba(0,0,0,0.5) 62%, rgba(0,0,0,0.18) 78%, rgba(0,0,0,0) 92%)',
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20 py-20 lg:py-28">
        <div className="w-full max-w-[620px]">
          {content.eyebrow && (
            <p
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', fontWeight: 500,
                letterSpacing: '0.24em', textTransform: 'uppercase',
                color: 'var(--mood-teal, #00C9B3)', marginBottom: '2rem',
              }}
              data-testid="support-hero-eyebrow"
            >
              {content.eyebrow}
            </p>
          )}
          {content.title && (
            <h1
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: 'clamp(2.6rem, 4.8vw, 4.6rem)', lineHeight: 1.04,
                letterSpacing: '-0.02em', color: '#FFFFFF',
                maxWidth: '14ch',
              }}
              data-testid="support-hero-title"
            >
              {content.title}
            </h1>
          )}
          {content.body && (
            <p
              className="mt-7 lg:mt-9"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(1rem, 1.12vw, 1.08rem)',
                lineHeight: 1.72, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                maxWidth: '46ch',
              }}
              data-testid="support-hero-body"
            >
              {content.body}
            </p>
          )}

          {/* Search bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); if (links.search_action) { window.location.href = `${links.search_action}?q=${encodeURIComponent(query)}`; } }}
            className="mt-10 lg:mt-12"
            data-testid="support-hero-search-form"
          >
            <div
              style={{
                display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                padding: '0 1.2rem',
                transition: 'all 0.25s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)'; }}
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={content.search_placeholder || 'Cerca tra le risorse di supporto…'}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#FFFFFF',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 300,
                  padding: '1.05rem 0',
                }}
                data-testid="support-hero-search-input"
              />
              <button
                type="submit"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--mood-teal, #00C9B3)',
                  padding: '0 0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                }}
                aria-label="Cerca"
                data-testid="support-hero-search-submit"
              >
                <Search size={18} strokeWidth={1.5} />
              </button>
            </div>
          </form>

          {/* Quick access cards */}
          {quickLinks.length > 0 && (
            <div className="mt-8 lg:mt-10">
              {content.quick_label && (
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
                    color: 'rgba(255,255,255,0.5)', fontWeight: 300,
                    marginBottom: '1.2rem',
                  }}
                  data-testid="support-hero-quick-label"
                >
                  {content.quick_label}
                </p>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: '0.7rem', maxWidth: 540,
                }}
              >
                {quickLinks.map((q) => (
                  <Link
                    key={q.n}
                    to={q.href}
                    {...linkTarget(q.target)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '0.6rem', padding: '1.1rem 0.6rem',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
                      transition: 'all 0.25s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,201,179,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,201,179,0.32)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    data-testid={`support-hero-quick-${q.n}`}
                  >
                    <q.Icon size={20} strokeWidth={1.3} color="var(--mood-teal, #00C9B3)" />
                    <span
                      style={{
                        fontFamily: 'Inter, sans-serif', fontSize: '0.7rem',
                        textAlign: 'center', lineHeight: 1.25, fontWeight: 300,
                      }}
                    >
                      {q.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SupportHero;
