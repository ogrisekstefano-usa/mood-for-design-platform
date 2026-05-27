/**
 * EditorialFreeBlocks™ — ITER157.E.9
 * Public-site renderer for free-form blocks (`block_heading`, `block_text`,
 * `block_image`, `block_video_youtube`) added via the Pages Admin
 * "+ Aggiungi blocco" picker.
 *
 * Reads from `cms.page.sections` (passed from useStorefrontContent),
 * filters for our 4 block types, sorts by sort_order, renders them
 * with editorial styling.
 *
 * Visibility: only renders sections with `visible: true`.
 */
import React from 'react';
import { pickContent } from './useStorefrontContent';
import { renderInline } from '../lib/inlineMarkup';
import './editorialFreeBlocks.css';

const BLOCK_TYPES = new Set([
  'block_heading',
  'block_text',
  'block_image',
  'block_video_youtube',
]);

// Resolve a locale field from a section's locale_content map.
const _val = (section, locale, field) => {
  const lc = section?.locale_content || {};
  return pickContent(
    Object.fromEntries(
      Object.entries(lc).map(([k, v]) => [k, (v && typeof v === 'object') ? v[field] : ''])
    ),
    locale
  );
};

// Extract YouTube video id from URL or raw id.
const ytId = (raw) => {
  if (!raw) return '';
  if (/^[A-Za-z0-9_-]{8,15}$/.test(raw)) return raw;
  const m = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{6,15})/);
  return m ? m[1] : raw;
};

const Block = ({ section, locale }) => {
  const t = section.section_type;
  const s = section.settings || {};
  const visible = section.visible !== false;
  if (!visible) return null;

  if (t === 'block_heading') {
    const eyebrow = _val(section, locale, 'eyebrow');
    const title = _val(section, locale, 'title');
    if (!title && !eyebrow) return null;
    const size = s.size || 'lg';
    const align = s.align || 'left';
    return (
      <section className={`efb efb--heading efb--${size} efb--align-${align}`}
        data-mfd-editable={t}
        data-testid={`efb-${t}-${section.id}`}>
        <div className="efb__inner">
          {eyebrow && <p className="efb__eyebrow">{eyebrow}</p>}
          {title && <h2 className="efb__title">{title}</h2>}
        </div>
      </section>
    );
  }

  if (t === 'block_text') {
    const body = _val(section, locale, 'body');
    if (!body) return null;
    const align = s.align || 'left';
    const width = s.width || 'default';
    return (
      <section className={`efb efb--text efb--w-${width} efb--align-${align}`}
        data-mfd-editable={t}
        data-testid={`efb-${t}-${section.id}`}>
        <div className="efb__inner">
          <div className="efb__body">{renderInline(body)}</div>
        </div>
      </section>
    );
  }

  if (t === 'block_image') {
    const url = _val(section, locale, 'url');
    const caption = _val(section, locale, 'caption');
    const alt = _val(section, locale, 'alt') || caption || 'Immagine editoriale';
    if (!url) return null;
    const ratio = s.ratio || '16:9';
    return (
      <section className={`efb efb--image efb--ratio-${ratio.replace(':', '-')}`}
        data-mfd-editable={t}
        data-testid={`efb-${t}-${section.id}`}>
        <div className="efb__inner">
          <figure className="efb__figure">
            <img src={url} alt={alt} loading="lazy" />
            {caption && <figcaption className="efb__caption">{caption}</figcaption>}
          </figure>
        </div>
      </section>
    );
  }

  if (t === 'block_video_youtube') {
    const vid = ytId(s.video_id || _val(section, locale, 'video_id'));
    const title = _val(section, locale, 'title');
    const caption = _val(section, locale, 'caption');
    if (!vid) return null;
    return (
      <section className="efb efb--video"
        data-mfd-editable={t}
        data-testid={`efb-${t}-${section.id}`}>
        <div className="efb__inner">
          {title && <h3 className="efb__videoTitle">{title}</h3>}
          <div className="efb__videoWrap">
            <iframe
              src={`https://www.youtube.com/embed/${vid}?rel=0`}
              title={title || 'YouTube video'}
              loading="lazy"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          </div>
          {caption && <p className="efb__caption">{caption}</p>}
        </div>
      </section>
    );
  }

  return null;
};

const EditorialFreeBlocks = ({ sections, locale }) => {
  const list = (sections || [])
    .filter((s) => BLOCK_TYPES.has(s.section_type))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  if (list.length === 0) return null;
  return (
    <div className="efb-stack" data-testid="editorial-free-blocks">
      {list.map((s) => <Block key={s.id} section={s} locale={locale} />)}
    </div>
  );
};

export default EditorialFreeBlocks;
