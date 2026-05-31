-- ITER177 · TEAM FOUNDATION™ Phase 0 · Migration 111
-- ==================================================
-- 1. Extend `user_role` enum with `sales` and `advisor`.
-- 2. Backfill safety: existing rows untouched (all enum members preserved).
-- 3. Add `accepted_at` trigger semantics via a tiny helper function (idempotent).
-- 4. Add a composite index on (status, tenant_id) for invite reconciliation.
--
-- NOTE on ALTER TYPE ... ADD VALUE: must be committed before the new value
-- is usable by subsequent DML in the SAME transaction. We therefore wrap
-- ADD VALUE statements outside any transaction (idempotent IF NOT EXISTS).

-- ── 1 · Extend enum ─────────────────────────────────────────────────────
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'advisor';

-- ── 2 · Helper index for invite list / status filter ────────────────────
CREATE INDEX IF NOT EXISTS users_profile_tenant_status_role_idx
  ON public.users_profile (tenant_id, status, role);

-- ── 3 · Convenience function: mark profile accepted on first login ──────
-- Called from the auth flow when a user with status='invited' authenticates
-- for the first time. Idempotent — no-op if already 'active'.
CREATE OR REPLACE FUNCTION public.mark_member_accepted(p_auth_user_id uuid)
RETURNS TABLE(profile_id uuid, transitioned boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid uuid;
  v_status text;
BEGIN
  SELECT id, status INTO v_pid, v_status
    FROM public.users_profile
   WHERE auth_user_id = p_auth_user_id
   LIMIT 1;

  IF v_pid IS NULL THEN
    RETURN;
  END IF;

  IF v_status = 'invited' THEN
    UPDATE public.users_profile
       SET status      = 'active',
           accepted_at = NOW(),
           updated_at  = NOW()
     WHERE id = v_pid;

    -- Mirror to tenant_memberships
    UPDATE public.tenant_memberships
       SET status     = 'active',
           updated_at = NOW()
     WHERE profile_id = v_pid
       AND status     = 'invited';

    -- Mirror to member_invites (track acceptance)
    UPDATE public.member_invites mi
       SET status      = 'accepted',
           accepted_at = NOW(),
           updated_at  = NOW()
     WHERE EXISTS (
       SELECT 1 FROM public.users_profile up
        WHERE up.id = v_pid
          AND up.email = mi.email
          AND up.tenant_id = mi.tenant_id
     );

    profile_id := v_pid;
    transitioned := true;
    RETURN NEXT;
  ELSE
    profile_id := v_pid;
    transitioned := false;
    RETURN NEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.mark_member_accepted IS
  'ITER177 Phase 0 · idempotent transition of users_profile.status from invited→active on first login';

-- ── 4 · schema_migrations ──────────────────────────────────────────────
INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('111_team_foundation_roles.sql', NOW())
ON CONFLICT (version) DO NOTHING;
