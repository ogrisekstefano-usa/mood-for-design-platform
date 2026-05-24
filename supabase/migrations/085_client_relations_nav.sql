-- ────────────────────────────────────────────────────────────────────
-- 085_client_relations_nav.sql · ITER148 · P0 sidebar
--
-- Registers CLIENT RELATIONS™ as a sidebar group with editorial entries:
--   Leads · Prospects · Accounts · Relationship Memory · Voice Log
--
-- The legacy "relationships" group is replaced by a richer, more granular
-- structure that surfaces the Lead → Prospect → Account distinction in
-- the Blueprint sidebar.
-- ────────────────────────────────────────────────────────────────────

-- 1 · Ensure feature_modules_registry rows exist for each entry.
INSERT INTO feature_modules_registry
  (code, display_name, nav_group, nav_route, nav_section_label, nav_icon,
   nav_visibility, position, group_position, is_core_critical, is_core, category)
VALUES
  ('client_relations_leads',     'Leads',
     'client-relations', '/relations/leads',     'Client Relations\u2122', 'Sparkles',
     'tenant', 10, 25, FALSE, FALSE, 'relations'),
  ('client_relations_prospects', 'Prospects',
     'client-relations', '/relations/prospects', 'Client Relations\u2122', 'Compass',
     'tenant', 20, 25, FALSE, FALSE, 'relations'),
  ('client_relations_accounts',  'Accounts',
     'client-relations', '/relations/accounts',  'Client Relations\u2122', 'Users',
     'tenant', 30, 25, FALSE, FALSE, 'relations'),
  ('client_relations_memory',    'Relationship Memory',
     'client-relations', '/relations/memory',    'Client Relations\u2122', 'BookOpen',
     'tenant', 40, 25, FALSE, FALSE, 'relations'),
  ('client_relations_voice_log', 'Voice Log',
     'client-relations', '/relations/voice-log', 'Client Relations\u2122', 'Mic',
     'tenant', 50, 25, FALSE, FALSE, 'relations')
ON CONFLICT (code) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  nav_group         = EXCLUDED.nav_group,
  nav_route         = EXCLUDED.nav_route,
  nav_section_label = EXCLUDED.nav_section_label,
  nav_icon          = EXCLUDED.nav_icon,
  nav_visibility    = EXCLUDED.nav_visibility,
  position          = EXCLUDED.position,
  group_position    = EXCLUDED.group_position,
  updated_at        = NOW();

-- 2 · Demote the legacy 'relationships' module group (CRM hub) — leave
--     visible but reposition under the new group so we don't break links.
UPDATE feature_modules_registry
   SET nav_group = NULL, nav_route = NULL, nav_section_label = NULL
 WHERE code IN ('relationships', 'crm_inbox');
