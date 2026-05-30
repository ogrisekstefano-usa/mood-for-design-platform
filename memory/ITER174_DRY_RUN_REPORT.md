# ITER174 · CLEAN RESET CONTROLLED™ — DRY-RUN REPORT

> **Modalità**: DRY-RUN ONLY · **Scritture eseguite**: NESSUNA
> **Timestamp UTC**: `2026-05-30T23:24:39Z`
> **Snapshot JSON**: `/app/backups/iter174/dry_run_20260530T232439Z.json`
> **Script generatore (read-only)**: `/app/backend/scripts/iter174_dry_run.py`
> **Schema validato**: `media_library.source_kind` (non `kind`), `accounts.account_name` (non `name`), `access_magic_links.email_attempt` (non `email`)

---

## 0 · CONFERMA INTEGRITÀ DRY-RUN

| Garanzia | Valore |
|---|---|
| Connessione | `postgresql://` (service-role, read-only nelle query usate) |
| Comandi SQL emessi | **SELECT only** (nessun `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`/`ALTER`) |
| Tabelle modificate | **0** |
| Righe modificate | **0** |
| File toccati su storage | **0** |
| Output | 1 JSON snapshot + 1 markdown report (questo file) |

---

## 1 · TENANTS

### 1a · Riepilogo
| Slug | ID (prefix) | Name | Status | Plan | Users | Journeys | Classificazione |
|---|---|---|---|---|---|---|---|
| `studio` | `848354b9…` | MOOD for DESIGN | **active** | enterprise | 9 | 9 | 🟢 **PRESERVE (operativo)** |
| `atelier-p0-final` | `ffc845f0…` | Atelier P0 Final | archived | starter | 0 | 0 | ⚪ Già archiviato (no live data) |
| `studio-verifica-e2e` | `f0e30282…` | Studio Verifica E2E | archived | starter | 0 | 0 | ⚪ Già archiviato (no live data) |
| `studio-tenant-lifecycle` | `4dcfe2aa…` | Studio Tenant Lifecycle | archived | studio | 0 | 0 | ⚪ Già archiviato (no live data) |
| `atelier-lifecycle` | `62fddb8f…` | Atelier Lifecycle | archived | studio | 0 | 0 | ⚪ Già archiviato (no live data) |
| `margraf-usa` | `0618756f…` | Margraf USA | **active** | studio | 0 | 0 | 🟡 **DECISIONE RICHIESTA** (active ma vuoto) |

### 1b · Tenant operativo — `studio` (PRESERVE)
```
tenant_id     : 848354b9-a43e-4147-bdad-116fb93bd585
slug          : studio
name          : MOOD for DESIGN
status        : active
active_plan   : enterprise
is_demo       : false
users_count   : 9   (di cui 1 root, 8 candidati delete vedi §2)
journeys_count: 9   (tutti test data)
domini collegati: 4 (test-custom-*.example.com, test-sub-*.moodfordesign.com) → tutti `pending`
```
> Il routing `blueprint.moodfordesign.com` arriva qui via `default_public_tenant_slug=studio`.

### 1c · Tenant `margraf-usa` — chiarimento richiesto
- È stato creato via `studio_request` (record `76dccda3…`, "Stefano Ogrisek / Managing Director", città Chicago).
- Ha 3 `tenant_modules` configurati ma **0 users**, **0 journeys**, **0 lead/account/contact/project**.
- Decisione utente necessaria: **lo lasciamo per Ring 1** (come hai indicato) oppure **lo archiviamo**?
- ⚠️ Anche se archiviato, NON viene toccata nessuna riga in altre tabelle (è già "vuoto").

### 1d · Tenant archiviati (4) — *contenitori inerti*
Tutti già `status='archived'` (frozen in ITER173). Cosa contengono:
- `tenant_modules`: 3+3+3+2 = 11 record di configurazione modulo (catalog data, irrilevante per cleanup)
- Nessun dato utente, journey, lead, account, contatto, progetto, conversazione
- I record `studio_request` originari (4) restano per audit trail

Opzioni cleanup:
1. **Conservativo** (consigliato): lasciare archiviati così come sono (zero impatto, audit trail intatto).
2. **Hard delete**: `DELETE FROM tenants WHERE status='archived'` + cascade su `tenant_modules` (11 righe). *Non risolve nessun problema; solo cosmetico.*

