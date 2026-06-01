# TENANT LIFECYCLE IMPLEMENTATION AUDIT
## Audit reale del codice — Visitor → Blueprint Access

> **Modalità:** read-only · zero modifiche · solo cosa esiste **realmente** nel codebase
> **Data:** 2026-06-01 · **Reviewer:** Agent E1
> **Tabelle DB ispezionate · 17:** users · accounts · sessions · tenants · tenant_memberships · tenant_onboarding · studio_requests · studio_relations · studio_activation_drafts · studio_relationship_events · studio_team_members · advisor_profiles · advisor_followups · access_magic_links · member_invites · advisor_activation_tokens · tenant_modules

---

## 0 · Verdetto sintetico

> ## 🟡 PARTIAL · 6 di 7 fasi implementate · 1 critica (Qualification) parziale · 0 test E2E lifecycle

| Fase | Doc | Impl | Test | Verdict |
|---|:---:|:---:|:---:|:---:|
| 1. Visitor | ✅ | ✅ | ⚠️ smoke only | **IMPLEMENTED** |
| 2. Studio Activation | ✅ | ✅ | ✅ pytest iter160 | **IMPLEMENTED** |
| 3. Qualification | ⚠️ | ⚠️ | ❌ | **PARTIAL** |
| 4. Advisor Review | ✅ | ✅ | ✅ pytest iter161 | **IMPLEMENTED** |
| 5. Approval / Tenant creation | ✅ | ✅ | ✅ pytest iter161 | **IMPLEMENTED** |
| 6. Founder Invitation (magic link) | ✅ | ✅ | ✅ pytest iter167 | **IMPLEMENTED** |
| 7. Founder Activation + Blueprint Access | ✅ | ✅ | ⚠️ session_i_e2e partial | **IMPLEMENTED** |

**DB live state (post-wipe P0):** `studio_requests=0`, `studio_relations=0`, `users=0`, `accounts=0`, `tenants=6` (test data), `studio_activation_drafts=8` (residui dei test in preview).

---

## 1 · FASE 1 · Visitor → /studio entry

### 1.1 Route
- **`/studio`** → `MovementEntrance` (`corporate/pages/studio/MovementEntrance.jsx`)
- Wrappato da `StudioActivationLayout` (`data-movement="entrance"`)

### 1.2 Componenti
- `MovementEntrance.jsx` (232 righe)
- `StudioActivationLayout.jsx` (chrome editoriale comune)
- Hook `useStudioManifest.js` (legge il manifest + bundle IT defaults locale-aware)

### 1.3 Backend
- `GET /api/studio/activation/manifest?locale={code}` (`routers/studio_activation.py:46`) — ritorna immagini, archetypes, copy_keys + copy risolto da CMS (108 chiavi)

### 1.4 DB
- Nessuna scrittura DB sul Visitor puro (read-only di `editorial_blocks`)

### 1.5 Email
- N/A

### 1.6 Permissions
- Pubblico, no auth richiesta

### 1.7 Stato reale
- ✅ Documentato (`STUDIO_ACTIVATION_LIFECYCLE.md`)
- ✅ Implementato + CMS aggiornato con copy NEW
- ⚠️ Testato: solo screenshot smoke + anti-regression `test_studio_manifest_copy.py`. No test E2E click-through

**Classificazione:** **IMPLEMENTED**

---

## 2 · FASE 2 · Studio Activation (5 movimenti)

### 2.1 Routes
- `/studio` → Entrance (Movement I)
- `/studio/practice` → MovementPractice (Movement II)
- `/studio/ecosystem` → MovementEcosystem (Movement III)
- `/studio/identity` → MovementIdentity (Movement IV)
- `/studio/request` → MovementRequest (Movement V — Submit)

