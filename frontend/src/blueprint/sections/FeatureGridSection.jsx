/**
 * FeatureGridSection — modular capabilities grid.
 * content: { eyebrow, headline, items[], columns, layout, atmosphere }
 */
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { Section, Container, Eyebrow, H2 } from '../Kit';

const Icon = ({ name, size = 18 }) => {
  const Comp = LucideIcons[name] || LucideIcons.Sparkles;
  return <Comp size={size} strokeWidth={1.4} />;
};

const FeatureGridSection = ({ content = {} }) => {
  const cols = content.columns || '3';
  const gridCols = { '2': 'md:grid-cols-2', '3': 'md:grid-cols-3', '4': 'md:grid-cols-4' }[cols] || 'md:grid-cols-3';

  return (
    <Section atmosphere={content.atmosphere} data-testid="section-feature-grid">
      <Container>
        {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
        {content.headline && <H2 className="mt-4 max-w-2xl">{content.headline}</H2>}

        <div className={`grid grid-cols-1 ${gridCols} gap-x-10 gap-y-14 mt-16`}>
          {(content.items || []).map((item, i) => (
            <div key={i} className="group">
              <div className="w-10 h-10 rounded-[var(--bp-radius-sm)] bg-[var(--bp-primary)]/10 border border-[var(--bp-primary)]/20 flex items-center justify-center text-[var(--bp-primary)] mb-5 transition-colors">
                <Icon name={item.icon} />
              </div>
              <h3 className="bp-h3 text-[var(--bp-text-primary)] mb-2">{item.title}</h3>
              <p className="bp-body text-[var(--bp-text-secondary)]">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

export default FeatureGridSection;
