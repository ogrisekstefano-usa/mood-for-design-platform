/**
 * AtelierQuickSummary · ITER168 — Atmospheric Panels™
 *
 * NEVER again "4 cards with people photos and category labels".
 *
 * NOW: editorial interpretation layer that EVOKES atmosphere instead
 * of asserting style. Panels are loaded from the Chameleon™ database
 * (`/api/atmospheric/panels`) filtered by locale + market.
 *
 * The legacy `indications` prop is intentionally ignored — those came
 * from a stock-photo-driven heuristic that DOES NOT belong on the
 * Client Profile™ anymore. The CTA "Vedi tutti i dettagli del brief"
 * stays: that link leads to the actual brief detail, where the raw
 * intake answers live.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import AtmosphericPanels from '../../../components/chameleon/AtmosphericPanels';

const AtelierQuickSummary = ({
  // Legacy props kept for backwards-compat signatures, no longer read:
  // eslint-disable-next-line no-unused-vars
  indications: _indications,
  journeyId,
  locale = 'it-IT',
  market,
}) => {
  return (
    <section className="atelier-summary atelier-summary--atmospheric" data-testid="atelier-summary">
      <header className="atelier-summary__head">
        <Sparkles size={14} strokeWidth={1.5} aria-hidden />
        <p className="atelier-summary__title" data-testid="atelier-summary-title">
          Quello che iniziamo a leggere
        </p>
      </header>

      {/* ITER168 · Atmospheric Panels — interpretation, not assertion. */}
      <AtmosphericPanels
        locale={locale}
        market={market}
        limit={3}
        eyebrow="Atmosfere in lettura"
      />

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
