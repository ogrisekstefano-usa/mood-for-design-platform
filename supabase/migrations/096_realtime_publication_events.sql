-- ============================================================
-- 096 · Sprint F · F4 — Realtime publication for timeline events
-- ============================================================
-- Promote relationship_events to a Supabase Realtime broadcaster.
-- Channel filter on tenant_id is applied client-side; the REST
-- endpoint stays authoritative for permission scoping (the
-- frontend re-fetches a delta on each realtime ping).
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE public.relationship_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'relationship_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_events';
  END IF;
END $$;
