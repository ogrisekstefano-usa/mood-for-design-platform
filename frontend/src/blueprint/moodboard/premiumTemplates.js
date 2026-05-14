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
  // Hospitality / interiors
  warm_interior:   'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80',
  warm_lounge:     'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
  cinematic_chair: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1400&q=80',
  paper_decor:     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
  white_armchair:  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
  lake_villa:      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
  living_window:   'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1400&q=80',
  loft_brick:      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80',
  bedroom_calm:    'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1400&q=80',
  dining_terrace:  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80',
  marble_corridor: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1400&q=80',
  garden_path:     'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=80',
  // Materials / textures
  texture_stone:   'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?auto=format&fit=crop&w=900&q=80',
  texture_wood:    'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?auto=format&fit=crop&w=900&q=80',
  texture_linen:   'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?auto=format&fit=crop&w=900&q=80',
  texture_concrete:'https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?auto=format&fit=crop&w=900&q=80',
  texture_velvet:  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80',
  texture_terracotta:'https://images.unsplash.com/photo-1545048702-79362596cdc9?auto=format&fit=crop&w=900&q=80',
  // Fashion / editorial
  draped_fabric:   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=80',
  silhouette:      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1400&q=80',
  // Minimal / japandi
  zen_room:        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80',
  scandi_kitchen:  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80',
  scandi_chair:    'https://images.unsplash.com/photo-1532372320572-cda25653a26d?auto=format&fit=crop&w=1400&q=80',
  wabi_vase:       'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=80',
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
    category: 'hospitality',
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
    category: 'materials',
    description: 'Close-up textures with editorial annotations and palette strips. Perfect for material studies.',
    width: W,
    height: H,
    page_title: 'Material Study · Earth tones',
    page_type: 'material_board',
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
    category: 'minimal',
    description: 'Asymmetrical whitespace, stone tones, minimal typography. For serene residential spaces.',
    width: W,
    height: H,
    page_title: 'Japandi · A study in stillness',
    page_type: 'split_story',
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
    category: 'fashion',
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
    category: 'residential',
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

  // 6. STONE ATELIER — high-end natural stone presentation ──────────────────
  stone_atelier: {
    id: 'stone_atelier',
    name: 'Stone Atelier',
    eyebrow: 'Premium template',
    category: 'materials',
    description: 'Salvatori-grade marble storytelling. Full-bleed stone imagery with tactile close-ups and elegant annotations.',
    width: W,
    height: H,
    page_title: 'Stone Atelier · Calacatta Vagli',
    page_type: 'material_board',
    blocks: [
      // Hero full-bleed stone slab
      img(PHOTOS.texture_stone, 0, 0, W, 980, 1),
      // Eyebrow over hero
      text('MATERIAL FOCUS', 80, 80, 600, 28, 4,
           { font_family: 'Inter', font_size: 11, color: '#FFFFFF', letter_spacing: 5 }),
      // Annotated big title
      text('Calacatta Vagli', 80, 120, 1200, 100, 5,
           { font_family: 'Playfair Display', font_size: 56, color: '#FFFFFF', italic: false }),
      // Annotation overlay caption
      text('FIG. 01 — Honed finish · 20mm', 80, 920, 600, 24, 6,
           { font_family: 'Inter', font_size: 10, color: '#FFFFFF', letter_spacing: 4 }),
      // Editorial body block
      text('A pure white field traced by sand-coloured veins. Quarried in the Apuan Alps; one slab unique to your project.',
           80, 1040, 1100, 100, 7,
           { font_family: 'Playfair Display', font_size: 22, italic: true, color: '#3A2F26' }),
      // 3 tactile close-ups row
      img(PHOTOS.texture_stone, 80, 1180, 380, 380, 3),
      img(PHOTOS.texture_wood,  480, 1180, 380, 380, 3),
      img(PHOTOS.texture_linen, 880, 1180, 380, 380, 3),
      // Captions row
      text('Calacatta', 80, 1580, 380, 24, 5,
           { font_family: 'Inter', font_size: 11, color: '#5A4D3F', letter_spacing: 3 }),
      text('Walnut', 480, 1580, 380, 24, 5,
           { font_family: 'Inter', font_size: 11, color: '#5A4D3F', letter_spacing: 3 }),
      text('Hemp linen', 880, 1580, 380, 24, 5,
           { font_family: 'Inter', font_size: 11, color: '#5A4D3F', letter_spacing: 3 }),
      // Palette strip
      palette(['#F5F0E6', '#D7CBB4', '#9E8A70', '#5C4A35', '#1F1610'], 80, 1660, 1200, 50, 7),
      // Closing caption
      text('STONE ATELIER · COMPOSITION N° 014', 80, 1750, 1200, 24, 8,
           { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 5 }),
    ],
  },

  // 7. BOUTIQUE HOTEL — cinematic hospitality pitch ─────────────────────────
  boutique_hotel: {
    id: 'boutique_hotel',
    name: 'Boutique Hotel',
    eyebrow: 'Premium template',
    category: 'hospitality',
    description: 'Aman-grade cinematic hospitality pitch. Warm interiors, soft shadows, premium serif typography.',
    width: W,
    height: H,
    page_title: 'Boutique Hotel · Lake Como retreat',
    page_type: 'cover',
    blocks: [
      // Oversized hero image
      img(PHOTOS.warm_lounge, 0, 0, W, 1100, 1),
      // Eyebrow + sub
      text('ROSEWOOD GROUP · CONCEPT 02', 80, 120, 800, 28, 4,
           { font_family: 'Inter', font_size: 11, color: '#FFFFFF', letter_spacing: 5 }),
      // Title at top
      text('A retreat for the senses.', 80, 170, 1100, 120, 5,
           { font_family: 'Playfair Display', font_size: 56, italic: true, color: '#FFFFFF' }),
      // Quote / editorial statement
      text('"The luxury our guests remember is not what they saw,\nbut how they felt at home in a place they had never been."',
           80, 1160, 1240, 160, 6,
           { font_family: 'Playfair Display', font_size: 28, italic: true, color: '#1A1410' }),
      text('— Studio MOOD, Direction notes', 80, 1340, 800, 22, 7,
           { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 3 }),
      // Atmosphere strip — 3 micro photos
      img(PHOTOS.cinematic_chair, 80, 1420, 400, 300, 3),
      img(PHOTOS.paper_decor,    500, 1420, 400, 300, 3),
      img(PHOTOS.white_armchair, 920, 1420, 400, 300, 3),
      // Palette
      palette(['#1A1410', '#3A2A1E', '#7A5530', '#A88562', '#EBDDC2'], 80, 1740, 760, 50, 7),
      // Closing
      text('LAKE COMO · ITALIA · SEASON 26', 880, 1750, 440, 28, 8,
           { font_family: 'Inter', font_size: 11, color: '#5A4D3F', letter_spacing: 5 }),
    ],
  },

  // 8. FASHION RESIDENTIAL — couture-residential moodboard ──────────────────
  fashion_residential: {
    id: 'fashion_residential',
    name: 'Fashion Residential',
    eyebrow: 'Premium template',
    category: 'fashion',
    description: 'Vogue Living × The Row. Oversized typography, brutal crops, muted monochrome — a creative director\'s moodboard.',
    width: W,
    height: H,
    page_title: 'Fashion Residential · Atelier 01',
    page_type: 'cover',
    blocks: [
      // Brutal background
      img(PHOTOS.white_armchair, 0, 0, W, H, 1),
      // Giant editorial title — split across two lines
      text('THE', 60, 80, 800, 320, 6,
           { font_family: 'Playfair Display', font_size: 280, color: '#1A1410',
             italic: false, line_height: 0.85 }),
      text('ROOM', 60, 380, 1240, 320, 7,
           { font_family: 'Playfair Display', font_size: 280, italic: true, color: '#1A1410',
             line_height: 0.85 }),
      // Subtitle
      text('A residence as a wardrobe.', 60, 720, 1240, 60, 8,
           { font_family: 'Playfair Display', font_size: 32, italic: true, color: '#3A2F26' }),
      // Editorial overlay photo — large rectangle on the right
      img(PHOTOS.cinematic_chair, 720, 850, 620, 700, 9),
      // Manifesto body left
      text('We dress our walls the way we dress ourselves — with intention, restraint, and the textures of a life examined.',
           60, 880, 600, 200, 10,
           { font_family: 'Inter', font_size: 16, color: '#1A1410' }),
      // Palette strip — muted monochrome
      palette(['#F8F4ED', '#E6DBC6', '#A39078', '#4F4438', '#1A1410'], 60, 1620, 700, 60, 11),
      text('PALETTE 01 · ATELIER', 60, 1700, 700, 24, 12,
           { font_family: 'Inter', font_size: 11, color: '#5A4D3F', letter_spacing: 5 }),
      // Bottom caption right
      text('ISSUE 01 · F/W 26', 1000, 1700, 340, 24, 12,
           { font_family: 'Inter', font_size: 11, color: '#5A4D3F', letter_spacing: 5 }),
    ],
  },

  // 9. LAKESIDE VILLA — hospitality serenity panoramic ──────────────────────
  lakeside_villa: {
    id: 'lakeside_villa', name: 'Lakeside Villa',
    eyebrow: 'Premium template', category: 'hospitality',
    description: 'Panoramic lake retreat. Soft greys, pale blue, water reflections — Aman Lake Como energy.',
    width: W, height: H, page_title: 'Lakeside Villa · Panoramic Suite', page_type: 'cover',
    blocks: [
      img(PHOTOS.lake_villa, 0, 0, W, 1280, 1),
      text('AMAN VENICE · CONCEPT 03', 80, 100, 800, 26, 4,
           { font_family: 'Inter', font_size: 11, color: '#FFFFFF', letter_spacing: 5 }),
      text('Where the lake\nbecomes the room.', 80, 150, 1200, 240, 5,
           { font_family: 'Playfair Display', font_size: 72, color: '#FFFFFF', italic: true, line_height: 0.95 }),
      text('FIG. 01 — PANORAMIC SUITE · LAKE COMO', 80, 1220, 700, 24, 6,
           { font_family: 'Inter', font_size: 10, color: '#FFFFFF', letter_spacing: 4 }),
      text('Pale linen, smoked oak, water-honed travertine. A vocabulary of stillness for the slow guest.',
           80, 1340, 1200, 90, 7,
           { font_family: 'Playfair Display', font_size: 22, italic: true, color: '#3A2F26' }),
      img(PHOTOS.living_window, 80, 1470, 600, 320, 3),
      img(PHOTOS.dining_terrace, 700, 1470, 600, 320, 3),
      palette(['#1F2A2D', '#445459', '#8BA0A6', '#C9D3D2', '#EFEAE0'], 80, 1810, 1200, 36, 7),
    ],
  },

  // 10. MINERAL STUDY — material brutalist serene ───────────────────────────
  mineral_study: {
    id: 'mineral_study', name: 'Mineral Study',
    eyebrow: 'Premium template', category: 'materials',
    description: 'Concrete, mineral and raw earth tones. Brutalist serenity for contemporary architectural projects.',
    width: W, height: H, page_title: 'Mineral Study · Concrete & Earth', page_type: 'material_board',
    blocks: [
      text('STUDIO MOOD', 100, 100, 600, 22, 4,
           { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 6 }),
      text('Mineral.', 100, 150, 900, 130, 5,
           { font_family: 'Playfair Display', font_size: 72, color: '#1A1410', italic: false }),
      text('A study in compressed time — concrete, basalt, and the patina of weather.',
           100, 310, 1100, 60, 6,
           { font_family: 'Inter', font_size: 16, color: '#5A4D3F', italic: true }),
      img(PHOTOS.texture_concrete, 100, 410, 600, 580, 2),
      img(PHOTOS.texture_stone, 720, 410, 580, 280, 2),
      img(PHOTOS.texture_terracotta, 720, 710, 580, 280, 2),
      material('Concrete · sandblast', 'Cast in place · 80mm', PHOTOS.texture_concrete,
               100, 1030, 380, 380, 3),
      material('Basalt · split face', 'Slabs 600×1200', PHOTOS.texture_stone,
               500, 1030, 380, 380, 3),
      material('Terracotta · raw', 'Hand-pressed · matte', PHOTOS.texture_terracotta,
               900, 1030, 380, 380, 3),
      palette(['#1C1A17', '#4A453E', '#7A7066', '#B5A797', '#E4D9C9'], 100, 1450, 1200, 40, 7),
      text('PALETTE · WEATHERED MINERAL', 100, 1520, 1200, 22, 8,
           { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 5 }),
      img(PHOTOS.marble_corridor, 100, 1580, 1200, 220, 2),
    ],
  },

  // 11. BRERA APARTMENT — residential editorial Milan ───────────────────────
  brera_apartment: {
    id: 'brera_apartment', name: 'Brera Apartment',
    eyebrow: 'Premium template', category: 'residential',
    description: 'Milan editorial — historic Brera apartment, terrazzo & velvet, soft jewel tones, AD Italia rhythm.',
    width: W, height: H, page_title: 'Brera Apartment · Living concept', page_type: 'cover',
    blocks: [
      text('AD ITALIA · OCT 26', 80, 80, 600, 22, 4,
           { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 6 }),
      text('Brera apartment.', 80, 120, 1200, 110, 5,
           { font_family: 'Playfair Display', font_size: 58, color: '#1A1410' }),
      text('A historic Milan residence reimagined for one collector.', 80, 240, 1200, 30, 6,
           { font_family: 'Inter', font_size: 14, italic: true, color: '#5A4D3F' }),
      img(PHOTOS.warm_interior, 80, 320, 820, 700, 2),
      img(PHOTOS.texture_velvet, 920, 320, 400, 340, 2),
      img(PHOTOS.warm_lounge, 920, 680, 400, 340, 2),
      text('FIG. 01 — LIVING ROOM · BRERA, MILANO', 80, 1040, 800, 22, 4,
           { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 4 }),
      palette(['#2A1F1B', '#5C3F33', '#A55B3F', '#D6B79A', '#F0E3D2'], 80, 1100, 760, 50, 7),
      text('Palette · Velvet & terracotta', 80, 1170, 760, 24, 8,
           { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 3 }),
      material('Velvet · forest', 'Italian woven · GOTS', PHOTOS.texture_velvet, 80, 1240, 300, 280, 4),
      material('Terrazzo · cinnamon', 'Cast · 25mm', PHOTOS.texture_terracotta, 400, 1240, 300, 280, 4),
      material('Walnut · oiled', 'Solid · Italian', PHOTOS.texture_wood, 720, 1240, 300, 280, 4),
      text('"Una casa deve essere una stanza dell\'anima."', 1040, 1240, 280, 180, 8,
           { font_family: 'Playfair Display', font_size: 18, italic: true, color: '#3A2F26' }),
      text('— Gio Ponti', 1040, 1420, 280, 24, 9,
           { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 3 }),
      text('Studio MOOD · Milano · 2026', 80, 1620, 1200, 28, 10,
           { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 4 }),
    ],
  },

  // 12. COASTAL RETREAT — residential by the sea ────────────────────────────
  coastal_retreat: {
    id: 'coastal_retreat', name: 'Coastal Retreat',
    eyebrow: 'Premium template', category: 'residential',
    description: 'Mediterranean residential — bleached oak, pale linen, sea-glass blues, gallery-hung art.',
    width: W, height: H, page_title: 'Coastal Retreat · Master suite', page_type: 'cover',
    blocks: [
      img(PHOTOS.bedroom_calm, 0, 0, W, 1180, 1),
      text('PORTO CERVO · CONCEPT', 80, 100, 700, 24, 4,
           { font_family: 'Inter', font_size: 11, color: '#FFFFFF', letter_spacing: 5 }),
      text('Bleached.\nSlow. Bright.', 80, 150, 1200, 280, 5,
           { font_family: 'Playfair Display', font_size: 80, color: '#FFFFFF', line_height: 0.95 }),
      text('Master suite · Costa Smeralda residence', 80, 1110, 900, 26, 6,
           { font_family: 'Inter', font_size: 12, color: '#FFFFFF', letter_spacing: 3 }),
      text('A residence reduced to its sun-bleached essentials. Salt, paper, water, oak.',
           80, 1230, 1200, 70, 7,
           { font_family: 'Playfair Display', font_size: 22, italic: true, color: '#3A2F26' }),
      img(PHOTOS.living_window, 80, 1340, 580, 380, 2),
      img(PHOTOS.dining_terrace, 700, 1340, 600, 380, 2),
      palette(['#F7F2EA', '#E2D5C0', '#A8B5B3', '#5E7376', '#2E3D40'], 80, 1750, 1200, 40, 7),
      text('SEA · OAK · LINEN · CHALK', 80, 1820, 1200, 22, 8,
           { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 5 }),
    ],
  },

  // 13. SCANDINAVIAN NORDIC — minimal nordic light ──────────────────────────
  scandi_nordic: {
    id: 'scandi_nordic', name: 'Scandinavian Nordic',
    eyebrow: 'Premium template', category: 'minimal',
    description: 'Nordic minimal — pale woods, soft whites, sculptural simplicity. Vipp × Frama × Menu energy.',
    width: W, height: H, page_title: 'Scandinavian · Pale interior', page_type: 'split_story',
    blocks: [
      text('02 / Light', 120, 120, 400, 22, 4,
           { font_family: 'Inter', font_size: 11, color: '#9B917F', letter_spacing: 5 }),
      text('Nordic.', 120, 180, 700, 130, 5,
           { font_family: 'Playfair Display', font_size: 72, color: '#1F1B16' }),
      text('A residence shaped by clarity, restraint, and the long Northern light.',
           120, 350, 900, 60, 6,
           { font_family: 'Inter', font_size: 16, italic: true, color: '#5A4D3F' }),
      img(PHOTOS.scandi_kitchen, 120, 460, 700, 800, 2),
      img(PHOTOS.scandi_chair, 880, 460, 420, 400, 2),
      img(PHOTOS.texture_linen, 880, 880, 420, 380, 2),
      text('FIG. 01 — KITCHEN COMPOSITION', 120, 1290, 700, 22, 4,
           { font_family: 'Inter', font_size: 10, color: '#9B917F', letter_spacing: 4 }),
      palette(['#FFFFFF', '#F0EBE2', '#D7CFC0', '#7A746B', '#2A2620'], 120, 1380, 1100, 46, 7),
      text('PALETTE · BIRCH & FOG', 120, 1450, 700, 22, 8,
           { font_family: 'Inter', font_size: 10, color: '#9B917F', letter_spacing: 5 }),
      material('Birch · whitewash', 'Cabinetry · matte', PHOTOS.texture_wood, 120, 1520, 360, 280, 3),
      material('Wool bouclé · chalk', 'Upholstery', PHOTOS.texture_linen, 500, 1520, 360, 280, 3),
      material('Limestone · honed', 'Flooring', PHOTOS.texture_stone, 880, 1520, 360, 280, 3),
    ],
  },

  // 14. WABI SABI — Japanese imperfection minimal ───────────────────────────
  wabi_sabi: {
    id: 'wabi_sabi', name: 'Wabi-Sabi',
    eyebrow: 'Premium template', category: 'minimal',
    description: 'Japanese wabi-sabi — patina, imperfection, dark plaster, hand-thrown ceramics, kintsugi attention.',
    width: W, height: H, page_title: 'Wabi-Sabi · Atelier dwelling', page_type: 'split_story',
    blocks: [
      text('03 / Imperfection', 120, 120, 500, 22, 4,
           { font_family: 'Inter', font_size: 11, color: '#9B917F', letter_spacing: 5 }),
      text('Wabi.', 120, 180, 700, 140, 5,
           { font_family: 'Playfair Display', font_size: 84, italic: true, color: '#1F1B16' }),
      text('侘寂 — the beauty of the imperfect, the impermanent, the incomplete.',
           120, 370, 900, 60, 6,
           { font_family: 'Playfair Display', font_size: 20, italic: true, color: '#5A4D3F' }),
      img(PHOTOS.zen_room, 0, 480, 820, 980, 2),
      img(PHOTOS.wabi_vase, 860, 480, 460, 480, 2),
      text('FIG. 01 — TATAMI ROOM', 860, 980, 440, 22, 4,
           { font_family: 'Inter', font_size: 10, color: '#9B917F', letter_spacing: 4 }),
      text('"There is a crack in everything.\nThat\'s how the light gets in."',
           860, 1040, 460, 160, 7,
           { font_family: 'Playfair Display', font_size: 20, italic: true, color: '#3A2F26' }),
      text('— Leonard Cohen', 860, 1220, 460, 24, 8,
           { font_family: 'Inter', font_size: 11, color: '#9B917F', letter_spacing: 3 }),
      img(PHOTOS.texture_terracotta, 860, 1290, 460, 200, 2),
      palette(['#1A1612', '#3B342B', '#6B5F4F', '#A89880', '#E5D9C5'], 120, 1530, 1200, 50, 7),
      text('PALETTE · EARTH & PATINA', 120, 1610, 1200, 22, 8,
           { font_family: 'Inter', font_size: 10, color: '#9B917F', letter_spacing: 5 }),
    ],
  },

  // 15. EDITORIAL MAGAZINE — fashion cover oversized ────────────────────────
  editorial_magazine: {
    id: 'editorial_magazine', name: 'Editorial Magazine',
    eyebrow: 'Premium template', category: 'fashion',
    description: 'AD × Vogue cover energy. Oversized masthead, layered photography, magazine-grade typography.',
    width: W, height: H, page_title: 'Editorial · Cover Issue 02', page_type: 'cover',
    blocks: [
      img(PHOTOS.draped_fabric, 0, 0, W, H, 1),
      text('M', 60, 60, 900, 600, 6,
           { font_family: 'Playfair Display', font_size: 520, color: '#FFFFFF',
             italic: false, line_height: 0.82 }),
      text('OOD', 800, 60, 540, 320, 7,
           { font_family: 'Playfair Display', font_size: 280, italic: true, color: '#FFFFFF',
             line_height: 0.82 }),
      text('ISSUE 02 · SS26', 60, 760, 800, 30, 8,
           { font_family: 'Inter', font_size: 12, color: '#FFFFFF', letter_spacing: 6 }),
      text('THE LANGUAGE OF\nINTERIORS.', 60, 820, 1200, 200, 9,
           { font_family: 'Playfair Display', font_size: 56, italic: true, color: '#FFFFFF',
             line_height: 0.95 }),
      img(PHOTOS.cinematic_chair, 720, 1100, 620, 580, 10),
      text('Inside · 12 residences · 24 materials · 1 manifesto.',
           60, 1700, 900, 30, 11,
           { font_family: 'Inter', font_size: 13, color: '#FFFFFF', letter_spacing: 2 }),
      text('STUDIO MOOD · MILANO', 60, 1780, 700, 24, 12,
           { font_family: 'Inter', font_size: 11, color: '#FFFFFF', letter_spacing: 6 }),
    ],
  },
};

