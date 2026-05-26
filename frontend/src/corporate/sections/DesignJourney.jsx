import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';
import MediaTile from '../components/MediaTile';
import { linkTarget } from '../utils/linkTarget';

/**
 * DesignJourney — "From atmosphere to realization."
 * 4 editorial cards (Ascolto / Curatela / Progetto / Realizzazione) with
 * cinematic interior photography from media_library.
 * Left rail: section title. Right: 4 image cards in a row.
 */
const STEPS = ['s1', 's2', 's3', 's4'];

const DesignJourney = ({ content = {}, media = {}, mediaActions = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });

  return (
    <section
      className="relative"
      style={{ background: '#000000', borderTop: '1px solid var(--mood-line-soft)' }}
      data-testid="design-journey"
    >
      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          {/* Left rail */}
          <div className="lg:col-span-3">
            {content.eyebrow && (
              <p className={`overline-teal mb-5 reveal ${visible ? 'visible' : ''}`}>{content.eyebrow}</p>
            )}
            {(content.title_pre || content.title_accent) && (
              <h2
                className={`reveal ${visible ? 'visible' : ''}`}
                style={{
                  fontFamily: 'Playfair Display, serif',
                  fontWeight: 400,
                  fontSize: 'var(--fs-h2)',
                  lineHeight: 1.08,
                  color: 'var(--mood-text-1)',
                  transitionDelay: '0.06s',
                }}
              >
                {content.title_pre && <span>{content.title_pre}</span>}
                {content.title_accent && (
                  <>
                    {' '}
                    <em style={{ color: 'var(--mood-teal)', fontStyle: 'italic' }}>{content.title_accent}</em>
                  </>
                )}
              </h2>
            )}
          </div>

          {/* Right grid */}
          <div className="lg:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((k, i) => {
              const title = content[`${k}.title`];
              const body  = content[`${k}.body`];
              const img   = media[k];
              if (!title) return null;
              return (
                <div
                  key={k}
                  className={`reveal ${visible ? 'visible' : ''}`}
                  style={{ transitionDelay: `${0.1 + i * 0.08}s` }}
                  data-testid={`journey-step-${i + 1}`}
                >
                  {img && img.url && (
                    <MediaTile
                      media={img}
                      action={mediaActions[k]}
                      wrapperStyle={{ aspectRatio: '4/5', borderRadius: 4 }}
                      testid={`journey-tile-${k}`}
                    />
                  )}
                  <div className="mt-5 flex items-center gap-3">
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', color: 'var(--mood-teal)', fontWeight: 600, letterSpacing: '0.06em' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(0,201,179,0.45)' }} />
                  </div>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 500, fontSize: '1.45rem', color: 'var(--mood-text-1)', marginTop: 8 }}>
                    {title}
                  </h3>
                  {body && (
                    <p style={{ marginTop: 8, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', lineHeight: 1.55, color: 'var(--mood-text-2)' }}>
                      {body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {content.cta && (
          <div className="mt-14 text-center">
            <a
              href={links.cta_href || '#'}
              {...linkTarget(links.cta_target)}
              className="inline-flex items-center gap-2"
              style={{
                color: 'var(--mood-teal)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '1rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
              data-testid="journey-cta"
            >
              {content.cta} <ArrowRight size={16} strokeWidth={1.6} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default DesignJourney;
