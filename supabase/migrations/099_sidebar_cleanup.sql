-- ============================================================
-- 099 · ITER154.R · Sidebar cleanup
-- ============================================================
-- 1. Hide "Voice Log" sidebar entry — route was a redirect to a
--    placeholder. Until we build the real CRM Voice Log surface,
--    keep it out of the navigation runtime to avoid dead clicks.
-- 2. Hide the legacy generic "relationships" CRM hub (replaced by
--    the granular Leads/Prospects/Accounts/Memory entries).
-- ============================================================

UPDATE feature_modules_registry
SET nav_group = NULL, nav_route = NULL, updated_at = NOW()
WHERE code = 'client_relations_voice_log';
