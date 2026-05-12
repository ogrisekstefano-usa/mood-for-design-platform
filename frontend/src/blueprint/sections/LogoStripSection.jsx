/**
 * LogoStripSection — partner / press marquee.
 * content: { eyebrow, items[], animate }
 */
import React from 'react';
import { Section, Container, Eyebrow } from '../Kit';

const LogoStripSection = ({ content = {} }) => {
  const items = content.items || [];
  const animate = content.animate !== false && items.length > 4;
  return (
    <Section className="bp-section-compact" data-testid="section-logo-strip">
      <Container>
        {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
        <div className="mt-8 overflow-hidden">
          {animate ? (
            <div className="bp-marquee-track items-center">
              {[...items, ...items].map((it, i) => (
                <a key={i} href={it.href || '#'} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                  {it.src ? <img src={it.src} alt={it.alt || ''} className="h-8 object-contain" /> : <span className="bp-caption">{it.alt}</span>}
                </a>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-12 items-center">
              {items.map((it, i) => (
                <a key={i} href={it.href || '#'} className="opacity-60 hover:opacity-100 transition-opacity">
                  {it.src ? <img src={it.src} alt={it.alt || ''} className="h-8 object-contain" /> : <span className="bp-caption">{it.alt}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
};

export default LogoStripSection;
