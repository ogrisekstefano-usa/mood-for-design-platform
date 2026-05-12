/**
 * StatsSection — editorial KPIs.
 * content: { items[], layout }
 */
import React from 'react';
import { Section, Container } from '../Kit';

const StatsSection = ({ content = {} }) => {
  const items = content.items || [];
  const cols = items.length >= 4 ? 'md:grid-cols-4' : items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return (
    <Section className="bp-section-compact" data-testid="section-stats">
      <Container>
        <div className={`grid grid-cols-2 ${cols} gap-y-12 gap-x-8 border-t border-[var(--bp-border)] pt-14`}>
          {items.map((it, i) => (
            <div key={i} className="flex flex-col">
              <span className="bp-display text-[var(--bp-text-primary)] font-light leading-none">
                {it.value}<span className="text-[var(--bp-primary)]">{it.suffix || ''}</span>
              </span>
              <span className="bp-caption text-[var(--bp-text-muted)] uppercase tracking-[0.18em] mt-4">
                {it.label}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
};

export default StatsSection;