### 2.2 Componenti
| File | Righe | Ruolo |
|---|---:|---|
| `MovementEntrance.jsx` | 232 | Hero + CTA "Inizia la composizione" |
| `MovementPractice.jsx` | (~) | 6 archetypes (atelier, multidisciplinary, materials, …) selectable |
| `MovementEcosystem.jsx` | (~) | 5 experience bands selezionabili |
| `MovementIdentity.jsx` | (~) | Form 13 input: studio_name, monogram, city, country, languages, atelier members, markets, temperament |
| `MovementRequest.jsx` | (~) | Submit + reference display + magic_link prep |
| `useActivationDraft.js` | 136 | Hook per creare/leggere draft via token cookie/localStorage |
| `useStudioManifest.js` | 87 | Manifest IT defaults + CMS merge |

### 2.3 Backend
- `POST   /api/studio/activation/draft` (`studio_activation.py:78`) — crea/recupera draft, ritorna token
- `PATCH  /api/studio/activation/draft` (`studio_activation.py:108`) — patch incrementale (archetype, experiences, payload jsonb)
- `POST   /api/studio/activation/submit` (`studio_activation.py:136`) — converte draft in `studio_requests`

### 2.4 DB
- **`studio_activation_drafts`** — buffer pre-submit, token-based, anonimo. 8 rows attive in preview.
- **`studio_requests`** — record qualificato post-submit. **0 rows** (P0 wipe).
- Riferimento human-friendly `MOOD-XXXX-XXXX` generato da UUID

### 2.5 Email
- N/A in fase 2 stessa
- Il `submit_request` **non invia email** all'utente. Il record finisce nella coda admin per Advisor Review.

### 2.6 Permissions
- Pubblico, draft scoped via token

### 2.7 Stato reale
- ✅ Documentato (canonical + `02_TECH_DESIGN.md`)
- ✅ Implementato (5 movimenti, draft persistence, submit)
- ✅ Testato: `tests/test_iter160_studio_activation.py` (pytest)
- ⚠️ Copy del movimento Entrance è NEW; copy degli altri 4 movimenti è ITER160 V1 (vedi precedente raccomandazione "Studio Activation V2 NOT_STARTED")

**Classificazione:** **IMPLEMENTED** (V1 funzionante, V2 4-movimenti brief non realizzato)

---

## 3 · FASE 3 · Qualification (Studio Request → Triage)

> Questa fase è **ambigua nel codice**: non esiste una "vetrina di triage" qualification separata. La transizione Studio Request → Studio Relation è fatta in un'unica chiamata `open_relation_from_request` da un advisor/admin nello StudioRequestsAdmin.

### 3.1 Route
- `/admin/studio-requests` → `StudioRequestsAdmin.jsx` (lista admin)
- Nessuna route pubblica visibile al visitor per "tracking" del proprio request

### 3.2 Componenti
- `StudioRequestsAdmin.jsx` (301 righe) — lista + filtri + bottone "Apri Relation"

### 3.3 Backend
- `GET   /api/admin/studio/requests` (`admin_studio.py:18`) — lista con filtri status
- `PATCH /api/admin/studio/requests/{id}` (`admin_studio.py:33`) — update status (es. `qualified`, `rejected`)
- `POST  /api/admin/relations/from-request/{id}` (`admin_relations.py:85`) — crea Studio Relation da Request + assegna owner_advisor_id

### 3.4 DB
- `studio_requests.status` → enum (`new`, `qualified`, `rejected`, `activated`)
- `studio_relationship_events` → log delle transizioni
- 0 rows live

### 3.5 Email
- ❌ **Nessuna email automatica** all'utente alla qualifica (né su `qualified` né su `rejected`)
- ❌ Nessuna email all'advisor che riceve un nuovo Studio Request
- ❌ Nessuna notifica Slack/Discord/etc.

### 3.6 Permissions
- `require_advisor_scope` (advisor o super-admin)

