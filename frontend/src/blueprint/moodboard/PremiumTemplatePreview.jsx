/**
 * PremiumTemplatePreview — one curated visual per premium template.
 *
 * Each preview is a static composition designed to communicate the template's
 * editorial DNA at a glance — typography rhythm, palette, image crops. They
 * are larger and more cinematic than the regular skeleton previews because
 * the user explicitly asked for "real finished moodboards" at the top of the
 * picker.
 *
 * NO backend dependencies. Photos use the same Unsplash pool as the
 * SkeletonPreview module (so they share the browser's HTTP cache).
 */
import React from 'react';

const P = {
  warm_interior:   'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=70',
  warm_lounge:     'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=600&q=70',
  cinematic_chair: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=70',
  paper_decor:     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=70',
  white_armchair:  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=70',
  lake_villa:      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=70',
  living_window:   'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=70',
  bedroom_calm:    'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=600&q=70',
  dining_terrace:  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=70',
  marble_corridor: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=600&q=70',
  texture_stone:   'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?auto=format&fit=crop&w=600&q=70',
  texture_wood:    'https://images.unsplash.com/photo-1535320903710-d993d3d77d29?auto=format&fit=crop&w=600&q=70',
  texture_linen:   'https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?auto=format&fit=crop&w=600&q=70',
  texture_concrete:'https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?auto=format&fit=crop&w=600&q=70',
  texture_velvet:  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=70',
  texture_terracotta:'https://images.unsplash.com/photo-1545048702-79362596cdc9?auto=format&fit=crop&w=600&q=70',
  draped_fabric:   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=70',
  zen_room:        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=70',
  scandi_kitchen:  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=600&q=70',
  scandi_chair:    'https://images.unsplash.com/photo-1532372320572-cda25653a26d?auto=format&fit=crop&w=600&q=70',
  wabi_vase:       'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=70',
};

const Photo = ({ src, className = '', style }) => (
  <div className={`relative overflow-hidden ${className}`}
       style={{ ...style, background: 'linear-gradient(135deg, #3A2C20 0%, #1F160F 100%)' }}>
    <img src={src} alt="" loading="lazy" decoding="async" draggable={false}
         onError={(e) => { e.currentTarget.style.display = 'none'; }}
         className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" />
  </div>
);

const Palette = ({ colors, className = '' }) => (
  <div className={`flex ${className}`}>
    {colors.map((c, i) => <span key={i} className="flex-1 h-full" style={{ background: c }} />)}
  </div>
);

// ── Luxury Hospitality — cinematic full-bleed hero + title overlay ─────────
const LuxuryHospitality = () => (
  <div className="absolute inset-0">
    <Photo src={P.warm_lounge} className="absolute inset-0" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/0" />
    <div className="absolute left-[6%] bottom-[12%] right-[6%] text-white">
      <p className="text-[6px] tracking-[0.4em] uppercase opacity-80 mb-1">Villa Como · Lago</p>
      <p className="font-serif text-[14px] leading-[1.05] mb-2">A timeless aesthetic for modern hospitality.</p>
      <Palette colors={['#1A1410', '#5C4434', '#A88562', '#C9AE8C', '#EBDDC2']}
               className="h-1.5 w-[60%] rounded-sm overflow-hidden" />
    </div>
  </div>
);

// ── Material Narrative — 4-grid materials + editorial title ─────────────────
const MaterialNarrative = () => (
  <div className="absolute inset-0 flex flex-col p-[6%] bg-[var(--bp-surface-1)]">
    <p className="text-[6px] tracking-[0.32em] uppercase text-[var(--bp-text-muted)] mb-1">Chapter 02</p>
    <p className="font-serif italic text-[12px] text-[var(--bp-text-primary)] mb-2 leading-tight">Material direction</p>
    <div className="flex-1 grid grid-cols-2 gap-1">
      <Photo src={P.cinematic_chair} className="rounded-[2px]" />
      <Photo src={P.paper_decor}     className="rounded-[2px]" />
      <Photo src={P.warm_lounge}     className="rounded-[2px]" />
      <Photo src={P.white_armchair}  className="rounded-[2px]" />
    </div>
    <Palette colors={['#2C2419', '#8F7758', '#D2BC9E', '#F0E5D0']}
             className="h-1.5 w-full rounded-sm overflow-hidden mt-2" />
  </div>
);

