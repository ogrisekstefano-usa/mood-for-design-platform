-- ────────────────────────────────────────────────────────────────────
-- 092_notifications_activation.sql · ITER154
-- Notification production polish:
--   1. Expanded event_type → notification_type mapping
--   2. Soft priority hierarchy (quiet | normal | high)
--   3. Dedup window (no duplicate narrative within 90 seconds)
--   4. Idempotent
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_emit_relationship_notifications_for_event()
RETURNS TRIGGER AS $$
DECLARE
  ntype TEXT;
  prio  TEXT;
  recent_count INT;
BEGIN
  -- 1) Map event_type → notification_type
  ntype := CASE NEW.event_type
    WHEN 'message_sent'              THEN 'new_message'
    WHEN 'briefing_completed'        THEN 'journey_progressed'
    WHEN 'briefing_started'          THEN 'journey_progressed'
    WHEN 'call_requested'            THEN 'call_requested'
    WHEN 'approval_confirmed'        THEN 'call_confirmed'
    WHEN 'approval_requested'        THEN 'proposal_opened'
    WHEN 'moodboard_viewed'          THEN 'moodboard_revisited'
    WHEN 'proposal_opened'           THEN 'proposal_opened'
    WHEN 'client_returned'           THEN 'client_returned'
    WHEN 'designer_assigned'         THEN 'designer_assigned'
    WHEN 'designer_changed'          THEN 'collaborator_added'
    WHEN 'journey_resumed'           THEN 'client_returned'
    WHEN 'file_uploaded'             THEN 'studio_note_added'
    WHEN 'project_direction_updated' THEN 'atmosphere_shift'
    WHEN 'timeline_progressed'       THEN 'journey_progressed'
    WHEN 'status_changed'            THEN 'journey_progressed'
    ELSE NULL
  END;

  IF ntype IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2) Soft priority hierarchy
  prio := CASE ntype
    WHEN 'call_requested'        THEN 'high'
    WHEN 'call_confirmed'        THEN 'high'
    WHEN 'new_message'           THEN 'normal'
    WHEN 'client_returned'       THEN 'normal'
    WHEN 'proposal_opened'       THEN 'normal'
    WHEN 'designer_assigned'     THEN 'normal'
    WHEN 'collaborator_added'    THEN 'normal'
    WHEN 'atmosphere_shift'      THEN 'soft'
    WHEN 'moodboard_revisited'   THEN 'soft'
    WHEN 'journey_progressed'    THEN 'soft'
    ELSE 'normal'
  END;

  -- 3) DESIGNER recipient (client/system actor)
  IF NEW.designer_id IS NOT NULL AND NEW.actor_type IN ('client','system','studio') THEN
    -- Dedup: skip if same recipient + ntype + narrative within last 90s
    SELECT COUNT(*) INTO recent_count
    FROM relationship_notifications
    WHERE recipient_user_id = NEW.designer_id
      AND notification_type = ntype
      AND COALESCE(narrative,'') = COALESCE(NEW.narrative,'')
      AND created_at > NOW() - INTERVAL '90 seconds';

    IF recent_count = 0 THEN
      INSERT INTO relationship_notifications (
        tenant_id, lead_id, recipient_user_id, recipient_type,
        sender_user_id, sender_type, notification_type,
        narrative, payload, priority, created_at
      ) VALUES (
        NEW.tenant_id, NEW.lead_id, NEW.designer_id, 'designer',
        NEW.actor_id, NEW.actor_type, ntype,
        NEW.narrative, NEW.payload, prio, NEW.occurred_at
      );
    END IF;
  END IF;

  -- 4) CLIENT recipient (designer/studio actor)
  IF NEW.client_profile_id IS NOT NULL AND NEW.actor_type IN ('designer','studio','system') THEN
    SELECT COUNT(*) INTO recent_count
    FROM relationship_notifications
    WHERE recipient_user_id = NEW.client_profile_id
      AND notification_type = ntype
      AND COALESCE(narrative,'') = COALESCE(NEW.narrative,'')
      AND created_at > NOW() - INTERVAL '90 seconds';

    IF recent_count = 0 THEN
      INSERT INTO relationship_notifications (
        tenant_id, lead_id, recipient_user_id, recipient_type,
        sender_user_id, sender_type, notification_type,
        narrative, payload, priority, created_at
      ) VALUES (
        NEW.tenant_id, NEW.lead_id, NEW.client_profile_id, 'client',
        NEW.actor_id, NEW.actor_type, ntype,
        NEW.narrative, NEW.payload,
        CASE WHEN prio = 'high' THEN 'normal' ELSE prio END,
        NEW.occurred_at
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-bind trigger to the new function name; drop legacy
DROP TRIGGER IF EXISTS trg_emit_notifications_for_event ON relationship_events;
DROP TRIGGER IF EXISTS trg_emit_relationship_notifications ON relationship_events;
CREATE TRIGGER trg_emit_relationship_notifications
  AFTER INSERT ON relationship_events
  FOR EACH ROW
  EXECUTE FUNCTION fn_emit_relationship_notifications_for_event();

-- Drop old function only after new one is in place
DROP FUNCTION IF EXISTS fn_emit_notifications_for_event();
