-- ────────────────────────────────────────────────────────────────────
-- 091_studio_orchestra.sql · ITER153 · SPRINT E
-- Studio Team + Unified Notifications (editorial relationship layer)
--
-- 1. studio_team_members — atelier roster with editorial labels
-- 2. relationship_notifications — unified relationship-aware relationship_notifications
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS studio_team_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  user_id             UUID NOT NULL,
  role                TEXT NOT NULL DEFAULT 'collaborator',
    -- founder | creative_director | interior_designer | material_specialist
    -- | architect | project_coordinator | account_director
    -- | collaborator | observer
  role_label_it       TEXT,
  role_label_en       TEXT,
  specialties         JSONB NOT NULL DEFAULT '[]'::jsonb,
  territories         JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages           JSONB NOT NULL DEFAULT '[]'::jsonb,
  bio                 TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
    -- active | on_leave | inactive
  visibility          TEXT NOT NULL DEFAULT 'studio_and_clients',
    -- studio_only | studio_and_clients
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stm_role_chk CHECK (role IN (
    'founder','creative_director','interior_designer','material_specialist',
    'architect','project_coordinator','account_director','collaborator',
    'observer'
  )),
  CONSTRAINT stm_status_chk CHECK (status IN ('active','on_leave','inactive'))
);
CREATE UNIQUE INDEX IF NOT EXISTS stm_unique_per_tenant
  ON studio_team_members (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS stm_tenant_role_idx
  ON studio_team_members (tenant_id, role);


CREATE TABLE IF NOT EXISTS relationship_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID,
  recipient_user_id   UUID NOT NULL,
  recipient_type      TEXT NOT NULL DEFAULT 'designer',
    -- client | designer | studio
  sender_user_id      UUID,
  sender_type         TEXT,
  notification_type   TEXT NOT NULL,
    -- new_message | client_returned | atmosphere_shift |
    -- direction_stabilized | moodboard_revisited | proposal_opened |
    -- proposal_approved | journey_progressed |
    -- call_requested | call_confirmed | call_rescheduled |
    -- designer_assigned | collaborator_added | studio_note_added |
    -- onboarding_reminder | inactive_relationship |
    -- relationship_silence_detected
  title               TEXT,
  narrative           TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority            TEXT NOT NULL DEFAULT 'normal',
    -- soft | normal | high
  read_at             TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  action_url          TEXT,
  action_label        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notif_recipient_chk CHECK
    (recipient_type IN ('client','designer','studio')),
  CONSTRAINT notif_priority_chk CHECK
    (priority IN ('soft','normal','high'))
);
CREATE INDEX IF NOT EXISTS notif_recipient_idx
  ON relationship_notifications (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notif_unread_idx
  ON relationship_notifications (recipient_user_id, read_at, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notif_tenant_idx
  ON relationship_notifications (tenant_id, created_at DESC);


-- Trigger: every `relationship_events` insert spawns relationship_notifications.
-- Implemented via a function that fans out to relevant recipients.
CREATE OR REPLACE FUNCTION fn_emit_relationship_notifications_for_event()
RETURNS TRIGGER AS $$
DECLARE
  recipient UUID;
  ntype TEXT;
BEGIN
  -- Map event_type → notification_type (1:1 for relevant types)
  ntype := CASE NEW.event_type
    WHEN 'message_sent'         THEN 'new_message'
    WHEN 'briefing_completed'   THEN 'journey_progressed'
    WHEN 'call_requested'       THEN 'call_requested'
    WHEN 'approval_confirmed'   THEN 'call_confirmed'
    WHEN 'moodboard_viewed'     THEN 'moodboard_revisited'
    WHEN 'proposal_opened'      THEN 'proposal_opened'
    WHEN 'client_returned'      THEN 'client_returned'
    WHEN 'designer_assigned'    THEN 'designer_assigned'
    WHEN 'journey_resumed'      THEN 'client_returned'
    ELSE NULL
  END;

  IF ntype IS NULL THEN
    RETURN NEW;
  END IF;

  -- DESIGNER recipient (when actor is client)
  IF NEW.actor_type = 'client' AND NEW.designer_id IS NOT NULL THEN
    INSERT INTO relationship_notifications (
      tenant_id, lead_id, recipient_user_id, recipient_type,
      sender_user_id, sender_type, notification_type,
      narrative, payload, priority, created_at
    ) VALUES (
      NEW.tenant_id, NEW.lead_id, NEW.designer_id, 'designer',
      NEW.actor_id, NEW.actor_type, ntype,
      NEW.narrative, NEW.payload,
      CASE WHEN ntype IN ('call_requested') THEN 'high' ELSE 'normal' END,
      NEW.occurred_at
    );
  END IF;

  -- CLIENT recipient (when actor is designer or studio)
  IF NEW.actor_type IN ('designer','studio') AND NEW.client_profile_id IS NOT NULL THEN
    INSERT INTO relationship_notifications (
      tenant_id, lead_id, recipient_user_id, recipient_type,
      sender_user_id, sender_type, notification_type,
      narrative, payload, priority, created_at
    ) VALUES (
      NEW.tenant_id, NEW.lead_id, NEW.client_profile_id, 'client',
      NEW.actor_id, NEW.actor_type, ntype,
      NEW.narrative, NEW.payload, 'normal', NEW.occurred_at
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emit_relationship_notifications_for_event ON relationship_events;
CREATE TRIGGER trg_emit_relationship_notifications_for_event
  AFTER INSERT ON relationship_events
  FOR EACH ROW
  EXECUTE FUNCTION fn_emit_relationship_notifications_for_event();
