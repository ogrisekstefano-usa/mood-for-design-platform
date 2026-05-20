/**
 * VersionStack™ · Sprint G.6
 *
 * Le varie versioni dell'artifact dello step, raccontate come
 * "capitoli progettuali" — MAI come "V1/V2".
 *
 * Mostra una griglia editoriale di "capitoli". Click → apre l'artifact
 * (canvas / detail) MANTENENDO il contesto del Journey.
 *
 * NON è file manager. È libreria narrativa.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

const STATE_LABEL = {
  draft:               'Bozza interna',
  shared:              'Condivisa con il cliente',
  approved:            'Approvata',
  approved_with_notes: 'Approvata con note',
  revision_requested:  'Cliente ha chiesto una revisione',
  declined:            'Non scelta',
  archived:            'Archiviata',
  selected:            'Selezionato',
  rejected:            'Scartato',
  in_progress:         'In lavorazione',
  presented:           'Presentata',
};

const VersionStack = ({ artifacts, projectId, emptyHint, onAddVersion }) => {
  const navigate = useNavigate();
  const items = artifacts || [];

  if (items.length === 0) {
    return (
      <div className="sw-empty" data-testid="sw-versions-empty">
        <h4 className="sw-empty__title">Ancora nessun capitolo</h4>
        <p className="sw-empty__lede">
          {emptyHint || "Quando aprirai una direzione per questo passaggio, comparirà qui come capitolo progettuale."}
        </p>
        {onAddVersion && (
          <button
            type="button"
            className="sw-empty__cta"
            onClick={onAddVersion}
            data-testid="sw-versions-add"
          >
            Apri il primo capitolo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="sw-versions" data-testid="sw-version-stack">
      {items.map((a) => {
        const stateLbl = STATE_LABEL[a.approval_state] || a.approval_state || '—';
        const cover = a.cover_url;
        const route = a.open_route || (a.artifact_type === 'moodboard'
                        ? `/moodboards/${a.artifact_id}`
                        : null);
        const handleClick = () => {
          if (!route) return;
          const sep = route.includes('?') ? '&' : '?';
          navigate(`${route}${sep}project=${projectId}&from=journey-step`);
        };
        return (
          <button
            key={a.artifact_id}
            type="button"
            className="sw-version"
            onClick={handleClick}
            data-testid={`sw-version-${a.artifact_id}`}
            style={{ textAlign: 'left', cursor: route ? 'pointer' : 'default' }}
          >
            <div
              className="sw-version__cover"
              style={cover ? { backgroundImage: `url(${cover})` } : {}}
            >
              <span className="sw-version__chapter">{a.chapter_label}</span>
              {!cover && <div className="sw-version__cover-empty">·</div>}
            </div>
            <div className="sw-version__body">
              <h5 className="sw-version__title">{a.title}</h5>
              <p className="sw-version__state">{stateLbl}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default VersionStack;
