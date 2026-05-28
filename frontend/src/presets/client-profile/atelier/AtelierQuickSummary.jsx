/**
 * AtelierQuickSummary · ITER162
 *
 * "Le tue prime indicazioni" — 4 card editoriali (Atmosfera, Stile di
 * vita, Preferenze, Priorità). Ogni card: icona micro, label, titolo
 * serif, body 2 righe, thumbnail materica in basso.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Home, Leaf, ShieldCheck, ArrowRight,
} from 'lucide-react';

const ICONS = {
  sparkles: Sparkles,
  home:     Home,
  leaf:     Leaf,
  shield:   ShieldCheck,
};

const AtelierQuickSummary = ({ indications, journeyId }) => {
  return (
    <section className="atelier-summary" data-testid="atelier-summary">
      <header className="atelier-summary__head">
        <Sparkles size={14} strokeWidth={1.5} aria-hidden />
        <p className="atelier-summary__title" data-testid="atelier-summary-title">
          Le tue prime indicazioni
        </p>
      </header>

      <div className="atelier-summary__grid">
        {indications.map((card, idx) => {
          const Icon = ICONS[card.icon] || Sparkles;
          return (
            <article
              key={card.id}
              className="atelier-card"
              data-testid={`atelier-summary-card-${card.id}`}
              style={{ animationDelay: `${120 + idx * 80}ms` }}
            >
              <header className="atelier-card__head">
                <span className="atelier-card__icon" aria-hidden>
                  <Icon size={13} strokeWidth={1.6} />
                </span>
                <p className="atelier-card__label" data-testid={`atelier-summary-label-${card.id}`}>
                  {card.label}
                </p>
              </header>
              <h3 className="atelier-card__title" data-testid={`atelier-summary-title-${card.id}`}>
                {card.title}
              </h3>
              <p className="atelier-card__body">
                {card.body.split('\n').map((l, i, a) => (
                  <React.Fragment key={i}>
                    {l}{i < a.length - 1 ? <br /> : null}
                  </React.Fragment>
                ))}
              </p>
              <div className="atelier-card__thumb">
                <img src={card.image} alt="" loading="lazy" decoding="async" />
              </div>
            </article>
          );
        })}
      </div>

      <Link
        to={journeyId ? `/client/journey/${journeyId}` : '/client'}
        className="atelier-summary__cta"
        data-testid="atelier-summary-details-cta"
      >
        <span>Vedi tutti i dettagli del tuo brief</span>
        <ArrowRight size={14} strokeWidth={1.6} aria-hidden />
      </Link>
    </section>
  );
};

export default AtelierQuickSummary;