// ── Japandi Editorial — asymmetric whitespace + minimal type ────────────────
const JapandiEditorial = () => (
  <div className="absolute inset-0 flex flex-col p-[7%]"
       style={{ background: '#F0EDE5' }}>
    <p className="text-[6px] tracking-[0.32em] uppercase text-[#9B917F] mb-1">01 / Stillness</p>
    <p className="font-serif text-[16px] text-[#2A2620] mb-3 leading-[1]">Less,<br/>but better.</p>
    <div className="flex-1 flex gap-1.5">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex-1" />
        <Photo src={P.paper_decor} className="h-[40%] rounded-[2px]" />
      </div>
      <Photo src={P.white_armchair} className="w-[50%] rounded-[2px]" />
    </div>
    <Palette colors={['#F0EDE5', '#D7CFC0', '#9B917F', '#544A3D', '#1F1B16']}
             className="h-1 w-full rounded-sm overflow-hidden mt-2" />
  </div>
);

// ── Fashion / Art Direction — oversized type + layered imagery ─────────────
const FashionEditorial = () => (
  <div className="absolute inset-0 overflow-hidden bg-black">
    <Photo src={P.cinematic_chair} className="absolute inset-0 opacity-90" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/65" />
    <p className="absolute top-[5%] left-[6%] text-white text-[6px] tracking-[0.5em] uppercase opacity-80">
      Issue 04
    </p>
    <p className="absolute top-[15%] left-[6%] font-serif italic text-white text-[44px] leading-[0.85]
                  drop-shadow-2xl">
      04
    </p>
    <div className="absolute bottom-[12%] left-[6%] right-[6%] text-white">
      <p className="text-[5.5px] tracking-[0.45em] uppercase opacity-80 mb-1">Cinematic neutrals</p>
      <p className="font-serif italic text-[9px] leading-tight">For the rooms we love.</p>
    </div>
    <div className="absolute bottom-[28%] right-[6%] w-[36%] aspect-[4/3] overflow-hidden rounded-[2px] shadow-2xl">
      <Photo src={P.warm_interior} className="absolute inset-0" />
    </div>
  </div>
);

// ── Residential Moodboard — AD-magazine feel: hero + stack + materials row ─
const ResidentialMoodboard = () => (
  <div className="absolute inset-0 flex flex-col p-[5%] bg-[var(--bp-surface-1)]">
    <p className="font-serif text-[12px] text-[var(--bp-text-primary)] leading-tight">Casa Brera</p>
    <p className="text-[5.5px] tracking-[0.4em] uppercase text-[var(--bp-text-muted)] mb-2 mt-0.5">Living concept</p>
    <div className="flex-1 flex gap-1">
      <Photo src={P.warm_lounge} className="flex-1 rounded-[2px]" />
      <div className="w-[35%] flex flex-col gap-1">
        <Photo src={P.paper_decor}     className="flex-1 rounded-[2px]" />
        <Photo src={P.cinematic_chair} className="flex-1 rounded-[2px]" />
      </div>
    </div>
    <div className="mt-1.5 flex gap-1 h-[18%]">
      <Photo src={P.cinematic_chair} className="flex-1 rounded-[2px]" />
      <Photo src={P.paper_decor}     className="flex-1 rounded-[2px]" />
      <Photo src={P.white_armchair}  className="flex-1 rounded-[2px]" />
    </div>
    <Palette colors={['#1A1410', '#3A2A1E', '#8F7758', '#C9AE8C', '#EBDDC2']}
             className="h-1.5 w-full rounded-sm overflow-hidden mt-1.5" />
  </div>
);

