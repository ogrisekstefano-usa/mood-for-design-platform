/**
 * Blueprint Moodboard Block Registry — V1.
 * Block types: image, text, palette, note, product, material.
 * Future stubs (server-accepted, no UI yet): hotspot, video, vendor, product_grid.
 */
import ImageBlock from './blocks/ImageBlock';
import TextBlock from './blocks/TextBlock';
import PaletteBlock from './blocks/PaletteBlock';
import NoteBlock from './blocks/NoteBlock';
import ProductBlock from './blocks/ProductBlock';
import MaterialBlock from './blocks/MaterialBlock';
import ShapeBlock from './blocks/ShapeBlock';
import ArrowBlock from './blocks/ArrowBlock';

export const BLOCK_COMPONENTS = {
  image:    ImageBlock,
  text:     TextBlock,
  palette:  PaletteBlock,
  note:     NoteBlock,
  product:  ProductBlock,
  material: MaterialBlock,
  shape:    ShapeBlock,
  arrow:    ArrowBlock,
};

export const BLOCK_TYPES = [
  { type: 'image',    label: 'Image',    defaults: { width: 320, height: 240, content: { src: '', caption: '' } } },
  { type: 'text',     label: 'Text',     defaults: { width: 320, height: 120, content: { text: 'Editorial caption', size: 'h3' } } },
  { type: 'palette',  label: 'Palette',  defaults: { width: 320, height: 120, content: { colors: ['#0A0A0B', '#26F5C9', '#B8977A', '#EFEBE4'] } } },
  { type: 'note',     label: 'Note',     defaults: { width: 240, height: 200, content: { text: 'Add a note' } } },
  { type: 'product',  label: 'Product',  defaults: { width: 260, height: 320, content: { name: 'Product', vendor: '', price: '', image: '' } } },
  { type: 'material', label: 'Material', defaults: { width: 220, height: 220, content: { name: 'Material', finish: '', swatch: '' } } },
  { type: 'shape',    label: 'Shape',    defaults: { width: 220, height: 220,
    content: { kind: 'rectangle' },
    style: { fill: 'rgba(255,255,255,0.06)', border_color: 'var(--bp-text-primary)', border_width: 1, border_style: 'solid', border_radius: 4 } } },
  { type: 'arrow',    label: 'Arrow',    defaults: { width: 240, height: 60,
    content: { kind: 'straight', head: 'triangle' },
    style: { color: 'var(--bp-text-primary)', thickness: 2, dashed: false } } },
];

export function resolveBlock(type) {
  return BLOCK_COMPONENTS[type] || null;
}
