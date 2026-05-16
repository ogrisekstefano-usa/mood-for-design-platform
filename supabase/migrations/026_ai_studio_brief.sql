-- ───────────────────────────────────────────────────────────────────────
-- Phase P0.6 — AI Studio Brief™ snapshots
-- Stores generated briefs per project with full LLM context for reuse
-- and versioning. Designed to be lightweight: latest is queried, older
-- versions are kept for "Generate Updated Brief" diffing in the future.
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_ai_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- The structured 6 sections (Direction, Material Language, Emotional
  -- Positioning, Market Adaptation, Design Risks, Next Suggested Moves)
  sections        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Verbatim context payload sent to LLM (for traceability + replay)
  context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  market          TEXT,
  locale          TEXT DEFAULT 'it',
  -- Provenance
  model           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proj_ai_briefs_project_recent
  ON project_ai_briefs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proj_ai_briefs_tenant
  ON project_ai_briefs(tenant_id, created_at DESC);
