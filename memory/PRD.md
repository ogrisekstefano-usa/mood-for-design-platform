# PRD — MOOD for DESIGN B2B Platform

## Stato corrente (2 Giu 2026)
🟢 **READY_TO_INVITE_FIRST_REAL_TENANT** — pipeline Visitor → V2 Submit
→ Advisor Review → Activation → Magic Link → Founder Workspace
certificata end-to-end con scenario reale (Martinel Interior Design,
Pordenone IT → US·GB·AE).

## Original problem statement
B2B platform multi-tenant. Studio designer si registrano via Studio V2
funnel, advisor del MOOD curano i lead, super-admin attivano i tenant,
i founder accedono al loro Blueprint workspace via magic-link.

## P0 acquisitionm pipeline (DONE)
- Studio V2 funnel `/studio` (5 step, archetype/markets/HQ/contact/help)
- Persistenza in `studio_requests` con `studio_name`, geo, target countries
- Email layer Resend hardenizzato (load_dotenv override + health check + sandbox retry)
- Lifecycle automation: status `qualified → activated` orchestra tenant + membership + magic-link
- AUTH: JWT + Magic Link senza fuga `raw_token`, 4 recovery flow (password reset, magic link, reinvio invito, workspace recovery)
- Tenant Isolation: founder bloccato su pipeline/studio_requests/manifest cross-tenant
- Role-based routing: admin → command-center, founder → /welcome, advisor → /advisor-console
- Logout completo (5 chiavi localStorage cleared)

## P0 fix applicati 2 Giu 2026 (GO-LIVE DRY-RUN)
1. `AccessContinuityPage.jsx` — password login scriveva solo `mood_jwt` invece di `mood_auth_token`. Helper `_persistSession()` ora scrive tutte le 6 chiavi.
2. `admin_site.py` — `/api/admin/site/whoami` rifiutava `role=owner`. Guard inline che accetta {admin, editor, advisor, owner}, isolation altrove preservata.
3. `adminApi.js` — `adminAuth.clear()` non puliva le chiavi legacy → token zombie. Fix esteso `clear()`.

## P1 backlog (FROZEN by user)
- **Relationship OS™ M1 Contact CRM** — 🟢 **M1_COMPLETED_READY_FOR_M2** (2 Giu 2026). Migration 032 (`tenant_relationship_owner_*`), 24 endpoint API (admin + founder mirror D4), 4 pagine UI (TenantsList, TenantDetail 5-tab, BlueprintOverview, ContactDrawer con 5 Quick Actions), 16/16 security checks PASS, 0 regression. Catalog DB-driven (11 ruoli + 8 sources + 8 activity types). Report: `/app/memory/M1_CONTACT_CRM_IMPLEMENTATION_REPORT.md`. Performance gap noto (~1.7s/query) per latenza Supabase, da risolvere in M2 con connection pooling.
- **Relationship OS™ M0** — 🟢 **M0_COMPLETED_READY_FOR_M1**. Migration 031 + 4 catalog seeds. Report: `/app/memory/RELATIONSHIP_OS_M0_EXECUTION_REPORT.md`.
- Tenant Launch Pack M1 (Schema 031 + CMS seed)
- Advisor Digest (`advisor_new_lead` digest pool)
- Studio Requests UI: chip markets/languages/experiences
- V2 funnel: capture `languages` array

## P2 backlog
- CRM, Notification Center
- Tenant Launch Pack M2-M5 (Health Score, Advisor rules)
- Command Center UI per platform_languages/markets/project_types
- Corporate Footer `MERCATO` i18n mismatch (P1 in pausa)
- Newline letterale nel template Founder Welcome firma
- `<a> nested` nel footer logo
- Console warnings CMS `block_heading/block_text Unknown section type`

## Architettura
- Backend: FastAPI + SQLAlchemy async (Supabase Postgres)
- Frontend: React 18 + react-router + axios
- Email: Resend (`mail.moodfordesign.com` verified)
- Geocoding: Mapbox

## Endpoint chiave
- `POST /api/studio/v2/submit` — funnel V2 submit
- `POST /api/auth/login` — JWT password login
- `POST /api/auth/magic-link/request` — magic link issue (no raw_token)
- `POST /api/auth/magic-link/consume` — JWT + redirect_url
- `POST /api/auth/password-reset/request` — recovery (no raw_token)
- `POST /api/admin/studio/requests/{id}/activate` — orchestrazione tenant
- `GET  /api/admin/tenant-activation/pipeline` — kanban admin
- `GET  /api/admin/site/whoami` — session check permissivo (admin/editor/advisor/owner)
- `GET  /api/health/email` — health check (sandbox/api/domain)

