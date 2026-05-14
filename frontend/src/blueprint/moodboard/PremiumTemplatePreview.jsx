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

const PREVIEWS = {
  luxury_hospitality:    LuxuryHospitality,
  material_narrative:    MaterialNarrative,
  japandi_editorial:     JapandiEditorial,
  fashion_editorial:     FashionEditorial,
  residential_moodboard: ResidentialMoodboard,
};

const PremiumTemplatePreview = ({ id }) => {
  const Comp = PREVIEWS[id];
  if (!Comp) return null;
  return <Comp />;
};

export default PremiumTemplatePreview;
