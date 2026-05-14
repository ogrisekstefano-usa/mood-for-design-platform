/**
 * EditorialSkeletonPreview — curated mini-preview for each Master Layout™.
 *
 * Before: every skeleton card rendered the same dark wireframe SVG with tinted
 * rectangles. The visual result was repetitive — "same card duplicated".
 *
 * Now: each skeleton id ships a small CURATED preview using:
 *   • real editorial photography (Unsplash free CDN)
 *   • a mock palette per layout
 *   • mock typography with the real fonts (Playfair / Inter / etc.)
 *   • spacing rhythm matching the actual skeleton composition
 *
 * The preview is intentionally STATIC HTML/CSS (not React component blocks)
 * — it must render fast inside grids of 12 cards and never load the real
 * editor heavyweight code. If a skeleton id is unknown, we gracefully fall
 * back to the wireframe.
 *
 * ARCHITECTURE LOCK: no backend changes. Stock photo URLs live in this file
 * only — they are public CDN paths, not new persistence layers.
 */
import React from 'react';

// ── Curated mood per layout ────────────────────────────────────────────────
//
// Each entry contains the visual ingredients for one skeleton's mini preview.
// Photos are a vetted pool of Unsplash hot-link URLs — re-used across cards
// to keep the network footprint small and avoid hot-link rate-limit drops.
const P = {
  warm_interior:   'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=70',
  warm_lounge:     'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=600&q=70',
  cinematic_chair: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=600&q=70',
  paper_decor:     'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=70',
  white_armchair:  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=70',
};

const MOODS = {
  hero_full_bleed: {
    photo: P.warm_lounge,
    title: 'Villa Como',
    eyebrow: 'Cover',
    palette: ['#1A1410', '#5C4434', '#A88562', '#E6D6B8'],
    align: 'bottom-left',
    font: 'serif',
  },
  split_cover: {
    photo: P.warm_interior,
    title: 'Editorial',
    eyebrow: 'Chapter 01',
    palette: ['#2C2419', '#8F7758', '#D2BC9E', '#F0E5D0'],
    split: true,
    font: 'serif',
  },
  quote_page: {
    title: '"The only way to do great work is to love what you do."',
    eyebrow: '— Steve Jobs',
    palette: ['#161310'],
    font: 'serif-italic',
    centered: true,
  },
  split_editorial: {
    photo: P.warm_lounge,
    title: 'Material direction',
    body: 'Travertino, lino crudo e palissandro. Una palette tattile che racconta una calma artigianale.',
    palette: ['#241B14', '#705842', '#C9AE8C', '#EBDDC2'],
    split: 'editorial',
    font: 'serif',
  },
  mood_triptych: {
    photos: [P.cinematic_chair, P.paper_decor, P.warm_lounge],
    title: 'Mood · Triptych',
    font: 'serif',
  },
  gallery_spread: {
    photos: [P.warm_interior, P.warm_lounge, P.cinematic_chair,
             P.paper_decor, P.white_armchair, P.warm_interior],
  },
  palette_composition: {
    photo: P.cinematic_chair,
    title: 'Palette study',
    palette: ['#1A1410', '#5C4434', '#A88562', '#D9C4A3', '#EFE2C8'],
    big_palette: true,
    font: 'serif',
  },
  materials_grid: {
    photos: [P.cinematic_chair, P.paper_decor, P.warm_lounge, P.white_armchair],
    captions: ['Travertino', 'Lino crudo', 'Palissandro', 'Ottone brunito'],
    title: 'Materials',
    font: 'serif',
  },
  product_focus: {
    photo: P.white_armchair,
    title: 'Hanselmann · Lounge',
    body: 'Quercia massello, pelle nabuk · €4.200',
    palette: ['#3A2A1E', '#A88562', '#E2CFA8'],
    centered: false,
    font: 'sans',
  },
  product_grid_6: {
    photos: [P.white_armchair, P.cinematic_chair, P.warm_interior,
             P.paper_decor, P.warm_lounge, P.cinematic_chair],
    grid_size: 'product',
  },
  approval_page: {
    title: 'Client Approval',
    body: 'Approva la direzione creativa per procedere alla fase esecutiva.',
    palette: ['#0FA284'],
    cta: 'Approve direction',
    font: 'sans',
  },
  blank: {
    blank: true,
  },
};

