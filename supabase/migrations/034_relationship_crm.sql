-- ─────────────────────────────────────────────────────────────────────────
-- Phase R-CRM-1 — Relationship CRM Foundation.
--
-- 5 core entities + 1 catalog table:
--   accounts                    — private clients, studios, developers, …
--   contacts                    — N contacts per account
--   interactions                — every meaningful event (calls, visits, …)
--   relationship_actions        — pending next steps / alerts (NOT tasks)
--   account_style_profile       — taste DNA per account (1:1)
--   account_team_members        — N collaborators per account + permissions
--   relationship_lookups        — Blueprint-managed enums (lifecycle stages,
--                                 sources, interaction types, …)
--
-- This migration co-exists with the legacy `leads` table — the migration
-- script in /app/backend/scripts/migrate_leads_to_relationships.py copies
-- each lead into account+contact+interaction, leaving the source row in
-- place for audit.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. accounts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  account_name        TEXT NOT NULL,
  account_type        TEXT NOT NULL DEFAULT 'private_client',
                      -- private_client | architecture_studio | interior_design_studio
                      -- | furniture_client | developer | contractor | hospitality_group
                      -- | company | partner_ad | other  (Blueprint-managed)
  lifecycle_stage     TEXT NOT NULL DEFAULT 'new_inquiry',
                      -- new_inquiry | lead | discovery | prospect | active_project
                      -- | existing_client | repeat_client | partner_ad | archived
  source              TEXT,
                      -- web_form | showroom_visit | incoming_call | whatsapp
                      -- | business_meeting | event | referral | architect_referral
                      -- | social_lead | manual_entry | existing_client_new
  country             TEXT,
  city                TEXT,
  address             TEXT,
  website             TEXT,
  phone               TEXT,
  email               TEXT,
  language            TEXT,
  locale_code         TEXT,

  primary_owner_id    UUID,
  relationship_score  NUMERIC(5,2),
  relationship_health TEXT,
                      -- excellent | healthy | needs_attention | at_risk | dormant
  notes               TEXT,
  metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Provenance trail
  legacy_lead_id      UUID,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant_stage
  ON accounts(tenant_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_owner
  ON accounts(tenant_id, primary_owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_lastact
  ON accounts(tenant_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_email
  ON accounts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_name
  ON accounts(tenant_id, account_name);


-- ── 2. contacts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id               UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  first_name               TEXT NOT NULL DEFAULT '',
  last_name                TEXT,
  email                    TEXT,
  phone                    TEXT,
  role                     TEXT,        -- Founder | PM | Procurement | Owner | …
  department_or_area       TEXT,        -- Residential | Hospitality | Commercial | …
  primary_contact          BOOLEAN NOT NULL DEFAULT FALSE,
  lifecycle_stage          TEXT,        -- mirrors account stage by default
  communication_preference TEXT,        -- email | phone | whatsapp | in_person
  notes                    TEXT,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_account
  ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email
  ON contacts(tenant_id, email);


-- ── 3. interactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_id          UUID,
  moodboard_id        UUID,

  interaction_type    TEXT NOT NULL,
                      -- call | email | whatsapp | showroom_visit | external_visit
                      -- | business_meeting | event | casual_meeting | incoming_call
                      -- | web_lead_generation | social_lead | discovery_interview
                      -- | follow_up | moodboard_sent | moodboard_viewed
                      -- | proposal_sent | proposal_opened | proposal_review
                      -- | material_selection | project_update | post_visit_report
                      -- | internal_note | voice_note | ai_summary

  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title               TEXT,
  summary             TEXT,
  outcome             TEXT,
  next_step           TEXT,
  next_follow_up_date TIMESTAMPTZ,

  -- Post-visit / discovery / meeting report — structured fields (JSONB so
  -- the Command Center can extend the template per tenant without DDL).
  report_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by          UUID,
  attachments         JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_automatic        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_account_time
  ON interactions(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant_type
  ON interactions(tenant_id, interaction_type);


-- ── 4. relationship_actions  (next steps / reminders) ──────────────────
CREATE TABLE IF NOT EXISTS relationship_actions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id               UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id               UUID REFERENCES contacts(id) ON DELETE SET NULL,
  project_id               UUID,
  moodboard_id             UUID,
  related_interaction_id   UUID REFERENCES interactions(id) ON DELETE SET NULL,

  title                    TEXT NOT NULL,
  action_type              TEXT NOT NULL,
                           -- call_back | send_email | send_moodboard | follow_up
                           -- | schedule_meeting | deliver_project | deliver_moodboard
                           -- | material_deadline | proposal_feedback | send_quote
                           -- | review_needed | no_activity_alert | engagement_alert
  assigned_to              UUID,
  due_date                 TIMESTAMPTZ,
  priority                 TEXT NOT NULL DEFAULT 'normal',  -- low | normal | high | urgent
  status                   TEXT NOT NULL DEFAULT 'open',    -- open | in_progress | done | postponed | cancelled
  notes                    TEXT,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_relationship_actions_account
  ON relationship_actions(account_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_relationship_actions_tenant_assignee
  ON relationship_actions(tenant_id, assigned_to, status);


-- ── 5. account_style_profile (Style DNA — one row per account) ────────
CREATE TABLE IF NOT EXISTS account_style_profile (
  account_id              UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  preferred_styles        JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_materials     JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_colors        JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_rooms         JSONB NOT NULL DEFAULT '[]'::jsonb,
  atmosphere_tags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  luxury_level            TEXT,
  budget_range            TEXT,
  timing_range            TEXT,
  ai_detected_tags        JSONB NOT NULL DEFAULT '[]'::jsonb,
  designer_validated_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  disliked_tags           JSONB NOT NULL DEFAULT '[]'::jsonb,
  inspiration_sources     JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes                   TEXT,

  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 6. account_team_members (collaborators + permissions) ─────────────
CREATE TABLE IF NOT EXISTS account_team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,

  role_in_account   TEXT NOT NULL DEFAULT 'contributor',
                    -- primary_owner | contributor | previous_owner | invited_colleague | external_collaborator
  visibility_level  TEXT NOT NULL DEFAULT 'full',
                    -- full | crm_only | moodboards_only | projects_only | commercial_only | read_only
  invited_by        UUID,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at        TIMESTAMPTZ,

  UNIQUE (account_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_team_account
  ON account_team_members(account_id) WHERE removed_at IS NULL;


-- ── 7. relationship_lookups (Blueprint-managed enums) ─────────────────
-- Lets a tenant_admin add/rename/reorder dropdown values without DDL.
-- Bootstrapped per-tenant by the seed script.
CREATE TABLE IF NOT EXISTS relationship_lookups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  group_key    TEXT NOT NULL,
               -- 'lifecycle_stage' | 'account_type' | 'source' | 'interaction_type'
               -- | 'action_type' | 'priority' | 'visit_direction' | 'project_type'
               -- | 'room_type' | 'style' | 'material' | 'color' | 'atmosphere'
               -- | 'budget_range' | 'timing_range' | 'visibility_level'
               -- | 'communication_preference' | 'relationship_health'
  value_key    TEXT NOT NULL,
  label        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {it: "...", en: "...", ...}
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, group_key, value_key)
);

CREATE INDEX IF NOT EXISTS idx_relationship_lookups_tenant_group
  ON relationship_lookups(tenant_id, group_key, sort_order)
  WHERE active = TRUE;
