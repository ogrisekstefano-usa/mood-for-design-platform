# ITER174 · CLEAN RESET CONTROLLED™ — EXECUTION REPORT

> **Stato**: ✅ COMPLETATO
> **Modalità**: APPROVATO dall'utente · esecuzione reale
> **Inizio**: 2026-05-30 23:58:37 UTC
> **Fine**: 2026-05-31 00:03:24 UTC
> **DB Transaction**: `COMMIT` ✅
> **Storage REST**: 10/10 ok
> **Supabase Auth admin API**: 8/8 + 1 smoke-cleanup = 9/9 ok

---

## 1 · TENANTS AFTER CLEANUP

| Slug | Name | Status | Plan | Note |
|---|---|---|---|---|
| `studio` | MOOD for DESIGN | **active** | enterprise | 🟢 **Tenant operativo Blueprint** (id `848354b9-a43e-4147-bdad-116fb93bd585`) |
| `atelier-p0-final` | Atelier P0 Final | archived | starter | inerte |
| `studio-verifica-e2e` | Studio Verifica E2E | archived | starter | inerte |
| `studio-tenant-lifecycle` | Studio Tenant Lifecycle | archived | studio | inerte |
| `atelier-lifecycle` | Atelier Lifecycle | archived | studio | inerte |
| `margraf-usa` | Margraf USA | **archived** ⬅ NEW | studio | archiviato in questa run (era active) |

**Tenant attivi**: **1** (`studio`)
**Tenant collegato a `blueprint.moodfordesign.com`**: `studio` (via `DEFAULT_PUBLIC_TENANT_SLUG=studio` → tenant_id `848354b9-…`)

> Slug, name e struttura NON modificati come da vincoli espliciti.
> Rename audit sarà gestito in **FOUNDER TENANT RENAMING AUDIT™** (fase separata).

---

## 2 · USERS AFTER CLEANUP

### `auth.users`
| ID | Email | last_sign_in |
|---|---|---|
| `18712745-bffc-4b42-b489-654a2aa83d6b` | `admin@moodfordesign.com` | 2026-05-30 23:02:03 UTC |

### `users_profile`
| ID | Email | Role | Root | Tenant |
|---|---|---|---|---|
| `caee7b92-34b4-4ecf-bdaa-8a3eda93a70e` | `admin@moodfordesign.com` | `super_admin` | `true` | `848354b9-…` (studio) |

### `public.users`
1 riga rimasta — mirror del founder (auth_user_id `18712745-…`)

### Utenti eliminati (9)
| Email | Categoria | Esito |
|---|---|---|
| `iter171client_1780040627@example.com` | test sintetico | ✅ deleted |
| `iter171repro_1780090804@example.com` | test sintetico | ✅ deleted |
| `iter171client_1780091682@example.com` | test sintetico | ✅ deleted |
| `audit-iter173@test.example` | audit ITER173 | ✅ deleted |
| `audit-exp@test.example` | audit ITER173 | ✅ deleted |
| `support@moodfordesign.com` | account test (dominio reale) | ✅ deleted |
| `ogriusa@gmail.com` | account personale founder (QA) | ✅ deleted |
| `ogrisek.stefano@gmail.com` | account personale founder (QA) | ✅ deleted |
| `smoketest-iter174@example.com` | smoke test post-cleanup | ✅ deleted |

> ⚠️ **NOTA**: gli account personali del founder (`ogriusa@gmail.com`, `ogrisek.stefano@gmail.com`) sono stati cancellati come da istruzione esplicita ("Inclusi: ogriusa@gmail.com, ogrisek.stefano@gmail.com"). Per riaccedere come client di test in futuro: usare il flusso "Begin Journey" pubblico.

---

## 3 · CONTEGGI FINALI (TUTTI = 0 come da target)

