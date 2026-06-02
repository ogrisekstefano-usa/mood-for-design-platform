-- ═══════════════════════════════════════════════════════════════════════
-- Migration 032 — Tenant Relationship Owner (M1)
-- Distinct from tenant_contacts.relationship_owner_user_id.
-- Tracks who owns the relationship with the ORGANIZATION as a whole.
-- ═══════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS tenant_relationship_owner_user_id UUID NULL
        REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tenant_relationship_owner_assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tenant_relationship_owner_assigned_by UUID NULL
        REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_relationship_owner
    ON tenants(tenant_relationship_owner_user_id)
    WHERE tenant_relationship_owner_user_id IS NOT NULL;

-- Backfill: tenant_relationship_owner ← studio_relations.owner_advisor_id (best-effort)
UPDATE tenants t
   SET tenant_relationship_owner_user_id  = sr.owner_advisor_id,
       tenant_relationship_owner_assigned_at = NOW()
  FROM studio_relations sr
 WHERE sr.tenant_id = t.id
   AND t.tenant_relationship_owner_user_id IS NULL
   AND sr.owner_advisor_id IS NOT NULL;

COMMIT;
