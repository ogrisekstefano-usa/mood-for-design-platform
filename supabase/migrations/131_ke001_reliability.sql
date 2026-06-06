-- ═══════════════════════════════════════════════════════════════════════
-- 131 · KE-001 · KNOWLEDGE ENGINE PRODUCTION RELIABILITY™
-- ═══════════════════════════════════════════════════════════════════════
-- Sprint KE-001 · Production Reliability Foundation.
--
-- Pure additive migration. Safe rollback:
--   DROP TABLE extraction_event_log;
--   ALTER TABLE extraction_jobs DROP COLUMN last_activity_at, last_seen_at,
--     stalled_at, worker_id, parent_job_id, estimated_remaining_seconds;
--   ALTER TABLE extraction_jobs DROP CONSTRAINT extraction_jobs_status_chk;
--
-- Layers introduced:
--   §1  extraction_jobs · new 'stalled' state + recovery + foundation fields
--   §2  extraction_event_log · append-only event stream
--   §3  TTL purge view
--   §4  schema_migrations stamp
-- ═══════════════════════════════════════════════════════════════════════


-- §1 · extraction_jobs — stalled state + recovery foundation ──────────
ALTER TABLE extraction_jobs
  DROP CONSTRAINT IF EXISTS extraction_jobs_status_check;
ALTER TABLE extraction_jobs
  DROP CONSTRAINT IF EXISTS extraction_jobs_status_chk;
ALTER TABLE extraction_jobs ADD CONSTRAINT extraction_jobs_status_chk
  CHECK (status IN (
    'queued', 'running', 'paused', 'stalled',
    'failed', 'cancelled', 'completed'
  ));

-- Recovery + worker tracking
ALTER TABLE extraction_jobs
  ADD COLUMN IF NOT EXISTS last_seen_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stalled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_id         TEXT,
  ADD COLUMN IF NOT EXISTS parent_job_id     UUID
    REFERENCES extraction_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_remaining_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_ej_recovery_scan
  ON extraction_jobs (status, heartbeat_at)
  WHERE status IN ('running', 'stalled');

CREATE INDEX IF NOT EXISTS idx_ej_set_status
  ON extraction_jobs (catalog_set_id, status);

COMMENT ON COLUMN extraction_jobs.last_seen_at IS
  'KE-001 · Last heartbeat tick (= "worker is alive"). Updated every persist_current.';
COMMENT ON COLUMN extraction_jobs.last_activity_at IS
  'KE-001 · Last meaningful state change (= "real progress happened"). '
  'Distinct from heartbeat: progress vs liveness.';
COMMENT ON COLUMN extraction_jobs.stalled_at IS
  'KE-001 · When the orphan scanner demoted this job from running to stalled.';
COMMENT ON COLUMN extraction_jobs.worker_id IS
  'KE-001 · Worker process identifier (hostname:pid). Helps correlate logs.';
COMMENT ON COLUMN extraction_jobs.estimated_remaining_seconds IS
  'KE-001 · Live ETA recomputed at every persist_current. Foundation for KE-002 UI.';
COMMENT ON COLUMN extraction_jobs.parent_job_id IS
  'KE-001 · If this job was spawned by recovery or by retry, points to the predecessor.';


-- §2 · extraction_event_log — append-only event stream ────────────────
-- Consumed by: KE-002 Control Room (Live Activity Stream, Worker Status,
-- KPI Engine, Warning Center), Notification Center (M4), Audit Trail.
CREATE TABLE IF NOT EXISTS extraction_event_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id       UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  catalog_document_id  UUID,                   -- nullable (job-level events)
  job_id               UUID,                   -- nullable (out-of-band events)
  ts                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind                 TEXT NOT NULL,
  message              TEXT NOT NULL,
  entity_id            UUID,                   -- when the event is entity-bound
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT extraction_event_log_kind_chk CHECK (
    kind IN (
      -- Job lifecycle
      'JOB_STARTED', 'JOB_COMPLETED', 'JOB_FAILED',
      'JOB_STALLED', 'JOB_RECOVERED',
      'JOB_PAUSED', 'JOB_RESUMED', 'JOB_CANCELLED',
      -- Document lifecycle
      'DOCUMENT_STARTED', 'DOCUMENT_FAILED', 'DOCUMENT_COMPLETED',
      'DOCUMENT_RETRIED',
      -- Page-level
      'PAGE_PROCESSED',
      'STAGE_TRANSITION',
      -- Entity discoveries (feeds Live Activity Stream + KPI engine)
      'IMAGE_FOUND', 'PRODUCT_FOUND', 'DESIGNER_FOUND',
      'MATERIAL_FOUND', 'BRAND_ALIAS_FOUND', 'RELATION_FOUND',
      -- Quality signals (feeds Warning Center + Notification Center)
      'WARNING_CREATED', 'ERROR'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_eel_set_ts
  ON extraction_event_log (catalog_set_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_eel_job_ts
  ON extraction_event_log (job_id, ts DESC)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eel_kind_set
  ON extraction_event_log (catalog_set_id, kind, ts DESC);

COMMENT ON TABLE extraction_event_log IS
  'KE-001 · Append-only event stream for Knowledge Engine extraction. '
  'Consumed by Control Room (KE-002 Live Activity Stream / Worker Status / KPI / '
  'Warning Center), Notification Center, Audit Trail.';


-- §3 · TTL purge helper view (rows older than 30 days) ───────────────
CREATE OR REPLACE VIEW extraction_event_log_to_purge AS
  SELECT id, tenant_id, catalog_set_id, ts, kind
  FROM extraction_event_log
  WHERE ts < NOW() - INTERVAL '30 days';

COMMENT ON VIEW extraction_event_log_to_purge IS
  'KE-001 · purgeable event rows (> 30 days). Drain via cron in KE-002.';


-- §4 · stamp ─────────────────────────────────────────────────────────
INSERT INTO schema_migrations (version, applied_at)
VALUES ('131_ke001_reliability', NOW())
ON CONFLICT (version) DO NOTHING;
