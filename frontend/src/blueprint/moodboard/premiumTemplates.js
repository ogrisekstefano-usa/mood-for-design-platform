/**
 * Premium Pre-built Templates — MULTI-PAGE editorial presentations.
 *
 * Each premium template is a **complete project** of 6-7 pages, ready for
 * a professional moodboard presentation. NOT a single starting layout.
 *
 * When applied, the frontend creates each page via `POST /api/moodboards/
 * {id}/pages` and inserts its blocks via `POST /api/moodboards/{id}/blocks`
 * (same flow `addBlock` uses). NO backend changes.
 *
 * Categories (locked order = editorial reading rhythm):
 *   hospitality   — boutique hotel / resort presentations
 *   materials     — stone / wood / textile narratives
 *   residential   — private residence AD-magazine decks
 *   fashion       — couture-residential / magazine art direction
 *   minimal       — japandi / nordic / wabi-sabi
 *
 * Page system: 1400×1866 portrait, 7-12 blocks per page.
 */

const W = 1400;
const H = 1866;

// Vetted Unsplash photo pool — shared across templates so the browser
// HTTP cache is reused across previews and applied moodboards.
const PHOTOS = {
  // Hospitality / interiors
  warm_interior:   'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80',
  warm_lounge:     'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
  cinematic_chair: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1400&q=80',
  paper_decor:     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1400&q=80',
  white_armchair:  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
  lake_villa:      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80',
  living_window:   'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1400&q=80',
  bedroom_calm:    'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1400&q=80',
  dining_terrace:  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80',
  marble_corridor: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1400&q=80',
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

// Shared palette presets keep templates internally cohesive.
const PALETTES = {
  warm_earth:   ['#1A1410', '#3A2A1E', '#8F7758', '#C9AE8C', '#EBDDC2'],
  travertine:   ['#2C2419', '#8F7758', '#D2BC9E', '#F0E5D0', '#F8F4ED'],
  stone_cedar:  ['#F0EDE5', '#D7CFC0', '#9B917F', '#544A3D', '#1F1B16'],
  monochrome:   ['#F8F4ED', '#E6DBC6', '#A39078', '#4F4438', '#1A1410'],
  lake_mist:    ['#1F2A2D', '#445459', '#8BA0A6', '#C9D3D2', '#EFEAE0'],
  brera_velvet: ['#2A1F1B', '#5C3F33', '#A55B3F', '#D6B79A', '#F0E3D2'],
  coast_chalk:  ['#F7F2EA', '#E2D5C0', '#A8B5B3', '#5E7376', '#2E3D40'],
  nordic_birch: ['#FFFFFF', '#F0EBE2', '#D7CFC0', '#7A746B', '#2A2620'],
  wabi_patina:  ['#1A1612', '#3B342B', '#6B5F4F', '#A89880', '#E5D9C5'],
  mineral:      ['#1C1A17', '#4A453E', '#7A7066', '#B5A797', '#E4D9C9'],
};

// ── Block factories ───────────────────────────────────────────────────────
const img = (src, x, y, w, h, z = 1) => ({
  type: 'image', x, y, width: w, height: h, z_index: z,
  content: { src, fit: 'cover', focal_x: 50, focal_y: 50 },
});
const text = (value, x, y, w, h, z, style = {}) => ({
  type: 'text', x, y, width: w, height: h, z_index: z,
  content: { value },
  style: {
    font_family: 'Playfair Display', font_size: 32, font_weight: 400,
    color: '#1A1410', align: 'left', italic: false, ...style,
  },
});
const palette = (colors, x, y, w, h, z = 5) => ({
  type: 'palette', x, y, width: w, height: h, z_index: z, content: { colors },
});
const material = (name, sub, src, x, y, w, h, z = 4) => ({
  type: 'material', x, y, width: w, height: h, z_index: z,
  content: { name, subtitle: sub, image: src },
});
const note = (value, x, y, w, h, z = 6, color = '#EBDDC2') => ({
  type: 'note', x, y, width: w, height: h, z_index: z,
  content: { value }, style: { background_color: color },
});

// ── Page factories ────────────────────────────────────────────────────────
// Each factory returns { title, page_type, settings, blocks }
// All factories share the same canvas (1400×1866) and use semantic tokens.

// 1. Cinematic editorial cover — full-bleed hero + giant title + palette.
function coverPage({ title, subtitle, eyebrow, hero, paletteKey, brandSign }) {
  const p = PALETTES[paletteKey] || PALETTES.warm_earth;
  return {
    title, page_type: 'cover',
    settings: { background_color: '#0F0D0B' },
    blocks: [
      img(hero, 0, 0, W, 1280, 1),
      text(eyebrow || 'STUDIO MOOD', 80, 100, 800, 28, 4,
        { font_family: 'Inter', font_size: 12, color: '#FFFFFF', letter_spacing: 5 }),
      text(title, 80, 1140, 1240, 220, 5,
        { font_family: 'Playfair Display', font_size: 72, color: '#FFFFFF', italic: true, line_height: 0.95 }),
      ...(subtitle ? [text(subtitle, 80, 1380, 1100, 60, 6,
        { font_family: 'Playfair Display', font_size: 24, italic: true, color: '#3A2F26' })] : []),
      palette(p, 80, 1560, 1100, 50, 7),
      ...(brandSign ? [text(brandSign, 80, 1750, 1200, 24, 8,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 4 })] : []),
    ],
  };
}

// 2. Concept statement — large editorial typography + supporting photo.
function conceptPage({ title, eyebrow, body, attribution, photo, paletteKey }) {
  const p = PALETTES[paletteKey] || PALETTES.warm_earth;
  return {
    title, page_type: 'split_story',
    settings: { background_color: '#F0EDE5' },
    blocks: [
      text(eyebrow || 'CHAPTER 01', 100, 100, 600, 26, 4,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 5 }),
      text(title, 100, 140, 1200, 130, 5,
        { font_family: 'Playfair Display', font_size: 56, italic: true, color: '#1A1410' }),
      text(body, 100, 320, 700, 700, 6,
        { font_family: 'Playfair Display', font_size: 22, italic: true, color: '#3A2F26', line_height: 1.5 }),
      ...(attribution ? [text(attribution, 100, 1040, 700, 24, 7,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 3 })] : []),
      img(photo, 840, 320, 480, 1240, 2),
      text('FIG. 01', 840, 1580, 480, 20, 8,
        { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 4 }),
      palette(p, 100, 1680, 1200, 40, 7),
    ],
  };
}

// 3. Atmosphere / mood — multi-photo cinematic composition.
function moodPage({ title, eyebrow, photos, copy, paletteKey }) {
  const p = PALETTES[paletteKey] || PALETTES.warm_earth;
  const [a, b, c, d] = photos;
  return {
    title, page_type: 'mood',
    settings: { background_color: '#F8F4ED' },
    blocks: [
      text(eyebrow || 'ATMOSPHERE', 100, 100, 600, 24, 4,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 5 }),
      text(title, 100, 140, 1200, 100, 5,
        { font_family: 'Playfair Display', font_size: 48, color: '#1A1410' }),
      img(a, 100, 280, 760, 880, 2),
      img(b || a, 900, 280, 400, 420, 3),
      img(c || a, 900, 720, 400, 220, 3),
      img(d || a, 900, 960, 400, 200, 3),
      ...(copy ? [text(copy, 100, 1220, 1200, 90, 7,
        { font_family: 'Playfair Display', font_size: 20, italic: true, color: '#3A2F26' })] : []),
      palette(p, 100, 1380, 1200, 40, 7),
      text('MOOD STUDY · COMPOSITION 02', 100, 1450, 1200, 20, 8,
        { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 5 }),
    ],
  };
}

