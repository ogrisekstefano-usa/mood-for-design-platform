-- Rollback for 035_notification_center.sql
BEGIN;

DROP INDEX IF EXISTS idx_notif_recipient_priority_unread;
DROP INDEX IF EXISTS idx_notif_recipient_type;
DROP INDEX IF EXISTS uq_notif_dedup;

ALTER TABLE relationship_notifications
    DROP COLUMN IF EXISTS dedup_key,
    DROP COLUMN IF EXISTS source_event_id,
    DROP COLUMN IF EXISTS source_event_type,
    DROP COLUMN IF EXISTS advisor_user_id,
    DROP COLUMN IF EXISTS activity_id,
    DROP COLUMN IF EXISTS contact_id,
    DROP COLUMN IF EXISTS notification_type_code;

DROP TABLE IF EXISTS relationship_notification_preferences;
DROP TABLE IF EXISTS platform_notification_types;

COMMIT;
