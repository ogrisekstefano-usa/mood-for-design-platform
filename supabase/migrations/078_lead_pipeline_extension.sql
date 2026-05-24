-- ────────────────────────────────────────────────────────────────────
-- 078_lead_pipeline_extension.sql · ITER146.A
-- LEAD PIPELINE ORCHESTRATION™ — extend `leads` for Private/Professional
-- separation, capture onboarding path, runtime identity, and collaboration
-- intent. Additive only — preserves all existing rows and apps.
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS onboarding_path        TEXT,
    -- 'begin_journey' | 'begin_partnership' | 'contact_form' | 'imported'
  ADD COLUMN IF NOT EXISTS professional_category  TEXT,
    -- 'architect' | 'interior_designer' | 'developer' | 'retailer'
    -- | 'fabricator' | 'partner_studio' | NULL (private leads)
  ADD COLUMN IF NOT EXISTS collaboration_intent   TEXT,
    -- 'partnership' | 'referral' | 'fabrication' | 'distribution' |
    -- 'studio_network' | 'cultural_edition'
  ADD COLUMN IF NOT EXISTS market_sector          TEXT,
    -- 'residential' | 'hospitality' | 'retail' | 'office' | 'cultural' |
    -- 'mixed_use' | 'product'
  ADD COLUMN IF NOT EXISTS company_name           TEXT,
  ADD COLUMN IF NOT EXISTS company_website        TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url          TEXT,
  ADD COLUMN IF NOT EXISTS runtime_identity       JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- {resolved_subdomain, resolved_host, source_locale, source_user_agent,
    --  utm: {source,medium,campaign,term,content}, …}
  ADD COLUMN IF NOT EXISTS pipeline_stage         TEXT NOT NULL DEFAULT 'lead_captured';
    -- 'lead_captured' | 'contacted' | 'qualified' | 'in_dialog' | 'proposal' |
    -- 'won' | 'lost' | 'archived'

CREATE INDEX IF NOT EXISTS leads_lead_type_idx       ON leads (lead_type);
CREATE INDEX IF NOT EXISTS leads_onboarding_path_idx ON leads (onboarding_path);
CREATE INDEX IF NOT EXISTS leads_pipeline_stage_idx  ON leads (pipeline_stage);
CREATE INDEX IF NOT EXISTS leads_tenant_status_idx   ON leads (tenant_id, status, created_at DESC);
