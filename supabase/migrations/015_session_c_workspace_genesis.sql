-- =============================================================================
-- Session C — Workspace Genesis™ · The Magic Moment
-- Migration 015 · minimal persistence to deliver the emotional "your Blueprint
-- is ready" experience when a private client or professional completes onboarding.
--
-- WHAT THIS ADDS
--   • lead_assignments  : a thin many-to-one log of (lead → designer) bindings
--   • demo team profiles: 3 designer personas (Elizabeth, Diego, Sofia) inserted
--                         as users_profile rows of MOOD Demo Studio so the
--                         "your project is followed by ..." relationship layer
--                         has something visible from day 1.
--
-- WHAT THIS DOES NOT ADD
--   • No CRM pipelines · no automation engine · no realtime channels.
--   • No new "professionals" table — they live in users_profile with role=designer.
--
-- The existing `leads` table already supports our needs via:
--   metadata_json    → carries the full onboarding payload
--   assigned_to      → mirrors the latest assignment (read-fast)
--   lead_type        → 'private_client' | 'ad_partner'
--   status           → 'new' on insert, advances as the user enters Blueprint
-- =============================================================================
BEGIN;

-- ── Ensure leads has assigned_to mirror (fast read of current assignment) ───
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users_profile(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads(assigned_to);

-- ── Ensure users_profile has a flexible metadata bag (persona, bio, languages, online_status, roundrobin slot, etc.)
ALTER TABLE users_profile
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS users_profile_metadata_gin ON users_profile USING GIN (metadata_json);

-- ── lead_assignments — append-only log ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by   UUID REFERENCES users_profile(id) ON DELETE SET NULL,
  -- Future: 'auto_round_robin' | 'auto_first_available' | 'manual'
  assignment_kind TEXT NOT NULL DEFAULT 'auto_round_robin',
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS lead_assignments_tenant_idx ON lead_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS lead_assignments_lead_idx   ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS lead_assignments_profile_idx ON lead_assignments(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON lead_assignments TO service_role;
GRANT SELECT ON lead_assignments TO authenticated;

-- ── Demo professional personas ─────────────────────────────────────────────
-- These rows hydrate the human relationship layer of the demo tenant.
-- Round-robin assignment will cycle through these three personas.
-- NOTE: auth_user_id is intentionally NULL (these are visible personas only,
-- not loggable accounts; super_admin manages them on their behalf).
--
-- profile.metadata_json carries the cinematic team metadata:
--   { avatar_url, bio_short (locale bag), languages, online_status, role_label }
DO $$
DECLARE
  demo_tenant UUID := '81a09ead-0306-4d71-a5c4-ca2b3956add2'; -- mood-demo-studio
BEGIN
  -- Elizabeth · Lead Designer (round-robin slot 0)
  INSERT INTO users_profile (id, tenant_id, email, first_name, last_name, role, status, avatar_url, metadata_json, created_at, updated_at)
  VALUES (
    'a0000001-c001-4001-8001-000000000001'::uuid,
    demo_tenant,
    'elizabeth@moodfordesign.com',
    'Elizabeth', 'Whitcomb',
    'designer', 'active',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&h=400&q=85',
    jsonb_build_object(
      'persona', true,
      'role_label', jsonb_build_object('_default', 'Lead Designer', 'it', 'Lead Designer', 'en-US', 'Lead Designer'),
      'bio_short', jsonb_build_object(
        '_default', 'Editorial residential. Twelve years between Milan and London.',
        'it', 'Residenziale editoriale. Dodici anni tra Milano e Londra.',
        'en-US', 'Editorial residential. Twelve years between Milan and London.',
        'en-GB', 'Editorial residential. Twelve years between Milan and London.',
        'fr', 'Résidentiel éditorial. Douze ans entre Milan et Londres.',
        'de', 'Editorial-Wohnbau. Zwölf Jahre zwischen Mailand und London.',
        'es', 'Residencial editorial. Doce años entre Milán y Londres.'
      ),
      'languages', jsonb_build_array('it', 'en-GB', 'fr'),
      'online_status', 'available',
      'roundrobin_slot', 0
    ),
    NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    metadata_json = EXCLUDED.metadata_json,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  -- Diego · Senior Architect (round-robin slot 1)
  INSERT INTO users_profile (id, tenant_id, email, first_name, last_name, role, status, avatar_url, metadata_json, created_at, updated_at)
  VALUES (
    'a0000001-c001-4001-8001-000000000002'::uuid,
    demo_tenant,
    'diego@moodfordesign.com',
    'Diego', 'Marín',
    'designer', 'active',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=85',
    jsonb_build_object(
      'persona', true,
      'role_label', jsonb_build_object('_default', 'Senior Architect', 'it', 'Architetto Senior'),
      'bio_short', jsonb_build_object(
        '_default', 'Hospitality and contract. Material atelier in Florence.',
        'it', 'Hospitality e contract. Atelier dei materiali a Firenze.',
        'en-US', 'Hospitality and contract. Material atelier in Florence.',
        'en-GB', 'Hospitality and contract. Material atelier in Florence.',
        'fr', 'Hospitality et contract. Atelier des matériaux à Florence.',
        'de', 'Hospitality und Contract. Materialatelier in Florenz.',
        'es', 'Hospitality y contract. Atelier de materiales en Florencia.'
      ),
      'languages', jsonb_build_array('it', 'es', 'en-US'),
      'online_status', 'available',
      'roundrobin_slot', 1
    ),
    NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    metadata_json = EXCLUDED.metadata_json,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  -- Sofia · Materials Curator (round-robin slot 2)
  INSERT INTO users_profile (id, tenant_id, email, first_name, last_name, role, status, avatar_url, metadata_json, created_at, updated_at)
  VALUES (
    'a0000001-c001-4001-8001-000000000003'::uuid,
    demo_tenant,
    'sofia@moodfordesign.com',
    'Sofia', 'Rinaldi',
    'designer', 'active',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400&q=85',
    jsonb_build_object(
      'persona', true,
      'role_label', jsonb_build_object('_default', 'Materials Curator', 'it', 'Curatrice Materiali'),
      'bio_short', jsonb_build_object(
        '_default', 'Stone, oak, brushed brass. Sourcing from the best Italian workshops.',
        'it', 'Pietra, rovere, ottone spazzolato. Selezione dalle migliori botteghe italiane.',
        'en-US', 'Stone, oak, brushed brass. Sourcing from the best Italian workshops.',
        'en-GB', 'Stone, oak, brushed brass. Sourcing from the best Italian workshops.',
        'fr', 'Pierre, chêne, laiton brossé. Sélection auprès des meilleurs ateliers italiens.',
        'de', 'Stein, Eiche, gebürstetes Messing. Auswahl aus den besten italienischen Werkstätten.',
        'es', 'Piedra, roble, latón cepillado. Selección de los mejores talleres italianos.'
      ),
      'languages', jsonb_build_array('it', 'en-US', 'fr'),
      'online_status', 'away',
      'roundrobin_slot', 2
    ),
    NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    metadata_json = EXCLUDED.metadata_json,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
END $$;

COMMIT;
