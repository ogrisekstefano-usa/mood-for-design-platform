import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * MaterialsBrandPartners — editorial section about curated brand partnerships.
 * Per directive: no fake brand logos. Pure typographic + value statement section.
 *
 * content: { eyebrow, title, body, cta }
 * links:   { cta_href }
 */
const MaterialsBrandPartners = ({ content = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });

  return (
    <section className="relative grain overflow-hidden" style={{ background: 'var(--mood-black)' }} data-testid="materials-partners">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <div ref={ref} className="max-w-screen-xl mx-auto px-6 md:px-10 lg:px-14 py-24 lg:py-36">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            {content.eyebrow && (
              <p className={`overline-teal reveal ${visible ? 'visible' : ''}`}>{content.eyebrow}</p>
            )}
          </div>
          <div className="lg:col-span-7">
            {content.title && (
              <h2
                className={`font-serif font-normal text-white leading-[1.06] reveal ${visible ? 'visible' : ''}`}
                style={{ fontSize: 'clamp(2.2rem, 4vw, 3.8rem)', whiteSpace: 'pre-line', transitionDelay: '0.05s' }}
              >
                {content.title}
              </h2>
            )}
            {content.body && (
              <p
                className={`mt-8 font-light leading-relaxed reveal ${visible ? 'visible' : ''}`}
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '1.05rem',
                  color: 'rgba(255,255,255,0.6)',
                  maxWidth: '52ch',
                  transitionDelay: '0.15s',
                }}
              >
                {content.body}
              </p>
            )}
            {content.cta && (
              <a
                href={links.cta_href || '#'}
                className={`mt-10 inline-flex items-center gap-2 uppercase reveal ${visible ? 'visible' : ''}`}
                style={{
                  color: '#00C9B3',
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: '0.74rem',
                  letterSpacing: '0.22em',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transitionDelay: '0.25s',
                }}
                data-testid="materials-cta"
              >
                {content.cta} <ArrowRight size={14} strokeWidth={1.6} />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MaterialsBrandPartners;