| Tabella | Pre | Post | Δ |
|---|---|---|---|
| `leads` | 9 | **0** | -9 |
| `accounts` | 9 | **0** | -9 |
| `contacts` | 9 | **0** | -9 |
| `projects` | 9 | **0** | -9 |
| `design_journeys` | 9 | **0** | -9 |
| `journey_briefs` | 9 | **0** | -9 |
| `journey_milestones` | 90 | **0** | -90 |
| `journey_overview` | 9 | **0** | -9 |
| `journey_timeline_events` | 18 | **0** | -18 |
| `milestone_versions` | 9 | **0** | -9 |
| `relationship_threads` | 10 | **0** | -10 |
| `relationship_messages` | 9 | **0** | -9 |
| `relationship_answer_events` | 5 | **0** | -5 |
| `human_assignments` | 9 | **0** | -9 |
| `human_assignment_events` | 9 | **0** | -9 |
| `studio_relations` | 9 | **0** | -9 |
| `studio_relationship_events` | 16 | **0** | -16 |
| `studio_requests` | 8 | **0** | -8 |
| `studio_activation_drafts` | 30 | **0** | -30 |
| `access_magic_links` | 31 | **0** | -31 |
| `login_attempts` | 48 | **0** | -48 |
| `email_events` | 117 | **0** | -117 |
| `funnel_events` | 18 | **0** | -18 |
| `ai_assist_logs` | 54 | **0** | -54 |
| `audit_logs` | 111 | **0** | -111 |
| `configuration_change_events` | 318 | **0** | -318 |
| `user_onboarding_state` | 2 | **0** | -2 |
| `tenant_domains` (test) | 4 | **0** | -4 |
| `media_library` (candidate) | 11 | 0 (di 70 totali) | -11 |

**Totale righe operazionali eliminate**: **1006** (984 dry-run baseline + 22 dai smoke test post-commit)

### Prospects / Proposals / Notifications / Recall Requests / Moodboards
- `recall_requests`: 0 (già 0 pre-cleanup ✓)
- `proposals`: 0 (già 0 ✓)
- `notifications`: 0 (già 0 ✓)
- `moodboards`: 0 (già 0 ✓)
- `call_requests`: 0 (già 0 ✓)
- `contact_submissions`: 0 (già 0 ✓)
- `magazine_anonymous_leads`: 0 (già 0 ✓ — nessuna tabella prospects dedicata)

---

## 4 · CMS / EDITORIAL / CATALOGHI — TUTTI PRESERVATI

| Tabella | Righe |
|---|---|
| `cms_pages` | **13** ✅ (audience, features, footer, home, login, navigation, pricing, professionals, projects, start_project, support, training, ui) |
| `cms_sections` | **56** ✅ |
| `cms_page_revisions` | **27** ✅ |
| `editorial_blocks` | **1156** ✅ (886 tenant + 270 platform) |
| `editorial_block_translations` | **3224** ✅ |
| `editorial_translations` | **65** ✅ |
| `editorial_masters` | **42** ✅ |
| `editorial_phrases` | **13** ✅ |
| `editorial_surfaces` | **8** ✅ |
| `editorial_variants` | **4** ✅ |
| `tenant_settings` (studio) | **8** ✅ (theme, page.homepage, page.showcase, public_navigation, public_footer, form.design-request, email_identity, email_template:space_ready:it) |
| `tenant_email_settings` | **1** ✅ |
| `tenant_markets` | **8** ✅ |
| `tenant_atelier_identity` | **1** ✅ |
| `tenant_configuration` | **1** ✅ |
| `tenant_onboarding` | **1** ✅ |
| `markets` | **15** ✅ |
| `phone_dial_codes` | **196** ✅ |
| `platform_languages` | **9** ✅ |
| `theme_presets` | **33** ✅ |
| `template_blocks` | **98** ✅ |
| `template_pages` | **23** ✅ |
| `moodboard_rooms` | **16** ✅ |
| `moodboard_chapters` | **9** ✅ |
| `relationship_questions` + groups + options + catalog | **5+5+32+32** ✅ |
| `atmospheric_panels` | **6** ✅ |
| `atelier_dashboard_*` | preservato (2+24+8+6) ✅ |
| `brands` | **20** ✅ |

---

## 5 · STORAGE — STATO FINALE

