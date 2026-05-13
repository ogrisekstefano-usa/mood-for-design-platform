-- ===== 007: TEMPLATES SEED (7 starter, global, structure-only) =====
-- Purpose: seed 7 luxury starter templates as "platform" (tenant_id NULL)
-- so every tenant sees them in the quick-start picker.
-- Content is intentionally structural only — NO hardcoded copy, NO image URLs,
-- so tenants fill them with their own brand assets via image upload.
--
-- Each template defines a deterministic canvas composition (positions, sizes,
-- block types). The frontend renders these as preview cards via the same
-- BlockRegistry used in the editor.
-- Reversible: yes (DELETE WHERE created_by IS NULL AND tenant_id IS NULL).
-- Author: agent / 2026-05-13

BEGIN;

-- Helper: generate a deterministic UUID per template slug for re-runnable seed
DO $$
DECLARE
    t_id UUID;
BEGIN

  -- ── 1. luxury_editorial ────────────────────────────────────────────────
  t_id := '11111111-0000-0000-0000-000000000001';
  INSERT INTO public.moodboard_templates
    (id, tenant_id, slug, name, description, category, tags, visibility, is_starter, sort_order, settings, locale_content)
  VALUES
    (t_id, NULL, 'luxury-editorial', 'Luxury Editorial',
     'Magazine-style hero with a refined typographic statement.',
     'luxury_editorial', ARRAY['editorial','minimal','typographic'],
     'platform', TRUE, 10,
     '{"canvas":{"width":1400,"height":2400}}'::jsonb,
     '{"it":{"name":"Editoriale di Lusso","description":"Layout magazine con dichiarazione tipografica raffinata."},"en-US":{"name":"Luxury Editorial","description":"Magazine-style hero with a refined typographic statement."},"fr":{"name":"Éditorial de luxe"},"de":{"name":"Luxus Editorial"},"es":{"name":"Editorial de lujo"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, category = EXCLUDED.category, tags = EXCLUDED.tags,
    visibility = EXCLUDED.visibility, is_starter = EXCLUDED.is_starter,
    sort_order = EXCLUDED.sort_order, locale_content = EXCLUDED.locale_content,
    updated_at = now();

  DELETE FROM public.template_blocks WHERE template_id = t_id;
  INSERT INTO public.template_blocks (template_id, type, position_json, content, sort_order) VALUES
    (t_id, 'text',    '{"x":60,"y":60,"width":640,"height":120,"z_index":1}'::jsonb,    '{"size":"eyebrow"}'::jsonb, 0),
    (t_id, 'text',    '{"x":60,"y":200,"width":900,"height":280,"z_index":1}'::jsonb,   '{"size":"display"}'::jsonb, 1),
    (t_id, 'image',   '{"x":60,"y":520,"width":900,"height":560,"z_index":0}'::jsonb,   '{}'::jsonb, 2),
    (t_id, 'palette', '{"x":1000,"y":520,"width":340,"height":280,"z_index":1}'::jsonb,'{"colors":["#1A1814","#6B6863","#D4AF37","#EFEBE4"]}'::jsonb, 3),
    (t_id, 'text',    '{"x":1000,"y":820,"width":340,"height":260,"z_index":1}'::jsonb,'{"size":"body"}'::jsonb, 4);


  -- ── 2. hospitality ─────────────────────────────────────────────────────
  t_id := '11111111-0000-0000-0000-000000000002';
  INSERT INTO public.moodboard_templates
    (id, tenant_id, slug, name, description, category, tags, visibility, is_starter, sort_order, settings, locale_content)
  VALUES
    (t_id, NULL, 'hospitality', 'Hospitality',
     'Atmospheric layout for hotels, restaurants and wellness venues.',
     'hospitality', ARRAY['atmospheric','warm','sequential'],
     'platform', TRUE, 20,
     '{"canvas":{"width":1400,"height":2400}}'::jsonb,
     '{"it":{"name":"Ospitalità","description":"Layout atmosferico per hotel, ristoranti e spazi wellness."},"en-US":{"name":"Hospitality"},"fr":{"name":"Hôtellerie"},"de":{"name":"Hospitality"},"es":{"name":"Hostelería"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET locale_content = EXCLUDED.locale_content, updated_at = now();
  DELETE FROM public.template_blocks WHERE template_id = t_id;
  INSERT INTO public.template_blocks (template_id, type, position_json, content, sort_order) VALUES
    (t_id, 'image', '{"x":40,"y":40,"width":640,"height":480,"z_index":0}'::jsonb, '{}'::jsonb, 0),
    (t_id, 'image', '{"x":720,"y":40,"width":640,"height":230,"z_index":0}'::jsonb,'{}'::jsonb, 1),
    (t_id, 'image', '{"x":720,"y":290,"width":640,"height":230,"z_index":0}'::jsonb,'{}'::jsonb, 2),
    (t_id, 'text',  '{"x":40,"y":560,"width":900,"height":140,"z_index":1}'::jsonb,'{"size":"h1"}'::jsonb, 3),
    (t_id, 'material','{"x":40,"y":720,"width":260,"height":280,"z_index":1}'::jsonb,'{}'::jsonb, 4),
    (t_id, 'material','{"x":320,"y":720,"width":260,"height":280,"z_index":1}'::jsonb,'{}'::jsonb, 5),
    (t_id, 'palette', '{"x":600,"y":720,"width":340,"height":280,"z_index":1}'::jsonb,'{"colors":["#2C1810","#8B6E4E","#D6C5A8","#F5EFE4"]}'::jsonb, 6);


  -- ── 3. residential ─────────────────────────────────────────────────────
  t_id := '11111111-0000-0000-0000-000000000003';
  INSERT INTO public.moodboard_templates
    (id, tenant_id, slug, name, description, category, tags, visibility, is_starter, sort_order, settings, locale_content)
  VALUES
    (t_id, NULL, 'residential', 'Residential',
     'Room-by-room presentation for private clients.',
     'residential', ARRAY['private','warm','room-based'],
     'platform', TRUE, 30,
     '{}'::jsonb,
     '{"it":{"name":"Residenziale","description":"Presentazione stanza per stanza per cliente privato."},"en-US":{"name":"Residential"},"fr":{"name":"Résidentiel"},"de":{"name":"Wohnen"},"es":{"name":"Residencial"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET locale_content = EXCLUDED.locale_content, updated_at = now();
  DELETE FROM public.template_blocks WHERE template_id = t_id;
  INSERT INTO public.template_blocks (template_id, type, position_json, content, sort_order) VALUES
    (t_id, 'text',   '{"x":40,"y":40,"width":600,"height":80,"z_index":1}'::jsonb, '{"size":"h2"}'::jsonb, 0),
    (t_id, 'image',  '{"x":40,"y":140,"width":900,"height":520,"z_index":0}'::jsonb,'{}'::jsonb, 1),
    (t_id, 'product','{"x":980,"y":140,"width":260,"height":340,"z_index":1}'::jsonb,'{}'::jsonb, 2),
    (t_id, 'product','{"x":980,"y":500,"width":260,"height":160,"z_index":1}'::jsonb,'{}'::jsonb, 3),
    (t_id, 'note',   '{"x":40,"y":700,"width":400,"height":160,"z_index":1}'::jsonb,'{"text":""}'::jsonb, 4),
    (t_id, 'palette','{"x":460,"y":700,"width":300,"height":160,"z_index":1}'::jsonb,'{"colors":["#F5F1EB","#C8B89F","#5C4A3B","#1F1A16"]}'::jsonb, 5);


  -- ── 4. retail ──────────────────────────────────────────────────────────
  t_id := '11111111-0000-0000-0000-000000000004';
  INSERT INTO public.moodboard_templates
    (id, tenant_id, slug, name, description, category, tags, visibility, is_starter, sort_order, settings, locale_content)
  VALUES
    (t_id, NULL, 'retail', 'Retail',
     'Storefront, fixtures, and visual merchandising direction.',
     'retail', ARRAY['retail','brand','merchandising'],
     'platform', TRUE, 40,
     '{}'::jsonb,
     '{"it":{"name":"Retail","description":"Storefront, arredi e visual merchandising."},"en-US":{"name":"Retail"},"fr":{"name":"Retail"},"de":{"name":"Einzelhandel"},"es":{"name":"Retail"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET locale_content = EXCLUDED.locale_content, updated_at = now();
  DELETE FROM public.template_blocks WHERE template_id = t_id;
  INSERT INTO public.template_blocks (template_id, type, position_json, content, sort_order) VALUES
    (t_id, 'image',   '{"x":40,"y":40,"width":1320,"height":520,"z_index":0}'::jsonb,'{}'::jsonb, 0),
    (t_id, 'image',   '{"x":40,"y":580,"width":420,"height":340,"z_index":0}'::jsonb,'{}'::jsonb, 1),
    (t_id, 'image',   '{"x":480,"y":580,"width":420,"height":340,"z_index":0}'::jsonb,'{}'::jsonb, 2),
    (t_id, 'image',   '{"x":920,"y":580,"width":420,"height":340,"z_index":0}'::jsonb,'{}'::jsonb, 3),
    (t_id, 'material','{"x":40,"y":940,"width":300,"height":220,"z_index":1}'::jsonb,'{}'::jsonb, 4),
    (t_id, 'product', '{"x":360,"y":940,"width":300,"height":220,"z_index":1}'::jsonb,'{}'::jsonb, 5);


  -- ── 5. materials_board ─────────────────────────────────────────────────
  t_id := '11111111-0000-0000-0000-000000000005';
  INSERT INTO public.moodboard_templates
    (id, tenant_id, slug, name, description, category, tags, visibility, is_starter, sort_order, settings, locale_content)
  VALUES
    (t_id, NULL, 'materials-board', 'Materials Board',
     'Tactile sample grid for specification and procurement.',
     'materials_board', ARRAY['materials','samples','specification'],
     'platform', TRUE, 50,
     '{}'::jsonb,
     '{"it":{"name":"Materiali","description":"Griglia di campioni per specifiche e approvvigionamento."},"en-US":{"name":"Materials Board"},"fr":{"name":"Tableau Matériaux"},"de":{"name":"Materialtafel"},"es":{"name":"Materiales"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET locale_content = EXCLUDED.locale_content, updated_at = now();
  DELETE FROM public.template_blocks WHERE template_id = t_id;
  INSERT INTO public.template_blocks (template_id, type, position_json, content, sort_order) VALUES
    (t_id, 'text',    '{"x":40,"y":40,"width":600,"height":80,"z_index":1}'::jsonb,'{"size":"h2"}'::jsonb, 0),
    (t_id, 'material','{"x":40,"y":140,"width":300,"height":340,"z_index":1}'::jsonb,'{}'::jsonb, 1),
    (t_id, 'material','{"x":360,"y":140,"width":300,"height":340,"z_index":1}'::jsonb,'{}'::jsonb, 2),
    (t_id, 'material','{"x":680,"y":140,"width":300,"height":340,"z_index":1}'::jsonb,'{}'::jsonb, 3),
    (t_id, 'material','{"x":1000,"y":140,"width":300,"height":340,"z_index":1}'::jsonb,'{}'::jsonb, 4),
    (t_id, 'material','{"x":40,"y":500,"width":300,"height":340,"z_index":1}'::jsonb,'{}'::jsonb, 5),
    (t_id, 'material','{"x":360,"y":500,"width":300,"height":340,"z_index":1}'::jsonb,'{}'::jsonb, 6),
    (t_id, 'palette', '{"x":680,"y":500,"width":620,"height":340,"z_index":1}'::jsonb,'{"colors":["#3C2E20","#7A6249","#B8A082","#D9CCB4","#EAE0C9"]}'::jsonb, 7);


  -- ── 6. ff_e (Furniture, Fixtures & Equipment) ──────────────────────────
  t_id := '11111111-0000-0000-0000-000000000006';
  INSERT INTO public.moodboard_templates
    (id, tenant_id, slug, name, description, category, tags, visibility, is_starter, sort_order, settings, locale_content)
  VALUES
    (t_id, NULL, 'ff-and-e', 'FF&E',
     'Furniture, fixtures and equipment schedule.',
     'ff_e', ARRAY['ffe','procurement','schedule'],
     'platform', TRUE, 60,
     '{}'::jsonb,
     '{"it":{"name":"FF&E","description":"Pianificazione arredi, illuminazione e attrezzature."},"en-US":{"name":"FF&E"},"fr":{"name":"Mobilier FF&E"},"de":{"name":"FF&E"},"es":{"name":"FF&E"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET locale_content = EXCLUDED.locale_content, updated_at = now();
  DELETE FROM public.template_blocks WHERE template_id = t_id;
  INSERT INTO public.template_blocks (template_id, type, position_json, content, sort_order) VALUES
    (t_id, 'text',   '{"x":40,"y":40,"width":600,"height":80,"z_index":1}'::jsonb,'{"size":"h2"}'::jsonb, 0),
    (t_id, 'product','{"x":40,"y":140,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 1),
    (t_id, 'product','{"x":360,"y":140,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 2),
    (t_id, 'product','{"x":680,"y":140,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 3),
    (t_id, 'product','{"x":1000,"y":140,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 4),
    (t_id, 'product','{"x":40,"y":540,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 5),
    (t_id, 'product','{"x":360,"y":540,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 6),
    (t_id, 'product','{"x":680,"y":540,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 7),
    (t_id, 'product','{"x":1000,"y":540,"width":300,"height":380,"z_index":1}'::jsonb,'{}'::jsonb, 8);


  -- ── 7. concept ─────────────────────────────────────────────────────────
  t_id := '11111111-0000-0000-0000-000000000007';
  INSERT INTO public.moodboard_templates
    (id, tenant_id, slug, name, description, category, tags, visibility, is_starter, sort_order, settings, locale_content)
  VALUES
    (t_id, NULL, 'concept', 'Concept',
     'Architectural concept narrative — story-driven layout.',
     'concept', ARRAY['concept','narrative','architectural'],
     'platform', TRUE, 70,
     '{}'::jsonb,
     '{"it":{"name":"Concept","description":"Narrazione architettonica — layout orientato alla storia."},"en-US":{"name":"Concept"},"fr":{"name":"Concept"},"de":{"name":"Konzept"},"es":{"name":"Concepto"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET locale_content = EXCLUDED.locale_content, updated_at = now();
  DELETE FROM public.template_blocks WHERE template_id = t_id;
  INSERT INTO public.template_blocks (template_id, type, position_json, content, sort_order) VALUES
    (t_id, 'text',  '{"x":60,"y":60,"width":700,"height":120,"z_index":1}'::jsonb,   '{"size":"eyebrow"}'::jsonb, 0),
    (t_id, 'text',  '{"x":60,"y":200,"width":900,"height":260,"z_index":1}'::jsonb,  '{"size":"h1"}'::jsonb, 1),
    (t_id, 'image', '{"x":60,"y":500,"width":1280,"height":620,"z_index":0}'::jsonb, '{}'::jsonb, 2),
    (t_id, 'text',  '{"x":60,"y":1160,"width":620,"height":240,"z_index":1}'::jsonb, '{"size":"body"}'::jsonb, 3),
    (t_id, 'note',  '{"x":720,"y":1160,"width":300,"height":240,"z_index":1}'::jsonb,'{}'::jsonb, 4),
    (t_id, 'palette','{"x":1060,"y":1160,"width":280,"height":240,"z_index":1}'::jsonb,'{"colors":["#0E0E10","#2A2A2D","#7A7771","#D4AF37"]}'::jsonb, 5);

END $$;

COMMIT;