---

## 2 · UTENTI

### 2a · `auth.users` — 9 totali
| Email | Classificazione | last_sign_in | Note |
|---|---|---|---|
| `admin@moodfordesign.com` | 🟢 **PRESERVE (admin root)** | 2026-05-30 23:02 | super_admin · `is_root_superadmin=true` |
| `iter171client_1780040627@example.com` | 🟥 DELETE (synthetic) | — | test ITER171 |
| `iter171repro_1780090804@example.com` | 🟥 DELETE (synthetic) | — | test ITER171 |
| `iter171client_1780091682@example.com` | 🟥 DELETE (synthetic) | — | test ITER171 |
| `audit-iter173@test.example` | 🟥 DELETE (synthetic) | — | audit ITER173 |
| `audit-exp@test.example` | 🟥 DELETE (synthetic) | — | audit ITER173 expiry |
| `support@moodfordesign.com` | 🟡 **DECISIONE RICHIESTA** | 2026-05-29 21:28 | dominio reale, ma usato come client di test |
| `ogriusa@gmail.com` | 🟡 **DECISIONE RICHIESTA** | 2026-05-30 03:06 | account personale Stefano (QA) |
| `ogrisek.stefano@gmail.com` | 🟡 **DECISIONE RICHIESTA** | 2026-05-30 19:49 | account personale Stefano (QA) |

> **Totale candidati delete sintetici**: **5/9**
> **Totale candidati delete con decisione richiesta**: **3/9** (le tre email reali di Stefano + `support@…`)
> **Da preservare in ogni caso**: **1/9** (`admin@moodfordesign.com`)

### 2b · `users_profile` — 9 totali (1:1 con auth.users)
Tutti i 9 profili sono sul tenant `studio` (848354b9…).
- 1 `super_admin` con `is_root_superadmin=true` → **PRESERVE** (`admin@moodfordesign.com`)
- 8 `role='client'` → segue la decisione di §2a

### 2c · Utenti team / designer / orfani — verifica esplicita
| Categoria | Trovati | Note |
|---|---|---|
| Team members (`studio_team_members`) | 0 | Tabella vuota |
| Designer/staff (`role IN ('designer','team_member','founder','advisor')`) | 0 | Solo `super_admin` (1) e `client` (8) |
| Magic-link users senza profilo | 0 | Tutti i 30 magic-link sono per email registrate o per test sintetici |
| Prospect (anonimi non convertiti) | 0 | `magazine_anonymous_leads`=0, `contact_submissions`=0 |
| Auth users orfani (senza `users_profile`) | 0 | Mappatura 1:1 verificata |
| Member invites pendenti | 0 | `member_invites` vuota |

---

## 3 · DATI OPERAZIONALI (potenziali candidati cleanup)

Tutti i dati operazionali esistono **solo sul tenant operativo `studio`**. Sono tutti generati da test/QA tra il 2026-05-29 e il 2026-05-30.

### 3a · Catena CRM/Journey (test data)
| Tabella | Righe | Categoria utente |
|---|---|---|
| `leads` | 9 | Leads |
| `accounts` | 9 | Accounts |
| `contacts` | 9 | Contacts |
| `projects` | 9 | Projects |
| `design_journeys` | 9 | Design Journeys |
| `journey_briefs` | 9 | (collegato) |
| `journey_milestones` | 90 | (collegato) |
| `journey_overview` | 9 | (vista materializzata) |
| `journey_timeline_events` | 18 | (collegato) |
| `milestone_versions` | 9 | (collegato) |

> **Prospects**: nessuna tabella `prospects` dedicata esiste. Il modello distingue solo `leads` → `accounts`. Tutti i 9 leads sono `status='qualified'`, già convertiti in account.

### 3b · Conversazioni / Relazioni (test data)
| Tabella | Righe |
|---|---|
| `relationship_threads` | 10 |
| `relationship_messages` | 9 |
| `relationship_answer_events` | 5 |
| `human_assignments` | 9 |
| `human_assignment_events` | 9 |
| `studio_relations` | 9 |
| `studio_relationship_events` | 16 |
| **Recall Requests** (`recall_requests`) | **0** ✓ |
| **Moodboards** (`moodboards`) | **0** ✓ |
| **Call requests** (`call_requests`) | **0** ✓ |

