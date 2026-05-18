/**
 * EditorialStudioPage — the Composition Room (Phase E-2 Prompt 2).
 *
 * Top-level workspace surface at `/blueprint/editorial`. Split-pane:
 *   • LEFT: Editorial Calendar (masters + variants × markets × statuses)
 *   • RIGHT: Article Editor with Internal Understanding (review-only)
 *           vs Published Locale (editable + publishable) tabs.
 *
 * "International editorial desk" aesthetic — no enterprise badges, no
 * AI vocabulary. Toolbar verbs: Compose Direction · Refine Editorial
 * Angle · Rebalance Hospitality Tone · Preview · Schedule · Publish.
 */
import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import CompositionRoomRail from './CompositionRoomRail';
import ArticleEditorPanel from './ArticleEditorPanel';
import './editorial.css';

export const EditorialStudioPage = () => {
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [fullVariant, setFullVariant] = useState(null);
  const [version, setVersion] = useState(0);   // force-refresh the rail

  // Pull the FULL variant (incl. body_blocks, cta_set, seo) when one is
  // selected. The calendar list returns the lightweight summary.
  useEffect(() => {
    if (!selectedVariant?.id) { setFullVariant(null); return; }
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/api/editorial/variants/${selectedVariant.id}`);
        if (alive) setFullVariant(r.data);
      } catch (e) {
        if (alive) setFullVariant(null);
      }
    })();
    return () => { alive = false; };
  }, [selectedVariant?.id, version]);

  return (
    <div className="ed-studio" data-testid="ed-studio">
      <CompositionRoomRail
        key={`rail-${version}`}
        selectedMasterId={selectedMaster?.id}
        selectedVariantId={selectedVariant?.id}
        onSelectMaster={(m) => { setSelectedMaster(m); setSelectedVariant(null); setFullVariant(null); }}
        onSelectVariant={(v) => { setSelectedVariant(v); setSelectedMaster({ id: v.master_id }); }}
      />
      {!fullVariant && (
        <section className="ed-pane ed-pane__empty" data-testid="ed-pane-empty">
          <p className="ed-pane__kicker">Editorial Operations · Magazine</p>
          <h2>Market Editions<sup>™</sup></h2>
          <p>
            Crea versioni culturalmente native di un'unica direzione editoriale.
            Ogni Editorial Master ha le sue Market Edition — qui ne componi tono,
            CTA e ritmo per ciascun mercato, le programmi e le pubblichi senza mai
            uscire dalla redazione.
          </p>
          <p className="ed-pane__hint">
            ← Seleziona un Editorial Master o una Market Edition dalla colonna a sinistra.
          </p>
        </section>
      )}
      {fullVariant && (
        <ArticleEditorPanel
          variant={fullVariant}
          onVariantChanged={(v) => {
            // Reflect changes back into the rail without a hard reload.
            setFullVariant((prev) => ({ ...(prev || {}), ...(v || {}) }));
            setVersion((n) => n + 1);
          }}
        />
      )}
    </div>
  );
};

export default EditorialStudioPage;
