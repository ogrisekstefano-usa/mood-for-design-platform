-- 008_moodboard_pages.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase F.0 — Multi-page Foundation for Blueprint Moodboard PRO™
--
-- Transforms a moodboard from a single canvas into an ordered sequence of
-- pages. Each page is a self-contained surface with a type (cover/blank/...),
-- an aspect ratio preset, and a sort_order.
--
-- Backward compatibility: every existing moodboard gets one DEFAULT page
-- whose title mirrors `moodboards.title` and page_type='blank'. All existing
-- moodboard_elements are linked to that default page via page_id.
--
-- Reversible / idempotent. Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1. ENUM moodboard_page_type ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moodboard_page_type') THEN
    CREATE TYPE moodboard_page_type AS ENUM (
      'cover', 'blank', 'mood', 'material_board', 'product_grid',
      'palette', 'gallery', 'split_story', 'quote', 'technical_board',
      'floorplan', 'proposal_summary', 'approval'
    );
  END IF;
END $$;

-- ── 2. TABLE moodboard_pages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moodboard_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  moodboard_id    uuid NOT NULL REFERENCES moodboards(id) ON DELETE CASCADE,
  title           text,
  page_type       moodboard_page_type NOT NULL DEFAULT 'blank',
  aspect_ratio    text NOT NULL DEFAULT 'portrait_a4',   -- 'portrait_a4' | 'landscape_16_9' | 'square_1_1' | 'editorial_3_4' | 'wide_2_1' | 'cover_landscape'
  width           int  NOT NULL DEFAULT 1400,
  height          int  NOT NULL DEFAULT 2400,
  background      jsonb DEFAULT '{}'::jsonb,             -- {color, image_url, mode}
  settings        jsonb DEFAULT '{}'::jsonb,             -- {margin, grid, safe_area, header, footer}
  sort_order      int  NOT NULL DEFAULT 0,
  hidden_in_presentation boolean NOT NULL DEFAULT false,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moodboard_pages_mb_order
  ON moodboard_pages (moodboard_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_moodboard_pages_tenant
  ON moodboard_pages (tenant_id);

-- ── 3. moodboard_elements.page_id (nullable, FK to pages) ───────────────────
ALTER TABLE moodboard_elements
  ADD COLUMN IF NOT EXISTS page_id uuid REFERENCES moodboard_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_moodboard_elements_page
  ON moodboard_elements (page_id);

-- ── 4. moodboards.current_page_id (default landing for the editor) ──────────
ALTER TABLE moodboards
  ADD COLUMN IF NOT EXISTS current_page_id uuid REFERENCES moodboard_pages(id) ON DELETE SET NULL;

-- ── 5. BACKFILL: one default page per moodboard, link all elements ──────────
DO $$
DECLARE
  mb RECORD;
  default_page_id uuid;
BEGIN
  FOR mb IN
    SELECT m.id, m.tenant_id, m.title
      FROM moodboards m
      WHERE NOT EXISTS (
        SELECT 1 FROM moodboard_pages p WHERE p.moodboard_id = m.id
      )
  LOOP
    INSERT INTO moodboard_pages (
      tenant_id, moodboard_id, title, page_type, aspect_ratio,
      width, height, sort_order
    ) VALUES (
      mb.tenant_id, mb.id,
      COALESCE(NULLIF(mb.title, ''), 'Page 1'),
      'blank', 'portrait_a4', 1400, 2400, 0
    )
    RETURNING id INTO default_page_id;

    -- Attach all existing elements of this moodboard to the new page
    UPDATE moodboard_elements
      SET page_id = default_page_id
      WHERE moodboard_id = mb.id
        AND page_id IS NULL;

    -- Set this page as the moodboard's current_page_id (entry point)
    UPDATE moodboards
      SET current_page_id = default_page_id
      WHERE id = mb.id;
  END LOOP;
END $$;

-- ── 6. (Optional V2) make page_id NOT NULL after backfill.
-- We DELIBERATELY keep it NULLABLE in F.0 to allow gradual rollout: legacy
-- write paths that don't yet know about pages won't fail. A future migration
-- (009 or later) will enforce NOT NULL once all writers are updated.

-- ── 7. Permissions: ensure service_role can read/write (Supabase RLS default
-- is bypassed by service_role; we keep RLS disabled for now per project
-- convention — tenant isolation enforced at the application layer via
-- require_permission decorators).
ALTER TABLE moodboard_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS svc_all_moodboard_pages ON moodboard_pages;
CREATE POLICY svc_all_moodboard_pages ON moodboard_pages
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