### 3c · Auth / accessi (test data)
| Tabella | Righe | Note |
|---|---|---|
| `access_magic_links` | 31 | 19 consumati, 12 pendenti |
| `login_attempts` | 48 | log telemetria |
| `studio_activation_drafts` | 30 | bozze flusso "Crea Studio" |
| `studio_requests` | 8 | 6 hanno generato un tenant, 2 orfani (`Studio In Lettura`, `Stefano USA`) |

### 3d · Telemetria / log (sicuro da svuotare)
| Tabella | Righe |
|---|---|
| `email_events` | 117 |
| `funnel_events` | 18 |
| `ai_assist_logs` | 54 |
| `audit_logs` | 111 |
| `configuration_change_events` | 318 |
| `user_onboarding_state` | 2 |

### 3e · **TOTALE RIGHE OPERAZIONALI candidate cleanup**: **984**

---

## 4 · EDITORIAL / CMS / CONTENUTO FRONTEND

### 4a · CMS reale (PRESERVE — non toccare)
| Tabella | Righe | Note |
|---|---|---|
| `cms_pages` | 13 | pagine pubbliche storefront |
| `cms_sections` | 56 | sezioni CMS |
| `cms_page_revisions` | 27 | storico revisioni |
| `editorial_blocks` | 1156 | 886 tenant + 270 platform-level — source-of-truth |
| `editorial_block_translations` | 3224 | localizzazioni ALE |
| `editorial_translations` | 65 | layer studio (62) + platform (3) |
| `editorial_masters` | 42 | master CMS |
| `editorial_phrases` | 13 | frasi atelier |
| `editorial_surfaces` | 8 | superfici pubbliche |
| `editorial_variants` | 4 | varianti tenant |
| `atelier_dashboard_config` | 2 | dashboard CMS Atelier |
| `atelier_dashboard_media` | 24 | immagini dashboard (preview) |
| `atelier_dashboard_quotes` | 8 | citazioni Atelier |
| `atelier_presets_registry` | 6 | preset feature module |
| `atmospheric_panels` | 6 | pannelli atmosferici (ITER168) |
| `template_blocks` | 98 | blocchi template |
| `template_pages` | 23 | pagine template |
| `theme_presets` | 33 | preset tematici |

### 4b · Programmazione editoriale (vuoto, già pulito)
| Tabella | Righe |
|---|---|
| `magazine_articles` | 0 |
| `magazine_posts` | 0 |
| `magazine_paragraphs` | 0 |
| `magazine_anonymous_leads` | 0 |
| `journal_articles` | 0 |
| `journal_article_blocks` | 0 |
| `journal_categories` | 0 |
| `journal_tags` | 0 |
| `editorial_revisions` | 0 |
| `editorial_composition_log` | 0 |
| `editorial_phrase_overrides` | 0 |
| `editorial_market_learnings` | 0 |
| `content_revisions` | 0 |
| `article_localizations` | 0 |

> **Nessuna programmazione editoriale mock attiva**: tutte le tabelle di scheduling sono vuote.

### 4c · Editorial mock data potenziale — NESSUNO trovato
- Non esistono entry editorial taggate `is_test=true` o con namespace `test.*` (verificato su `editorial_blocks.namespace`).
- I 1156 `editorial_blocks` sono CMS production.

---

## 5 · STORAGE (Supabase Storage)

### 5a · Buckets totali: 12 (4 con file, 8 vuoti)

| Bucket | Files | MB | Preserve | Candidate | **Orphan** |
|---|---|---|---|---|---|
| `cms-assets` | 18 | 17.06 | **18** ✅ | 0 | 0 |
| `media` | 3 | 0.12 | **3** ✅ | 0 | 0 |
| `tenant-assets` | 8 | 11.46 | **2** | **6** 🟥 | 0 |
| `storefront-public` | 4 | 3.74 | 0 | 0 | **4** 🟥 |
| `catalog-sources` | 0 | — | — | — | — |
| `exports` | 0 | — | — | — | — |
| `journal-media` | 0 | — | — | — | — |
| `magazine-media` | 0 | — | — | — | — |
| `moodboard-assets` | 0 | — | — | — | — |
| `project-files` | 0 | — | — | — | — |
| `proposal-files` | 0 | — | — | — | — |
| `tenant-branding` | 0 | — | — | — | — |

