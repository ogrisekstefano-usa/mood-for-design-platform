/**
 * JourneyWelcomePage · Sprint G.2
 * Read-only welcome surface mostrata appena dopo il submit del rituale.
 * Accesso pubblico via welcome_token.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import '../../styles/begin-journey.css';

const API = process.env.REACT_APP_BACKEND_URL;

const AMBIANCE_LABEL = {
  warm_enveloping: 'caldi e avvolgenti',
  sober_minimal:   'sobri e minimali',
  luminous_airy:   'luminosi e arieggiati',
  tactile_sensory: 'materici e sensoriali',
  cinematic:       'cinematici',
};
const GUESTS_LABEL = {
  often:     'ricevi ospiti spesso',
  sometimes: 'qualche volta accogli ospiti',
  rarely:    'raramente ospiti',
  alone:     'vivi lo spazio in solitudine',
};

const JourneyWelcomePage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    let cancel = false;
    axios.get(`${API}/api/public/journeys/welcome/${token}`)
      .then((r) => { if (!cancel) setData(r.data); })
      .catch(() => { if (!cancel) setErr(true); });
    return () => { cancel = true; };
  }, [token]);

  if (err) {
    return (
      <div className="jw-shell" data-testid="welcome-error">
        <div className="jw-container">
          <div className="jw-eyebrow">Welcome non trovato</div>
          <h1 className="jw-hero">Questo link non è più disponibile.</h1>
          <p className="jw-intro">
            Forse il viaggio è stato già archiviato — o il link è stato modificato.
            Scrivi allo studio per ritrovarlo.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="jw-shell" data-testid="welcome-loading">
        <div className="jw-container">
          <div className="jw-eyebrow">Aprendo il tuo Design Journey…</div>
        </div>
      </div>
    );
  }

  const { first_name, atmosphere = {}, lifestyle = {}, journey, studio_name } = data;
  const chap = journey?.first_chapter;
  const url  = typeof window !== 'undefined' ? window.location.href : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiato. Custodiscilo — è la porta del tuo Journey.');
    } catch {
      toast('Non riesco a copiare automaticamente. Selezionalo a mano.');
    }
  };

  return (
    <div className="jw-shell" data-testid="welcome-page">
      <div className="jw-container">
        <div className="jw-eyebrow" data-testid="welcome-eyebrow">
          Il tuo Design Journey™ · è iniziato
        </div>
        <h1 className="jw-hero" data-testid="welcome-hero">
          Benvenut{first_name?.endsWith('a') ? 'a' : 'o'}, {first_name}.
        </h1>
        <p className="jw-intro">
          Questo è il tuo Design Journey™. Tutto ciò che condivideremo da qui in
          avanti vivrà in questo spazio — capitoli, atmosfere, conversazioni.
          {studio_name && (<><br/>Lo studio che ti accompagna: <em>{studio_name}</em>.</>)}
        </p>

        {/* Reflected atmosphere */}
        <div className="jw-card" data-testid="welcome-atmosphere">
          <div className="jw-card__eyebrow">L'atmosfera che cerchi</div>
          <div className="jw-card__body">
            {atmosphere.how_to_feel && (<p>{atmosphere.how_to_feel}</p>)}
            {atmosphere.references && (<p><strong>Riferimenti che ami · </strong>{atmosphere.references}</p>)}
            {lifestyle.ambiance && (
              <p><strong>Il modo in cui vivi · </strong>
                 ambienti {AMBIANCE_LABEL[lifestyle.ambiance] || lifestyle.ambiance}
                 {lifestyle.guests && (<>, {GUESTS_LABEL[lifestyle.guests] || lifestyle.guests}</>)}.
              </p>
            )}
            {Array.isArray(lifestyle.materials) && lifestyle.materials.length > 0 && (
              <p><strong>Materie che ti fanno stare bene · </strong>{lifestyle.materials.join(', ')}.</p>
            )}
          </div>
        </div>

        {/* First chapter */}
        {chap && (
          <div className="jw-card" data-testid="welcome-first-chapter">
            <div className="jw-card__eyebrow">Capitolo primo · Brief Cliente</div>
            <div className="jw-card__title">{chap.title || 'Direzione iniziale'}</div>
            <div className="jw-card__body">
              <p>{chap.rationale}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="jw-footer">
          <p className="jw-footer__copy" data-testid="welcome-footer-copy">
            Salva questo link — è la porta del tuo Design Journey.
            Lo studio ti scriverà presto sulla mail che hai condiviso.
          </p>
          <div className="jw-footer__link-wrap" data-testid="welcome-link-wrap">
            <span style={{maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              {url}
            </span>
            <button className="jw-footer__btn" onClick={copyLink} data-testid="welcome-copy-btn">
              Copia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JourneyWelcomePage;
