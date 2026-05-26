-- ============================================================
-- 100 · ITER155 · Editorial Copy CMS · Surface Governance System™
-- ============================================================
-- Surfaces-first navigation: instead of 2268 flat keys, the
-- governance UI walks editorial surfaces (Home, Begin Journey,
-- Guided Tour, First Moves, Notifications, Client Portal, Auth…)
-- and lets you edit phrases inline with eyebrow / title / body.
--
-- Tenant override path: phrase.default_text_* are platform-wide;
-- editorial_phrase_overrides hold per-tenant per-locale changes
-- so studios can customize their voice without touching code.
-- ============================================================

-- 1. Editorial surfaces (Home, Begin Journey, ...)
CREATE TABLE IF NOT EXISTS editorial_surfaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  name          JSONB NOT NULL DEFAULT '{}'::jsonb,
  description   JSONB NOT NULL DEFAULT '{}'::jsonb,
  icon          TEXT,
  sort_order    INT NOT NULL DEFAULT 100,
  preview_route TEXT,
  voice_hints   JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{ "level": "info|warn", "rule": "Avoid CRM terminology" }, ...]
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_editorial_surfaces_order ON editorial_surfaces(sort_order);

-- 2. Editorial phrases (canonical content of each surface)
CREATE TABLE IF NOT EXISTS editorial_phrases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_id      UUID NOT NULL REFERENCES editorial_surfaces(id) ON DELETE CASCADE,
  phrase_key      TEXT NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'block',
    -- block | eyebrow | title | body | cta | meta
  position        INT NOT NULL DEFAULT 100,
  eyebrow         JSONB DEFAULT NULL,
  title           JSONB DEFAULT NULL,
  body            JSONB DEFAULT NULL,
  cta             JSONB DEFAULT NULL,
  meta            JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (surface_id, phrase_key)
);
CREATE INDEX IF NOT EXISTS idx_editorial_phrases_surface
  ON editorial_phrases(surface_id, position);

-- 3. Per-tenant overrides
CREATE TABLE IF NOT EXISTS editorial_phrase_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phrase_id     UUID NOT NULL REFERENCES editorial_phrases(id) ON DELETE CASCADE,
  eyebrow       JSONB DEFAULT NULL,
  title         JSONB DEFAULT NULL,
  body          JSONB DEFAULT NULL,
  cta           JSONB DEFAULT NULL,
  updated_by    UUID,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, phrase_id)
);

-- 4. Seed surfaces + initial phrases
DELETE FROM editorial_phrases WHERE surface_id IN (SELECT id FROM editorial_surfaces);
DELETE FROM editorial_surfaces;

INSERT INTO editorial_surfaces
  (code, name, description, icon, sort_order, preview_route, voice_hints)