### 5b · `cms-assets` (18 files / 17.06 MB) — **PRESERVE TUTTI**
Tutti i 18 file sono sotto `848354b9…/site/*` (storefront tenant operativo).
Motivo PRESERVE: assets storefront editoriale (`AdobeStock_*`, immagini hero `1-edited.jpg` … `7-edited.jpg`) usati dalle CMS pages.

### 5c · `media` (3 files / 0.12 MB) — **PRESERVE TUTTI**
- `848354b9…/brand/favicon_5fb3e8c53dda8212.png` (9 KB)
- `848354b9…/brand/favicon_squared_35151197f714.png` (79 KB)
- `848354b9…/brand/logo_ece7d3cc7379b2d3.png` (33 KB)
Motivo PRESERVE: branding studio (favicon + logo).

### 5d · `tenant-assets` (8 files / 11.46 MB) — **2 PRESERVE / 6 CANDIDATE**

🟢 **PRESERVE (2 files / 3.81 MB)** — branding & storefront hero:
- `848354b9…/brand/logo/1779770704608-yawu7d.png` (33 KB)
- `848354b9…/storefront/hero_editorial/1779856322093-d6lgxk.jpeg` (3.79 MB)

🟥 **CANDIDATE CLEANUP (6 files / 7.64 MB)** — atelier media test:
| Path | Size | Motivo |
|---|---|---|
| `atelier-media/848354b9…/a0d510d2-1920.jpg` | 287 KB | test atelier media |
| `atelier-media/848354b9…/a0d510d2-480.jpg` | 28 KB | variante thumbnail |
| `atelier-media/848354b9…/a0d510d2.jpg` | 3.51 MB | original |
| `atelier-media/848354b9…/bca844da-1920.jpg` | 287 KB | duplicato test |
| `atelier-media/848354b9…/bca844da-480.jpg` | 28 KB | variante thumbnail |
| `atelier-media/848354b9…/bca844da.jpg` | 3.51 MB | duplicato original |

### 5e · `storefront-public` (4 files / 3.74 MB) — **TUTTI ORPHAN**
Tutti i 4 file sono sotto `81a09ead-0306-4d71-a5c4-ca2b3956add2/storefront/*`.

⚠️ **Il tenant `81a09ead…` NON esiste più in `public.tenants`** — è un tenant cancellato in precedenza ma i file in storage sono rimasti orfani.

| Path | Size |
|---|---|
| `81a09ead…/storefront/0d60edaf-…-AdobeStock_866570850.jpeg` | 3.66 MB |
| `81a09ead…/storefront/ee319f01-…-Artboard 1.png` | 32 KB |
| `81a09ead…/storefront/f0d9ba99-…-Artboard 1.png` | 32 KB |
| `81a09ead…/storefront/ff1fe78e-…-logo_top_frontend.png` | 15 KB |

### 5f · `media_library` (DB rows) — 81 totali
| Classificazione | Count |
|---|---|
| 🟢 PRESERVE (CMS site/branding) | **71** |
| 🟥 CANDIDATE (inspiration, moodboard, test, NULL) | **10** |

Per categoria:
| Category | Count | Class |
|---|---|---|
| `site` | 46 | preserve |
| `site.home` | 14 | preserve |
| `site.projects` | 3 | preserve |
| `site.magazine` | 3 | preserve |
| `branding` | 2 | preserve |
| `branding_asset` | 1 | preserve |
| `cms_section` | 1 | preserve |
| `inspiration` | 6 | candidate |
| `moodboard` | 2 | candidate |
| `test` | 1 | candidate |
| `<null>` | 2 | candidate |

### 5g · **TOTALI STORAGE** (oggetti fisici)
| | Files | MB |
|---|---|---|
| 🟢 **PRESERVE** | **23** | **21.01** |
| 🟥 **CANDIDATE CLEANUP** | **6** | **7.64** |
| ⚠️ **ORPHAN** (tenant cancellato) | **4** | **3.74** |
| **TOTALE BUCKET** | **33** | **32.39** |

---

## 6 · ELEMENTI STRUTTURALI PRESERVATI (catalogo & runtime)

Catalogi i18n e runtime config — **NON TOCCATI** in nessuno scenario:

