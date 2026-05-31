-- ────────────────────────────────────────────────────────────────────
-- 025 — MOOD Advisor Mini CRM™ · Chunk A (Schema)
--
-- Adds the data layer for the advisor-side commercial pipeline that
-- lives in /command-center. Strict separation from `public.leads`
-- (which belongs to the Blueprint tenant universe).
--
-- New tables:
--   1. advisor_leads              — prospect/lead managed by an advisor
--   2. advisor_lead_activities    — typed activities on a lead
--   3. advisor_activation_tokens  — opaque tokens for /studio/start/{token}
--
-- Extensions:
--   4. studio_requests       — 4 attribution columns (immutable post-insert)
--   5. studio_activation_drafts — 1 attribution-token column
--
-- All FKs use ON DELETE RESTRICT for advisor_id (cannot delete an advisor
-- with active leads) and ON DELETE SET NULL for studio_request/relation
-- linkage (deleting a request does not erase the lead history).
-- ────────────────────────────────────────────────────────────────────

-- ── 1. advisor_leads ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_leads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership (denormalized user_id for cheap WHERE scoping)
  advisor_id               UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE RESTRICT,
  advisor_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Human reference (UI/email)
  reference_code           TEXT UNIQUE NOT NULL,

  -- Studio prospect identity
  company_name             TEXT NOT NULL,
  contact_name             TEXT,
  contact_email            TEXT,
  contact_phone            TEXT,
  website                  TEXT,
  city                     TEXT,
  country                  TEXT,                -- ISO-3166 alpha-2 ("IT","DE","US",…)
  business_type            TEXT,                -- "showroom"|"studio"|"atelier"|"retailer"|...
  source                   TEXT,                -- e.g. "event:fuori-salone-2026"|"intro:client_x"|"cold_outreach"

  -- Pipeline state
  status                   TEXT NOT NULL DEFAULT 'lead'
                           CHECK (status IN ('lead','contacted','meeting_scheduled','demo_completed',
                                             'application_started','application_submitted',
                                             'approved','activated','lost')),
  temperature              TEXT NOT NULL DEFAULT 'cold'
                           CHECK (temperature IN ('cold','warm','hot','ready')),

  -- Workflow signals
  next_follow_up_at        TIMESTAMPTZ,
  last_activity_at         TIMESTAMPTZ,
  notes                    TEXT,                -- private advisor notes

  -- Lifecycle linkage (filled when prospect converts)
  studio_request_id        UUID REFERENCES studio_requests(id) ON DELETE SET NULL,
  studio_relation_id       UUID REFERENCES studio_relations(id) ON DELETE SET NULL,

  -- Lost reason
  lost_reason              TEXT,
  lost_at                  TIMESTAMPTZ,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisor_leads_advisor       ON advisor_leads (advisor_id, status);
CREATE INDEX IF NOT EXISTS idx_advisor_leads_user          ON advisor_leads (advisor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_advisor_leads_followup      ON advisor_leads (advisor_user_id, next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advisor_leads_request       ON advisor_leads (studio_request_id);
CREATE INDEX IF NOT EXISTS idx_advisor_leads_email         ON advisor_leads (LOWER(contact_email))
  WHERE contact_email IS NOT NULL;


-- ── 2. advisor_lead_activities ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_lead_activities (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                  UUID NOT NULL REFERENCES advisor_leads(id) ON DELETE CASCADE,
  advisor_id               UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE RESTRICT,
  advisor_user_id          UUID NOT NULL REFERENCES users(id)         ON DELETE RESTRICT,

  activity_type            TEXT NOT NULL
                           CHECK (activity_type IN ('phone_call','showroom_visit','video_call',
                                                    'email','event','follow_up','demo','proposal','note')),
  activity_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                    TEXT,
  outcome                  TEXT,
  next_action              TEXT,
  next_follow_up_at        TIMESTAMPTZ,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead     ON advisor_lead_activities (lead_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_advisor  ON advisor_lead_activities (advisor_user_id, activity_date DESC);


-- ── 3. advisor_activation_tokens ───────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_activation_tokens (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id               UUID NOT NULL REFERENCES advisor_profiles(id) ON DELETE RESTRICT,
  advisor_user_id          UUID NOT NULL REFERENCES users(id)            ON DELETE RESTRICT,

  -- Optional binding to an existing lead. NULL = generic token (event/QR).
  lead_id                  UUID REFERENCES advisor_leads(id) ON DELETE CASCADE,

  -- Opaque URL token (secrets.token_urlsafe(24) → 32 chars). UNIQUE.
  token                    TEXT NOT NULL UNIQUE,

  -- Human label (e.g. "Margraf Stoccarda fair 2026")
  label                    TEXT,

  -- Lifecycle
  status                   TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','used','revoked','expired')),
  expires_at               TIMESTAMPTZ,                          -- NULL = never expires
  used_at                  TIMESTAMPTZ,
  used_count               INTEGER NOT NULL DEFAULT 0,
  revoked_at               TIMESTAMPTZ,
  revoked_reason           TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisor_tokens_advisor  ON advisor_activation_tokens (advisor_user_id, status);
CREATE INDEX IF NOT EXISTS idx_advisor_tokens_lead     ON advisor_activation_tokens (lead_id);


-- ── 4. studio_requests — attribution columns ───────────────────────
ALTER TABLE studio_requests
  ADD COLUMN IF NOT EXISTS attribution_token_id        UUID REFERENCES advisor_activation_tokens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution_advisor_id      UUID REFERENCES advisor_profiles(id)          ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution_advisor_user_id UUID REFERENCES users(id)                     ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution_lead_id         UUID REFERENCES advisor_leads(id)             ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_studio_requests_attr_advisor
  ON studio_requests (attribution_advisor_user_id)
  WHERE attribution_advisor_user_id IS NOT NULL;


-- ── 5. studio_activation_drafts — attribution token col ────────────
ALTER TABLE studio_activation_drafts
  ADD COLUMN IF NOT EXISTS attribution_token_id UUID REFERENCES advisor_activation_tokens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_studio_drafts_attr_token
  ON studio_activation_drafts (attribution_token_id)
  WHERE attribution_token_id IS NOT NULL;


-- ── updated_at touch trigger (reuse pattern from existing tables) ──
CREATE OR REPLACE FUNCTION advisor_crm_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_advisor_leads_updated         ON advisor_leads;
CREATE TRIGGER  trg_advisor_leads_updated
  BEFORE UPDATE ON advisor_leads
  FOR EACH ROW EXECUTE FUNCTION advisor_crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_advisor_lead_activities_upd   ON advisor_lead_activities;
CREATE TRIGGER  trg_advisor_lead_activities_upd
  BEFORE UPDATE ON advisor_lead_activities
  FOR EACH ROW EXECUTE FUNCTION advisor_crm_touch_updated_at();

DROP TRIGGER IF EXISTS trg_advisor_activation_tokens_upd ON advisor_activation_tokens;
CREATE TRIGGER  trg_advisor_activation_tokens_upd
  BEFORE UPDATE ON advisor_activation_tokens
  FOR EACH ROW EXECUTE FUNCTION advisor_crm_touch_updated_at();
