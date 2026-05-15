import React from 'react';
import { Building2, Store, LayoutTemplate, BarChart3, Layers, Users, Globe, Zap, Shield, Star } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const ICONS = { Building2, Store, LayoutTemplate, BarChart3, Layers, Users, Globe, Zap, Shield, Star };

/**
 * FeatureNarrative — Grid of feature cards with thin border dividers.
 * Brand guide: clean architectural grid, no cards/shadows.
 */
const FeatureNarrative = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.08 });
  const features = config.features || [];
  const cols = config.layout === '3-columns' ? 3 : config.layout === '2-columns' ? 2 : 4;
  const gridCols = { 4: 'lg:grid-cols-4', 3: 'lg:grid-cols-3', 2: 'lg:grid-cols-2' };

  return (
    <section className="py-20" style={{ background: '#FFFFFF' }} data-testid="feature-narrative">
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {content.headline && (
          <h2 className="font-serif font-normal text-4xl md:text-5xl text-[#1A1A1A] mb-14 tracking-tight">
            {content.headline}
          </h2>
        )}
        <div
          ref={ref}
          className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols[cols] || 'lg:grid-cols-4'}`}
          style={{ borderTop: '1px solid rgba(26,26,26,0.1)', borderLeft: '1px solid rgba(26,26,26,0.1)' }}
        >
          {features.map((feature, i) => {
            const IconComponent = ICONS[feature.icon] || Layers;
            const featureContent = feature.content?.['en-us'] || feature.content?.it || feature.content || {};
            return (
              <div
                key={feature.id || i}
                className={`group px-8 py-10 reveal ${visible ? 'visible' : ''}`}
                style={{
                  transitionDelay: `${i * 0.06}s`,
                  borderRight: '1px solid rgba(26,26,26,0.1)',
                  borderBottom: '1px solid rgba(26,26,26,0.1)',
                  transition: 'background 0.25s ease',
                  background: 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8F8F8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                data-testid={`feature-card-${feature.id || i}`}
              >
                <div className="mb-7">
                  <IconComponent
                    size={20}
                    strokeWidth={1.5}
                    style={{ color: '#1A1A1A', transition: 'color 0.25s' }}
                    className="group-hover:!text-[#00C9B3]"
                  />
                </div>
                <h3 className="font-sans font-600 text-sm text-[#1A1A1A] mb-3 font-semibold">
                  {featureContent.title}
                </h3>
                <p className="text-xs font-light text-[#6B6E71] leading-relaxed mb-6">
                  {featureContent.description}
                </p>
                {featureContent.cta && feature.href && (
                  <a
                    href={feature.href}
                    className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] inline-flex items-center gap-1.5 group-hover:text-[#00C9B3] transition-colors"
                    data-testid={`feature-cta-${feature.id}`}
                  >
                    {featureContent.cta} →
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
