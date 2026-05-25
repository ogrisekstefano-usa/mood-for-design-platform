-- ============================================================
-- 094 · Sprint F · F2 — Realtime publication for chat messages
-- ============================================================
-- Promote relationship_messages to a Supabase Realtime
-- broadcaster. Channel filter on thread_id is applied
-- client-side via realtimeBus.js.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. REPLICA IDENTITY FULL → DELETE/UPDATE payloads carry
--    the row identity (thread_id, sender_user_id, …) required
--    for client-side filter matching.
ALTER TABLE public.relationship_messages REPLICA IDENTITY FULL;

-- 2. Ensure the table is broadcast on `supabase_realtime`.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'relationship_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_messages';
  END IF;
END $$;
