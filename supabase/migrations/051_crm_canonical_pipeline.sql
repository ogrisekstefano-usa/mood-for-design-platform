-- ────────────────────────────────────────────────────────────────────
-- 051_crm_canonical_pipeline.sql
--
-- CRM Experience Refactor™ — Phase 1
-- Adds the canonical 7-stage relationship pipeline + new account types
-- (yacht client, luxury retail, partner brand). Editorial stages from
-- 041 remain available — the canonical ones are flagged with
-- metadata.canonical_pipeline = true so the UI can pick them as the
-- primary pills shown on the AccountDetailPage™.
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Canonical lifecycle stages (Lead → Returning Client → Archived) ──
INSERT INTO relationship_lookups (tenant_id, group_key, value_key, label, sort_order, active, metadata)
SELECT t.id, 'lifecycle_stage', stage.value_key, stage.label, stage.sort_order, TRUE, stage.metadata
FROM tenants t
CROSS JOIN (VALUES
  ('lead',              '{"it-IT":"Lead","en-US":"Lead","en-GB":"Lead","es-ES":"Lead","fr-FR":"Lead","de-DE":"Lead"}'::jsonb,
                        10,  '{"canonical_pipeline":true,"order":1,"color":"#9CA3AF","tone":"first-touch"}'::jsonb),
  ('prospect',          '{"it-IT":"Prospect","en-US":"Prospect","en-GB":"Prospect","es-ES":"Prospecto","fr-FR":"Prospect","de-DE":"Prospekt"}'::jsonb,
                        20,  '{"canonical_pipeline":true,"order":2,"color":"#88c0d0","tone":"qualifying"}'::jsonb),
  ('qualified',         '{"it-IT":"Qualificato","en-US":"Qualified","en-GB":"Qualified","es-ES":"Cualificado","fr-FR":"Qualifié","de-DE":"Qualifiziert"}'::jsonb,
                        30,  '{"canonical_pipeline":true,"order":3,"color":"#5B7CA0","tone":"committed"}'::jsonb),
  ('active_project',    '{"it-IT":"Progetto attivo","en-US":"Active Project","en-GB":"Active Project","es-ES":"Proyecto activo","fr-FR":"Projet actif","de-DE":"Aktives Projekt"}'::jsonb,
                        40,  '{"canonical_pipeline":true,"order":4,"color":"#C9A36E","tone":"engaged"}'::jsonb),
  ('client',            '{"it-IT":"Cliente","en-US":"Client","en-GB":"Client","es-ES":"Cliente","fr-FR":"Client","de-DE":"Kunde"}'::jsonb,
                        50,  '{"canonical_pipeline":true,"order":5,"color":"#10B981","tone":"trusted"}'::jsonb),
  ('returning_client',  '{"it-IT":"Cliente di ritorno","en-US":"Returning Client","en-GB":"Returning Client","es-ES":"Cliente recurrente","fr-FR":"Client récurrent","de-DE":"Wiederkehrender Kunde"}'::jsonb,
                        60,  '{"canonical_pipeline":true,"order":6,"color":"#059669","tone":"loyalty"}'::jsonb),
  ('archived',          '{"it-IT":"Archiviato","en-US":"Archived","en-GB":"Archived","es-ES":"Archivado","fr-FR":"Archivé","de-DE":"Archiviert"}'::jsonb,
                        70,  '{"canonical_pipeline":true,"order":7,"color":"#6B7280","tone":"closed","terminal":true}'::jsonb)
) AS stage(value_key, label, sort_order, metadata)
ON CONFLICT (tenant_id, group_key, value_key) DO UPDATE
  SET metadata = relationship_lookups.metadata || EXCLUDED.metadata,
      sort_order = EXCLUDED.sort_order,
      label = EXCLUDED.label;


-- ── New account types (yacht, luxury retail, partner brand, hotel) ──
INSERT INTO relationship_lookups (tenant_id, group_key, value_key, label, sort_order, active, metadata)
SELECT t.id, 'account_type', tp.value_key, tp.label, tp.sort_order, TRUE, tp.metadata
FROM tenants t
CROSS JOIN (VALUES
  ('hotel_group',     '{"it-IT":"Gruppo alberghiero","en-US":"Hotel group","en-GB":"Hotel group","es-ES":"Grupo hotelero","fr-FR":"Groupe hôtelier","de-DE":"Hotelgruppe"}'::jsonb,
                      120, '{"icon":"hotel","cultural":"hospitality-first"}'::jsonb),
  ('yacht_client',    '{"it-IT":"Cliente yacht","en-US":"Yacht client","en-GB":"Yacht client","es-ES":"Cliente náutico","fr-FR":"Client yacht","de-DE":"Yacht-Kunde"}'::jsonb,
                      130, '{"icon":"yacht","cultural":"bespoke-marine"}'::jsonb),
  ('luxury_retail',   '{"it-IT":"Retail luxury","en-US":"Luxury retail","en-GB":"Luxury retail","es-ES":"Retail de lujo","fr-FR":"Retail luxe","de-DE":"Luxus-Retail"}'::jsonb,
                      140, '{"icon":"luxury","cultural":"flagship-experience"}'::jsonb),
  ('partner_brand',   '{"it-IT":"Brand partner","en-US":"Partner brand","en-GB":"Partner brand","es-ES":"Marca asociada","fr-FR":"Marque partenaire","de-DE":"Partnermarke"}'::jsonb,
                      150, '{"icon":"partner","cultural":"co-creation"}'::jsonb)
) AS tp(value_key, label, sort_order, metadata)
ON CONFLICT (tenant_id, group_key, value_key) DO UPDATE
  SET metadata = relationship_lookups.metadata || EXCLUDED.metadata,
      label = EXCLUDED.label;


-- ── Account columns for relationship intelligence cache ──────────────
-- We persist a small computed snapshot for fast Relationship Summary
-- reads. Recompute on interaction/style write (handled in backend).
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS mood_dominant       TEXT,
  ADD COLUMN IF NOT EXISTS market_submarket    TEXT,
  ADD COLUMN IF NOT EXISTS next_followup_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signal_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_accounts_next_followup
  ON accounts(tenant_id, next_followup_at)
  WHERE next_followup_at IS NOT NULL;


-- ── Voice notes index for fast timeline queries by type ──────────────
CREATE INDEX IF NOT EXISTS idx_interactions_voice_notes
  ON interactions(account_id, occurred_at DESC)
  WHERE interaction_type = 'voice_note';


COMMIT;