// ── Atoms ───────────────────────────────────────────────────────────────────
//
// `Photo` renders a placeholder warm-paper gradient as the background of the
// container, then layers the real image on top. If the image fails to load
// (Unsplash hot-link is sometimes rate-limited from the browser) the gradient
// remains visible — the card never looks "empty/dark", just slightly more
// abstract. This is intentional: we trade pixel-perfect imagery for editorial
// resilience.
const PHOTO_FALLBACKS = [
  'linear-gradient(135deg, #3A2C20 0%, #2A1F16 60%, #15100B 100%)',
  'linear-gradient(135deg, #5C4434 0%, #3A2A1E 60%, #1F160F 100%)',
  'linear-gradient(135deg, #8F7758 0%, #5C4434 100%)',
  'linear-gradient(135deg, #C9AE8C 0%, #8F7758 100%)',
];
let _photoIdx = 0;
const Photo = ({ src, className = '', style }) => {
  const fallback = React.useMemo(() => {
    const f = PHOTO_FALLBACKS[_photoIdx % PHOTO_FALLBACKS.length];
    _photoIdx += 1;
    return f;
  }, []);
  return (
    <div className={`relative overflow-hidden ${className}`}
         style={{ ...style, background: fallback }}>
      {src && (
        <img src={src} alt=""
             loading="eager"
             decoding="async"
             draggable={false}
             onError={(e) => { e.currentTarget.style.display = 'none'; }}
             className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" />
      )}
    </div>
  );
};

const Palette = ({ colors = [], className = '' }) => (
  <div className={`flex ${className}`}>
    {colors.map((c, i) => (
      <span key={i} className="flex-1 h-full" style={{ background: c }} />
    ))}
  </div>
);

const fontClass = (key) => {
  if (key === 'serif')        return 'font-serif italic-0';
  if (key === 'serif-italic') return 'font-serif italic';
  return 'font-sans';
};

// ── Compositions ────────────────────────────────────────────────────────────
const HeroFullBleed = ({ m }) => (
  <div className="absolute inset-0">
    <Photo src={m.photo} className="absolute inset-0" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
    <div className="absolute left-[8%] bottom-[10%] text-white">
      <p className="text-[6px] tracking-[0.32em] uppercase opacity-80 mb-1">{m.eyebrow}</p>
      <p className={`${fontClass(m.font)} text-[15px] leading-tight`}>{m.title}</p>
    </div>
  </div>
);

const SplitCover = ({ m }) => (
  <div className="absolute inset-0 flex">
    <Photo src={m.photo} className="w-1/2 h-full" />
    <div className="w-1/2 h-full bg-[var(--bp-surface-1)] flex flex-col justify-center px-[10%]">
      <p className="text-[6px] tracking-[0.32em] uppercase opacity-60 mb-1.5 text-[var(--bp-text-secondary)]">{m.eyebrow}</p>
      <p className={`${fontClass(m.font)} text-[13px] leading-tight text-[var(--bp-text-primary)] mb-3`}>{m.title}</p>
      {m.palette && <Palette colors={m.palette} className="h-2 rounded-sm overflow-hidden" />}
    </div>
  </div>
);

const QuotePage = ({ m }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-[10%] text-center"
       style={{ background: m.palette?.[0] || '#161310' }}>
    <p className={`${fontClass(m.font)} text-white/90 text-[11px] leading-[1.45]`}>
      {m.title}
    </p>
    <p className="mt-3 text-white/40 text-[6px] tracking-[0.32em] uppercase">{m.eyebrow}</p>
  </div>
);

const SplitEditorial = ({ m }) => (
  <div className="absolute inset-0 flex">
    <Photo src={m.photo} className="w-[55%] h-full" />
    <div className="flex-1 px-[6%] py-[8%] flex flex-col justify-center bg-[var(--bp-surface-1)]">
      <p className={`${fontClass(m.font)} text-[11px] text-[var(--bp-text-primary)] leading-tight mb-1.5`}>{m.title}</p>
      <p className="text-[6.5px] text-[var(--bp-text-muted)] leading-[1.5] mb-2 line-clamp-3">{m.body}</p>
      {m.palette && <Palette colors={m.palette} className="h-1.5 rounded-sm overflow-hidden" />}
    </div>
  </div>
);

const MoodTriptych = ({ m }) => (
  <div className="absolute inset-0 grid grid-cols-3 gap-1.5 p-[6%]">
    {m.photos.map((p, i) => <Photo key={i} src={p} className="rounded-[2px] h-full" />)}
  </div>
);

