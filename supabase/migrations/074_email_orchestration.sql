-- ────────────────────────────────────────────────────────────────────
-- 074_email_orchestration.sql · ITER143D
-- TENANT-AWARE EMAIL ORCHESTRATION™ + AUTH REDIRECT GOVERNANCE™
-- ────────────────────────────────────────────────────────────────────
--
-- 1. RENAME the canonical Golden Demo Tenant™ slug from `mood-demo`
--    → `studio`. The tenant now lives at studio.moodfordesign.com.
-- 2. tenant_email_settings  — per-tenant white-label branding (sender,
--    palette, logo, support email, footer, locale default, provider).
-- 3. Extend email_events with the orchestration fields ITER143D needs:
--    template_key, source_domain, provider_message_id, recipient_email
--    alias, opened/clicked/bounced/failed timestamps.
-- ────────────────────────────────────────────────────────────────────

-- 1. Golden Demo Tenant™ slug freeze
UPDATE tenants
   SET slug = 'studio',
       updated_at = NOW()
 WHERE slug = 'mood-demo';

-- 2. tenant_email_settings — white-label per-tenant email orchestration
CREATE TABLE IF NOT EXISTS tenant_email_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_name       TEXT NOT NULL,
  sender_email      TEXT NOT NULL,
  reply_to          TEXT,
  support_email     TEXT,
  logo_url          TEXT,
  primary_color     TEXT,            -- e.g. '#7ce4f5'
  accent_color      TEXT,
  footer_signature  TEXT,
  email_domain      TEXT,            -- 'studio.moodfordesign.com'
  provider_type     TEXT NOT NULL DEFAULT 'resend'
                    CHECK (provider_type IN ('resend','smtp_custom','sendgrid','postmark','ses','console')),
  locale_default    TEXT NOT NULL DEFAULT 'it-IT',
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id)
);

-- 3. Extend email_events to the ITER143D contract.
--    Columns added (where missing). Existing columns from 071/073:
--    recipient, subject, template, status, provider, provider_id,
--    error, metadata, locale, user_id, opened_at, clicked_at,
--    bounce_reason, sent_at, created_at.
ALTER TABLE email_events
  ADD COLUMN IF NOT EXISTS template_key         TEXT,
  ADD COLUMN IF NOT EXISTS source_domain        TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id  TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email      TEXT,
  ADD COLUMN IF NOT EXISTS bounced_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- Backfill recipient_email from the older `recipient` column where empty.
UPDATE email_events
   SET recipient_email = recipient
 WHERE recipient_email IS NULL AND recipient IS NOT NULL;

-- Backfill template_key from the older `template` column where empty.
UPDATE email_events
   SET template_key = template
 WHERE template_key IS NULL AND template IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_events_template_key_idx
  ON email_events (template_key, created_at DESC);
CREATE INDEX IF NOT EXISTS email_events_source_domain_idx
  ON email_events (source_domain);
