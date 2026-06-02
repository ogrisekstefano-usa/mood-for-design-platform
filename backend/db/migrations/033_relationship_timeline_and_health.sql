-- ═══════════════════════════════════════════════════════════════════════
-- Migration 033 — Relationship Timeline + Health Foundation (M2)
-- Generated: 2026-06-02
-- Spec:      /app/memory/M2_RELATIONSHIP_TIMELINE_FINAL_EXECUTION_PLAN.md
--            /app/memory/M2_IMPLEMENTATION_KICKOFF_REPORT.md
-- Idempotent: YES (all ALTER use IF NOT EXISTS / IF EXISTS)
-- Rollback:   db/migrations/033_relationship_timeline_and_health.rollback.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1.  Health hooks on tenants (data-only) ──────────────────────────
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS relationship_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_touch_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_relationship_score
    ON tenants(relationship_score DESC) WHERE relationship_score > 0;

-- ─── 2.  Catalog drivers for event types ──────────────────────────────
ALTER TABLE platform_relationship_event_types
    ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS visibility  TEXT    NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS notifiable  BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'platform_relationship_event_types_visibility_chk'
    ) THEN
        ALTER TABLE platform_relationship_event_types
          ADD CONSTRAINT platform_relationship_event_types_visibility_chk
          CHECK (visibility IN ('all','admin_only'));
    END IF;
END $$;

-- ─── 3.  Catalog drivers for activity types ───────────────────────────
ALTER TABLE platform_activity_types
    ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS visibility  TEXT    NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS notifiable  BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'platform_activity_types_visibility_chk'
    ) THEN
        ALTER TABLE platform_activity_types
          ADD CONSTRAINT platform_activity_types_visibility_chk
          CHECK (visibility IN ('all','admin_only'));
    END IF;
END $$;

COMMIT;

-- End of migration 033
