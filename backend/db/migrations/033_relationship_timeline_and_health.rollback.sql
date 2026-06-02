-- Rollback for migration 033 — Relationship Timeline + Health Foundation
-- Idempotent: YES

BEGIN;

ALTER TABLE platform_activity_types
    DROP CONSTRAINT IF EXISTS platform_activity_types_visibility_chk,
    DROP COLUMN IF EXISTS score_delta,
    DROP COLUMN IF EXISTS touch,
    DROP COLUMN IF EXISTS visibility,
    DROP COLUMN IF EXISTS notifiable;

ALTER TABLE platform_relationship_event_types
    DROP CONSTRAINT IF EXISTS platform_relationship_event_types_visibility_chk,
    DROP COLUMN IF EXISTS score_delta,
    DROP COLUMN IF EXISTS touch,
    DROP COLUMN IF EXISTS visibility,
    DROP COLUMN IF EXISTS notifiable;

DROP INDEX IF EXISTS idx_tenants_relationship_score;

ALTER TABLE tenants
    DROP COLUMN IF EXISTS relationship_score,
    DROP COLUMN IF EXISTS last_touch_at;

COMMIT;
