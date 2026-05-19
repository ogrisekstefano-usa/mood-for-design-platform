import React from 'react';
import { useReveal } from '../hooks/useReveal';
import { TrendingUp, TrendingDown, Sparkles, Star, Settings, Clock, Heart, Trophy } from 'lucide-react';

const ICON_BY_TONE = {
  positive: Trophy,
  negative: Settings,
  highlight: Clock,
  rating: Heart,
};

/**
 * MetricsStrip — Cinematic dark stat band.
 * Each metric: { value, label, description?, tone? }
 * tone: 'positive' (default) | 'negative' | 'highlight' | 'rating'
 * config: { eyebrow?, headline? }
 */
const MetricsStrip = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  const metrics = content.metrics || [];

  return (
    <section
      className="relative grain overflow-hidden"
      style={{ background: 'var(--mood-ink)' }}
      data-testid="metrics-strip"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-24">
        {(content.eyebrow || content.headline) && (
          <div ref={ref} className={`max-w-2xl mb-14 reveal ${visible ? 'visible' : ''}`}>
            {content.eyebrow && <p className="overline-teal mb-5">{content.eyebrow}</p>}
            {content.headline && (
              <h2 className="font-serif text-white leading-[1.05]" style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)' }}>
                {content.headline}
              </h2>
            )}
          </div>
        )}

        <div className={`grid grid-cols-2 md:grid-cols-4 gap-0 reveal ${visible ? 'visible' : ''}`}>
          {metrics.map((metric, i) => {
            return (
              <div
                key={i}
                className="relative px-6 md:px-8 py-10 text-center"
                style={{
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  transitionDelay: `${i * 0.07}s`,
                }}
                data-testid={`metric-${i}`}
              >
                {metric.eyebrow && (
                  <p className="text-[0.65rem] font-medium tracking-[0.18em] uppercase text-white/45 mb-3">{metric.eyebrow}</p>
                )}
                <p
                  className="font-serif font-normal leading-none mb-3"
                  style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', color: '#FFFFFF' }}
                >
                  {metric.value}
                </p>
                <p className="text-sm font-light leading-relaxed text-white/65 max-w-[14rem] mx-auto">{metric.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MetricsStrip;
