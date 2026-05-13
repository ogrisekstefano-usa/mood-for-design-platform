/**
 * PublicPresentation — public, no-auth, cinematic Presentation Mode for the
 * client-safe storytelling experience. Resolves a moodboard via its share
 * token and renders PresentationMode V2 directly (no editor chrome).
 *
 * Filtering rules are enforced server-side (`hidden_from_client` pages are
 * stripped from the public response) — we still pass `clientSafe` so block-
 * level visibility flags are honored client-side too.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import PresentationMode from '../../blueprint/moodboard/PresentationMode';

const PublicPresentation = () => {
  const { shareToken } = useParams();
  const { t } = useBlueprint();
  const [mb, setMb] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/moodboards/public/share/${shareToken}`)
      .then((r) => setMb(r.data))
      .catch((err) => setError(err?.response?.status === 404
        ? 'not_found' : err?.response?.status === 403 ? 'not_ready' : 'error'));
    // Public endpoint reserved for future — transitions catalog is currently
    // auth-gated; client receives the safe default (`fade`) for every page.
    // When we add a public meta endpoint, swap this fetch.
    api.get('/api/moodboards/_meta/presentation_transitions')
      .then((r) => setTransitions(r.data?.data || []))
      .catch(() => setTransitions([]));
  }, [shareToken]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white/55"
           data-testid="public-presentation-error">
        <p className="bp-body !text-[14px] !font-light">—</p>
      </div>
    );
  }

  if (!mb) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center"
           data-testid="public-presentation-loading">
        <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PresentationMode
      mb={mb}
      pages={mb.pages || []}
      blocks={mb.elements || []}
      transitions={transitions}
      clientSafe
      startIndex={0}
      showExit={false}
      onExit={() => { /* swallow — public surface */ }}
      t={t}
    />
  );
};

export default PublicPresentation;