// 4. Material selection — labelled grid of materials.
function materialsPage({ title, eyebrow, items, paletteKey, intro }) {
  const p = PALETTES[paletteKey] || PALETTES.travertine;
  // items: [{name, sub, src}] up to 6 entries
  const positions = [
    [100, 360], [500, 360], [900, 360],
    [100, 800], [500, 800], [900, 800],
  ];
  const matBlocks = items.slice(0, 6).map((m, i) => {
    const [x, y] = positions[i];
    return material(m.name, m.sub, m.src, x, y, 380, 400, 4);
  });
  return {
    title, page_type: 'material_board',
    settings: { background_color: '#F0EDE5' },
    blocks: [
      text(eyebrow || 'MATERIAL DIRECTION', 100, 100, 700, 26, 4,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 5 }),
      text(title, 100, 140, 1200, 110, 5,
        { font_family: 'Playfair Display', font_size: 56, color: '#1A1410' }),
      ...(intro ? [text(intro, 100, 270, 1100, 60, 6,
        { font_family: 'Playfair Display', font_size: 20, italic: true, color: '#3A2F26' })] : []),
      ...matBlocks,
      palette(p, 100, 1280, 1200, 50, 7),
      text('PALETTE DIRECTION', 100, 1360, 800, 20, 8,
        { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 5 }),
    ],
  };
}

// 5. Furniture / product selection — 3-up product gallery.
function furniturePage({ title, eyebrow, items, paletteKey, intro }) {
  const p = PALETTES[paletteKey] || PALETTES.warm_earth;
  const positions = [
    [100, 360], [500, 360], [900, 360],
    [100, 1020], [500, 1020], [900, 1020],
  ];
  const itemBlocks = items.slice(0, 6).map((it, i) => {
    const [x, y] = positions[i];
    return [
      img(it.src, x, y, 380, 480, 2),
      text(it.name, x, y + 500, 380, 26, 5,
        { font_family: 'Playfair Display', font_size: 16, color: '#1A1410' }),
      text(it.sub || '', x, y + 530, 380, 20, 5,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 2 }),
    ];
  }).flat();
  return {
    title, page_type: 'product_grid',
    settings: { background_color: '#F8F4ED' },
    blocks: [
      text(eyebrow || 'FURNITURE SELECTION', 100, 100, 700, 26, 4,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 5 }),
      text(title, 100, 140, 1200, 110, 5,
        { font_family: 'Playfair Display', font_size: 56, color: '#1A1410' }),
      ...(intro ? [text(intro, 100, 270, 1100, 60, 6,
        { font_family: 'Playfair Display', font_size: 20, italic: true, color: '#3A2F26' })] : []),
      ...itemBlocks,
      palette(p, 100, 1700, 1200, 36, 7),
    ],
  };
}

// 6. Gallery / detail spread — 4-photo cinematic gallery.
function galleryPage({ title, eyebrow, photos, copy }) {
  const [a, b, c, d] = photos;
  return {
    title, page_type: 'gallery',
    settings: { background_color: '#F0EDE5' },
    blocks: [
      text(eyebrow || 'GALLERY', 100, 100, 700, 26, 4,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 5 }),
      text(title, 100, 140, 1200, 110, 5,
        { font_family: 'Playfair Display', font_size: 56, italic: true, color: '#1A1410' }),
      img(a, 100, 320, 760, 600, 2),
      img(b || a, 900, 320, 400, 290, 3),
      img(c || a, 900, 630, 400, 290, 3),
      img(d || a, 100, 940, 1200, 540, 2),
      ...(copy ? [text(copy, 100, 1520, 1200, 80, 7,
        { font_family: 'Playfair Display', font_size: 20, italic: true, color: '#3A2F26' })] : []),
    ],
  };
}

// 7. Quote / manifesto — pull quote with attribution + soft photo.
function quotePage({ quote, attribution, photo, paletteKey, eyebrow }) {
  const p = PALETTES[paletteKey] || PALETTES.warm_earth;
  return {
    title: 'Visual Statement', page_type: 'quote',
    settings: { background_color: '#F8F4ED' },
    blocks: [
      img(photo, 0, 0, W, 1080, 1),
      text(eyebrow || 'A WORD ON DIRECTION', 100, 1180, 800, 24, 4,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 5 }),
      text(quote, 100, 1240, 1200, 280, 5,
        { font_family: 'Playfair Display', font_size: 44, italic: true, color: '#1A1410', line_height: 1.2 }),
      text(attribution, 100, 1560, 800, 26, 6,
        { font_family: 'Inter', font_size: 13, color: '#7A6B58', letter_spacing: 3 }),
      palette(p, 100, 1680, 1200, 36, 7),
    ],
  };
}

// 8. Approval / closing — soft palette, sign-off block.
function approvalPage({ title, eyebrow, brand, paletteKey, copy }) {
  const p = PALETTES[paletteKey] || PALETTES.warm_earth;
  return {
    title: title || 'For your approval', page_type: 'approval',
    settings: { background_color: '#F0EDE5' },
    blocks: [
      text(eyebrow || 'CLOSING', 100, 120, 700, 28, 4,
        { font_family: 'Inter', font_size: 12, color: '#7A6B58', letter_spacing: 6 }),
      text(title || 'For your approval.', 100, 200, 1200, 200, 5,
        { font_family: 'Playfair Display', font_size: 88, italic: true, color: '#1A1410', line_height: 0.95 }),
      text(copy || 'Thank you for your consideration. Please review the direction and let us know your thoughts.',
        100, 480, 1100, 100, 6,
        { font_family: 'Playfair Display', font_size: 22, italic: true, color: '#3A2F26', line_height: 1.5 }),
      // Signature line
      text('___________________________', 100, 1200, 500, 30, 7,
        { font_family: 'Inter', font_size: 14, color: '#7A6B58' }),
      text('CLIENT SIGNATURE', 100, 1240, 500, 22, 8,
        { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 4 }),
      text('___________________________', 750, 1200, 500, 30, 7,
        { font_family: 'Inter', font_size: 14, color: '#7A6B58' }),
      text('DATE', 750, 1240, 500, 22, 8,
        { font_family: 'Inter', font_size: 10, color: '#7A6B58', letter_spacing: 4 }),
      palette(p, 100, 1500, 1200, 40, 7),
      text(brand || 'STUDIO MOOD · MILANO · 2026', 100, 1700, 1200, 22, 9,
        { font_family: 'Inter', font_size: 11, color: '#7A6B58', letter_spacing: 5 }),
    ],
  };
}

