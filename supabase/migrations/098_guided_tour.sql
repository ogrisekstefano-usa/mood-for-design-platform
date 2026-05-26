-- ============================================================
-- 098 · ITER154 · Guided Tour / Interactive Onboarding
-- Editorial onboarding for the studio atelier.
-- NOT a SaaS tooltip. An invitation to inhabit the studio.
-- ============================================================

-- 1. Tour configuration (DB-driven, CMS editable later)
CREATE TABLE IF NOT EXISTS guided_tour_config (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES tenants(id) ON DELETE CASCADE,
  tour_key           TEXT NOT NULL,
  step_order         INT  NOT NULL,
  target_selector    TEXT,
  route              TEXT,
  eyebrow            JSONB NOT NULL DEFAULT '{}'::jsonb,
  title              JSONB NOT NULL DEFAULT '{}'::jsonb,
  body               JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled            BOOLEAN NOT NULL DEFAULT true,
  role_visibility    TEXT[] DEFAULT NULL,
  module_dependency  TEXT,
  placement          TEXT DEFAULT 'auto',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_guided_tour_config_key
  ON guided_tour_config(tour_key, step_order);

-- Add columns if table existed from a previous migration run
ALTER TABLE guided_tour_config ADD COLUMN IF NOT EXISTS eyebrow JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE guided_tour_config ADD COLUMN IF NOT EXISTS placement TEXT DEFAULT 'auto';

-- 2. Per-user onboarding state
CREATE TABLE IF NOT EXISTS user_onboarding_state (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  user_id       UUID NOT NULL,
  tour_key      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'not_started',
    -- not_started | in_progress | completed | skipped
  current_step  INT  NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  skipped_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, tour_key)
);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_state_user
  ON user_onboarding_state(user_id, tour_key);

-- 3. Seed the global default 7-step tour (tenant_id IS NULL = platform default).
-- Idempotent: clear and re-insert so copy stays current with editorial revisions.
DELETE FROM guided_tour_config
 WHERE tenant_id IS NULL AND tour_key = 'studio_first_login';

INSERT INTO guided_tour_config
  (tenant_id, tour_key, step_order, target_selector, route, eyebrow, title, body, role_visibility, placement)
VALUES
  -- Step 1 · Welcome to the studio (centered, no selector)
  (NULL, 'studio_first_login', 1, NULL, '/dashboard',
   '{"it":"Benvenuto","en":"Welcome"}'::jsonb,
   '{"it":"Il tuo atelier digitale","en":"Your digital atelier"}'::jsonb,
   '{"it":"Blueprint OS™ è lo spazio dove il tuo studio respira. Non un software da imparare — un atelier da abitare. Ti accompagno in sette movimenti, con calma.","en":"Blueprint OS™ is the space where your studio breathes. Not software to learn — an atelier to inhabit. I will walk you through seven movements, slowly."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager','founder','creative_director'],
   'center'),

  -- Step 2 · Dashboard hero (the breathing room)
  (NULL, 'studio_first_login', 2, '[data-testid="atelier-hero"]', '/dashboard',
   '{"it":"Il respiro dello studio","en":"The breath of the studio"}'::jsonb,
   '{"it":"La tua dashboard","en":"Your dashboard"}'::jsonb,
   '{"it":"Da qui osservi cosa accade nelle tue relazioni. Non metriche, non KPI — il movimento vivo dello studio.","en":"From here you observe what is happening in your relationships. Not metrics, not KPIs — the living movement of your studio."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager','founder','creative_director'],
   'bottom'),

  -- Step 3 · First relationship — the foundational gesture
  (NULL, 'studio_first_login', 3, '[data-testid="guided-tour-create-lead"]', '/dashboard',
   '{"it":"Inizia","en":"Begin"}'::jsonb,
   '{"it":"Accogli la prima relazione","en":"Welcome the first relationship"}'::jsonb,
   '{"it":"Ogni progetto inizia da un incontro. Crea il primo contatto — un nome, un\u2019atmosfera, un\u2019intenzione. È così che lo studio comincia a esistere.","en":"Every project begins with an encounter. Create the first contact — a name, an atmosphere, an intention. That is how the studio begins to exist."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager','founder','creative_director'],
   'bottom'),

  -- Step 4 · Design Journey (the curated path)
  (NULL, 'studio_first_login', 4, '[data-testid="guided-tour-new-journey"]', '/dashboard',
   '{"it":"Il viaggio","en":"The journey"}'::jsonb,
   '{"it":"Apri un Design Journey","en":"Open a Design Journey"}'::jsonb,
   '{"it":"Un Design Journey™ è un cammino progettuale che accompagna il cliente dall\u2019intuizione iniziale fino all\u2019atmosfera finale. Lì vivono ispirazioni, proposte, materiali, conversazioni.","en":"A Design Journey™ is a path that accompanies the client from the first intuition to the final atmosphere. There, inspirations, proposals, materials and conversations live together."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager','founder','creative_director'],
   'bottom'),

  -- Step 5 · Media archive (memory of the studio)
  (NULL, 'studio_first_login', 5, '[data-testid="guided-tour-media-library"]', '/dashboard',
   '{"it":"La memoria","en":"The memory"}'::jsonb,
   '{"it":"L\u2019archivio dello studio","en":"The studio archive"}'::jsonb,
   '{"it":"Immagini, materiali, ispirazioni, riferimenti culturali. Tutto ciò che nutre l\u2019atmosfera dei tuoi progetti resta qui, vivo e riutilizzabile.","en":"Images, materials, inspirations, cultural references. Everything that nourishes the atmosphere of your projects lives here, alive and reusable."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager','founder','creative_director'],
   'right'),

  -- Step 6 · Moodboards (the voice before words)
  (NULL, 'studio_first_login', 6, '[data-testid="guided-tour-moodboards"]', '/dashboard',
   '{"it":"L\u2019atmosfera","en":"The atmosphere"}'::jsonb,
   '{"it":"Componi le tue atmosfere","en":"Compose your atmospheres"}'::jsonb,
   '{"it":"I moodboard parlano al cliente prima delle parole. Ogni board è una direzione progettuale, un\u2019intenzione visiva condivisa.","en":"Moodboards speak to the client before words. Each board is a project direction, a shared visual intention."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager','founder','creative_director'],
   'right'),

  -- Step 7 · Studio Pulse (the founder lens) + closing
  (NULL, 'studio_first_login', 7, NULL, '/dashboard',
   '{"it":"L\u2019osservatorio","en":"The observatory"}'::jsonb,
   '{"it":"Lo studio è pronto","en":"The studio is ready"}'::jsonb,
   '{"it":"Tutto il resto — chat, presenza, calendario, intelligenza relazionale — emergerà nel tempo, naturalmente. Adesso, inizia a costruire il tuo atelier.","en":"Everything else — chat, presence, calendar, relational intelligence — will emerge over time, naturally. Now, begin to build your atelier."}'::jsonb,
   ARRAY['tenant_admin','super_admin','designer','studio_owner','project_manager','founder','creative_director'],
   'center');
