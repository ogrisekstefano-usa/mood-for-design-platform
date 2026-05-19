import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * DeviceShowcase — laptop + phone + tablet stacked devices on the left,
 * editorial caption + CTA on the right.
 * content: { overline?, headline, body, cta:{text,href} }
 * config:  { laptop_image, phone_image, tablet_image }
 */
const DeviceShowcase = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  return (
    <section
      className="relative grain overflow-hidden"
      style={{ background: 'var(--mood-black)' }}
      data-testid="device-showcase"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        {/* Devices */}
        <div ref={ref} className={`lg:col-span-7 relative reveal ${visible ? 'visible' : ''}`}>
          {/* Laptop base */}
          <div
            className="relative aspect-[16/10] rounded-xl overflow-hidden"
            style={{
              background: '#0E0E10',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 60px 120px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,201,179,0.04)',
            }}
          >
            {config.laptop_image && (
              <img src={config.laptop_image} alt="MOOD Moodboard" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4) 100%)' }} />
          </div>

          {/* Phone — floating */}
          <div
            className="hidden md:block absolute"
            style={{ left: '35%', top: '20%', width: '20%', aspectRatio: '9/19', borderRadius: '24px', overflow: 'hidden', background: '#0E0E10', border: '6px solid #0E0E10', boxShadow: '0 30px 60px -10px rgba(0,0,0,0.7)' }}
          >
            {config.phone_image && (
              <img src={config.phone_image} alt="MOOD mobile" className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>

          {/* Tablet — floating right */}
          <div
            className="hidden md:block absolute"
            style={{ right: '-2%', top: '12%', width: '46%', aspectRatio: '4/3', borderRadius: '12px', overflow: 'hidden', background: '#FAFAFA', border: '8px solid #1A1A1A', boxShadow: '0 30px 60px -10px rgba(0,0,0,0.6)' }}
          >
            {config.tablet_image && (
              <img src={config.tablet_image} alt="Editorial Studio" className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
        </div>

        {/* Caption */}
        <div className={`lg:col-span-5 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.2s' }}>
          {content.overline && <p className="overline-teal mb-6">{content.overline}</p>}
          {content.headline && (
            <h2 className="font-serif text-white leading-[1.05]" style={{ fontSize: 'clamp(2rem, 3.4vw, 3rem)', whiteSpace: 'pre-line' }}>
              {content.headline}
            </h2>
          )}
          {content.body && (
            <p className="mt-6 text-base font-light leading-relaxed text-white/65 max-w-md">
              {content.body}
            </p>
          )}
          {content.cta && (
            <a
              href={content.cta.href || '#'}
              className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: '#00C9B3' }}
              data-testid="device-showcase-cta"
            >
              {content.cta.text} <span aria-hidden>→</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

export default DeviceShowcase;