// ── Stone Atelier — material storytelling (hero stone + 3 close-ups) ───────
const StoneAtelier = () => (
  <div className="absolute inset-0 flex flex-col bg-[var(--bp-surface-1)]">
    {/* hero stone with overlay caption */}
    <div className="relative flex-[1.4]">
      <Photo src={P.warm_interior} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/0" />
      <p className="absolute top-[7%] left-[5%] text-white text-[5.5px] tracking-[0.4em] uppercase opacity-90">Material focus</p>
      <p className="absolute top-[14%] left-[5%] right-[5%] font-serif text-white text-[14px] leading-none">Calacatta Vagli</p>
      <p className="absolute bottom-[6%] left-[5%] text-white/80 text-[5.5px] tracking-[0.3em] uppercase">Fig. 01 — Honed · 20mm</p>
    </div>
    {/* annotation strip */}
    <p className="px-[5%] py-1.5 font-serif italic text-[7.5px] text-[var(--bp-text-primary)] leading-tight">
      A pure white field traced by sand-coloured veins.
    </p>
    {/* 3 close-ups */}
    <div className="grid grid-cols-3 gap-1 px-[5%] flex-1">
      <Photo src={P.texture_stone || P.warm_interior} className="rounded-[2px]" />
      <Photo src={P.texture_wood  || P.cinematic_chair} className="rounded-[2px]" />
      <Photo src={P.texture_linen || P.white_armchair} className="rounded-[2px]" />
    </div>
    {/* palette */}
    <div className="px-[5%] pb-[5%] pt-2">
      <Palette colors={['#F5F0E6', '#D7CBB4', '#9E8A70', '#5C4A35', '#1F1610']}
               className="h-1.5 w-full rounded-sm overflow-hidden" />
      <p className="text-[5px] tracking-[0.4em] uppercase text-[var(--bp-text-muted)] mt-1.5">
        Stone Atelier · Composition N° 014
      </p>
    </div>
  </div>
);

// ── Boutique Hotel — cinematic hospitality (oversized hero + quote) ────────
const BoutiqueHotel = () => (
  <div className="absolute inset-0 flex flex-col">
    <div className="relative flex-[1.55]">
      <Photo src={P.warm_lounge} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/0 to-black/30" />
      <p className="absolute top-[8%] left-[5%] text-white text-[5.5px] tracking-[0.4em] uppercase opacity-90">Rosewood · Concept 02</p>
      <p className="absolute top-[14%] left-[5%] right-[5%] font-serif italic text-white text-[14px] leading-[0.95]">A retreat for the senses.</p>
    </div>
    <div className="flex-1 flex flex-col justify-center px-[5%] py-[4%]
                    bg-[var(--bp-surface-1)]">
      <p className="font-serif italic text-[8.5px] text-[var(--bp-text-primary)] leading-[1.35]">
        "The luxury our guests remember is not what they saw, but how they felt."
      </p>
      <p className="text-[5px] tracking-[0.4em] uppercase text-[var(--bp-text-muted)] mt-1.5">— Studio MOOD</p>
    </div>
    {/* atmosphere strip */}
    <div className="grid grid-cols-3 gap-1 px-[5%] h-[18%]">
      <Photo src={P.cinematic_chair} className="rounded-[2px]" />
      <Photo src={P.paper_decor}     className="rounded-[2px]" />
      <Photo src={P.white_armchair}  className="rounded-[2px]" />
    </div>
    <div className="px-[5%] py-2">
      <Palette colors={['#1A1410', '#3A2A1E', '#7A5530', '#A88562', '#EBDDC2']}
               className="h-1.5 w-full rounded-sm overflow-hidden" />
    </div>
  </div>
);