| Tabella | Righe | Funzione |
|---|---|---|
| `platform_languages` | 9 | lingue piattaforma |
| `phone_dial_codes` | 196 | prefissi ISO 3166 |
| `markets` | 15 | mercati globali |
| `market_submarkets` | 48 | sotto-mercati |
| `market_cultural_profiles` | 7 | profili culturali |
| `market_narrative_profiles` | 7 | profili narrativi |
| `market_positioning_profiles` | 7 | profili positioning |
| `locale_profiles` | 7 | profili locale |
| `cultural_descriptors` | 29 | descrittori culturali |
| `moodboard_rooms` | 16 | catalogo stanze |
| `moodboard_chapters` | 9 | catalogo capitoli |
| `moodboard_templates` | 11 | template moodboard |
| `lead_intake_questions` | 16 | domande intake form |
| `relationship_questions` | 5 | domande relazionali |
| `relationship_question_groups` | 5 | gruppi domande |
| `relationship_question_options` | 32 | opzioni risposta |
| `relationship_catalog_v1` | 32 | catalogo relazionale |
| `tag_registry` | 42 | tassonomia |
| `media_filter_presets` | 8 | preset filtri media |
| `feature_modules_registry` | 34 | registry moduli feature |
| `platform_feature_defaults` | 1 | default piattaforma |
| `guided_tour_config` | 7 | tour guidati |
| `studio_translation_preferences` | 1 | preferenze traduzione |
| `brands` | 20 | brand registry |
| `brand_collections` | 4 | collezioni brand |
| `supplier_catalogs` | 5 | catalogo fornitori |
| `schema_migrations` | 78 | storia migrazioni |

### Email templates & flow auth — PRESERVATI
- `tenant_settings.email_identity` (studio) → PRESERVE
- `tenant_settings.email_template:space_ready:it` (studio) → PRESERVE
- `tenant_email_settings` (1 record per studio) → PRESERVE
- Flow magic-link Supabase Auth → PRESERVE (codice + config Supabase Auth)
- Resend integration → PRESERVE (variabili .env)

### Tenant config strutturale (solo studio operativo)
| Tabella | Righe (studio) |
|---|---|
| `tenant_settings` | 8 (theme, page.homepage, page.showcase, public_navigation, public_footer, form.design-request, email_identity, email_template:space_ready:it) |
| `tenant_atelier_identity` | 1 |
| `tenant_configuration` | 1 |
| `tenant_email_settings` | 1 |
| `tenant_markets` | 8 |
| `tenant_onboarding` | 1 |
| `tenant_modules` (studio) | 0 (i 14 totali sono sui 5 altri tenant) |

---

## 7 · RISCHI

| # | Rischio | Severità | Mitigazione |
|---|---|---|---|
| R1 | Cancellare `ogriusa@gmail.com` o `ogrisek.stefano@gmail.com` rimuove accessi reali di Stefano | 🟠 ALTA | **Decisione utente esplicita prima del delete** |
| R2 | Cancellare `support@moodfordesign.com` lo rimuove dal dominio reale | 🟡 MEDIA | Decisione utente; in alternativa convertirlo a inbox supporto |
| R3 | Hard delete su `tenants archived` rompe FK su `studio_requests` | 🟡 MEDIA | Mantenere archived (raccomandato); altrimenti `ON DELETE SET NULL` su studio_request |
| R4 | I 4 file orphan in `storefront-public` se conservati continuano a occupare 3.74 MB inutilmente | 🟢 BASSA | Cleanup sicuro (tenant non esiste più) |
| R5 | `audit_logs` (111 rows) contiene tracciabilità ITER171-173: cancellarli perde audit trail | 🟡 MEDIA | Considerare export prima del delete |
| R6 | `editorial_blocks.tenant_id IS NULL` (270 righe platform-level) sembrano "orfani" ma sono globali — non toccarli | 🟢 BASSA | Already PRESERVE list |
| R7 | Cancellare design_journeys senza cascade controllato lascia `journey_milestones` orfani | 🟡 MEDIA | Eseguire cleanup in ordine: messaggi→thread→milestones→briefs→journeys→accounts→contacts→leads |

---

## 8 · "COSA SUCCEDEREBBE SE ESEGUISSIMO IL CLEANUP OGGI"

### Scenario A · "Strict reset" (1 solo tenant, 1 solo utente)

