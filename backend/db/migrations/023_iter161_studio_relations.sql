-- ITER161 — Studio Relations & Advisor Governance™
--
-- Five new tables forming MOOD's relational operating layer.
-- Intentionally NOT a CRM. The vocabulary is curatorial:
--   • studio_relations    — the living relationship between an advisor and a studio
--   • studio_visit_reports — curated observational reports
--   • advisor_followups   — gentle reminders
--   • advisor_commission_rules — Advisory Value rules per advisor/market/archetype
--   • studio_relationship_events — narrative timeline of the relationship

-- ─── studio_relations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS studio_relations (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_request_id          UUID NULL REFERENCES studio_requests(id) ON DELETE SET NULL,
    tenant_id                  UUID NULL REFERENCES tenants(id) ON DELETE SET NULL,

    -- Composition snapshot (mirrors studio_requests at the time the relation is opened)
    studio_name                TEXT NOT NULL,
    legal_name                 TEXT NULL,
    archetype                  TEXT NULL,
    experiences                TEXT[] NOT NULL DEFAULT '{}',
    city                       TEXT NULL,
    country                    TEXT NULL,
    website                    TEXT NULL,

    -- Contact
    contact_name               TEXT NULL,
    contact_role               TEXT NULL,
    contact_email              TEXT NULL,
    phone_prefix               TEXT NULL,
    phone_number               TEXT NULL,

    -- Relational state
    status                     TEXT NOT NULL DEFAULT 'prospect',
                                 -- prospect | under_review | contacted
                                 -- | presentation_scheduled | presented
                                 -- | qualified | proposal | activated
                                 -- | not_aligned | archived
    temperature                TEXT NOT NULL DEFAULT 'cold',
                                 -- cold | warm | strong | ready

    -- Ownership & protection
    owner_advisor_id           UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    assigned_at                TIMESTAMPTZ NULL,
    protection_expires_at      TIMESTAMPTZ NULL,
    reassignment_requested_at  TIMESTAMPTZ NULL,
    last_activity_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Advisory Value
    expected_monthly_value     NUMERIC(12,2) NULL,
    expected_setup_value       NUMERIC(12,2) NULL,
    advisor_recurring_pct      NUMERIC(5,2)  NULL,
    advisor_setup_pct          NUMERIC(5,2)  NULL,
    advisor_recurring_months   INT           NULL,

    -- Notes
    advisory_notes             TEXT NULL,
    next_action                TEXT NULL,

    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_studio_relations_owner       ON studio_relations (owner_advisor_id);
CREATE INDEX IF NOT EXISTS idx_studio_relations_status      ON studio_relations (status);
CREATE INDEX IF NOT EXISTS idx_studio_relations_email_lwr   ON studio_relations (lower(contact_email));
CREATE INDEX IF NOT EXISTS idx_studio_relations_website_lwr ON studio_relations (lower(website));

-- ─── studio_visit_reports ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS studio_visit_reports (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relation_id                 UUID NOT NULL REFERENCES studio_relations(id) ON DELETE CASCADE,
    advisor_id                  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    visited_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Curatorial assessment scales (0–5 each; 0 = unknown, 1 = nascent, 5 = exceptional)
    atmosphere_observed         TEXT NULL,
    workflow_maturity           INT NULL CHECK (workflow_maturity BETWEEN 0 AND 5),
    showroom_quality            INT NULL CHECK (showroom_quality BETWEEN 0 AND 5),
    material_culture            INT NULL CHECK (material_culture BETWEEN 0 AND 5),
    design_journey_alignment    INT NULL CHECK (design_journey_alignment BETWEEN 0 AND 5),
    client_experience_maturity  INT NULL CHECK (client_experience_maturity BETWEEN 0 AND 5),
    international_readiness     INT NULL CHECK (international_readiness BETWEEN 0 AND 5),
    digital_readiness           INT NULL CHECK (digital_readiness BETWEEN 0 AND 5),
    operational_complexity      INT NULL CHECK (operational_complexity BETWEEN 0 AND 5),

    -- Narrative
    opportunities               TEXT NULL,
    objections                  TEXT NULL,
    competitor_tools            TEXT NULL,
    suggested_experiences       TEXT[] NOT NULL DEFAULT '{}',

    -- Advisory Value at time of visit
    estimated_monthly_value     NUMERIC(12,2) NULL,
    estimated_setup_value       NUMERIC(12,2) NULL,
    probability_pct             INT NULL CHECK (probability_pct BETWEEN 0 AND 100),

    next_step                   TEXT NULL,
    private_notes               TEXT NULL,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visit_reports_relation ON studio_visit_reports (relation_id, visited_at DESC);

-- ─── advisor_followups ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_followups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relation_id     UUID NOT NULL REFERENCES studio_relations(id) ON DELETE CASCADE,
    advisor_id      UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    type            TEXT NOT NULL DEFAULT 'call',
                       -- call | email | visit | demo
                       -- | internal_review | activation | proposal
    due_at          TIMESTAMPTZ NOT NULL,
    notes           TEXT NULL,
    status          TEXT NOT NULL DEFAULT 'open',     -- open | done | skipped
    completed_at    TIMESTAMPTZ NULL,
    next_action     TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_followups_advisor_due ON advisor_followups (advisor_id, due_at);
CREATE INDEX IF NOT EXISTS idx_followups_relation    ON advisor_followups (relation_id);

-- ─── advisor_commission_rules ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_commission_rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advisor_id          UUID NULL REFERENCES users(id) ON DELETE CASCADE,  -- NULL → fallback rule
    market              TEXT NULL,
    archetype           TEXT NULL,
    recurring_pct       NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    setup_pct           NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    recurring_months    INT NOT NULL DEFAULT 24,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commission_advisor ON advisor_commission_rules (advisor_id);

-- ─── studio_relationship_events ──────────────────────────────────────
-- Narrative timeline. Append-only.
CREATE TABLE IF NOT EXISTS studio_relationship_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relation_id     UUID NOT NULL REFERENCES studio_relations(id) ON DELETE CASCADE,
    actor_id        UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    kind            TEXT NOT NULL,
                       -- relation_opened | contact_made | presentation_scheduled
                       -- | presentation_delivered | visit_recorded
                       -- | status_changed | temperature_changed
                       -- | ownership_changed | followup_created
                       -- | followup_completed | ecosystem_aligned
                       -- | activated | archived | note_added
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_relationship_events_relation
    ON studio_relationship_events (relation_id, occurred_at DESC);
