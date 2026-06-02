-- ITER187.A · JOURNEY MAIL INTELLIGENCE™ · Phase 1
-- ─────────────────────────────────────────────────────────────────────
-- Migration: 120_iter187a_email_mailboxes.sql
--
-- Multi-Mailbox + Read-Only IMAP architecture LOCKED.
-- See /app/memory/JOURNEY_MAIL_INTELLIGENCE_PHASE1_PLAN.md
--
-- New tables (idempotent):
--   1. email_mailboxes          · root config (IMAP+SMTP + vault refs)
--   2. email_mailbox_cursors    · per-folder IMAP UIDVALIDITY+UID resume cursor
--   3. email_messages           · indexed messages (body stored externally)
--   4. email_attachments        · attachment metadata
--   5. email_links              · MANUAL associations to CRM entities
--   6. email_outbound_sent      · log of Blueprint-originated outbound
--   7. mailbox_member_grants    · per-member explicit visibility overrides
--
-- Non-shippable rules enforced in schema:
--   • sync_mode CHECK constraint allows ONLY 'READ_ONLY' in Phase 1
--   • mailbox_type CHECK enum
--   • imap/smtp passwords stored as BYTEA (AES-GCM ciphertext, never plaintext)
-- ─────────────────────────────────────────────────────────────────────

