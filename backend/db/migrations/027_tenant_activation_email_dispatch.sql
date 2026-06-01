-- ========================================================================
-- 027_tenant_activation_email_dispatch.sql
-- Persistent audit/retry log for transactional emails driven by the CMS.
-- ========================================================================

CREATE TABLE IF NOT EXISTS studio_email_dispatch_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key    text        NOT NULL,
    to_email        text        NOT NULL,
    locale          text        NOT NULL DEFAULT 'it-IT',
    subject         text,
    variables       jsonb       NOT NULL DEFAULT '{}'::jsonb,
    status          text        NOT NULL DEFAULT 'pending',   -- pending|sent|failed|sandbox
    error           text,
    external_id     text,
    retry_count     integer     NOT NULL DEFAULT 0,
    last_retry_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_dispatch_status
    ON studio_email_dispatch_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_template
    ON studio_email_dispatch_log (template_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_to
    ON studio_email_dispatch_log (to_email);
