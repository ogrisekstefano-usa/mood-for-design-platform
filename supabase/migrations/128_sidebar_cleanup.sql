-- ────────────────────────────────────────────────────────────────────
-- 128_sidebar_cleanup.sql · Navigation Rationalization
--
-- 1. Rimuove `begin_journey` dalla sidebar  → la creazione di Journey è
--    centralizzata nel menu CREA. Route /begin-journey resta attiva
--    (deep-link da emails, redirect, ecc.).
-- 2. Rimuove `crm_accounts` dalla sidebar   → duplicato di
--    `client_relations_accounts` (entrambi su `client-relations` group).
--    La route /crm/accounts resta funzionante per back-compat.
--
-- Setting `nav_group = NULL` esclude il modulo dal navigation tree
-- (vedi tenant_config_resolver.py:333 — items senza nav_group sono saltati).
-- ────────────────────────────────────────────────────────────────────

UPDATE feature_modules_registry
   SET nav_group = NULL, updated_at = NOW()
 WHERE code IN ('begin_journey', 'crm_accounts');