### 3.7 Stato reale
- ⚠️ Documentato (vagamente in `STUDIO_ACTIVATION_LIFECYCLE.md`)
- ⚠️ Implementato come "passthrough" advisor: non esiste qualification autonoma, advisor apre directamente la Relation
- ❌ Non testato in isolamento (test_iter161 testa la fase 4 successiva)
- ❌ **MANCANTE: email transazionale "Abbiamo ricevuto la tua candidatura · stiamo verificando · ti risponderemo entro X ore"** — al momento il visitor che fa submit non riceve nessuna conferma email

**Classificazione:** **PARTIAL**

> **Gap operativo critico:** un visitor che fa submit oggi vede SOLO il reference MOOD-XXXX-XXXX sullo schermo. Se chiude il browser, non ha **nessuna prova** di aver candidato lo studio. **Questo è probabilmente il primo gap da chiudere per il lifecycle reale.**

---

## 4 · FASE 4 · Advisor Review

### 4.1 Routes
- `/admin/advisor-console` → `AdvisorConsole.jsx` (overview)
- `/admin/advisor-console/relations/:id` → `RelationDetail.jsx` (relation details + visits + followups + notes)

### 4.2 Componenti
| File | Righe | Ruolo |
|---|---:|---|
| `AdvisorConsole.jsx` | 475 | KPI + relations list + followups queue |
| `RelationDetail.jsx` | 605 | Dettaglio relation + tabs (overview, visits, followups, events) + activate ecosystem CTA |
| `AdvisorsAdmin.jsx` | (?) | CRUD advisors (super-admin) |

### 4.3 Backend (endpoints CRM advisor) — `admin_relations.py`
- `POST    /api/admin/relations/verify-identity` (riga 30) — verifica identity (LinkedIn/email/domain crosscheck)
- `GET     /api/admin/relations` (riga 48) — list scoped by advisor
- `POST    /api/admin/relations` (riga 64) — create relation manualmente
- `POST    /api/admin/relations/from-request/{id}` (riga 85) — promote request → relation
- `GET     /api/admin/relations/{id}` (riga 101)
- `PATCH   /api/admin/relations/{id}` (riga 116) — update status, notes, fields
- `POST    /api/admin/relations/{id}/visits` (riga 140) — log studio visit
- `POST    /api/admin/relations/{id}/followups` (riga 159) — schedule followup
- `PATCH   /api/admin/followups/{id}/complete` (riga 188)
- `GET     /api/admin/advisor/followups` (riga 205) — followups queue per advisor
- `POST    /api/admin/relations/{id}/activate-ecosystem` (riga 219) — **promote → tenant + magic link**
- `GET     /api/admin/advisor/console-summary` (riga 240) — KPI dashboard
- `GET     /api/admin/tenants/{slug}/manifest` (riga 325)

### 4.4 DB
- `studio_relations` (status: `new`, `qualifying`, `activated`, …)
- `studio_relationship_events` — append-only log con `event_type`, `actor_id`, `payload jsonb`
- `studio_visit_reports`
- `advisor_followups`
- `advisor_profiles` — 3 rows live
- `advisor_territories`
- `studio_translation_corrections`

### 4.5 Email
- ❌ Nessuna email automatica all'advisor quando viene assegnata una nuova relation

### 4.6 Permissions
- `require_advisor_scope` con territory scoping (`advisor_crm_scope.py`)

### 4.7 Stato reale
- ✅ Documentato
- ✅ Implementato (CRM advisor completo — visits, followups, events, console, KPI)
- ✅ Testato: `tests/test_iter161_studio_relations.py`

**Classificazione:** **IMPLEMENTED** (CRM advisor robusto)

---

## 5 · FASE 5 · Approval → Tenant creation

### 5.1 Route
- Trigger UI: bottone "Activate Ecosystem" in `/admin/advisor-console/relations/:id` (RelationDetail.jsx)

### 5.2 Backend (key function)
- `POST /api/admin/relations/{id}/activate-ecosystem` → `studio_relations.activate_studio_ecosystem()` (riga 545 di `studio_relations.py`)

