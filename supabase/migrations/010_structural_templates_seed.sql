-- 010_structural_templates_seed.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase F.1 — Seed of 3 structural multi-page templates.
--
-- Editorial pacing, no hardcoded content — only placeholders.
-- All structures are 'is_starter=TRUE' + tenant_id NULL = platform-global.
-- Cleanup: removes any prior rows with the same fixed UUIDs before re-inserting
-- so re-running the migration is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
DECLARE
  -- Fixed UUIDs for stable seed (idempotent re-runs).
  tpl_lux    uuid := '22222222-0000-0000-0000-000000000001';
  tpl_hos    uuid := '22222222-0000-0000-0000-000000000002';
  tpl_mat    uuid := '22222222-0000-0000-0000-000000000003';
  pg         uuid;
BEGIN

-- Wipe + reinsert each structural template (CASCADE pulls pages + blocks)
DELETE FROM moodboard_templates WHERE id IN (tpl_lux, tpl_hos, tpl_mat);

-- ─────────────────────────────────────────────────────────────────────────
-- TEMPLATE 1 — LUXURY RESIDENTIAL PRESENTATION (8 pages)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO moodboard_templates
  (id, tenant_id, slug, name, description, category, tags, visibility,
   is_starter, settings, sort_order, locale_content, published_at)
VALUES (
  tpl_lux, NULL, 'structural-luxury-residential',
  'Luxury Residential Presentation',
  'Cinematic 8-page presentation for high-end residential projects.',
  'luxury_editorial',
  ARRAY['structural', 'multipage', 'residential', 'luxury'],
  'platform', true, '{}'::jsonb, 100,
  '{
    "it": {"name": "Presentazione Residenziale di Lusso",
           "description": "Presentazione cinematografica in 8 pagine per progetti residenziali high-end."},
    "fr": {"name": "Présentation Résidentielle de Luxe"},
    "de": {"name": "Luxus-Wohnprojekt Präsentation"},
    "es": {"name": "Presentación Residencial de Lujo"}
  }'::jsonb, now());

-- Page 1 — Cover
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Cover', 'cover', 'cover_landscape', 1920, 1200, 0)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'image', '{"src":"","caption":""}'::jsonb,
 '{"x":0,"y":0,"width":1920,"height":1200,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center","adjustments":{"brightness":0.92}}'::jsonb,
 true, 'Hero cover image', 'image', true, 0),
(tpl_lux, pg, 'text', '{"text":"","size":"display","align":"left"}'::jsonb,
 '{"x":120,"y":820,"width":1100,"height":120,"z_index":2}'::jsonb,
 '{"color":"#FFFFFF"}'::jsonb,
 true, 'Project name', 'text', true, 1),
(tpl_lux, pg, 'text', '{"text":"","size":"eyebrow","align":"left"}'::jsonb,
 '{"x":120,"y":960,"width":600,"height":40,"z_index":3}'::jsonb,
 '{"color":"#D4AF37"}'::jsonb,
 true, 'Client / Location', 'text', false, 2);

-- Page 2 — Concept Statement
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Concept Statement', 'quote', 'editorial_3_4', 1400, 1866, 1)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'text', '{"text":"","size":"eyebrow","align":"center"}'::jsonb,
 '{"x":200,"y":160,"width":1000,"height":40,"z_index":1}'::jsonb,
 '{}'::jsonb,
 true, 'Section label', 'text', false, 0),
(tpl_lux, pg, 'text', '{"text":"","size":"h2","align":"center"}'::jsonb,
 '{"x":160,"y":700,"width":1080,"height":420,"z_index":2}'::jsonb,
 '{}'::jsonb,
 true, 'Concept statement', 'text', true, 1);

-- Page 3 — Atmosphere / Mood
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Atmosphere', 'mood', 'editorial_3_4', 1400, 1866, 2)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'image', '{"src":""}'::jsonb,
 '{"x":80,"y":80,"width":720,"height":960,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Mood image 1', 'image', true, 0),
