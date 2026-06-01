# MOOD for DESIGN™ — Product Requirements & Progress

> **Versione**: 2026-05-31 · Aggiornato dopo Preview Deploy Pricing & Positioning Revision
> **Stato globale**: Multi-fase. Hold P0 Supabase ancora attivo per `users`/`studio_requests`/`studio_relations`/`access_magic_links` (in attesa log dashboard utente).

---

## Original Problem Statement

MOOD for DESIGN™ è una piattaforma B2B per studi di interior design, architettura, showroom, material specialist, brand. Architettura a 2 workspace:
- **Command Center** (`/command-center/*`) → Super Admin + Advisor, governance MOOD Core
- **Blueprint Tenant** → workspace operativo studi (futuro: `<slug>.moodfordesign.com`)

Founder ≠ Command Center user. Studio Request ≠ Tenant. Provisioning asincrono e idempotente.

---

## Core Architectural Directives (BINDING)

1. **Command Center ≠ Blueprint** — separazione strutturale
2. **Founder ≠ Command Center user** — workaround temporaneo oggi, subdomain dedicato domani
3. **Studio Request ≠ Tenant** — la richiesta non crea infrastruttura
4. **Provisioning idempotente** — ogni job ha idempotency_key
5. **Audit log su ogni transizione di stato**
6. **NO HARDCODED LOCALES** (2026-05-31) — BCP-47 obbligatorio, `platform_languages` = single source of truth, fallback chain dinamica, LTR/RTL

---

## Implementation Status

### ✅ COMPLETATO
- **STUDIO ACTIVATION FLOW V2** (2026-06-01) — Nuovo funnel pubblico `/studio` a 5 step DB-driven (categoria · paese · referente · aiuto · ricevuto). Zero foto reali, zero hardcoded, lifecycle V1 riutilizzato senza duplicazione. V1 quarantenato su `/studio-legacy`. Report `STUDIO_V2_IMPLEMENTATION_REPORT.md` (READY_FOR_USER_ACCEPTANCE).
- Resend Production Go-Live (`no-reply@mail.moodfordesign.com`)
- Tenant Lifecycle (validazione E2E)
- MOOD Advisor Mini CRM™ — Migration 025 (schema applicato, codice paused)
- Logo update (favicon `mood_logotype_OO.png` + Command Center logo)
- **Studio Activation Flow v2** — Design package completo (5 documenti + canonical lifecycle)
- **Open Decisions** (D1-D10) — Recommended Package approvato dall'utente
- **Tier Naming finale** — Blueprint Studio · Practice · Enterprise (APPROVED 2026-05-31)
- **LOCALE ARCHITECTURE DIRECTIVE** — direttiva globale acquisita e propagata su tutti i documenti
- **Migration 026** — `platform_languages` normalizzato a BCP-47, `editorial_block_translations.locale` dedup + normalize
- **Site Resolver dinamico** — NO hardcoded locales, fallback chain via `platform_languages.fallback_locale`
- **Frontend Locale handling** — `LocaleContext` + `localizedSlugs` con BCP-47 + legacy alias
- **CMS Update Pricing & Features** — 182 blocchi + 364 traduzioni (it-IT + en-US), zero prezzi pubblici, tier Blueprint Studio/Practice/Enterprise, CTA "Candida il tuo studio" / "Apply your studio"
- **Preview Deploy** — `/caratteristiche` `/features` `/versioni-prezzi` `/pricing` verificati visivamente
- **Market Architecture First** (2026-06) — Footer Market Selector DB-driven, BCP-47 strict, zero hardcoded locales
- **TENANT ACTIVATION HARDENING SPRINT™** (2026-06-01) — CMS-driven email pipeline + Command Center Console + REAL_TENANT_SIMULATION PASS → classificato `READY_FOR_REAL_TENANT_ACQUISITION`

### 🟡 IN ATTESA APPROVAZIONE UTENTE
- **Production Deployment** delle nuove pagine Features + Pricing (esplicitamente LOCKED)

### 🔴 BLOCCATO (incident P0)
- **Supabase Incident RCA** — DB wipe del 2026-05-30 su `users` (0 righe), `studio_requests`, `studio_relations`, `access_magic_links`. RCA in attesa dei log dashboard dell'utente.
- **Tenant operativi** — `tenants` con status `archived`, da ripristinare post-RCA

