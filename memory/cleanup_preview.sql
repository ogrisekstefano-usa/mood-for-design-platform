-- ============================================================
-- cleanup_preview.sql
-- MOOD for DESIGN™ — Database Cleanup Script
-- Versione: 1.0 — Generato 2026-06-12
-- ============================================================
-- ⚠ NON ESEGUIRE senza approvazione del report 03_DATABASE_CLEANUP_PLAN.md
-- ⚠ Eseguire in staging PRIMA di produzione
-- ⚠ Eseguire blocco per blocco, verificando count() prima e dopo
-- ⚠ auth.users (FASE 5) va eseguita SEPARATAMENTE via Supabase Dashboard
-- ============================================================

-- Costanti di riferimento
-- Blueprint tenant ID: '848354b9-a43e-4147-bdad-116fb93bd585'
-- Admin profile ID:    'caee7b92-34b4-4ecf-bdaa-8a3eda93a70e'
-- Admin auth_user_id:  '18712745-7a2c-4b5e-b2b3-02a9b2a4c1d7'

BEGIN;

-- ============================================================
-- VERIFICA PRE-CLEANUP (eseguire prima — non eliminano nulla)
-- ============================================================

SELECT 'accounts' as tabella, count(*) FROM accounts WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'leads', count(*) FROM leads WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'contacts', count(*) FROM contacts WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'design_journeys', count(*) FROM design_journeys WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'projects', count(*) FROM projects WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'relationship_threads', count(*) FROM relationship_threads WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'users_profile_clients', count(*) FROM users_profile WHERE role='client' AND tenant_id='848354b9-a43e-4147-bdad-116fb93bd585';

-- Atteso: accounts=20, leads=15, contacts=15, design_journeys=19,
--         projects=21, relationship_threads=14, users_profile_clients=9

ROLLBACK; -- Non eseguire ancora le DELETE

-- ============================================================
-- FASE 1 — BLUEPRINT: FOGLIE (nessun figlio da eliminare)
-- ============================================================

-- 1.1 relationship_messages (17 righe)
-- Dipende da: relationship_threads
DELETE FROM relationship_messages
WHERE thread_id IN (
    SELECT id FROM relationship_threads
    WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);
-- Atteso: 17 righe eliminate

-- 1.2 design_journey_assignment_events (19 righe)
-- Dipende da: design_journey_assignments
DELETE FROM design_journey_assignment_events
WHERE assignment_id IN (
    SELECT id FROM design_journey_assignments
    WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);
-- Atteso: 19 righe eliminate

-- 1.3 human_assignment_events (10 righe)
-- Dipende da: human_assignments
DELETE FROM human_assignment_events
WHERE assignment_id IN (
    SELECT id FROM human_assignments
    WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);
-- Atteso: 10 righe eliminate

-- 1.4 milestone_versions (14 righe)
-- Dipende da: journey_milestones
DELETE FROM milestone_versions
WHERE milestone_id IN (
    SELECT id FROM journey_milestones
    WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);
-- Atteso: 14 righe eliminate

-- 1.5 funnel_events (32 righe)
-- Dipende da: leads, projects
DELETE FROM funnel_events
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 32 righe eliminate

-- 1.6 relationship_notifications (67 righe)
DELETE FROM relationship_notifications
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 67 righe eliminate

-- 1.7 moodboard_elements (90 righe)
-- Dipende da: moodboards
DELETE FROM moodboard_elements
WHERE moodboard_id IN (
    SELECT m.id FROM moodboards m
    JOIN projects p ON p.id = m.project_id
    WHERE p.tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);
-- Atteso: 90 righe eliminate

-- 1.8 moodboard_pages (7 righe)
DELETE FROM moodboard_pages
WHERE moodboard_id IN (
    SELECT m.id FROM moodboards m
    JOIN projects p ON p.id = m.project_id
    WHERE p.tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);
-- Atteso: 7 righe eliminate

-- 1.9 moodboard_shares, moodboard_versions, moodboard_comments (eventuali righe)
DELETE FROM moodboard_shares
WHERE moodboard_id IN (
    SELECT m.id FROM moodboards m
    JOIN projects p ON p.id = m.project_id
    WHERE p.tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);

