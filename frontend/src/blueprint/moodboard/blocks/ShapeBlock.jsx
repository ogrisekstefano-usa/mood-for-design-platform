import React from 'react';

/**
 * ShapeBlock PRO — vector primitive (rectangle · ellipse · line).
 *
 * Persisted shape:
 *   block.content.kind       : 'rectangle' | 'ellipse' | 'line'
 *   block.style.fill         : color or 'none'
 *   block.style.opacity      : 0..1 (also handled at element level by editor)
 *   block.style.border_color : color
 *   block.style.border_width : px (0..16)
 *   block.style.border_style : 'solid' | 'dashed' | 'dotted'
 *   block.style.border_radius: px (for rectangle / ellipse)
 *
 * Rendered as plain CSS, no SVG — keeps the canvas DOM lightweight, and
 * resize/rotate are inherited from the generic editor block transform.
 * For 'line' we render a 2px tall bar; the user resizes height for thickness.
 */
const ShapeBlock = ({ block }) => {
  const c = block.content || {};
  const s = block.style || {};
  const kind = c.kind || 'rectangle';

  const common = {
    backgroundColor: s.fill || (kind === 'line' ? (s.border_color || 'var(--bp-text-primary)') : 'transparent'),
    borderColor: s.border_color || 'transparent',
    borderWidth: kind === 'line' ? 0 : (s.border_width ?? 0),
    borderStyle: s.border_style || 'solid',
    borderRadius: kind === 'ellipse' ? '50%' : (s.border_radius ?? 0),
  };

  return (
    <div className="w-full h-full"
         data-testid={`shape-${kind}`}
         style={common} />
  );
};

export default ShapeBlock;