// ── Fashion Residential — couture-residential moodboard (giant type) ───────
const FashionResidential = () => (
  <div className="absolute inset-0 overflow-hidden"
       style={{ background: '#F8F4ED' }}>
    <Photo src={P.white_armchair} className="absolute inset-0 opacity-30" />
    {/* Brutal stacked title */}
    <p className="absolute top-[7%] left-[4%] font-serif text-[36px] leading-[0.85] text-[#1A1410]">THE</p>
    <p className="absolute top-[20%] left-[4%] font-serif italic text-[36px] leading-[0.85] text-[#1A1410]">ROOM</p>
    <p className="absolute top-[36%] left-[4%] font-serif italic text-[7.5px] text-[#3A2F26]">A residence as a wardrobe.</p>
    {/* Layered photo right */}
    <div className="absolute top-[44%] right-[4%] w-[42%] aspect-[3/4] overflow-hidden rounded-[2px] shadow-2xl">
      <Photo src={P.cinematic_chair} className="absolute inset-0" />
    </div>
    {/* Manifesto */}
    <p className="absolute top-[46%] left-[4%] right-[50%] text-[#1A1410] text-[5.5px] leading-[1.5] font-sans">
      We dress our walls the way we dress ourselves — with intention, restraint, and the textures of a life examined.
    </p>
    {/* Bottom palette + caption */}
    <div className="absolute bottom-[6%] left-[4%] right-[4%]">
      <Palette colors={['#F8F4ED', '#E6DBC6', '#A39078', '#4F4438', '#1A1410']}
               className="h-1.5 w-full rounded-sm overflow-hidden" />
      <div className="flex justify-between mt-1.5">
        <span className="text-[5px] tracking-[0.4em] uppercase text-[#5A4D3F]">Palette 01 · Atelier</span>
        <span className="text-[5px] tracking-[0.4em] uppercase text-[#5A4D3F]">Issue 01 · F/W 26</span>
      </div>
    </div>
  </div>
);

// ── Lakeside Villa — panoramic lake retreat (cool greys + pale blue) ───────
const LakesideVilla = () => (
  <div className="absolute inset-0 flex flex-col bg-[var(--bp-surface-1)]">
    <div className="relative flex-[1.65]">
      <Photo src={P.lake_villa} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/0 to-black/40" />
      <p className="absolute top-[7%] left-[5%] text-white text-[5.5px] tracking-[0.4em] uppercase opacity-90">Aman · Concept 03</p>
      <p className="absolute top-[14%] left-[5%] right-[5%] font-serif italic text-white text-[13px] leading-[0.95]">Where the lake<br/>becomes the room.</p>
      <p className="absolute bottom-[6%] left-[5%] text-white/85 text-[5px] tracking-[0.32em] uppercase">Panoramic suite</p>
    </div>
    <div className="px-[5%] py-2 flex-1 flex flex-col justify-center">
      <p className="font-serif italic text-[7px] text-[var(--bp-text-primary)] leading-[1.35]">Pale linen, smoked oak, water-honed travertine.</p>
    </div>
    <div className="grid grid-cols-2 gap-1 px-[5%] h-[18%]">
      <Photo src={P.living_window} className="rounded-[2px]" />
      <Photo src={P.dining_terrace} className="rounded-[2px]" />
    </div>
    <div className="px-[5%] py-2">
      <Palette colors={['#1F2A2D', '#445459', '#8BA0A6', '#C9D3D2', '#EFEAE0']}
               className="h-1.5 w-full rounded-sm overflow-hidden" />
    </div>
  </div>
);

// ── Mineral Study — brutalist material narrative ───────────────────────────
const MineralStudy = () => (
  <div className="absolute inset-0 flex flex-col p-[5%] bg-[var(--bp-surface-1)]">
    <p className="text-[5.5px] tracking-[0.4em] uppercase text-[var(--bp-text-muted)]">Studio MOOD</p>
    <p className="font-serif text-[14px] text-[var(--bp-text-primary)] leading-none mt-1">Mineral.</p>
    <p className="font-serif italic text-[6px] text-[var(--bp-text-muted)] mt-1 mb-2">A study in compressed time.</p>
    <div className="flex-1 flex gap-1">
      <Photo src={P.texture_concrete} className="flex-1 rounded-[2px]" />
      <div className="w-[45%] flex flex-col gap-1">
        <Photo src={P.texture_stone} className="flex-1 rounded-[2px]" />
        <Photo src={P.texture_terracotta} className="flex-1 rounded-[2px]" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-1 h-[22%] mt-1">
      <Photo src={P.texture_concrete} className="rounded-[2px]" />
      <Photo src={P.texture_stone} className="rounded-[2px]" />
      <Photo src={P.texture_terracotta} className="rounded-[2px]" />
    </div>
    <Palette colors={['#1C1A17', '#4A453E', '#7A7066', '#B5A797', '#E4D9C9']}
             className="h-1.5 w-full rounded-sm overflow-hidden mt-2" />
  </div>
);

