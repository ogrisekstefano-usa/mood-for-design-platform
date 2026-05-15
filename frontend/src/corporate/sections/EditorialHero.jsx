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
              <span className="block italic" style={{ color: '#3DDAD0', fontFamily: 'Playfair Display, serif' }}>
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
          background: 'radial-gradient(circle at 75% 30%, rgba(61,218,208,0.10) 0%, transparent 55%)',
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
              <span className="block italic" style={{ color: '#3DDAD0', fontFamily: 'Playfair Display, serif' }}>
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
        bottom: '-12px',
        left: '-20px',
        right: '20%',
        transitionDelay: '0.35s',
      }}
      data-testid="hero-floating-card"
    >
      <div
        className="card-ink p-5 rounded-xl"
        style={{
          background: 'rgba(15,26,42,0.86)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(61,218,208,0.05)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="overline" style={{ fontSize: '0.55rem', letterSpacing: '0.32em' }}>Project Overview</p>
          {card.status && (
            <span
              className="inline-flex items-center gap-1.5 text-[0.6rem] font-medium tracking-wider uppercase"
              style={{ color: '#3DDAD0' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#3DDAD0', boxShadow: '0 0 8px #3DDAD0' }} />
              {card.status}
            </span>
          )}
        </div>
        <h3 className="font-serif text-2xl text-white leading-tight mb-4">{card.project}</h3>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {(card.lines || []).slice(0, 3).map((l, i) => (
            <div key={i} className="border-l border-white/10 pl-3">
              <p className="text-[0.58rem] tracking-wider uppercase text-white/45 mb-1">{l.label}</p>
              <p className="text-xs text-white/90 font-medium">{l.value}</p>
            </div>
          ))}
        </div>

        {card.progress != null && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[0.58rem] tracking-wider uppercase text-white/45">Progress</p>
              <p className="text-[0.7rem] text-[#3DDAD0] font-medium">{card.progress}%</p>
            </div>
            <div className="h-1 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${card.progress}%`, background: 'linear-gradient(90deg, #3DDAD0, #2BB9B0)', boxShadow: '0 0 10px rgba(61,218,208,0.6)' }} />
            </div>
          </div>
        )}

        {card.cta && (
          <a href={card.cta.href || '#'} className="btn-pill-outline-teal" style={{ padding: '0.5rem 1.2rem', fontSize: '0.62rem' }}>
            {card.cta.text}
          </a>
        )}
      </div>
    </div>
  );
};

export default EditorialHero;
