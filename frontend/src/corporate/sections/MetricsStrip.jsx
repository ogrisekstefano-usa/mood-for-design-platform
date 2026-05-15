import React from 'react';
import { useReveal } from '../hooks/useReveal';
import { TrendingUp, TrendingDown, Sparkles, Star } from 'lucide-react';

const ICON_BY_TONE = {
  positive: TrendingUp,
  negative: TrendingDown,
  highlight: Sparkles,
  rating: Star,
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
                <div className="flex items-start justify-between mb-5">
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full"
                    style={{ background: 'rgba(61,218,208,0.10)', border: '1px solid rgba(61,218,208,0.4)' }}
                  >
                    <Icon size={15} strokeWidth={1.7} style={{ color: '#3DDAD0' }} />
                  </span>
                </div>
                <p
                  className="font-serif font-normal text-white leading-none mb-3"
                  style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
                >
                  {metric.value}
                </p>
                <p
                  className="text-xs font-medium uppercase tracking-[0.15em] text-white/85 mb-1"
                >
                  {metric.label}
                </p>
                {metric.description && (
                  <p className="text-xs font-light text-white/45 leading-relaxed">{metric.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MetricsStrip;
