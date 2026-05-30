/**
 * JourneyCanonicalRoutes.jsx — ITER168 Phase 2
 *
 * Wrapper components che rendono canoniche le nuove URL journey-keyed
 * SENZA toccare le UI esistenti. Solo plumbing di rotte + silent redirect.
 *
 * Canonical (NEW):
 *   /journey/:journeyId              → CLIENT Profile (ClientCompanionPage)
 *   /studio/journey/:jid             → Studio Workspace (ProjectDetailPage)
 *   /studio/journey/:jid/step/:m     → Step workspace (StepWorkspacePage)
 *   /studio/pulse                    → Sala regia (JourneyPulsePage)
 *
 * Legacy redirects (silent — no UI hint, no "deprecated" warning):
 *   /client/welcome                  → /journey/:jid (resolve via /api/journeys/mine)
 *   /client/journey/:journeyId       → /journey/:journeyId (rename)
 *   /workspace/projects/:id          → /studio/journey/:jid (resolve via project_id)
 *   /journey/:projectId/step/:m      → /studio/journey/:jid/step/:m (resolve)
 *   /dashboard/pulse                 → /studio/pulse
 */
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import api from '../lib/api';
import CinematicLoader from '../components/CinematicLoader';

// Lazy-load the existing pages we will mount under the new canonical paths
const ProjectDetailPage          = lazy(() => import('../pages/workspace/ProjectDetailPage'));
const StepWorkspacePage          = lazy(() => import('../pages/journey/StepWorkspacePage'));
// ITER172 · Gen 3 (Atelier) promoted to V1 — /journey/:jid renders the Atelier
// preset (via ClientWelcomePresetPage) instead of the Gen 2 narrative companion.
// ClientCompanionPage source kept on disk (marker `ITER172 · FROZEN`), no route
// mounts it anymore. Restore: swap the lazy import below.
const ClientWelcomePresetPage    = lazy(() => import('../pages/client/ClientWelcomePresetPage'));
// const ClientCompanionPage     = lazy(() => import('../pages/client/ClientCompanionPage')); // FROZEN — Gen 2

const Loader = () => (
  <div style={{
    minHeight: '60vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--bp-bg, #050608)',
  }}>
    <CinematicLoader variant="centered" testid="journey-canonical-loader" />
  </div>
);


/* ════════════════════════════════════════════════════════════════════
 * 1 · /studio/journey/:jid · STUDIO workspace canonical
 * ════════════════════════════════════════════════════════════════════ */
export const StudioJourneyView = () => {
  const { jid } = useParams();
  const [projectId, setProjectId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    setProjectId(null); setError(null);
    api.get(`/api/journeys/${jid}/overview`)
      .then((r) => {
        if (cancel) return;
        const pid = r.data?.journey?.project_id;
        if (!pid) setError('no_project_id');
        else setProjectId(pid);
      })
      .catch((e) => { if (!cancel) setError(e?.response?.status === 404 ? 'not_found' : 'error'); });
    return () => { cancel = true; };
  }, [jid]);

  if (error === 'not_found') return <Navigate to="/dashboard" replace />;
  if (error)                  return <Navigate to="/dashboard" replace />;
  if (!projectId)             return <Loader />;
  return (
    <Suspense fallback={<Loader />}>
      <ProjectDetailPage projectIdOverride={projectId} />
    </Suspense>
  );
};


/* ════════════════════════════════════════════════════════════════════
 * 2 · /studio/journey/:jid/step/:milestoneType · STUDIO step canonical
 * ════════════════════════════════════════════════════════════════════ */
export const StudioJourneyStepView = () => {
  const { jid } = useParams();
  const [projectId, setProjectId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    setProjectId(null); setError(null);
    api.get(`/api/journeys/${jid}/overview`)
      .then((r) => {
        if (cancel) return;
        const pid = r.data?.journey?.project_id;
        if (!pid) setError('no_project_id');
        else setProjectId(pid);
      })
      .catch(() => { if (!cancel) setError('error'); });
    return () => { cancel = true; };
  }, [jid]);

  if (error)      return <Navigate to="/dashboard" replace />;
  if (!projectId) return <Loader />;
  return (
    <Suspense fallback={<Loader />}>
      <StepWorkspacePage projectIdOverride={projectId} />
    </Suspense>
  );
};