DELETE FROM moodboard_versions
WHERE moodboard_id IN (
    SELECT m.id FROM moodboards m
    JOIN projects p ON p.id = m.project_id
    WHERE p.tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);

DELETE FROM moodboard_comments
WHERE moodboard_id IN (
    SELECT m.id FROM moodboards m
    JOIN projects p ON p.id = m.project_id
    WHERE p.tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);

-- 1.10 email_events Blueprint (68 righe)
DELETE FROM email_events
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 68 righe eliminate

-- 1.11 recall_requests Blueprint (1 riga)
DELETE FROM recall_requests
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 1 riga eliminata

-- 1.12 access_magic_links Blueprint (3 righe)
DELETE FROM access_magic_links
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 3 righe eliminate

-- 1.13 audit_logs Blueprint (70 righe) — opzionale
-- Decommenta se vuoi eliminare anche i log di operazioni test
-- DELETE FROM audit_logs
-- WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

-- ============================================================
-- FASE 2 — BLUEPRINT: TABELLE INTERMEDIE
-- ============================================================

-- 2.1 relationship_threads (14 righe)
DELETE FROM relationship_threads
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 14 righe eliminate

-- 2.2 design_journey_assignments (19 righe)
DELETE FROM design_journey_assignments
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 19 righe eliminate

-- 2.3 human_assignments (10 righe)
DELETE FROM human_assignments
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 10 righe eliminate

-- 2.4 journey_milestones (190 righe)
DELETE FROM journey_milestones
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 190 righe eliminate

-- 2.5 journey_briefs (14 righe)
DELETE FROM journey_briefs
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 14 righe eliminate

-- 2.6 journey_timeline_events (47 righe)
DELETE FROM journey_timeline_events
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 47 righe eliminate

-- 2.7 journey_health_signals (eventuali)
DELETE FROM journey_health_signals
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

-- 2.8 discovery_interviews (13 righe)
DELETE FROM discovery_interviews
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 13 righe eliminate

-- 2.9 moodboards (7 righe)
DELETE FROM moodboards
WHERE project_id IN (
    SELECT id FROM projects
    WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
);
-- Atteso: 7 righe eliminate

-- 2.10 Tabelle satellite account (eventuali)
DELETE FROM account_markets
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM account_style_profile
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM account_team_members
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM relationship_affinities
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM relationship_engagement_signals
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM relationship_inspirations
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM relationship_material_affinities
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM relationship_actions
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM lead_assignments
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

-- 2.11 Tabelle satellite projects
DELETE FROM project_activity
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

DELETE FROM project_ai_briefs
WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585');

DELETE FROM project_comments
WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585');

DELETE FROM project_files
WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585');

DELETE FROM project_notes
WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585');

DELETE FROM project_status_history
WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585');

DELETE FROM proposals
WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585');

DELETE FROM tasks
WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585');

DELETE FROM client_messages
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';

-- ============================================================
-- FASE 3 — BLUEPRINT: ENTITÀ CORE
-- ⚠ Ordine critico: projects PRIMA di leads (FK projects.lead_id)
-- ============================================================

-- 3.1 design_journeys (19 righe)
DELETE FROM design_journeys
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 19 righe eliminate

-- 3.2 contacts (15 righe)
DELETE FROM contacts
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 15 righe eliminate

-- 3.3 projects (21 righe) — PRIMA di leads per FK projects.lead_id
DELETE FROM projects
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 21 righe eliminate

-- 3.4 leads (15 righe)
DELETE FROM leads
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 15 righe eliminate

-- 3.5 accounts (20 righe)
DELETE FROM accounts
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 20 righe eliminate

-- ============================================================
-- FASE 4 — BLUEPRINT: PROFILI CLIENT
-- ============================================================

-- 4.1 users_profile role=client (9 righe)
-- ⚠ NON eliminare admin (caee7b92) e ogrisekadvisor (7e43614e)
DELETE FROM users_profile
WHERE role = 'client'
  AND tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
  AND email NOT IN ('admin@moodfordesign.com', 'ogrisekadvisor@gmail.com');
-- Atteso: 9 righe eliminate

-- 4.2 users (legacy) — elimina non-admin del tenant Blueprint
DELETE FROM users
WHERE tenant_id = '848354b9-a43e-4147-bdad-116fb93bd585'
  AND email NOT IN ('admin@moodfordesign.com', 'ogrisekadvisor@gmail.com');
