-- ===== 003: WORKSPACE DEDICATED TABLES =====
-- Purpose: replace JSON blobs in tenant_settings with proper relational tables for
-- operational data: project notes, project activity stream, and moodboard share tokens.
-- The `tasks` table already exists and will simply be used directly by the refactored router.
-- Reversible: yes (DROP TABLE) — but data backfill is one-way.
-- Author: agent / 2026-05-13

BEGIN;

-- ── project_notes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_notes (
    id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by  UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_notes_project ON public.project_notes (project_id, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_notes_tenant  ON public.project_notes (tenant_id);

-- ── project_activity ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_activity (
    id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,           -- e.g. "task.created", "moodboard.approved"
    ref_id      UUID,                    -- related resource (task_id, moodboard_id, ...)
    label       TEXT,                    -- denormalized human-readable
    payload     JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_activity_project ON public.project_activity (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_tenant  ON public.project_activity (tenant_id, created_at DESC);

-- ── moodboard_shares ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moodboard_shares (
    id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    moodboard_id UUID NOT NULL REFERENCES public.moodboards(id) ON DELETE CASCADE,
    token        TEXT NOT NULL UNIQUE,
    created_by   UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ,           -- nullable = no expiry
    revoked_at   TIMESTAMPTZ,
    view_count   INTEGER NOT NULL DEFAULT 0,
    first_viewed_at TIMESTAMPTZ,
    last_viewed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_moodboard_shares_token     ON public.moodboard_shares (token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_moodboard_shares_moodboard ON public.moodboard_shares (moodboard_id);

-- ── BACKFILL from tenant_settings (legacy) ────────────────────────────────
-- 1) project_notes
INSERT INTO public.project_notes (id, tenant_id, project_id, body, pinned, created_at, updated_at)
SELECT
    COALESCE((item ->> 'id')::uuid, extensions.uuid_generate_v4()),
    ts.tenant_id,
    -- key format: project.{project_id}.notes
    split_part(ts.key, '.', 2)::uuid AS project_id,
    COALESCE(item ->> 'body', '(empty)'),
    COALESCE((item ->> 'pinned')::bool, FALSE),
    COALESCE((item ->> 'created_at')::timestamptz, now()),
    COALESCE((item ->> 'updated_at')::timestamptz, now())
FROM public.tenant_settings ts
CROSS JOIN LATERAL jsonb_array_elements(ts.value_json -> 'items') AS item
WHERE ts.key LIKE 'project.%.notes'
  AND ts.value_json -> 'items' IS NOT NULL
  AND jsonb_typeof(ts.value_json -> 'items') = 'array'
ON CONFLICT (id) DO NOTHING;

-- 2) project_activity
INSERT INTO public.project_activity (id, tenant_id, project_id, actor_id, event_type, ref_id, label, payload, created_at)
SELECT
    COALESCE((item ->> 'id')::uuid, extensions.uuid_generate_v4()),
    ts.tenant_id,
    split_part(ts.key, '.', 2)::uuid AS project_id,
    NULLIF(item ->> 'actor_id', '')::uuid,
    COALESCE(item ->> 'type', 'unknown'),
    NULLIF(item ->> 'ref_id', '')::uuid,
    item ->> 'label',
    item - 'id' - 'tenant_id' - 'project_id' - 'actor_id' - 'type' - 'ref_id' - 'label' - 'at',
    COALESCE((item ->> 'at')::timestamptz, now())
FROM public.tenant_settings ts
CROSS JOIN LATERAL jsonb_array_elements(ts.value_json -> 'items') AS item
WHERE ts.key LIKE 'project.%.activity'
  AND ts.value_json -> 'items' IS NOT NULL
  AND jsonb_typeof(ts.value_json -> 'items') = 'array'
ON CONFLICT (id) DO NOTHING;

-- 3) moodboard_shares (skip orphan references — moodboards may have been deleted)
INSERT INTO public.moodboard_shares (tenant_id, moodboard_id, token, created_at)
SELECT
    ts.tenant_id,
    -- key format: moodboard_share.{token}
    (ts.value_json ->> 'moodboard_id')::uuid,
    split_part(ts.key, '.', 2),
    COALESCE((ts.value_json ->> 'created_at')::timestamptz, now())
FROM public.tenant_settings ts
WHERE ts.key LIKE 'moodboard_share.%'
  AND ts.value_json ->> 'moodboard_id' IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM public.moodboards m
      WHERE m.id = (ts.value_json ->> 'moodboard_id')::uuid
  )
ON CONFLICT (token) DO NOTHING;

COMMIT;
