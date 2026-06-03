-- ────────────────────────────────────────────────────────────────────
-- 126_m4_notification_center.sql · ITER M4
-- Internal Notification Center foundation:
--   1. notification_categories      — DB-driven catalog
--   2. notification_preferences     — per-user in_app toggle per category
--   3. relationship_notifications   — extended w/ category_key + deep_link_url
--
-- Idempotent. Backward-compatible with existing notifications layer.
-- ────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────
-- 1. CATALOG
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_categories (
  key                  TEXT PRIMARY KEY,
  label_it             TEXT NOT NULL,
  label_en             TEXT NOT NULL,
  description_it       TEXT,
  description_en       TEXT,
  icon                 TEXT NOT NULL DEFAULT 'bell',
    -- lucide icon name (frontend mapping is permissive)
  default_priority     TEXT NOT NULL DEFAULT 'normal',
    -- soft | normal | high
  deep_link_template   TEXT,
    -- python-format style: "/relations/leads/{lead_id}"
    -- placeholders resolved from payload at insert time.
  fallback_link        TEXT,
    -- used when template placeholders cannot be resolved
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order           INT NOT NULL DEFAULT 100,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notif_cat_priority_chk CHECK
    (default_priority IN ('soft','normal','high'))
);

-- Seed initial M4 categories (idempotent via ON CONFLICT)
INSERT INTO notification_categories
  (key, label_it, label_en, description_it, description_en, icon, default_priority, deep_link_template, fallback_link, sort_order)
VALUES
  ('studio_request_received', 'Nuova richiesta studio', 'New studio request',
   'Uno studio ha richiesto attivazione', 'A studio requested activation',
   'inbox', 'high',
   '/command-center/tenants/{tenant_id}', '/command-center/tenants',
   10),
  ('lead_awaiting_review', 'Lead in attesa di revisione', 'Lead awaiting review',
   'Un nuovo lead richiede triage', 'A new lead requires triage',
   'user-plus', 'high',
   '/relations/leads/{lead_id}', '/relations/leads',
   15),
  ('tenant_activated', 'Tenant attivato', 'Tenant activated',
   'Un tenant è stato attivato con successo', 'A tenant has been activated',
   'check-circle', 'normal',
   '/command-center/tenants/{tenant_id}', '/command-center/tenants',
   20),
  ('advisor_assigned', 'Advisor assegnato', 'Advisor assigned',
   'Sei stato assegnato a uno studio', 'You have been assigned to a studio',
   'user-check', 'normal',
   '/command-center/tenants/{tenant_id}', '/command-center/tenants',
   25),
  ('followup_overdue', 'Follow-up scaduto', 'Follow-up overdue',
   'Un follow-up è oltre la data prevista', 'A follow-up is past its due date',
   'alert-triangle', 'high',
   '/relations/{account_id}', '/relations',
   30),
  ('activity_assigned', 'Attività assegnata', 'Activity assigned',
   'Ti è stata assegnata una nuova attività', 'A new activity has been assigned to you',
   'list-checks', 'normal',
   '/relations/{account_id}', '/relations',
   35),
  ('new_contact', 'Nuovo contatto', 'New contact',
   'Un nuovo contatto è stato registrato', 'A new contact has been registered',
   'user', 'soft',
   '/relations/{account_id}', '/relations',
   40),
  ('new_activity', 'Nuova attività', 'New activity',
   'Una nuova attività è stata registrata', 'A new activity has been logged',
   'activity', 'soft',
   '/relations/{account_id}', '/relations',
   45),
  ('workspace_first_access', 'Primo accesso al workspace', 'Workspace first access',
   'Un membro ha effettuato il primo accesso', 'A member accessed the workspace for the first time',
   'log-in', 'soft',
   '/command-center/tenants/{tenant_id}', '/command-center/tenants',
   50)
ON CONFLICT (key) DO UPDATE SET
  label_it           = EXCLUDED.label_it,
  label_en           = EXCLUDED.label_en,
  description_it     = EXCLUDED.description_it,
  description_en     = EXCLUDED.description_en,
  icon               = EXCLUDED.icon,
  default_priority   = EXCLUDED.default_priority,
  deep_link_template = EXCLUDED.deep_link_template,
  fallback_link      = EXCLUDED.fallback_link,
  sort_order         = EXCLUDED.sort_order,
  updated_at         = NOW();


-- ──────────────────────────────────────────────────────────────
-- 2. PREFERENCES (per-user · in-app only at M4)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL,
  category_key    TEXT NOT NULL REFERENCES notification_categories(key) ON DELETE CASCADE,
  in_app_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notif_pref_unique
  ON notification_preferences (tenant_id, user_id, category_key);
CREATE INDEX IF NOT EXISTS notif_pref_user_idx
  ON notification_preferences (user_id);


-- ──────────────────────────────────────────────────────────────
-- 3. EXTEND relationship_notifications (canonical source)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE relationship_notifications
  ADD COLUMN IF NOT EXISTS category_key   TEXT REFERENCES notification_categories(key);

ALTER TABLE relationship_notifications
  ADD COLUMN IF NOT EXISTS deep_link_url  TEXT;

-- Backfill category_key from existing notification_type for the 9 new keys
-- (no-op for legacy types — they keep notification_type only)
UPDATE relationship_notifications
   SET category_key = notification_type
 WHERE category_key IS NULL
   AND notification_type IN (
       'studio_request_received','lead_awaiting_review','tenant_activated',
       'advisor_assigned','followup_overdue','activity_assigned',
       'new_contact','new_activity','workspace_first_access'
   );

CREATE INDEX IF NOT EXISTS notif_category_idx
  ON relationship_notifications (recipient_user_id, category_key, created_at DESC);

CREATE INDEX IF NOT EXISTS notif_high_unread_idx
  ON relationship_notifications (recipient_user_id, priority, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL AND priority = 'high';
