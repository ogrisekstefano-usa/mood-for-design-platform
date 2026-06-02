-- ITER197 · Persistent Extraction Jobs™
-- Replace fragile FastAPI BackgroundTasks with a DB-backed job system that
-- survives backend restarts, deployments, hotfixes and crashes.

CREATE TABLE IF NOT EXISTS extraction_jobs (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID        NOT NULL,
    catalog_set_id           UUID        NOT NULL,
    brand_id                 UUID,

    -- Lifecycle
    status                   TEXT        NOT NULL
                              CHECK (status IN ('queued','running','paused',
                                                'completed','failed','cancelled')),

    -- Live progress (continuously persisted)
    current_document_id      UUID,
    current_document_name    TEXT,
    current_page             INT         DEFAULT 0,
    total_pages              INT         DEFAULT 0,
    processed_pages          INT         DEFAULT 0,
    documents_total          INT         DEFAULT 0,
    documents_completed      INT         DEFAULT 0,
    documents_failed         INT         DEFAULT 0,
    progress_pct             NUMERIC(5,2) DEFAULT 0.0,

    -- Stage label for UI ("Vision Layer 2 · 35/95 immagini")
    current_stage            TEXT,
    current_stage_label      TEXT,
    current_vision_current   INT,
    current_vision_total     INT,

    -- Heartbeat — updated_at moves every persist; if a 'running' job's
    -- updated_at is older than 2 minutes it is considered orphaned.
    heartbeat_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Job control flags read by the runner at every persist; the runner
    -- honours these for cooperative pause/cancel.
    pause_requested          BOOLEAN     NOT NULL DEFAULT FALSE,
    cancel_requested         BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Configuration carried across restarts
    config_json              JSONB       NOT NULL DEFAULT '{}'::jsonb,
    -- Examples: {"max_candidates_per_doc": 600, "rebuild_index": true}

    -- Outcome
    error_message            TEXT,
    last_error_at            TIMESTAMPTZ,
    retry_count              INT         NOT NULL DEFAULT 0,

    -- Audit
    started_at               TIMESTAMPTZ,
    completed_at             TIMESTAMPTZ,
    created_by               UUID,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_tenant
    ON extraction_jobs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_set
    ON extraction_jobs (catalog_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status_heartbeat
    ON extraction_jobs (status, heartbeat_at);

-- Allow at most ONE active (queued/running/paused) job per catalog_set.
-- This is the queue gate: when a job completes/fails/cancels, a new one can
-- be enqueued for the same set without conflict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_extraction_jobs_active_per_set
    ON extraction_jobs (catalog_set_id)
    WHERE status IN ('queued','running','paused');
