-- Rollback for migration 034 — M3 Activity Log Advanced
BEGIN;
DROP INDEX IF EXISTS idx_activities_search_fts;
DROP INDEX IF EXISTS idx_activities_source;
DROP INDEX IF EXISTS idx_activities_outcome;
DROP INDEX IF EXISTS idx_activities_owner_open;
DROP INDEX IF EXISTS idx_activities_next_step_due;

ALTER TABLE relationship_activities
    DROP CONSTRAINT IF EXISTS relationship_activities_outcome_code_fkey,
    DROP CONSTRAINT IF EXISTS relationship_activities_source_code_fkey,
    DROP CONSTRAINT IF EXISTS relationship_activities_created_by_fkey,
    DROP COLUMN IF EXISTS activity_outcome_code,
    DROP COLUMN IF EXISTS source_code,
    DROP COLUMN IF EXISTS sentiment,
    DROP COLUMN IF EXISTS importance,
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS completed_at,
    DROP COLUMN IF EXISTS notes;

DROP TABLE IF EXISTS platform_activity_outcomes;
DROP TABLE IF EXISTS platform_activity_sources;
COMMIT;