const GallerySpread = ({ m }) => (
  <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1 p-[4%]">
    {m.photos.map((p, i) => <Photo key={i} src={p} className="rounded-[2px]" />)}
  </div>
);

const PaletteComposition = ({ m }) => (
  <div className="absolute inset-0 flex flex-col p-[6%]">
    <Photo src={m.photo} className="flex-1 rounded-[3px]" />
    <div className="h-3 mt-2 flex rounded-[2px] overflow-hidden">
      {m.palette.map((c, i) => (
        <span key={i} className="flex-1 h-full" style={{ background: c }} />
      ))}
    </div>
    <p className={`${fontClass(m.font)} text-[8px] text-[var(--bp-text-muted)] tracking-[0.18em] uppercase mt-1.5`}>
      {m.title}
    </p>
  </div>
);

const MaterialsGrid = ({ m }) => (
  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1.5 p-[5%]">
    {m.photos.map((p, i) => (
      <div key={i} className="relative">
        <Photo src={p} className="absolute inset-0 rounded-[2px]" />
        <span className="absolute bottom-1 left-1 text-[6px] text-white tracking-wider drop-shadow-md">
          {m.captions?.[i]}
        </span>
      </div>
    ))}
  </div>
);

const ProductFocus = ({ m }) => (
  <div className="absolute inset-0 flex flex-col">
    <Photo src={m.photo} className="h-[58%]" />
    <div className="flex-1 px-[8%] py-[7%] bg-[var(--bp-surface-1)]">
      <p className={`${fontClass(m.font)} text-[10px] text-[var(--bp-text-primary)] mb-1`}>{m.title}</p>
      <p className="text-[7px] text-[var(--bp-text-muted)] mb-2">{m.body}</p>
      <Palette colors={m.palette} className="h-1.5 w-[60%] rounded-sm overflow-hidden" />
    </div>
  </div>
);

const ProductGrid6 = ({ m }) => (
  <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-[3px] p-[3%]">
    {m.photos.map((p, i) => (
      <div key={i} className="relative bg-[var(--bp-surface-1)] rounded-[2px] overflow-hidden">
        <Photo src={p} className="absolute inset-0" />
      </div>
    ))}
  </div>
);

const ApprovalPage = ({ m }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center px-[10%] text-center
                  bg-gradient-to-b from-[var(--bp-surface-1)] to-[var(--bp-bg)]">
    <p className={`${fontClass(m.font)} text-[12px] text-[var(--bp-text-primary)] mb-2 tracking-tight`}>{m.title}</p>
    <p className="text-[7px] text-[var(--bp-text-muted)] mb-3 leading-[1.45] max-w-[80%]">{m.body}</p>
    <span className="px-3 py-1 rounded-full bg-[var(--bp-primary)] text-white text-[7px] tracking-wider uppercase">
      {m.cta}
    </span>
  </div>
);

const BlankPage = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-[var(--bp-surface-1)]">
    <div className="w-8 h-8 rounded-full border border-dashed border-[var(--bp-border-strong)] flex items-center justify-center text-[var(--bp-text-subtle)]">
      <span className="text-[14px] font-thin leading-none">+</span>
    </div>
  </div>
);

// ── Main switch ─────────────────────────────────────────────────────────────
const COMPOSITIONS = {
  hero_full_bleed: HeroFullBleed,
  split_cover: SplitCover,
  quote_page: QuotePage,
  split_editorial: SplitEditorial,
  mood_triptych: MoodTriptych,
  gallery_spread: GallerySpread,
  palette_composition: PaletteComposition,
  materials_grid: MaterialsGrid,
  product_focus: ProductFocus,
  product_grid_6: ProductGrid6,
  approval_page: ApprovalPage,
  blank: BlankPage,
};

const EditorialSkeletonPreview = ({ skeleton }) => {
  const mood = MOODS[skeleton.id];
  const Comp = COMPOSITIONS[skeleton.id];
  if (!mood || !Comp) {
    // Fallback for unknown ids — neutral surface (kept silent, no debug noise).
    return (
      <div className="absolute inset-0 bg-[var(--bp-surface-1)] flex items-center justify-center">
        <span className="text-[7px] tracking-[0.22em] uppercase text-[var(--bp-text-subtle)]">
          {skeleton.id.replace(/_/g, ' ')}
        </span>
      </div>
    );
  }
  return <Comp m={mood} />;
};

export default EditorialSkeletonPreview;