// ── Brera Apartment — Milan editorial residential ──────────────────────────
const BreraApartment = () => (
  <div className="absolute inset-0 flex flex-col p-[5%] bg-[var(--bp-surface-1)]">
    <p className="text-[5.5px] tracking-[0.4em] uppercase text-[var(--bp-text-muted)]">AD Italia · Oct 26</p>
    <p className="font-serif text-[13px] text-[var(--bp-text-primary)] leading-tight">Brera apartment.</p>
    <p className="font-serif italic text-[6px] text-[var(--bp-text-muted)] mb-2 mt-0.5">A historic Milan residence reimagined.</p>
    <div className="flex-1 flex gap-1">
      <Photo src={P.warm_interior} className="flex-1 rounded-[2px]" />
      <div className="w-[36%] flex flex-col gap-1">
        <Photo src={P.texture_velvet} className="flex-1 rounded-[2px]" />
        <Photo src={P.warm_lounge} className="flex-1 rounded-[2px]" />
      </div>
    </div>
    <Palette colors={['#2A1F1B', '#5C3F33', '#A55B3F', '#D6B79A', '#F0E3D2']}
             className="h-1.5 w-full rounded-sm overflow-hidden mt-2" />
    <div className="grid grid-cols-3 gap-1 h-[18%] mt-1">
      <Photo src={P.texture_velvet} className="rounded-[2px]" />
      <Photo src={P.texture_terracotta} className="rounded-[2px]" />
      <Photo src={P.texture_wood} className="rounded-[2px]" />
    </div>
  </div>
);

// ── Coastal Retreat — bleached Mediterranean residential ───────────────────
const CoastalRetreat = () => (
  <div className="absolute inset-0 flex flex-col">
    <div className="relative flex-[1.45]">
      <Photo src={P.bedroom_calm} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-black/10" />
      <p className="absolute top-[6%] left-[5%] text-white text-[5.5px] tracking-[0.4em] uppercase opacity-90">Porto Cervo</p>
      <p className="absolute top-[12%] left-[5%] right-[5%] font-serif text-white text-[14px] leading-[0.95]">Bleached.<br/>Slow. Bright.</p>
      <p className="absolute bottom-[6%] left-[5%] text-white/85 text-[5px] tracking-[0.32em] uppercase">Master · Costa Smeralda</p>
    </div>
    <div className="px-[5%] py-2 bg-[var(--bp-surface-1)] flex-1 flex flex-col justify-center">
      <p className="font-serif italic text-[7px] text-[var(--bp-text-primary)] leading-[1.35]">A residence reduced to its sun-bleached essentials.</p>
    </div>
    <div className="grid grid-cols-2 gap-1 px-[5%] h-[18%]">
      <Photo src={P.living_window} className="rounded-[2px]" />
      <Photo src={P.dining_terrace} className="rounded-[2px]" />
    </div>
    <div className="px-[5%] py-2 bg-[var(--bp-surface-1)]">
      <Palette colors={['#F7F2EA', '#E2D5C0', '#A8B5B3', '#5E7376', '#2E3D40']}
               className="h-1.5 w-full rounded-sm overflow-hidden" />
    </div>
  </div>
);

// ── Scandinavian Nordic — pale woods + soft light ──────────────────────────
const ScandiNordic = () => (
  <div className="absolute inset-0 flex flex-col p-[6%]" style={{ background: '#FAF7F0' }}>
    <p className="text-[5.5px] tracking-[0.4em] uppercase text-[#9B917F] mb-1">02 / Light</p>
    <p className="font-serif text-[14px] text-[#1F1B16] leading-none mb-1">Nordic.</p>
    <p className="font-serif italic text-[6px] text-[#5A4D3F] mb-2">A residence shaped by clarity.</p>
    <div className="flex-1 flex gap-1">
      <Photo src={P.scandi_kitchen} className="flex-1 rounded-[2px]" />
      <div className="w-[42%] flex flex-col gap-1">
        <Photo src={P.scandi_chair} className="flex-1 rounded-[2px]" />
        <Photo src={P.texture_linen} className="flex-1 rounded-[2px]" />
      </div>
    </div>
    <Palette colors={['#FFFFFF', '#F0EBE2', '#D7CFC0', '#7A746B', '#2A2620']}
             className="h-1.5 w-full rounded-sm overflow-hidden mt-2" />
    <p className="text-[5px] tracking-[0.4em] uppercase text-[#9B917F] mt-1.5">Palette · Birch & fog</p>
  </div>
);