VALUES
  ('public.home', '{"it":"Sito pubblico — Home","en":"Public site — Home"}'::jsonb,
   '{"it":"La porta d''ingresso al sito. Welcome strip, hero, materiali, CTA finale.","en":"The front door of the site. Welcome strip, hero, materials, final CTA."}'::jsonb,
   'home', 10, '/',
   '[{"level":"info","rule":"Mantieni un tono editoriale, non SaaS"},{"level":"warn","rule":"Evita parole come ''piattaforma'', ''software'', ''utenti''"}]'::jsonb),

  ('public.begin_journey', '{"it":"Begin Journey","en":"Begin Journey"}'::jsonb,
   '{"it":"Il primo passo del cliente verso il Design Journey™.","en":"The client''s first step toward the Design Journey™."}'::jsonb,
   'compass', 20, '/begin-journey',
   '[{"level":"info","rule":"Parla di intenzione, non di campi da compilare"},{"level":"warn","rule":"Niente ''form'', ''wizard'', ''step''"}]'::jsonb),

  ('studio.dashboard', '{"it":"Studio — Dashboard","en":"Studio — Dashboard"}'::jsonb,
   '{"it":"Il respiro dello studio: hero, KPI, Le Prime Mosse, empty states.","en":"The breath of the studio: hero, KPIs, First Moves, empty states."}'::jsonb,
   'layout', 30, '/dashboard',
   '[{"level":"info","rule":"Preferisci linguaggio relazionale a quello metrico"},{"level":"warn","rule":"Evita ''KPI'', ''metriche'', ''performance''"}]'::jsonb),

  ('studio.guided_tour', '{"it":"Guided Tour","en":"Guided Tour"}'::jsonb,
   '{"it":"Onboarding cinematico — 7 movimenti per accogliere il professionista.","en":"Cinematic onboarding — 7 movements to welcome the professional."}'::jsonb,
   'sparkles', 40, '/dashboard',
   '[{"level":"info","rule":"NON spiegare funzionalità — spiega intenzione"},{"level":"warn","rule":"Mai ''clicca'', ''vai a'', ''premi''"}]'::jsonb),

  ('studio.first_moves', '{"it":"Le Prime Mosse","en":"First Moves"}'::jsonb,
   '{"it":"5 inviti operativi per studi appena entrati: Lead, Design Journey, Media, Moodboard, Piano editoriale.","en":"5 operational invitations for studios just arrived."}'::jsonb,
   'rocket', 50, '/dashboard',
   '[{"level":"info","rule":"Inviti, non task da spuntare"}]'::jsonb),

  ('studio.notifications', '{"it":"Notifiche","en":"Notifications"}'::jsonb,
   '{"it":"Drawer notifiche · template di narrativa editoriale per gli eventi.","en":"Notifications drawer · editorial narrative templates for events."}'::jsonb,
   'bell', 60, '/dashboard',
   '[{"level":"info","rule":"Trasforma eventi tecnici in segnali relazionali"},{"level":"warn","rule":"Niente ''CRM'', ''log'', ''sistema''"}]'::jsonb),

  ('client.portal', '{"it":"Client Portal","en":"Client Portal"}'::jsonb,
   '{"it":"L''esperienza del cliente: referente, capitoli, atmosfera condivisa.","en":"The client experience: referent, chapters, shared atmosphere."}'::jsonb,
   'heart', 70, '/client',
   '[{"level":"info","rule":"Tono curatoriale e umano, mai gestionale"}]'::jsonb),

  ('auth', '{"it":"Autenticazione","en":"Authentication"}'::jsonb,
   '{"it":"Login, recupero password, magic link.","en":"Login, password recovery, magic link."}'::jsonb,
   'lock', 80, '/auth/login',
   '[{"level":"info","rule":"Linguaggio sobrio, ospitale, non frettoloso"}]'::jsonb);

-- Seed initial canonical phrases (a representative subset — the CMS
-- can edit them, and migrations C will move more keys here over time).
INSERT INTO editorial_phrases
  (surface_id, phrase_key, scope, position, eyebrow, title, body, cta, meta)
