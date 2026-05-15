import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * SplitStory — 50/50 image and text layout.
 * Used for feature explanations, product highlights, narrative sections.
 */
const SplitStory = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const isImageLeft = config.image_position === 'left';

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-2 min-h-[60vh]"
      style={{ background: config.background || '#FFFFFF' }}
      data-testid="split-story"
    >
      {/* Text column */}
      <div
        ref={ref}
        className={`flex flex-col justify-center px-8 md:px-16 lg:px-20 xl:px-28 py-24 ${isImageLeft ? 'lg:order-2' : 'lg:order-1'}`}
      >
        {content.overline && (
          <p
            className={`overline-teal mb-6 reveal ${visible ? 'visible' : ''}`}
            style={{ transitionDelay: '0s' }}
          >
            {content.overline}
          </p>
        )}
        {content.headline && (
          <h2
            className={`font-serif font-light leading-none tracking-tighter text-[#0A0A0A] reveal ${visible ? 'visible' : ''}`}
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', transitionDelay: '0.1s', whiteSpace: 'pre-line' }}
          >
            {content.headline}
          </h2>
        )}
        {content.body && (
          <p
            className={`mt-6 text-base leading-relaxed text-[#5A5A5A] max-w-md reveal ${visible ? 'visible' : ''}`}
            style={{ transitionDelay: '0.2s' }}
          >
            {content.body}
          </p>
        )}
        {content.cta && (
          <div className={`mt-10 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.3s' }}>
            <a
              href={content.cta.href}
              className="btn-ghost text-[#0A0A0A] inline-flex items-center gap-2"
              data-testid="split-story-cta"
            >
              {content.cta.text} <span>↗</span>
            </a>
          </div>
        )}
      </div>

      {/* Image column */}
      {config.image_url && (
        <div className={`relative overflow-hidden min-h-[400px] lg:min-h-[unset] ${isImageLeft ? 'lg:order-1' : 'lg:order-2'}`}>
          <img
            src={config.image_url}
            alt={config.image_alt || ''}
            className="w-full h-full object-cover absolute inset-0"
            loading="lazy"
          />
        </div>
      )}
    </section>
  );
};

export default SplitStory;
