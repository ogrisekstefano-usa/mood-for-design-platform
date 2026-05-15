import React from 'react';
import { useReveal } from '../hooks/useReveal';

/**
 * MetricsStrip — Key metrics/stats display.
 * Clean grid of numbers with labels.
 */
const MetricsStrip = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.2 });
  const metrics = content.metrics || [];

  return (
    <section
      className="py-20 border-y"
      style={{ borderColor: 'rgba(10,10,10,0.1)', background: '#FFFFFF' }}
      data-testid="metrics-strip"
    >
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        <div
          ref={ref}
          className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0"
          style={{ borderColor: 'rgba(10,10,10,0.08)' }}
        >
          {metrics.map((metric, i) => (
            <div
              key={i}
              className={`px-8 py-10 reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: `${i * 0.08}s` }}
              data-testid={`metric-${i}`}
            >
              <p className="font-serif font-light text-[#0A0A0A]" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: '1' }}>
                {metric.value}
              </p>
              <p className="mt-3 text-sm font-semibold text-[#0A0A0A] tracking-wide">
                {metric.label}
              </p>
              {metric.description && (
                <p className="mt-1 text-xs text-[#5A5A5A]">{metric.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MetricsStrip;
