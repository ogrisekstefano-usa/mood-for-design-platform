-- ────────────────────────────────────────────────────────────────────
-- 104_recall_requests.sql · ITER161 · P0.2
-- Recall Requests — il cliente può chiedere allo studio di sentirsi.
-- Tono relazionale, non SaaS calendar. Visibile sia al cliente
-- ("Richiesta ricevuta. Lo studio ti proporrà un momento.") sia al
-- referente nel thread di conversazione.
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recall_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  client_profile_id   UUID,
  account_id          UUID,
  journey_id          UUID,
  thread_id           UUID,
  assignee_user_id    UUID,
  status              TEXT NOT NULL DEFAULT 'received',
    -- received | scheduled | completed | cancelled
  preferred_days      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- ['mon','tue','wed','thu','fri','sat']
  preferred_time      TEXT,
    -- 'morning' | 'afternoon' | 'evening' | 'any'
  preferred_channel   TEXT,
    -- 'phone' | 'video' | 'whatsapp' | 'any'
  note                TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recall_status_chk CHECK (status IN
    ('received','scheduled','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS recall_tenant_created_idx
  ON recall_requests (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recall_client_idx
  ON recall_requests (client_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recall_assignee_idx
  ON recall_requests (assignee_user_id, status, created_at DESC);