// ── Templates (15 premium, each 6-7 pages) ───────────────────────────────
const TEMPLATES = {
  // 1. LUXURY HOSPITALITY — 7 pages
  luxury_hospitality: {
    id: 'luxury_hospitality', name: 'Luxury Hospitality',
    category: 'hospitality',
    description: 'Warm neutrals, cinematic photography, elegant serif typography. Ideal for boutique hotel projects.',
    pages: [
      coverPage({ title: 'A timeless aesthetic\nfor modern hospitality.',
        eyebrow: 'VILLA COMO · LAGO ITALIA', hero: PHOTOS.warm_lounge,
        paletteKey: 'warm_earth', brandSign: 'STUDIO MOOD · MILANO' }),
      conceptPage({ title: 'Concept statement.', eyebrow: 'CHAPTER 01',
        body: 'Travertine, hand-tufted wool, brass detailing and oak millwork compose a calm, residential lobby atmosphere — the journey before the rooms.',
        attribution: '— Direction notes, Studio MOOD',
        photo: PHOTOS.warm_interior, paletteKey: 'warm_earth' }),
      moodPage({ title: 'Atmosphere.', eyebrow: 'CHAPTER 02',
        photos: [PHOTOS.warm_lounge, PHOTOS.paper_decor, PHOTOS.cinematic_chair, PHOTOS.warm_interior],
        copy: 'Soft shadow, warm grain, golden hour — the language of arrival.',
        paletteKey: 'warm_earth' }),
      materialsPage({ title: 'Material direction.', eyebrow: 'CHAPTER 03',
        intro: 'A tactile vocabulary of natural materials selected for warmth, longevity and quiet refinement.',
        items: [
          { name: 'Travertino classico', sub: 'Stone · honed', src: PHOTOS.texture_stone },
          { name: 'Palissandro', sub: 'Solid wood · oiled', src: PHOTOS.texture_wood },
          { name: 'Lino crudo', sub: 'Belgian linen', src: PHOTOS.texture_linen },
          { name: 'Brass · brushed', sub: 'Hardware', src: PHOTOS.texture_terracotta },
          { name: 'Velvet · forest', sub: 'Upholstery', src: PHOTOS.texture_velvet },
          { name: 'Concrete · sand', sub: 'Cast finish', src: PHOTOS.texture_concrete },
        ], paletteKey: 'travertine' }),
      furniturePage({ title: 'Furniture selection.', eyebrow: 'CHAPTER 04',
        intro: 'Residential proportions, hospitality durability.',
        items: [
          { name: 'Lounge sofa', sub: 'Custom · 320cm', src: PHOTOS.warm_lounge },
          { name: 'Lobby chair', sub: 'Walnut frame', src: PHOTOS.cinematic_chair },
          { name: 'Side table', sub: 'Travertine top', src: PHOTOS.paper_decor },
        ], paletteKey: 'warm_earth' }),
      galleryPage({ title: 'Lighting & detail.', eyebrow: 'CHAPTER 05',
        photos: [PHOTOS.warm_interior, PHOTOS.living_window, PHOTOS.dining_terrace, PHOTOS.marble_corridor],
        copy: 'Indirect, warm, theatrical without being staged.' }),
      approvalPage({ eyebrow: 'CHAPTER 06', paletteKey: 'warm_earth',
        brand: 'STUDIO MOOD · VILLA COMO · 2026' }),
    ],
  },

  // 2. MATERIAL NARRATIVE — 6 pages
  material_narrative: {
    id: 'material_narrative', name: 'Material Narrative',
    category: 'materials',
    description: 'Close-up textures with editorial annotations and palette strips. Perfect for material studies.',
    pages: [
      coverPage({ title: 'Material narrative.',
        eyebrow: 'STUDIO MOOD · MATERIAL STUDY', hero: PHOTOS.warm_interior,
        paletteKey: 'travertine', brandSign: 'CHAPTER 01 · EARTH TONES' }),
      conceptPage({ title: 'Material story.', eyebrow: 'INTRODUCTION',
        body: 'A tactile vocabulary of natural materials. Each surface earns its place by behaviour — patina, tactility, longevity.',
        attribution: '— Material direction',
        photo: PHOTOS.texture_stone, paletteKey: 'travertine' }),
      materialsPage({ title: 'Stone.', eyebrow: 'CHAPTER 01 · STONE',
        intro: 'Travertine, basalt and limestone — each tells a different story of compressed time.',
        items: [
          { name: 'Travertino', sub: 'Honed · 20mm', src: PHOTOS.texture_stone },
          { name: 'Basalto', sub: 'Split face', src: PHOTOS.texture_concrete },
          { name: 'Calacatta', sub: 'Bookmatched', src: PHOTOS.marble_corridor },
        ], paletteKey: 'travertine' }),
      materialsPage({ title: 'Wood & textile.', eyebrow: 'CHAPTER 02 · ORGANIC',
        intro: 'Solid woods and natural fibers. Warmth that softens the stone.',
        items: [
          { name: 'Walnut', sub: 'Oiled', src: PHOTOS.texture_wood },
          { name: 'Oak · whitewash', sub: 'Cabinetry', src: PHOTOS.texture_wood },
          { name: 'Belgian linen', sub: 'Natural', src: PHOTOS.texture_linen },
          { name: 'Wool bouclé', sub: 'Chalk', src: PHOTOS.texture_linen },
          { name: 'Velvet', sub: 'Forest', src: PHOTOS.texture_velvet },
          { name: 'Terracotta', sub: 'Hand-pressed', src: PHOTOS.texture_terracotta },
        ], paletteKey: 'stone_cedar' }),
      moodPage({ title: 'Application ideas.', eyebrow: 'CHAPTER 03 · APPLIED',
        photos: [PHOTOS.warm_interior, PHOTOS.marble_corridor, PHOTOS.bedroom_calm, PHOTOS.warm_lounge],
        copy: 'Materials in context — how the palette breathes once installed.',
        paletteKey: 'travertine' }),
      approvalPage({ title: 'Final direction.', eyebrow: 'CLOSING',
        copy: 'A palette grounded in earth — quiet, durable, residential in feel.',
        paletteKey: 'travertine', brand: 'STUDIO MOOD · MATERIAL DIRECTION · 2026' }),
    ],
  },

  // 3. JAPANDI EDITORIAL — 6 pages
  japandi_editorial: {
    id: 'japandi_editorial', name: 'Japandi Editorial',
    category: 'minimal',
    description: 'Asymmetrical whitespace, stone tones, minimal typography. For serene residential spaces.',
    pages: [
      coverPage({ title: 'Less,\nbut better.',
        eyebrow: '01 / STILLNESS', hero: PHOTOS.zen_room,
        paletteKey: 'stone_cedar', brandSign: 'A STUDY IN STILLNESS' }),
      conceptPage({ title: 'Stillness concept.', eyebrow: 'CHAPTER 01',
        body: 'A residence where space speaks louder than ornament. Soft stone, raw oak, paper, and shadow.',
        attribution: '— Design philosophy',
        photo: PHOTOS.white_armchair, paletteKey: 'stone_cedar' }),
      materialsPage({ title: 'Palette & material.', eyebrow: 'CHAPTER 02',
        intro: 'Stone, cedar, paper, ash — the discipline of restraint.',
        items: [
          { name: 'Travertine · honed', sub: '20mm', src: PHOTOS.texture_stone },
          { name: 'Oak · raw', sub: 'Solid · oiled', src: PHOTOS.texture_wood },
          { name: 'Washi paper', sub: 'Screens', src: PHOTOS.texture_linen },
          { name: 'Tatami', sub: '90×180', src: PHOTOS.zen_room },
          { name: 'Ceramic · matte', sub: 'Hand-thrown', src: PHOTOS.texture_terracotta },
          { name: 'Ash · charred', sub: 'Shou Sugi Ban', src: PHOTOS.texture_wood },
        ], paletteKey: 'stone_cedar' }),
      moodPage({ title: 'Spatial mood.', eyebrow: 'CHAPTER 03 · SPACE',
        photos: [PHOTOS.zen_room, PHOTOS.paper_decor, PHOTOS.white_armchair, PHOTOS.bedroom_calm],
        copy: 'Komorebi — the play of sunlight through leaves filtered onto interior surfaces.',
        paletteKey: 'stone_cedar' }),
      quotePage({ quote: '"In the space between things,\nthe quiet lives."',
        attribution: '— Japanese aesthetic principle',
        photo: PHOTOS.zen_room, paletteKey: 'stone_cedar', eyebrow: 'A WORD ON DIRECTION' }),
      approvalPage({ title: 'Closing direction.', eyebrow: 'CLOSING',
        copy: 'A home reduced to its essentials — calm, durable, contemplative.',
        paletteKey: 'stone_cedar', brand: 'STUDIO MOOD · JAPANDI · 2026' }),
    ],
  },

  // 4. FASHION / ART DIRECTION — 6 pages
  fashion_editorial: {
    id: 'fashion_editorial', name: 'Fashion · Art Direction',
    category: 'fashion',
    description: 'Oversized typography, layered imagery, experimental composition. Bold creative concepts.',
    pages: [
      coverPage({ title: 'Issue 04.',
        eyebrow: 'CINEMATIC NEUTRALS · SS26', hero: PHOTOS.cinematic_chair,
        paletteKey: 'monochrome', brandSign: 'FOR THE PROJECT.' }),
      conceptPage({ title: 'Visual statement.', eyebrow: 'CHAPTER 01',
        body: 'A study in restraint — the colors of dusk, the textures of memory. A wardrobe for the rooms we love.',
        attribution: '— Creative direction',
        photo: PHOTOS.draped_fabric, paletteKey: 'monochrome' }),
      moodPage({ title: 'Color language.', eyebrow: 'CHAPTER 02 · COLOR',
        photos: [PHOTOS.draped_fabric, PHOTOS.cinematic_chair, PHOTOS.warm_interior, PHOTOS.paper_decor],
        copy: 'Sepia, dust, ash — the colors of remembered light.',
        paletteKey: 'monochrome' }),
      materialsPage({ title: 'Texture direction.', eyebrow: 'CHAPTER 03 · TEXTURE',
        intro: 'Touch as story — silk, velvet, draped wool, raw plaster.',
        items: [
          { name: 'Silk · raw', sub: 'Habotai', src: PHOTOS.draped_fabric },
          { name: 'Velvet · midnight', sub: 'Italian', src: PHOTOS.texture_velvet },
          { name: 'Wool · drape', sub: 'Hand-finished', src: PHOTOS.texture_linen },
          { name: 'Plaster · raw', sub: 'Marmorino', src: PHOTOS.texture_concrete },
          { name: 'Leather · patina', sub: 'Aged', src: PHOTOS.texture_wood },
          { name: 'Linen · oversized', sub: 'Belgian', src: PHOTOS.texture_linen },
        ], paletteKey: 'monochrome' }),
      galleryPage({ title: 'Objects & art.', eyebrow: 'CHAPTER 04 · OBJECTS',
        photos: [PHOTOS.cinematic_chair, PHOTOS.paper_decor, PHOTOS.warm_interior, PHOTOS.draped_fabric],
        copy: 'Each object earns its place.' }),
      approvalPage({ title: 'Closing.', eyebrow: 'CLOSING',
        copy: 'Spring/Summer 26 — for the project.',
        paletteKey: 'monochrome', brand: 'CREATIVE DIRECTION · STUDIO MOOD · 2026' }),
    ],
  },

  // 5. RESIDENTIAL MOODBOARD — 7 pages
  residential_moodboard: {
    id: 'residential_moodboard', name: 'Residential Moodboard',
    category: 'residential',
    description: 'AD Magazine feeling. Furniture, materials, palette and mood, composed editorially.',
    pages: [
      coverPage({ title: 'Casa Brera.',
        eyebrow: 'LIVING ROOM · CONCEPT BOARD', hero: PHOTOS.warm_lounge,
        paletteKey: 'warm_earth', brandSign: 'BRERA, MILANO · 2026' }),
      conceptPage({ title: 'Living concept.', eyebrow: 'CHAPTER 01',
        body: '"The home should be the treasure chest of living." A residence where every object has a memory.',
        attribution: '— Le Corbusier',
        photo: PHOTOS.warm_interior, paletteKey: 'warm_earth' }),
      moodPage({ title: 'Living mood.', eyebrow: 'CHAPTER 02 · LIVING',
        photos: [PHOTOS.warm_lounge, PHOTOS.paper_decor, PHOTOS.cinematic_chair, PHOTOS.living_window],
        copy: 'Warm hours, soft shadows, generous seating.',
        paletteKey: 'warm_earth' }),
      moodPage({ title: 'Kitchen & bath.', eyebrow: 'CHAPTER 03 · UTILITY',
        photos: [PHOTOS.scandi_kitchen, PHOTOS.bedroom_calm, PHOTOS.dining_terrace, PHOTOS.marble_corridor],
        copy: 'Beauty in the daily ritual.',
        paletteKey: 'travertine' }),
      materialsPage({ title: 'Materials.', eyebrow: 'CHAPTER 04 · PALETTE',
        intro: 'Travertine, oak, brass — earth, warmth, glow.',
        items: [
          { name: 'Travertine', sub: 'Flooring', src: PHOTOS.texture_stone },
          { name: 'Oak natural', sub: 'Millwork', src: PHOTOS.texture_wood },
          { name: 'Brass', sub: 'Hardware', src: PHOTOS.texture_linen },
        ], paletteKey: 'warm_earth' }),
      furniturePage({ title: 'Furniture.', eyebrow: 'CHAPTER 05',
        intro: 'Selected for proportion, posture, conversation.',
        items: [
          { name: 'Sofa · Mario Bellini', sub: 'Bouclé chalk', src: PHOTOS.warm_lounge },
          { name: 'Lounge chair', sub: 'Walnut · leather', src: PHOTOS.cinematic_chair },
          { name: 'Side table', sub: 'Travertine', src: PHOTOS.paper_decor },
        ], paletteKey: 'warm_earth' }),
      approvalPage({ title: 'Final direction.', eyebrow: 'CLOSING',
        copy: 'Brera, Milano · 2026 · Studio MOOD.',
        paletteKey: 'warm_earth', brand: 'STUDIO MOOD · BRERA · 2026' }),
    ],
  },

  // 6. STONE ATELIER — 6 pages
  stone_atelier: {
    id: 'stone_atelier', name: 'Stone Atelier',
    category: 'materials',
    description: 'Salvatori-grade marble storytelling. Full-bleed stone imagery with tactile close-ups and elegant annotations.',
    pages: [
      coverPage({ title: 'Calacatta Vagli.',
        eyebrow: 'MATERIAL FOCUS · ATELIER N° 14', hero: PHOTOS.marble_corridor,
        paletteKey: 'travertine', brandSign: 'COMPOSITION N° 014' }),
      conceptPage({ title: 'A field of veins.', eyebrow: 'INTRODUCTION',
        body: 'A pure white field traced by sand-coloured veins. Quarried in the Apuan Alps; one slab unique to your project.',
        attribution: '— Stone atelier notes',
        photo: PHOTOS.texture_stone, paletteKey: 'travertine' }),
      materialsPage({ title: 'Stone direction.', eyebrow: 'CHAPTER 01',
        intro: 'Each slab is selected by hand for tone, vein and grain.',
        items: [
          { name: 'Calacatta', sub: 'Honed · 20mm', src: PHOTOS.texture_stone },
          { name: 'Travertino', sub: 'Vein-cut', src: PHOTOS.marble_corridor },
          { name: 'Basalto', sub: 'Split face', src: PHOTOS.texture_concrete },
          { name: 'Walnut', sub: 'Counterpoint', src: PHOTOS.texture_wood },
          { name: 'Hemp linen', sub: 'Soft brake', src: PHOTOS.texture_linen },
          { name: 'Plaster · lime', sub: 'Wall finish', src: PHOTOS.texture_concrete },
        ], paletteKey: 'travertine' }),
      galleryPage({ title: 'Tactile close-ups.', eyebrow: 'CHAPTER 02 · DETAIL',
        photos: [PHOTOS.texture_stone, PHOTOS.texture_wood, PHOTOS.texture_linen, PHOTOS.marble_corridor],
        copy: 'The hand reads what the eye misses.' }),
      moodPage({ title: 'Application.', eyebrow: 'CHAPTER 03 · APPLIED',
        photos: [PHOTOS.marble_corridor, PHOTOS.warm_interior, PHOTOS.bedroom_calm, PHOTOS.dining_terrace],
        copy: 'Stone in context — flooring, cladding, sculptural mass.',
        paletteKey: 'travertine' }),
      approvalPage({ title: 'Final selection.', eyebrow: 'CLOSING',
        copy: 'Stone Atelier · Composition N° 014.',
        paletteKey: 'travertine', brand: 'STONE ATELIER · 2026' }),
    ],
  },

  // 7. BOUTIQUE HOTEL — 6 pages
  boutique_hotel: {
    id: 'boutique_hotel', name: 'Boutique Hotel',
    category: 'hospitality',
    description: 'Aman-grade cinematic hospitality pitch. Warm interiors, soft shadows, premium serif typography.',
    pages: [
      coverPage({ title: 'A retreat\nfor the senses.',
        eyebrow: 'ROSEWOOD GROUP · CONCEPT 02', hero: PHOTOS.warm_lounge,
        paletteKey: 'warm_earth', brandSign: 'LAKE COMO · SEASON 26' }),
      quotePage({ quote: '"The luxury our guests remember is not what they saw,\nbut how they felt at home in a place they had never been."',
        attribution: '— Studio MOOD, Direction notes',
        photo: PHOTOS.warm_interior, paletteKey: 'warm_earth' }),
      moodPage({ title: 'Atmosphere study.', eyebrow: 'CHAPTER 02',
        photos: [PHOTOS.cinematic_chair, PHOTOS.paper_decor, PHOTOS.white_armchair, PHOTOS.warm_lounge],
        copy: 'Indirect light, soft textures, the silence of a private moment.',
        paletteKey: 'warm_earth' }),
      materialsPage({ title: 'Material direction.', eyebrow: 'CHAPTER 03',
        intro: 'Residential warmth at hospitality durability.',
        items: [
          { name: 'Travertino', sub: 'Floors', src: PHOTOS.texture_stone },
          { name: 'Oak · raw', sub: 'Joinery', src: PHOTOS.texture_wood },
          { name: 'Brushed brass', sub: 'Fittings', src: PHOTOS.texture_linen },
          { name: 'Wool bouclé', sub: 'Upholstery', src: PHOTOS.texture_velvet },
        ], paletteKey: 'warm_earth' }),
      galleryPage({ title: 'Guest experience.', eyebrow: 'CHAPTER 04',
        photos: [PHOTOS.bedroom_calm, PHOTOS.dining_terrace, PHOTOS.living_window, PHOTOS.warm_interior],
        copy: 'From arrival to retreat — every threshold considered.' }),
      approvalPage({ title: 'For your approval.', eyebrow: 'CLOSING',
        copy: 'Lake Como · Italia · Season 26.',
        paletteKey: 'warm_earth', brand: 'STUDIO MOOD · BOUTIQUE HOTEL · 2026' }),
    ],
  },

  // 8. FASHION RESIDENTIAL — 6 pages
  fashion_residential: {
    id: 'fashion_residential', name: 'Fashion Residential',
    category: 'fashion',
    description: 'Vogue Living × The Row. Oversized typography, brutal crops, muted monochrome — a creative director\'s moodboard.',
    pages: [
      coverPage({ title: 'The Room.',
        eyebrow: 'ATELIER 01 · F/W 26', hero: PHOTOS.white_armchair,
        paletteKey: 'monochrome', brandSign: 'A RESIDENCE AS A WARDROBE' }),
      conceptPage({ title: 'Visual statement.', eyebrow: 'MANIFESTO',
        body: 'We dress our walls the way we dress ourselves — with intention, restraint, and the textures of a life examined.',
        attribution: '— Creative direction',
        photo: PHOTOS.cinematic_chair, paletteKey: 'monochrome' }),
      moodPage({ title: 'Color language.', eyebrow: 'CHAPTER 02',
        photos: [PHOTOS.white_armchair, PHOTOS.draped_fabric, PHOTOS.warm_interior, PHOTOS.cinematic_chair],
        copy: 'Bone, dust, ink, smoke — a muted monochrome.',
        paletteKey: 'monochrome' }),
      materialsPage({ title: 'Texture direction.', eyebrow: 'CHAPTER 03',
        intro: 'Drape and grain — the eye becomes the hand.',
        items: [
          { name: 'Cashmere · raw', sub: 'Drape', src: PHOTOS.draped_fabric },
          { name: 'Leather · patina', sub: 'Aged', src: PHOTOS.texture_wood },
          { name: 'Linen · oversized', sub: 'Belgian', src: PHOTOS.texture_linen },
          { name: 'Plaster · raw', sub: 'Wall', src: PHOTOS.texture_concrete },
          { name: 'Velvet · midnight', sub: 'Italian', src: PHOTOS.texture_velvet },
          { name: 'Oak · charred', sub: 'Floor', src: PHOTOS.texture_wood },
        ], paletteKey: 'monochrome' }),
      galleryPage({ title: 'Objects.', eyebrow: 'CHAPTER 04 · OBJECTS',
        photos: [PHOTOS.cinematic_chair, PHOTOS.paper_decor, PHOTOS.white_armchair, PHOTOS.warm_interior],
        copy: 'Selected for posture, weight, intention.' }),
      approvalPage({ title: 'Closing.', eyebrow: 'CLOSING',
        copy: 'Issue 01 · F/W 26 · Palette Atelier.',
        paletteKey: 'monochrome', brand: 'CREATIVE DIRECTION · 2026' }),
    ],
  },

  // 9. LAKESIDE VILLA — 6 pages
  lakeside_villa: {
    id: 'lakeside_villa', name: 'Lakeside Villa',
    category: 'hospitality',
    description: 'Panoramic lake retreat. Soft greys, pale blue, water reflections — Aman Lake Como energy.',
    pages: [
      coverPage({ title: 'Where the lake\nbecomes the room.',
        eyebrow: 'AMAN VENICE · CONCEPT 03', hero: PHOTOS.lake_villa,
        paletteKey: 'lake_mist', brandSign: 'PANORAMIC SUITE · LAKE COMO' }),
      quotePage({ quote: '"The lake taught us to listen\nbefore we spoke."',
        attribution: '— Direction notes', photo: PHOTOS.lake_villa,
        paletteKey: 'lake_mist', eyebrow: 'OPENING' }),
      moodPage({ title: 'Atmosphere.', eyebrow: 'CHAPTER 02',
        photos: [PHOTOS.living_window, PHOTOS.dining_terrace, PHOTOS.bedroom_calm, PHOTOS.lake_villa],
        copy: 'Pale linen, smoked oak, water-honed travertine.',
        paletteKey: 'lake_mist' }),
      materialsPage({ title: 'Material direction.', eyebrow: 'CHAPTER 03',
        intro: 'Cool earth tones, water surfaces, soft greys.',
        items: [
          { name: 'Travertino · water-honed', sub: 'Pool decking', src: PHOTOS.texture_stone },
          { name: 'Smoked oak', sub: 'Boards', src: PHOTOS.texture_wood },
          { name: 'Linen · pale', sub: 'Drapes', src: PHOTOS.texture_linen },
          { name: 'Lime plaster', sub: 'Walls', src: PHOTOS.texture_concrete },
        ], paletteKey: 'lake_mist' }),
      galleryPage({ title: 'Panoramic suite.', eyebrow: 'CHAPTER 04',
        photos: [PHOTOS.lake_villa, PHOTOS.living_window, PHOTOS.bedroom_calm, PHOTOS.dining_terrace],
        copy: 'From terrace to lake — a continuum of stillness.' }),
      approvalPage({ title: 'For your approval.', eyebrow: 'CLOSING',
        copy: 'Lago di Como · Suite Panoramic · 2026.',
        paletteKey: 'lake_mist', brand: 'STUDIO MOOD · AMAN CONCEPT · 2026' }),
    ],
  },

  // 10. MINERAL STUDY — 6 pages
  mineral_study: {
    id: 'mineral_study', name: 'Mineral Study',
    category: 'materials',
    description: 'Concrete, mineral and raw earth tones. Brutalist serenity for contemporary architectural projects.',
    pages: [
      coverPage({ title: 'Mineral.',
        eyebrow: 'STUDIO MOOD · COMPRESSED TIME', hero: PHOTOS.texture_concrete,
        paletteKey: 'mineral', brandSign: 'A STUDY IN WEATHER' }),
      conceptPage({ title: 'Compressed time.', eyebrow: 'INTRODUCTION',
        body: 'Concrete, basalt, and the patina of weather. Materials that carry their own history into the room.',
        attribution: '— Material direction',
        photo: PHOTOS.texture_concrete, paletteKey: 'mineral' }),
      materialsPage({ title: 'Mineral palette.', eyebrow: 'CHAPTER 01',
        intro: 'Surfaces shaped by pressure, time and fire.',
        items: [
          { name: 'Concrete · sandblast', sub: 'Cast · 80mm', src: PHOTOS.texture_concrete },
          { name: 'Basalt · split face', sub: 'Slabs', src: PHOTOS.texture_stone },
          { name: 'Terracotta · raw', sub: 'Matte', src: PHOTOS.texture_terracotta },
          { name: 'Travertine · honed', sub: 'Floor', src: PHOTOS.marble_corridor },
          { name: 'Walnut · charred', sub: 'Accent', src: PHOTOS.texture_wood },
          { name: 'Lime plaster', sub: 'Wall', src: PHOTOS.texture_concrete },
        ], paletteKey: 'mineral' }),
      galleryPage({ title: 'Surface studies.', eyebrow: 'CHAPTER 02 · TEXTURE',
        photos: [PHOTOS.texture_concrete, PHOTOS.texture_stone, PHOTOS.marble_corridor, PHOTOS.texture_terracotta],
        copy: 'Close — where the material reveals its memory.' }),
      moodPage({ title: 'Applied.', eyebrow: 'CHAPTER 03',
        photos: [PHOTOS.marble_corridor, PHOTOS.warm_interior, PHOTOS.dining_terrace, PHOTOS.bedroom_calm],
        copy: 'Mineral surfaces in context — quiet, durable, architectural.',
        paletteKey: 'mineral' }),
      approvalPage({ title: 'Closing.', eyebrow: 'CLOSING',
        copy: 'A weathered mineral language — for the long term.',
        paletteKey: 'mineral', brand: 'STUDIO MOOD · MINERAL STUDY · 2026' }),
    ],
  },

  // 11. BRERA APARTMENT — 7 pages
  brera_apartment: {
    id: 'brera_apartment', name: 'Brera Apartment',
    category: 'residential',
    description: 'Milan editorial — historic Brera apartment, terrazzo & velvet, soft jewel tones, AD Italia rhythm.',
    pages: [
      coverPage({ title: 'Brera apartment.',
        eyebrow: 'AD ITALIA · OCTOBER 26', hero: PHOTOS.warm_interior,
        paletteKey: 'brera_velvet', brandSign: 'MILANO · 2026' }),
      conceptPage({ title: 'A historic residence reimagined.', eyebrow: 'CHAPTER 01',
        body: '"Una casa deve essere una stanza dell\'anima." A historic apartment, reimagined for one collector — generous, layered, deeply lived-in.',
        attribution: '— Gio Ponti',
        photo: PHOTOS.warm_lounge, paletteKey: 'brera_velvet' }),
      moodPage({ title: 'Living mood.', eyebrow: 'CHAPTER 02 · LIVING',
        photos: [PHOTOS.warm_lounge, PHOTOS.living_window, PHOTOS.cinematic_chair, PHOTOS.paper_decor],
        copy: 'Library hours, velvet, vermouth, fresco.',
        paletteKey: 'brera_velvet' }),
      moodPage({ title: 'Bedroom & bath.', eyebrow: 'CHAPTER 03 · PRIVATE',
        photos: [PHOTOS.bedroom_calm, PHOTOS.marble_corridor, PHOTOS.warm_interior, PHOTOS.dining_terrace],
        copy: 'The most private rooms carry the deepest color.',
        paletteKey: 'brera_velvet' }),
      materialsPage({ title: 'Material story.', eyebrow: 'CHAPTER 04',
        intro: 'Velvet, terrazzo, walnut, brass — a jewel-tone vocabulary.',
        items: [
          { name: 'Velvet · forest', sub: 'Italian woven', src: PHOTOS.texture_velvet },
          { name: 'Terrazzo · cinnamon', sub: 'Cast · 25mm', src: PHOTOS.texture_terracotta },
          { name: 'Walnut · oiled', sub: 'Italian', src: PHOTOS.texture_wood },
          { name: 'Brass · brushed', sub: 'Hardware', src: PHOTOS.texture_linen },
          { name: 'Linen · oat', sub: 'Drapes', src: PHOTOS.texture_linen },
          { name: 'Marble · cipollino', sub: 'Bath', src: PHOTOS.marble_corridor },
        ], paletteKey: 'brera_velvet' }),
      furniturePage({ title: 'Furniture selection.', eyebrow: 'CHAPTER 05',
        intro: 'Italian midcentury · vintage and reproduction.',
        items: [
          { name: 'Sofa · Mangiarotti', sub: 'Velvet · oxblood', src: PHOTOS.warm_lounge },
          { name: 'Chair · Gio Ponti', sub: 'Walnut', src: PHOTOS.cinematic_chair },
          { name: 'Side table · marble', sub: 'Cipollino', src: PHOTOS.paper_decor },
        ], paletteKey: 'brera_velvet' }),
      approvalPage({ title: 'Final direction.', eyebrow: 'CLOSING',
        copy: 'Studio MOOD · Milano · Brera, 2026.',
        paletteKey: 'brera_velvet', brand: 'STUDIO MOOD · BRERA · 2026' }),
    ],
  },

  // 12. COASTAL RETREAT — 6 pages
  coastal_retreat: {
    id: 'coastal_retreat', name: 'Coastal Retreat',
    category: 'residential',
    description: 'Mediterranean residential — bleached oak, pale linen, sea-glass blues, gallery-hung art.',
    pages: [
      coverPage({ title: 'Bleached.\nSlow. Bright.',
        eyebrow: 'PORTO CERVO · MASTER SUITE', hero: PHOTOS.bedroom_calm,
        paletteKey: 'coast_chalk', brandSign: 'COSTA SMERALDA · 2026' }),
      conceptPage({ title: 'Sun-bleached essentials.', eyebrow: 'CHAPTER 01',
        body: 'A residence reduced to its sun-bleached essentials. Salt, paper, water, oak.',
        attribution: '— Coastal residence notes',
        photo: PHOTOS.living_window, paletteKey: 'coast_chalk' }),
      moodPage({ title: 'Living mood.', eyebrow: 'CHAPTER 02',
        photos: [PHOTOS.living_window, PHOTOS.dining_terrace, PHOTOS.bedroom_calm, PHOTOS.lake_villa],
        copy: 'Mid-morning, salt air, slow voices.',
        paletteKey: 'coast_chalk' }),
      materialsPage({ title: 'Materials.', eyebrow: 'CHAPTER 03',
        intro: 'Pale woods, sea-glass blues, raw linen.',
        items: [
          { name: 'Oak · bleached', sub: 'Floors', src: PHOTOS.texture_wood },
          { name: 'Linen · oat', sub: 'Drapes', src: PHOTOS.texture_linen },
          { name: 'Travertine · chalk', sub: 'Walls', src: PHOTOS.texture_stone },
          { name: 'Rattan · natural', sub: 'Lampshades', src: PHOTOS.texture_wood },
        ], paletteKey: 'coast_chalk' }),
      furniturePage({ title: 'Furniture.', eyebrow: 'CHAPTER 04',
        intro: 'Bleached and slow — proportions you want to lean into.',
        items: [
          { name: 'Sofa · bouclé chalk', sub: 'Custom', src: PHOTOS.warm_lounge },
          { name: 'Rattan chair', sub: 'Vintage', src: PHOTOS.cinematic_chair },
          { name: 'Stone table', sub: 'Travertine', src: PHOTOS.paper_decor },
        ], paletteKey: 'coast_chalk' }),
      approvalPage({ title: 'For your approval.', eyebrow: 'CLOSING',
        copy: 'Costa Smeralda · 2026 · Studio MOOD.',
        paletteKey: 'coast_chalk', brand: 'STUDIO MOOD · COASTAL · 2026' }),
    ],
  },

  // 13. SCANDINAVIAN NORDIC — 6 pages
  scandi_nordic: {
    id: 'scandi_nordic', name: 'Scandinavian Nordic',
    category: 'minimal',
    description: 'Nordic minimal — pale woods, soft whites, sculptural simplicity. Vipp × Frama × Menu energy.',
    pages: [
      coverPage({ title: 'Nordic.',
        eyebrow: '02 / LIGHT · STUDIO MOOD', hero: PHOTOS.scandi_kitchen,
        paletteKey: 'nordic_birch', brandSign: 'A RESIDENCE SHAPED BY CLARITY' }),
      conceptPage({ title: 'Stillness concept.', eyebrow: 'CHAPTER 01',
        body: 'A residence shaped by clarity, restraint, and the long Northern light. Calm as a discipline.',
        attribution: '— Nordic direction',
        photo: PHOTOS.scandi_chair, paletteKey: 'nordic_birch' }),
      materialsPage({ title: 'Palette.', eyebrow: 'CHAPTER 02',
        intro: 'Birch, fog, wool — the colors of slow morning.',
        items: [
          { name: 'Birch · whitewash', sub: 'Cabinetry', src: PHOTOS.texture_wood },
          { name: 'Wool bouclé · chalk', sub: 'Upholstery', src: PHOTOS.texture_linen },
          { name: 'Limestone · honed', sub: 'Flooring', src: PHOTOS.texture_stone },
          { name: 'Linen · pale', sub: 'Drapes', src: PHOTOS.texture_linen },
          { name: 'Brass · matte', sub: 'Hardware', src: PHOTOS.texture_linen },
          { name: 'Ceramic · matte', sub: 'Objects', src: PHOTOS.wabi_vase },
        ], paletteKey: 'nordic_birch' }),
      moodPage({ title: 'Spatial mood.', eyebrow: 'CHAPTER 03',
        photos: [PHOTOS.scandi_kitchen, PHOTOS.scandi_chair, PHOTOS.bedroom_calm, PHOTOS.living_window],
        copy: 'Hyggelig — light, soft surfaces, voices held low.',
        paletteKey: 'nordic_birch' }),
      furniturePage({ title: 'Furniture.', eyebrow: 'CHAPTER 04',
        intro: 'Nordic icons — sculptural, restrained, generationally repairable.',
        items: [
          { name: 'Chair · J39 Mogensen', sub: 'Oak · paper cord', src: PHOTOS.scandi_chair },
          { name: 'Sofa · Vipp 632', sub: 'Wool chalk', src: PHOTOS.warm_lounge },
          { name: 'Table · Menu Tearoom', sub: 'Travertine', src: PHOTOS.paper_decor },
        ], paletteKey: 'nordic_birch' }),
      approvalPage({ title: 'Closing.', eyebrow: 'CLOSING',
        copy: 'Studio MOOD · Nordic concept · 2026.',
        paletteKey: 'nordic_birch', brand: 'STUDIO MOOD · NORDIC · 2026' }),
    ],
  },

  // 14. WABI-SABI — 6 pages
  wabi_sabi: {
    id: 'wabi_sabi', name: 'Wabi-Sabi',
    category: 'minimal',
    description: 'Japanese wabi-sabi — patina, imperfection, dark plaster, hand-thrown ceramics, kintsugi attention.',
    pages: [
      coverPage({ title: 'Wabi.',
        eyebrow: '03 / IMPERFECTION', hero: PHOTOS.zen_room,
        paletteKey: 'wabi_patina', brandSign: '侘寂 · ATELIER DWELLING' }),
      quotePage({ quote: '"There is a crack in everything.\nThat\'s how the light gets in."',
        attribution: '— Leonard Cohen',
        photo: PHOTOS.wabi_vase, paletteKey: 'wabi_patina', eyebrow: 'OPENING' }),
      conceptPage({ title: 'The beauty of incomplete.', eyebrow: 'CHAPTER 01',
        body: '侘寂 — the beauty of the imperfect, the impermanent, the incomplete. A residence built from the texture of years.',
        attribution: '— Japanese aesthetic principle',
        photo: PHOTOS.zen_room, paletteKey: 'wabi_patina' }),
      materialsPage({ title: 'Patina materials.', eyebrow: 'CHAPTER 02',
        intro: 'Hand-thrown, oxidized, weathered — surfaces with biography.',
        items: [
          { name: 'Dark plaster', sub: 'Tadelakt · matte', src: PHOTOS.texture_concrete },
          { name: 'Ash · charred', sub: 'Shou Sugi Ban', src: PHOTOS.texture_wood },
          { name: 'Ceramic · hand-thrown', sub: 'Matte black', src: PHOTOS.wabi_vase },
          { name: 'Wool · undyed', sub: 'Natural', src: PHOTOS.texture_linen },
          { name: 'Bronze · patinated', sub: 'Hardware', src: PHOTOS.texture_velvet },
          { name: 'Terracotta · raw', sub: 'Floor tile', src: PHOTOS.texture_terracotta },
        ], paletteKey: 'wabi_patina' }),
      galleryPage({ title: 'Tatami & object.', eyebrow: 'CHAPTER 03 · DETAIL',
        photos: [PHOTOS.zen_room, PHOTOS.wabi_vase, PHOTOS.texture_terracotta, PHOTOS.paper_decor],
        copy: 'Each object has been chosen for the trace it carries.' }),
      approvalPage({ title: 'Closing.', eyebrow: 'CLOSING',
        copy: 'Earth & patina · Studio MOOD · 2026.',
        paletteKey: 'wabi_patina', brand: 'STUDIO MOOD · WABI · 2026' }),
    ],
  },

  // 15. EDITORIAL MAGAZINE — 6 pages
  editorial_magazine: {
    id: 'editorial_magazine', name: 'Editorial Magazine',
    category: 'fashion',
    description: 'AD × Vogue cover energy. Oversized masthead, layered photography, magazine-grade typography.',
    pages: [
      coverPage({ title: 'MOOD.',
        eyebrow: 'ISSUE 02 · SS26 · THE LANGUAGE OF INTERIORS', hero: PHOTOS.draped_fabric,
        paletteKey: 'monochrome', brandSign: '12 RESIDENCES · 24 MATERIALS · 1 MANIFESTO' }),
      conceptPage({ title: 'The language of interiors.', eyebrow: 'EDITOR\'S NOTE',
        body: 'Twelve residences. Twenty-four materials. One manifesto — that a room is not a container, but a sentence.',
        attribution: '— Editor in chief',
        photo: PHOTOS.cinematic_chair, paletteKey: 'monochrome' }),
      moodPage({ title: 'Color study.', eyebrow: 'CHAPTER 02',
        photos: [PHOTOS.warm_interior, PHOTOS.draped_fabric, PHOTOS.cinematic_chair, PHOTOS.paper_decor],
        copy: 'A monochrome reading — bone, dust, ink, smoke.',
        paletteKey: 'monochrome' }),
      galleryPage({ title: 'Residences.', eyebrow: 'CHAPTER 03 · FEATURE',
        photos: [PHOTOS.warm_lounge, PHOTOS.bedroom_calm, PHOTOS.living_window, PHOTOS.scandi_kitchen],
        copy: 'Twelve interiors — twelve manifestos.' }),
      materialsPage({ title: 'Materials index.', eyebrow: 'CHAPTER 04',
        intro: 'Twenty-four materials selected for the issue.',
        items: [
          { name: 'Travertino', sub: 'Apuan', src: PHOTOS.texture_stone },
          { name: 'Walnut · oiled', sub: 'Italian', src: PHOTOS.texture_wood },
          { name: 'Linen · raw', sub: 'Belgian', src: PHOTOS.texture_linen },
          { name: 'Velvet · midnight', sub: 'Italian', src: PHOTOS.texture_velvet },
          { name: 'Terracotta', sub: 'Hand-pressed', src: PHOTOS.texture_terracotta },
          { name: 'Lime plaster', sub: 'Marmorino', src: PHOTOS.texture_concrete },
        ], paletteKey: 'monochrome' }),
      approvalPage({ title: 'Subscribe.', eyebrow: 'CLOSING',
        copy: 'MOOD Magazine · Issue 02 · Spring/Summer 2026.',
        paletteKey: 'monochrome', brand: 'STUDIO MOOD · MILANO · 2026' }),
    ],
  },
};

