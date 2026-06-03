-- ═══════════════════════════════════════════════════════════════════════
-- Migration 034 — Activity Log Advanced™ (M3 · Relationship Memory Layer)
-- Generated: 2026-06-02
-- Spec:      /app/memory/M3_FINAL_EXECUTION_PLAN.md
-- Idempotent: YES · Rollback: 034_*.rollback.sql
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

-- ─── 1. Memory layer fields ─────────────────────────────────────────
ALTER TABLE relationship_activities
    ADD COLUMN IF NOT EXISTS notes                 TEXT,
    ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_by            UUID,
    ADD COLUMN IF NOT EXISTS importance            SMALLINT,
    ADD COLUMN IF NOT EXISTS sentiment             SMALLINT,
    ADD COLUMN IF NOT EXISTS source_code           TEXT,
    ADD COLUMN IF NOT EXISTS activity_outcome_code TEXT;

-- ─── 2. Catalog tables (D2 + D3) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_activity_sources (
    code        TEXT PRIMARY KEY,
    label_it    TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    icon        TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 100,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_activity_outcomes (
    code        TEXT PRIMARY KEY,
    label_it    TEXT NOT NULL,
    label_en    TEXT NOT NULL,
    icon        TEXT,
    color       TEXT,
    is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INTEGER NOT NULL DEFAULT 100,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Soft FKs ─────────────────────────────────────────────────────
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name='relationship_activities_created_by_fkey') THEN
        ALTER TABLE relationship_activities
          ADD CONSTRAINT relationship_activities_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name='relationship_activities_source_code_fkey') THEN
        ALTER TABLE relationship_activities
          ADD CONSTRAINT relationship_activities_source_code_fkey
          FOREIGN KEY (source_code) REFERENCES platform_activity_sources(code) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name='relationship_activities_outcome_code_fkey') THEN
        ALTER TABLE relationship_activities
          ADD CONSTRAINT relationship_activities_outcome_code_fkey
          FOREIGN KEY (activity_outcome_code) REFERENCES platform_activity_outcomes(code) ON DELETE SET NULL;
    END IF;
END $$;

-- ─── 4. Operational indexes ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activities_next_step_due
    ON relationship_activities (tenant_id, next_step_due_at)
    WHERE next_step_due_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_owner_open
    ON relationship_activities (owner_user_id, next_step_due_at)
    WHERE next_step_due_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_outcome
    ON relationship_activities (tenant_id, activity_outcome_code)
    WHERE activity_outcome_code IS NOT NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_source
    ON relationship_activities (tenant_id, source_code)
    WHERE source_code IS NOT NULL AND archived_at IS NULL;

-- ─── 5. FTS GIN index for search (D5) ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activities_search_fts
    ON relationship_activities
       USING gin (to_tsvector('simple',
                              coalesce(subject,'')   || ' ' ||
                              coalesce(outcome,'')   || ' ' ||
                              coalesce(next_step,'') || ' ' ||
                              coalesce(notes,'')));

COMMIT;

-- End of migration 034