// ── Wabi-Sabi — Japanese imperfection / patina ─────────────────────────────
const WabiSabi = () => (
  <div className="absolute inset-0 flex flex-col p-[6%]" style={{ background: '#1E1A14' }}>
    <p className="text-[5.5px] tracking-[0.4em] uppercase text-[#8A7E6B] mb-1">03 / Imperfection</p>
    <p className="font-serif italic text-[18px] text-[#E5D9C5] leading-none mb-2">Wabi.</p>
    <p className="font-serif italic text-[6px] text-[#A89880] mb-2">侘寂 — beauty of the incomplete.</p>
    <div className="flex-1 flex gap-1">
      <Photo src={P.zen_room} className="flex-1 rounded-[2px]" />
      <div className="w-[40%] flex flex-col gap-1">
        <Photo src={P.wabi_vase} className="flex-[1.2] rounded-[2px]" />
        <Photo src={P.texture_terracotta} className="flex-1 rounded-[2px]" />
      </div>
    </div>
    <p className="font-serif italic text-[6px] text-[#A89880] mt-1.5 leading-[1.35]">"There is a crack in everything. That's how the light gets in."</p>
    <Palette colors={['#1A1612', '#3B342B', '#6B5F4F', '#A89880', '#E5D9C5']}
             className="h-1.5 w-full rounded-sm overflow-hidden mt-1.5" />
  </div>
);

// ── Editorial Magazine — oversized magazine masthead ───────────────────────
const EditorialMagazine = () => (
  <div className="absolute inset-0 overflow-hidden bg-black">
    <Photo src={P.draped_fabric} className="absolute inset-0 opacity-70" />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/65" />
    <p className="absolute top-[4%] left-[5%] font-serif text-white text-[64px] leading-[0.82]">M</p>
    <p className="absolute top-[10%] left-[40%] font-serif italic text-white text-[34px] leading-[0.82]">OOD</p>
    <p className="absolute top-[45%] left-[5%] text-white text-[5.5px] tracking-[0.5em] uppercase">Issue 02 · SS26</p>
    <p className="absolute top-[50%] left-[5%] right-[5%] font-serif italic text-white text-[10px] leading-[0.95]">THE LANGUAGE OF<br/>INTERIORS.</p>
    <div className="absolute bottom-[18%] right-[5%] w-[40%] aspect-[4/5] overflow-hidden rounded-[2px] shadow-2xl">
      <Photo src={P.cinematic_chair} className="absolute inset-0" />
    </div>
    <p className="absolute bottom-[10%] left-[5%] text-white text-[5px] tracking-[0.3em] uppercase opacity-90">12 residences · 24 materials</p>
    <p className="absolute bottom-[5%] left-[5%] text-white text-[5px] tracking-[0.5em] uppercase opacity-80">Studio MOOD · Milano</p>
  </div>
);

const PREVIEWS = {
  luxury_hospitality:    LuxuryHospitality,
  material_narrative:    MaterialNarrative,
  japandi_editorial:     JapandiEditorial,
  fashion_editorial:     FashionEditorial,
  residential_moodboard: ResidentialMoodboard,
  stone_atelier:         StoneAtelier,
  boutique_hotel:        BoutiqueHotel,
  fashion_residential:   FashionResidential,
  lakeside_villa:        LakesideVilla,
  mineral_study:         MineralStudy,
  brera_apartment:       BreraApartment,
  coastal_retreat:       CoastalRetreat,
  scandi_nordic:         ScandiNordic,
  wabi_sabi:             WabiSabi,
  editorial_magazine:    EditorialMagazine,
};

const PremiumTemplatePreview = ({ id }) => {
  const Comp = PREVIEWS[id];
  if (!Comp) return null;
  return <Comp />;
};

export default PremiumTemplatePreview;
