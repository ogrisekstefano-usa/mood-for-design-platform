-- ============================================================
-- 095 · Sprint F · F3 — Realtime publication for presence
-- ============================================================
-- Promote designer_presence to a Supabase Realtime broadcaster.
-- Channel filter on designer_id is applied client-side.
--
-- Idempotent: safe to re-run.
-- ============================================================

ALTER TABLE public.designer_presence REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'designer_presence'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.designer_presence';
  END IF;
END $$;
