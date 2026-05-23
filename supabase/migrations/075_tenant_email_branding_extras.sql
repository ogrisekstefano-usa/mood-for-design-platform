-- ────────────────────────────────────────────────────────────────────
-- 075_tenant_email_branding_extras.sql · ITER143E
-- Extend tenant_email_settings with brand-refinement fields that the
-- tenant_admin can manage via /settings/email-branding. The provider /
-- runtime orchestration columns (provider_type, sender_email, active,
-- locale_default) stay reserved to Blueprint Command Center™.
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE tenant_email_settings
  ADD COLUMN IF NOT EXISTS footer_company_name TEXT,
  ADD COLUMN IF NOT EXISTS footer_address      TEXT,
  ADD COLUMN IF NOT EXISTS footer_phone        TEXT,
  ADD COLUMN IF NOT EXISTS socials             JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_signature     TEXT,
  ADD COLUMN IF NOT EXISTS legal_footer        TEXT,
  ADD COLUMN IF NOT EXISTS privacy_url         TEXT,
  ADD COLUMN IF NOT EXISTS terms_url           TEXT,
  ADD COLUMN IF NOT EXISTS metadata            JSONB DEFAULT '{}';
