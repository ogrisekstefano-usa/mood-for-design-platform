-- ============================================================
-- 093 · Sprint F · F1 — Realtime publication for notifications
-- ============================================================
-- Promote relationship_notifications to a Supabase Realtime
-- broadcaster. Channel filter on recipient_user_id is applied
-- client-side via realtimeBus.js.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. REPLICA IDENTITY FULL → so DELETE/UPDATE payloads carry
--    the row identity (recipient_user_id, priority, …) and
--    not just the primary key. Required for client-side
--    filter matching on UPDATE/DELETE events.
ALTER TABLE public.relationship_notifications REPLICA IDENTITY FULL;

-- 2. Ensure the table is broadcast on `supabase_realtime`
--    publication. ADD TABLE is not idempotent, so we use a
--    DO-block to inspect pg_publication_tables first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'relationship_notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_notifications';
  END IF;
END $$;

-- 3. (Optional) verify
-- SELECT pubname, tablename FROM pg_publication_tables
--  WHERE schemaname='public' AND tablename='relationship_notifications';
