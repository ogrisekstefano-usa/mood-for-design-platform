import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

/**
 * MagazineHighlights — 3 editorial article cards.
 * Per ITER149 brief: no dates in public frontend.
 * content keys: eyebrow, title, cta, a1.title, a1.category, a2.*, a3.*
 * media:  { a1, a2, a3 }
 * links:  { cta_href }
 */
const ITEMS = ['a1', 'a2', 'a3'];

const MagazineHighlights = ({ content = {}, media = {}, links = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });

  return (
    <section className="relative grain overflow-hidden" style={{ background: '#F5F2EC', color: '#0E0E10' }} data-testid="magazine-highlights">
      <div ref={ref} className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-28">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-14">
          <div>
            {content.eyebrow && (
              <p
                className={`uppercase reveal ${visible ? 'visible' : ''}`}
                style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.28em', color: '#00C9B3' }}
              >
                {content.eyebrow}
              </p>
            )}
            {content.title && (
              <h2
                className={`mt-5 font-serif font-normal reveal ${visible ? 'visible' : ''}`}
                style={{ fontSize: 'clamp(2rem, 3.6vw, 3.2rem)', lineHeight: 1.08, whiteSpace: 'pre-line', color: '#0E0E10' }}
              >
                {content.title}
              </h2>
            )}
          </div>
          {content.cta && (
            <a
              href={links.cta_href || '#'}
              className="inline-flex items-center gap-2 uppercase"
              style={{ color: '#0E0E10', fontFamily: 'Montserrat, sans-serif', fontSize: '0.74rem', letterSpacing: '0.22em', fontWeight: 700, textDecoration: 'none', borderBottom: '1px solid #0E0E10', paddingBottom: 4 }}
              data-testid="magazine-cta"
            >
              {content.cta} <ArrowRight size={14} strokeWidth={1.6} />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 lg:gap-10">
          {ITEMS.map((k, i) => {
            const title = content[`${k}.title`];
            const cat   = content[`${k}.category`];
            const img   = media[k];
            if (!title) return null;
            return (
              <a
                key={k}
                href="#"
                className={`block reveal ${visible ? 'visible' : ''}`}
                style={{ transitionDelay: `${0.1 + i * 0.08}s`, textDecoration: 'none', color: '#0E0E10' }}
                data-testid={`magazine-article-${i + 1}`}
              >
                <div className="overflow-hidden mb-5" style={{ aspectRatio: '4/3', background: '#E5E0D7' }}>
                  {img && img.url && (
                    <img src={img.url} alt={img.alt || title} className="w-full h-full object-cover" loading="lazy" />
                  )}
                </div>
                {cat && (
                  <p
                    className="uppercase mb-2"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.62rem', letterSpacing: '0.28em', fontWeight: 700, color: '#7A6C5A' }}
                  >
                    {cat}
                  </p>
                )}
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(1.2rem, 1.6vw, 1.55rem)', lineHeight: 1.25, fontWeight: 400 }}>
                  {title}
                </h3>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MagazineHighlights;
