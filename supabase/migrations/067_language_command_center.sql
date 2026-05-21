-- 067 · Sprint ITER127 · Language Command Center™
-- Runtime-editable UI copy overrides + audit history.
BEGIN;

CREATE TABLE IF NOT EXISTS localization_overrides (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_path      text NOT NULL,            -- e.g. 'brand_atlas.hero.title'
    locale        text NOT NULL,            -- BCP-47 (it-IT, en-US, ...)
    surface       text,                     -- optional page/surface tag
    source_text   text,                     -- the original string before override
    override_text text NOT NULL,
    review_status text NOT NULL DEFAULT 'human_reviewed'
                  CHECK (review_status IN ('ai_suggested','human_reviewed','locked_approved','stale')),
    reviewed_by   uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    reviewed_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_localization_overrides
    ON localization_overrides (tenant_id, key_path, locale);
CREATE INDEX IF NOT EXISTS ix_localization_overrides_tenant
    ON localization_overrides (tenant_id, surface);

CREATE TABLE IF NOT EXISTS localization_audit_runs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
    locale        text NOT NULL,
    pages_scanned int NOT NULL DEFAULT 0,
    leaks_total   int NOT NULL DEFAULT 0,
    missing_total int NOT NULL DEFAULT 0,
    report_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
    triggered_by  uuid REFERENCES users_profile(id) ON DELETE SET NULL,
    triggered_via text,                       -- 'cli' | 'ui' | 'ci'
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_localization_audit_runs_tenant
    ON localization_audit_runs (tenant_id, created_at DESC);

COMMIT;