Cosa fa (verificato nel codice):
1. Verifica `relation_id`, blocca se `already_activated`
2. Genera `slug` univoco da `studio_name`
3. `INSERT INTO tenants` (status=active, default_language, default_locale_code, active_languages, enabled_modules, branding_settings jsonb, plan_assigned_at, plan_assigned_by, subscription_status, active_plan='studio')
4. `INSERT INTO tenant_modules` (per ogni experience dal relation)
5. `INSERT INTO users` (role='owner', `password_hash='!magic-link-only'`, is_active=true)
6. `UPDATE studio_relations` set tenant_id, status='activated'
7. `UPDATE studio_requests` set status='activated'
8. Log event `relation_activated` in `studio_relationship_events`
9. **Issue magic link** via `access_continuity.issue_magic_link(email=rel.contact_email)`

### 5.3 DB
- `tenants` (6 rows test data live) · `tenant_modules` · `users` (0 live, P0 wipe) · `studio_relationship_events`

### 5.4 Email
- ✅ Magic link email tramite **Resend** (`access_continuity._send_magic_link_email`)
- Sandbox mode quando `RESEND_API_KEY` mancante → log only

### 5.5 Permissions
- `require_advisor_scope`

### 5.6 Stato reale
- ✅ Documentato
- ✅ Implementato (atomico, transazionale, idempotente)
- ✅ Testato: `tests/test_iter161_studio_relations.py`

**Classificazione:** **IMPLEMENTED**

---

## 6 · FASE 6 · Founder Invitation (magic link)

### 6.1 Backend
- `POST /api/auth/magic-link/request` (`auth.py:382`) — re-issue magic link manualmente
- `POST /api/auth/magic-link/consume` (`auth.py:408`) — consume + login (cookie session)
- `services/access_continuity.issue_magic_link()` (riga 149) — hash token, store `access_magic_links`, send Resend email
- `services/access_continuity._send_magic_link_email()` (riga 467) — Resend SDK con `RESEND_API_KEY`, sender da `ACCESS_SENDER_EMAIL`/`ACCESS_SENDER_NAME`, base URL da `ACCESS_LINK_BASE_URL`

### 6.2 Email template
- Definito in `access_continuity._render_email()` (riga 398) — HTML + text body, copy multi-locale via dict
- Copy fields: subject, headline, body, cta, note, signature — hard-coded in Python con multi-locale fallback `{'it': ..., 'en': ...}`

### 6.3 DB
- `access_magic_links` (token_hash, user_id, expires_at, consumed_at, sent_at)
- 0 rows live

### 6.4 Permissions
- Pubblico (rate-limited via `_rate_limit_ok`)

### 6.5 Stato reale
- ✅ Documentato (la fase più documentata di tutte)
- ✅ Implementato + .env configurato per Resend in production
- ✅ Testato: `tests/test_iter167_and_bugs.py`

**Classificazione:** **IMPLEMENTED**

---

## 7 · FASE 7 · Founder Activation + Blueprint Access

### 7.1 Route
- Magic link arrivato via email: `{ACCESS_LINK_BASE_URL}/journey/continue?token={token}`
- Frontend: `AccessContinuityPage.jsx` (consume token, set session cookie)
- Redirect a `/admin/welcome` (`FounderWelcome.jsx`)

### 7.2 Componenti
- `AccessContinuityPage.jsx` — consume + redirect
- `FounderWelcome.jsx` (163 righe) — cinematic "Il tuo ecosistema è pronto" + Tenant Manifest
- `SetPasswordModal.jsx` — set password definitiva (post magic-link, sostituisce `!magic-link-only`)

