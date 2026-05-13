-- 009_structural_templates.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase F.1 — Structural Multi-page Templates for Blueprint Moodboard PRO™
--
-- Extends the existing `moodboard_templates` to support multi-page structure:
--   - new table `template_pages` (mirror of moodboard_pages)
--   - `template_blocks.template_page_id` (nullable for backward-compat with F.0
--     single-page templates that lived under `template_blocks.template_id`)
--   - placeholder semantics on template_blocks: `is_placeholder`,
--     `placeholder_label`, `placeholder_required`, `placeholder_type`
--   - Backfill: every existing template gets a default page (mirror of F.0
--     pattern), all existing template_blocks attach to it.
--
-- Reversible / idempotent.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1. TABLE template_pages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES moodboard_templates(id) ON DELETE CASCADE,
  title           text,
  page_type       moodboard_page_type NOT NULL DEFAULT 'blank',
  aspect_ratio    text NOT NULL DEFAULT 'portrait_a4',
  width           int  NOT NULL DEFAULT 1400,
  height          int  NOT NULL DEFAULT 2400,
  background      jsonb DEFAULT '{}'::jsonb,
  settings        jsonb DEFAULT '{}'::jsonb,
  sort_order      int  NOT NULL DEFAULT 0,
  metadata_json   jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_pages_tpl_order
  ON template_pages (template_id, sort_order);

-- ── 2. template_blocks.template_page_id + placeholder semantics ──────────
ALTER TABLE template_blocks
  ADD COLUMN IF NOT EXISTS template_page_id uuid REFERENCES template_pages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS placeholder_label text,
  ADD COLUMN IF NOT EXISTS placeholder_type text,         -- image | text | palette | material | product | logo | floorplan
  ADD COLUMN IF NOT EXISTS placeholder_required boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_template_blocks_page
  ON template_blocks (template_page_id);

-- ── 3. Backfill: each existing template gets one default page ───────────
DO $$
DECLARE
  t RECORD;
  default_page_id uuid;
BEGIN
  FOR t IN
    SELECT mt.id, mt.name
      FROM moodboard_templates mt
      WHERE NOT EXISTS (
        SELECT 1 FROM template_pages p WHERE p.template_id = mt.id
      )
  LOOP
    INSERT INTO template_pages (
      template_id, title, page_type, aspect_ratio, width, height, sort_order
    ) VALUES (
      t.id, COALESCE(NULLIF(t.name, ''), 'Page 1'),
      'blank', 'portrait_a4', 1400, 2400, 0
    )
    RETURNING id INTO default_page_id;

    UPDATE template_blocks
      SET template_page_id = default_page_id
      WHERE template_id = t.id
        AND template_page_id IS NULL;
  END LOOP;
END $$;

COMMIT;