/* ════════════════════════════════════════════════════════════════════
 * 3 · /journey/:journeyId · CLIENT Design Journey™ V1 (Atelier · Gen 3)
 *
 * ITER172 · Gen 3 (AtelierWelcomePanel) is the canonical V1.
 * Previously rendered ClientCompanionPage (Gen 2). Gen 2 is FROZEN.
 * ════════════════════════════════════════════════════════════════════ */
export const CanonicalClientJourney = () => (
  <Suspense fallback={<Loader />}>
    <ClientWelcomePresetPage />
  </Suspense>
);


/* ════════════════════════════════════════════════════════════════════
 * 4 · /workspace/projects/:id → /studio/journey/:jid (silent redirect)
 * ════════════════════════════════════════════════════════════════════ */
export const ProjectToJourneyRedirect = () => {
  const { id } = useParams();
  const [target, setTarget] = useState(null);
  const [error, setError]   = useState(false);

  useEffect(() => {
    let cancel = false;
    api.get(`/api/journeys/resolve?project_id=${id}`)
      .then((r) => {
        if (cancel) return;
        if (r.data?.linked && r.data?.journey_id) {
          setTarget(`/studio/journey/${r.data.journey_id}`);
        } else {
          // No journey for this project: fall back to legacy view
          setTarget(`/workspace/projects/${id}?_legacy=1`);
        }
      })
      .catch(() => { if (!cancel) setError(true); });
    return () => { cancel = true; };
  }, [id]);

  if (error)  return <Navigate to="/dashboard" replace />;
  if (!target) return <Loader />;
  return <Navigate to={target} replace />;
};


/* ════════════════════════════════════════════════════════════════════
 * 5 · /journey/:projectId/step/:m → /studio/journey/:jid/step/:m
 * ════════════════════════════════════════════════════════════════════ */
export const LegacyStepRedirect = () => {
  const { projectId, milestoneType } = useParams();
  const [target, setTarget] = useState(null);
  const [error, setError]   = useState(false);

  useEffect(() => {
    let cancel = false;
    api.get(`/api/journeys/resolve?project_id=${projectId}`)
      .then((r) => {
        if (cancel) return;
        if (r.data?.linked && r.data?.journey_id) {
          setTarget(`/studio/journey/${r.data.journey_id}/step/${milestoneType}`);
        } else {
          setError(true);
        }
      })
      .catch(() => { if (!cancel) setError(true); });
    return () => { cancel = true; };
  }, [projectId, milestoneType]);

  if (error)  return <Navigate to="/dashboard" replace />;
  if (!target) return <Loader />;
  return <Navigate to={target} replace />;
};


/* ════════════════════════════════════════════════════════════════════
 * 6 · /client/welcome → /journey/:jid (resolve via /api/journeys/mine)
 * ════════════════════════════════════════════════════════════════════
 * NOTE: questo redirect è OPZIONALE. La user-story di /client/welcome è
 * mostrare il preset Atelier. Per ora /client/welcome NON viene cambiato:
 * Phase 2 si limita ad aggiungere il NUOVO URL /journey/:jid come alias
 * canonico del Companion. Le rotte legacy continuano a funzionare.
 * Il redirect /client/welcome → /journey/:jid potrà attivarsi in Phase 3
 * dopo aver verificato che ClientCompanionPage può sostituire
 * ClientWelcomePresetPage senza perdita visuale.
 */
export const ClientMineRedirect = () => {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let cancel = false;
    api.get('/api/journeys/mine')
      .then((r) => {
        if (cancel) return;
        if (r.data?.journey_id) setTarget(`/journey/${r.data.journey_id}`);
        else setTarget('/client/welcome');
      })
      .catch(() => { if (!cancel) setTarget('/client/welcome'); });
    return () => { cancel = true; };
  }, []);

  if (!target) return <Loader />;
  return <Navigate to={target} replace />;
};