### 7.3 Backend
- `POST /api/auth/magic-link/consume` → emette JWT cookie session
- `POST /api/auth/set-password` (`auth.py:298`) — set definitive password
- `GET  /api/founder/first-access-state` (`admin_relations.py:436`) — true se `consumed_count <= 1`
- `GET  /api/admin/tenants/{slug}/manifest` — Tenant Manifest per la Welcome page
- `GET  /api/admin/copy/manifest?namespace=admin.founder` — copy editoriale localizzato

### 7.4 DB
- `users.last_login_at`, `users.password_hash` (rimpiazzato post-set)
- `tenant_memberships` — 1 row live
- `tenant_onboarding` — 1 row live

### 7.5 Email
- N/A in fase 7 stessa (l'email è la fase 6)

### 7.6 Permissions
- Bearer JWT (cookie `mood_auth`)
- Tenant scoping via `require_admin_tenant`

### 7.7 Stato reale
- ✅ Documentato
- ✅ Implementato (welcome + first-access-state + set-password)
- ⚠️ Testato: `tests/test_session_i_e2e.py` (parziale, sessions journals scope, non end-to-end lifecycle)

**Classificazione:** **IMPLEMENTED**

---

## 8 · Cosa esiste davvero (sintesi inventario)

| Asset | Conteggio | Stato |
|---|---:|---|
| Backend routers lifecycle | 4 (`studio_activation`, `admin_studio`, `admin_relations`, `auth`) | ✅ |
| Backend endpoints lifecycle | **30** | ✅ |
| Services orchestrators | 4 (`studio_activation`, `studio_relations`, `access_continuity`, `advisor_crm_scope`) | ✅ |
| DB tabelle lifecycle | 14 dedicate + 3 generiche | ✅ |
| Frontend routes lifecycle | 5 public (`/studio*`) + 6 admin (`/admin/*`) | ✅ |
| Frontend componenti lifecycle | 10 (5 Movement + 4 admin pages + chrome) | ✅ |
| Email templates | 1 (magic link, HTML+text+multi-locale) | ✅ |
| Email sender | Resend SDK, .env configured | ✅ |
| Backend pytest tests lifecycle | 5 (`iter160`, `iter161`, `iter167`, `session_i_e2e`, `corporate`) | ⚠️ Parziali |
| Anti-regression tests | 3 (`markets_api`, `no_hardcoded_locales`, `studio_manifest_copy`) | ✅ |
| Live data | 0 user, 0 studio_request, 0 relation, 0 magic_link (post-wipe P0) | ❌ |

---

## 9 · Cosa manca davvero (operativo)

### 9.1 Gap critici per lifecycle reale

| # | Gap | Severità |
|---|---|:---:|
| 1 | **Email di conferma "ricezione candidatura"** al visitor dopo submit. Oggi vede solo reference MOOD-XXXX-XXXX sullo schermo. Nessuna prova in inbox. | 🔴 |
| 2 | **Notifica all'advisor** alla creazione di una nuova `studio_request` (email/Slack). Oggi l'advisor deve fare polling manuale di `/admin/studio-requests`. | 🔴 |
| 3 | **Stato "qualified" / "rejected" → email transazionale al visitor** ("Stiamo proseguendo / Non possiamo proseguire al momento"). | 🟠 |
| 4 | **Pagina pubblica di tracking** request via reference MOOD-XXXX-XXXX (es. `/studio/status/MOOD-XXXX-XXXX`) — opzionale ma utile. | 🟡 |
| 5 | **Test E2E del lifecycle completo** in Playwright/pytest: visitor → submit → advisor open → activate → magic link → set password → admin access. **Esistono i 5 test pytest ma testano fasi singole, non l'intero handshake.** | 🟠 |
| 6 | **DB live state vuoto (P0)**. Senza utenti/requests reali, il lifecycle è eseguibile solo come test, non come flow reale di produzione. | 🔴 |

### 9.2 Gap minori (non bloccanti)

| # | Gap |
|---|---|
| 7 | Copy dei movimenti II-V (Practice/Ecosystem/Identity/Request) non aggiornato a NEW (è ancora ITER160). |
| 8 | `FounderWelcome.jsx` chiama `useEditorialCopy('admin.founder', 'it')` — locale `it` legacy, non BCP-47 `it-IT`. |
| 9 | Nessun retry/queue per Resend email se fallisce — fire-and-forget. |
| 10 | `unsafe test scripts` (`test_iter160_studio_activation.py`, `test_iter167_and_bugs.py`) contengono `DELETE FROM` — gap identificato da audit precedente, ancora aperto. |

---

## 10 · Effort reale per completare il lifecycle (non stime teoriche, ma stime su codice esistente)

### A · Solo per chiudere i 3 gap critici minimi (item 1, 2, 6)
| Task | Stima | Note |
|---|---:|---|
| Email "ricezione candidatura" al visitor post-submit | 1.5h | Nuovo handler in `studio_activation.submit_request` che chiama `access_continuity._send_magic_link_email`-style con template "request_received" |
| Notifica advisor su nuovo `studio_requests` | 1h | Aggiungere email a `assigned_advisor.email` (o admin@) dentro `submit_request` |
| Restore DB operational state (P0) | dipende dai log Supabase | bloccato fino al rilascio log dashboard |
| **Subtotale critici** | **2.5h dev + P0 unblock** | |

### B · Per chiudere TUTTI i gap (item 1-9)
| Task | Stima |
|---|---:|
| 1. Email "ricezione candidatura" | 1.5h |
| 2. Notifica advisor su nuovo request | 1h |
| 3. Email "qualified" / "rejected" al visitor | 2h |
| 4. Pagina pubblica `/studio/status/{reference}` | 3h |
| 5. Test E2E lifecycle completo (Playwright + pytest) | 4-6h |
| 6. P0 DB restore (esterno) | — |
| 7. Copy NEW per Movements II-V | 4-6h (CMS update + screenshot review) |
| 8. BCP-47 audit `useEditorialCopy('admin.founder', 'it')` | 30min |
| 9. Retry/queue Resend email | 2h |
| **Totale gap completi** | **18-22h dev + P0 unblock** |

### C · Per realizzare il brief Studio Activation V2 (4 movimenti completamente nuovi)
| Task | Stima |
|---|---:|
| Refactor Movement Practice → "Identità del Founder" | 6h |
| Refactor Movement Ecosystem → "Progettualità & Ambizione" | 6h |
| Refactor Movement Identity → "Modalità di lavoro" | 6h |
| Refactor Movement Request → "Riconoscimento + Submit cinematografico" | 4h |
| Backend schema changes (nuovi campi su `studio_requests`) | 2h |
| Migration SQL idempotente | 1h |
| Test E2E V2 | 4h |
| **Totale V2 rebuild** | **29-32h dev** |

---

## 11 · Conclusione

> Il lifecycle Tenant Activation è **architettato in modo completo e robusto**: 30 endpoint, 14 tabelle dedicate, 4 services, 5 frontend Movement components, 4 admin console pages, Resend email integration con .env già configurato, anti-regression tests funzionanti.
>
> Il problema **non è strutturale**: il problema è **operativo**:
> 1. Il visitor non riceve email di conferma → la candidatura sembra "evaporata"
> 2. L'advisor non riceve notifica → la candidatura resta invisibile finché non controlla manualmente
> 3. Il DB operational è wiped (P0) → nessun lifecycle eseguibile end-to-end nello stato attuale
>
> **Effort minimo per il primo lifecycle reale funzionante = ~2.5h dev** (chiudendo i 2 gap email critici) **+ sblocco P0 DB** (esterno, awaiting Supabase logs).
>
> **Effort completo (V1 polished, tutte le email, test E2E) = ~18-22h dev** + P0 unblock.
>
> **Effort V2 brief (4 movimenti completamente nuovi) = ~29-32h dev** aggiuntive.

---

*— fine audit lifecycle —*
