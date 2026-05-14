/**
 * Premium Pre-built Templates — frontend-driven editorial moodboards.
 *
 * Each template is a fully-composed moodboard PAGE: real imagery, palette,
 * typography, body, materials, and product callouts. When applied, the
 * frontend creates a new page via the existing `POST /api/moodboards/{id}/pages`
 * endpoint and then inserts each block via `POST /api/moodboards/{id}/blocks`
 * (the same flow `addBlock` uses). NO backend changes.
 *
 * Five distinct editorial directions (locked by the user):
 *
 *   luxury_hospitality   — warm neutrals · cinematic photography · serif
 *   material_narrative   — close-up textures · palette strips · annotations
 *   japandi_editorial    — asymmetrical whitespace · stone tones · minimal type
 *   fashion_editorial    — oversized type · layered imagery · experimental
 *   residential_moodboard— AD Magazine feeling · furniture + palette + mood
 *
 * Page dimensions follow the existing skeleton system convention (1400×1866
 * portrait A4-ish so the same canvas math works without changes).
 */

const W = 1400;
const H = 1866;

// Vetted Unsplash photo pool — same hot-link strategy as the SkeletonPreview.
// Re-using the URLs keeps the network footprint small and increases the
// chance the browser has them cached from the picker preview.
const PHOTOS = {
  warm_interior:   'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80',
  warm_lounge:     'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
  cinematic_chair: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1400&q=80',
  paper_decor:     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
  white_armchair:  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
  texture_stone:   'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80',
  texture_wood:    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80',
  texture_linen:   'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
};

// ── Block factories (concise builders for each block type) ─────────────────
const img    = (src, x, y, w, h, z = 1) => ({ type: 'image',
  x, y, width: w, height: h, z_index: z,
  content: { src, fit: 'cover', focal_x: 50, focal_y: 50 } });

const text   = (value, x, y, w, h, z, style = {}) => ({ type: 'text',
  x, y, width: w, height: h, z_index: z,
  content: { value },
  style: { font_family: 'Playfair Display', font_size: 32, font_weight: 400,
           color: '#1A1410', align: 'left', italic: false, ...style } });

const palette = (colors, x, y, w, h, z = 5) => ({ type: 'palette',
  x, y, width: w, height: h, z_index: z,
  content: { colors } });

const material = (name, sub, src, x, y, w, h, z = 4) => ({ type: 'material',
  x, y, width: w, height: h, z_index: z,
  content: { name, subtitle: sub, image: src } });