### ⏳ BACKLOG MVP (autorizzato dall'utente)
- **Command Center `/languages`** (admin UI per gestione locale runtime) — scope MVP, posticipato a iterazione successiva
- **Backend admin API** `/api/admin/languages` CRUD — non bloccante per review visiva
- **Traduzioni** per le altre 10 locale pre-registrate (`fr-FR`, `de-DE`, `es-ES`, `es-MX`, `en-GB`, `ar-AE`, `pt-BR`, `pt-PT`, `zh-CN`, `ja-JP`)

### ⏳ BACKLOG P1
- Studio Activation Funnel v2 implementazione (DESIGN ONLY oggi, codice da scrivere)
  - Migration 027: `countries`, `reserved_subdomains`, `studio_requests_v2`, `studio_v2_drafts`, `v_global_email_registry`
  - Backend API `/api/studio/v2/*` (manifest, countries, languages, draft, submit, check-email, check-subdomain)
  - Frontend 5 movimenti + componenti
  - Mapbox integration (richiede playbook + token)
- MOOD Advisor Mini CRM™ Chunks B-G (sviluppo paused)
- Tenant Qualification Score™ implementazione (TQS v1.0.0)

### 🧊 FROZEN (P3 backlog)
- Blueprint Origin™ versioning automation
- Tenant Factory™
- Provisioning Engine™
- Multi-tenant subdomain routing
- Commercial Terms Engine + Billing + Commissions + Attribution (Decision 08 frozen)
- Tenant Cloning per agenzie multi-brand

---

## File di riferimento principali

### Design Package `/app/memory/STUDIO_V2/`
| File | Stato |
|---|---|
| `LOCALE_ARCHITECTURE_DIRECTIVE.md` | ✅ Binding |
| `STUDIO_ACTIVATION_LIFECYCLE.md` | ✅ Canonical |
| `00_OVERVIEW_AND_UX.md` | ✅ Approvato |
| `01_COPY_AND_CMS.md` | ✅ Approvato |
| `02_TECH_DESIGN.md` | ✅ Approvato (active_languages schema → directive) |
| `03_SCORE_E2E_MIGRATION.md` | ✅ Approvato |
| `OPEN_DECISIONS_RESOLUTION.md` | ✅ Recommended Package APPROVED |
| `PRICING_POSITIONING_REVISION.md` | ✅ APPROVED · implementato |
| `TIER_NAMING_FINAL_REVISION.md` | ✅ APPROVED |
| `PREVIEW_DEPLOY_REPORT.md` | ✅ Nuovo · sintesi preview deploy |

### Code chiave (toccato in Pricing & Positioning revision)
- `/app/backend/db/migrations/026_locale_architecture_normalization.sql` (executed)
- `/app/backend/services/site_resolver.py` (refactored)
- `/app/backend/scripts/cms_update_pricing_positioning.py` (CMS update script)
- `/app/frontend/src/contexts/LocaleContext.js` (BCP-47)
- `/app/frontend/src/corporate/routes/localizedSlugs.js` (BCP-47 + legacy alias)

---

## Decisioni utente storiche (cronologiche)

1. **Recommended Package OPEN DECISIONS** approvato (Decision 05 e 06 con note · 08 frozen)
2. **D6 D7 D2** approvate (no prezzi · CTA Demo eliminata · Philosophy → "Come viene adottato Blueprint")
3. **Tier Naming definitivo**: Blueprint Studio · Practice · Enterprise
4. **LOCALE ARCHITECTURE DIRECTIVE** binding
5. **MVP locales**: enabled `it-IT` + `en-US`, disabled `en-GB/fr-FR/de-DE/es-ES/es-MX/ar-AE/pt-BR/pt-PT/zh-CN/ja-JP`
6. **Production deploy** NON ancora autorizzato — review visiva richiesta prima

---

## Test Credentials

Vedi `/app/memory/test_credentials.md`. **NOTA**: tabella `users` ancora vuota per incident P0. Nessun login possibile finché RCA non chiusa.