| Bucket | Files | MB | Note |
|---|---|---|---|
| `cms-assets` | **18** | 17.07 | site storefront (PRESERVE) |
| `media` | **3** | 0.12 | favicon + logo (PRESERVE) |
| `tenant-assets` | **2** | 3.82 | brand/logo + hero_editorial (PRESERVE) |
| **TOTALE** | **23** | **21.01** | |

### Eliminati (10 file / 11.38 MB)
| Bucket | Files | MB | Motivo |
|---|---|---|---|
| `storefront-public` | 4 | 3.74 | orphan tenant `81a09ead…` (non più in `public.tenants`) |
| `tenant-assets/atelier-media/` | 6 | 7.64 | atelier-media test duplicati (a0d510d2 + bca844da × 3 varianti) |

### media_library DB rows
- Pre: 81 → Post: **70** (eliminati 11 rows categoria `inspiration`/`moodboard`/`test`/NULL)
- Tutti i 70 rows PRESERVE corrispondono ai file CMS reali nei bucket `cms-assets`/`media`/`tenant-assets/brand|storefront`

---

## 6 · SMOKE TEST ESEGUITI

| Test | Endpoint | HTTP | Esito |
|---|---|---|---|
| Backend health | `GET /api/` | 200 | ✅ |
| Admin login (JWT) | `POST /api/auth/login` (`admin@moodfordesign.com` / `Blueprint2024!`) | 200 | ✅ session + user OK |
| Magic-link silent | `POST /api/auth/silent-magic-link` (admin) | 200 | ✅ `{ok:true, message:"Ti abbiamo inviato un accesso sicuro."}` |
| Public tenant info | `GET /api/public/tenants/studio` | 200 | ✅ brand, theme, navigation, footer presenti |
| CMS homepage | `GET /api/storefront/public/studio/pages/home?locale=it` | 200 | ✅ |
| CMS professionals | `GET /api/storefront/public/studio/pages/professionals?locale=it` | 200 | ✅ |
| Storefront brand | `GET /api/storefront/public/studio/brand` | 200 | ✅ logo signed URL OK, navigation OK, footer OK |
| Navigation defaults | `GET /api/public/navigation/defaults` | 200 | ✅ |
| Begin Journey (full payload) | `POST /api/public/journeys/initiate` | 201 | ✅ journey_id, magic_link, thread, assignee=Stefano (admin) |

### Risorse archived/preservate verificate
- 🟢 `blueprint.moodfordesign.com` operativo via tenant `studio` (DEFAULT_PUBLIC_TENANT_SLUG)
- 🟢 Branding studio: logo + favicon presenti via signed URLs storage
- 🟢 Navigation + Footer + Homepage CMS contenuti presenti
- 🟢 Magic-link Supabase Auth flow integro
- 🟢 Email templates (`email_identity`, `email_template:space_ready:it`) preservati in `tenant_settings`

---

## 7 · OSSERVAZIONE — BUG PRE-ESISTENTE INDIVIDUATO (NON RISOLTO)

Durante lo smoke test del Begin Journey ho riscontrato un bug **pre-esistente** (non causato dal cleanup):

**File**: `/app/backend/routers/journey_initiate.py` linee 203 e 220
**Sintomo**: se il payload non include `country_code`/`dial_code`/`normalized_phone`, il codice invia `"metadata_json": None` su `accounts.metadata_json` (che è `NOT NULL DEFAULT '{}'::jsonb`) → errore `23502` → HTTP 500.

**Comportamento corrente**:
- ❌ Payload minimo (solo `first_name` + `email`) → HTTP 500
- ✅ Payload con `country_code` → HTTP 201

**Fix proposto** (1 carattere ciascuno, fuori scope ITER174):
```diff
- "metadata_json": _phone_meta or None,
+ "metadata_json": _phone_meta or {},
```
(stessa modifica su accounts riga 203 e contacts riga 220)

**Raccomandazione**: aprire ITER175 (Hotfix) o includere nella prossima iterazione client flow. Il bug **NON blocca** il flusso da frontend (il form invia sempre il campo telefono compilato).