-- §1 · email_mailboxes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_mailboxes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  mailbox_name             TEXT NOT NULL,
  mailbox_description      TEXT,
  mailbox_type             TEXT NOT NULL DEFAULT 'shared',
    -- 'shared' | 'team' | 'personal' | 'system'

  from_name                TEXT NOT NULL,
  from_email               TEXT NOT NULL,
  reply_to_email           TEXT,

  imap_host                TEXT NOT NULL,
  imap_port                INTEGER NOT NULL DEFAULT 993,
  imap_security            TEXT NOT NULL DEFAULT 'ssl',  -- 'ssl' | 'starttls' | 'plain'
  imap_username            TEXT NOT NULL,
  imap_password_enc        BYTEA,    -- AES-GCM ciphertext
  imap_password_kid        TEXT,     -- key id (rotation)

  smtp_host                TEXT NOT NULL,
  smtp_port                INTEGER NOT NULL DEFAULT 587,
  smtp_security            TEXT NOT NULL DEFAULT 'starttls',
  smtp_username            TEXT NOT NULL,
  smtp_password_enc        BYTEA,
  smtp_password_kid        TEXT,

  sync_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  sync_mode                TEXT NOT NULL DEFAULT 'READ_ONLY',
    -- Phase 1 LOCK: only READ_ONLY allowed.
  is_primary               BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,

  -- visibility_scope encoding:
  -- { "mode": "tenant"|"roles"|"members"|"owner_only",
  --   "roles": ["tenant_admin",...],
  --   "member_ids": ["uuid",...] }
  visibility_scope         JSONB NOT NULL DEFAULT '{"mode":"tenant"}'::jsonb,

  connection_status        TEXT NOT NULL DEFAULT 'unknown',
    -- 'unknown' | 'connected' | 'warning' | 'error'
  last_health_check_at     TIMESTAMPTZ,
  last_sync_started_at     TIMESTAMPTZ,
  last_sync_completed_at   TIMESTAMPTZ,
  last_sync_error          TEXT,
  messages_synced_total    INTEGER NOT NULL DEFAULT 0,
  messages_inbox           INTEGER NOT NULL DEFAULT 0,
  messages_sent            INTEGER NOT NULL DEFAULT 0,

  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT email_mailboxes_sync_mode_chk
    CHECK (sync_mode IN ('READ_ONLY')),
  CONSTRAINT email_mailboxes_type_chk
    CHECK (mailbox_type IN ('shared','team','personal','system')),
  CONSTRAINT email_mailboxes_imap_sec_chk
    CHECK (imap_security IN ('ssl','starttls','plain')),
  CONSTRAINT email_mailboxes_smtp_sec_chk
    CHECK (smtp_security IN ('ssl','starttls','plain')),
  CONSTRAINT email_mailboxes_status_chk
    CHECK (connection_status IN ('unknown','connected','warning','error'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_mailboxes_tenant_from
  ON email_mailboxes(tenant_id, LOWER(from_email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_mailboxes_one_primary
  ON email_mailboxes(tenant_id)
  WHERE is_primary = TRUE AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_email_mailboxes_tenant ON email_mailboxes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_mailboxes_sync_enabled
  ON email_mailboxes(sync_enabled) WHERE sync_enabled = TRUE AND is_active = TRUE;

COMMENT ON TABLE email_mailboxes IS
  'ITER187.A · Journey Mail Intelligence™ · per-tenant N mailboxes, READ_ONLY default.';
COMMENT ON COLUMN email_mailboxes.imap_password_enc IS
  'AES-GCM ciphertext. NEVER store plaintext. NEVER echo in any API response.';


-- §2 · email_mailbox_cursors ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_mailbox_cursors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id          UUID NOT NULL REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  folder              TEXT NOT NULL,            -- 'INBOX' | 'Sent' | ...
  uid_validity        BIGINT NOT NULL,
  last_uid            BIGINT NOT NULL DEFAULT 0,
  last_sync_at        TIMESTAMPTZ,
  metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (mailbox_id, folder)
);

CREATE INDEX IF NOT EXISTS idx_email_mailbox_cursors_mb
  ON email_mailbox_cursors(mailbox_id);


-- §3 · email_messages ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_messages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox_id               UUID NOT NULL REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  uid_validity             BIGINT NOT NULL,
  uid                      BIGINT NOT NULL,
  message_id_header        TEXT,
  thread_id                TEXT,
  folder                   TEXT NOT NULL,
  direction                TEXT NOT NULL,          -- 'inbound' | 'outbound'

  from_addr                TEXT,
  to_addrs                 TEXT[] NOT NULL DEFAULT '{}',
  cc_addrs                 TEXT[] NOT NULL DEFAULT '{}',
  bcc_addrs                TEXT[] NOT NULL DEFAULT '{}',
  reply_to_addrs           TEXT[] NOT NULL DEFAULT '{}',

  subject                  TEXT,
  snippet                  TEXT,
  body_text_path           TEXT,                   -- storage path (private bucket)
  body_html_path           TEXT,
  headers_json             JSONB NOT NULL DEFAULT '{}'::jsonb,
  internal_date            TIMESTAMPTZ,
  received_at              TIMESTAMPTZ,
  size_bytes               INTEGER,
  attachments_count        INTEGER NOT NULL DEFAULT 0,

  -- Snapshot of IMAP flags at the moment we fetched. NEVER written back.
  imap_flags_observed      TEXT[] NOT NULL DEFAULT '{}',

  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT email_messages_direction_chk
    CHECK (direction IN ('inbound','outbound'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_messages_mailbox_uid
  ON email_messages(mailbox_id, uid_validity, uid);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_messages_tenant_msgid
  ON email_messages(tenant_id, message_id_header)
  WHERE message_id_header IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_messages_mailbox_received
  ON email_messages(mailbox_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_tenant_received
  ON email_messages(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread
  ON email_messages(tenant_id, thread_id) WHERE thread_id IS NOT NULL;

COMMENT ON COLUMN email_messages.imap_flags_observed IS
  'Snapshot of \Seen \Flagged \Answered etc. at fetch time. NEVER written back to IMAP.';


-- §4 · email_attachments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_attachments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id         UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename                 TEXT,
  mime_type                TEXT,
  size_bytes               INTEGER,
  storage_path             TEXT,         -- private bucket
  phash                    TEXT,         -- optional, for cross-link with PDFs
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_msg
  ON email_attachments(email_message_id);


-- §5 · email_links (MANUAL only in Phase 1) ───────────────────────────
CREATE TABLE IF NOT EXISTS email_links (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email_message_id         UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  linked_type              TEXT NOT NULL,
    -- 'lead' | 'prospect' | 'customer' | 'account' | 'journey' | 'contact'
  linked_id                UUID NOT NULL,
  linked_by                UUID,
  linked_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note                     TEXT,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (email_message_id, linked_type, linked_id),
  CONSTRAINT email_links_type_chk
    CHECK (linked_type IN ('lead','prospect','customer','account','journey','contact'))
);

CREATE INDEX IF NOT EXISTS idx_email_links_target
  ON email_links(tenant_id, linked_type, linked_id);
CREATE INDEX IF NOT EXISTS idx_email_links_msg
  ON email_links(email_message_id);


-- §6 · email_outbound_sent ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_outbound_sent (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mailbox_id               UUID NOT NULL REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  email_message_id         UUID REFERENCES email_messages(id) ON DELETE SET NULL,
  from_email               TEXT NOT NULL,
  to_addrs                 TEXT[] NOT NULL DEFAULT '{}',
  cc_addrs                 TEXT[] NOT NULL DEFAULT '{}',
  bcc_addrs                TEXT[] NOT NULL DEFAULT '{}',
  subject                  TEXT,
  message_id_header        TEXT,
  smtp_response            TEXT,
  smtp_ok                  BOOLEAN NOT NULL DEFAULT FALSE,
  smtp_sent_at             TIMESTAMPTZ,
  append_to_sent_ok        BOOLEAN NOT NULL DEFAULT FALSE,
  append_to_sent_error     TEXT,
  sent_by                  UUID,
  metadata_json            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_outbound_mailbox
  ON email_outbound_sent(mailbox_id, created_at DESC);


-- §7 · mailbox_member_grants (Phase 2 override slot, table ready) ─────
CREATE TABLE IF NOT EXISTS mailbox_member_grants (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id               UUID NOT NULL REFERENCES email_mailboxes(id) ON DELETE CASCADE,
  member_id                UUID NOT NULL,
  permissions              JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- subset of ['mailbox_view','mailbox_send','mailbox_link','mailbox_admin']
  granted_by               UUID,
  granted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mailbox_id, member_id)
);


-- §8 · GRANT service_role ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT ALL ON email_mailboxes,email_mailbox_cursors,email_messages,'
            || 'email_attachments,email_links,email_outbound_sent,'
            || 'mailbox_member_grants TO service_role';
  END IF;
END $$;


-- §9 · bookkeeping ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO public.schema_migrations(version)
  VALUES ('120_iter187a_email_mailboxes.sql')
  ON CONFLICT (version) DO NOTHING;

-- ── End of 120_iter187a_email_mailboxes.sql ──────────────────────────
