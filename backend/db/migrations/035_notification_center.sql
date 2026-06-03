-- ═══════════════════════════════════════════════════════════════════════
-- Migration 035 — Internal Notification Center (M4)
-- Generated: 2026-06-03
-- Spec:      /app/memory/M4_INTERNAL_NOTIFICATION_CENTER_EXECUTION_PLAN.md
-- Idempotent: YES · Rollback: 035_*.rollback.sql
-- Author req: 9 user modifications recepite (lead_awaiting_review,
--             activity_assigned, push-ready preferences, structured FK)
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

-- ─── 1. Catalog: platform_notification_types ───────────────────────────

CREATE TABLE IF NOT EXISTS platform_notification_types (
    code                 TEXT PRIMARY KEY,
    label_it             TEXT NOT NULL,
    label_en             TEXT NOT NULL,
    narrative_template   TEXT NOT NULL,
    icon                 TEXT NOT NULL,
    color                TEXT,
    category             TEXT NOT NULL
                         CHECK (category IN ('lifecycle','activity','followup','access','assignment','review')),
    default_priority     TEXT NOT NULL DEFAULT 'normal'
                         CHECK (default_priority IN ('low','normal','high','urgent')),
    notify_admin         BOOLEAN NOT NULL DEFAULT FALSE,
    notify_advisor       BOOLEAN NOT NULL DEFAULT FALSE,
    notify_owner         BOOLEAN NOT NULL DEFAULT FALSE,
    notify_actor         BOOLEAN NOT NULL DEFAULT FALSE,
    is_system            BOOLEAN NOT NULL DEFAULT TRUE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order           INTEGER NOT NULL DEFAULT 100,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_notification_types IS
  'M4 · Catalog of notification kinds. DB-driven labels/icons/routing. NO hardcoded UI text.';

-- ─── 2. Preferences (user × type × channel) ────────────────────────────

CREATE TABLE IF NOT EXISTS relationship_notification_preferences (
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type    TEXT NOT NULL REFERENCES platform_notification_types(code) ON DELETE CASCADE,
    in_app_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled        BOOLEAN NOT NULL DEFAULT FALSE,    -- future-ready · NO send in M4
    push_enabled         BOOLEAN NOT NULL DEFAULT FALSE,    -- future-ready · NO send in M4
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user
    ON relationship_notification_preferences(user_id);

COMMENT ON TABLE relationship_notification_preferences IS
  'M4 · Per-user opt-in/out matrix. Channels: in_app (M4), email + push (future-ready).';

-- ─── 3. relationship_notifications structured extensions ───────────────

ALTER TABLE relationship_notifications
    ADD COLUMN IF NOT EXISTS notification_type_code TEXT
        REFERENCES platform_notification_types(code),
    -- structured FK to give every notif data shape (req #9 user)
    ADD COLUMN IF NOT EXISTS contact_id        UUID NULL REFERENCES tenant_contacts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS activity_id       UUID NULL REFERENCES relationship_activities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS advisor_user_id   UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    -- denormalized + audit (post-checkin §C + new request)
    ADD COLUMN IF NOT EXISTS tenant_name        TEXT NULL,
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    -- correlation to source event for audit/dedup
    ADD COLUMN IF NOT EXISTS source_event_type TEXT,
    ADD COLUMN IF NOT EXISTS source_event_id   UUID,
    ADD COLUMN IF NOT EXISTS dedup_key         TEXT;

-- Relax legacy CHECK constraints (031) that only allowed marketplace
-- vocabulary ('client'/'designer'/'studio', 'soft'/'normal'/'high').
-- Replace with the canonical platform vocabulary used across MOOD Core.
ALTER TABLE relationship_notifications DROP CONSTRAINT IF EXISTS notif_recipient_chk;
ALTER TABLE relationship_notifications DROP CONSTRAINT IF EXISTS notif_priority_chk;

ALTER TABLE relationship_notifications
    ADD CONSTRAINT notif_recipient_chk
        CHECK (recipient_type = ANY (ARRAY['admin','advisor','owner','editor','client','designer','studio']));

ALTER TABLE relationship_notifications
    ADD CONSTRAINT notif_priority_chk
        CHECK (priority = ANY (ARRAY['low','normal','high','urgent','soft']));

-- Unique dedup constraint (per recipient × dedup_key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_dedup
    ON relationship_notifications(recipient_user_id, dedup_key)
    WHERE dedup_key IS NOT NULL;

-- Category/priority indices for drawer filters
CREATE INDEX IF NOT EXISTS idx_notif_recipient_type
    ON relationship_notifications(recipient_user_id, notification_type_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_recipient_priority_unread
    ON relationship_notifications(recipient_user_id, priority, created_at DESC)
    WHERE read_at IS NULL AND archived_at IS NULL;

-- ─── 4. Seed catalog · 9 notification types ────────────────────────────

INSERT INTO platform_notification_types
  (code, label_it, label_en, narrative_template, icon, color, category, default_priority,
   notify_admin, notify_advisor, notify_owner, notify_actor, sort_order)
VALUES
-- Lifecycle (lead inbox + activations)
('studio_request_received',
 'Nuova richiesta studio', 'New studio request',
 'Nuova richiesta da {{studio_name}}. Submitted via V2.',
 'inbox', '#00C9B3', 'lifecycle', 'normal',
 TRUE, TRUE, FALSE, FALSE, 10),

('lead_awaiting_review',
 'Lead in attesa di revisione', 'Lead awaiting review',
 'La richiesta di {{studio_name}} è in attesa di revisione da più di {{hours}}h.',
 'alert-circle', '#E5484D', 'review', 'high',
 TRUE, TRUE, FALSE, FALSE, 15),

('tenant_activated',
 'Tenant attivato', 'Tenant activated',
 '{{studio_name}} ha completato l''attivazione. Magic link inviato.',
 'check-circle', '#30A46C', 'lifecycle', 'normal',
 TRUE, TRUE, FALSE, FALSE, 20),

('workspace_first_access',
 'Primo accesso founder', 'Workspace first access',
 '{{user_name}} ha effettuato il primo login sul workspace di {{studio_name}}.',
 'log-in', '#30A46C', 'access', 'normal',
 TRUE, TRUE, FALSE, FALSE, 25),

-- Assignment (advisor pipeline)
('advisor_assigned',
 'Assegnazione advisor', 'Advisor assignment',
 'Sei stato/a assegnato/a come advisor di {{studio_name}}.',
 'user-plus', '#00C9B3', 'assignment', 'high',
 FALSE, TRUE, FALSE, FALSE, 30),

('activity_assigned',
 'Attività assegnata', 'Activity assigned',
 'Ti è stata assegnata "{{subject}}" su {{studio_name}}.',
 'clipboard-list', '#00C9B3', 'assignment', 'high',
 FALSE, TRUE, FALSE, FALSE, 35),

-- Follow-up (cron-driven)
('followup_overdue',
 'Follow-up in ritardo', 'Follow-up overdue',
 'Il follow-up "{{subject}}" è in ritardo di {{days}} giorni.',
 'alert-triangle', '#E5484D', 'followup', 'high',
 FALSE, TRUE, FALSE, TRUE, 40),

-- Activity (memory layer)
('new_contact',
 'Nuovo contatto', 'New contact added',
 '{{contact_name}} è stato/a aggiunto/a come {{role}} a {{studio_name}}.',
 'user', '#5EB1FF', 'activity', 'low',
 FALSE, TRUE, TRUE, FALSE, 50),

('new_activity',
 'Nuova attività', 'New activity added',
 'Una nuova {{activity_type}} è stata aggiunta a {{studio_name}} da {{actor}}.',
 'activity', '#F0B100', 'activity', 'low',
 FALSE, TRUE, FALSE, FALSE, 60)

ON CONFLICT (code) DO UPDATE SET
    label_it           = EXCLUDED.label_it,
    label_en           = EXCLUDED.label_en,
    narrative_template = EXCLUDED.narrative_template,
    icon               = EXCLUDED.icon,
    color              = EXCLUDED.color,
    category           = EXCLUDED.category,
    default_priority   = EXCLUDED.default_priority,
    notify_admin       = EXCLUDED.notify_admin,
    notify_advisor     = EXCLUDED.notify_advisor,
    notify_owner       = EXCLUDED.notify_owner,
    notify_actor       = EXCLUDED.notify_actor,
    sort_order         = EXCLUDED.sort_order;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 035 — DONE
-- Tables:   platform_notification_types (9 row), relationship_notification_preferences
-- Altered:  relationship_notifications +6 columns (typed FK + audit + dedup)
-- Indices:  uq_notif_dedup, idx_notif_recipient_type, idx_notif_recipient_priority_unread
-- ═══════════════════════════════════════════════════════════════════════
