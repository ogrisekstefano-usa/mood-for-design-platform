/**
 * AtelierReferenceCard · ITER162
 *
 * "Il tuo referente" — avatar + nome + ruolo + bio + CTA "Scrivi al
 * referente" + tempo medio di risposta. Tono relazionale, mai SaaS.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Clock } from 'lucide-react';

const AtelierReferenceCard = ({ referente }) => {
  if (!referente) {
    return (
      <div className="atelier-ref atelier-ref--pending" data-testid="atelier-reference-pending">
        <p className="atelier-ref__eyebrow">Il tuo referente</p>
        <p className="atelier-ref__pending">
          Lo studio sta scegliendo la persona di riferimento per il tuo
          percorso.
        </p>
      </div>
    );
  }

  const name = referente.name || `${referente.first_name || ''}`.trim() || 'Referente';
  const role = referente.role_label || 'Persona di riferimento';
  const bio  = referente.short_bio   ||
    'Sarà il tuo punto di riferimento\nper tutto il percorso progettuale.';
  const responseTime = referente.response_time_label || 'di solito entro poche ore';

  return (
    <section className="atelier-ref" data-testid="atelier-reference-card">
      <header className="atelier-ref__head">
        <p className="atelier-ref__eyebrow">Il tuo referente</p>
      </header>

      <div className="atelier-ref__body">
        {referente.avatar_url ? (
          <img
            src={referente.avatar_url}
            alt=""
            className="atelier-ref__avatar"
            loading="lazy"
            data-testid="atelier-reference-avatar"
          />
        ) : (
          <span className="atelier-ref__avatar atelier-ref__avatar--placeholder">
            {(referente.first_name || name || '·')[0]}
          </span>
        )}
        <p className="atelier-ref__name" data-testid="atelier-reference-name">
          {name}
        </p>
        <p className="atelier-ref__role" data-testid="atelier-reference-role">
          {role}
        </p>
        <p className="atelier-ref__bio">
          {bio.split('\n').map((l, i, a) => (
            <React.Fragment key={i}>
              {l}{i < a.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </p>

        <Link
          to="/client/messages"
          className="atelier-ref__cta"
          data-testid="atelier-reference-cta"
        >
          <MessageCircle size={14} strokeWidth={1.7} aria-hidden />
          <span>Scrivi al referente</span>
        </Link>
      </div>

      <div className="atelier-ref__divider" aria-hidden />

      <footer className="atelier-ref__foot" data-testid="atelier-reference-response">
        <span className="atelier-ref__foot-icon" aria-hidden>
          <Clock size={14} strokeWidth={1.4} />
        </span>
        <div>
          <p className="atelier-ref__foot-title">Tempo medio di risposta</p>
          <p className="atelier-ref__foot-sub">{responseTime}</p>
        </div>
      </footer>
    </section>
  );
};

export default AtelierReferenceCard;
