import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * PageIntro — minimal editorial intro block with optional CTA.
 * content: { body, cta_label }
 * links:   { cta_href }
 */
const PageIntro = ({ content = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });

  return (
    <section
      className="py-24 lg:py-32"
      style={{ background: '#000000' }}
      data-testid="page-intro"
    >
      <div
        ref={ref}
        className={`max-w-screen-xl mx-auto px-6 md:px-10 lg:px-16 reveal ${visible ? 'visible' : ''}`}
      >
        {content.body && (
          <p
            style={{
              fontFamily: 'Playfair Display, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(1.4rem, 2.2vw, 2rem)',
              lineHeight: 1.45,
              letterSpacing: '-0.005em',
              color: 'var(--mood-text-1)',
              maxWidth: '36ch',
            }}
            data-testid="page-intro-body"
          >
            {content.body}
          </p>
        )}

        {content.cta_label && (
          <div className="mt-12">
            <Link
              to={links.cta_href || '/'}
              className="btn-pill-outline"
              style={{
                padding: '0.85rem 1.6rem',
                fontSize: '0.78rem',
                letterSpacing: '0.08em',
              }}
              data-testid="page-intro-cta"
            >
              {content.cta_label}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default PageIntro;
