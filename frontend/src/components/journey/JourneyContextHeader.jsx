/**
 * JourneyContextHeader — Journey Continuity™ thin layer.
 *
 * Strip elegante, quasi invisibile, montata in cima ai moduli satellite
 * (Moodboards, Materials, Documents, Render). Risolve il contesto del
 * Design Journey™ via /api/journeys/context/by-entity e mostra:
 *
 *   Stai attraversando
 *   {Project Name}
 *   {Milestone Title} · {Editorial Status}
 *
 * Quando il modulo non è collegato a una milestone (es. moodboard
 * orfano), la strip non si renderizza — mai fallback enterprise.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MoveRight } from 'lucide-react';
import api from '../../lib/api';
import './journey-context.css';

const STATUS_LABEL = {
  not_started:        'Non iniziata',
  in_progress:        'In lavorazione',
  presented:          'Presentata',
  revision_requested: 'Revisione richiesta',
  partially_approved: 'Approvata parzialmente',
  approved:           'Approvata',
  closed:             'Chiusa',
};

const STATUS_TONE = {
  not_started:        'muted',
  in_progress:        'warm',
  presented:          'cyan',
  revision_requested: 'amber',
  partially_approved: 'cyan',
  approved:           'success',
  closed:             'closed',
};

const JourneyContextHeader = ({ entityType, entityId, compact = false }) => {
  const [ctx, setCtx] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!entityType || !entityId) return;
    let cancelled = false;
    api.get('/api/journeys/context/by-entity', {
      params: { entity_type: entityType, entity_id: entityId },
    })
      .then((r) => { if (!cancelled) setCtx(r.data); })
      .catch(() => { if (!cancelled) setCtx({ linked: false }); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  if (!loaded || !ctx || !ctx.linked || !ctx.milestone || !ctx.project) {
    return null;
  }

  const { project, milestone } = ctx;
  const statusLabel = STATUS_LABEL[milestone.status] || milestone.status;
  const tone = STATUS_TONE[milestone.status] || 'muted';

  return (
    <div
      className={`jch ${compact ? 'jch--compact' : ''}`}
      data-testid="journey-context-header"
    >
      <div className="jch__inner">
        <span className="jch__lead">Stai attraversando</span>
        <span className="jch__sep" aria-hidden="true">·</span>
        <Link
          to={`/workspace/projects/${project.id}`}
          className="jch__project"
          data-testid="jch-project-link"
        >
          {project.title}
        </Link>
        <MoveRight size={11} className="jch__arrow" strokeWidth={1.4} aria-hidden="true" />
        <span className="jch__milestone" data-testid="jch-milestone-title">
          {milestone.title}
        </span>
        <span className={`jch__status jch__status--${tone}`} data-testid="jch-milestone-status">
          {statusLabel}
        </span>
        <Link
          to={`/workspace/projects/${project.id}`}
          className="jch__back"
          data-testid="jch-back-to-journey"
          title="Torna al Design Journey™"
        >
          <ArrowUpRight size={11} strokeWidth={1.4} />
          <span>Design Journey™</span>
        </Link>
      </div>
    </div>
  );
};

export default JourneyContextHeader;
