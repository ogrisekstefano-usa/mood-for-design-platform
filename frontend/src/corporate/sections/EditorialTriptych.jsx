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
      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16 py-20 lg:py-24">
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
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,8,22,0) 30%, rgba(5,8,22,0.85) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-7 lg:p-9">
                  {cat && (
                    <p
                      className="uppercase mb-3"
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', letterSpacing: '0.22em', fontWeight: 600, color: 'var(--mood-teal)' }}
                    >
                      {cat}
                    </p>
                  )}
                  <h3
                    style={{
                      fontFamily: 'Playfair Display, serif',
                      fontWeight: 400,
                      fontSize: 'clamp(1.5rem, 2vw, 1.95rem)',
                      lineHeight: 1.18,
                      color: 'var(--mood-text-1)',
                    }}
                  >
                    {title}
                  </h3>
                  {cta && (
                    <p
                      className="mt-5 inline-flex items-center gap-2"
                      style={{ color: 'var(--mood-teal)', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: 500 }}
                    >
                      {cta} <ArrowRight size={15} strokeWidth={1.6} />
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
