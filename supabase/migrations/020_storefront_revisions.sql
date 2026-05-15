-- =====================================================================
-- 020_storefront_revisions.sql — Draft vs Live publishing workflow
-- =====================================================================
-- Phase J: introduces immutable revision snapshots on top of the existing
-- cms_pages / cms_sections live editing layer.
--
-- ARCHITECTURE
-- ────────────
-- • cms_sections / cms_pages.page_content stay as the LIVE DRAFT —
--   the studio writes here on every keystroke (existing behaviour).
-- • Every publish operation FREEZES the current (page + ordered sections)
--   state into a cms_page_revisions row (snapshot JSONB).
-- • cms_pages.published_revision_id points at the snapshot that the
--   public storefront should render. Public endpoint reads from there.
-- • cms_pages.draft_updated_at is bumped on every section/page mutation
--   so the Studio can show a "X changes since last publish" badge.
--
-- DIFF
-- ────
-- The Diff endpoint reconstructs the published snapshot and compares it
-- to the live draft on three levels:
--   1. page meta (title, locale_meta, page_content)
--   2. section list  (added · removed · reordered)
--   3. section content (field-level adds/removes/modifications per locale)
--
-- REVERT
-- ──────
-- Reverting writes the snapshot back onto the live tables (page + sections).
-- A new revision is created on the next publish — history is append-only.
-- =====================================================================
BEGIN;

-- ── 1. cms_page_revisions — immutable snapshots ──────────────────────
CREATE TABLE IF NOT EXISTS cms_page_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id         UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  page_key        TEXT NOT NULL,
  -- Frozen snapshot:
  --   {
  --     "page":     {title, locale_meta, page_content, status, ...},
  --     "sections": [{id, section_type, sort_order, visible, locale_content, settings, asset_refs}, ...],
  --     "asset_index": {asset_id: {public_url, alt_text, focal_point, dimensions}}
  --   }
  snapshot        JSONB NOT NULL,
  -- Optional human label ("Pre-launch", "v1.2 hero copy")
  label           TEXT,
  -- 'publish' = created on a publish action; 'autosave' (future) for periodic safety nets
  kind            TEXT NOT NULL DEFAULT 'publish',
  -- Diff hint precomputed at publish time so the timeline can show
  --   "12 fields changed across 3 sections" without re-running the diff.
  change_summary  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by      UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_page_revisions_tenant_idx ON cms_page_revisions(tenant_id);
CREATE INDEX IF NOT EXISTS cms_page_revisions_page_idx   ON cms_page_revisions(page_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON cms_page_revisions TO service_role;
GRANT SELECT ON cms_page_revisions TO authenticated, anon;

-- ── 2. cms_pages — pointers + dirty tracking ─────────────────────────
ALTER TABLE cms_pages
  ADD COLUMN IF NOT EXISTS published_revision_id UUID REFERENCES cms_page_revisions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS draft_updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_published_at     TIMESTAMPTZ;

COMMENT ON COLUMN cms_pages.published_revision_id IS
  'Pointer to the cms_page_revisions row the public storefront renders. NULL = never published.';
COMMENT ON COLUMN cms_pages.draft_updated_at IS
  'Bumped on every mutation. Compared to last_published_at to detect dirty state.';
COMMENT ON COLUMN cms_pages.last_published_at IS
  'Timestamp of the most recent publish. NULL = never published.';

-- ── 3. Trigger: keep draft_updated_at fresh on section mutations ─────
CREATE OR REPLACE FUNCTION cms_sections_bump_page_draft() RETURNS TRIGGER AS $$
BEGIN
  UPDATE cms_pages
  SET draft_updated_at = NOW()
  WHERE id = COALESCE(NEW.page_id, OLD.page_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cms_sections_bump_page_draft ON cms_sections;
CREATE TRIGGER trg_cms_sections_bump_page_draft
  AFTER INSERT OR UPDATE OR DELETE ON cms_sections
  FOR EACH ROW EXECUTE FUNCTION cms_sections_bump_page_draft();

-- Page-level mutations also bump it (in case the editor patches page_content / locale_meta).
CREATE OR REPLACE FUNCTION cms_pages_bump_self_draft() RETURNS TRIGGER AS $$
BEGIN
  -- Skip recursion when the trigger fires from its own UPDATE
  IF (TG_OP = 'UPDATE') AND (NEW.draft_updated_at IS DISTINCT FROM OLD.draft_updated_at) THEN
    -- The caller is the trigger itself or an explicit update — let it through unchanged.
    RETURN NEW;
  END IF;
  NEW.draft_updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cms_pages_bump_self_draft ON cms_pages;
CREATE TRIGGER trg_cms_pages_bump_self_draft
  BEFORE UPDATE ON cms_pages
  FOR EACH ROW EXECUTE FUNCTION cms_pages_bump_self_draft();

COMMIT;