SELECT s.id, p.phrase_key, p.scope, p.position, p.eyebrow, p.title, p.body, p.cta, p.meta
FROM editorial_surfaces s
JOIN (VALUES
  -- public.home
  ('public.home', 'welcome_strip', 'block', 10,
    NULL,
    NULL::jsonb,
    '{"it":"Benvenuti nel nostro studio. Disegniamo relazioni, non solo spazi.","en":"Welcome to our studio. We design relationships, not just spaces."}'::jsonb,
    NULL::jsonb,
    '{"location":"Top welcome strip"}'::jsonb),
  ('public.home', 'header_cta', 'cta', 20,
    NULL,
    NULL::jsonb,
    NULL::jsonb,
    '{"it":"Inizia il tuo viaggio","en":"Begin your journey"}'::jsonb,
    '{"location":"Header CTA pill"}'::jsonb),
  ('public.home', 'hero', 'block', 30,
    '{"it":"MOOD for DESIGN™","en":"MOOD for DESIGN™"}'::jsonb,
    '{"it":"Il tuo spazio. Il tuo viaggio.","en":"Your space. Your journey."}'::jsonb,
    '{"it":"Inizia un\u2019esperienza di design personale con studi italiani di alta gamma.","en":"Begin a personal design experience with high-end Italian studios."}'::jsonb,
    '{"it":"Inizia il tuo viaggio","en":"Begin your journey"}'::jsonb,
    '{"location":"Hero section above-the-fold"}'::jsonb),
  ('public.home', 'trust', 'block', 40,
    '{"it":"Materiali selezionati & design partner","en":"Selected materials & design partners"}'::jsonb,
    NULL::jsonb,
    NULL::jsonb,
    NULL::jsonb,
    '{"location":"Trust strip marquee"}'::jsonb),

  -- public.begin_journey
  ('public.begin_journey', 'brand_mark', 'block', 10,
    '{"it":"Design Journey™","en":"Design Journey™"}'::jsonb,
    '{"it":"MOOD","en":"MOOD"}'::jsonb,
    NULL::jsonb, NULL::jsonb,
    '{"location":"Left rail brand mark"}'::jsonb),
  ('public.begin_journey', 'step1_atmosphere', 'block', 20,
    '{"it":"Primo passo · Atmosfera","en":"First step · Atmosphere"}'::jsonb,
    '{"it":"Quale atmosfera stai cercando?","en":"What atmosphere are you looking for?"}'::jsonb,
    '{"it":"Inizia a raccontarci lo spazio che immagini. Senza fretta — sono le impressioni, non le specifiche tecniche, a guidarci.","en":"Begin telling us about the space you imagine. No rush — impressions guide us, not technical specs."}'::jsonb,
    NULL::jsonb,
    '{"location":"Step 1 — Atmosphere prompt"}'::jsonb),

  -- studio.dashboard
  ('studio.dashboard', 'hero_summary', 'block', 10,
    NULL,
    NULL::jsonb,
    '{"it":"{active} Design Journey™ in respiro · {voices} voci ricevute oggi","en":"{active} Design Journey™ alive · {voices} voices received today"}'::jsonb,
    NULL::jsonb,
    '{"location":"Hero summary line · templated"}'::jsonb),
  ('studio.dashboard', 'kpi_active_journeys', 'meta', 20,
    NULL,
    '{"it":"Design Journey™ attivi","en":"Active Design Journeys™"}'::jsonb,
    NULL::jsonb, NULL::jsonb,
    '{"location":"KPI tile label"}'::jsonb),

  -- studio.guided_tour
  ('studio.guided_tour', 'welcome', 'block', 10,
    '{"it":"BLUEPRINT OS™ · PRIMA APERTURA","en":"BLUEPRINT OS™ · FIRST OPENING"}'::jsonb,
    '{"it":"Benvenuto nel tuo studio digitale.","en":"Welcome to your digital studio."}'::jsonb,
    '{"it":"Blueprint OS™ è lo spazio dove il tuo studio respira. Non un software da imparare — uno spazio da abitare.","en":"Blueprint OS™ is the space where your studio breathes. Not software to learn — a space to inhabit."}'::jsonb,
    '{"it":"Inizia il tour","en":"Begin the tour"}'::jsonb,
    '{"location":"Welcome screen"}'::jsonb),

  -- studio.first_moves
  ('studio.first_moves', 'section_title', 'block', 10,
    '{"it":"LE PRIME MOSSE · INIZIA DA QUI","en":"FIRST MOVES · START HERE"}'::jsonb,
    '{"it":"Il tuo studio inizia con cinque mosse.","en":"Your studio begins with five moves."}'::jsonb,
    '{"it":"Nessuna fretta. Ogni gesto è una direzione progettuale, non un task da spuntare.","en":"No rush. Each gesture is a project direction, not a task to check off."}'::jsonb,
    NULL::jsonb,
    '{"location":"Section header above the 5 cards"}'::jsonb),
  ('studio.first_moves', 'card_create_lead', 'block', 20,
    '{"it":"PRIMA MOSSA","en":"FIRST MOVE"}'::jsonb,
    '{"it":"Accogli la prima relazione","en":"Welcome the first relationship"}'::jsonb,
    '{"it":"Un nome, un\u2019atmosfera, un\u2019intenzione. È così che lo studio comincia a esistere.","en":"A name, an atmosphere, an intention. That''s how the studio begins to exist."}'::jsonb,
    '{"it":"Crea il primo contatto","en":"Create the first contact"}'::jsonb,
    '{"location":"Card 1 · Lead"}'::jsonb),

  -- client.portal
  ('client.portal', 'human_card_empty', 'block', 10,
    '{"it":"In ascolto","en":"Listening"}'::jsonb,
    '{"it":"Lo studio sta scegliendo il tuo referente","en":"The studio is choosing your referent"}'::jsonb,
    '{"it":"Tra poco saprai chi accompagnerà personalmente il tuo Design Journey™.","en":"You''ll soon know who will personally accompany your Design Journey™."}'::jsonb,
    NULL::jsonb,
    '{"location":"Client human card · pre-assignment"}'::jsonb),

  -- auth
  ('auth', 'login_title', 'block', 10,
    '{"it":"BLUEPRINT OS™","en":"BLUEPRINT OS™"}'::jsonb,
    '{"it":"Entra nel tuo studio","en":"Enter your studio"}'::jsonb,
    NULL::jsonb,
    '{"it":"Accedi","en":"Sign in"}'::jsonb,
    '{"location":"Login page"}'::jsonb)
) p (surface_code, phrase_key, scope, position, eyebrow, title, body, cta, meta)
ON s.code = p.surface_code;
