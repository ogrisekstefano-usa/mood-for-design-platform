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
 * Content fields (all optional):
 *  - eyebrow                 — small teal overline
 *  - headline_1 / 2 / 3      — three white serif lines
 *  - subheading_accent       — italic teal serif (editorial style)
 *  - subheading_white        — italic white serif (editorial style)
 *  - subheading              — sans body paragraph (description)
 *  - cta_primary / cta_secondary
 *  - chips
 *
 * Config:
 *  - layout, image_url, image_alt
 *  - floating_card: project preview (style: 'card' | 'phone')
 *  - hide_image: render the column with only the floating mock
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
        <div ref={ref} className={`relative z-10 max-w-5xl mx-auto px-8 md:px-16 text-center reveal ${visible ? 'visible' : ''}`}>
          {content.eyebrow && <p className="overline-teal mb-8">{content.eyebrow}</p>}
          <h1 className="font-serif font-normal leading-[0.95] tracking-tight text-white" style={{ fontSize: 'clamp(2.6rem, 7vw, 6rem)' }}>
            {content.headline_1 && <span className="block">{content.headline_1}</span>}
            {content.headline_2 && <span className="block">{content.headline_2}</span>}
            {content.headline_3 && (
              <span className="block" style={{ color: content.subheading_accent ? '#FFFFFF' : '#00C9B3', fontFamily: 'Playfair Display, serif', fontStyle: content.subheading_accent ? 'normal' : 'italic' }}>
                {content.headline_3}
              </span>
            )}
          </h1>
          <EditorialSubhead content={content} center />
          {content.subheading && (
            <p className="mt-8 text-base leading-relaxed max-w-2xl mx-auto font-light text-white/60">{content.subheading}</p>
          )}
          {(content.cta_primary || content.cta_secondary) && (
            <div className="mt-10 flex flex-wrap gap-4 justify-center">
              {content.cta_primary && (
                <a href={content.cta_primary.href} className="btn-pill-teal" data-testid="hero-cta-primary">{content.cta_primary.text}</a>
              )}
              {content.cta_secondary && (
                <a href={content.cta_secondary.href} className="btn-pill-outline" data-testid="hero-cta-secondary">{content.cta_secondary.text}</a>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  /* Split variant ---------------------------------------------------------- */
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
        style={{ background: 'radial-gradient(circle at 75% 30%, rgba(0,201,179,0.10) 0%, transparent 55%)' }}
      />

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-14 pt-32 lg:pt-40 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Text column */}
        <div ref={ref} className={`lg:col-span-6 ${reverse ? 'lg:order-2' : ''}`}>
          {content.eyebrow && (
            <p className={`overline-teal mb-8 reveal ${visible ? 'visible' : ''}`}>{content.eyebrow}</p>
          )}
          <h1
            className={`font-serif font-normal leading-[1.02] tracking-tight text-white reveal ${visible ? 'visible' : ''}`}
            style={{ fontSize: 'clamp(2.2rem, 4.6vw, 4.4rem)', transitionDelay: '0.05s' }}
          >
            {content.headline_1 && <span className="block">{content.headline_1}</span>}
            {content.headline_2 && <span className="block">{content.headline_2}</span>}
            {content.headline_3 && (
              <span
                className="block"
                style={{
                  color: content.subheading_accent ? '#FFFFFF' : '#00C9B3',
                  fontFamily: 'Playfair Display, serif',
                  fontStyle: content.subheading_accent ? 'normal' : 'italic',
                }}
              >
                {content.headline_3}
              </span>
            )}
          </h1>

          <EditorialSubhead content={content} visible={visible} />

          {content.subheading && (
            <p
              className={`mt-7 font-light leading-relaxed max-w-md reveal ${visible ? 'visible' : ''}`}
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '0.92rem',
                transitionDelay: '0.18s',
              }}
            >
              {content.subheading}
            </p>
          )}

          {(content.cta_primary || content.cta_secondary) && (
            <div className={`mt-10 flex flex-wrap items-center gap-4 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.25s' }}>
              {content.cta_primary && (
                <a href={content.cta_primary.href} className="btn-pill-teal" data-testid="hero-cta-primary">{content.cta_primary.text}</a>
              )}
              {content.cta_secondary && (
                <a href={content.cta_secondary.href} className="btn-pill-outline" data-testid="hero-cta-secondary">{content.cta_secondary.text}</a>
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

        {/* Visual column */}
        <div className={`relative lg:col-span-6 ${reverse ? 'lg:order-1' : ''}`}>
          {config.image_url && !config.hide_image && (
            <div
              className={`relative aspect-[4/5] lg:aspect-[3/4] xl:aspect-[5/6] rounded-xl overflow-hidden reveal ${visible ? 'visible' : ''}`}
              style={{
                transitionDelay: '0.2s',
                background: '#1A2030',
                boxShadow: '0 60px 120px -30px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
              }}
            >
              <img src={config.image_url} alt={config.image_alt || ''} className="w-full h-full object-cover" style={{ filter: 'saturate(1.05) contrast(1.02)' }} loading="eager" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,19,32,0) 30%, rgba(10,19,32,0.45) 100%)' }} />
            </div>
          )}

          {config.floating_card && (
            <FloatingProjectMock card={config.floating_card} visible={visible} style={config.floating_card.style || 'card'} />
          )}
        </div>
      </div>
    </section>
  );
};

/* ── Editorial sub-headline block ────────────────────────────────────────── */
const EditorialSubhead = ({ content = {}, visible = true, center = false }) => {
  if (!content.subheading_accent && !content.subheading_white) return null;
  return (
    <div className={`mt-7 reveal ${visible ? 'visible' : ''}`} style={{ transitionDelay: '0.12s', textAlign: center ? 'center' : 'left' }}>
      {content.subheading_accent && (
        <p
          className="italic"
          style={{
            fontFamily: 'Playfair Display, serif',
            color: '#00C9B3',
            fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)',
            lineHeight: 1.35,
            letterSpacing: '-0.005em',
          }}
        >
          {content.subheading_accent}
        </p>
      )}
      {content.subheading_white && (
        <p
          className="italic"
          style={{
            fontFamily: 'Playfair Display, serif',
            color: 'rgba(255,255,255,0.92)',
            fontSize: 'clamp(1.1rem, 1.6vw, 1.5rem)',
            lineHeight: 1.35,
            letterSpacing: '-0.005em',
          }}
        >
          {content.subheading_white}
        </p>
      )}
    </div>
  );
};

/* ── Floating Project Mock (card OR phone style) ─────────────────────────── */
const FloatingProjectMock = ({ card, visible, style = 'card' }) => {
  const isPhone = style === 'phone';

  const wrapStyle = isPhone
    ? { top: '8%', left: '-6%', width: 'min(280px, 70%)', transitionDelay: '0.35s' }
    : { top: '-8%', right: '-4%', width: 'min(420px, 90%)', transitionDelay: '0.35s' };

  const innerStyle = isPhone
    ? {
        background: '#0E0E10',
        backdropFilter: 'blur(20px)',
        border: '8px solid #0E0E10',
        borderRadius: '36px',
        boxShadow: '0 50px 100px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,201,179,0.10)',
        padding: '1.25rem 1rem',
      }
    : {
        background: 'rgba(14,14,16,0.92)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,201,179,0.06)',
        padding: '1.5rem',
      };

  return (
    <div className={`hidden md:block absolute reveal ${visible ? 'visible' : ''}`} style={wrapStyle} data-testid="hero-floating-mock">
      <div style={innerStyle}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="overline" style={{ fontSize: isPhone ? '0.5rem' : '0.55rem', letterSpacing: '0.28em', color: 'rgba(255,255,255,0.55)', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, textTransform: 'uppercase' }}>
            {isPhone ? 'Dashboard' : 'Project Overview'}
          </p>
          {card.status && !isPhone && (
            <span className="text-[0.62rem] font-medium tracking-wider uppercase px-3 py-1 rounded-full"
              style={{ color: '#00C9B3', background: 'rgba(0,201,179,0.10)', border: '1px solid rgba(0,201,179,0.4)' }}>
              {card.status}
            </span>
          )}
        </div>

        {/* PHONE STYLE: big circular progress + phases */}
        {isPhone ? (
          <>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', marginBottom: '0.6rem' }}>
              Attività
            </p>
            <div className="flex justify-center mb-3">
              <CircularProgress value={card.progress ?? 62} size={120} />
            </div>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: '0.06em', marginBottom: '0.9rem' }}>
              Attività completate
            </p>
            {Array.isArray(card.phases) && (
              <div className="space-y-2">
                {card.phases.slice(0, 5).map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.62rem', color: 'rgba(255,255,255,0.7)' }}>{p.label}</span>
                      <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)' }}>{p.value}%</span>
                    </div>
                    <div style={{ height: 2.5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.value}%`, background: p.value === 0 ? 'rgba(0,201,179,0.3)' : '#00C9B3', borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h3 className="font-serif text-3xl text-white leading-tight mb-5">{card.project}</h3>
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
            {Array.isArray(card.phases) && (
              <div className="space-y-3">
                {card.phases.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-white/75">{p.label}</span>
                      <span className="text-[0.7rem] text-white/55 font-medium">{p.value}%</span>
                    </div>
                    <div className="h-[3px] bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.value}%`, background: p.value === 0 ? 'rgba(0,201,179,0.25)' : '#00C9B3' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const CircularProgress = ({ value = 62, size = 120 }) => {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="#00C9B3" strokeWidth="6" fill="none"
        strokeDasharray={c} strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: 'drop-shadow(0 0 6px rgba(0,201,179,0.6))' }}
      />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: 'Playfair Display, serif', fontSize: size * 0.26, fill: '#FFFFFF', fontWeight: 500 }}>
        {`${value}%`}
      </text>
    </svg>
  );
};

export default EditorialHero;
