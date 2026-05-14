import React from 'react';

/**
 * TextBlock — editorial text block.
 *
 *   Reads style.typography for fine-grained typographic control (font family,
 *   weight, size, line-height, letter-spacing, alignment, color, italic,
 *   underline). When typography is not set, falls back to the named preset
 *   in content.size (h1 / h2 / body / caption / eyebrow…) via the same
 *   typographic classes used across the platform.
 *
 *   Lists (ul / ol) are stored as content.list_style = 'bullet' | 'numbered'.
 *   The block becomes a one-per-line list — keeps the data shape simple
 *   without introducing a rich-text editor for the MVP.
 */
const PRESET_CLASS = {
  display: 'bp-display',
  h1: 'bp-h1', h2: 'bp-h2', h3: 'bp-h3',
  body: 'bp-body',
  caption: 'bp-caption',
  eyebrow: 'bp-eyebrow',
};

const FONT_FAMILY_VAR = {
  // Mirrors the design tokens in index.css. The frontend never hardcodes a
  // raw font-family string — instead it points at a CSS variable so a future
  // "Global Project Styles" page can swap the bound family per-tenant.
  heading: 'var(--bp-font-heading)',
  body:    'var(--bp-font-body)',
  mono:    'var(--bp-font-mono)',
};

const TextBlock = ({ block, t }) => {
  const c = block.content || {};
  const tg = (block.style && block.style.typography) || {};
  const sizePreset = c.size || 'h3';
  const presetCls = PRESET_CLASS[sizePreset] || 'bp-h3';

  // Compose inline style only when typography overrides are set so the
  // preset CSS still drives the default look (less specificity creep).
  const inlineStyle = {};
  if (tg.font_family) inlineStyle.fontFamily = FONT_FAMILY_VAR[tg.font_family] || tg.font_family;
  if (tg.font_size)   inlineStyle.fontSize   = `${tg.font_size}px`;
  if (tg.font_weight) inlineStyle.fontWeight = tg.font_weight;
  if (tg.line_height) inlineStyle.lineHeight = tg.line_height;
  if (tg.letter_spacing != null) inlineStyle.letterSpacing = `${tg.letter_spacing}em`;
  if (tg.text_align)  inlineStyle.textAlign  = tg.text_align;
  if (tg.color)       inlineStyle.color      = tg.color;
  if (tg.italic)      inlineStyle.fontStyle  = 'italic';
  if (tg.underline)   inlineStyle.textDecorationLine = 'underline';
  if (tg.uppercase)   inlineStyle.textTransform = 'uppercase';

  const text = c.text || (t ? t('moodboards.block.text.placeholder') : '');
  const lines = text.split('\n');
  const listStyle = c.list_style; // 'bullet' | 'numbered' | undefined

  const ListTag = listStyle === 'numbered' ? 'ol' : listStyle === 'bullet' ? 'ul' : null;

  return (
    <div className="w-full h-full p-3 flex"
         style={{
           alignItems: tg.vertical_align === 'top' ? 'flex-start'
                      : tg.vertical_align === 'bottom' ? 'flex-end' : 'center',
           justifyContent: tg.text_align === 'right' ? 'flex-end'
                          : tg.text_align === 'center' ? 'center'
                          : 'flex-start',
         }}>
      {ListTag ? (
        <ListTag className={`${presetCls} text-[var(--bp-text-primary)] w-full pl-5`}
                 style={{ ...inlineStyle, listStyleType: listStyle === 'numbered' ? 'decimal' : 'disc' }}>
          {lines.map((l, i) => <li key={i}>{l || '\u00A0'}</li>)}
        </ListTag>
      ) : (
        <span className={`${presetCls} text-[var(--bp-text-primary)] w-full whitespace-pre-wrap break-words`}
              style={inlineStyle}>
          {text}
        </span>
      )}
    </div>
  );
};

export default TextBlock;