(tpl_lux, pg, 'image', '{"src":""}'::jsonb,
 '{"x":840,"y":80,"width":480,"height":460,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Mood image 2', 'image', false, 1),
(tpl_lux, pg, 'image', '{"src":""}'::jsonb,
 '{"x":840,"y":580,"width":480,"height":460,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Mood image 3', 'image', false, 2),
(tpl_lux, pg, 'text', '{"text":"","size":"body","align":"left"}'::jsonb,
 '{"x":80,"y":1100,"width":1240,"height":300,"z_index":1}'::jsonb,
 '{}'::jsonb,
 true, 'Atmosphere notes', 'text', false, 3);

-- Page 4 — Material Palette
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Material Palette', 'palette', 'editorial_3_4', 1400, 1866, 3)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'text', '{"text":"Material Palette","size":"eyebrow"}'::jsonb,
 '{"x":80,"y":80,"width":600,"height":40,"z_index":1}'::jsonb, '{}'::jsonb,
 false, NULL, NULL, false, 0),
(tpl_lux, pg, 'palette', '{"colors":["#1A1814","#D4AF37","#A19D98","#EFEBE4","#3A3835"]}'::jsonb,
 '{"x":80,"y":160,"width":1240,"height":160,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Color palette', 'palette', true, 1),
(tpl_lux, pg, 'material', '{"name":"","texture":""}'::jsonb,
 '{"x":80,"y":380,"width":390,"height":520,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Material 1 (e.g. marble)', 'material', true, 2),
(tpl_lux, pg, 'material', '{"name":"","texture":""}'::jsonb,
 '{"x":505,"y":380,"width":390,"height":520,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Material 2 (e.g. wood)', 'material', false, 3),
(tpl_lux, pg, 'material', '{"name":"","texture":""}'::jsonb,
 '{"x":930,"y":380,"width":390,"height":520,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Material 3 (e.g. textile)', 'material', false, 4);

-- Page 5 — Furniture Selection
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Furniture Selection', 'product_grid', 'editorial_3_4', 1400, 1866, 4)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'text', '{"text":"Furniture","size":"eyebrow"}'::jsonb,
 '{"x":80,"y":80,"width":600,"height":40,"z_index":1}'::jsonb, '{}'::jsonb,
 false, NULL, NULL, false, 0),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":80,"y":160,"width":390,"height":460,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Sofa', 'product', true, 1),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":505,"y":160,"width":390,"height":460,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Coffee table', 'product', false, 2),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":930,"y":160,"width":390,"height":460,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Armchair', 'product', false, 3),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":80,"y":680,"width":390,"height":460,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Dining table', 'product', false, 4),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":505,"y":680,"width":390,"height":460,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Sideboard', 'product', false, 5),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":930,"y":680,"width":390,"height":460,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Accent piece', 'product', false, 6);

-- Page 6 — Lighting
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Lighting', 'product_grid', 'editorial_3_4', 1400, 1866, 5)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'text', '{"text":"Lighting","size":"eyebrow"}'::jsonb,
 '{"x":80,"y":80,"width":600,"height":40,"z_index":1}'::jsonb, '{}'::jsonb,
 false, NULL, NULL, false, 0),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":80,"y":160,"width":600,"height":860,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Hero fixture', 'product', true, 1),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":720,"y":160,"width":600,"height":420,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Pendant', 'product', false, 2),
(tpl_lux, pg, 'product', '{"product_name":"","brand_name":""}'::jsonb,
 '{"x":720,"y":600,"width":600,"height":420,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Floor / Table lamp', 'product', false, 3);

-- Page 7 — Room Gallery
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Room Gallery', 'gallery', 'editorial_3_4', 1400, 1866, 6)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'image', '{"src":"","caption":""}'::jsonb,
 '{"x":80,"y":80,"width":1240,"height":760,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Hero room', 'image', true, 0),
(tpl_lux, pg, 'image', '{"src":"","caption":""}'::jsonb,
 '{"x":80,"y":880,"width":600,"height":520,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Room detail 1', 'image', false, 1),
