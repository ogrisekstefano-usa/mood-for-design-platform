-- ===== 006: MOODBOARD V2 SCAFFOLD =====
-- Purpose: create the relational scaffold for Moodboards V2 features (templates,
-- versions, comments). These tables are NOT yet exposed via API/UI in V1 — they
-- exist to prevent schema drift when V2 features land.
--
-- Design principles:
--   - All tables tenant-scoped (multi-tenant ready)
--   - Reuse the moodboard_status enum philosophy: dedicated enums or text + CHECK
--   - JSONB only for structured but optional payloads (preview, layout snapshot)
--   - Indexes on all foreign keys + hot-path composite keys
--   - Forward-ready columns reserved (no need for future ALTER): ai_metadata, analytics_metadata
--
-- Reversible: yes (DROP TABLE …).
-- Author: agent / 2026-05-13

BEGIN;

-- ── 1. MOODBOARD_TEMPLATES ──────────────────────────────────────────────────
-- Supports global (tenant_id=NULL → only super_admin) + tenant-owned templates.
-- Designed for: cloning, category/tag system, visibility rules, future marketplace.
CREATE TABLE IF NOT EXISTS public.moodboard_templates (
    id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
        -- NULL = global (platform-provided); UUID = tenant-owned
    parent_id       UUID REFERENCES public.moodboard_templates(id) ON DELETE SET NULL,
        -- forked-from tracking
    slug            TEXT NOT NULL,
        -- e.g. "luxury-editorial" — unique per scope (tenant or global)
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
        -- e.g. residential|hospitality|retail|materials_board|ff_e|concept|editorial
    tags            TEXT[] DEFAULT ARRAY[]::TEXT[],
    preview_image   TEXT,          -- URL (Supabase Storage path)
    cover_strategy  TEXT DEFAULT 'auto',
    settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
        -- canvas dimensions, snap defaults, grid, palette suggestions
    locale_content  JSONB NOT NULL DEFAULT '{}'::jsonb,
        -- i18n strings per locale: {en-US:{name,description}, it:{...}}
    visibility      TEXT NOT NULL DEFAULT 'private',
        -- private | tenant | platform | marketplace (V3)
    is_starter      BOOLEAN NOT NULL DEFAULT FALSE,
        -- shown in "Quick start" picker
    sort_order      INTEGER NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,    -- V3 hooks
    analytics_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- usage tracking V3
    created_by      UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ,
    archived_at     TIMESTAMPTZ,
    CONSTRAINT mb_templates_visibility_check
        CHECK (visibility IN ('private', 'tenant', 'platform', 'marketplace'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mb_templates_slug_scope
    ON public.moodboard_templates (COALESCE(tenant_id::text, 'platform'), slug);
CREATE INDEX IF NOT EXISTS idx_mb_templates_tenant ON public.moodboard_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mb_templates_category ON public.moodboard_templates (category);
CREATE INDEX IF NOT EXISTS idx_mb_templates_tags_gin ON public.moodboard_templates USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_mb_templates_starter ON public.moodboard_templates (is_starter) WHERE is_starter = TRUE;


-- ── 2. TEMPLATE_BLOCKS ───────────────────────────────────────────────────────
-- The block layout for each template. Same shape as moodboard_elements but
-- decoupled (so editing a template never touches an existing moodboard's blocks).
CREATE TABLE IF NOT EXISTS public.template_blocks (
    id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    template_id     UUID NOT NULL REFERENCES public.moodboard_templates(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,    -- same vocab as moodboard_elements.type
    title           TEXT,
    image_url       TEXT,
    content         JSONB NOT NULL DEFAULT '{}'::jsonb,
    position_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    style_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    locked          BOOLEAN NOT NULL DEFAULT FALSE,
    hidden          BOOLEAN NOT NULL DEFAULT FALSE,
    opacity         NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    rotation        NUMERIC(6,2) NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_template_blocks_template_sort
    ON public.template_blocks (template_id, sort_order);


-- ── 3. MOODBOARD_VERSIONS ────────────────────────────────────────────────────
-- Full snapshot system. Designed for:
--   - autosave snapshots (kind='autosave', short retention)
--   - named manual versions (kind='named')
--   - presentation checkpoints (kind='presentation')
--   - branching/forks (parent_version_id)
--   - compare (any two version IDs)
--   - rollback (apply snapshot back to moodboard + moodboard_elements)
CREATE TABLE IF NOT EXISTS public.moodboard_versions (
    id                  UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    moodboard_id        UUID NOT NULL REFERENCES public.moodboards(id) ON DELETE CASCADE,
    parent_version_id   UUID REFERENCES public.moodboard_versions(id) ON DELETE SET NULL,
    version_number      INTEGER NOT NULL,
        -- monotonic per moodboard, set client-side via SELECT max(version_number)+1
    kind                TEXT NOT NULL DEFAULT 'named',
        -- autosave | named | presentation | rollback_restore | client_view_snapshot
    name                TEXT,
    description         TEXT,
    snapshot            JSONB NOT NULL,
        -- full {moodboard:{…}, elements:[…]} payload at moment of capture
    layout_hash         TEXT,         -- fast diff / dedupe key
    block_count         INTEGER NOT NULL DEFAULT 0,
    is_milestone        BOOLEAN NOT NULL DEFAULT FALSE,
        -- promotable autosave → named
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by          UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mb_versions_moodboard_v
    ON public.moodboard_versions (moodboard_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_mb_versions_moodboard_kind
    ON public.moodboard_versions (moodboard_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mb_versions_tenant
    ON public.moodboard_versions (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mb_versions_moodboard_v_unique
    ON public.moodboard_versions (moodboard_id, version_number);


-- ── 4. MOODBOARD_COMMENTS ────────────────────────────────────────────────────
-- Designed for:
--   - block-anchored comments (block_id set)
--   - canvas-anchored comments (block_id null, canvas_x/y set) for spatial pinning
--   - general comments (no anchors)
--   - threaded replies (parent_comment_id)
--   - resolved/unresolved
--   - client/designer/anonymous-share authors (author_role + optional author_email)
--   - mentions (mentioned_user_ids array)
--   - activity stream integration via project_activity (foreign push)
CREATE TABLE IF NOT EXISTS public.moodboard_comments (
    id                  UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    moodboard_id        UUID NOT NULL REFERENCES public.moodboards(id) ON DELETE CASCADE,
    block_id            UUID REFERENCES public.moodboard_elements(id) ON DELETE SET NULL,
        -- NULL = canvas-anchored or general
    parent_comment_id   UUID REFERENCES public.moodboard_comments(id) ON DELETE CASCADE,
        -- NULL = root comment; UUID = reply
    canvas_x            NUMERIC(10,2),
    canvas_y            NUMERIC(10,2),
    author_id           UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
        -- NULL only when author_role='anonymous_share'
    author_role         TEXT NOT NULL DEFAULT 'designer',
        -- designer | client | super_admin | anonymous_share
    author_name         TEXT,    -- denormalized for anonymous + historical display
    author_email        TEXT,    -- only set when via share-link anonymous
    body                TEXT NOT NULL,
    body_format         TEXT NOT NULL DEFAULT 'plain',
        -- plain | markdown
    mentioned_user_ids  UUID[] DEFAULT ARRAY[]::UUID[],
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at         TIMESTAMPTZ,
    resolved_by         UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
    edited_at           TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mb_comments_role_check
        CHECK (author_role IN ('designer', 'client', 'super_admin', 'anonymous_share'))
);
CREATE INDEX IF NOT EXISTS idx_mb_comments_moodboard
    ON public.moodboard_comments (moodboard_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mb_comments_block
    ON public.moodboard_comments (block_id);
CREATE INDEX IF NOT EXISTS idx_mb_comments_unresolved
    ON public.moodboard_comments (moodboard_id, resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_mb_comments_parent
    ON public.moodboard_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_mb_comments_tenant
    ON public.moodboard_comments (tenant_id);


-- ── 5. Grants (PostgREST needs these to expose new tables) ──────────────────
GRANT ALL ON TABLE public.moodboard_templates  TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.template_blocks      TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.moodboard_versions   TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.moodboard_comments   TO service_role, authenticated, anon;

COMMIT;
