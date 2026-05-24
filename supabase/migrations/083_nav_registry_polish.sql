-- ────────────────────────────────────────────────────────────────────
-- 083_nav_registry_polish.sql · 25 Feb 2026
--
-- User-driven sidebar polish:
--   • Rename "Workspace" → "Settings" (tenant settings hub label)
--   • Remove integrations, billing, forms_journeys, language_cc from
--     tenant sidebar — they remain accessible via /admin (Command
--     Center) or /settings (hub UI) but stop polluting the nav rail.
--
-- All changes are additive in spirit (nav_route nullified, modules
-- stay enabled, routes still resolve). Idempotent.
-- ────────────────────────────────────────────────────────────────────

-- Workspace → Settings (the entry shown in the sidebar)
UPDATE feature_modules_registry
   SET display_name = 'Settings'
 WHERE code = 'settings_workspace';

-- Remove from tenant sidebar (still accessible via /settings hub)
UPDATE feature_modules_registry
   SET nav_group = NULL,
       nav_route = NULL,
       nav_section_label = NULL
 WHERE code IN ('integrations', 'billing');

-- Remove from tenant sidebar — these live under Command Center now
UPDATE feature_modules_registry
   SET nav_group = NULL,
       nav_route = NULL,
       nav_section_label = NULL
 WHERE code IN ('forms_journeys', 'language_cc');

-- Bust tenant_config cache (force /api/tenant/configuration to recompute)
-- (no DB action needed; cache TTL is short — invalidated by the agent
-- via a touch-update on the modules table.)
UPDATE feature_modules_registry SET updated_at = NOW() WHERE TRUE;
