import React from 'react';
import { Building2, Store, LayoutTemplate, BarChart3, Layers, Users, Globe, Zap, Shield, Star, Sparkles, Briefcase, UserCircle } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const ICONS = { Building2, Store, LayoutTemplate, BarChart3, Layers, Users, Globe, Zap, Shield, Star, Sparkles, Briefcase, UserCircle };

/**
 * FeatureNarrative — dark editorial grid of feature cards.
 * config: { features:[{icon, content:{locale:{title,description,cta}}, href}], layout:'2-columns'|'3-columns'|'4-columns', dark:true (default) }
 */
const FeatureNarrative = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });
  const features = config.features || content.features || [];
  const cols = config.layout === '3-columns' ? 3 : config.layout === '2-columns' ? 2 : 4;
  const gridCols = { 4: 'lg:grid-cols-4', 3: 'lg:grid-cols-3', 2: 'lg:grid-cols-2' };
  const dark = config.dark !== false;

  return (
    <section
      className={`relative ${dark ? 'grain' : ''}`}
      style={{ background: dark ? 'var(--mood-ink)' : '#FFFFFF' }}
      data-testid="feature-narrative"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 py-24 lg:py-28">
        <div ref={ref} className={`max-w-3xl mb-14 reveal ${visible ? 'visible' : ''}`}>
          {content.eyebrow && <p className="overline-teal mb-6">{content.eyebrow}</p>}
          {content.headline && (
            <h2
              className={`font-serif font-normal leading-[1.05] tracking-tight ${dark ? 'text-white' : 'text-[#000000]'}`}
              style={{ fontSize: 'clamp(2rem, 3.6vw, 3.2rem)' }}
            >
              {content.headline}
            </h2>
          )}
          {content.body && (
            <p
              className="mt-5 text-base font-light leading-relaxed max-w-2xl"
              style={{ color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(10,19,32,0.6)' }}
            >
              {content.body}
            </p>
          )}
        </div>

        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols[cols] || 'lg:grid-cols-4'} gap-px`}
          style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(10,19,32,0.08)' }}
        >
          {features.map((feature, i) => {
            const Icon = ICONS[feature.icon] || Layers;
            const fc = feature.content?.['en-us'] || feature.content?.it || feature.content || {};
            return (
              <div
                key={feature.id || i}
                className={`group p-8 lg:p-10 transition-all duration-300 reveal ${visible ? 'visible' : ''}`}
                style={{
                  transitionDelay: `${i * 0.05}s`,
                  background: dark ? 'var(--mood-ink)' : '#FFFFFF',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? 'var(--mood-ink-2)' : '#F5F2EC')}
                onMouseLeave={e => (e.currentTarget.style.background = dark ? 'var(--mood-ink)' : '#FFFFFF')}
                data-testid={`feature-card-${feature.id || i}`}
              >
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-6"
                  style={{
                    background: dark ? 'rgba(0,201,179,0.10)' : 'rgba(0,201,179,0.10)',
                    border: '1px solid rgba(0,201,179,0.45)',
                  }}
                >
                  <Icon size={16} strokeWidth={1.6} style={{ color: '#00C9B3' }} />
                </span>
                <h3
                  className="font-serif text-xl leading-tight mb-3"
                  style={{ color: dark ? '#FFFFFF' : '#000000' }}
                >
                  {fc.title}
                </h3>
                <p
                  className="text-sm font-light leading-relaxed mb-5"
                  style={{ color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(10,19,32,0.55)' }}
                >
                  {fc.description}
                </p>
                {fc.cta && feature.href && (
                  <a
                    href={feature.href}
                    className="text-xs font-semibold uppercase tracking-[0.18em] inline-flex items-center gap-1.5 transition-colors"
                    style={{ color: dark ? 'rgba(255,255,255,0.8)' : '#000000' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#00C9B3')}
                    onMouseLeave={e => (e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.8)' : '#000000')}
                    data-testid={`feature-cta-${feature.id}`}
                  >
                    {fc.cta} →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureNarrative;
