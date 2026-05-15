import React from 'react';
import { useReveal } from '../hooks/useReveal';
import { Sparkles, Layers, Briefcase, UserCircle, BarChart3 } from 'lucide-react';

const CHIP_ICONS = {
  lead:        Sparkles,
  moodboards:  Layers,
  projects:    Briefcase,
  client:      UserCircle,
  progress:    BarChart3,
};

/**
 * EditorialHero — dark cinematic hero.
 * Layouts: 'split-right' | 'split-left' | 'centered'
 *
 * Supports:
 *  - content.eyebrow, headline_1/2/3 (3rd line auto-teal italic)
 *  - content.subheading
 *  - content.cta_primary / cta_secondary
 *  - content.chips: [{key, label}]
 *  - config.image_url (full bleed photo)
 *  - config.floating_card: { project, status, lines:[{label,value}], cta }
 */
const EditorialHero = ({ content = {}, config = {} }) => {
  const [ref, visible] = useReveal({ threshold: 0.05 });
  const isCentered = config.layout === 'centered';

  /* Centered variant ------------------------------------------------------- */
  if (isCentered) {
    return (
      <section
        className="relative min-h-[70vh] flex items-center justify-center grain overflow-hidden"
        style={{ background: 'var(--mood-ink)' }}
        data-testid="editorial-hero-centered"
      >
        <div
          ref={ref}
          className={`relative z-10 max-w-5xl mx-auto px-8 md:px-16 text-center reveal ${visible ? 'visible' : ''}`}
        >
          {content.eyebrow && <p className="overline-teal mb-8">{content.eyebrow}</p>}
          <h1
            className="font-serif font-normal leading-[0.95] tracking-tight text-white"
            style={{ fontSize: 'clamp(2.6rem, 7vw, 6rem)' }}
          >
            {content.headline_1 && <span className="block">{content.headline_1}</span>}
            {content.headline_2 && <span className="block">{content.headline_2}</span>}
            {content.headline_3 && (
              <span className="block italic" style={{ color: '#00C9B3', fontFamily: 'Playfair Display, serif' }}>
                {content.headline_3}
              </span>
            )}
          </h1>
          {content.subheading && (
            <p className="mt-8 text-base leading-relaxed max-w-2xl mx-auto font-light text-white/60">{content.subheading}</p>
          )}
          {(content.cta_primary || content.cta_secondary) && (
            <div className="mt-10 flex flex-wrap gap-4 justify-center">
              {content.cta_primary && (
                <a href={content.cta_primary.href} className="btn-pill-teal" data-testid="hero-cta-primary">
                  {content.cta_primary.text}
                </a>
              )}
              {content.cta_secondary && (
                <a href={content.cta_secondary.href} className="btn-pill-outline" data-testid="hero-cta-secondary">
                  {content.cta_secondary.text}
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  /* Split variant with optional floating card ------------------------------ */
  const reverse = config.layout === 'split-left';
  return (
    <section
      className="relative grain overflow-hidden"
      style={{ background: 'var(--mood-ink)', minHeight: 'calc(100vh - 0px)' }}
      data-testid="editorial-hero-split"
    >
      {/* Subtle radial accent */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 75% 30%, rgba(0,201,179,0.10) 0%, transparent 55%)',
        }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 pt-32 lg:pt-40 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Text column */}
        <div
          ref={ref}
          className={`lg:col-span-6 ${reverse ? 'lg:order-2' : ''}`}
        >
          {content.eyebrow && (
            <p className={`overline-teal mb-8 reveal ${visible ? 'visible' : ''}`}>{content.eyebrow}</p>
          )}
          <h1
            className={`font-serif font-normal leading-[0.95] tracking-tight text-white reveal ${visible ? 'visible' : ''}`}
            style={{ fontSize: 'clamp(2.4rem, 5.8vw, 5.5rem)', transitionDelay: '0.05s' }}
          >
            {content.headline_1 && <span className="block">{content.headline_1}</span>}
            {content.headline_2 && <span className="block">{content.headline_2}</span>}
            {content.headline_3 && (
              <span className="block italic" style={{ color: '#00C9B3', fontFamily: 'Playfair Display, serif' }}>
                {content.headline_3}
              </span>
            )}
          </h1>

          {content.subheading && (
            <p
              className={`mt-7 text-base font-light leading-relaxed max-w-md text-white/65 reveal ${visible ? 'visible' : ''}`}
              style={{ transitionDelay: '0.15s' }}
            >
              {content.subheading}
            </p>
          )}

          {(content.cta_primary || content.cta_secondary) && (
            <div className={`mt-10 flex flex-wrap items-center gap-4 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
              {content.cta_primary && (
                <a href={content.cta_primary.href} className="btn-pill-teal" data-testid="hero-cta-primary">
                  {content.cta_primary.text}
                </a>
              )}
              {content.cta_secondary && (
                <a href={content.cta_secondary.href} className="btn-pill-outline" data-testid="hero-cta-secondary">
                  {content.cta_secondary.text}
                </a>
              )}
            </div>
          )}

          {Array.isArray(content.chips) && content.chips.length > 0 && (
            <div className={`mt-12 flex flex-wrap gap-3 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.35s' }} data-testid="hero-chips">
              {content.chips.map((c, i) => {
                const Icon = CHIP_ICONS[c.key] || Sparkles;
                return (
                  <span key={i} className="feature-chip" data-testid={`hero-chip-${c.key || i}`}>
                    <span className="icon-bubble"><Icon size={14} strokeWidth={1.6} /></span>
                    {c.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Visual column: photo + floating project card */}
        <div className={`relative lg:col-span-6 ${reverse ? 'lg:order-1' : ''}`}>
          {config.image_url && (
            <div
              className={`relative aspect-[4/5] lg:aspect-[3/4] xl:aspect-[5/6] rounded-xl overflow-hidden reveal ${visible ? 'visible' : ''}`}
              style={{
                transitionDelay: '0.2s',
                background: '#1A2030',
                boxShadow: '0 60px 120px -30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              <img
                src={config.image_url}
                alt={config.image_alt || ''}
                className="w-full h-full object-cover"
                style={{ filter: 'saturate(1.05) contrast(1.02)' }}
                loading="eager"
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,19,32,0) 30%, rgba(10,19,32,0.45) 100%)' }} />
            </div>
          )}

          {config.floating_card && (
            <FloatingProjectCard card={config.floating_card} visible={visible} />
          )}
        </div>
      </div>
    </section>
  );
};

const FloatingProjectCard = ({ card, visible }) => {
  return (
    <div
      className={`hidden md:block absolute reveal ${visible ? 'visible' : ''}`}
      style={{
        top: '-8%',
        right: '-4%',
        width: 'min(420px, 90%)',
        transitionDelay: '0.35s',
      }}
      data-testid="hero-floating-card"
    >
      <div
        className="p-6 rounded-xl"
        style={{
          background: 'rgba(14,14,16,0.92)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,201,179,0.06)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="overline" style={{ fontSize: '0.55rem', letterSpacing: '0.32em' }}>Project Overview</p>
          {card.status && (
            <span
              className="text-[0.62rem] font-medium tracking-wider uppercase px-3 py-1 rounded-full"
              style={{ color: '#00C9B3', background: 'rgba(0,201,179,0.10)', border: '1px solid rgba(0,201,179,0.4)' }}
            >
              {card.status}
            </span>
          )}
        </div>
        <h3 className="font-serif text-3xl text-white leading-tight mb-5">{card.project}</h3>

        {/* Client / Budget row */}
        {(card.client || card.budget) && (
          <div className="grid grid-cols-2 gap-4 mb-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {card.client && (
              <div>
                <p className="text-[0.55rem] tracking-[0.22em] uppercase text-white/40 mb-1.5">Client</p>
                <p className="text-sm text-white/90 font-medium">{card.client}</p>
              </div>
            )}
            {card.budget && (
              <div>
                <p className="text-[0.55rem] tracking-[0.22em] uppercase text-white/40 mb-1.5">Budget</p>
                <p className="text-sm text-white/90 font-medium">{card.budget}</p>
              </div>
            )}
          </div>
        )}

        {/* Overall progress */}
        {card.progress != null && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[0.62rem] tracking-[0.18em] uppercase text-white/55">Overall Progress</p>
              <p className="text-xs text-[#00C9B3] font-medium">{card.progress}%</p>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${card.progress}%`, background: '#00C9B3', boxShadow: '0 0 10px rgba(0,201,179,0.6)' }} />
            </div>
          </div>
        )}

        {/* Phases — multi-line progress */}
        {Array.isArray(card.phases) && card.phases.length > 0 && (
          <div className="space-y-3">
            {card.phases.map((p, i) => {
              const Icon = p.done ? CheckIcon : (p.icon === 'eye' ? EyeIcon : (p.icon === 'check' ? CheckIcon : (p.icon === 'cart' ? CartIcon : (p.icon === 'tools' ? ToolsIcon : (p.icon === 'palette' ? PaletteIcon : DotIcon)))));
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-xs text-white/75">
                      <Icon size={12} />
                      {p.label}
                    </span>
                    <span className="text-[0.7rem] text-white/55 font-medium">{p.value}%</span>
                  </div>
                  <div className="h-[3px] bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p.value}%`, background: p.value === 0 ? 'rgba(0,201,179,0.25)' : '#00C9B3' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// Minimal inline icons for phases (no dep on lucide that gets tree-shaken away)
const CheckIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M3 8L7 12L13 5" stroke="#00C9B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const EyeIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 4C4 4 1.5 8 1.5 8C1.5 8 4 12 8 12C12 12 14.5 8 14.5 8C14.5 8 12 4 8 4Z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3"/></svg>
);
const PaletteIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3"/><circle cx="6" cy="6" r="0.8" fill="rgba(255,255,255,0.6)"/><circle cx="10" cy="7" r="0.8" fill="rgba(255,255,255,0.6)"/><circle cx="9" cy="10" r="0.8" fill="rgba(255,255,255,0.6)"/></svg>
);
const CartIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M2 3H3.5L4.5 11H12.5L13.5 5H5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="13.5" r="1" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3"/><circle cx="11" cy="13.5" r="1" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3"/></svg>
);
const ToolsIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M6 10L2.5 13.5L3.5 14.5L7 11M11 5L13.5 2.5L14.5 3.5L12 6M7 11L10 8L9 7L6 10M8 8L5 5L4 6L7 9M11 5L9 7" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const DotIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" fill="rgba(255,255,255,0.4)"/></svg>
);

export default EditorialHero;