## Documenti chiave
- `/app/memory/FIRST_REAL_TENANT_CERTIFICATION_REPORT.md` — dry-run 02/06/2026
- `/app/memory/TENANT_ACTIVATION_COMPLETION_REPORT.md`
- `/app/memory/EMAIL_DELIVERY_HARDENING_REPORT.md`
- `/app/memory/TENANT_ISOLATION_FIX_REPORT.md`
- `/app/memory/RELATIONSHIP_OS_M0_EXECUTION_REPORT.md` — M0 DB foundation (02/06/2026)
- `/app/memory/M1_CONTACT_CRM_IMPLEMENTATION_REPORT.md` — M1 Contact CRM (02/06/2026)
- `/app/memory/M1_REAL_USAGE_VALIDATION_REPORT.md` — M1 real usage validation (02/06/2026)
- `/app/memory/M1_0_1_HOTFIX_REPORT.md` — M1.0.1 hotfix ARCH-1+ARCH-2 (02/06/2026) 🟢
- `/app/memory/M2_RELATIONSHIP_TIMELINE_FINAL_EXECUTION_PLAN.md` — piano M2 con 4 decisioni utente recepite
- `/app/memory/M2_IMPLEMENTATION_KICKOFF_REPORT.md` — readiness M2 (02/06/2026)
- `/app/memory/M2_IMPLEMENTATION_REPORT.md` — M2 implementation report (02/06/2026) 🟢
- `/app/memory/M3_ACTIVITY_LOG_ADVANCED_EXECUTION_PLAN.md` — piano M3 v0 (superato)
- `/app/memory/M3_FINAL_EXECUTION_PLAN.md` — piano M3 definitivo (D1-D7 recepite, 02/06/2026)
- `/app/memory/M3_IMPLEMENTATION_REPORT.md` — M3 implementation report (03/06/2026) 🟢

## Stato Relationship OS™ (03/06/2026)
- ✅ **M0** DB foundation (view `v_relationship_timeline`, indici, catalog) — VALIDATED
- ✅ **M1** Contact CRM (CRUD + Org Owner + Founder mirror + RBAC) — VALIDATED
- ✅ **M1.0.1** Hotfix (`catalogs/languages` 200 · `preferred_language` normalize) — VALIDATED
- ✅ **M2** Relationship Timeline + Health Hooks — COMPLETED (121/121 PASS)
- ✅ **M3** Activity Log Advanced™ · Relationship Memory Layer — **COMPLETED** (153/153 PASS · 32/32 acceptance)
- ✅ **M2/M3 UI Alignment** — `ActivityFeed.jsx` + `TimelineFeed.jsx` allineati ai token Command Center (03/06/2026). Report: `/app/memory/ACTIVITY_TIMELINE_UI_ALIGNMENT_REPORT.md` 🟢
- 🔄 **M2/M3 UI direction rifocata** (03/06/2026) — l'utente ha rifiutato l'orientamento editoriale ("CRM dark mode") e ha riapprovato il modello SaaS-prima (Salesforce/Hubspot/Linear/Notion/Attio). Architettura Relationship OS ridisegnata in `/app/memory/RELATIONSHIP_OS_ARCHITECTURE_DELIVERABLE.md`. M6 (Relationship Center 3-colonne) postposto dopo M4+M5.
- ✅ **M4** Internal Notification Center — **COMPLETED** (03/06/2026)
   * Backend 100% (19/19 PASS): migration 035 (catalog 9 categorie + preferences in_app/email/push + 6 FK strutturate)
   * Service `notifications.py` con `notify()` idempotente · `unread_count` con `has_critical` · RBAC strict
   * Router REST 7 endpoint (list, unread-count, mark-read, archive, categories, preferences GET+PATCH)
   * Hook in 5 servizi (studio_v2, activation, activities, contacts, magic-link consume)
   * Cron `followup_overdue_scan` Europe/Rome 08:00 via APScheduler
   * Frontend ~85%: Bell numerico sobrio (teal/red dinamico, NO `!`) + Drawer 380px con sezione "Critiche" separata + 6 filtri (Tutte/Non lette/Critiche/Attività/Tenant/Advisor) + polling 60s/10min visibility-aware
   * Deliverable: `/app/memory/M4_PHASE2_CHECKIN_REPORT.md` + `/app/memory/M4_IMPLEMENTATION_REPORT.md`
- ⏸️ **M5** Advisor Workspace — pianificato (architettura in deliverable Relationship OS · `/workspace/*` namespace)
- ⏸️ **M5** Advisor Workspace + KPI — pianificato
- ⏸️ **M1.1** Performance Hardening (connection pool) — task separato
- ⏸️ **M2.1** Cosmetic fix header "Untitled studio" — backlog

## Test
- `/app/backend/scripts/first_real_tenant_audit.py` — audit E2E (47 checks)
- `/app/backend/scripts/dry_run_fresh_lead.py` — generatore lead/magic-link per UI tests
- `/app/backend/scripts/auth_finalization_test.py` — auth UX (21 checks)
- `/app/backend/scripts/email_e2e_real_test.py` — email layer

## Credenziali test → `/app/memory/test_credentials.md`
