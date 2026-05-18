/**
 * EditorialStudioPage — Market Editions™ Operations Workspace.
 *
 * Top: sticky MarketEditionsToolbar (7 CTAs) + FlowStrip (Master → Editions →
 *      Review → Schedule → Publish).
 * Body: 2-pane layout (rail + composition). Responsive breakpoints:
 *   XL ≥1440px:   3 columns (rail · composition · operations sidebar)
 *   Laptop ≥1024: 2 columns (rail · composition)
 *   Tablet ≥640:  stacked (toolbar → rail → composition)
 *   Mobile <640:  accordion (toolbar collapsible, single column)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import CompositionRoomRail from './CompositionRoomRail';
import ArticleEditorPanel from './ArticleEditorPanel';
import MarketEditionsToolbar from './MarketEditionsToolbar';
import EditorialContextRail from './EditorialContextRail';
import AdaptationOperationsPanel from './AdaptationOperationsPanel';
import { useNavigate } from 'react-router-dom';
import './editorial.css';

export const EditorialStudioPage = () => {
  const navigate = useNavigate();
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [fullVariant, setFullVariant] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [version, setVersion] = useState(0);
  const [masterVariants, setMasterVariants] = useState([]);

  // Load active tenant markets once (used by toolbar modals + context rail)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get('/api/tenants/me/markets');
        if (alive) setMarkets((r.data?.markets || []).filter((m) => m.is_active));
      } catch {
        if (alive) setMarkets([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Pull the FULL variant when one is selected
  useEffect(() => {
    if (!selectedVariant?.id) { setFullVariant(null); return; }
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/api/editorial/variants/${selectedVariant.id}`);
        if (alive) setFullVariant(r.data);
      } catch {
        if (alive) setFullVariant(null);
      }
    })();
    return () => { alive = false; };
  }, [selectedVariant?.id, version]);

  // Pull sibling variants for the active master (Next Step Intelligence™)
  useEffect(() => {
    const mid = selectedMaster?.id;
    if (!mid) { setMasterVariants([]); return; }
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/api/editorial/masters/${mid}/variants`);
        if (alive) setMasterVariants(r.data?.variants || []);
      } catch {
        if (alive) setMasterVariants([]);
      }
    })();
    return () => { alive = false; };
  }, [selectedMaster?.id, version]);

  const handleReload = useCallback(() => setVersion((n) => n + 1), []);

  const activeMarket = useMemo(() => {
    const target = fullVariant || selectedVariant;
    if (!target?.market_id) return null;
    return markets.find((m) => m.id === target.market_id) || null;
  }, [fullVariant, selectedVariant, markets]);

  return (
    <div className="ed-studio-wrap" data-testid="ed-studio-wrap">
      <MarketEditionsToolbar
        selectedMaster={selectedMaster}
        selectedVariant={fullVariant || selectedVariant}
        markets={markets}
        onReload={handleReload}
      />

      <EditorialContextRail
        master={selectedMaster}
        variant={fullVariant || selectedVariant}
        market={activeMarket}
        allVariantsForMaster={masterVariants}
      />

      {(fullVariant || selectedVariant) && (
        <AdaptationOperationsPanel
          variant={fullVariant || selectedVariant}
          master={selectedMaster}
          onChanged={handleReload}
          onOpenPreview={(v) => {
            const slug = v.public_slug || v.variant_slug;
            const locale = v.target_locale || 'it-IT';
            navigate(`/magazine/${locale}/${slug}?preview=1`);
          }}
        />
      )}

      <div className="ed-studio" data-testid="ed-studio">
        <CompositionRoomRail
          key={`rail-${version}`}
          selectedMasterId={selectedMaster?.id}
          selectedVariantId={selectedVariant?.id}
          onSelectMaster={(m) => { setSelectedMaster(m); setSelectedVariant(null); setFullVariant(null); }}
          onSelectVariant={(v) => {
            setSelectedVariant(v);
            // Hydrate master object lazily so the context rail can show its title.
            (async () => {
              try {
                const r = await api.get(`/api/editorial/masters/${v.master_id}`);
                setSelectedMaster(r.data || { id: v.master_id });
              } catch {
                setSelectedMaster({ id: v.master_id });
              }
            })();
          }}
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
              ← Seleziona un Editorial Master o una Market Edition dalla colonna a sinistra,
              oppure usa <strong>+ Nuovo Master</strong> nella toolbar.
            </p>
          </section>
        )}
        {fullVariant && (
          <ArticleEditorPanel
            variant={fullVariant}
            onVariantChanged={(v) => {
              setFullVariant((prev) => ({ ...(prev || {}), ...(v || {}) }));
              setVersion((n) => n + 1);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default EditorialStudioPage;