export const PREMIUM_TEMPLATE_IDS = Object.keys(TEMPLATES);

export const getPremiumTemplate = (id) => TEMPLATES[id] || null;

/**
 * Premium template categories (locked order = editorial reading rhythm).
 * Each category groups together templates that share the same creative
 * intent so the picker reads as a curated archive, not a flat grid.
 */
export const PREMIUM_CATEGORIES = [
  { key: 'hospitality', title_fallback: 'Luxury Hospitality',
    subtitle_fallback: 'Cinematic warmth for boutique hotels & resorts — Aman, Six Senses, Rosewood lineage.' },
  { key: 'materials',   title_fallback: 'Material Narratives',
    subtitle_fallback: 'Tactile storytelling for stone, wood & textile — Salvatori, Margraf, Material Bank.' },
  { key: 'residential', title_fallback: 'Residential Editorial',
    subtitle_fallback: 'AD Magazine layouts for private residences — Italian, Mediterranean, Northern.' },
  { key: 'fashion',     title_fallback: 'Fashion · Art Direction',
    subtitle_fallback: 'Magazine-cover energy & couture restraint — Vogue Living, The Row, Loewe Casa.' },
  { key: 'minimal',     title_fallback: 'Minimal · Japandi',
    subtitle_fallback: 'Whitespace as material — Wabi-sabi, Nordic clarity, Japandi serenity.' },
];

export const getTemplatesByCategory = (category) =>
  Object.values(TEMPLATES).filter((t) => t.category === category);

/**
 * Apply a premium template to a moodboard.
 *
 * Creates a new page using the existing pages endpoint, then inserts all the
 * blocks via the existing blocks endpoint. No backend changes required.
 * Returns `{ pageId, blocksCreated, blocksTotal }` so the caller can surface
 * a precise success/partial/failure toast to the designer.
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

  // 2. Insert each block in parallel. Settle on per-block outcome so partial
  //    failures are visible to the caller. We tolerate individual 422s so the
  //    designer still gets a usable page.
  const results = await Promise.allSettled(
    tpl.blocks.map((b) => api.post(`/api/moodboards/${moodboardId}/blocks`,
                                   { ...b, page_id: pageId })),
  );
  const blocksCreated = results.filter((r) => r.status === 'fulfilled').length;

  return { pageId, blocksCreated, blocksTotal: tpl.blocks.length };
}

export default TEMPLATES;
