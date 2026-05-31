-- ITER178 · JOURNEY ASSIGNMENTS™ Phase 1 · Migration 113
-- ====================================================
-- Adds the canonical journey-team membership table + audit events.
-- Coexists with `human_assignments` (account-level referente master).
--
-- Decision matrix (approved by Founder):
--   Q1 Observer:                  YES
--   Q2 Multiple contributors:     YES
--   Q3 Founder visible default:   NO  (tenant_settings.show_founder_in_team)
--   Q4 client_visible flag:       YES
--   Q5 Owner without replacement: NO  (app-level guard)
--   Q6 Multiple owners:           NO  (DB partial unique index enforce)
--   Q7 Observer client-visible:   NO  (default)
--   Q8 Owner handoff:             YES
--   Q9 Audit events:              YES

-- ── 1 · Main table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.design_journey_assignments (
  id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid           NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  journey_id        uuid           NOT NULL REFERENCES public.design_journeys(id) ON DELETE CASCADE,
  user_id           uuid           NOT NULL REFERENCES public.users_profile(id) ON DELETE CASCADE,
  assignment_role   text           NOT NULL CHECK (assignment_role IN ('owner','contributor','observer')),
  client_visible    boolean        NOT NULL DEFAULT true,
  assigned_at       timestamptz    NOT NULL DEFAULT NOW(),
  assigned_by       uuid           REFERENCES public.users_profile(id) ON DELETE SET NULL,
  revoked_at        timestamptz    NULL,
  revoked_by        uuid           REFERENCES public.users_profile(id) ON DELETE SET NULL,
  revoke_reason     text           NULL,
  metadata_json     jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz    NOT NULL DEFAULT NOW(),
  updated_at        timestamptz    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.design_journey_assignments IS
  'ITER178 Phase 1 · Team membership per Journey (multi-row, role-aware). Coexists with human_assignments (account-level referente). 1 owner UNIQUE per journey active.';

-- ── 2 · Indexes & constraints ──────────────────────────────────────────
-- 2.1 · Partial unique: exactly 1 active owner per journey
CREATE UNIQUE INDEX IF NOT EXISTS dja_one_owner_per_journey
  ON public.design_journey_assignments (journey_id)
  WHERE assignment_role = 'owner' AND revoked_at IS NULL;

-- 2.2 · Partial unique: a user can hold at most 1 active assignment per journey
CREATE UNIQUE INDEX IF NOT EXISTS dja_one_active_per_user_per_journey
  ON public.design_journey_assignments (journey_id, user_id)
  WHERE revoked_at IS NULL;

-- 2.3 · Lookups
CREATE INDEX IF NOT EXISTS dja_user_active_idx
  ON public.design_journey_assignments (user_id, assignment_role)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS dja_journey_active_idx
  ON public.design_journey_assignments (journey_id, assignment_role, client_visible)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS dja_tenant_idx
  ON public.design_journey_assignments (tenant_id);

-- ── 3 · Audit events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.design_journey_assignment_events (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assignment_id   uuid          NOT NULL REFERENCES public.design_journey_assignments(id) ON DELETE CASCADE,
  journey_id      uuid          NOT NULL REFERENCES public.design_journeys(id) ON DELETE CASCADE,
  event_type      text          NOT NULL CHECK (event_type IN (
                                  'owner_assigned','owner_changed',
                                  'contributor_added','contributor_removed',
                                  'observer_added','observer_removed',
                                  'role_changed','visibility_changed',
                                  'revoked','reinstated'
                                )),
  actor_user_id   uuid          REFERENCES public.users_profile(id) ON DELETE SET NULL,
  payload_json    jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.design_journey_assignment_events IS
  'ITER178 Phase 1 · Append-only audit log for design_journey_assignments mutations.';

CREATE INDEX IF NOT EXISTS djae_assignment_idx
  ON public.design_journey_assignment_events (assignment_id, created_at);
CREATE INDEX IF NOT EXISTS djae_journey_idx
  ON public.design_journey_assignment_events (journey_id, created_at);
CREATE INDEX IF NOT EXISTS djae_tenant_idx
  ON public.design_journey_assignment_events (tenant_id);

-- ── 4 · Updated_at trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._dja_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dja_set_updated_at ON public.design_journey_assignments;
CREATE TRIGGER dja_set_updated_at
  BEFORE UPDATE ON public.design_journey_assignments
  FOR EACH ROW EXECUTE FUNCTION public._dja_set_updated_at();

-- ── 5 · schema_migrations row ──────────────────────────────────────────
INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('113_design_journey_assignments.sql', NOW())
ON CONFLICT (version) DO NOTHING;
