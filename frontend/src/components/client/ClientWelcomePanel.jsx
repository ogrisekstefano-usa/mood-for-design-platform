/**
 * ClientWelcomePanel · ITER161 · P0.2
 *
 * Prima schermata che vede il cliente dopo i 3 step di onboarding.
 * Lessico richiesto: spazio progettuale · referente · percorso · capitoli
 *                    · conversazione. MAI: dashboard · CRM · ticket.
 *
 * Mostra:
 *   • Benvenuto cinematico ("Benvenuta/o nel tuo spazio progettuale")
 *   • Studio che ti accompagna
 *   • Il tuo referente (foto + nome + ruolo)
 *   • Summary delle prime indicazioni (initial brief rationale)
 *   • 3 CTA: Continua il brief · Scrivi al tuo referente · Possiamo sentirci
 *   • Card discreta opzionale: "Crea password (opzionale)"
 *
 * Lo stato "dismissed" è persistito in localStorage; il pannello scompare
 * dopo che il cliente lo chiude o naviga oltre, ma resta richiamabile via
 * il bottone "Apri il benvenuto" sotto.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, MessageCircle, ArrowRight, KeyRound, X } from 'lucide-react';
import api from '../../lib/api';
import RecallRequestModal from './RecallRequestModal';
import CreatePasswordPanel from './CreatePasswordPanel';
import './clientWelcome.css';

const STORAGE_KEY = 'mfd_client_welcome_dismissed';

const ClientWelcomePanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
  });
  const [recallOpen, setRecallOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/api/client/welcome-summary')
      .then((r) => { if (alive) { setData(r.data); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  if (loading) return null;
  if (!data) return null;
  if (dismissed) {
    return (
      <button
        type="button"
        className="cw-reopen"
        onClick={() => {
          try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
          setDismissed(false);
        }}
        data-testid="client-welcome-reopen"
      >
        Apri il benvenuto
      </button>
    );
  }

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
    setDismissed(true);
  };

  const firstName = data.client?.first_name || '';
  const referente = data.referente;
  const summary = data.summary;
  const studio = data.studio_name;
  const nextStep = data.next_step;
  const journeyId = data.journey_id;

  return (
    <section className="cw-panel" data-testid="client-welcome-panel">
      <button
        type="button"
        className="cw-close"
        onClick={close}
        aria-label="Chiudi il benvenuto"
        data-testid="client-welcome-close"
      >
        <X size={16} strokeWidth={1.4} />
      </button>

      <p className="cw-eyebrow" data-testid="client-welcome-eyebrow">
        Il tuo spazio progettuale
      </p>
      <h1 className="cw-title" data-testid="client-welcome-title">
        <em>Benvenut{firstName.endsWith('a') ? 'a' : 'o'}, {firstName || 'a casa'}.</em>
      </h1>
      <p className="cw-lede" data-testid="client-welcome-lede">
        Le tue prime indicazioni sono al sicuro qui dentro. Da oggi il percorso
        prosegue insieme allo studio <em>{studio}</em>.
      </p>

      {/* Referente */}
      <div className="cw-row">
        <div className="cw-referente" data-testid="client-welcome-referente">
          <p className="cw-microlabel">Il tuo referente</p>
          {referente ? (
            <div className="cw-referente__card">
              {referente.avatar_url ? (
                <img
                  src={referente.avatar_url}
                  alt={referente.name}
                  className="cw-referente__avatar"
                  data-testid="client-welcome-referente-avatar"
                />
              ) : (
                <div className="cw-referente__avatar cw-referente__avatar--placeholder">
                  {(referente.first_name || referente.name || '·').slice(0, 1)}
                </div>
              )}
              <div className="cw-referente__body">
                <p className="cw-referente__name" data-testid="client-welcome-referente-name">
                  {referente.name}
                </p>
                <p className="cw-referente__role" data-testid="client-welcome-referente-role">
                  {referente.role_label}
                </p>
                {referente.short_bio && (
                  <p className="cw-referente__bio">{referente.short_bio}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="cw-referente__pending" data-testid="client-welcome-referente-pending">
              Lo studio sta scegliendo la persona di riferimento per il tuo percorso.
            </p>
          )}
        </div>
      </div>

      {/* Summary delle prime indicazioni */}
      {summary && (
        <div className="cw-summary" data-testid="client-welcome-summary">
          <p className="cw-microlabel">Le tue prime parole</p>
          <p className="cw-summary__body">{summary}</p>
        </div>
      )}

      {/* CTA editoriali */}
      <div className="cw-cta-row" data-testid="client-welcome-cta-row">
        {journeyId && (
          <Link
            to={`/client/journey/${journeyId}`}
            className="cw-cta cw-cta--primary"
            data-testid="client-welcome-cta-continue"
          >
            <span>
              {nextStep?.title
                ? `Continua · ${nextStep.title}`
                : 'Continua il brief'}
            </span>
            <ArrowRight size={16} strokeWidth={1.6} />
          </Link>
        )}
        <Link
          to="/client/messages"
          className="cw-cta cw-cta--secondary"
          data-testid="client-welcome-cta-message"
        >
          <MessageCircle size={16} strokeWidth={1.6} />
          <span>Scrivi al tuo referente</span>
        </Link>
        <button
          type="button"
          className="cw-cta cw-cta--secondary"
          onClick={() => setRecallOpen(true)}
          data-testid="client-welcome-cta-recall"
        >
          <Phone size={16} strokeWidth={1.6} />
          <span>Possiamo sentirci</span>
        </button>
      </div>

      {/* Card discreta · password opzionale */}
      <div className="cw-password" data-testid="client-welcome-password">
        <div>
          <p className="cw-microlabel">Accesso futuro</p>
          <p className="cw-password__lede">
            Vuoi rendere più semplice il prossimo accesso? Puoi creare una
            password — il magic link via email resta sempre disponibile.
          </p>
        </div>
        <button
          type="button"
          className="cw-password__btn"
          onClick={() => setPwOpen(true)}
          data-testid="client-welcome-password-btn"
        >
          <KeyRound size={14} strokeWidth={1.5} />
          <span>Crea password</span>
        </button>
      </div>

      {recallOpen && (
        <RecallRequestModal
          onClose={() => setRecallOpen(false)}
          journeyId={journeyId}
        />
      )}
      {pwOpen && <CreatePasswordPanel onClose={() => setPwOpen(false)} />}
    </section>
  );
};

export default ClientWelcomePanel;