(tpl_lux, pg, 'image', '{"src":"","caption":""}'::jsonb,
 '{"x":720,"y":880,"width":600,"height":520,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Room detail 2', 'image', false, 2);

-- Page 8 — Approval
INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_lux, 'Approval', 'approval', 'editorial_3_4', 1400, 1866, 7)
RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_lux, pg, 'text', '{"text":"Approval","size":"eyebrow","align":"center"}'::jsonb,
 '{"x":200,"y":200,"width":1000,"height":40,"z_index":1}'::jsonb, '{}'::jsonb,
 false, NULL, NULL, false, 0),
(tpl_lux, pg, 'text', '{"text":"","size":"h2","align":"center"}'::jsonb,
 '{"x":160,"y":720,"width":1080,"height":300,"z_index":2}'::jsonb, '{}'::jsonb,
 true, 'Closing statement', 'text', false, 1);


-- ─────────────────────────────────────────────────────────────────────────
-- TEMPLATE 2 — HOSPITALITY CONCEPT (6 pages)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO moodboard_templates
  (id, tenant_id, slug, name, description, category, tags, visibility,
   is_starter, settings, sort_order, locale_content, published_at)
VALUES (
  tpl_hos, NULL, 'structural-hospitality-concept',
  'Hospitality Concept',
  '6-page boutique hotel & restaurant concept presentation.',
  'hospitality',
  ARRAY['structural', 'multipage', 'hospitality', 'boutique'],
  'platform', true, '{}'::jsonb, 101,
  '{
    "it": {"name": "Concept Ospitalità",
           "description": "Presentazione in 6 pagine per hotel boutique e ristoranti."}
  }'::jsonb, now());

INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_hos, 'Cover', 'cover', 'cover_landscape', 1920, 1200, 0) RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_hos, pg, 'image', '{"src":""}'::jsonb,
 '{"x":0,"y":0,"width":1920,"height":1200,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center","adjustments":{"brightness":0.88}}'::jsonb,
 true, 'Brand hero image', 'image', true, 0),
(tpl_hos, pg, 'text', '{"text":"","size":"display","align":"center"}'::jsonb,
 '{"x":160,"y":900,"width":1600,"height":120,"z_index":2}'::jsonb,
 '{"color":"#FFFFFF"}'::jsonb,
 true, 'Brand name', 'text', true, 1);

INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_hos, 'Brand Narrative', 'quote', 'editorial_3_4', 1400, 1866, 1) RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_hos, pg, 'text', '{"text":"Brand narrative","size":"eyebrow","align":"center"}'::jsonb,
 '{"x":200,"y":160,"width":1000,"height":40,"z_index":1}'::jsonb, '{}'::jsonb,
 false, NULL, NULL, false, 0),
(tpl_hos, pg, 'text', '{"text":"","size":"h2","align":"center"}'::jsonb,
 '{"x":160,"y":700,"width":1080,"height":400,"z_index":2}'::jsonb, '{}'::jsonb,
 true, 'Brand story', 'text', true, 1);

INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_hos, 'Spatial Mood', 'mood', 'editorial_3_4', 1400, 1866, 2) RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_hos, pg, 'image', '{"src":""}'::jsonb,
 '{"x":80,"y":80,"width":1240,"height":900,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Spatial mood hero', 'image', true, 0),
(tpl_hos, pg, 'image', '{"src":""}'::jsonb,
 '{"x":80,"y":1020,"width":600,"height":420,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Detail 1', 'image', false, 1),
(tpl_hos, pg, 'image', '{"src":""}'::jsonb,
 '{"x":720,"y":1020,"width":600,"height":420,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Detail 2', 'image', false, 2);

INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_hos, 'Materials', 'palette', 'editorial_3_4', 1400, 1866, 3) RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_hos, pg, 'palette', '{"colors":["#2A2520","#8B7355","#D4C5A8","#F4EDE3"]}'::jsonb,
 '{"x":80,"y":80,"width":1240,"height":160,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Brand palette', 'palette', true, 0),
