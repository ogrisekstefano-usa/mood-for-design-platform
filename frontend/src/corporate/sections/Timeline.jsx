import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * Timeline — Sequential milestones or steps.
 */
const Timeline = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const items = content.items || [];

  return (
    <section className="py-24 bg-[#F9F9F8]" data-testid="timeline">
      <div className="max-w-5xl mx-auto px-8 md:px-16">
        {content.headline && (
          <h2 className="font-serif font-light text-4xl md:text-5xl text-[#0A0A0A] tracking-tighter mb-20">
            {content.headline}
          </h2>
        )}
        <div ref={ref} className="space-y-0">
          {items.map((item, i) => (
            <div
              key={i}
              className={`grid grid-cols-12 gap-8 border-t border-[rgba(10,10,10,0.1)] py-10 reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: `${i * 0.1}s` }}
              data-testid={`timeline-item-${i}`}
            >
              <div className="col-span-3 md:col-span-2">
                <span className="font-serif text-sm text-[#3DDAD0] font-medium">{item.year || item.step}</span>
              </div>
              <div className="col-span-9 md:col-span-10">
                <h3 className="font-sans font-semibold text-base text-[#0A0A0A] mb-2">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-[#5A5A5A] leading-relaxed">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Timeline;
