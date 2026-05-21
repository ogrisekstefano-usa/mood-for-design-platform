/**
 * ClientInteractionLayer™ · Sprint G.6
 *
 * Lo spazio in cui il cliente lascia la propria voce sullo step.
 * NO comment box generica. È una cerimonia di voce curatoriale.
 *
 * Quattro gesti possibili:
 *   · Lascia una voce      (commento narrativo)
 *   · Approva la direzione (decisione progettuale)
 *   · Chiedi una revisione (riapri la conversazione)
 *   · Carica una alternativa (Pinterest link, immagine, riferimento)
 *
 * Le voci esistenti vengono renderizzate sotto come "registro curatoriale".
 *
 * NOTA: in questo sprint i quattro gesti sono UI scaffold — la persistenza
 * vive già in Milestone Dialogue (Sprint F.B) e verrà cucita in G.7.
 */
import React from 'react';
import * as Icons from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/useT';

const TONE_TO_BAR = {
  embrace:   '',
  curious:   '',
  reorient:  'sw-voice__bar--amber',
  voice:     'sw-voice__bar--gold',
  approve:   'sw-voice__bar--gold',
  decision:  'sw-voice__bar--gold',
  revision:  'sw-voice__bar--amber',
};

const ClientInteractionLayer = ({ stepId, voices, milestoneType, projectId }) => {
  const { t } = useT();
  const list = voices || [];

  return (
    <section className="sw-cil" data-testid="sw-cil">
      <header className="sw-cil__head">
        <p className="sw-context__eyebrow" style={{ color: 'var(--jo-cool, #6db5b0)' }}>
          Voci sul capitolo
        </p>
        <h3 className="sw-section__title" style={{ marginTop: 6 }}>
          La conversazione su <em>{t('journey.client_interaction_layer.questa_direzione')}</em>
        </h3>
      </header>

      <div className="sw-cil__actions" data-testid="sw-cil-actions">
        <Link
          to={`/workspace/projects/${projectId}#milestone=${stepId}`}
          className="sw-cil__btn sw-cil__btn--primary"
          data-testid="sw-cil-leave-voice"
        >
          <Icons.MessageSquareQuote size={14} style={{ marginRight: 8 }} />
          Lascia una voce
        </Link>
        <Link
          to={`/workspace/projects/${projectId}#milestone=${stepId}&intent=approve`}
          className="sw-cil__btn"
          data-testid="sw-cil-approve"
        >
          <Icons.CheckCircle2 size={14} style={{ marginRight: 8 }} />
          Approva la direzione
        </Link>
        <Link
          to={`/workspace/projects/${projectId}#milestone=${stepId}&intent=revise`}
          className="sw-cil__btn"
          data-testid="sw-cil-revise"
        >
          <Icons.RotateCcw size={14} style={{ marginRight: 8 }} />
          Chiedi una revisione
        </Link>
        <Link
          to={`/workspace/projects/${projectId}#milestone=${stepId}&intent=alternative`}
          className="sw-cil__btn"
          data-testid="sw-cil-alternative"
        >
          <Icons.Sparkles size={14} style={{ marginRight: 8 }} />
          Carica una alternativa
        </Link>
      </div>

      <div className="sw-cil__voices" data-testid="sw-cil-voices">
        {list.length === 0 ? (
          <p className="sw-cil__empty">
            Nessuna voce è stata ancora lasciata su questo capitolo. <br />
            La conversazione attende.
          </p>
        ) : (
          list.map((v) => {
            const tone = TONE_TO_BAR[v.tone] !== undefined ? TONE_TO_BAR[v.tone] : '';
            return (
              <article key={v.id} className="sw-voice" data-testid={`sw-voice-${v.id}`}>
                <span className={`sw-voice__bar ${tone}`} />
                <div className="sw-voice__body">
                  <p className="sw-voice__author">
                    {v.author_name || 'Voce del cliente'}
                    {v.voice_type && <> · {v.voice_type}</>}
                  </p>
                  <p className="sw-voice__msg">{v.message}</p>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};

export default ClientInteractionLayer;
