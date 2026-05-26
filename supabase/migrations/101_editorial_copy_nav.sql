-- ============================================================
-- 101 · ITER155 · Mount Editorial Copy CMS in the Blueprint nav
-- ============================================================

-- Register the module in feature_modules_registry so the sidebar
-- picks it up automatically (DB-driven nav).
INSERT INTO feature_modules_registry
  (code, display_name, category, description, default_state, required_role,
   position, is_core, nav_route, nav_icon, nav_group, nav_section_label,
   nav_visibility, nav_end_match, nav_has_mark, nav_test_id)
VALUES (
  'editorial_copy_cms',
  'Editorial Copy',
  'governance',
  'Surface Governance System™ · governa la voce di Blueprint OS™ per superficie editoriale.',
  'enabled', 'tenant_admin',
  20, FALSE,
  '/admin/editorial-copy', 'BookText',
  'platform', 'Governance',
  'tenant_admin', TRUE, FALSE,
  'sidebar-nav-editorial-copy'
)
ON CONFLICT (code) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  description       = EXCLUDED.description,
  nav_route         = EXCLUDED.nav_route,
  nav_icon          = EXCLUDED.nav_icon,
  nav_group         = EXCLUDED.nav_group,
  nav_section_label = EXCLUDED.nav_section_label,
  nav_visibility    = EXCLUDED.nav_visibility,
  nav_test_id       = EXCLUDED.nav_test_id,
  updated_at        = NOW();
