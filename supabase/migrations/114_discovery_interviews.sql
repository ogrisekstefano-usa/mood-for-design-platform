-- ITER177.B · CRM LIFECYCLE PHASE 1 · Discovery Interviews
-- ===========================================================
-- Adds the explicit Discovery Interview entity required by the
-- canonical CRM model: Lead → Discovery → Prospect → Journey.
--
-- Reference: CRM_LIFECYCLE_CANON.md §4, CRM_LIFECYCLE_IMPLEMENTATION_PLAN.md §2.

-- ── 1 · Status enum ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.discovery_status AS ENUM (
    'pending', 'in_progress', 'qualified', 'unqualified', 'recycled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2 · Main table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discovery_interviews (
  id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid             NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id                 uuid             NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status                  discovery_status NOT NULL DEFAULT 'pending',
  source                  text             NOT NULL DEFAULT 'manual',
  started_at              timestamptz      NULL,
  completed_at            timestamptz      NULL,
  conducted_by            uuid             NULL REFERENCES public.users_profile(id) ON DELETE SET NULL,
  notes                   text             NULL,
  qualification_signals   jsonb            NOT NULL DEFAULT '{}'::jsonb,
  disqualification_reason text             NULL,
  recording_url           text             NULL,
  metadata_json           jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz      NOT NULL DEFAULT NOW(),
  updated_at              timestamptz      NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.discovery_interviews IS
  'ITER177.B · CRM Phase 1. Explicit Discovery step gating Lead → Prospect transition. Backfilled from leads.status=qualified.';

-- ── 3 · Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_discovery_lead         ON public.discovery_interviews(lead_id);
CREATE INDEX IF NOT EXISTS idx_discovery_tenant_status ON public.discovery_interviews(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_discovery_source        ON public.discovery_interviews(tenant_id, source);

-- ── 4 · Trigger updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discovery_touch ON public.discovery_interviews;
CREATE TRIGGER trg_discovery_touch
  BEFORE UPDATE ON public.discovery_interviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_discovery_updated_at();

-- ── 5 · Backfill: ogni lead 'qualified' esistente → discovery row ────
INSERT INTO public.discovery_interviews
  (tenant_id, lead_id, status, source, completed_at, qualification_signals, metadata_json)
SELECT
  l.tenant_id,
  l.id,
  'qualified'::discovery_status,
  COALESCE(l.source, 'backfill'),
  COALESCE(l.intake_completed_at, l.updated_at, NOW()),
  jsonb_build_object('backfill', true, 'reason', 'iter177b_backfill_from_lead_qualified'),
  '{}'::jsonb
FROM public.leads l
WHERE l.status = 'qualified'
  AND NOT EXISTS (
    SELECT 1 FROM public.discovery_interviews d WHERE d.lead_id = l.id
  );

-- ── 6 · Stats hint (read-only view consigliata) ─────────────────────
-- Per audit + dashboard: numero discovery per tenant by status.
CREATE OR REPLACE VIEW public.v_discovery_stats AS
SELECT
  tenant_id,
  status,
  COUNT(*) AS total,
  MAX(completed_at) AS last_completed_at
FROM public.discovery_interviews
GROUP BY tenant_id, status;

COMMENT ON VIEW public.v_discovery_stats IS
  'ITER177.B · Aggregated discovery interview counts per tenant.';
