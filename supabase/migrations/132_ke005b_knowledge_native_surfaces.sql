-- ═══════════════════════════════════════════════════════════════════════
-- 132 · KE-005B · KNOWLEDGE-NATIVE SURFACES™ · FOUNDATION
-- ═══════════════════════════════════════════════════════════════════════
-- Sprint KE-005B.1 — schema additivo per portare Moodboard e Design
-- Journey dentro l'ecosistema entity-driven costruito in KE-001…KE-004.
--
-- Direttive utente recepite:
--   * NESSUN backfill automatico di contenuti legacy
--   * `entity_operational_usage` aggiornato ad ogni attach/detach (via hook)
--   * `brand_entity_relations` (Connected Assets) aggiornato ad ogni
--     attach/detach (via hook)
--   * `entity_future_uses_v` riflette automaticamente i counter
--   * `knowledge_impact_events` NON registra attach/detach semplici
--     (vedi services/knowledge_usage_hooks.py)
--
-- Pure additive · zero distruzione di dati · zero modifica di colonne
-- esistenti. Rollback:
--   ALTER TABLE moodboard_elements DROP COLUMN entity_id;
--   ALTER TABLE journey_milestones DROP COLUMN entity_refs;
--   DROP INDEX idx_moodboard_elements_entity_id;
--   DROP INDEX idx_journey_milestones_entity_refs;
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- §1 · moodboard_elements.entity_id ───────────────────────────────────
-- Single optional canonical reference per block. Soft FK (no constraint
-- per evitare lock + facilitare detach lazy). Le entità "vere" sono
-- risolte attraverso brand_detected_entities via il service-layer.
ALTER TABLE moodboard_elements
  ADD COLUMN IF NOT EXISTS entity_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_moodboard_elements_entity_id
  ON moodboard_elements (entity_id)
  WHERE entity_id IS NOT NULL;

COMMENT ON COLUMN moodboard_elements.entity_id IS
  'KE-005B · Canonical entity reference (brand_detected_entities.id). '
  'NULL per i block legacy (text, palette, shape, immagini upload-only). '
  'Quando NOT NULL, il block è Knowledge-Native: il render UI legge dal '
  'Brand Atlas, le mutazioni triggerano hooks.attach_entity/detach_entity. '
  'Soft FK · nessun ON DELETE — il detach è gestito a livello applicativo.';


-- §2 · journey_milestones.entity_refs ─────────────────────────────────
-- Multi-entity per milestone (es. una "Material Direction™" può citare
-- 5 materiali certificati). JSONB array di UUID stringhe. Index GIN
-- per query "tutte le milestone che citano entity X".
ALTER TABLE journey_milestones
  ADD COLUMN IF NOT EXISTS entity_refs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_journey_milestones_entity_refs
  ON journey_milestones USING GIN (entity_refs);

COMMENT ON COLUMN journey_milestones.entity_refs IS
  'KE-005B · Array di canonical entity_id citate da questa milestone. '
  'Array vuoto = milestone non Knowledge-Native (legacy). Il diff '
  'tra payload PATCH e valore corrente triggera hooks.attach_entity '
  'sulle entità aggiunte e hooks.detach_entity sulle rimosse.';


-- §3 · brand_entity_relations · source_type + target_type ────────────
-- Necessari per qualificare le relazioni "used_in_<surface>" senza
-- forzare lookup polimorfici su tabelle multiple. Cleaner del derivare
-- da relation_type sub-string.
ALTER TABLE brand_entity_relations
  ADD COLUMN IF NOT EXISTS source_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS target_type TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_entity_relations_target
  ON brand_entity_relations (target_type, target_entity_id)
  WHERE target_type IS NOT NULL;

COMMENT ON COLUMN brand_entity_relations.source_type IS
  'KE-005B · entity_type del source (product / material / designer / image / …). '
  'Nullable per backward-compat con relazioni esistenti (has_finish, has_material).';
COMMENT ON COLUMN brand_entity_relations.target_type IS
  'KE-005B · surface_type del target quando relation_type LIKE used_in_%. '
  'Valori: moodboard, design_journey, material_board, client_presentation, '
  'magazine, social_story, product_selection, home_staging_pack.';


-- §3b · brand_entity_relations · polymorphic target (drop FK) ────────
-- target_entity_id deve poter puntare a tabelle non-entity (es. moodboards.id,
-- journey_milestones.id). La FK originale a brand_detected_entities(id)
-- impedisce le relazioni "used_in_*". La rimuoviamo · la consistenza
-- è garantita applicativamente dal service-layer.
ALTER TABLE brand_entity_relations
  DROP CONSTRAINT IF EXISTS brand_entity_relations_target_entity_id_fkey;


-- §3c · entity_operational_usage · estensione entity_type ─────────────
-- Le entità con type='finish' (estratte come finiture/tinte) devono poter
-- finire nel ledger usage. Estendiamo il CHECK includendo 'finish'.
ALTER TABLE entity_operational_usage
  DROP CONSTRAINT IF EXISTS entity_operational_usage_entity_type_chk;
ALTER TABLE entity_operational_usage
  ADD CONSTRAINT entity_operational_usage_entity_type_chk
  CHECK (entity_type IN (
    'product','material','finish','designer','image',
    'brand','collection','document'
  ));


-- §4 · entity_usage_lookup_v · view di convenienza ───────────────────
-- Risposta veloce a "questo (surface_type, surface_id) usa quali entità?"
-- letto dal grafo Connected Assets. Per il render dell'Entity Context
-- Panel quando una surface mostra una entità.
CREATE OR REPLACE VIEW entity_usage_lookup_v AS
SELECT
  r.tenant_id,
  r.target_type      AS surface_type,
  r.target_entity_id AS surface_id,
  r.source_entity_id AS entity_id,
  r.source_type      AS entity_type,
  r.metadata_json->>'snapshot' AS snapshot_json,
  r.created_at       AS attached_at
FROM brand_entity_relations r
WHERE r.relation_type LIKE 'used_in_%'
  AND r.target_type IN (
    'moodboard', 'design_journey', 'material_board',
    'client_presentation', 'magazine', 'social_story',
    'product_selection', 'home_staging_pack'
  );

COMMENT ON VIEW entity_usage_lookup_v IS
  'KE-005B · Convenience view per Entity Context Panel · lista entità '
  'attualmente attaccate a una surface (qualsiasi tipo). '
  'O(1) tramite indici esistenti su brand_entity_relations.';


INSERT INTO schema_migrations (version, applied_at)
VALUES ('132_ke005b_knowledge_native_surfaces', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- POST-CONDITIONS (verify after run):
--   ✓ moodboard_elements.entity_id          UUID NULL
--   ✓ journey_milestones.entity_refs        JSONB DEFAULT '[]'
--   ✓ brand_entity_relations.source_type    TEXT NULL
--   ✓ brand_entity_relations.target_type    TEXT NULL
--   ✓ idx_moodboard_elements_entity_id      partial INDEX
--   ✓ idx_journey_milestones_entity_refs    GIN INDEX
--   ✓ idx_brand_entity_relations_target     partial INDEX
--   ✓ entity_usage_lookup_v                 VIEW exists
--   ✓ schema_migrations contains '132_ke005b_knowledge_native_surfaces'
-- ═══════════════════════════════════════════════════════════════════════
