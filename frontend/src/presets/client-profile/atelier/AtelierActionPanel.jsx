/**
 * AtelierActionPanel · ITER162
 *
 * "Cosa vuoi fare ora?" — 3 azioni relazionali su sfondo cream/sand:
 *   1. Continua il brief guidato
 *   2. Scrivi al tuo referente
 *   3. Possiamo sentirci?
 *
 * Mai usare lessico SaaS (Open Ticket / Create Request).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, MessageSquare, Calendar, ChevronRight } from 'lucide-react';

const AtelierActionPanel = ({ journeyId, onRecallClick }) => {
  return (
    <section className="atelier-actions" data-testid="atelier-action-panel">
      <h3 className="atelier-actions__title" data-testid="atelier-action-title">
        Cosa vuoi fare ora?
      </h3>

      <Link
        to={journeyId ? `/client/journey/${journeyId}` : '/client'}
        className="atelier-action"
        data-testid="atelier-action-continue"
      >
        <span className="atelier-action__icon" aria-hidden>
          <Sparkles size={16} strokeWidth={1.5} />
        </span>
        <span className="atelier-action__body">
          <span className="atelier-action__label">Continua il brief guidato</span>
          <span className="atelier-action__sub">
            Approfondiamo insieme esigenze, preferenze e obiettivi del progetto.
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.4} className="atelier-action__chev" aria-hidden />
      </Link>

      <Link
        to="/client/messages"
        className="atelier-action"
        data-testid="atelier-action-message"
      >
        <span className="atelier-action__icon" aria-hidden>
          <MessageSquare size={16} strokeWidth={1.5} />
        </span>
        <span className="atelier-action__body">
          <span className="atelier-action__label">Scrivi al tuo referente</span>
          <span className="atelier-action__sub">
            Condividi idee, domande o ispirazioni.
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.4} className="atelier-action__chev" aria-hidden />
      </Link>

      <button
        type="button"
        onClick={onRecallClick}
        className="atelier-action atelier-action--button"
        data-testid="atelier-action-recall"
      >
        <span className="atelier-action__icon" aria-hidden>
          <Calendar size={16} strokeWidth={1.5} />
        </span>
        <span className="atelier-action__body">
          <span className="atelier-action__label">Possiamo sentirci?</span>
          <span className="atelier-action__sub">
            Richiedi un momento di confronto telefonico o in video call.
          </span>
        </span>
        <ChevronRight size={16} strokeWidth={1.4} className="atelier-action__chev" aria-hidden />
      </button>
    </section>
  );
};

export default AtelierActionPanel;
