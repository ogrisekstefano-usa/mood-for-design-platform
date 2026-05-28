-- ────────────────────────────────────────────────────────────────────
-- 107_dj_operational_lock.sql · ITER168 · Phase 1
-- Design Journey™ Operational Refactor — Schema Lock & Semantic Enforcement
--
-- Goal: rendere il Design Journey™ la root entity reale del prodotto.
-- Nessuna nuova feature visuale. Solo ossatura.
--
-- - Moodboard contextual architecture (scope, room_key, chapter_key,
--   visibility, approval_state)
-- - Elastic milestones (is_applicable, skipped, reopened, parallel_track)
-- - 2-layer separation: lifecycle (relazione) ≠ status (operativo)
-- - account_id NOT NULL su design_journeys (backfill → Archivio storico)
-- - journey_id NOT NULL su moodboards/proposals/curated_collections
-- - journey_briefs (1:1 con design_journeys)
-- - VIEW journey_overview (KPI per journey)
-- - Catalog tables: moodboard_rooms, moodboard_chapters + IT seed
--
-- Idempotente. Reversibile via DROP. Zero data loss.
-- Vedi /app/memory/ITER168_DJ_OPERATIONAL_REFACTOR.md per la spec completa.
-- ────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════
-- §1 · MOODBOARD CONTEXTUAL ARCHITECTURE
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE moodboards
  ADD COLUMN IF NOT EXISTS scope           TEXT,
  ADD COLUMN IF NOT EXISTS room_key        TEXT,
  ADD COLUMN IF NOT EXISTS chapter_key     TEXT,
  ADD COLUMN IF NOT EXISTS visibility      TEXT NOT NULL DEFAULT 'studio_only',
  ADD COLUMN IF NOT EXISTS approval_state  TEXT NOT NULL DEFAULT 'draft';

