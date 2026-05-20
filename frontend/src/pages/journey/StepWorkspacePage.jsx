/**
 * StepWorkspacePage · Sprint G.6 — Step-Anchored Artifact Pages™.
 *
 * Route: /journey/:projectId/step/:milestoneType
 *
 * Il contesto precede l'artefatto. Questo è il workspace dello step:
 *   1. StepContextHeader™ — dove sono nel Journey
 *   2. Workspace specifico per il tipo di step (moodboard / material / …)
 *   3. ClientInteractionLayer™ — le voci sul capitolo
 *
 * NON è una migrazione di pagina. È la contestualizzazione definitiva
 * dell'artifact nel Design Journey™.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import StepContextHeader from '../../components/journey/StepContextHeader';
import ClientInteractionLayer from '../../components/journey/ClientInteractionLayer';
import MoodboardDirectionWorkspace from '../../components/journey/MoodboardDirectionWorkspace';
import MaterialDirectionWorkspace from '../../components/journey/MaterialDirectionWorkspace';
import VersionStack from '../../components/journey/VersionStack';
import './step-workspace.css';

// ── Generic fallback for steps we haven't given a custom body yet ─────
const GenericStepWorkspace = ({ context, artifacts, projectId }) => {
  const { step } = context;
  return (
    <div data-testid="sw-workspace-generic">
      <section className="sw-section" data-testid="sw-section-rationale">
        <div className="sw-section__head">
          <div>
            <p className="sw-section__eyebrow">Capitolo in corso</p>
            <h2 className="sw-section__title"><em>{step.title}</em></h2>
          </div>
        </div>
        {step.description && (
          <p style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: 'italic',
            fontSize: 17, lineHeight: 1.65, maxWidth: '64ch',
            color: 'color-mix(in srgb, var(--jo-text) 75%, transparent)',
          }}>
            {step.description}
          </p>
        )}
      </section>

      <section className="sw-section" data-testid="sw-section-versions">
        <div className="sw-section__head">
          <div>
            <p className="sw-section__eyebrow">Capitoli registrati</p>
            <h2 className="sw-section__title"><em>Le tracce di questo passaggio</em></h2>
          </div>
          <span className="sw-section__count">
            {artifacts?.length || 0} {artifacts?.length === 1 ? 'capitolo' : 'capitoli'}
          </span>
        </div>
        <VersionStack
          artifacts={artifacts}
          projectId={projectId}
          emptyHint="Quando questo capitolo prenderà forma, le sue tracce compariranno qui."
        />
      </section>
    </div>
  );
};

// ── Workspace router (no DOM router — switch by milestone type) ─────
const WORKSPACE_BY_TYPE = {
  moodboard_direction: MoodboardDirectionWorkspace,
  material_direction:  MaterialDirectionWorkspace,
};

const StepWorkspacePage = () => {
  const { projectId, milestoneType } = useParams();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true); setError(null);
    api.get(`/api/journey/projects/${projectId}/steps/${milestoneType}`)
      .then((r) => { if (!cancel) setData(r.data); })
      .catch((e) => {
        if (cancel) return;
        const msg = e?.response?.data?.detail
          || 'Non riesco ad aprire questo capitolo del Journey.';
        setError(msg);
      })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [projectId, milestoneType]);

  if (loading) {
    return (
      <div className="sw-shell sw-shell--loading" data-testid="sw-loading">
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic', fontSize: 18,
          color: 'color-mix(in srgb, var(--jo-text) 55%, transparent)',
        }}>
          Sto preparando il capitolo…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sw-shell sw-shell--error" data-testid="sw-error">
        <h3 style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic', fontSize: 22, margin: 0,
        }}>
          Questo capitolo è in attesa
        </h3>
        <p style={{ fontSize: 13, color: 'var(--jo-text-soft, #c8c2b3)' }}>
          {error || 'Capitolo non disponibile.'}
        </p>
      </div>
    );
  }

  const { context, artifacts, voices } = data;
  const Workspace = WORKSPACE_BY_TYPE[milestoneType] || GenericStepWorkspace;

  return (
    <div className="sw-shell" data-testid="step-workspace-page">
      <StepContextHeader context={context} projectId={projectId} />

      <Workspace
        context={context}
        artifacts={artifacts}
        voices={voices}
        projectId={projectId}
      />

      <ClientInteractionLayer
        stepId={context.step.id}
        voices={voices}
        milestoneType={milestoneType}
        projectId={projectId}
      />
    </div>
  );
};

export default StepWorkspacePage;
