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
            const Icon = ICON_BY_TONE[metric.tone] || TrendingUp;
            return (
              <div
                key={i}
                className="relative px-6 md:px-8 py-8"
                style={{
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  transitionDelay: `${i * 0.07}s`,
                }}
                data-testid={`metric-${i}`}
              >
                <div className="flex items-start gap-4 mb-1">
                  <span
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                    style={{ background: 'transparent', border: '1px solid rgba(0,201,179,0.5)' }}
                  >
                    <Icon size={16} strokeWidth={1.6} style={{ color: '#00C9B3' }} />
                  </span>
                  <div>
                    {metric.eyebrow && (
                      <p className="text-xs font-medium text-white/55 mb-1.5">{metric.eyebrow}</p>
                    )}
                    <p
                      className="font-serif font-normal leading-none mb-1"
                      style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', color: '#00C9B3' }}
                    >
                      {metric.value}
                    </p>
                    <p className="text-xs font-light text-white/55 mt-2">{metric.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MetricsStrip;