-- Defensive CHECK constraints (additive, NULL safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moodboards_scope_chk') THEN
    ALTER TABLE moodboards ADD CONSTRAINT moodboards_scope_chk
      CHECK (scope IS NULL OR scope IN (
        'direction',          -- Moodboard Direction™ globale
        'materials',           -- Material Direction™ (palette materica)
        'inspirations',        -- collezione di riferimenti curati
        'room_focus',          -- focus su una stanza specifica
        'lighting_study',      -- studio illuminotecnico
        'hospitality',         -- moodboard per progetti hospitality
        'global_archive'       -- archivio interno studio (no journey)
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moodboards_visibility_chk') THEN
    ALTER TABLE moodboards ADD CONSTRAINT moodboards_visibility_chk
      CHECK (visibility IN (
        'studio_only',
        'shared_with_client',
        'client_approval_pending',
        'approved'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'moodboards_approval_state_chk') THEN
    ALTER TABLE moodboards ADD CONSTRAINT moodboards_approval_state_chk
      CHECK (approval_state IN (
        'draft',
        'presented',
        'revision_requested',
        'partially_approved',
        'approved',
        'locked'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS moodboards_journey_scope_idx
  ON moodboards (tenant_id, journey_id, scope)
  WHERE journey_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS moodboards_journey_room_idx
  ON moodboards (tenant_id, journey_id, room_key)
  WHERE journey_id IS NOT NULL AND room_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS moodboards_approval_idx
  ON moodboards (tenant_id, approval_state, updated_at DESC);


-- ═══════════════════════════════════════════════════════════════════
-- §2 · CATALOG TABLES (rooms + chapters)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS moodboard_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
    -- kitchen | living | dining | …
  category        TEXT NOT NULL DEFAULT 'residential',
    -- residential | hospitality | retail | office | outdoor
  label_i18n      JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- {it: "Cucina", en: "Kitchen", fr: "Cuisine", …}
  display_order   INT NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  default_chapters JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- ["atmosphere","palette","textures","lighting"]
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS moodboard_rooms_active_idx
  ON moodboard_rooms (is_active, display_order);


CREATE TABLE IF NOT EXISTS moodboard_chapters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
    -- atmosphere | palette | textures | lighting | …
  label_i18n      JSONB NOT NULL DEFAULT '{}'::jsonb,
  description_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_order   INT NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS moodboard_chapters_active_idx
  ON moodboard_chapters (is_active, display_order);


-- ── Seed iniziale rooms (IT primary, EN fallback) · idempotente ────
INSERT INTO moodboard_rooms (key, category, label_i18n, display_order, default_chapters)
VALUES
  ('kitchen',          'residential', '{"it":"Cucina","en":"Kitchen","fr":"Cuisine","de":"Küche","es":"Cocina"}'::jsonb,           10, '["atmosphere","palette","textures","lighting","finishes"]'::jsonb),
  ('living',           'residential', '{"it":"Soggiorno","en":"Living","fr":"Salon","de":"Wohnzimmer","es":"Sala"}'::jsonb,         20, '["atmosphere","palette","furniture","lighting","art"]'::jsonb),
  ('dining',           'residential', '{"it":"Sala da pranzo","en":"Dining","fr":"Salle à manger","de":"Esszimmer","es":"Comedor"}'::jsonb, 30, '["atmosphere","furniture","lighting","palette"]'::jsonb),
  ('master_bedroom',   'residential', '{"it":"Camera padronale","en":"Master Bedroom","fr":"Chambre principale","de":"Hauptschlafzimmer","es":"Dormitorio principal"}'::jsonb, 40, '["atmosphere","palette","textures","lighting"]'::jsonb),
  ('guest_bedroom',    'residential', '{"it":"Camera ospiti","en":"Guest Bedroom","fr":"Chambre d''amis","de":"Gästezimmer","es":"Habitación de invitados"}'::jsonb, 50, '["atmosphere","palette","textures"]'::jsonb),
  ('bathroom_master',  'residential', '{"it":"Bagno padronale","en":"Master Bath","fr":"Salle de bain principale","de":"Hauptbadezimmer","es":"Baño principal"}'::jsonb, 60, '["atmosphere","textures","finishes","lighting"]'::jsonb),
  ('bathroom_guest',   'residential', '{"it":"Bagno ospiti","en":"Guest Bath","fr":"Salle de bain","de":"Gästebadezimmer","es":"Baño de invitados"}'::jsonb, 70, '["textures","finishes","palette"]'::jsonb),
  ('entry',            'residential', '{"it":"Ingresso","en":"Entry","fr":"Entrée","de":"Eingang","es":"Entrada"}'::jsonb,         80, '["atmosphere","lighting","finishes"]'::jsonb),
  ('study',            'residential', '{"it":"Studio","en":"Study","fr":"Bureau","de":"Arbeitszimmer","es":"Estudio"}'::jsonb,     90, '["atmosphere","furniture","lighting"]'::jsonb),
  ('terrace',          'outdoor',     '{"it":"Terrazza","en":"Terrace","fr":"Terrasse","de":"Terrasse","es":"Terraza"}'::jsonb,   100, '["atmosphere","materials","furniture"]'::jsonb),
  ('garden',           'outdoor',     '{"it":"Giardino","en":"Garden","fr":"Jardin","de":"Garten","es":"Jardín"}'::jsonb,         110, '["atmosphere","planting","lighting"]'::jsonb),
  ('facade',           'outdoor',     '{"it":"Facciata","en":"Facade","fr":"Façade","de":"Fassade","es":"Fachada"}'::jsonb,       120, '["finishes","palette","lighting"]'::jsonb),
  ('hospitality_lobby','hospitality', '{"it":"Lobby","en":"Lobby","fr":"Lobby","de":"Lobby","es":"Lobby"}'::jsonb,                200, '["atmosphere","palette","art","lighting"]'::jsonb),
  ('hospitality_room', 'hospitality', '{"it":"Camera albergo","en":"Hotel Room","fr":"Chambre d''hôtel","de":"Hotelzimmer","es":"Habitación de hotel"}'::jsonb, 210, '["atmosphere","palette","textures"]'::jsonb),
  ('retail_front',     'retail',      '{"it":"Retail · Front","en":"Retail · Front","fr":"Vente · Façade","de":"Einzelhandel · Front","es":"Tienda · Frente"}'::jsonb, 300, '["atmosphere","art","lighting"]'::jsonb),
  ('retail_back',      'retail',      '{"it":"Retail · Retro","en":"Retail · Back","fr":"Vente · Arrière","de":"Einzelhandel · Hinten","es":"Tienda · Trasera"}'::jsonb, 310, '["materials","lighting"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  label_i18n      = EXCLUDED.label_i18n,
  default_chapters = EXCLUDED.default_chapters,
  category        = EXCLUDED.category,
  display_order   = EXCLUDED.display_order,
  updated_at      = NOW();


-- ── Seed iniziale chapters ──────────────────────────────────────────
INSERT INTO moodboard_chapters (key, label_i18n, description_i18n, display_order)
VALUES
  ('atmosphere',  '{"it":"Atmosfera","en":"Atmosphere","fr":"Atmosphère","de":"Atmosphäre","es":"Atmósfera"}'::jsonb,
                  '{"it":"Il sentire dello spazio","en":"How the space feels"}'::jsonb, 10),
  ('palette',     '{"it":"Palette","en":"Palette","fr":"Palette","de":"Farbpalette","es":"Paleta"}'::jsonb,
                  '{"it":"Cromie e accordi","en":"Colors and harmonies"}'::jsonb, 20),
  ('textures',    '{"it":"Materie & Texture","en":"Materials & Textures","fr":"Matières & Textures","de":"Materialien & Texturen","es":"Materiales y Texturas"}'::jsonb,
                  '{"it":"Tatto, peso, finitura","en":"Tactility, weight, finish"}'::jsonb, 30),
  ('lighting',    '{"it":"Luce","en":"Lighting","fr":"Éclairage","de":"Beleuchtung","es":"Iluminación"}'::jsonb,
                  '{"it":"La regia luminosa","en":"The lighting direction"}'::jsonb, 40),
  ('furniture',   '{"it":"Arredo","en":"Furniture","fr":"Mobilier","de":"Möbel","es":"Mobiliario"}'::jsonb,
                  '{"it":"I pezzi e il loro dialogo","en":"The pieces and their dialogue"}'::jsonb, 50),
  ('art',         '{"it":"Arte & Decor","en":"Art & Decor","fr":"Art & Décor","de":"Kunst & Dekor","es":"Arte y Decoración"}'::jsonb,
                  '{"it":"Opere e oggetti narranti","en":"Narrating works and objects"}'::jsonb, 60),
  ('finishes',    '{"it":"Finiture","en":"Finishes","fr":"Finitions","de":"Oberflächen","es":"Acabados"}'::jsonb,
                  '{"it":"Dettaglio e qualità tattile","en":"Detail and tactile quality"}'::jsonb, 70),
  ('accessories', '{"it":"Accessori","en":"Accessories","fr":"Accessoires","de":"Accessoires","es":"Accesorios"}'::jsonb,
                  '{"it":"Il completamento intimo","en":"The intimate completion"}'::jsonb, 80),
  ('references',  '{"it":"Riferimenti","en":"References","fr":"Références","de":"Referenzen","es":"Referencias"}'::jsonb,
                  '{"it":"Ispirazioni progettuali","en":"Project references"}'::jsonb, 90)
ON CONFLICT (key) DO UPDATE SET
  label_i18n      = EXCLUDED.label_i18n,
  description_i18n = EXCLUDED.description_i18n,
  display_order   = EXCLUDED.display_order,
  updated_at      = NOW();


-- ═══════════════════════════════════════════════════════════════════
-- §3 · ELASTIC MILESTONES (NON waterfall · multi-track)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE journey_milestones
  ADD COLUMN IF NOT EXISTS is_applicable  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS skipped_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skipped_reason TEXT,
  ADD COLUMN IF NOT EXISTS reopened_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parallel_track TEXT NOT NULL DEFAULT 'main';

-- Relax status CHECK (drop old if exists, add new with extended set)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journey_milestones_status_chk') THEN
    ALTER TABLE journey_milestones DROP CONSTRAINT journey_milestones_status_chk;
  END IF;
  ALTER TABLE journey_milestones ADD CONSTRAINT journey_milestones_status_chk
    CHECK (status IN (
      'not_started',
      'in_progress',
      'presented',
      'revision_requested',
      'partially_approved',
      'approved',
      'closed',
      'skipped',
      'not_applicable',
      'reopened',
      'parallel_active'
    ));
END $$;

CREATE INDEX IF NOT EXISTS journey_milestones_track_idx
  ON journey_milestones (journey_id, parallel_track, order_index);
CREATE INDEX IF NOT EXISTS journey_milestones_applicable_idx
  ON journey_milestones (journey_id, is_applicable)
  WHERE is_applicable = TRUE;


-- ═══════════════════════════════════════════════════════════════════
-- §4 · ACCOUNT_ID NOT NULL su design_journeys (CON BACKFILL)
-- ═══════════════════════════════════════════════════════════════════

-- §4.1 · Per ogni tenant che ha journey orfane, garantisci un account
-- "Archivio storico" e collega le journey a quello.
DO $$
DECLARE
  rec RECORD;
  archivio_id UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT tenant_id
    FROM design_journeys
    WHERE account_id IS NULL
  LOOP
    -- Trova o crea l'account "Archivio storico" per il tenant
    SELECT id INTO archivio_id
    FROM accounts
    WHERE tenant_id = rec.tenant_id
      AND account_name = 'Archivio storico'
      AND lifecycle_stage = 'archived'
    LIMIT 1;

    IF archivio_id IS NULL THEN
      archivio_id := gen_random_uuid();
      INSERT INTO accounts (
        id, tenant_id, account_name, account_type, lifecycle_stage,
        source, notes, metadata_json, created_at, updated_at
      ) VALUES (
        archivio_id, rec.tenant_id, 'Archivio storico', 'other', 'archived',
        'manual_entry',
        'Backfill ITER168 · raccoglie le journey legacy senza account assegnato.',
        '{"system":"iter168_backfill","kind":"archivio_storico"}'::jsonb,
        NOW(), NOW()
      );
    END IF;

    UPDATE design_journeys
    SET account_id = archivio_id, updated_at = NOW()
    WHERE tenant_id = rec.tenant_id AND account_id IS NULL;
  END LOOP;
END $$;

-- §4.2 · Forza NOT NULL su design_journeys.account_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'design_journeys'
      AND column_name = 'account_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE design_journeys ALTER COLUMN account_id SET NOT NULL;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- §5 · JOURNEY_ID NOT NULL su artifact tables (CON BACKFILL)
-- ═══════════════════════════════════════════════════════════════════

-- §5.1 · Per ogni tenant, journey "Archivio storico" che raccoglie
-- gli artifact orfani.
DO $$
DECLARE
  rec        RECORD;
  archivio_aid UUID;
  archivio_jid UUID;
BEGIN
  -- Solo tenant che hanno artifact orfani
  FOR rec IN
    SELECT tenant_id FROM moodboards WHERE journey_id IS NULL
    UNION
    SELECT tenant_id FROM proposals WHERE journey_id IS NULL
    UNION
    SELECT tenant_id FROM curated_collections WHERE journey_id IS NULL
  LOOP
    -- Cerca o crea l'account archivio
    SELECT id INTO archivio_aid FROM accounts
    WHERE tenant_id = rec.tenant_id
      AND account_name = 'Archivio storico'
      AND lifecycle_stage = 'archived'
    LIMIT 1;
    IF archivio_aid IS NULL THEN
      archivio_aid := gen_random_uuid();
      INSERT INTO accounts (
        id, tenant_id, account_name, account_type, lifecycle_stage,
        source, metadata_json, created_at, updated_at
      ) VALUES (
        archivio_aid, rec.tenant_id, 'Archivio storico', 'other', 'archived',
        'manual_entry',
        '{"system":"iter168_backfill","kind":"archivio_storico"}'::jsonb,
        NOW(), NOW()
      );
    END IF;

    -- Cerca o crea la journey archivio
    SELECT id INTO archivio_jid FROM design_journeys
    WHERE tenant_id = rec.tenant_id
      AND account_id = archivio_aid
      AND lifecycle_state = 'abandoned'
    LIMIT 1;
    IF archivio_jid IS NULL THEN
      archivio_jid := gen_random_uuid();
      INSERT INTO design_journeys (
        id, tenant_id, account_id, project_id,
        overall_status, lifecycle_state,
        started_at, created_at, updated_at
      ) VALUES (
        archivio_jid, rec.tenant_id, archivio_aid,
        '00000000-0000-0000-0000-000000000000',  -- sentinel project_id
        'closed', 'abandoned',
        NOW(), NOW(), NOW()
      );
    END IF;

    UPDATE moodboards SET journey_id = archivio_jid, updated_at = NOW()
    WHERE tenant_id = rec.tenant_id AND journey_id IS NULL;
    UPDATE proposals SET journey_id = archivio_jid, updated_at = NOW()
    WHERE tenant_id = rec.tenant_id AND journey_id IS NULL;
    UPDATE curated_collections SET journey_id = archivio_jid, updated_at = NOW()
    WHERE tenant_id = rec.tenant_id AND journey_id IS NULL;
  END LOOP;
END $$;

-- §5.2 · Forza NOT NULL su moodboards.journey_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'moodboards'
      AND column_name = 'journey_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE moodboards ALTER COLUMN journey_id SET NOT NULL;
  END IF;
END $$;
-- Nota: proposals e curated_collections NON vengono forzati NOT NULL in
-- questo pass perché potrebbero esistere proposal storiche pre-journey.
-- Restano soft FK con backfill best-effort (vedi 063 + 107§5.1).


-- ═══════════════════════════════════════════════════════════════════
-- §6 · JOURNEY_BRIEFS (1:1 con design_journeys)
-- ═══════════════════════════════════════════════════════════════════
-- Estrae il brief da `leads.closed_answers` e lo materializza come
-- entità del Design Journey™ (root entity-aligned).

CREATE TABLE IF NOT EXISTS journey_briefs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journey_id             UUID NOT NULL REFERENCES design_journeys(id) ON DELETE CASCADE,
  closed_answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  atmosphere_signals     JSONB NOT NULL DEFAULT '[]'::jsonb,
  material_signals       JSONB NOT NULL DEFAULT '[]'::jsonb,
  cultural_register      TEXT,
  luxury_perception_tier TEXT,
  narrative_seed         TEXT,
  intake_version         TEXT,
  source_lead_id         UUID,    -- soft FK to leads.id (provenance)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT journey_briefs_journey_uniq UNIQUE (journey_id)
);
CREATE INDEX IF NOT EXISTS journey_briefs_tenant_idx
  ON journey_briefs (tenant_id, updated_at DESC);


-- ═══════════════════════════════════════════════════════════════════
-- §7 · VIEW journey_overview (KPI per journey)
-- ═══════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS journey_overview;
CREATE VIEW journey_overview AS
SELECT
  j.id                              AS journey_id,
  j.tenant_id                       AS tenant_id,
  j.account_id                      AS account_id,
  a.account_name                    AS account_name,
  a.lifecycle_stage                 AS account_lifecycle_stage,
  j.project_id                      AS project_id,
  j.overall_status                  AS overall_status,
  j.lifecycle_state                 AS lifecycle_state,
  j.started_at                      AS started_at,
  j.closed_at                       AS closed_at,
  j.updated_at                      AS updated_at,
  j.current_milestone_id            AS current_milestone_id,
  (
    SELECT COUNT(*) FROM journey_milestones m
    WHERE m.journey_id = j.id AND m.is_applicable = TRUE
  )                                 AS milestones_total,
  (
    SELECT COUNT(*) FROM journey_milestones m
    WHERE m.journey_id = j.id AND m.status IN ('approved','closed')
  )                                 AS milestones_approved,
  (
    SELECT COUNT(*) FROM moodboards mb
    WHERE mb.journey_id = j.id
  )                                 AS moodboards_count,
  (
    SELECT COUNT(*) FROM proposals p
    WHERE p.journey_id = j.id
  )                                 AS proposals_count,
  (
    SELECT MAX(e.created_at) FROM journey_timeline_events e
    WHERE e.journey_id = j.id
  )                                 AS last_event_at,
  (
    SELECT COUNT(*) FROM journey_health_signals hs
    WHERE hs.journey_id = j.id AND hs.resolved_at IS NULL
  )                                 AS open_health_signals
FROM design_journeys j
LEFT JOIN accounts a ON a.id = j.account_id;

COMMENT ON VIEW journey_overview IS
  'ITER168 · KPI snapshot per journey: lifecycle, milestone counts, artifact counts, last event, open health signals. Read-only.';


-- ═══════════════════════════════════════════════════════════════════
-- §8 · LIFECYCLE SYNC TRIGGER (leads.progression_state ← accounts.lifecycle_stage)
-- ═══════════════════════════════════════════════════════════════════
-- Quando un account passa di stato (lead→prospect→active_project→…)
-- propaga il valore equivalente alla colonna `leads.progression_state`
-- per le righe lead che condividono l'email.

CREATE OR REPLACE FUNCTION sync_leads_progression_from_account() RETURNS TRIGGER AS $$
DECLARE
  target_state TEXT;
BEGIN
  -- Mapping da account.lifecycle_stage a leads.progression_state
  target_state := CASE NEW.lifecycle_stage
    WHEN 'new_inquiry'      THEN 'lead'
    WHEN 'lead'             THEN 'lead'
    WHEN 'discovery'        THEN 'prospect'
    WHEN 'prospect'         THEN 'prospect'
    WHEN 'active_project'   THEN 'account'
    WHEN 'existing_client'  THEN 'account'
    WHEN 'repeat_client'    THEN 'account'
    WHEN 'archived'         THEN 'archived'
    ELSE NULL
  END;

  IF target_state IS NOT NULL AND NEW.email IS NOT NULL THEN
    UPDATE leads
    SET progression_state = target_state,
        updated_at = NOW()
    WHERE tenant_id = NEW.tenant_id
      AND LOWER(email) = LOWER(NEW.email)
      AND (progression_state IS DISTINCT FROM target_state);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_leads_progression ON accounts;
CREATE TRIGGER trg_sync_leads_progression
  AFTER UPDATE OF lifecycle_stage ON accounts
  FOR EACH ROW
  WHEN (OLD.lifecycle_stage IS DISTINCT FROM NEW.lifecycle_stage)
  EXECUTE FUNCTION sync_leads_progression_from_account();


-- ═══════════════════════════════════════════════════════════════════
-- §9 · SEMANTIC COMMENTS
-- ═══════════════════════════════════════════════════════════════════

COMMENT ON COLUMN moodboards.scope IS
  'ITER168 · Moodboard Contextual Architecture™. direction|materials|inspirations|room_focus|lighting_study|hospitality|global_archive. NULL = legacy.';
COMMENT ON COLUMN moodboards.room_key IS
  'ITER168 · Soft FK to moodboard_rooms.key. NULL = moodboard non scoped a una stanza.';
COMMENT ON COLUMN moodboards.chapter_key IS
  'ITER168 · Soft FK to moodboard_chapters.key. NULL = moodboard misto/non capitolato.';
COMMENT ON COLUMN moodboards.visibility IS
  'ITER168 · studio_only|shared_with_client|client_approval_pending|approved.';
COMMENT ON COLUMN moodboards.approval_state IS
  'ITER168 · draft|presented|revision_requested|partially_approved|approved|locked.';

COMMENT ON COLUMN journey_milestones.is_applicable IS
  'ITER168 · Milestone elastica. false = step non pertinente per questa journey (mai mostrato al cliente).';
COMMENT ON COLUMN journey_milestones.parallel_track IS
  'ITER168 · main|kitchen|bathroom_master|lighting|hospitality|… Permette filoni paralleli di milestone (multi-track journey).';
COMMENT ON COLUMN journey_milestones.skipped_at IS
  'ITER168 · Marker di skip esplicito (lo studio ha deciso di saltare lo step).';
COMMENT ON COLUMN journey_milestones.reopened_at IS
  'ITER168 · Marker di riapertura: una milestone già approved può essere riaperta → status=reopened.';

COMMENT ON TABLE moodboard_rooms IS
  'ITER168 · Catalog DB-driven delle stanze (kitchen, living, bathroom_master, …). Editable via Blueprint admin in fase 3.';
COMMENT ON TABLE moodboard_chapters IS
  'ITER168 · Catalog DB-driven dei capitoli di moodboard (atmosphere, palette, textures, …).';
COMMENT ON TABLE journey_briefs IS
  'ITER168 · 1:1 con design_journeys. Materializza il brief client-side estratto dall''intake. Fonte di verità del "primo capitolo" del DJ.';

COMMENT ON FUNCTION sync_leads_progression_from_account IS
  'ITER168 · Mantiene leads.progression_state allineato a accounts.lifecycle_stage. Single source of truth: accounts.';

-- ── End of 107_dj_operational_lock.sql ─────────────────────────────