// ── Templates ──────────────────────────────────────────────────────────────
const TEMPLATES = {
  // 1. LUXURY HOSPITALITY ───────────────────────────────────────────────────
  luxury_hospitality: {
    id: 'luxury_hospitality',
    name: 'Luxury Hospitality',
    eyebrow: 'Premium template',
    description: 'Warm neutrals, cinematic photography, elegant serif typography. Ideal for boutique hotel projects.',
    width: W,
    height: H,
    page_title: 'Villa Como · Lobby concept',
    page_type: 'cover',
    blocks: [
      // Hero photo full bleed
      img(PHOTOS.warm_lounge, 0, 0, W, 1200, 1),
      // Eyebrow caption white on dark fade
      text('VILLA COMO · LAGO ITALIA', 80, 1080, 600, 36, 4,
           { font_family: 'Inter', font_size: 12, color: '#FFFFFF', letter_spacing: 4 }),
      // Main title — large serif
      text('A timeless aesthetic\nfor modern hospitality.', 80, 1130, 1200, 220, 5,
           { font_family: 'Playfair Display', font_size: 64, color: '#FFFFFF', italic: false }),
      // Body description
      text('Travertine, hand-tufted wool, brass detailing and oak millwork compose a calm, residential lobby atmosphere — the journey before the rooms.',
           80, 1380, 900, 140, 6,
           { font_family: 'Inter', font_size: 18, color: '#3A2F26', italic: false }),
      // Palette
      palette(['#1A1410', '#3A2A1E', '#8F7758', '#C9AE8C', '#EBDDC2'], 80, 1560, 720, 70, 7),
      // Caption
      text('CIPRIA · CIOCCOLATO · TRAVERTINO · LATTE', 80, 1650, 800, 24, 8,
           { font_family: 'Inter', font_size: 11, color: '#5A4D3F', letter_spacing: 3 }),
    ],
  },

  // 2. MATERIAL NARRATIVE ───────────────────────────────────────────────────
  material_narrative: {
    id: 'material_narrative',
    name: 'Material Narrative',
    eyebrow: 'Premium template',
    description: 'Close-up textures with editorial annotations and palette strips. Perfect for material studies.',
    width: W,
    height: H,
    page_title: 'Material Study · Earth tones',
    page_type: 'materials',
    blocks: [
      // Chapter eyebrow
      text('CHAPTER 02', 100, 100, 400, 28, 5,
           { font_family: 'Inter', font_size: 12, color: '#7A6B58', letter_spacing: 5 }),
      // Big serif title
      text('Material direction.', 100, 140, 1200, 130, 6,
           { font_family: 'Playfair Display', font_size: 56, italic: true, color: '#1A1410' }),
      // Subtitle body
      text('A tactile vocabulary of natural materials selected for warmth, longevity and quiet refinement.',
           100, 300, 1100, 80, 7,
           { font_family: 'Inter', font_size: 18, color: '#5A4D3F' }),
      // 4-grid materials
      material('Travertino classico', 'Natural stone · honed finish', PHOTOS.texture_stone,
               100, 440, 600, 540, 3),
      material('Lino crudo', 'Belgian linen · natural', PHOTOS.texture_linen,
               720, 440, 580, 260, 3),
      material('Palissandro', 'Solid wood · oiled', PHOTOS.texture_wood,
               720, 720, 580, 260, 3),
      // Caption strip
      text('1 · 2 · 3 — A palette grounded in earth.', 100, 1020, 1200, 32, 4,
           { font_family: 'Inter', font_size: 13, color: '#7A6B58', letter_spacing: 2 }),
      // Big inline photo
      img(PHOTOS.warm_interior, 100, 1100, 1200, 580, 2),
      // Palette
      palette(['#2C2419', '#8F7758', '#D2BC9E', '#F0E5D0'], 100, 1720, 760, 60, 7),
    ],
  },

  // 3. JAPANDI EDITORIAL ────────────────────────────────────────────────────
  japandi_editorial: {
    id: 'japandi_editorial',
    name: 'Japandi Editorial',
    eyebrow: 'Premium template',
    description: 'Asymmetrical whitespace, stone tones, minimal typography. For serene residential spaces.',
    width: W,
    height: H,
    page_title: 'Japandi · A study in stillness',
    page_type: 'narrative',
    blocks: [
      // Tiny chapter
      text('01 / Stillness', 120, 120, 400, 24, 5,
           { font_family: 'Inter', font_size: 11, color: '#9B917F', letter_spacing: 4 }),
      // Main title — left aligned, minimal
      text('Less, but better.', 120, 200, 900, 130, 6,
           { font_family: 'Playfair Display', font_size: 64, italic: false, color: '#2A2620' }),
      // Body intro
      text('A residence where space speaks louder than ornament. Soft stone, raw oak, paper, and shadow.',
           120, 380, 800, 100, 7,
           { font_family: 'Inter', font_size: 18, color: '#5A4D3F' }),
      // Asymmetric photo — right side
      img(PHOTOS.white_armchair, 760, 540, 540, 760, 2),
      // Caption under photo
      text('FIG. 01 — KOMOREBI LIVING', 760, 1320, 540, 24, 4,
           { font_family: 'Inter', font_size: 10, color: '#9B917F', letter_spacing: 4 }),
      // Small detail photo — left bottom
      img(PHOTOS.paper_decor, 120, 1100, 540, 380, 2),
      // Palette — minimal
      palette(['#F0EDE5', '#D7CFC0', '#9B917F', '#544A3D', '#1F1B16'], 120, 1540, 760, 50, 7),
      text('Palette — Stone & Cedar', 120, 1620, 540, 24, 8,
           { font_family: 'Inter', font_size: 11, color: '#9B917F', letter_spacing: 3 }),
    ],
  },

  // 4. FASHION / ART DIRECTION ──────────────────────────────────────────────
  fashion_editorial: {
    id: 'fashion_editorial',
    name: 'Fashion · Art Direction',
    eyebrow: 'Premium template',
    description: 'Oversized typography, layered imagery, experimental composition. Bold creative concepts.',
    width: W,
    height: H,
    page_title: 'Issue 04 · Cinematic neutrals',
    page_type: 'cover',
    blocks: [
      // Background photo full
      img(PHOTOS.cinematic_chair, 0, 0, W, H, 1),
      // Dark overlay won't render as a block — use shape if available, else text bg
      // Massive title
      text('ISSUE\n04', 60, 80, 1280, 720, 6,
           { font_family: 'Playfair Display', font_size: 280, color: '#FFFFFF',
             italic: true, line_height: 0.85 }),
      // Eyebrow tag
      text('CINEMATIC NEUTRALS', 60, 1020, 800, 36, 7,
           { font_family: 'Inter', font_size: 12, color: '#FFFFFF', letter_spacing: 6 }),
      // Manifesto body
      text('A study in restraint — the colors of dusk, the textures of memory.\nA wardrobe for the rooms we love.',
           60, 1080, 900, 160, 8,
           { font_family: 'Playfair Display', font_size: 28, italic: true, color: '#FFFFFF' }),
      // Inline secondary photo (overlap composition)
      img(PHOTOS.warm_interior, 720, 1300, 600, 440, 9),
      // Bottom caption strip
      text('SPRING / SUMMER 26 · FOR THE PROJECT.', 60, 1780, 1280, 30, 10,
           { font_family: 'Inter', font_size: 11, color: '#FFFFFF', letter_spacing: 5 }),
    ],
  },

  // 5. RESIDENTIAL MOODBOARD ────────────────────────────────────────────────
  residential_moodboard: {
    id: 'residential_moodboard',
    name: 'Residential Moodboard',
    eyebrow: 'Premium template',
    description: 'AD Magazine feeling. Furniture, materials, palette and mood, composed editorially.',
    width: W,
    height: H,
    page_title: 'Casa Brera · Living concept',
    page_type: 'cover',
    blocks: [
      // Top title
      text('Casa Brera', 80, 80, 1200, 110, 6,
           { font_family: 'Playfair Display', font_size: 56, color: '#1A1410' }),
      text('LIVING ROOM · CONCEPT BOARD', 80, 200, 1200, 28, 7,
           { font_family: 'Inter', font_size: 12, color: '#7A6B58', letter_spacing: 5 }),

      // Hero image left
      img(PHOTOS.warm_lounge, 80, 280, 760, 720, 2),

      // 2-stack right side
      img(PHOTOS.paper_decor, 880, 280, 440, 340, 3),
      img(PHOTOS.cinematic_chair, 880, 660, 440, 340, 3),

      // Palette
      palette(['#1A1410', '#3A2A1E', '#8F7758', '#C9AE8C', '#EBDDC2'], 80, 1060, 760, 60, 7),
      text('Palette · Warm earth', 80, 1140, 500, 26, 8,
           { font_family: 'Inter', font_size: 12, color: '#7A6B58', letter_spacing: 3 }),

      // Materials row
      material('Travertine', 'flooring', PHOTOS.texture_stone, 80, 1220, 280, 280, 4),
      material('Oak natural', 'millwork', PHOTOS.texture_wood,  380, 1220, 280, 280, 4),
      material('Brass', 'hardware', PHOTOS.texture_linen, 680, 1220, 280, 280, 4),

      // Annotation right
      text('"The home should be\nthe treasure chest of living."',
           1000, 1220, 320, 200, 8,
           { font_family: 'Playfair Display', font_size: 22, italic: true, color: '#3A2F26' }),
      text('— Le Corbusier', 1000, 1420, 320, 24, 9,
           { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 3 }),

      // Bottom caption
      text('Brera, Milano · 2026 · Studio MOOD', 80, 1640, 1200, 30, 10,
           { font_family: 'Inter', font_size: 12, color: '#7A6B58', letter_spacing: 4 }),
    ],
  },
};

