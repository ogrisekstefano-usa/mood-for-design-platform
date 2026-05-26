-- ============================================================
-- 098 · ITER154 · Guided Tour / Interactive Onboarding
-- ============================================================

-- 1. Tour configuration (DB-driven, CMS editable later)
CREATE TABLE IF NOT EXISTS guided_tour_config (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tour_key           TEXT NOT NULL,
  step_order         INT  NOT NULL,
  target_selector    TEXT,
  route              TEXT,
  title              JSONB NOT NULL DEFAULT '{}'::jsonb,
  body               JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled            BOOLEAN NOT NULL DEFAULT true,
  role_visibility    TEXT[] DEFAULT NULL,
  module_dependency  TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, tour_key, step_order)
);
CREATE INDEX IF NOT EXISTS idx_guided_tour_config_key ON guided_tour_config(tour_key, step_order);

-- 2. Per-user onboarding state
CREATE TABLE IF NOT EXISTS user_onboarding_state (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID NOT NULL,
  tour_key      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'not_started',
  current_step  INT  NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  skipped_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, tour_key)
);

-- 3. Default seed: 7 steps for the 'studio_first_login' tour
-- Tenant-null = global default (resolver merges global + tenant override)
INSERT INTO guided_tour_config
  (tenant_id, tour_key, step_order, target_selector, route, title, body, role_visibility)
VALUES
  (NULL, 'studio_first_login', 1, '[data-testid="atelier-dashboard-hero"]', '/dashboard',
   '{"it":"La tua dashboard","en":"Your dashboard"}'::jsonb,
   '{"it":"Da qui controlli Design Journey, clienti, moodboard e attività principali.","en":"From here you control Design Journeys, clients, moodboards and main activities."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager']),

  (NULL, 'studio_first_login', 2, '[data-testid="dashboard-new-journey-cta"]', '/dashboard',
   '{"it":"Nuovo Design Journey","en":"New Design Journey"}'::jsonb,
   '{"it":"Crea un nuovo percorso progettuale per un cliente, dal primo briefing alla proposta finale.","en":"Create a new design path for a client, from initial briefing to final proposal."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager']),

  (NULL, 'studio_first_login', 3, '[data-testid="sidebar-link-media"]', '/dashboard',
   '{"it":"Media Library","en":"Media Library"}'::jsonb,
   '{"it":"Carica immagini, materiali, ispirazioni e contenuti visuali. Tutti gli asset restano centralizzati e riutilizzabili.","en":"Upload images, materials, inspirations and visual content. All assets stay centralized and reusable."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager']),

  (NULL, 'studio_first_login', 4, '[data-testid="sidebar-link-moodboards"]', '/dashboard',
   '{"it":"Moodboard","en":"Moodboards"}'::jsonb,
   '{"it":"Costruisci presentazioni visive e atmosfere progettuali da condividere o utilizzare nei tuoi Journey.","en":"Build visual presentations and project atmospheres to share or use in your Journeys."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager']),

  (NULL, 'studio_first_login', 5, '[data-testid="sidebar-link-journeys"]', '/dashboard',
   '{"it":"Design Journey","en":"Design Journeys"}'::jsonb,
   '{"it":"Segui ogni fase del percorso: ispirazione, proposta, approvazione, sviluppo e relazione con il cliente.","en":"Follow every stage: inspiration, proposal, approval, development and client relationship."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager']),

  (NULL, 'studio_first_login', 6, '[data-testid="sidebar-link-client-portal"]', '/dashboard',
   '{"it":"Spazio cliente","en":"Client Portal"}'::jsonb,
   '{"it":"Condividi contenuti selezionati con il cliente e accompagna il progetto in uno spazio dedicato.","en":"Share selected content with the client and follow the project in a dedicated space."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager']),

  (NULL, 'studio_first_login', 7, '[data-testid="sidebar-link-support"]', '/dashboard',
   '{"it":"Supporto","en":"Support"}'::jsonb,
   '{"it":"Trova guide, tutorial e assistenza per configurare al meglio il tuo studio.","en":"Find guides, tutorials and assistance to configure your studio."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager'])
ON CONFLICT DO NOTHING;
