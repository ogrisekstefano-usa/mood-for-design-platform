import React from 'react';
import { Building2, Store, LayoutTemplate, BarChart3, Layers, Users, Globe, Zap, Shield, Star } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const ICONS = { Building2, Store, LayoutTemplate, BarChart3, Layers, Users, Globe, Zap, Shield, Star };

/**
 * FeatureNarrative — Grid of feature cards with icons.
 * Layouts: "4-columns" | "3-columns" | "2-columns"
 */
const FeatureNarrative = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.1 });
  const features = config.features || [];
  const cols = config.layout === '3-columns' ? 3 : config.layout === '2-columns' ? 2 : 4;

  return (
    <section className="py-24 bg-[#F9F9F8]" data-testid="feature-narrative">
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {content.headline && (
          <h2 className="font-serif font-light text-4xl md:text-5xl text-[#0A0A0A] mb-16 tracking-tighter">
            {content.headline}
          </h2>
        )}
        <div
          ref={ref}
          className={`grid grid-cols-1 sm:grid-cols-2 ${cols >= 4 ? 'lg:grid-cols-4' : cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-0 border-t border-[rgba(10,10,10,0.1)]`}
        >
          {features.map((feature, i) => {
            const IconComponent = ICONS[feature.icon] || Layers;
            const featureContent = feature.content?.['en-us'] || feature.content?.it || feature.content || {};
            return (
              <div
                key={feature.id || i}
                className={`border-b border-r border-[rgba(10,10,10,0.1)] px-8 py-10 group hover:bg-white transition-colors duration-300 reveal ${visible ? 'visible' : ''}`}
                style={{ transitionDelay: `${i * 0.07}s` }}
                data-testid={`feature-card-${feature.id || i}`}
              >
                <div className="mb-6">
                  <IconComponent size={22} className="text-[#0A0A0A] group-hover:text-[#3DDAD0] transition-colors duration-300" strokeWidth={1.5} />
                </div>
                <h3 className="font-sans font-semibold text-base text-[#0A0A0A] mb-3">
                  {featureContent.title}
                </h3>
                <p className="text-sm text-[#5A5A5A] leading-relaxed mb-6">
                  {featureContent.description}
                </p>
                {featureContent.cta && feature.href && (
                  <a
                    href={feature.href}
                    className="text-xs font-sans font-semibold tracking-widest uppercase text-[#0A0A0A] inline-flex items-center gap-2 group-hover:text-[#3DDAD0] transition-colors"
                    data-testid={`feature-cta-${feature.id}`}
                  >
                    {featureContent.cta} <span>→</span>
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
