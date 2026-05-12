/**
 * GallerySection — mosaic / grid / carousel / marquee.
 * content: { eyebrow, headline, items[], variant, aspect }
 */
import React from 'react';
import { Section, Container, Eyebrow, H2 } from '../Kit';

const GallerySection = ({ content = {} }) => {
  const items = content.items || [];
  const variant = content.variant || 'mosaic';
  const aspect = content.aspect || 'varied';
  const aspectCls = (i) => {
    if (aspect === 'square') return 'aspect-square';
    if (aspect === 'portrait') return 'aspect-[3/4]';
    if (aspect === 'landscape') return 'aspect-[4/3]';
    // varied
    return i % 3 === 0 ? 'aspect-[4/5]' : i % 3 === 1 ? 'aspect-[4/3]' : 'aspect-square';
  };

  const renderGrid = () => (
    <div className={`grid gap-3 md:gap-5 mt-14 ${variant === 'mosaic' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
      {items.map((it, i) => (
        <figure key={i} className={`relative overflow-hidden rounded-[var(--bp-radius-md)] bg-[var(--bp-surface-1)] ${aspectCls(i)}`}>
          {it.src ? (
            <img src={it.src} alt={it.alt || ''} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[var(--bp-duration-cinematic)] ease-[var(--bp-ease)] hover:scale-[1.03] bp-img-cinematic" loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--bp-text-subtle)] bp-caption">No image</div>
          )}
          {it.caption && (
            <figcaption className="absolute bottom-0 inset-x-0 p-3 bp-caption text-[var(--bp-text-primary)] bg-gradient-to-t from-black/60 to-transparent">
              {it.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );

  const renderMarquee = () => (
    <div className="overflow-hidden mt-14">
      <div className="bp-marquee-track">
        {[...items, ...items].map((it, i) => (
          <div key={i} className="h-[280px] aspect-[4/5] flex-shrink-0 overflow-hidden rounded-[var(--bp-radius-md)] bg-[var(--bp-surface-1)]">
            {it.src && <img src={it.src} alt={it.alt || ''} className="w-full h-full object-cover bp-img-cinematic" loading="lazy" />}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Section data-testid="section-gallery">
      <Container>
        {content.eyebrow && <Eyebrow>{content.eyebrow}</Eyebrow>}
        {content.headline && <H2 className="mt-4">{content.headline}</H2>}
        {items.length === 0 ? (
          <p className="bp-caption text-[var(--bp-text-muted)] mt-10">No items yet.</p>
        ) : variant === 'marquee' ? renderMarquee() : renderGrid()}
      </Container>
    </Section>
  );
};

export default GallerySection;