**Eliminerebbe:**
- 🟥 Tenants: **5** (`atelier-p0-final`, `studio-verifica-e2e`, `studio-tenant-lifecycle`, `atelier-lifecycle`, `margraf-usa`) + 11 record `tenant_modules`
- 🟥 auth.users: **8** (5 sintetici + 3 con decisione richiesta inclusi)
- 🟥 users_profile: **8**
- 🟥 Righe dati operazionali: **984** (leads, accounts, contacts, projects, design_journeys, journey_*, relationship_*, magic_links, login_attempts, email_events, funnel_events, ai_assist_logs, audit_logs, configuration_change_events, user_onboarding_state, studio_activation_drafts, studio_requests)
- 🟥 media_library rows: **10** (inspiration + moodboard + test + null)
- 🟥 Storage objects: **10** (6 atelier-media + 4 orphan) ≈ **11.38 MB**

**Preserverebbe:**
- 🟢 Tenant: **1** (`studio`)
- 🟢 auth.users + users_profile: **1** (`admin@moodfordesign.com`)
- 🟢 CMS: 13 pages, 56 sections, 27 revisions, 1156 editorial_blocks, 3224 translations
- 🟢 Catalogi i18n: ~620 record (markets, dial codes, locale profiles, ecc.)
- 🟢 Email templates & identity: intatti
- 🟢 Storage: **23 files / 21.01 MB** (CMS storefront + branding)
- 🟢 Codebase, Supabase Auth, Resend integration: 0 modifiche

### Scenario B · "Conservativo Ring 1" (raccomandato come default)

Stesso di Scenario A **MA**:
- Conserva `margraf-usa` (active, vuoto) → pronto per Ring 1
- Conserva `ogrisek.stefano@gmail.com` (account personale operativo) → ridotto rischio lockout
- **Cancella tutti gli account `support@…`, `ogriusa@…` e i 5 sintetici** (totale 7 auth.users)
- Tenants archiviati: **lasciati come sono** (zero impatto)

Differenza vs Scenario A:
- Tenants eliminati: 0 (vs 5)
- auth.users eliminati: 7 (vs 8)
- Storage liberato: 11.38 MB (uguale)
- Dati operazionali eliminati: 984 (uguale)

### Scenario C · "Light wipe" (solo dati operazionali test)

Cancella SOLO le 984 righe di dati operazionali + 10 media_library rows + 10 storage objects.
**NON tocca** tenants, auth.users, users_profile.
Risultato: l'utente `admin@moodfordesign.com` resta, ma anche tutti gli altri 8 utenti restano "vuoti" (senza lead/account/journey collegati).
> Utile se vuoi mantenere accessibili gli account magic-link reali per test futuri.

---

## 9 · PROSSIMI STEP

⏸️ **STOP**. Nessuna scrittura eseguita. In attesa della tua scelta:

1. **Scenario A · Strict reset** — un solo tenant, un solo utente
2. **Scenario B · Conservativo Ring 1** — `margraf-usa` resta, alcuni account reali restano
3. **Scenario C · Light wipe** — solo 984 righe dati + 10 storage objects, nessuna user/tenant deletion
4. **Custom** — combinazione esplicita per categoria

Per ciascuno scenario, una volta scelto, eseguirò in ordine:
1. **Snapshot JSON di backup completo** (`/app/backups/iter174/pre_cleanup_<ts>.json`) — full dump delle tabelle target
2. **Snapshot counts pre-deletion**
3. **Transaction wrapped DELETE** (single `BEGIN;` … `COMMIT;`)
4. **Storage object DELETE** (solo dopo successo DB transaction)
5. **Smoke test post-cleanup** (endpoint pubblici, login admin, fetch tenant settings, render CMS pages)
6. **Report finale** `ITER174_CLEAN_RESET_REPORT.md`

---

## APPENDICE A · Snapshot JSON
`/app/backups/iter174/dry_run_20260530T232439Z.json` — 89 tabelle non-vuote rilevate · 0 errori schema.

## APPENDICE B · Schema mismatch RISOLTI
- `media_library.kind` ❌ → `media_library.source_kind` ✅ (causa del crash precedente)
- `access_magic_links.email` ❌ → `access_magic_links.email_attempt` ✅
- `accounts.name` ❌ → `accounts.account_name` ✅
- `projects.name` ❌ → `projects.title` ✅
- `tenant_settings.scope` ❌ → solo `key` ✅
- `lead_intake_questions.tenant_id` ❌ → tabella global (no tenant scope) ✅
