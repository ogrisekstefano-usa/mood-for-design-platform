-- ────────────────────────────────────────────────────────────────────
-- 088_relationship_conversation.sql · ITER151 · SPRINT B
-- REAL CONVERSATION ENGINE™ · client ↔ designer
--
-- Editorial conversation layer — not a generic chat system. Each thread
-- belongs to a relationship (lead) and exposes message types richer than
-- text (image, inspiration_ref, material_ref, moodboard_link, …).
--
-- Idempotent.
-- ────────────────────────────────────────────────────────────────────

-- ── 1 · relationship_threads ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS relationship_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID,
  client_profile_id   UUID,
  primary_designer_id UUID,
  status              TEXT NOT NULL DEFAULT 'active',
    -- active | awaiting_reply | archived | muted
  last_message_at     TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_for_client   INT NOT NULL DEFAULT 0,
  unread_for_designer INT NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rel_thread_status_chk CHECK (status IN
    ('active','awaiting_reply','archived','muted'))
);

CREATE INDEX IF NOT EXISTS rel_thread_tenant_idx
  ON relationship_threads (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS rel_thread_designer_idx
  ON relationship_threads (primary_designer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS rel_thread_client_idx
  ON relationship_threads (client_profile_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS rel_thread_one_per_lead
  ON relationship_threads (tenant_id, lead_id)
  WHERE lead_id IS NOT NULL;


-- ── 2 · relationship_messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS relationship_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  thread_id           UUID NOT NULL REFERENCES relationship_threads(id) ON DELETE CASCADE,
  sender_type         TEXT NOT NULL,
    -- client | designer | studio | system
  sender_user_id      UUID,
  sender_label        TEXT,
  message_type        TEXT NOT NULL DEFAULT 'text',
    -- text | image | inspiration | material_reference | moodboard_link
    -- | proposal_reference | project_update | system_narrative
  content             TEXT,
  attachments         JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{ kind, url, label, ref_id, …}]
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at             TIMESTAMPTZ,
  edited_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rel_msg_sender_chk CHECK (sender_type IN
    ('client','designer','studio','system')),
  CONSTRAINT rel_msg_type_chk CHECK (message_type IN
    ('text','image','inspiration','material_reference','moodboard_link',
     'proposal_reference','project_update','system_narrative'))
);

CREATE INDEX IF NOT EXISTS rel_msg_thread_idx
  ON relationship_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rel_msg_tenant_idx
  ON relationship_messages (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rel_msg_unread_idx
  ON relationship_messages (thread_id, read_at) WHERE read_at IS NULL;


-- ── 3 · relationship_memory_fragments (light memory layer) ─────────
-- Editorial "memory beats" automatically distilled from conversations
-- and events (atmosphere shift, repeated reference, hesitation, …).
-- Sprint B drops in the scaffold; Sprint D wires the AI detector.
CREATE TABLE IF NOT EXISTS relationship_memory_fragments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  lead_id             UUID,
  thread_id           UUID,
  source_message_id   UUID,
  fragment_type       TEXT NOT NULL,
    -- atmosphere_shift | material_preference | emotional_alignment
    -- | repeated_reference | hesitation | excitement | direction_note
  body                TEXT,
  signal_strength     NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rel_mem_lead_idx
  ON relationship_memory_fragments (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rel_mem_tenant_idx
  ON relationship_memory_fragments (tenant_id, created_at DESC);
