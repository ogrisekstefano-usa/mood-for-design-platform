/**
 * JourneyWelcomePage · Sprint G.2
 * Read-only welcome surface mostrata appena dopo il submit del rituale.
 * Accesso pubblico via welcome_token.
 *
 * FASE 1+2 · Journey Welcome Completion (Feb 2026):
 *   - Aggiunto fetch companion (/api/public/journeys/welcome/{token}/companion)
 *   - CTA "Accedi al tuo Atelier™" → /access
 *   - CTA "Visualizza le Direzioni™" → /journey/:jid/concepts (se condivise)
 *   - Sezione Direzioni inline (no auth) quando has_directions=true
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import '../../styles/begin-journey.css';
import { useT } from '../../i18n/useT';
const API = process.env.REACT_APP_BACKEND_URL;
const AMBIANCE_LABEL = {
  warm_enveloping: 'caldi e avvolgenti',
  sober_minimal: 'sobri e minimali',
  luminous_airy: 'luminosi e arieggiati',
  tactile_sensory: 'materici e sensoriali',
  cinematic: 'cinematici'
};
const GUESTS_LABEL = {
  often: 'ricevi ospiti spesso',
  sometimes: 'qualche volta accogli ospiti',
  rarely: 'raramente ospiti',
  alone: 'vivi lo spazio in solitudine'
};
const JourneyWelcomePage = () => {
  const { t } = useT();
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [companion, setCompanion] = useState(null);

  // Fetch main welcome data
  useEffect(() => {
    let cancel = false;
    axios.get(`${API}/api/public/journeys/welcome/${token}`).then(r => {
      if (!cancel) setData(r.data);
    }).catch(() => {
      if (!cancel) setErr(true);
    });
    return () => { cancel = true; };
  }, [token]);

  // Fetch companion data (non-blocking — directions, next action)
  useEffect(() => {
    let cancel = false;
    axios.get(`${API}/api/public/journeys/welcome/${token}/companion`).then(r => {
      if (!cancel) setCompanion(r.data);
    }).catch(() => { /* companion è non-bloccante */ });
    return () => { cancel = true; };
  }, [token]);
  if (err) {
    return <div className="jw-shell" data-testid="welcome-error">
        <div className="jw-container">
          <div className="jw-eyebrow">Welcome non trovato</div>
          <h1 className="jw-hero">{t('site.journey_welcome.questo_link_non_e_piu_disponibile')}</h1>
          <p className="jw-intro">
            {t("site.journey_welcome.forse_il_viaggio_e_stato_gia_archiviato_o_il_link")}
          </p>
        </div>
      </div>;
  }
  if (!data) {
    return <div className="jw-shell" data-testid="welcome-loading">
        <div className="jw-container">
          <div className="jw-eyebrow">{t('site.journey_welcome.aprendo_il_tuo_design_journey')}</div>
        </div>
      </div>;
  }
  const {
    first_name,
    atmosphere = {},
    lifestyle = {},
    journey,
    studio_name
  } = data;
  const chap = journey?.first_chapter;
  const journeyId = journey?.id || companion?.journey_id;
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const hasDirections = companion?.has_directions && (companion?.concept_directions?.length > 0);
  const directions = companion?.concept_directions || [];
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiato. Custodiscilo — è la porta del tuo Journey.');
    } catch {
      toast('Non riesco a copiare automaticamente. Selezionalo a mano.');
    }
  };
  return <div className="jw-shell" data-testid="welcome-page">
      <div className="jw-container">
        <div className="jw-eyebrow" data-testid="welcome-eyebrow">
          {t("site.journey_welcome.il_tuo_design_journey_e_iniziato")}
        </div>
        <h1 className="jw-hero" data-testid="welcome-hero">
          Benvenut{first_name?.endsWith('a') ? 'a' : 'o'}, {first_name}.
        </h1>
        <p className="jw-intro">
          {t("site.journey_welcome.questo_e_il_tuo_design_journey_tutto_cio_che_condi")}
          {studio_name && <><br />{t("site.journey_welcome.lo_studio_che_ti_accompagna")} <em>{studio_name}</em>.</>}
        </p>

        {/* ── CTA Principal — sempre visibile ───────────────────────── */}
        <div className="jw-cta-panel" data-testid="welcome-cta-panel">
          <Link to="/access" className="jw-cta-btn jw-cta-btn--primary" data-testid="welcome-cta-atelier">
            Accedi al tuo Atelier™
          </Link>
          {hasDirections && journeyId && (
            <Link
              to={`/journey/${journeyId}/concepts`}
              className="jw-cta-btn jw-cta-btn--secondary"
              data-testid="welcome-cta-directions"
            >
              Visualizza le Direzioni™
              {directions.length > 0 && (
                <span className="jw-cta-count">{directions.length} {directions.length === 1 ? 'direzione' : 'direzioni'}</span>
              )}
            </Link>
          )}
        </div>

        {/* ── Direzioni condivise (se disponibili) ──────────────────── */}
        {hasDirections && (
          <div className="jw-card jw-card--directions" data-testid="welcome-directions-section">
            <div className="jw-card__eyebrow">Direzioni progettuali condivise</div>
            <div className="jw-card__title">
              {studio_name || 'Il tuo studio'} ha condiviso {directions.length} {directions.length === 1 ? 'direzione' : 'direzioni'} con te.
            </div>
            <div className="jw-directions-grid">
              {directions.map((d, i) => (
                <div key={d.id || i} className="jw-direction-item" data-testid={`welcome-direction-${i}`}>
                  {d.cover_url && (
                    <div className="jw-direction-cover" style={{ backgroundImage: `url(${d.cover_url})` }} />
                  )}
                  <div className="jw-direction-meta">
                    <span className="jw-direction-set">{d.set_label || 'Direction Set'}</span>
                    <span className="jw-direction-name">{d.title || 'Direzione progettuale'}</span>
                  </div>
                </div>
              ))}
            </div>
            {journeyId && (
              <div className="jw-card__body" style={{ marginTop: '24px' }}>
                <Link to={`/journey/${journeyId}/concepts`} className="jw-cta-btn jw-cta-btn--ghost" data-testid="welcome-directions-open">
                  Apri e rispondi alle direzioni →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Reflected atmosphere */}
        <div className="jw-card" data-testid="welcome-atmosphere">
          <div className="jw-card__eyebrow">{t('site.journey_welcome.l_atmosfera_che_cerchi')}</div>
          <div className="jw-card__body">
            {atmosphere.how_to_feel && <p>{atmosphere.how_to_feel}</p>}
            {atmosphere.references && <p><strong>Riferimenti che ami · </strong>{atmosphere.references}</p>}
            {lifestyle.ambiance && <p><strong>{t("site.journey_welcome.il_modo_in_cui_vivi")} </strong>
                 ambienti {AMBIANCE_LABEL[lifestyle.ambiance] || lifestyle.ambiance}
                 {lifestyle.guests && <>, {GUESTS_LABEL[lifestyle.guests] || lifestyle.guests}</>}.
              </p>}
            {Array.isArray(lifestyle.materials) && lifestyle.materials.length > 0 && <p><strong>Materie che ti fanno stare bene · </strong>{lifestyle.materials.join(', ')}.</p>}
          </div>
        </div>

        {/* First chapter */}
        {chap && <div className="jw-card" data-testid="welcome-first-chapter">
            <div className="jw-card__eyebrow">{t('site.journey_welcome.capitolo_primo_brief_cliente')}</div>
            <div className="jw-card__title">{chap.title || 'Direzione iniziale'}</div>
            <div className="jw-card__body">
              <p>{chap.rationale}</p>
            </div>
          </div>}

        {/* Footer */}
        <div className="jw-footer">
          <p className="jw-footer__copy" data-testid="welcome-footer-copy">
            {t("site.journey_welcome.salva_questo_link_e_la_porta_del_tuo_design_journe")}
          </p>
          <div className="jw-footer__link-wrap" data-testid="welcome-link-wrap">
            <span style={{
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
              {url}
            </span>
            <button className="jw-footer__btn" onClick={copyLink} data-testid="welcome-copy-btn">
              Copia
            </button>
          </div>
        </div>
      </div>
    </div>;
};
export default JourneyWelcomePage;