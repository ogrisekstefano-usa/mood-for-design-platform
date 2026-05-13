-- ===== 004: GRANT NEW TABLE PRIVILEGES TO API ROLES =====
-- Purpose: Supabase PostgREST uses the `anon` and `authenticated` roles via API key. New tables
-- created in migration 003 don't auto-grant; we must explicitly grant SELECT/INSERT/UPDATE/DELETE
-- to `service_role` (admin server-side) and `authenticated` (when RLS will be enabled).
-- Reversible: yes (REVOKE …).
-- Author: agent / 2026-05-13

BEGIN;

GRANT ALL ON TABLE public.project_notes     TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.project_activity  TO service_role, authenticated, anon;
GRANT ALL ON TABLE public.moodboard_shares  TO service_role, authenticated, anon;

-- Sequence grants are not needed because these tables use uuid_generate_v4() for PK,
-- not bigserial. But we ensure ALL future tables inherit grants via default privileges
-- (idempotent).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO service_role, authenticated, anon;

COMMIT;
