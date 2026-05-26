import React from 'react';
import { Link } from 'react-router-dom';
import { useReveal } from '../hooks/useReveal';

/**
 * PricingTiersEditorial — three editorial tier cards.
 *
 * Each tier is presented as a "modalità operativa" (operating mode), not
 * a SaaS plan. The card uses:
 *   - large environment photograph at the top (interior / studio / atelier)
 *   - eyebrow tag (label of the mode)
 *   - serif title (name of the mode)
 *   - italic editorial subtitle
 *   - editorial body paragraph
 *   - secondary price line (small, italic, never the protagonist)
 *   - 4-5 inclusions, typographic, no bullets — just hairlines
 *   - outlined CTA pill
 *
 * Center tier (idx 1) is marked as "featured" via options.featured_index.
 *
 * content: { tier_01_eyebrow, tier_01_title, tier_01_subtitle, tier_01_body,
 *            tier_01_price, tier_01_price_caption,
 *            tier_01_inc_1, tier_01_inc_2, tier_01_inc_3, tier_01_inc_4, tier_01_inc_5,
 *            tier_01_cta, ...same for 02, 03 }
 * media:   { tier_01, tier_02, tier_03 }
 * links:   { tier_01_href, tier_02_href, tier_03_href }
 * options: { featured_index: 1 }
 */
const PricingTiersEditorial = ({ content = {}, media = {}, links = {}, options = {} }) => {
  const featuredIdx = Number(options.featured_index ?? 1);

  const tiers = [1, 2, 3].map((n) => {
    const key = String(n).padStart(2, '0');
    return {
      idx: n - 1,
      key,
      eyebrow:       content[`tier_${key}_eyebrow`],
      title:         content[`tier_${key}_title`],
      subtitle:      content[`tier_${key}_subtitle`],
      body:          content[`tier_${key}_body`],
      price:         content[`tier_${key}_price`],
      priceCaption:  content[`tier_${key}_price_caption`],
      cta:           content[`tier_${key}_cta`],
      inclusions: [
        content[`tier_${key}_inc_1`],
        content[`tier_${key}_inc_2`],
        content[`tier_${key}_inc_3`],
        content[`tier_${key}_inc_4`],
        content[`tier_${key}_inc_5`],
      ].filter((s) => s && s.trim()),
      media:  media[`tier_${key}`],
      href:   links[`tier_${key}_href`] || '/dedicato-a',
    };
  }).filter((t) => (t.title && t.title.trim()) || (t.body && t.body.trim()));

  return (
    <section
      className="relative"
      style={{ background: '#000000', padding: 'clamp(4rem, 8vw, 8rem) 0' }}
      data-testid="pricing-tiers-editorial"
    >
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 lg:px-16">
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 'clamp(1.5rem, 2.5vw, 2.5rem)',
            alignItems: 'stretch',
          }}
        >
          {tiers.map((t) => (
            <TierCard key={t.key} tier={t} featured={t.idx === featuredIdx} />
          ))}
        </div>
      </div>
    </section>
  );
};

