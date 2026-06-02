-- ═══════════════════════════════════════════════════════════════════════
-- Migration 031 — Relationship OS™ Foundation (M0)
-- Generated: 2026-06-02
-- Spec:       /app/memory/RELATIONSHIP_OS_FOUNDATION_PLAN.md (v2)
--             /app/memory/COMMAND_CENTER_CRM_M1_EXECUTION_PLAN.md
-- Idempotent: YES (all CREATE/ALTER use IF NOT EXISTS / IF EXISTS)
-- Rollback:   db/migrations/031_relationship_os_foundation.rollback.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1.  CATALOG TABLES ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_relationship_event_types (
    code              TEXT PRIMARY KEY,
    category          TEXT NOT NULL,             -- 'lifecycle'|'communication'|'manual'|'system'
    source            TEXT NOT NULL,             -- 'auto'|'manual'
    show_in_timeline  BOOLEAN NOT NULL DEFAULT TRUE,
    icon              TEXT,
    color             TEXT,
    label_it          TEXT NOT NULL,
    label_en          TEXT NOT NULL,
    sort_order        INTEGER NOT NULL DEFAULT 100,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE platform_relationship_event_types IS
  'Catalog of relationship-timeline event kinds. DB-driven, seeded via scripts/seed_relationship_event_types.py';

CREATE TABLE IF NOT EXISTS platform_contact_roles (
    code              TEXT PRIMARY KEY,
    category          TEXT NOT NULL,             -- 'leadership'|'operations'|'commercial'|'creative'|'external'
    icon              TEXT,                       -- Lucide icon name (DB-driven UI)
    label_it          TEXT NOT NULL,
    label_en          TEXT NOT NULL,
    sort_order        INTEGER NOT NULL DEFAULT 100,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE platform_contact_roles IS
  'Catalog of tenant-contact roles. DB-driven, seeded via scripts/seed_contact_roles.py';

CREATE TABLE IF NOT EXISTS platform_activity_types (
    code                 TEXT PRIMARY KEY,
    icon                 TEXT,
    default_duration_min INTEGER,
    show_in_timeline     BOOLEAN NOT NULL DEFAULT TRUE,
    quick_action_m1      BOOLEAN NOT NULL DEFAULT FALSE,
    label_it             TEXT NOT NULL,
    label_en             TEXT NOT NULL,
    sort_order           INTEGER NOT NULL DEFAULT 100,
    enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE platform_activity_types IS
  'Catalog of commercial activity kinds. DB-driven, seeded via scripts/seed_activity_types.py';

CREATE TABLE IF NOT EXISTS platform_contact_sources (
    code              TEXT PRIMARY KEY,
    icon              TEXT,
    label_it          TEXT NOT NULL,
    label_en          TEXT NOT NULL,
    sort_order        INTEGER NOT NULL DEFAULT 100,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE platform_contact_sources IS
  'Catalog of contact-provenance sources. DB-driven, seeded via scripts/seed_contact_sources.py';

-- ─── 2.  tenant_contacts (D1 canonical) ────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_contacts (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    studio_relation_id          UUID NULL REFERENCES studio_relations(id) ON DELETE SET NULL,
    user_id                     UUID NULL REFERENCES users(id) ON DELETE SET NULL,

    -- Identity
    first_name                  TEXT NOT NULL,
    last_name                   TEXT,
    role_code                   TEXT NOT NULL REFERENCES platform_contact_roles(code),

    -- Contact channels
    email                       TEXT,
    phone_prefix                TEXT,
    phone_number                TEXT,
    linkedin_url                TEXT,

    -- Locale
    preferred_language          TEXT REFERENCES platform_languages(code),

    -- Relationship metadata
    is_primary                  BOOLEAN NOT NULL DEFAULT FALSE,
    status                      TEXT NOT NULL DEFAULT 'active',  -- active|inactive|archived
    notes                       TEXT,
    metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Relationship owner (M1 mandatory)
    relationship_owner_user_id  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    owner_assigned_at           TIMESTAMPTZ,
    owner_assigned_by           UUID NULL REFERENCES users(id) ON DELETE SET NULL,

    -- Contact provenance (catalog-driven)
    source_code                 TEXT NULL REFERENCES platform_contact_sources(code),
    source_reference            TEXT,

    -- Relationship readiness (data signals, no app logic in M1)
    relationship_score          INTEGER NOT NULL DEFAULT 0,
    last_touch_at               TIMESTAMPTZ,

    -- Audit
    created_by                  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at            TIMESTAMPTZ,
    archived_at                 TIMESTAMPTZ
);
COMMENT ON TABLE tenant_contacts IS
  'Canonical multi-contact store per tenant (Relationship OS D1, 2026-06-02). Replaces contacts/studio_team_members.';

-- Indici dimensionati per 150 tenant × 500+ contatti
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_tenant_status
    ON tenant_contacts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_relation
    ON tenant_contacts(studio_relation_id) WHERE studio_relation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_email_lower
    ON tenant_contacts(tenant_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_contacts_primary_active
    ON tenant_contacts(tenant_id) WHERE is_primary = TRUE AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_role
    ON tenant_contacts(tenant_id, role_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_owner
    ON tenant_contacts(relationship_owner_user_id, status)
    WHERE relationship_owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_score
    ON tenant_contacts(tenant_id, relationship_score DESC)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_source
    ON tenant_contacts(source_code) WHERE source_code IS NOT NULL;

-- Fulltext search (M1 §5)
CREATE INDEX IF NOT EXISTS idx_tenant_contacts_search
    ON tenant_contacts USING gin (
      to_tsvector('simple',
        coalesce(first_name,'') ||' '|| coalesce(last_name,'') ||' '||
        coalesce(email,'')      ||' '|| coalesce(phone_number,''))
    );

CREATE INDEX IF NOT EXISTS idx_studio_relations_search
    ON studio_relations USING gin (
      to_tsvector('simple',
        coalesce(studio_name,'') ||' '|| coalesce(website,'') ||' '||
        coalesce(legal_name,''))
    );

-- ─── 3.  relationship_activities ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relationship_activities (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    studio_relation_id          UUID NULL REFERENCES studio_relations(id) ON DELETE SET NULL,
    contact_id                  UUID NULL REFERENCES tenant_contacts(id) ON DELETE SET NULL,
    owner_user_id               UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    activity_type_code          TEXT NOT NULL REFERENCES platform_activity_types(code),
    occurred_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_min                INTEGER,
    subject                     TEXT,
    outcome                     TEXT,
    next_step                   TEXT,
    next_step_due_at            TIMESTAMPTZ,
    reminder_sent_at            TIMESTAMPTZ,
    payload                     JSONB NOT NULL DEFAULT '{}'::jsonb,
    archived_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE relationship_activities IS
  'Canonical commercial activity log (call/meeting/email/...). Replaces advisor_lead_activities.';

CREATE INDEX IF NOT EXISTS idx_relationship_activities_tenant_when
    ON relationship_activities(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_activities_owner_due
    ON relationship_activities(owner_user_id, next_step_due_at)
    WHERE next_step_due_at IS NOT NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_activities_contact
    ON relationship_activities(contact_id, occurred_at DESC)
    WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_activities_relation
    ON relationship_activities(studio_relation_id, occurred_at DESC)
    WHERE studio_relation_id IS NOT NULL;

-- ─── 4.  ALTER studio_relationship_events ──────────────────────────────

ALTER TABLE studio_relationship_events
    ADD COLUMN IF NOT EXISTS tenant_id       UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS event_type_code TEXT NULL;

-- FK on event_type_code is added AFTER seeds run (script step 2)
-- so the migration itself never references unpopulated catalog rows.

CREATE INDEX IF NOT EXISTS idx_relationship_events_tenant_when
    ON studio_relationship_events(tenant_id, occurred_at DESC);

-- Backfill tenant_id from studio_relations
UPDATE studio_relationship_events e
   SET tenant_id = sr.tenant_id
  FROM studio_relations sr
 WHERE e.relation_id = sr.id
   AND e.tenant_id IS NULL
   AND sr.tenant_id IS NOT NULL;

-- ─── 5.  relationship_notifications — indici partial ───────────────────

CREATE INDEX IF NOT EXISTS idx_relationship_notifications_recipient_unread
    ON relationship_notifications(recipient_user_id, created_at DESC)
    WHERE read_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_notifications_tenant_unread
    ON relationship_notifications(tenant_id, created_at DESC)
    WHERE read_at IS NULL AND archived_at IS NULL;

-- ─── 6.  v_relationship_timeline (D5 filtrata) ─────────────────────────

CREATE OR REPLACE VIEW v_relationship_timeline AS
    -- 6.1) Lifecycle / manual events
    SELECT
        'event'::TEXT                 AS source,
        e.id,
        e.tenant_id,
        e.relation_id,
        e.event_type_code             AS type_code,
        NULL::TEXT                    AS subject,
        e.payload,
        e.actor_id                    AS owner_user_id,
        e.occurred_at                 AS at
    FROM studio_relationship_events e
    LEFT JOIN platform_relationship_event_types t
           ON t.code = e.event_type_code
    WHERE e.tenant_id IS NOT NULL
      AND (t.code IS NULL OR t.show_in_timeline = TRUE)
    UNION ALL
    -- 6.2) Email events (D5 whitelist, tenant derived via studio_relations)
    SELECT
        'email'::TEXT                 AS source,
        l.id,
        sr.tenant_id                  AS tenant_id,
        sr.id                         AS relation_id,
        l.template_key                AS type_code,
        l.subject,
        l.variables                   AS payload,
        NULL::UUID                    AS owner_user_id,
        l.created_at                  AS at
    FROM studio_email_dispatch_log l
    LEFT JOIN studio_relations sr
           ON sr.studio_request_id = ((l.variables->>'request_id'))::uuid
    WHERE sr.tenant_id IS NOT NULL
      AND l.template_key IN (
        'studio_request_received',
        'studio_request_review',
        'studio_request_qualified',
        'studio_request_approved',
        'admin_new_studio_request',
        'founder_invitation_resent',
        'tenant_activated_notice'
      )
    UNION ALL
    -- 6.3) Commercial activities
    SELECT
        'activity'::TEXT              AS source,
        a.id,
        a.tenant_id,
        a.studio_relation_id          AS relation_id,
        a.activity_type_code          AS type_code,
        a.subject,
        a.payload,
        a.owner_user_id,
        a.occurred_at                 AS at
    FROM relationship_activities a
    JOIN platform_activity_types t
      ON t.code = a.activity_type_code
    WHERE a.archived_at IS NULL
      AND t.show_in_timeline = TRUE;

COMMENT ON VIEW v_relationship_timeline IS
  'Unified relationship timeline (events + whitelisted emails + activities). D5 filter applied.';

-- ─── 7.  LEGACY READ-ONLY (D2 — congelate, no drop, no migrate ora) ────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='contacts') THEN
    EXECUTE 'COMMENT ON TABLE contacts IS ''LEGACY · READ-ONLY · Replaced by tenant_contacts (Relationship OS D2, 2026-06-02)''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='accounts') THEN
    EXECUTE 'COMMENT ON TABLE accounts IS ''LEGACY · READ-ONLY · Replaced by tenants (Relationship OS D2, 2026-06-02)''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='studio_team_members') THEN
    EXECUTE 'COMMENT ON TABLE studio_team_members IS ''LEGACY · READ-ONLY · Replaced by tenant_contacts (Relationship OS D2, 2026-06-02)''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
    EXECUTE 'COMMENT ON TABLE notifications IS ''LEGACY · READ-ONLY · Replaced by relationship_notifications (Relationship OS D3, 2026-06-02)''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenant_activity_events') THEN
    EXECUTE 'COMMENT ON TABLE tenant_activity_events IS ''LEGACY · READ-ONLY · Replaced by relationship_activities (Relationship OS, 2026-06-02)''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='advisor_lead_activities') THEN
    EXECUTE 'COMMENT ON TABLE advisor_lead_activities IS ''LEGACY · READ-ONLY · Replaced by relationship_activities (Relationship OS, 2026-06-02)''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='advisor_notes') THEN
    EXECUTE 'COMMENT ON TABLE advisor_notes IS ''LEGACY · READ-ONLY · Replaced by tenant_contacts.notes + relationship_activities/internal_note (Relationship OS, 2026-06-02)''';
  END IF;
END$$;

COMMIT;

-- End of migration 031