-- Atteso: 1 riga eliminata

-- ============================================================
-- VERIFICA POST-CLEANUP BLUEPRINT (eseguire subito dopo Fase 4)
-- ============================================================

SELECT 'accounts' as tabella, count(*) FROM accounts WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'leads', count(*) FROM leads WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'contacts', count(*) FROM contacts WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'design_journeys', count(*) FROM design_journeys WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'projects', count(*) FROM projects WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'relationship_threads', count(*) FROM relationship_threads WHERE tenant_id='848354b9-a43e-4147-bdad-116fb93bd585'
UNION ALL SELECT 'users_profile_clients', count(*) FROM users_profile WHERE role='client' AND tenant_id='848354b9-a43e-4147-bdad-116fb93bd585';

-- Atteso: TUTTI 0

-- ============================================================
-- FASE 5 — auth.users (SUPABASE DASHBOARD — non SQL diretto)
-- ============================================================
-- ⚠ NON eseguire direttamente: auth.users è schema Supabase managed.
-- Procedura:
--   1. Aprire https://supabase.com/dashboard/project/<project-id>/auth/users
--   2. Cercare ed eliminare manualmente i seguenti account:
--
-- ogriusa@gmail.com           (30e6b309-734e-41d6-9323-00ab8f5008b2)
-- test.owner.a@example.com    (061d8eb4-...)
-- nuovo.1781151710@test.it    (6641a979-...)
-- lucia.ferri.certtest@gmail.com  (3fbad649-...)
-- elena.romano.cert2@gmail.com    (f88d7e25-...)
-- cert.flow.1781225541@test.it    (2a34ad33-...)
-- testcert242@test.com        (5d96399a-...)
-- direz242@test.com           (84758511-...)
-- p0gate.1781286727@example.com   (c1dd971a-...)
--
-- Alternativa via API (service_role richiesto):
-- DELETE FROM auth.users WHERE id IN (
--     '30e6b309-734e-41d6-9323-00ab8f5008b2',
--     '061d8eb4-...',
--     '6641a979-...',
--     '3fbad649-...',
--     'f88d7e25-...',
--     '2a34ad33-...',
--     '5d96399a-...',
--     '84758511-...',
--     'c1dd971a-...'
-- );

-- ============================================================
-- FASE 6 — NON-BLUEPRINT TENANTS (44 tenant e tutti i loro dati)
-- ============================================================
-- ⚠ Eseguire DOPO Fase 1-5 verificate
-- Definizione: tutti i tenant il cui id != '848354b9-a43e-4147-bdad-116fb93bd585'

-- 6.1 Tabelle con tenant_id FK
-- Ordine: foglie prima, poi tabelle parent, poi tenants

DELETE FROM relationship_messages
WHERE thread_id IN (
    SELECT id FROM relationship_threads
    WHERE tenant_id != '848354b9-a43e-4147-bdad-116fb93bd585'
);

DELETE FROM design_journey_assignment_events
WHERE assignment_id IN (
    SELECT id FROM design_journey_assignments
    WHERE tenant_id != '848354b9-a43e-4147-bdad-116fb93bd585'
);

DELETE FROM human_assignment_events
WHERE assignment_id IN (
    SELECT id FROM human_assignments
    WHERE tenant_id != '848354b9-a43e-4147-bdad-116fb93bd585'
);

DELETE FROM milestone_versions
WHERE milestone_id IN (
    SELECT id FROM journey_milestones
    WHERE tenant_id != '848354b9-a43e-4147-bdad-116fb93bd585'
);

DELETE FROM moodboard_elements
WHERE moodboard_id IN (
    SELECT m.id FROM moodboards m
    JOIN projects p ON p.id = m.project_id
    WHERE p.tenant_id != '848354b9-a43e-4147-bdad-116fb93bd585'
);

DELETE FROM moodboard_pages
WHERE moodboard_id IN (
    SELECT m.id FROM moodboards m
    JOIN projects p ON p.id = m.project_id
    WHERE p.tenant_id != '848354b9-a43e-4147-bdad-116fb93bd585'
);

