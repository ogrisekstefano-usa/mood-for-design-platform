/**
 * AtelierQuickSummary · ITER172 · text-only by default
 *
 * Behaviour after the Client Design Journey™ V1 consolidation:
 *   - default `mode="text-only"` renders the 4 reading cards using
 *     ONLY editorial text derived from the client's actual intake
 *     (`atmosphere`, `lifestyle`, `priority`). No stock photography,
 *     no AtmosphericPanels images obbligatorie.
 *   - `mode="atmospheric"` re-enables the Chameleon™ image deck:
 *     reserved for journeys with REAL moodboards / materials /
 *     uploaded references. The studio team can flip this when actual
 *     content exists.
 *
 * Source of truth: `viewModel.indications` (built by atelierViewModel.js
 * from `/api/client/welcome-summary`). The `indications` prop is now
 * read again (previously ignored in ITER168) because text-only mode
 * needs the per-card editorial copy.
 *
 * Link "Vedi tutti i dettagli del tuo brief" routes to the Brief
 * Guidato™ canonical page `/journey/:jid/brief`.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Home as HomeIcon, Leaf, Shield } from 'lucide-react';
import AtmosphericPanels from '../../../components/chameleon/AtmosphericPanels';

const ICON_LIB = {
  sparkles: Sparkles,
  home:     HomeIcon,
  leaf:     Leaf,
  shield:   Shield,
};

const SummaryCard = ({ indication }) => {
  const Icon = ICON_LIB[indication.icon] || Sparkles;
  return (
    <article
      className="atelier-card"
      data-testid={`atelier-summary-card-${indication.id}`}
    >
      <header className="atelier-card__head">
        <span className="atelier-card__icon" aria-hidden>
          <Icon size={14} strokeWidth={1.5} />
        </span>
        <p className="atelier-card__label">{indication.label}</p>
      </header>
      <h4 className="atelier-card__title">{indication.title}</h4>
      {indication.body && (
        <p className="atelier-card__body">
          {indication.body.split('\n').map((ln, i, arr) => (
            <React.Fragment key={i}>
              {ln}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      )}
    </article>
  );
};

const AtelierQuickSummary = ({
  indications,
  journeyId,
  locale = 'it-IT',
  market,
  mode = 'text-only',  // ITER172 · default: no stock images
}) => {
  const briefHref = journeyId ? `/journey/${journeyId}/brief` : '/client';

  return (
    <section className="atelier-summary atelier-summary--text" data-testid="atelier-summary">
      <header className="atelier-summary__head">
        <Sparkles size={14} strokeWidth={1.5} aria-hidden />
        <p className="atelier-summary__title" data-testid="atelier-summary-title">
          Quello che iniziamo a leggere
        </p>
      </header>

      {mode === 'atmospheric' ? (
        /* Opt-in path: real moodboards/materials present. */
        <AtmosphericPanels
          locale={locale}
          market={market}
          limit={3}
          eyebrow="Atmosfere in lettura"
        />
      ) : (
        /* Default: editorial text-only — comes from client's own intake. */
        <div className="atelier-summary__grid" data-testid="atelier-summary-grid">
          {(indications || []).map((ind) => (
            <SummaryCard key={ind.id} indication={ind} />
          ))}
        </div>
      )}

      <Link
        to={briefHref}
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