export const PREMIUM_TEMPLATE_IDS = Object.keys(TEMPLATES);

export const getPremiumTemplate = (id) => TEMPLATES[id] || null;

/**
 * Apply a premium template to a moodboard.
 *
 * Creates a new page using the existing pages endpoint, then inserts all the
 * blocks via the existing blocks endpoint. No backend changes required.
 * Returns the new page id on success.
 */
export async function applyPremiumTemplate(api, moodboardId, templateId) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown premium template: ${templateId}`);

  // 1. Create the page (the editor's reload-pages flow will pick it up)
  const pageRes = await api.post(`/api/moodboards/${moodboardId}/pages`, {
    title: tpl.page_title || tpl.name,
    page_type: tpl.page_type || 'cover',
    settings: { background_color: '#F0EDE5' },
  });
  const pageId = pageRes.data?.id;
  if (!pageId) throw new Error('Page creation failed');

  // 2. Insert each block in parallel (preserves the declared z_index ordering
  //    server-side). We tolerate partial failures so the user still gets a
  //    useful page even if a single block 422s.
  await Promise.all(tpl.blocks.map((b) => (
    api.post(`/api/moodboards/${moodboardId}/blocks`, { ...b, page_id: pageId })
      .catch(() => null)
  )));

  return pageId;
}

export default TEMPLATES;
