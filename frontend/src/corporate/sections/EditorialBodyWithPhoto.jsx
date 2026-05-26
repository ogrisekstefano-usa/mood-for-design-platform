import React from 'react';
import { useReveal } from '../hooks/useReveal';
import { renderInlineMarkdown } from '../utils/renderInlineMarkdown';
import MediaTile from '../components/MediaTile';

/**
 * EditorialBodyWithPhoto — magazine-style editorial body with a
 * companion photograph.
 *
 * Layout: optional eyebrow + serif title on left + long-form paragraph
 * body on left, large photograph on right. Reads like a magazine
 * 2-column editorial spread.
 *
 * content: { eyebrow, title, body }
 * media:   { photo: { url, alt } }
 * options: { reverse?: boolean, background?: string }
 */
const EditorialBodyWithPhoto = ({ content = {}, media = {}, mediaActions = {}, options = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.15 });
  // Backwards-compat slot keys (CMS may use 'photo' OR 'hero' for the right-hand image)
  const photoKey = media.photo ? 'photo' : (media.hero ? 'hero' : 'photo');
  const photo = media[photoKey];
  const reverse = options.reverse === true;
  const bg = options.background || '#000000';

  return (
    <section
      ref={ref}
      className={`relative reveal ${visible ? 'visible' : ''}`}
      style={{ background: bg, padding: 'clamp(5rem, 9vw, 9rem) 0' }}
      data-testid="editorial-body-with-photo"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 lg:px-20">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 items-center`}
          style={{
            gap: 'clamp(3rem, 6vw, 7rem)',
            direction: reverse ? 'rtl' : 'ltr',
          }}
        >
          {/* Editorial copy */}
          <div style={{ direction: 'ltr' }}>
            {content.eyebrow && (
              <p
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', fontWeight: 500,
                  letterSpacing: '0.24em', textTransform: 'uppercase',
                  color: 'var(--mood-teal, #00C9B3)', marginBottom: '2rem',
                }}
                data-testid="editorial-body-eyebrow"
              >
                {content.eyebrow}
              </p>
            )}
            {content.title && (
              <h2
                style={{
                  fontFamily: 'Playfair Display, serif', fontWeight: 400,
                  fontSize: 'clamp(2rem, 3.2vw, 3.2rem)', lineHeight: 1.12,
                  letterSpacing: '-0.015em', color: '#FFFFFF',
                  marginBottom: '2rem', maxWidth: '20ch',
                }}
                data-testid="editorial-body-title"
              >
                {content.title}
              </h2>
            )}
            {content.body && (
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 'clamp(0.98rem, 1.08vw, 1.06rem)',
                  lineHeight: 1.8, color: 'rgba(255,255,255,0.7)', fontWeight: 300,
                  maxWidth: '52ch',
                  whiteSpace: 'pre-line',
                }}
                data-testid="editorial-body-body"
              >
                {renderInlineMarkdown(content.body)}
              </div>
            )}
          </div>

          {/* Photograph */}
          <div style={{ direction: 'ltr', position: 'relative', aspectRatio: '4/5', overflow: 'hidden', background: '#0A0A0A' }}>
            {photo && photo.url && (
              <MediaTile
                media={{ url: photo.url, alt: photo.alt, dominant_color: photo.dominant_color || '#0A0A0A' }}
                action={mediaActions[photoKey]}
                wrapperStyle={{ width: '100%', height: '100%' }}
                imgStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                testid="editorial-body-photo"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EditorialBodyWithPhoto;
