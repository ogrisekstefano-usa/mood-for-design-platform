import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * SelectedProjects — 3 editorial project tiles.
 * content keys: eyebrow, title, cta, tile_1.title, tile_1.subtitle, tile_2.*, tile_3.*
 * media:  { tile_1:{url,alt}, tile_2:{...}, tile_3:{...} }
 * links:  { cta_href }
 */
const TILES = ['tile_1', 'tile_2', 'tile_3'];

const SelectedProjects = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });

  return (
    <section className="relative grain overflow-hidden" style={{ background: 'var(--mood-black)' }} data-testid="selected-projects">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-28">
        {content.eyebrow && (
          <p className={`overline-teal mb-6 reveal ${visible ? 'visible' : ''}`}>{content.eyebrow}</p>
        )}
        {content.title && (
          <h2
            className={`font-serif font-normal text-white leading-[1.06] reveal ${visible ? 'visible' : ''}`}
            style={{ fontSize: 'clamp(2rem, 3.8vw, 3.4rem)', whiteSpace: 'pre-line', transitionDelay: '0.05s', maxWidth: 880 }}
          >
            {content.title}
          </h2>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-7 mt-14">
          {TILES.map((tk, i) => {
            const img = media[tk];
            const title = content[`${tk}.title`];
            const sub = content[`${tk}.subtitle`];
            if (!title) return null;
            return (
              <a
                key={tk}
                href="#"
                className={`group relative block overflow-hidden rounded-md reveal ${visible ? 'visible' : ''}`}
                style={{ transitionDelay: `${0.1 + i * 0.08}s`, textDecoration: 'none', aspectRatio: '4/5' }}
                data-testid={`project-tile-${i + 1}`}
              >
                {img && img.url && (
                  <img
                    src={img.url}
                    alt={img.alt || title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
                    style={{ filter: 'saturate(1.02)' }}
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.78) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-8">
                  <p style={{ fontFamily: 'Playfair Display, serif', color: '#FFFFFF', fontSize: 'clamp(1.4rem, 2vw, 1.9rem)', lineHeight: 1.15 }}>
                    {title}
                  </p>
                  {sub && (
                    <p style={{ fontFamily: 'Montserrat, sans-serif', color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', letterSpacing: '0.06em', marginTop: 6 }}>
                      {sub}
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>

        {content.cta && (
          <div className="mt-14 flex justify-end">
            <a
              href={links.cta_href || '#'}
              className="inline-flex items-center gap-2 uppercase"
              style={{ color: '#00C9B3', fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', letterSpacing: '0.22em', fontWeight: 700, textDecoration: 'none' }}
              data-testid="selected-projects-cta"
            >
              {content.cta} <ArrowUpRight size={14} strokeWidth={1.6} />
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default SelectedProjects;