// ── Public API ────────────────────────────────────────────────────────────
export const PREMIUM_TEMPLATE_IDS = Object.keys(TEMPLATES);

export const getPremiumTemplate = (id) => TEMPLATES[id] || null;

/** Number of pages a premium template will create when applied. */
export const getPremiumTemplatePageCount = (id) => {
  const t = TEMPLATES[id];
  if (!t) return 0;
  return Array.isArray(t.pages) ? t.pages.length : 1;
};

/**
 * Premium template categories (locked order = editorial reading rhythm).
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
 * Apply a premium template to a moodboard — MULTI-PAGE.
 *
 * Creates ALL pages in `template.pages` sequentially and inserts each page's
 * blocks via the existing endpoints. No backend changes required. Returns a
 * detailed breakdown so the caller can surface a precise toast.
 *
 * Backward compatible: legacy single-page templates (no `pages` array) are
 * applied as a single page using the previous `blocks` field.
 */
export async function applyPremiumTemplate(api, moodboardId, templateId) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown premium template: ${templateId}`);

  // Normalize to a `pages` array — legacy templates supported transparently.
  const pages = tpl.pages || [{
    title: tpl.page_title || tpl.name,
    page_type: tpl.page_type || 'cover',
    settings: { background_color: '#F0EDE5' },
    blocks: tpl.blocks || [],
  }];

  let firstPageId = null;
  const createdPageIds = [];
  let blocksCreated = 0;
  let blocksTotal = 0;

  for (const pg of pages) {
    blocksTotal += pg.blocks.length;
    let pageId = null;
    try {
      const pageRes = await api.post(`/api/moodboards/${moodboardId}/pages`, {
        title: pg.title,
        page_type: pg.page_type || 'blank',
        settings: pg.settings || { background_color: '#F0EDE5' },
      });
      pageId = pageRes.data?.id;
    } catch (_) { /* skip this page but keep going */ }
    if (!pageId) continue;
    if (!firstPageId) firstPageId = pageId;
    createdPageIds.push(pageId);

    // Blocks within a page can be sent in parallel — fast.
    const results = await Promise.allSettled(
      pg.blocks.map((b) => api.post(`/api/moodboards/${moodboardId}/blocks`,
        { ...b, page_id: pageId })),
    );
    blocksCreated += results.filter((r) => r.status === 'fulfilled').length;
  }

  return {
    pageId: firstPageId,
    pagesCreated: createdPageIds.length,
    pagesTotal: pages.length,
    blocksCreated,
    blocksTotal,
  };
}

export default TEMPLATES;