(tpl_hos, pg, 'material', '{"name":""}'::jsonb,
 '{"x":80,"y":300,"width":600,"height":600,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Primary material', 'material', true, 1),
(tpl_hos, pg, 'material', '{"name":""}'::jsonb,
 '{"x":720,"y":300,"width":600,"height":600,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Secondary material', 'material', false, 2);

INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_hos, 'Guest Experience', 'split_story', 'editorial_3_4', 1400, 1866, 4) RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_hos, pg, 'image', '{"src":""}'::jsonb,
 '{"x":0,"y":0,"width":700,"height":1866,"z_index":0}'::jsonb,
 '{"fit_mode":"cover","focal_point":"center"}'::jsonb,
 true, 'Experience image', 'image', true, 0),
(tpl_hos, pg, 'text', '{"text":"","size":"eyebrow"}'::jsonb,
 '{"x":760,"y":300,"width":520,"height":40,"z_index":1}'::jsonb, '{}'::jsonb,
 false, NULL, NULL, false, 1),
(tpl_hos, pg, 'text', '{"text":"","size":"h2"}'::jsonb,
 '{"x":760,"y":380,"width":520,"height":480,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Experience narrative', 'text', true, 2);

INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_hos, 'Approval', 'approval', 'editorial_3_4', 1400, 1866, 5) RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_hos, pg, 'text', '{"text":"Approval","size":"eyebrow","align":"center"}'::jsonb,
 '{"x":200,"y":200,"width":1000,"height":40,"z_index":1}'::jsonb, '{}'::jsonb,
 false, NULL, NULL, false, 0);


-- ─────────────────────────────────────────────────────────────────────────
-- TEMPLATE 3 — MATERIAL BOARD (1 page, FF&E workflow)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO moodboard_templates
  (id, tenant_id, slug, name, description, category, tags, visibility,
   is_starter, settings, sort_order, locale_content, published_at)
VALUES (
  tpl_mat, NULL, 'structural-material-board',
  'Material Board',
  'Single-page FF&E material board for quick operational workflow.',
  'materials_board',
  ARRAY['structural', 'single-page', 'ffe', 'materials'],
  'platform', true, '{}'::jsonb, 102,
  '{
    "it": {"name": "Material Board",
           "description": "Board singola FF&E per workflow operativo rapido."}
  }'::jsonb, now());

INSERT INTO template_pages (template_id, title, page_type, aspect_ratio, width, height, sort_order)
VALUES (tpl_mat, 'Material Board', 'material_board', 'square_1_1', 1400, 1400, 0) RETURNING id INTO pg;
INSERT INTO template_blocks (template_id, template_page_id, type, content, position_json, style_json,
                             is_placeholder, placeholder_label, placeholder_type, placeholder_required, sort_order) VALUES
(tpl_mat, pg, 'palette', '{"colors":["#1A1814","#A19D98","#D4AF37","#EFEBE4"]}'::jsonb,
 '{"x":40,"y":40,"width":1320,"height":120,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Palette', 'palette', true, 0),
(tpl_mat, pg, 'material', '{"name":""}'::jsonb,
 '{"x":40,"y":200,"width":640,"height":580,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Primary material', 'material', true, 1),
(tpl_mat, pg, 'material', '{"name":""}'::jsonb,
 '{"x":720,"y":200,"width":640,"height":280,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Secondary material', 'material', false, 2),
(tpl_mat, pg, 'material', '{"name":""}'::jsonb,
 '{"x":720,"y":500,"width":640,"height":280,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Tertiary material', 'material', false, 3),
(tpl_mat, pg, 'product', '{"product_name":""}'::jsonb,
 '{"x":40,"y":820,"width":640,"height":540,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Hero product', 'product', false, 4),
(tpl_mat, pg, 'product', '{"product_name":""}'::jsonb,
 '{"x":720,"y":820,"width":640,"height":540,"z_index":1}'::jsonb, '{}'::jsonb,
 true, 'Companion product', 'product', false, 5);

END $$;

COMMIT;
