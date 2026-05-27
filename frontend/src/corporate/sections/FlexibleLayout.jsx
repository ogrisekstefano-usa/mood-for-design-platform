import React from 'react';
import { useReveal } from '../hooks/useReveal';
import MediaTile from '../components/MediaTile';
import { linkTarget } from '../utils/linkTarget';
import { renderInlineMarkdown } from '../utils/renderInlineMarkdown';

/**
 * FlexibleLayout — dynamic CMS section type with selectable layouts:
 *
 *   layout: 'single'        → 1 cella (12 col, full width)
 *   layout: 'two_col'       → 2 celle (6 + 6)
 *   layout: 'three_col'     → 3 celle (4 + 4 + 4)
 *   layout: 'image_overlay' → background image + overlay text + CTA
 *
 * Per ogni cella nelle layout col-based:
 *   content_type: 'heading' | 'body' | 'image' | 'button'
 *
 * Settings expected (from resolver):
 *   settings.layout   = 'single' | 'two_col' | 'three_col' | 'image_overlay'
 *   settings.cells    = [{ slot: 'cell_1', span: 6, content_type: 'heading' }, ...]
 *   content[`cell_N_heading|body|cta`] from blocks
 *   media[`cell_N`]   from media slots
 *   links[`cell_N_href`] + `cell_N_target`
 */
const SerifTitle = ({ children, size = 'lg' }) => {
  const sizes = {
    sm: 'text-2xl md:text-3xl',
    md: 'text-3xl md:text-4xl',
    lg: 'text-4xl md:text-5xl lg:text-6xl',
  };
  return (
    <h2
      className={`${sizes[size]} text-white tracking-tight`}
      style={{ fontFamily: 'Playfair Display, Georgia, serif', lineHeight: 1.05 }}
    >
      {renderInlineMarkdown(children || '')}
    </h2>
  );
};

const BodyText = ({ children }) => (
  <p
    className="text-base md:text-[17px] leading-[1.7] text-white/75"
    style={{ fontFamily: 'Inter, sans-serif', maxWidth: 640 }}
  >
    {renderInlineMarkdown(children || '')}
  </p>
);

const CTAButton = ({ label, href, target }) => {
  if (!label) return null;
  return (
    <a
      href={href || '#'}
      {...linkTarget(target)}
      className="btn-pill-teal inline-flex"
      data-testid="flex-cta"
    >
      {label}
    </a>
  );
};

const Cell = ({ cell, content, media, mediaActions, links }) => {
  const t = cell.content_type || 'heading';
  if (t === 'image') {
    const img = media[cell.slot];
    if (!img?.url) return <div style={{ minHeight: 240 }} />;
    return (
      <MediaTile
        media={img}
        action={mediaActions[cell.slot]}
        wrapperStyle={{ aspectRatio: '4/5', borderRadius: 4 }}
        testid={`flex-${cell.slot}-image`}
      />
    );
  }
  if (t === 'button') {
    return (
      <div>
        <CTAButton
          label={content[`${cell.slot}_cta`]}
          href={links[`${cell.slot}_href`]}
          target={links[`${cell.slot}_target`]}
        />
      </div>
    );
  }
  if (t === 'body') {
    return <BodyText>{content[`${cell.slot}_body`]}</BodyText>;
  }
  // 'heading' (default) — show heading + optional body + optional cta
  return (
    <div className="space-y-5">
      <SerifTitle size={cell.span >= 12 ? 'lg' : cell.span >= 6 ? 'md' : 'sm'}>
        {content[`${cell.slot}_heading`]}
      </SerifTitle>
      {content[`${cell.slot}_body`] && (
        <BodyText>{content[`${cell.slot}_body`]}</BodyText>
      )}
      {content[`${cell.slot}_cta`] && (
        <CTAButton
          label={content[`${cell.slot}_cta`]}
          href={links[`${cell.slot}_href`]}
          target={links[`${cell.slot}_target`]}
        />
      )}
    </div>
  );
};

const FlexibleLayout = ({ content = {}, media = {}, mediaActions = {}, links = {}, options = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });
  const layout = options.layout || 'single';
  const cells  = Array.isArray(options.cells) ? options.cells : [];

  // ─── image_overlay: full-bleed bg + text/CTA centered-left ────────────
  if (layout === 'image_overlay') {
    const bg = media.background;
    return (
      <section
        ref={ref}
        className={`relative overflow-hidden reveal ${visible ? 'visible' : ''}`}
        style={{ background: '#000', minHeight: 'clamp(520px, 70vh, 780px)' }}
        data-testid="flex-image-overlay"
      >
        {bg?.url && (
          <img
            src={bg.url} alt={bg.alt || ''} loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                     objectFit: 'cover', objectPosition: 'center' }}
          />
        )}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.15) 100%)',
          }}
        />
        <div className="relative z-10 flex items-center" style={{ minHeight: 'clamp(520px, 70vh, 780px)' }}>
          <div className="w-full max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20 py-16 lg:py-24">
            <div className="max-w-[640px] space-y-6">
              {content.overlay_eyebrow && (
                <p className="text-xs tracking-[0.22em] uppercase text-[var(--mood-teal,#00C9B3)]"
                   style={{ fontFamily: 'Inter, sans-serif' }}>
                  {content.overlay_eyebrow}
                </p>
              )}
              <SerifTitle size="lg">{content.overlay_title}</SerifTitle>
              {content.overlay_body && <BodyText>{content.overlay_body}</BodyText>}
              {content.overlay_cta && (
                <CTAButton
                  label={content.overlay_cta}
                  href={links.overlay_href} target={links.overlay_target}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── Column grid layouts (single / two_col / three_col) ────────────────
  const cols = layout === 'three_col' ? 3 : layout === 'two_col' ? 2 : 1;
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }[cols];

  return (
    <section
      ref={ref}
      className={`relative reveal ${visible ? 'visible' : ''}`}
      style={{ background: options.background || '#000', padding: '6rem 0' }}
      data-testid={`flex-${layout}`}
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20">
        <div className={`grid ${gridClass} gap-10 lg:gap-16`}>
          {cells.map((c) => (
            <div key={c.slot} data-testid={`flex-cell-${c.slot}`}>
              <Cell cell={c} content={content} media={media} mediaActions={mediaActions} links={links} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FlexibleLayout;
