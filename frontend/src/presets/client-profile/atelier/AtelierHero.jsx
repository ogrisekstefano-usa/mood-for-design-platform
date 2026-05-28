/**
 * AtelierHero · ITER162
 *
 * Headline serif "Benvenuto, [Nome]." + lede 3 righe + quote block
 * cinematografico, sopra fotografia lifestyle.
 */
import React from 'react';

const AtelierHero = ({ hero, quote }) => {
  return (
    <section className="atelier-hero" data-testid="atelier-hero">
      {/* Background image — full bleed inside the hero column */}
      <div className="atelier-hero__bg" aria-hidden>
        {hero.image && (
          <img
            src={hero.image}
            alt=""
            className="atelier-hero__image"
            loading="eager"
            decoding="async"
            data-testid="atelier-hero-image"
          />
        )}
        <div className="atelier-hero__veil" />
      </div>

      {/* Foreground content */}
      <div className="atelier-hero__inner">
        <p className="atelier-hero__eyebrow" data-testid="atelier-hero-eyebrow">
          {hero.eyebrow}
        </p>
        <h1 className="atelier-hero__title" data-testid="atelier-hero-title">
          {hero.title}
        </h1>
        <p className="atelier-hero__lede" data-testid="atelier-hero-lede">
          {hero.lede.split('\n').map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}{i < arr.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </p>

        {quote && (
          <figure className="atelier-quote" data-testid="atelier-quote">
            <span aria-hidden className="atelier-quote__mark">”</span>
            <blockquote className="atelier-quote__body" data-testid="atelier-quote-body">
              <em>{quote.text}</em>
            </blockquote>
            <figcaption className="atelier-quote__author" data-testid="atelier-quote-author">
              — {quote.author}
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
};

export default AtelierHero;
