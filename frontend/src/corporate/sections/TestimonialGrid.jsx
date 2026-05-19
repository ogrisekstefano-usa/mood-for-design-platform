import React from 'react';
import { useReveal } from '../hooks/useReveal';
import { Quote } from 'lucide-react';

/**
 * TestimonialGrid — 3-up testimonial cards (dark editorial).
 * content: { overline, headline, headline_accent?, cta:{text,href}, testimonials:[{quote, name, role, location, avatar}] }
 */
const TestimonialGrid = ({ content = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const items = content.testimonials || [];
  return (
    <section
      className="relative grain"
      style={{ background: 'var(--mood-black)' }}
      data-testid="testimonial-grid"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-24">
        <div ref={ref} className={`flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12 lg:mb-16 gap-6 reveal ${visible ? 'visible' : ''}`}>
          <div className="max-w-3xl">
            {content.overline && <p className="overline-teal mb-5">{content.overline}</p>}
            {content.headline && (
              <h2 className="font-serif text-white leading-[1.1]" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)' }}>
                {content.headline}
                {content.headline_accent && (
                  <span className="italic" style={{ color: '#00C9B3', fontFamily: 'Playfair Display, serif' }}> {content.headline_accent}</span>
                )}
                {content.headline_after && <span> {content.headline_after}</span>}
              </h2>
            )}
          </div>
          {content.cta && (
            <a href={content.cta.href || '#'} className="text-xs font-semibold uppercase tracking-[0.16em] whitespace-nowrap" style={{ color: '#00C9B3' }} data-testid="testimonial-grid-cta">
              {content.cta.text} <span aria-hidden>→</span>
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {items.map((t, i) => (
            <article
              key={i}
              className={`p-8 rounded-xl reveal ${visible ? 'visible' : ''}`}
              style={{
                background: 'rgba(14,14,16,0.85)',
                border: '1px solid rgba(255,255,255,0.06)',
                transitionDelay: `${0.1 + i * 0.08}s`,
              }}
              data-testid={`testimonial-${i}`}
            >
              <Quote size={20} strokeWidth={1.2} style={{ color: '#00C9B3', marginBottom: 18 }} />
              <p className="text-sm leading-relaxed text-white/80 mb-8 min-h-[7rem]">{t.quote}</p>
              <div className="flex items-center gap-3 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {t.avatar && (
                  <img src={t.avatar} alt={t.name || ''} className="w-10 h-10 rounded-full object-cover" loading="lazy"
                       style={{ border: '1px solid rgba(0,201,179,0.3)' }} />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">{t.name}</p>
                  {t.location && <p className="text-xs font-light text-white/45 mt-0.5">{t.location}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialGrid;