-- Per ogni tabella con tenant_id: delete WHERE tenant_id != Blueprint
-- (Le seguenti istruzioni coprono tutte le tabelle FK a tenants)
DO $$
DECLARE
    tbl TEXT;
    tables_with_tenant TEXT[] := ARRAY[
        'funnel_events', 'relationship_notifications', 'email_events',
        'recall_requests', 'access_magic_links', 'relationship_threads',
        'design_journey_assignments', 'human_assignments', 'journey_milestones',
        'journey_briefs', 'journey_timeline_events', 'journey_health_signals',
        'discovery_interviews', 'lead_assignments', 'design_journeys',
        'contacts', 'projects', 'leads', 'accounts',
        'account_markets', 'account_style_profile', 'account_team_members',
        'relationship_affinities', 'relationship_engagement_signals',
        'relationship_inspirations', 'relationship_material_affinities',
        'relationship_actions', 'relationship_activities', 'relationship_projects',
        'project_activity', 'project_ai_briefs', 'project_comments',
        'project_files', 'project_notes', 'project_status_history',
        'proposals', 'tasks', 'client_messages', 'notifications',
        'moodboards', 'moodboard_shares', 'moodboard_versions', 'moodboard_comments',
        'moodboard_candidates', 'moodboard_templates',
        'users_profile', 'users', 'human_assignment_events',
        'tenant_configuration', 'tenant_atelier_identity', 'tenant_email_settings',
        'tenant_settings', 'tenant_onboarding', 'tenant_markets',
        'tenant_memberships', 'atelier_dashboard_config', 'atelier_dashboard_media',
        'atelier_dashboard_quotes', 'analytics_events', 'ai_assist_logs',
        'audit_logs', 'studio_registrations', 'studio_relations',
        'studio_relationship_events', 'studio_requests',
        'editorial_cta_clicks', 'interactions'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_with_tenant LOOP
        BEGIN
            EXECUTE format(
                'DELETE FROM %I WHERE tenant_id != %L',
                tbl, '848354b9-a43e-4147-bdad-116fb93bd585'
            );
            RAISE NOTICE 'Cleaned: %', tbl;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skip/Error on %: %', tbl, SQLERRM;
        END;
    END LOOP;
END $$;

-- 6.2 studio_email_dispatch_log (no tenant_id — delete tutti i 275 record)
-- ⚠ Questi sono TUTTI log di test, nessun record reale
DELETE FROM studio_email_dispatch_log;
-- Atteso: 275 righe eliminate

-- 6.3 users (legacy) non-Blueprint (39 righe)
DELETE FROM users
WHERE tenant_id != '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 39 righe eliminate

-- 6.4 DELETE tenants non-Blueprint (44 tenant)
-- ⚠ ULTIMA operazione — solo dopo aver svuotato tutti i child records
DELETE FROM tenants
WHERE id != '848354b9-a43e-4147-bdad-116fb93bd585';
-- Atteso: 44 righe eliminate

-- ============================================================
-- VERIFICA FINALE
-- ============================================================

SELECT 'tenants' as tabella, count(*) as rimasti FROM tenants
UNION ALL SELECT 'auth_users_non_staff', count(*) FROM auth.users 
    WHERE id NOT IN (SELECT auth_user_id FROM users_profile WHERE email IN ('admin@moodfordesign.com','ogrisekadvisor@gmail.com') AND auth_user_id IS NOT NULL)
UNION ALL SELECT 'users_profile_total', count(*) FROM users_profile
UNION ALL SELECT 'accounts', count(*) FROM accounts
UNION ALL SELECT 'leads', count(*) FROM leads
UNION ALL SELECT 'design_journeys', count(*) FROM design_journeys
UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'relationship_threads', count(*) FROM relationship_threads
UNION ALL SELECT 'moodboards', count(*) FROM moodboards;

-- Atteso post-cleanup:
-- tenants: 1 (Blueprint)
-- auth_users_non_staff: 0
-- users_profile_total: 2 (admin + ogrisekadvisor)
-- accounts: 0
-- leads: 0
-- design_journeys: 0
-- projects: 0
-- relationship_threads: 0
-- moodboards: 0

-- ============================================================
-- END OF SCRIPT
-- ⚠ NON ESEGUIRE senza approvazione
-- ⚠ Fare COMMIT solo dopo verifica manuale dei count()
-- ============================================================