const TierCard = ({ tier, featured }) => {
  const [ref, visible] = useReveal({ threshold: 0.12 });

  return (
    <article
      ref={ref}
      className={`reveal ${visible ? 'visible' : ''}`}
      style={{
        position: 'relative',
        background: featured ? '#08100E' : '#050606',
        border: featured
          ? '1px solid rgba(0,201,179,0.32)'
          : '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        minHeight: 720,
      }}
      data-testid={`pricing-tier-${tier.key}`}
    >
      {/* Top photograph — environment / atelier */}
      <div
        style={{
          position: 'relative', aspectRatio: '4/3',
          overflow: 'hidden', background: '#0A0A0A',
        }}
      >
        {tier.media && tier.media.url && (
          <img
            src={tier.media.url}
            alt={tier.media.alt || ''}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transition: 'transform 1.2s cubic-bezier(.2,.7,.2,1)',
            }}
            loading="lazy"
          />
        )}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {featured && (
          <span
            style={{
              position: 'absolute', top: 18, left: 18,
              fontFamily: 'Inter, sans-serif', fontSize: '0.66rem', fontWeight: 500,
              letterSpacing: '0.22em', textTransform: 'uppercase',
              color: '#000', background: 'var(--mood-teal, #00C9B3)',
              padding: '0.4rem 0.8rem',
            }}
            data-testid={`pricing-tier-featured-${tier.key}`}
          >
            Consigliato
          </span>
        )}
      </div>

      {/* Body */}
      <div
        className="flex flex-col"
        style={{ padding: 'clamp(1.75rem, 2.4vw, 2.4rem)', flex: 1 }}
      >
        {tier.eyebrow && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 500,
              letterSpacing: '0.24em', textTransform: 'uppercase',
              color: 'var(--mood-teal, #00C9B3)', marginBottom: '1.2rem',
            }}
            data-testid={`pricing-tier-eyebrow-${tier.key}`}
          >
            {tier.eyebrow}
          </p>
        )}
        {tier.title && (
          <h3
            style={{
              fontFamily: 'Playfair Display, serif', fontWeight: 400,
              fontSize: 'clamp(1.7rem, 2.4vw, 2.4rem)', lineHeight: 1.1,
              letterSpacing: '-0.012em', color: '#FFFFFF',
              marginBottom: '0.8rem',
            }}
            data-testid={`pricing-tier-title-${tier.key}`}
          >
            {tier.title}
          </h3>
        )}
        {tier.subtitle && (
          <p
            style={{
              fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
              fontWeight: 400, fontSize: '1rem', lineHeight: 1.5,
              color: 'rgba(0,201,179,0.78)', marginBottom: '1.6rem',
            }}
            data-testid={`pricing-tier-subtitle-${tier.key}`}
          >
            {tier.subtitle}
          </p>
        )}
        {tier.body && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.93rem',
              lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', fontWeight: 300,
              marginBottom: '2rem',
            }}
            data-testid={`pricing-tier-body-${tier.key}`}
          >
            {tier.body}
          </p>
        )}

        {/* Inclusions — typographic, no bullets, hairlines */}
        {tier.inclusions.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBottom: '2.4rem' }}>
            {tier.inclusions.map((inc, i) => (
              <li
                key={i}
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
                  lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', fontWeight: 300,
                  padding: '0.85rem 0',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  ...(i === tier.inclusions.length - 1
                    ? { borderBottom: '1px solid rgba(255,255,255,0.06)' }
                    : {}),
                }}
                data-testid={`pricing-tier-inc-${tier.key}-${i + 1}`}
              >
                {inc}
              </li>
            ))}
          </ul>
        )}

        {/* Spacer push */}
        <div style={{ flex: 1 }} />

        {/* Price — secondary, italic, never protagonist */}
        {tier.price && (
          <div style={{ marginBottom: '1.2rem' }}>
            <div
              style={{
                fontFamily: 'Playfair Display, serif', fontWeight: 400,
                fontSize: '1.4rem', color: '#FFFFFF', letterSpacing: '-0.01em',
              }}
              data-testid={`pricing-tier-price-${tier.key}`}
            >
              {tier.price}
            </div>
            {tier.priceCaption && (
              <div
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
                  color: 'rgba(255,255,255,0.42)', fontWeight: 300,
                  marginTop: '0.3rem', letterSpacing: '0.02em',
                }}
                data-testid={`pricing-tier-price-caption-${tier.key}`}
              >
                {tier.priceCaption}
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {tier.cta && (
          <Link
            to={tier.href}
            style={{
              display: 'inline-block', textAlign: 'center',
              fontFamily: 'Inter, sans-serif', fontSize: '0.82rem',
              fontWeight: 400, letterSpacing: '0.04em',
              padding: '1rem 1.4rem',
              color: featured ? '#000' : '#FFFFFF',
              background: featured ? 'var(--mood-teal, #00C9B3)' : 'transparent',
              border: featured
                ? '1px solid var(--mood-teal, #00C9B3)'
                : '1px solid rgba(255,255,255,0.5)',
              textDecoration: 'none',
              transition: 'all 0.25s ease',
            }}
            onMouseEnter={(e) => {
              if (!featured) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'var(--mood-teal, #00C9B3)';
              } else {
                e.currentTarget.style.background = 'rgba(0,201,179,0.85)';
              }
            }}
            onMouseLeave={(e) => {
              if (!featured) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
              } else {
                e.currentTarget.style.background = 'var(--mood-teal, #00C9B3)';
              }
            }}
            data-testid={`pricing-tier-cta-${tier.key}`}
          >
            {tier.cta}
          </Link>
        )}
      </div>
    </article>
  );
};

export default PricingTiersEditorial;
