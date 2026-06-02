-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK — Migration 031 (Relationship OS Foundation)
-- Reverses all DDL/data added by 031_relationship_os_foundation.sql.
-- USE WITH CARE: deletes catalog data, contact data, and activity data.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

DROP VIEW IF EXISTS v_relationship_timeline;

-- Indices on existing tables
DROP INDEX IF EXISTS idx_studio_relations_search;
DROP INDEX IF EXISTS idx_relationship_events_tenant_when;
DROP INDEX IF EXISTS idx_relationship_notifications_recipient_unread;
DROP INDEX IF EXISTS idx_relationship_notifications_tenant_unread;

-- Strip added columns from studio_relationship_events
ALTER TABLE studio_relationship_events
    DROP COLUMN IF EXISTS event_type_code,
    DROP COLUMN IF EXISTS tenant_id;

-- New tables (CASCADE removes FK and indices)
DROP TABLE IF EXISTS relationship_activities         CASCADE;
DROP TABLE IF EXISTS tenant_contacts                 CASCADE;

-- Catalogs
DROP TABLE IF EXISTS platform_contact_sources        CASCADE;
DROP TABLE IF EXISTS platform_activity_types         CASCADE;
DROP TABLE IF EXISTS platform_contact_roles          CASCADE;
DROP TABLE IF EXISTS platform_relationship_event_types CASCADE;

-- LEGACY READ-ONLY comments revert to NULL (no-op safe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='contacts')                THEN EXECUTE 'COMMENT ON TABLE contacts IS NULL'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='accounts')                THEN EXECUTE 'COMMENT ON TABLE accounts IS NULL'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='studio_team_members')     THEN EXECUTE 'COMMENT ON TABLE studio_team_members IS NULL'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications')           THEN EXECUTE 'COMMENT ON TABLE notifications IS NULL'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenant_activity_events')  THEN EXECUTE 'COMMENT ON TABLE tenant_activity_events IS NULL'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='advisor_lead_activities') THEN EXECUTE 'COMMENT ON TABLE advisor_lead_activities IS NULL'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='advisor_notes')           THEN EXECUTE 'COMMENT ON TABLE advisor_notes IS NULL'; END IF;
END$$;

COMMIT;
