import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * EditorialTriptych — three wide editorial cards for Magazine / Projects /
 * Materials. Each card: hero image with text overlay (left-aligned).
 * No public dates per ITER149 directive.
 */
const TILES = ['magazine', 'projects', 'materials'];

const EditorialTriptych = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });

  return (
    <section
      className="relative"
      style={{ background: 'var(--mood-black)' }}
      data-testid="editorial-triptych"
    >
      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {TILES.map((k, i) => {
            const cat   = content[`${k}.category`];
            const title = content[`${k}.title`];
            const cta   = content[`${k}.cta`];
            const img   = media[k];
            const href  = links[`${k}_href`] || '#';
            if (!title) return null;
            return (
              <a
                key={k}
                href={href}
                className={`group relative block overflow-hidden reveal ${visible ? 'visible' : ''}`}
                style={{
                  aspectRatio: '5/4',
                  borderRadius: 4,
                  textDecoration: 'none',
                  transitionDelay: `${i * 0.08}s`,
                }}
                data-testid={`triptych-${k}`}
              >
                {img && img.url && (
                  <img
                    src={img.url}
                    alt={img.alt || title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.25) 75%, rgba(0,0,0,0) 100%)' }} />
                <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-7">
                  {cat && (
                    <p
                      className="uppercase mb-3"
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.74rem', letterSpacing: '0.22em', fontWeight: 600, color: 'var(--mood-teal)' }}
                    >
                      {cat}
                    </p>
                  )}
                  <h3
                    style={{
                      fontFamily: 'Playfair Display, serif',
                      fontWeight: 400,
                      fontSize: 'clamp(1.3rem, 1.6vw, 1.6rem)',
                      lineHeight: 1.2,
                      color: 'var(--mood-text-1)',
                      maxWidth: '14ch',
                    }}
                  >
                    {title}
                  </h3>
                  {cta && (
                    <p
                      className="mt-4 inline-flex items-center gap-2"
                      style={{ color: 'var(--mood-teal)', fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', fontWeight: 500 }}
                    >
                      {cta} <ArrowRight size={14} strokeWidth={1.6} />
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default EditorialTriptych;