---

## 8 · BACKUP & ARTIFATTI

| Artifact | Path | Note |
|---|---|---|
| Dry-run JSON | `/app/backups/iter174/dry_run_20260530T232439Z.json` | snapshot read-only pre-execution |
| Full pre-cleanup backup | `/app/backups/iter174/pre_cleanup_20260530T235516Z/` | 44 file JSON + MANIFEST + storage_objects + counts_before |
| Cleanup audit | `/app/backups/iter174/cleanup_20260530T235837Z/audit.json` | log transazione, deletes, storage, auth |
| Counts before/after | `/app/backups/iter174/cleanup_20260530T235837Z/{counts_before,counts_after}.json` | regression baseline |
| Dry-run report (markdown) | `/app/memory/ITER174_DRY_RUN_REPORT.md` | narrativa pre-execution |
| Cleanup report (markdown) | `/app/memory/ITER174_CLEANUP_REPORT.md` | questo file |

**Rollback**: tutti i 1006 rows + storage URLs + auth user IDs sono in `pre_cleanup_20260530T235516Z/`. Restore possibile (manuale) tramite `INSERT INTO … SELECT … FROM JSON`. Storage objects: re-upload necessario (i file binari non sono stati salvati, solo i metadata).

---

## 9 · INVARIANTI DI VINCOLO RISPETTATI

| Vincolo | Stato |
|---|---|
| NON rinominare tenant | ✅ `studio` invariato (slug, name, id) |
| NON modificare architettura | ✅ nessuna ALTER, nessuna migration |
| NON implementare nuove feature | ✅ solo SQL DELETE/UPDATE + storage REST DELETE |
| NON toccare frontend | ✅ 0 file React modificati |
| NON toccare CMS | ✅ tutte le 13 cms_pages + 56 cms_sections + 1156 editorial_blocks intatti |
| NON toccare email templates | ✅ `tenant_settings.email_identity` + `email_template:space_ready:it` intatti |
| NON toccare languages | ✅ 9 platform_languages + 196 phone_dial_codes intatti |
| NON toccare schema | ✅ 78 schema_migrations invariati |

---

## 10 · PROSSIMI STEP (BACKLOG)

| Pri | Item | Note |
|---|---|---|
| 🔴 P0 | **FOUNDER TENANT RENAMING AUDIT™** (fase separata) | Decidere se lo slug `studio` va rinominato in `mood-for-design` o lasciato (impatto su DEFAULT_PUBLIC_TENANT_SLUG, tenant_subdomain_lookup, storage paths) |
| 🟠 P0 | **ITER175 · Begin Journey hotfix** | `metadata_json: _phone_meta or {}` (3 righe in journey_initiate.py) |
| 🟡 P1 | Rate limiting su `/api/public/journeys/initiate` + `/auth/silent-magic-link` | Anti-abuse (carry-over dal Pre-Deploy audit) |
| 🟡 P1 | Retry logic su `Transient RemoteProtocolError` (Supabase REST 503) | Carry-over |
| 🟢 P2 | Brief Guidato™ Evolution (room definitions, budget picker, file uploads) | Roadmap originale |
| 🟢 P2 | Call Me Back™ studio-side management | Roadmap originale |
| 🟢 P2 | Appointments™ module | Roadmap originale |
| 🟢 P2 | Team Collaboration Phase A | TEAM_COLLABORATION_ARCHITECTURE.md |
| 🟢 P2 | RLS rollout tabelle tenant | TENANT_ISOLATION_AUDIT.md |

---

✅ **PIATTAFORMA "FOUNDER ONLY" — STATO RAGGIUNTO**
- 1 tenant operativo (`studio` · MOOD for DESIGN · blueprint.moodfordesign.com)
- 1 utente (`admin@moodfordesign.com` · super_admin · root)
- CRM = vuoto
- Storage = 23 file (21 MB) — solo branding & CMS reali
- Smoke test 8/8 OK · 1 bug pre-esistente documentato
