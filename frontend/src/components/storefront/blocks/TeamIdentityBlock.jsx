/**
 * TeamIdentityBlock — Phase T.1 public-storefront component.
 *
 * Renders the cinematic "Your Reference" section on the storefront.
 * Direction: boutique hospitality + editorial luxury + human warmth.
 *
 * DATA: pulled from /api/storefront/public/{slug}/team-leaders
 * (public, anonymous, public-safe shape only). If no introduced
 * profile exists, falls back to a neutral atelier hint — never a
 * placeholder face, never a stock avatar.
 *
 * COPY: CMS-resolved via the same `resolve('team_identity_card', …)`
 * pattern used by the rest of the storefront blocks, so the studio
 * can edit eyebrow / headline / subheadline / CTA inline.
 */
import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';
import './team-identity.css';

const TeamIdentityBlock = ({ resolve, slug, defaults }) => {
  const [state, setState] = useState({ loading: true, leaders: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(
          `/api/storefront/public/${encodeURIComponent(slug)}/team-leaders?max_leaders=2`,
        );
        if (alive) setState({ loading: false, leaders: data?.leaders || [] });
      } catch (_) {
        if (alive) setState({ loading: false, leaders: [] });
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  const eyebrow     = resolve('team_identity_card', 'eyebrow',     defaults.eyebrow);
  const headline    = resolve('team_identity_card', 'headline',    defaults.headline);
  const subheadline = resolve('team_identity_card', 'subheadline', defaults.subheadline);
  const ctaLabel    = resolve('team_identity_card', 'cta_label',   defaults.cta_label);
  const ctaHref     =                                              defaults.cta_href || '/start-project';
  const variant     = defaults.variant || 'warm';
  const alignment   = defaults.alignment || 'portrait_left';

  if (state.loading) return null;

  // Single-leader cinematic layout (preferred).
  if (state.leaders.length === 1) {
    return (
      <SingleLeaderSection
        leader={state.leaders[0]}
        eyebrow={eyebrow}
        headline={headline}
        subheadline={subheadline}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        variant={variant}
        alignment={alignment}
      />
    );
  }

  // Two-leader layout (paired).
  if (state.leaders.length >= 2) {
    return (
      <PairedLeadersSection
        leaders={state.leaders.slice(0, 2)}
        eyebrow={eyebrow}
        headline={headline}
        subheadline={subheadline}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        variant={variant}
      />
    );
  }

  // No introduced profile — calm fallback.
  return (
    <NeutralFallback
      eyebrow={eyebrow}
      headline={headline}
      ctaLabel={ctaLabel}
      ctaHref={ctaHref}
      variant={variant}
    />
  );
};

/* ── Single leader cinematic layout ─────────────────────────────── */
const SingleLeaderSection = ({
  leader, eyebrow, headline, subheadline, ctaLabel, ctaHref, variant, alignment,
}) => {
  const portraitLeft = alignment === 'portrait_left';
  return (
    <section
      data-testid="storefront-team-identity"
      data-variant={variant}
      className="ti-section"
    >
      <div className={`ti-wrap ti-wrap--${portraitLeft ? 'left' : 'right'}`}>
        <figure className="ti-portrait">
          <img
            src={leader.avatar_url}
            alt={leader.display_name}
            loading="lazy"
            className="ti-portrait__img"
            data-testid="storefront-team-portrait"
          />
          <figcaption className="ti-portrait__caption">
            <span className="ti-portrait__name">{leader.display_name}</span>
            <span className="ti-portrait__role">{leader.role_label}</span>
          </figcaption>
        </figure>

        <div className="ti-copy">
          {eyebrow && <p className="ti-eyebrow">{eyebrow}</p>}
          {headline && (
            <h2
              className="ti-headline"
              dangerouslySetInnerHTML={{ __html: headline }}
            />
          )}
          {leader.short_bio && (
            <blockquote className="ti-quote">
              <span className="ti-quote__mark">“</span>
              {leader.short_bio}
            </blockquote>
          )}
          {subheadline && (
            <div
              className="ti-subheadline"
              dangerouslySetInnerHTML={{ __html: subheadline }}
            />
          )}
          <div className="ti-actions">
            <a
              href={ctaHref}
              className="ti-cta"
              data-testid="storefront-team-cta"
            >
              {ctaLabel}
              <span aria-hidden className="ti-cta__arrow">→</span>
            </a>
            {leader.response_time_label && (
              <p className="ti-meta">{leader.response_time_label}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ── Paired leaders ─────────────────────────────────────────────── */
const PairedLeadersSection = ({
  leaders, eyebrow, headline, subheadline, ctaLabel, ctaHref, variant,
}) => (
  <section
    data-testid="storefront-team-identity"
    data-variant={variant}
    className="ti-section ti-section--paired"
  >
    <header className="ti-header">
      {eyebrow && <p className="ti-eyebrow">{eyebrow}</p>}
      {headline && (
        <h2 className="ti-headline" dangerouslySetInnerHTML={{ __html: headline }} />
      )}
      {subheadline && (
        <div className="ti-subheadline" dangerouslySetInnerHTML={{ __html: subheadline }} />
      )}
    </header>
    <div className="ti-pair">
      {leaders.map((l) => (
        <article key={l.id} className="ti-pair__card">
          <img src={l.avatar_url} alt={l.display_name} loading="lazy" className="ti-pair__img" />
          <div className="ti-pair__body">
            <p className="ti-pair__name">{l.display_name}</p>
            <p className="ti-pair__role">{l.role_label}</p>
            {l.short_bio && <p className="ti-pair__bio">{l.short_bio}</p>}
          </div>
        </article>
      ))}
    </div>
    <div className="ti-actions ti-actions--center">
      <a href={ctaHref} className="ti-cta" data-testid="storefront-team-cta">
        {ctaLabel}
        <span aria-hidden className="ti-cta__arrow">→</span>
      </a>
    </div>
  </section>
);

/* ── Fallback (no introduced profile) ───────────────────────────── */
const NeutralFallback = ({ eyebrow, headline, ctaLabel, ctaHref, variant }) => (
  <section
    data-testid="storefront-team-identity-fallback"
    data-variant={variant}
    className="ti-section ti-section--neutral"
  >
    <div className="ti-neutral">
      {eyebrow && <p className="ti-eyebrow">{eyebrow}</p>}
      <h2 className="ti-headline">
        Il nostro studio ti accompagnerà durante ogni fase del progetto.
      </h2>
      {headline && (
        <div className="ti-subheadline" dangerouslySetInnerHTML={{ __html: headline }} />
      )}
      <a href={ctaHref} className="ti-cta">
        {ctaLabel}
        <span aria-hidden className="ti-cta__arrow">→</span>
      </a>
    </div>
  </section>
);

export default TeamIdentityBlock;
