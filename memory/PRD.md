# MOOD for DESIGN — Platform PRD

## Project Overview
Multi-tenant editorial SaaS for interior design, architecture firms, showrooms and luxury retailers.
**ONE platform → MULTIPLE frontends → ONE database** architecture, shared Blueprint CMS engine.

**Live tenant:** `mood-corporate` (uuid `51f9ab4d-1aaf-5b8b-b7a9-8a4c8f942a50`)
**Domain:** `www.moodfordesign.com` (mapped via `tenant_domains`)
**Stack:** React + FastAPI + Supabase PostgreSQL + Supabase Storage + Anthropic Claude (AI editorial) + Resend (transactional email)

---

## 🧊 ARCHITECTURAL FREEZE — May 30, 2026

**Direttiva utente (autorità: founder)**: congelati Blueprint Origin™ e Tenant Cloning fino a che Blueprint Tenant non sarà feature-complete.

### Roadmap approvata (in ordine vincolante)

**FASE 1 — Blueprint Tenant feature-complete** (in corso)
- Design Journey™
- CRM
- Leads
- Media Library
- Material Intelligence™
- Moodboards
- Workflow
- Team

**FASE 2 — Studio Application funnel completo** (corporate `/studio`)

**FASE 3 — Definizione ufficiale di Blueprint Origin™**
- Specifica dell'archetipo "tenant blueprint" canonico
- Versionamento
- Manifest di clonazione

**FASE 4 — Tenant Provisioning Engine** (sbloccata solo dopo Fase 3)
- Tenant Factory
- Tenant Cloning da Blueprint Origin™
- Founder automatic routing
- Subdomain provisioning (`martinel.moodfordesign.com`, `format.moodfordesign.com`, `197design.moodfordesign.com`, etc.)

### Vincoli operativi durante il freeze

🛑 **STOP** su qualsiasi sviluppo che tocchi:
- Blueprint Origin™ (template di clonazione)
- Tenant Factory (logica di provisioning automatico)
- Tenant Cloning (duplicazione di tenant)
- Subdomain routing automatico per Founder

✅ **Permesso** durante il freeze:
- Completamento moduli Blueprint Tenant (lista Fase 1)
- Iterazioni sul funnel `/studio`
- Bug fix e refinement su Advisor Lifecycle / Tenant Lifecycle già validati
- Manutenzione email/auth/identity

### Nota architetturale — Founder ≠ Command Center user

Il Founder **NON deve essere considerato utente del Command Center**.

- Oggi (temporaneo): redirect Founder post-magic-link → `/command-center/welcome` → CTA → `/blueprint` (ambiente di test).
- Futuro (post-Fase 4): Founder atterra direttamente sul proprio subdomain (es. `martinel.moodfordesign.com`), il Blueprint runtime del tenant è esposto su quel host, senza passare dal Command Center MOOD.
- `/command-center/welcome` resta SOLO come landing transitoria di onboarding finché il subdomain provisioning non sarà attivo.

---

## Latest session — Mar 01, 2026 (cont.)

### Advisor onboarding — Hybrid auth (magic-link first, then password) ✅ (Mar 01, 2026)

**Problema**: gli advisor erano "magic-link only" (sentinella `!magic-link-only` in `users.password_hash`). Ogni accesso richiedeva controllare la mail, attendere il link, cliccare. Esperienza accettabile per i founder dei tenant (accessi rari), pesante per gli advisor (uso quotidiano interno).

**Soluzione (decisa con l'utente)**: modello **ibrido**.
1. Il super admin crea l'advisor in `/command-center/advisors` (form invariato: nome, email, codice, commissione).
2. Al primo accesso, l'advisor inserisce l'email su `/accedi`. `identity_probe` legge il `password_hash` con sentinella `!` → ritorna `channel=magic_link`. L'advisor riceve il magic-link (oggi sandbox Resend → log backend `MAGIC_LINK_DEV_PREVIEW`).
3. Clicca il link → token consumato → JWT issued → atterra su `/command-center/advisor-console`.
4. `CommandCenterApp` fetcha `/api/auth/me` (nuovo campo `has_password: bool`). Se `false` → monta un **modale bloccante** `SetPasswordModal` (overlay glass `blur(8px)`, non-dismissible, no ESC, no overlay-click).
5. Il modale chiede una password con 4 regole **validate real-time** (indicatori teal con check):
   - Almeno 8 caratteri
   - Almeno una lettera maiuscola
   - Almeno un numero
   - Almeno un carattere speciale
   - + Conferma password che deve coincidere
   - Pulsante submit disabilitato finché tutte le regole + match passano
6. `POST /api/auth/set-password` (Bearer JWT) valida lato server le stesse 4 regole, scrive `bcrypt(password)` in `users.password_hash` (sovrascrive la sentinella).
7. Da quel momento `identity_probe` ritorna `channel=password` per quell'email → form password come canale principale.
8. Il magic-link **resta sempre disponibile** come fallback: sulla password stage di `/accedi` c'è il link secondario **"Prosegui con magic-link"** (richiesta esplicita utente: testo "Prosegui con", non "Accedi con").

**Generalizzazione di `identity_probe`**: prima il `channel=password` era riservato a `role in ('admin','editor')`. Ora viene ritornato per **qualsiasi ruolo** che abbia una password reale (non sentinella `!`). Questo abilita il flusso anche per advisor + future role onboardate via magic-link.

**Files toccati**
- Backend:
  - `services/access_continuity.py.identity_probe` — rimossa restrizione di ruolo per `channel=password`.
  - `routers/auth.py` — `/api/auth/me` ora espone `has_password: bool`. Nuovo `POST /api/auth/set-password` con strength validation (regex Python lato server).
- Frontend:
  - `admin/components/SetPasswordModal.jsx` (NEW) — modale bloccante glass-morph, 4 indicatori real-time, show/hide password, testid completi.
  - `admin/CommandCenterApp.jsx` — fetch `/api/auth/me` su mount, monta modale se `has_password === false`, refetch dopo success.
  - `admin/pages/AdvisorsAdmin.jsx` — helper text aggiornato per descrivere il flusso onboarding.
- DB editorial copy:
  - `site.access.password.helper` aggiornato da "Preferisci un link senza parola d'accesso?…" → **"Prosegui con magic-link"** (5 locales: IT/EN/FR/DE/ES).
  - Seed `db/seed_iter167_access.py` aggiornato per coerenza.

**Verifica E2E (curl + Playwright)**
- `identity-probe(advisor con sentinella)` → `magic_link` ✅
- `identity-probe(advisor con password)` → `password` ✅
- Consume magic-link → JWT `role=advisor` ✅
- `/me` → `has_password: false` ✅
- `POST /set-password {weak}` → 422 con elenco regole mancanti ✅
- `POST /set-password {mismatch}` → 422 "Le due password non coincidono" ✅
- `POST /set-password {valid}` → 200 `{ok:true}` ✅
- `/me` dopo set → `has_password: true` ✅
- `identity-probe` dopo set → `password` ✅
- Login con la nuova password → JWT issued ✅
- Frontend: modale visibile dopo consume del magic-link, regole reagiscono real-time (tutte rosse → tutte verdi al crescere della password), submit attivo solo a regole soddisfatte + conferma match ✅
- Frontend: stage password su `/accedi` mostra link "Prosegui con magic-link" sotto il submit ✅

**Architettura linguistica**: in `users.password_hash`:
- `'!magic-link-only'` → utente ancora in onboarding (advisor creato da admin, founder appena attivato)
- bcrypt hash reale → utente che ha completato l'onboarding e usa password come canale primario
La sentinella `!` (qualsiasi stringa che inizia con `!`) è considerata "no real password" → magic-link channel.

---

### Command Center — Unified Admin Workspace ✅ (Mar 01, 2026)

**Problema**: dopo aver introdotto la separazione `/command-center` (MOOD Core) ≠ `/blueprint` (Tenant CMS), il super admin aveva 2 sidebar separate e doveva saltare tra workspaces per gestire Pages/Blocks/Sections/Media/Footer/SEO/Publishing. Le voci della gestione precedente apparivano "perse".

**Soluzione**: ho mantenuto la regola architetturale "MOOD Core ≠ Blueprint Tenant" ma ho **unificato la superficie operativa del super admin**. Tutte le pagine CMS sono ora montate **anche** sotto `/command-center/*` (le stesse component, no duplicazione). Il workspace `/blueprint/*` resta intatto per i futuri tenant subdomain (founder lo userà sul proprio sottodominio).

**Sidebar admin Command Center** (11 voci, con divisore visivo):

```
─── MOOD Core ───
• Overview          /command-center/overview
• Advisors          /command-center/advisors
• Advisor Console   /command-center/advisor-console
• Studio Requests   /command-center/studio-requests

─── CMS Blueprint ───
• Pagine            /command-center/pages
• Editorial Blocks  /command-center/blocks
• Sections          /command-center/sections
• Media Library     /command-center/media
• Footer            /command-center/footer
• SEO & Indexing    /command-center/seo
• Publishing        /command-center/publish
```

**Sidebar advisor** (invariata, 2 voci): Advisor Console · Studio Requests.

**Files toccati**:
- `CommandCenterApp.jsx` — 7 nuove route CMS + sidebar admin estesa con `group: 'core'|'cms'`.
- `shared/WorkspaceShell.jsx` — supporto divisore visivo tra gruppi nella sidebar (hairline 1px rgba 0.06).
- `AdminApp.jsx` (LegacyAdminRedirect) — `/admin/pages|blocks|...` ora redirige a `/command-center/<path>` (non più `/blueprint/<path>`). Bookmark legacy restano funzionanti.

**Verifica visiva**:
- Admin atterra su `/command-center/overview` con tutte le 11 voci visibili.
- Click "Pagine" → carica `PagesEditor` con tutte le funzionalità precedenti (locale switcher, edit, preview).
- Click "Editorial Blocks" → `BlocksEditor` funzionante.
- Cross-link `/blueprint` rimosso dalla sidebar admin (era ridondante).

**Regola architetturale finale**:
- `/command-center/*` = workspace operativo del super admin di MOOD (tutto in un posto solo) + console scoped per advisor + landing founder.
- `/blueprint/*` = workspace dedicato per i futuri tenant founder (oggi monta gli stessi component CMS, ma scopato per il loro tenant via JWT slug).
- `/admin/*` = redirect permanente bookmark-safe.

---

## Earlier in session — Mar 01, 2026

### Command Center — Admin governance shell completata ✅ (Mar 01, 2026)

**Problema**: la login a `/command-center` autenticava correttamente admin/advisor, ma il Super Admin non aveva accesso operativo a:
- Gestione Advisor (creazione, attivazione/disattivazione)
- CMS Blueprint (pagine, blocks, sections, media, footer, SEO, publish)

L'Overview era read-only. Mancavano i link operativi.

**Soluzione**:
- Backend: 3 nuovi endpoint super-admin in `routers/admin_relations.py`:
  - `GET  /api/admin/advisors` → lista advisor con KPI per profilo (status, commission, relations_count, last_login)
  - `POST /api/admin/advisors` → crea/aggiorna advisor (users role=advisor + advisor_profiles, idempotente su email)
  - `PATCH /api/admin/advisors/{profile_id}` → attiva/disattiva, aggiorna commissione
- Frontend: nuova pagina `pages/AdvisorsAdmin.jsx`:
  - Form editoriale "Apri un canale" (Nome, Email, Codice opzionale auto-generato, Commissione %)
  - Tabella "Registro Advisor" con status pill teal/coral, ultimo accesso, # relazioni, toggle Disattiva/Riattiva
  - Tono curatoriale (Playfair + Montserrat + Inter)
- Sidebar admin in `CommandCenterApp.jsx` espansa a 5 voci:
  - Overview · **Advisors** (NEW) · Advisor Console · Studio Requests · **Blueprint · CMS** (NEW link cross-namespace a `/blueprint`)
- React route `/command-center/advisors` protetta da `SuperAdminOnly` (advisor → redirect a `/advisor-console`, founder → redirect a `/blueprint`).

**Flusso operativo admin** (verificato curl + screenshot):
1. Admin login → `/command-center/overview` (governance globale, KPI, tabelle read-only).
2. Click "Advisors" sidebar → form di creazione.
3. Inserisce Nome + Email + (opz) Codice + Commissione % → POST `/api/admin/advisors` → crea identità centrale (users role=advisor + advisor_profiles).
4. Nuovo advisor appare nella tabella, può immediatamente fare `/accedi` con magic-link (identity-probe → `magic_link`).
5. Click "Advisor Console" sidebar → vista cross-advisor.
6. Click "Blueprint · CMS" sidebar → cross-namespace verso il workspace CMS tenant.

**Test curl-verified**: admin crea "Marco Bianchi" → identity-probe ritorna `magic_link` → JWT con role=advisor → scoping E2E intatto.

**Files modificati**
- Backend: `routers/admin_relations.py` (+220 righe per 3 endpoint advisor).
- Frontend: `pages/AdvisorsAdmin.jsx` (NEW), `CommandCenterApp.jsx` (sidebar + route), `adminApi.js` (3 helpers).

---

## Earlier in session — Mar 01, 2026

### `/studio` Funnel Performance + Image Hardening ✅ (Mar 01, 2026)

**P0**
- **Studio images decoupled from Supabase**: 7 editorial SVG posters in `/app/frontend/public/static/studio/` (entrance + 6 archetypes). Backend `studio_activation.py.manifest()` ora punta a `/static/studio/*.svg`. Bucket Supabase non più dipendenza per il funnel. Tutti i file sono sostituibili 1:1 (stesso filename) quando l'utente vorrà caricare foto curate.
- **Hero fallback in `MovementEntrance.jsx`**: 3 strati ora — (1) poster gradient teal-emerald **sempre presente** (mai sfondo nero), (2) foto hero che fade-in sopra il poster, (3) vignetta cinematografica. Aggiunto `onError` handler: se l'immagine fallisce, `setImgFailed(true)` + `setImgLoaded(true)` → il poster resta visibile come fondo finale (zero stati vuoti).
- **CTA Header riallineato al funnel**: aggiunto nuovo item `studio_open` in `cms_sections.navigation` posizionato come ultimo `right` (filled teal pill). Label "Apri uno Studio" (IT) · "Open a Studio" (EN) · "Ouvrir un Studio" · "Studio eröffnen" · "Abrir un Studio". Href `/studio`. "Accedi" rimane outlined teal per advisor/founder/admin che già hanno accesso.

**P1**
- **Manifest cache**: nuovo strato in `routers/studio_activation.py.get_manifest` con in-process cache 60s TTL + ETag (sha256 first 16 hex) + `Cache-Control: public, max-age=60, stale-while-revalidate=300`. Conditional GET `If-None-Match` → 304 vuoto. **Tempo warm**: da 1.10s a 0.12s (-89%). **Tempo 304**: 0.08s.
- **Draft lazy creation**: `useActivationDraft.js` riscritto. Su mount: solo resume se `mood_studio_draft_token` esiste in localStorage. Niente POST automatico. Prima chiamata `patch()` (es. al click CTA "Inizia la composizione") crea la draft on-demand via `ensureDraft()`. Visitatori che non compongono non toccano più il backend per la draft (-1 richiesta).
- **Decoupling text da animation gate**: classe `studio-rise` ora applicata solo quando `manifestReady` (non più `manifestReady && draftReady`). Il testo è già visibile via default opacity, l'animazione è enhancement non blocco.

**Benchmark prima/dopo (preview, fresh visitor, dev mode)**

| Metrica | Prima | Dopo | Delta |
|---|---|---|---|
| TTFB | 69 ms | 154 ms | +85 ms (variazione naturale) |
| First Contentful Paint | 296 ms | 297 ms | invariato |
| Eyebrow visibile (testid) | 2.60 s | **0.36 s** | **-86%** |
| Headline visibile (testid) | n/a | **0.38 s** | nuovo |
| NetworkIdle (complete) | 3.20 s | **1.09 s** | **-66%** |
| Image failures (4xx) | 7 (bucket Supabase) | **0** | **-100%** |
| API calls (fresh visitor) | 6 (3 unique × 2 StrictMode) | 4 (2 unique × 2 StrictMode) | -33% |
| POST /draft on entrance load | sì (sempre) | **no** (solo on CTA click) | rimosso |
| Manifest warm latency | 1.10 s | **0.12 s** | -89% |
| Sfondo nero vuoto | persistente | **mai** | risolto |

**Files modificati**
- Frontend: `pages/studio/MovementEntrance.jsx`, `pages/studio/useActivationDraft.js`, `components/CorporateNav.jsx`, `public/static/studio/*.svg` (7 nuovi).
- Backend: `routers/studio_activation.py`, `services/studio_activation.py`.
- DB: `cms_sections.navigation` settings ampliata con nuovo item + `editorial_blocks` per label `site.nav.studio_open.label` (5 traduzioni IT/EN-US/EN-UK/FR/DE/ES).

---

## Earlier in session — Mar 01, 2026

### Chunk 2 completion — Super Admin Overview + Role-aware Workspace ✅ (Mar 01, 2026)

**Problem solved**: previously both admin and advisor landed on `/command-center/advisor-console`. The advisor console is a scoped read of the viewer's own dossier — wrong default for super admin who needs governance breadth.

**Architecture delivered**:
- `/command-center/overview` (NEW) — Super Admin governance dashboard:
  - 8 KPI cards: Advisor in dialogo · Relazioni nell'orbitale · Conversazioni vive · Ecosistemi attivati · Introduzioni ricevute · Da assegnare · Ricorrente in osservazione · Setup in osservazione
  - Table: Advisors (per-advisor counts of active/activated/requests + commission %)
  - Table: Studio Relations (cross-advisor, latest 50 by signal date)
  - Table: Studio Requests (latest 50 with assignment status)
  - Table: Activated Tenants (with Manifest link per tenant)
- `/command-center/advisor-console` — scoped advisor view (unchanged behaviour).
- Role-aware sidebar:
  - admin/editor → Overview · Advisor Console · Studio Requests
  - advisor      → Advisor Console · Studio Requests
- Role-aware redirect:
  - admin/editor on `/command-center` → `/overview`
  - advisor on `/command-center`      → `/advisor-console`
  - founder (owner) on `/command-center` → `/blueprint`
- React guards `SuperAdminOnly` + `NotFounder` reject advisors from Overview (redirect to advisor-console) and founders from any Command Center page (redirect to Blueprint).

**Backend**:
- `GET /api/admin/command/overview` — aggregated payload `{kpi, advisors, relations, studio_requests, activated_tenants}`. Returns 403 to non-super-admin (verified curl).
- `tenant_redirect_for` updated: admin/editor → `/command-center/overview`, advisor → `/command-center/advisor-console`, owner → `/command-center/welcome`.
- `/api/admin/site/whoami` rewired to `require_advisor_scope` so all roles (admin/editor/advisor/owner) can authenticate the shell. CMS-write endpoints remain restricted to `require_admin_tenant` (admin/owner/editor only — advisor cannot touch CMS).
- `/api/admin/copy/manifest` permissive guard (read-only editorial copy is non-sensitive).

**Translation seed** `command.overview.*` (62 keys IT) — zero hardcoded strings in CommandOverview.jsx.

**Founder Journey verified**:
- Magic-link consume for `tlc2-founder@test.example` → JWT role=owner, redirect `/command-center/welcome`.
- Welcome screen renders: monogram AL · "Il tuo ecosistema è pronto" · founder name · advisor · esperienze attivate · CTA "Entra nello Studio" → `/blueprint`.
- Founder trying `/command-center/overview` or `/advisor-console` → React redirect to `/blueprint` (verified via `NotFounder` guard).

**Files touched**:
- Frontend: `App.js`, `AdminApp.jsx`, `CommandCenterApp.jsx`, `pages/CommandOverview.jsx` (NEW), `pages/FounderWelcome.jsx`, `adminApi.js`.
- Backend: `routers/auth.py`, `routers/admin_relations.py`, `routers/admin_site.py`, `routers/_advisor_scope.py`.
- DB: seed `db/seed_command_overview.py` (NEW).

---

## Earlier in session — Mar 01, 2026

### MOOD Advisor Program™ · Chunk 1+2 — Route separation + Advisor scoping ✅ (Mar 01, 2026)

**Architectural rule enforced**: `MOOD Core ≠ Blueprint Tenant`. The Advisor Program lives in MOOD Core (`/command-center`), not inside the tenant Blueprint.

**Chunk 1 — Route Separation**
- New shells under `/app/frontend/src/admin/`:
  - `shared/WorkspaceShell.jsx` — shared chrome (header, sidebar, logout, cache, view-site).
  - `CommandCenterApp.jsx` (`/command-center/*`) — MOOD Core: Advisor Console + Studio Requests + Founder Welcome (`/command-center/welcome`).
  - `BlueprintApp.jsx` (`/blueprint/*`) — Tenant runtime CMS: Pagine · Editorial Blocks · Sections · Media · Footer · SEO · Publishing.
  - `AdminApp.jsx` rewritten as `LegacyAdminRedirect` — `/admin/*` is now permanently redirected: founder welcome → `/command-center/welcome`, blueprint paths → `/blueprint/*`, MOOD Core paths → `/command-center/*`. Bookmark-safe (tail + query string preserved).
- `App.js` mounts 4 routes: `/command-center/*`, `/blueprint/*`, `/admin/*` (legacy), `/*` (corporate).
- Backend `routers/auth.py.tenant_redirect_for`:
  - role=`owner` → `/command-center/welcome`
  - role=`admin/editor/advisor` → `/command-center`
  - else → `/`
- 12+ internal links updated: AdvisorConsole (4×), RelationDetail (2×), FounderWelcome CTA → `/blueprint`, LoginHero fallback, AccessContinuityPage (3 fallbacks).
- SEO posture: `robots.txt` adds `Disallow: /command-center` + `Disallow: /blueprint`. SearchConsoleHelper updates UI label.
- Test backend: `test_iter167_and_bugs.py:279` updated to assert `redirect_url == "/command-center"`.
- **Smoke verified**: `/command-center` shows "MOOD · COMMAND CENTER" login. `/blueprint` shows "BLUEPRINT · TENANT" login. `/admin/advisor-console` 301-redirects to `/command-center/advisor-console`. Post-login admin → `/command-center/advisor-console` with only MOOD Core nav. Post-login same admin on `/blueprint` → 7-item CMS nav.

**Chunk 2 — Advisor Identity & Scoping**
- Migration `024_mood_core_advisor_identity.sql`:
  - **Backup logico** of 4 orphan tables (zero rows, zero Python references) into `*_archive` companions: `advisor_referrals`, `advisor_commission_periods`, `advisor_activity_months`, `advisor_reports`.
  - DROP the 4 orphan tables.
  - ALTER `advisor_profiles` ADD `user_id` FK to `users(id)` ON DELETE SET NULL, UNIQUE partial index, status index.
- Seed `seed_advisor_identity.py` (idempotent): links every `advisor_profiles` row to a central `users` row on tenant `studio` with `role='advisor'`, `password_hash='!magic-link-only'`. Creates the row if missing. Currently linked: Raffaella (ADV-80A9C5).
- New helper `routers/_advisor_scope.py.require_advisor_scope`:
  - Accepts Bearer JWT (admin/editor/advisor/owner) or X-Admin-Key (dev).
  - Returns `{role, is_super_admin, advisor_id (=users.id), user_id, email, tenant}`.
  - **Identity model**: `studio_requests.assigned_advisor_id` / `studio_relations.owner_advisor_id` / `advisor_followups.advisor_id` all FK → `users(id)`. So the canonical advisor identifier is `users.id`. `advisor_profiles` is metadata (commission %, territory, code).
  - Advisor without active `advisor_profiles` → 403.
- `routers/admin_relations.py` — 9 endpoints rewired to `require_advisor_scope`:
  - `GET /relations`: advisor sees only own (filter forced).
  - `POST /relations` + `POST /relations/from-request/{id}`: advisor self-claims ownership.
  - `GET /relations/{id}`: advisor 404 on other's relation (no leak).
  - `PATCH /relations/{id}`: advisor must own; cannot reassign ownership.
  - `POST /relations/{id}/visits`, `POST /relations/{id}/followups`, `POST /relations/{id}/activate-ecosystem`: advisor must own.
  - `PATCH /followups/{id}/complete`, `GET /advisor/followups`: advisor scoped to self.
  - `GET /advisor/console-summary`: aggregate filtered by owner; pending introductions visible = own + unassigned (not other advisors' assigned).
- `routers/admin_studio.py` — 2 endpoints rewired:
  - `GET /admin/studio/requests`: advisor sees own + unassigned (visibility rule approved).
  - `PATCH /admin/studio/requests/{id}`: advisor cannot edit another advisor's assigned request; editing an unassigned request triggers **auto self-claim** via `COALESCE(assigned_advisor_id, advisor_id)`.
- `services/studio_activation.py`:
  - `list_requests` extended with `advisor_visibility_id` (own + unassigned filter).
  - `update_request_status` accepts `assigned_advisor_id` (self-claim).
  - New `get_request(request_id)` for guard pre-checks.
  - Serialization adds `assigned_advisor_id` to API response.
- **Validation** (curl-tested E2E with 2 advisor users + 1 admin):
  - identity-probe(raffaella@) → `magic_link` ✅
  - magic-link consume → JWT role=`advisor`, redirect=`/command-center` ✅
  - list_relations admin → 4 rows; advisor → 0 rows (none owned) ✅
  - studio_requests admin → 5; Raffaella → 5 (4 unassigned + 1 self-claimed); Second Advisor → 4 (Raffaella's hidden) ✅
  - PATCH unassigned by advisor → auto-assigns to advisor (verified in DB) ✅
  - Anonymous → 401 ✅
- Test artifact for next chunks: 4 orphan tables backed up; 1 active advisor user (Raffaella) linked; super admin (admin@) keeps full access.

**STATUS**: Chunk 1 + Chunk 2 complete & verified. Waiting for user E2E test before proceeding to Chunk 3+ (Commercial Terms, Tenant Payments, Advisor Commissions, Advisor Payouts).

---

## Previous session — Mar 01, 2026

### B2B Identity Hardening — `private_client` removed from central probe ✅ (Mar 01, 2026)
- **Regola architetturale**: MOOD è esclusivamente B2B. `private_client` è un dato del CRM del tenant (tabella `accounts`), NON un'identità centrale.
- **`services/access_continuity.py.identity_probe()`** — rimosso interamente lo Step 2 che leggeva `accounts.account_type='private_client'` e auto-provisionava una riga `users` con `role='client'` + sentinel `!magic-link-only`. Docstring riscritto, numerazione step compattata (3 step: users → studio_requests → concierge).
- **Cleanup DB**: rimosso 1 utente provvisorio (`ogriusa@gmail.com`) creato da Step 2 in passato + 2 magic_links pendenti. La tabella `accounts` (5 `private_client`) preservata intatta.
- **Verifica**: 8/8 scenari `/api/auth/identity-probe` PASS — Admin→password, Founder→magic_link (×2), StudioPending→studio_pending, UnknownEmail→concierge, PrivateClient→concierge (×3). Zero enumeration leak: email private_client e email sconosciute restituiscono lo stesso shape `{channel:"concierge", display_name:null}`.
- **Pending utente**: test reale E2E Tenant Lifecycle (Application → Review → Advisor Console → Open Ecosystem → Founder Invitation → Founder First Access).

---

## Previous session — Feb 28, 2026

### Finalization & Deploy Phase ✅ (Feb 28, 2026)
**Feature freeze**. Solo hardening, security audit, deploy preparation.

- **Security audit completo**: 9/9 endpoint admin (`/api/admin/relations`, `/admin/copy/manifest`, `/admin/advisor/console-summary`, `/admin/studio/requests`, `/admin/site/blocks`, `/admin/site/pages`, `/admin/relations/verify-identity`, `/admin/relations`, `/admin/site/media/upload`) rifiutano richieste anonime + chiavi sbagliate (401). Endpoint pubblici (`/site/pages`, `/site/navigation`, `/site/footer`, `/site/sitemap.xml`, `/site/legal-strip`) rispondono regolarmente (200). Public studio activation draft (`/studio/activation/draft`) consente sessioni anonime per design (resume invisibile).
- **Auth hardening — JWT-only production posture**:
  - `adminApi.js` ora supporta JWT bearer (preferito) + X-Admin-Key (fallback dev). Headers helper invia Bearer se token presente.
  - `AdminLogin` ora ha email/password come primario (chiamata a `/api/auth/login`), tenant picker se l'utente esiste su più tenant, toggle "Accesso legacy" collassabile per X-Admin-Key (solo dev preview).
  - Production env deve omettere `ADMIN_API_KEY` per disabilitare automaticamente il fallback. Verificato via curl: `GET /api/admin/advisor/console-summary` con solo Bearer JWT → 200.
- **`.env` posture**:
  - `RESEND_API_KEY="re_sandbox_placeholder"` — mantenuto in sandbox stub per primo testing reale interno (Magic Link loggano come `MAGIC_LINK_DEV_PREVIEW`).
  - `ACCESS_SENDER_EMAIL="journey@moodfordesign.com"` — architectural reference per quando Resend production sarà configurato.
  - `ACCESS_SENDER_NAME="MOOD for DESIGN"`.
  - `ACCESS_LINK_BASE_URL` punta al preview; deve essere aggiornato a `https://www.moodfordesign.com` al deploy.
  - `ADMIN_API_KEY="dev"` — preview only; **production deploy MUST omit this variable**.
- **Mobile smoke**: home `/`, `/studio`, `/accedi` renderizzano senza overflow orizzontale; typography editorial scala correttamente.
- **Frontend cleanup**: zero `console.log`/`debugger`. Lint pulito. Legacy `LoginPage.jsx` non più routed; `LoginHero.jsx` rimane come section type DB-driven per la pagina `login` nel CMS.
- **Test creds aggiornate**: `/app/memory/test_credentials.md` documenta entrambi i path (JWT primario, X-Admin-Key legacy).
- **Deployment_agent**: tutti i check tecnici (compilation, env, frontend/backend URLs in env-only, CORS) sono PASS. L'agent ha flaggato "PostgreSQL non supportato da Emergent" — falso positivo: MOOD usa Supabase PostgreSQL **esterno** (`DATABASE_URL` punta a Supabase pooler), pattern perfettamente supportato.

### Production Env Checklist (per il deploy)
Le seguenti variabili devono essere configurate sull'istanza production:
- `MONGO_URL` — può rimanere `mongodb://localhost:27017` (vestigial — solo per /api/status legacy endpoint)
- `DB_NAME` — può rimanere `test_database` (legacy)
- `DATABASE_URL` — Supabase Transaction Pooler URL (già configurato)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (già configurati)
- `JWT_SECRET` — generare nuovo per production
- `EMERGENT_LLM_KEY` (già configurato)
- `AI_DEFAULT_PROVIDER=anthropic`, `AI_DEFAULT_MODEL=claude-sonnet-4-5-20250929`
- `CORPORATE_TENANT_SLUG=studio`
- `RESEND_API_KEY="re_sandbox_placeholder"` — mantenere sandbox per primo deploy
- `ACCESS_SENDER_EMAIL="journey@moodfordesign.com"`
- `ACCESS_SENDER_NAME="MOOD for DESIGN"`
- `ACCESS_LINK_BASE_URL="https://www.moodfordesign.com"` — **da aggiornare al deploy**
- `ADMIN_API_KEY` — **NON impostare in production** (JWT-only)
- `CORS_ORIGINS="*"` (oppure restringere a `https://www.moodfordesign.com,https://moodfordesign.com`)

---

### ITER161 Phase 1 — Studio Relations & Advisor Governance™ ✅ (Feb 28, 2026)
- **Vision**: NOT a CRM. A curatorial relational infrastructure. Private-banking aesthetic. Zero sales/lead/pipeline vocabulary anywhere.
- **DB**: 5 new tables (migration `023_iter161_studio_relations.sql`):
  - `studio_relations` — living relationship between advisor and studio. Status enum: prospect | under_review | contacted | presentation_scheduled | presented | qualified | proposal | activated | not_aligned | archived. Temperature: cold | warm | strong | ready.
  - `studio_visit_reports` — curatorial assessment with 8 rating dimensions (0–5): workflow_maturity, showroom_quality, material_culture, design_journey_alignment, client_experience_maturity, international_readiness, digital_readiness, operational_complexity. Plus atmosphere_observed, opportunities, objections.
  - `advisor_followups` — gentle reminders (call | email | visit | demo | internal_review | activation | proposal).
  - `advisor_commission_rules` — Advisory Value rules per advisor/market/archetype.
  - `studio_relationship_events` — narrative timeline (relation_opened, contact_made, visit_recorded, status_changed, ownership_changed, activated…).
- **Service** `services/studio_relations.py`:
  - `verify_studio_identity()` — the **Identity Verification Layer™**. Curatorial duplicate/network match check across tenants + studio_relations + studio_requests. Returns verdict (clear | possible_match | existing_relation | active_tenant) with confidence-scored matches. Never raises (fail-soft).
  - `open_relation_from_request()` / `create_relation_manually()` — both initialize advisor ownership + 120-day protection window.
  - `list_relations()`, `get_relation()` (returns events/visits/followups), `update_relation()` (logs timeline events on status/temperature/ownership changes).
  - `create_visit_report()`, `create_followup()` / `complete_followup()`, `list_followups_for_advisor()` (buckets: overdue/today/this_week/scheduled).
  - `activate_studio_ecosystem()` — **the only path to tenant creation in MOOD**. Creates tenants row + tenant_modules from selected experiences + founder user (`!magic-link-only` password sentinel since auth is magic-link) + issues Resend Magic Link.
- **Router** `routers/admin_relations.py` (all admin-guarded):
  - `POST /api/admin/relations/verify-identity`
  - `GET/POST /api/admin/relations` + `POST /api/admin/relations/from-request/{id}`
  - `GET/PATCH /api/admin/relations/{id}` + `POST /admin/relations/{id}/visits` + `POST /admin/relations/{id}/followups`
  - `PATCH /api/admin/followups/{id}/complete`
  - `GET /api/admin/advisor/followups?advisor_id=…` + `GET /api/admin/advisor/console-summary`
  - `POST /api/admin/relations/{id}/activate-ecosystem`
  - `GET /api/admin/copy/manifest?namespace=…&locale=…` — resolves an entire editorial namespace in one call.
- **Editorial copy seed** `seed_iter161_studio_relations.py` — 162 IT blocks under `admin.studioRelations.*`. Curatorial vocabulary throughout:
  - Status labels: "Allineamento editoriale" (qualified), "Ecosistema attivato" (activated), "Presentazione consegnata".
  - Temperature: "In ascolto" / "In dialogo" / "In allineamento" / "Pronto all'apertura".
  - Sections: "Cartella curatoriale" (timeline), "Advisory Value in osservazione", "Provenienza dello studio" (identity verification), "Apri l'Ecosistema dello Studio" (activation).
- **Frontend**:
  - `pages/AdvisorConsole.jsx` (`/admin/advisor-console`) — editorial dashboard: hero (italic Playfair sublead), 4-cell summary strip with hairline dividers + Advisory Value strip (italic monetary values), Pending Introductions list with "Apri la lettura" action, Studio Relations table with 5 filter chips + new-relation drawer.
  - `pages/RelationDetail.jsx` — full dossier: provenance header, status + temperature pickers (calm dots, no red), advisor notes + next-action input, **curatorial timeline** (dossier-style), Advisory Value panel (italic numeric inputs), follow-ups list, visit reports list with atmosphere quotes, conditional "Apri l'Ecosistema dello Studio" CTA.
  - `components/IdentityVerificationCard.jsx` — debounced (260ms) probe in the new-relation drawer. Soft states with confidence levels. Provenance label + per-match line with score → "Risonanza alta/media/lieve", status, "Apri la relazione esistente" CTA. **Never** uses red alerts.
  - `components/VisitReportForm.jsx` — magazine-style curatorial assessment: atmosphere textarea (italic Playfair), 8 rating rows with 0–5 pill picker, opportunities/objections/competitors/next-step blocks, Advisory Value triple (monthly/setup/probability).
  - `components/OpenEcosystemFlow.jsx` — the **sacred moment** in 3 phases: Review (studio · archetype · experiences · founder) → Activating (spinner) → Confirmation ("L'ecosistema è aperto.") with tenant slug + return CTA.
  - `utils/useEditorialCopy.js` — fetches namespace manifest, returns `t(key, fallback)` with locale fallback chain.
  - `utils/consoleTokens.js` — shared design tokens (bg #08090C, teal #00C9B3, hair rgba 0.06, typography preset constants).
- **AdminApp**: nav reordered to expose Advisor Console between Footer and Studio Requests. Padding-edge-to-edge on advisor routes.

### Validation (Iteration 6)
- **Backend**: 16/16 pytest tests green (auth guards, copy manifest 162 IT keys + curatorial vocabulary check, verify-identity clear→existing_relation transition, full CRUD + visit + followup complete, console-summary shape, activate-ecosystem returning {tenant_id, slug, founder_user_id, magic_link_sent}).
- **Frontend**: All editorial Italian copy resolves correctly; status pickers display "Allineamento editoriale" / "Ecosistema attivato" / "In dialogo". **Zero CRM vocabulary anywhere** (sweep clean). Filter chips, summary strip, drawer, IdentityVerificationCard, RelationDetail all functional.
- **Minor polish applied**: pending-list testid in empty state, loading skeleton on RelationDetail first paint, IdentityVerificationCard debounce shortened to 260ms.

---

### ITER160 Phase 2 — Full /studio Flow + Studio Requests ✅ (Feb 28, 2026)
- **Reframed**: the flow is NOT a SaaS signup or activation. It is a **Guided Introduction Request** — the studio composes its profile, a MOOD Advisor follows up manually. No checkout, no plan selection, no auto-tenant creation.
- **New DB table** `studio_requests` (migration `022_iter160_studio_requests.sql`) — captures archetype, experiences, identity payload, contact, locale, source, status (`received` | `reviewing` | `contacted` | `qualified` | `not_aligned` | `activated`), advisor_notes, reviewed_at, assigned_advisor_id.
- **Service** extensions in `studio_activation.py`:
  - `manifest_with_copy(locale)` — bundles all 108 editorial keys pre-resolved in ONE call (was firing 108 parallel /api/site/block requests).
  - `submit_request()` — converts draft → studio_requests row + returns a friendly `MOOD-XXXX-XXXX` reference. Validates email softly (concierge tone, no 4xx).
  - `list_requests()` + `update_request_status()` for advisor workflow.
- **Endpoints**:
  - `POST /api/studio/activation/submit` (public, fail-soft)
  - `GET  /api/admin/studio/requests` (admin-guarded)
  - `PATCH /api/admin/studio/requests/{id}` (status + advisor_notes)
- **Editorial copy seed** `seed_iter160_studio_phase2.py` — 83 new IT blocks under `studio.activation.*` covering Movements III/IV/V + markets + roles + languages + temperaments + experiences. Total namespace now 108 keys × IT.
- **Frontend** completed all 5 movements:
  - `MovementEcosystem.jsx` — 5 horizontal editorial bands with archetype-driven pre-suggestion (`Material Intelligence — inclusa nella tua composizione`).
  - `MovementIdentity.jsx` — vertical magazine-style form: studio name (Playfair 1.6rem), monogram (centered 1.8rem serif), city + country, languages (chip row), atelier (1–8 members), markets (9 chips), temperament (3 cards Quieto/Composto/Vivido), contact (name, role, email, phone prefix+number, website, notes). Underline-only inputs, NO boxes, autosave on blur with `Composto.` italic confirmation.
  - `MovementRequest.jsx` — `/studio/request` final reception screen with reference badge `MOOD-XXXX-XXXX`. Tone: "La tua composizione è stata ricevuta. Un MOOD Advisor leggerà il profilo del vostro studio e vi contatterà per continuare la conversazione."
- **Admin page** `StudioRequestsAdmin.jsx` mounted at `/admin/studio-requests` — magazine-style cards with status filter chips, status dropdown, advisor-notes textarea, studio composition snapshot (3-column cell grid).

### Security hardening
- **`require_admin_tenant`** rewritten — was permitting anonymous when `ADMIN_API_KEY` env was unset (silent open-door). Now strictly requires either:
  - `Authorization: Bearer <jwt>` with role admin/owner/editor, OR
  - `X-Admin-Key: <key>` matching `ADMIN_API_KEY` env (set to `dev` in preview).
  Anonymous + wrong-key both return 401. Verified by testing agent and curl.

### Validation (Iteration 5)
- **Backend**: 19/19 pytest tests pass. Auth matrix verified: no-auth 401, wrong-key 401, key=dev 200, Bearer JWT 200. Full submit flow returns `MOOD-XXXX-XXXX` reference.
- **Frontend**: ecosystem pre-suggestion verified for all 3 sentinel archetypes. Movement IV chip labels render Italian editorial copy correctly (Residenziale privato, Italiano, English, Quieto/Composto/Vivido). Zero-jargon sweep CLEAN.

---

### ITER160 Phase 1 — Studio Activation Onboarding Flow ✅ (Feb 28, 2026)
- **Architectural decision**: established the two-layer relational architecture (Tenant Layer vs Client Layer). ITER160 lives strictly in the tenant layer; the client layer is deferred to ITER180+. Full PRD canonicalized in `/app/memory/ITER160_PRD.md` (15 sections, ~10k words).
- **DB**: `studio_activation_drafts` + `tenant_modules` tables (migration `021_iter160_studio_activation.sql`).
- **Service** `services/studio_activation.py`: `get_or_create_draft` (resume via cookie/token), silent `patch_draft` autosave, `manifest()` returning archetypes + experiences + pre-suggestion logic + copy_keys.
- **Router** `routers/studio_activation.py` — endpoints `/api/studio/activation/{manifest,draft}` (POST/PATCH). All errors fail-soft.
- **Editorial copy seed** `seed_iter160_studio_phase1.py` — 25 blocks IT (Movements I + II only, namespace `studio.activation.*`). Other locales deferred until manual editorial review.
- **Frontend** `pages/studio/`:
  - `StudioActivationLayout.jsx` — full-bleed dark chrome, MOOD monogram top-left, ascending hairline progress indicator on the left margin (no numbers, never "Step X of Y"), monogram-in-formation slot top-right.
  - `useActivationDraft.js` — silent autosave (320ms debounce + sendBeacon on unload). Resume invisible.
  - `useStudioManifest.js` — single manifest call + parallel copy resolution.
  - `MovementEntrance.jsx` — `/studio` — full-bleed editorial photograph, slow Ken-Burns, single CTA, whisper return link to `/accedi`.
  - `MovementPractice.jsx` — `/studio/practice` — 3×2 magazine grid, six archetype tiles (Studio di Interior Design · Showroom Luxury · Studio di Architettura · Galleria di Materiali · Design Retail · Specialisti della Pietra). Hover reveals italic descriptor. Click expands tile edge-to-edge, shows confirmation line `Entri in MOOD come {practice}.`, then Continue → Movement III.
- **Route rewire**: `/studio` and `/studio/practice` mount the new flow. `/start-studio` (legacy) → 301 to `/studio`. Top nav + footer hidden on all `/studio/*` routes for full immersion.

### Side fixes in the same session
- **Default locale flipped from `en-us` → `it`** — both `site_resolver.DEFAULT_LOCALE` and `LocaleContext` initial state. Reason: the EN/FR/DE/ES editorial blocks still hold the original seed content; users with non-IT browsers saw stale "Curated Journeys / Editorial Moodboards" copy. The IT-first default surfaces the authored content correctly.
- **Locale switcher temporarily hidden** in `EditorialFooter` until a manual editorial-grade review of EN/FR/DE/ES translations is completed.
- **Migration runner** now actually records `schema_migrations` rows (was idempotently re-running every migration).

### Validation
- Manifest + draft endpoints: curl-tested end-to-end (resume, archetype patch, movement bump).
- Movement I + II: cinematic smoke-tests confirm tile hover/click → expansion → confirm-line → continue flow.
- All editorial copy resolves from DB (`studio.activation.*` namespace, namespace=`studio.activation`, block_key=remainder).

---

## Previous sessions — preserved below

### P0 Bug fixes ✅
- **Free crop in MediaUploader** — react-easy-crop doesn't natively support unconstrained aspect. Fixed by introducing `cropSize` state driven by W/H% sliders that appear only in `Libero` mode (`/app/frontend/src/admin/components/MediaUploader.jsx`). Sliders 10–100% of the displayed media, real-time crop-box resize.
- **Empty-text persistence in CMS** — `site_resolver._fetch_block_values` was using `if v:` which silently skipped empty-string translations and fell back to the source_value (old text). Replaced with `if loc in bucket:` so an explicit `""` is now respected as authoritative. Verified end-to-end via API.

### ITER167 — Access Continuity™ (Magic-Link First Experience) ✅
- **DB**: `access_magic_links` table (migration `020_iter167_access_continuity.sql`) — SHA-256-hashed tokens, single-use, 15min TTL, rate-limit 3/email/10min (applies to **known AND unknown** emails to prevent enumeration probing).
- **Service** `services/access_continuity.py`: identity-probe, issue_magic_link (Resend wrapper with sandbox-safe dev-preview log), consume_magic_link → JWT.
- **Endpoints** under `/api/auth`:
  - `POST /identity-probe` → `{channel: "magic_link"|"password"|"concierge", display_name}` (200 always — no enumeration leakage)
  - `POST /magic-link/request` → `{delivered:true, expires_in_minutes:15}` (neutral on unknown emails)
  - `POST /magic-link/consume` → `{ok, jwt, user, tenant, redirect_url}` or `{ok:false, reason:"expired"|"already_used"|"invalid"}`
- **Resend** (sandbox): logs `MAGIC_LINK_DEV_PREVIEW email=... url=...` when `RESEND_API_KEY=re_sandbox_placeholder`. Switch to real key + verified sender (`journey@moodfordesign.com` planned) to enable real send.
- **Editorial copy** — 28 blocks × 5 locales = 140 translations seeded under `site.access.*` namespace (`db/seed_iter167_access.py`). Hospitality / luxury tone, zero SaaS jargon.
- **Frontend** `AccessContinuityPage.jsx`:
  - Single page handles email → probing → password|magic|concierge, plus the `/journey/continue?token=…` landing flow (consuming → welcome_back → /admin).
  - Cinematic dark backdrop, slow-drifting radial pools (Chicago natural light), grain layer, serif headlines (Playfair), underline inputs, teal pill CTAs.
  - Top nav + footer hidden on access routes (full immersion).
  - Concierge intercept on every error path — no raw HTTP errors ever surface.
- **Route rewire**: `/accedi` (+ all localized variants) and `/journey/continue` mount `AccessContinuityPage`. Old `LoginPage.jsx` / `LoginHero.jsx` no longer routed (dead code, kept for safety).

### Validation
Testing agent (`iteration_3`) — 100% backend (15/15) + 100% frontend (7 ITER167 UI checks + bug-fix 1 UI + 2 regressions). Concierge tone confirmed across all error paths. One MEDIUM finding (rate-limit on unknown emails) was patched in the same session.

---

## Sessions completed

### Session V: ITER149 REBUILD — Premium Editorial Homepage matching mockup (May 24, 2026) ✅
- Complete rebuild of the homepage to match the official cinematic luxury mockup (laptop + phone hero, real curated brand wordmarks, 5 platform pillars, design journey, editorial triptych, immersive final CTA, full 5-column editorial footer)
- **New palette**: navy `#050816 / #08101D / #0B1320` + cyan `#19F0FF / #11D9E6` + text `#F5F7FA / #C9D2DC / #8B96A7`
- **New typography**: Playfair Display headlines + Inter body. Body **18px** desktop (16px mobile), labels 14px min, headings +25%. WCAG AA pass.
- **6 new section components** (all DB-driven via editorial_blocks + media_library):
  - `HeroEditorial` — split with cinematic device image on right
  - `CuratedBrands` — monochromatic wordmark strip (PORRO · Minotti · B&B Italia · Poliform · Gallotti&Radice · FLOS · Flexform · Lualdi) — labels from `site.home.brands.*`
  - `PlatformPillars` — 5 circular-icon cards (Curated Journeys™ / Editorial Moodboards™ / Relationship Memory™ / Material Intelligence™ / Blueprint Atelier™)
  - `DesignJourney` — left rail title + 4 cinematic interior cards (Ascolto / Curatela / Progetto / Realizzazione) with numbered captions
  - `EditorialTriptych` — 3 wide image cards (Magazine / Projects / Materials) with hover scale + cyan CTAs
  - `FinalCTAImmersive` — full-bleed dim background "Pronto a iniziare il tuo percorso?"
- **New chrome:**
  - `MinimalNav`: Logo + Magazine · Projects · Materials · About + Sign in + Begin your Journey (outline) + Professional Access (cyan filled)
  - `EditorialFooter`: 5 columns (Magazine · Projects · Materials · Company · Legal) + brand block + social + language dropdown
- **New seed** `db/seed_iter149_rebuild.py` — 84 editorial blocks × 5 locales = 420 translations, 9 media_library entries, 8 cms_sections
- Frontend lint clean, end-to-end smoke screenshots verified.

### Session IV: ITER149 — Public Website Engine + Blueprint Command Center (May 24, 2026) ✅
- **Architectural pivot**: site is now 100% DB-driven via `editorial_blocks` (i18n copy) + `media_library` (UUID asset refs) + `cms_sections` (layout skeleton only). Zero hardcoded content.
- **Backend (5 new files):**
  - `services/site_resolver.py` — joins cms_sections ⇄ editorial_blocks ⇄ media_library with locale fallback chain
  - `routers/site.py` — public read APIs (`/api/site/pages/{slug}`, `/site/navigation`, `/site/footer`, `/site/locales`, `/site/block`)
  - `routers/admin_site.py` — Blueprint Command Center APIs (blocks CRUD, sections reorder/toggle, media list/register, publish/unpublish, cache invalidate, whoami)
  - `db/seed_site_iter149.py` — comprehensive seed: 44 editorial_blocks × 5 locales (it/en-us/fr/de/es), 8 media_library entries, 8 cms_sections, navigation + footer config
  - Added UNIQUE constraint `editorial_blocks(tenant_id, namespace, block_key)` for idempotent upserts
- **Frontend Phase A — new homepage (6 sections, all DB-driven):**
  - `HeroCinematic` — split layout with editorial italic teal subhead + cinematic image
  - `SelectedProjects` — 3 luxury project tiles (Villa Riviera / Atelier Milano / Casa Brera)
  - `MagazineHighlights` — 3 article cards on warm ivory background (no dates per brief)
  - `MaterialsBrandPartners` — typographic-only (no fake brand logos)
  - `ProcessJourney` — 4-step editorial (Ascolto / Curatela / Progetto / Realizzazione) on warm ivory
  - `FinalCTA` — architectural cinematic CTA with Begin Journey + Professional Access
- **Frontend chrome:**
  - `MinimalNav` — Magazine · Progetti · Materiali · Chi siamo · Accedi + IT switcher + "Inizia il Percorso" primary CTA
  - `SlimFooter` — manifesto + single-row links + social + locale + legal
- **Frontend Phase D — Login page:**
  - Single email/password form (no SSO)
  - Two secondary CTA links: "Cliente privato? Inizia il tuo percorso" / "Professionista? Richiedi accesso"
  - All copy from `site.login.*` editorial_blocks
- **Blueprint Command Center Admin UI (`/admin`):**
  - Auth gate (X-Admin-Key header, dev mode bypass)
  - Editorial Blocks editor with namespace tabs (Homepage / Navigation / Footer / Login) + per-locale textareas (IT/EN-US/FR/DE/ES) + Save
  - Sections manager — visibility toggle + up/down reorder, shows content-key and media-slot counts
  - Media Library — grid view + URL registration + UUID copy
  - Publishing console — publish/unpublish home + cache invalidate
- **Locale Governance**: `tenants.active_languages` set to `[it, en-us, fr, de, es]`, default `it`. Public LocaleSwitcher and admin reads enabled list from `/api/site/locales`.
- **Routes restructured**: `/admin/*` → AdminApp, all other `/*` → CorporateApp. Legacy paths redirected (/platform, /journal, /for-studios, etc.)
- **Audit-clean**: no Unsplash URLs in components (only inside media_library rows), no hardcoded labels in nav/footer/sections.

### Session III: Premium Editorial Homepage V5 (May 19, 2026) ✅
- Rewrote homepage to match the latest dark-luxury Italian mockup (no SaaS feel, no fake brands/testimonials/metrics)
- **3 new section types** registered in `SectionRenderer`:
  - `workflow_ecosystem` — 8-step horizontal flow (Lead → CRM → Moodboard → Projects → Hotspot → Editorial → Publishing → Retention) with teal icons + arrow connectors
  - `experience_pillars` — 4-column "Un sistema nato dall'esperienza" pillars
  - `fragmented_tools` — 8-icon "Oggi il tuo lavoro è frammentato" problem grid (WhatsApp/Email/PDF/Drive/Pinterest/Excel/File dispersi/Strumenti scollegati)
- Extended `EditorialHero`:
  - New italic teal `subheading_accent` + italic white `subheading_white` sub-headline block
  - New `floating_card.style: 'phone'` variant — phone-shaped mock with circular progress (62%) + phase rows
- `DeviceShowcase` now parses `*ambiente*` markdown for inline italic-teal serif accent
- `CTASection` supports multi-line headlines via `pre-line` and `max-w-6xl`
- Removed legacy `logos_wall` (fake brand list), `testimonial_grid` (fake quotes), `metrics_strip` (fake numbers) from home — per user direction (no fake content)
- New seed `db/reseed_home_v5.py` — idempotent, multilingual; rewrites home & navigation
- Updated navigation: Piattaforma, Per gli Studi, Per i Retailer, Template, Journal, Chi siamo (removed "Prezzi")
- CTA in nav: "Richiedi una demo"

### Session II: Dark Editorial Redesign (May 2026) ✅
- Complete frontend palette overhaul: dark `#0A1320` ink, brand teal `#3DDAD0`, warm bone `#F5F2EC`
- New design tokens in `index.css`: pill buttons, feature chips, step circles, glow halos, grain texture, ink/light surface helpers
- Rewrote `CorporateNav` (dark, glass-on-scroll, new MoodLogo wordmark with teal ⊙⊙ + stacked "for DESIGN")
- Rewrote `LocaleSwitcher` (dark dropdown)
- Rewrote `EditorialHero` with floating "Project Overview" card (Villa Riviera + progress bar), feature chips strip, italic Playfair accent line
- Rewrote `MetricsStrip` (cinematic dark, 4 big serif numbers with teal icon bubbles)
- Rewrote `SplitStory` (dark editorial, optional bullets, dashboard mockup support)
- Rewrote `FeatureNarrative` (dark grid, hairline dividers, teal icon bubbles)
- Rewrote `CTASection` (cinematic dark, optional background image + gradient overlay)
- Rewrote `LogosWall` (supports dark + light press strip)
- **3 new section types**: `ProcessSteps` (6-step Client Journey), `ProjectShowcase` (light bone, project cards), `PressLogos` (Used and loved by …)
- Updated `CorporateFooter` colors to new palette
- `SectionRenderer` registry extended with the 3 new types
- New seed `db/reseed_home_v2.py` — idempotent, multilingual (it/en-us/en-uk/fr/de/es), repopulates home with the new section sequence:
  hero → metrics → split flow → process journey → project showcase → press logos → CTA
- All content multilingual & DB-driven. SEO meta updated.

### Session 0 (P0): Corporate CMS Persistence (May 2026) ✅
- Backend connected to real Supabase via Transaction Pooler
- Tenant resolver + cache + repository pattern
- 8 corporate `cms_pages` + 26 `cms_sections` + navigation row seeded
- Forms persisted (`contact_submissions`, `newsletter_subscribers`, `studio_registrations`)
- Zero runtime dependency on `seed_data.py`

### Session I: Journal/Media Engine + Draft/Published + AI Foundation (May 2026) ✅
**Migration 019** registered in `schema_migrations`.

**New tables:**
- `journal_articles` (status + draft_json/published_json + AI metadata + hero asset + soft delete + audit)
- `article_localizations` (per-locale slug/title/excerpt/SEO + UNIQUE (locale, slug))
- `journal_article_blocks` (section-based builder: hero_cinematic, paragraph, gallery_masonry, quote, video, cta, designer_bio, product_hotspot_image, related_articles, divider, spacer, two_columns, full_image)
- `article_hotspots` (shoppable/storytelling hotspots on images)
- `journal_categories` + `article_category_map`
- `journal_tags` + `article_tag_map` (groups: material/style/designer/country/year/other)
- `content_revisions` (generic audit trail: autosave/publish/revert/archive)
- `ai_assist_logs` (provider/model/tokens/latency/cost observability)

**Extended tables:**
- `cms_assets` — added: `caption`, `photographer`, `copyright`, `dominant_color`, `palette`, `aspect_ratio`, `mime_type`, `file_size_bytes`, `hotspots`, `variants`, `folder_path`, `locale`, `deleted_at`, audit
- `cms_pages` — added: `draft_json`, `published_json`, `approval_stage`, `deleted_at`
- `cms_sections` — added: `deleted_at`

**Enums created:** `journal_article_type`, `journal_article_status`, `revision_action`, `ai_assist_action`
**Triggers:** `mood_touch_updated_at()` on 7 tables

**Supabase Storage buckets created (public read, 50MB limit):**
- `cms-assets` — CMS images for corporate + tenant sites
- `journal-media` — Journal articles media
- `tenant-branding` — Logos / favicons / brand kits

**Services layer (provider-abstracted, tenant-aware):**
- `services/storage.py` — Supabase Storage REST client (ensure_buckets, upload, public URL, delete)
- `services/media_library.py` — upload + Pillow metadata extraction + hotspot CRUD + soft delete
- `services/journal_service.py` — articles CRUD + blocks + draft/publish/revert + revisions
- `services/cms_writer.py` — page autosave/publish/revert + section reorder/patch/delete
- `services/ai_editorial.py` — Claude Sonnet 4.5 (Emergent LLM Key) with full observability logging

**New API endpoints (35 routes):**
- Media (5): upload, list, patch, delete, hotspots
- Journal public (4): articles list, article detail (slug+locale), categories, tags
- Journal admin (9): article CRUD, block add/reorder, draft autosave, publish, revert, revisions, category+tag upsert
- CMS admin (10): list pages, get page, autosave draft, publish, revert, section CRUD/patch/reorder/delete, revisions
- AI editorial (8): topics, outline, seo, excerpt, copy, translate, categorize, photo-direction

**Tests:** 30/30 end-to-end smoke at `/app/backend/tests/test_session_i_e2e.py` — all green.

---

## Prioritized Backlog

### P1 — Next session
- [ ] **Blueprint admin UI** — page/section/article editor bindings (admin lives in separate Blueprint codebase; consumes our new APIs)
- [ ] **Auth + RBAC**: wire `_auth.py` placeholder to Supabase Auth + `tenant_memberships` (replace `require_admin_tenant` with real JWT)
- [ ] **Multilingual URL routing on frontend** (`/it/`, `/fr/` etc. reading entirely from DB)
- [ ] **Brand / Licensing system** — commercial onboarding-ready, before Stripe
- [ ] **Replace hardcoded corporate image URLs** with `cms_assets` rows + `cms_sections.asset_refs`
- [ ] **Public journal page** (masonry layout, filters chips, featured article) at `/journal`

### P2 — Backlog
- [ ] **Email service** (Resend / SendGrid) for contact + newsletter (currently persist only, NO email dispatch)
- [ ] **Stripe Subscriptions** + webhook → pricing → checkout
- [ ] **Tenant self-registration** → auto-provisioning `{slug}.blueprint.moodfordesign.com`
- [ ] **AI image generation** via Nano Banana / GPT Image 1 (`ai_assist_logs.action = 'image_prompt'` already prepared)
- [ ] **Dynamic SEO + Schema.org** per page+locale
- [ ] **Redis** drop-in replacement for in-process TTL
- [ ] **Image optimization pipeline**: webp/avif variants, blur placeholders, focal-point crops
- [ ] **CDN** in front of Supabase Storage
- [ ] **Audit log integration** with `content_revisions` UI (diff view, restore)

### Tech debt
- [ ] Pydantic `EmailStr` validation on forms
- [ ] Studio slug uniqueness suffix (collision-safe)
- [ ] Env-driven cache TTL
- [ ] `ADMIN_API_KEY` set in prod (currently no-op in dev)
- [ ] Rename Pydantic field `register` in `TranslateRequest` (shadows BaseModel attr)

---

## Code Quality (Feb 2026)

### Refactor passes applied (post code-review)
- **Critical bugs fixed:**
  - `result` undefined paths refactored with `return-in-try` / `try/except/else` in `routers/media.py`, `routers/cms_admin.py` (publish_page + patch_section)
  - MD5 → SHA-256 (non-cryptographic content checksums) in `routers/admin_site.py`, `db/seed_site_iter149.py`, `db/seed_iter149_rebuild.py` — `source_hash` is never compared, only stored, so migration is transparent
- **Service signatures consolidated via dataclasses:**
  - `services/journal_service.py` → `ArticleCreateData`, `BlockCreateData`, `ArticleListFilters`
  - `services/cms_writer.py` → `SectionData`
  - `services/ai_editorial.py` → `AILogContext`
  - All call sites updated in `routers/journal.py`, `routers/cms_admin.py`, `routers/ai_editorial.py`
- **`routers/admin_site.py:upsert_block`** split into `_validate_block_payload`, `_upsert_editorial_block_row`, `_upsert_block_translations`
- **Type hints** added to `database.py` (engine, sessionmaker, `get_db()`)

### ITER151b — Features page mockup redesign (Feb 2026)
- 2 new section renderers:
  - `feature_hero_split` — split hero: text on solid black left + cinematic photo right with gradient blend
  - `feature_numbered_list` — up to 15 rows: outlined teal serif number (01–15) | eyebrow/title/body | screenshot with teal radial glow. Empty items (no eyebrow/title/body) hidden on the public site.
- Both registered in `SECTION_REGISTRY`.
- Seed `db/seed_iter151_features.py`: idempotent, 49 editorial_blocks (4 hero + 45 items × 3) + 2 sections inserted on `features` page. SEO meta updated. Slots `item_06`..`item_15` declared empty so they appear in the Page Editor ready to fill.
- **Auto-discoverable from Page Editor**: blocks flat-named (`item_01_eyebrow`...`item_15_body`), media slots flat-named (`item_01`...`item_15`) → all editable inline without backend changes.
- Validated visually on `/caratteristiche`: hero + 5 numbered feature rows public; 49 editable input slots in admin.

### ITER153 — Batch 3 SEO infrastructure + Markdown preview + Legal Strip nel CMS (Feb 2026)

**Markdown preview toggle nel BlockEditor**
- Quando un blocco `body` è in modifica, la `MarkdownToolbar` ora include un toggle a destra: `[ Markdown | Anteprima ]`. In modalità Anteprima il textarea viene sostituito da un render in-place che applica grassetto/corsivo/link/paragrafi con la stessa tipografia del frontend pubblico (Inter, line-height 1.7, color rgba 0.86). I bottoni di formattazione sono disabled in preview mode. Click sulla preview → torna a Markdown.
- Anche il box "Resa pubblica" sotto al campo ora renderizza i body con tipografia editoriale (font Inter, line-height 1.7) invece del fallback monospace.
- Helper `renderBlockPreview` riusa lo stesso parser usato dal frontend pubblico → garanzia di parity 1:1 tra editor e pagina live.

**Legal Strip nel CMS (multilingua)**
- `LegalStrip` componente fetcha `/api/site/legal-strip?locale=<loc>` al mount. Fallback ai default IT se l'API è unreachable.
- Backend `services/site_resolver.resolve_legal_strip(locale)`: legge 3 editorial_blocks (`site.footer.legal_strip.left|center|right`) per il locale, sostituisce `{year}` dinamicamente.
- Endpoint pubblico `GET /api/site/legal-strip?locale=<loc>`.
- Admin `FooterEditor` esteso con sezione "Fascia Legale": 3 textfield per le 3 linee, ognuna per locale (gestione tramite il dropdown lingua già esistente nel FooterEditor). Placeholder `{year}` documentato inline.

**Sitemap dinamica + Hreflang + Canonical + robots.txt**
- `services/site_resolver.generate_sitemap()`: enumera `cms_pages WHERE status='published'` × locales (legge da `tenant_locales` se esiste, fallback `it,en-us,en-uk,fr,de,es`). Per ogni URL emette `<lastmod>` + `<xhtml:link rel="alternate" hreflang>` per ogni locale + `x-default` verso en-us. SLUG_OVERRIDES tabella IT-rooted (e.g. `/dedicato-a` ↔ `/audience` ↔ `/dedie-a`).
- Endpoint pubblico `GET /api/site/sitemap.xml` (XML standard sitemaps.org 0.9).
- 7 pagine × 6 locales = **42 URL** indicizzabili al primo deploy.
- `frontend/public/robots.txt` aggiunto (Allow / · Disallow /admin /api · Sitemap link).
- `SEOHead` riscritto: oltre a title/description/og:image, ora aggiunge dinamicamente `<link rel="canonical">` + `<link rel="alternate" hreflang="...">` per ogni locale + `x-default`. Pulisce gli alternates al cambio route (no leak su page navigation). Setta anche `<html lang>`.

**Search Console helper admin page**
- Nuova rotta `/admin/seo` con `SearchConsoleHelper` component:
  - 3 status card: Sitemap (URL totali · locale coperti · link "Apri sitemap" + "Versione produzione") · robots.txt (Disponibile · Esclusioni · "Apri robots.txt") · Hreflang multilingua (lista capability)
  - 4 quick-link tool: Google Search Console · Bing Webmaster Tools · Rich Results Test · Sitemap Validator
  - Hint card "Prima del lancio: invia il sitemap a Google Search Console..."
- Aggiunto al sidebar dell'admin tra Footer e Publishing.

### ITER152b — Single CTA · Legal strip · Favicon definitivo · Footer reset (Feb 2026)
- **CTASection / FinalCTA / FinalCTAImmersive**: il bottone secondario è stato rimosso. La sezione finale di ogni pagina ora ha un SOLO CTA primary teal solid. Il blocco `site.home.final.cta_primary` ora dice "Scopri le licenze MOOD for DESIGN" (IT) / "Discover MOOD for DESIGN licenses" (EN), con link a `/versioni-prezzi`.
- **`LegalStrip`** componente: fascia bianca sottile sotto il footer su ogni pagina pubblica. 3 testi (copyright a sinistra · "Questo servizio è fornito da MOOD for DESIGN" al centro · "Running on Blueprint OS™ - Editorial Infrastructure for Design Studios" a destra). Aggiunto a `CorporateApp` dopo `EditorialFooter`. Responsive: mobile collassa a colonna centrata.
- **Favicon definitivo**: usato il PNG ufficiale fornito dall'utente (`logotipo_OO.png`) come `<link rel="icon" type="image/png">` + `<link rel="shortcut icon">` + `<link rel="apple-touch-icon" sizes="180x180">`. Aggiunto cache-buster `?v=3`. SVG fallback rimosso (era la causa della "distorsione" su alcuni browser).
- **Footer reset**: `cms_sections` di tipo `footer` cancellate per ripartire con bootstrap pulito. Al primo save dal `/admin/footer` il FooterEditor inizializzerà 2 social (Instagram + LinkedIn) + 2 colonne configurabili (Esplora + Legale). Niente più 3a icona social non gestibile dal CMS.

### ITER152 — Multi-tenant JWT auth + Navbar CTA buttons + Footer CMS (Feb 2026)

**JWT-based multi-tenant authentication** (full backend playbook adaptation from MongoDB → Postgres)
- New tables: `users(id, tenant_id, email, password_hash, full_name, role, is_active, last_login_at)` with `UNIQUE (tenant_id, email)` — same email may exist across tenants. `login_attempts(identifier, success, created_at)` for brute-force throttle.
- `routers/auth.py` (prefix `/api/auth`):
  - `POST /login` — normalizes email, queries `users` JOIN `tenants` across ALL tenants for the email, validates bcrypt password against each candidate. 0 match → 401; 1 match → JWT + `{user, tenant, redirect_url}`; N matches → `{requires_tenant_selection: true, tenants: [...]}` so the client renders a picker and resubmits with `tenant_slug`.
  - `GET /me` — Bearer token → user payload + tenant.
  - `POST /logout` — stateless (client discards token).
  - JWT lifetime 24h, HS256, claims `{sub, tenant_id, tenant_slug, role, email, exp, type}`.
  - Brute-force: 5 failed attempts within 15min per email → 423 Locked.
- Seed `db/seed_auth_admin.py`: creates/updates admin user for tenant `studio` reading `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. Idempotent.
- `LoginHero` rewired: real `axios.post` to `/api/auth/login`, multi-tenant picker rendered when backend returns `requires_tenant_selection`, error handling for 401/422/423, JWT stored in `localStorage` (`mood_auth_token`, `mood_auth_user`, `mood_auth_tenant`), redirect to `data.redirect_url` (`/admin` for admin role).
- Test creds in `/app/memory/test_credentials.md` (`admin@moodfordesign.com` / `MoodAdmin2026!`).

**Navbar CTA polish**
- "Supporto" → outlined teal pill (transparent bg + teal border + teal text on hover)
- "Accedi"  → solid teal pill (filled #00C9B3 with black text — strongest visual call-to-action)
- Both buttons now visually consistent with hero CTAs across the site.

**Footer snellito + CMS editor**
- `EditorialFooter` reduced to a clean 2-column layout (brand+social block left, then 2 link columns: configurable "Esplora" + "Legale"). The 4-column "magazine/projects/materials/company" grid is gone. Copyright sits at the bottom with the locale switcher.
- Backend `GET/PUT /api/admin/site/footer?locale=<loc>`: reads/writes `cms_sections(section_type='footer').settings` + per-locale editorial_block values in one call. Auto-creates the `footer` cms_page if missing. Cache-invalidating.
- New admin route `/admin/footer` → `FooterEditor` component: per-language dropdown (IT · EN-US · EN-UK · FR · DE · ES), inline editors for copyright + nav column (heading + items, each row has label + href + "titolo" checkbox + remove) + legal column + social network rows (icon dropdown supporting `instagram · linkedin · twitter · x · youtube · facebook · pinterest` + URL). Bootstrap-on-empty so new tenants get a sensible default tree to edit immediately. Save pill shows dirty/saved status.
- Social icons dynamically resolved on the public footer via `SOCIAL_ICONS` map (lucide-react). Rows with empty `href` are hidden.

**Misc**
- Login "Registrati" CTA now points to `/supporto#contact` (was `/dedicato-a`). Editable from the Page Editor.

### ITER151j — Unified panoramic hero (Home / Audience / Training) + favicon + SEO meta polish (Feb 2026)
- **`HeroEditorial` (Home)** rewritten to match the site-wide panoramic pattern: photo edge-to-edge with `object-position: center 40%`, unified horizontal veil (`0.98 → 0 over 0-92%`), text top-left aligned to nav container via `paddingLeft: max(1.5rem, calc((100vw - 1536px) / 2 + 4rem))`. CTAs: solid-teal primary + ghost outlined secondary (consistent with login/training).
- **`AudienceHeroSplit`** + **`TrainingHero`** converted from split-column to the same panoramic pattern. Photo runs edge-to-edge (was confined to right column), veil is the unified strong gradient (was a soft 12-26% blend), text is top-left container-aligned. Body section + body-with-photo on /dedicato-a remains intact below the hero.
- **Favicon** replaced: SVG inline icon (`/favicon.svg`) — 64×64 viewBox, `#121212` background + two outlined teal MOOD circles. Crisp at all DPRs, no PNG bloat. Apple-touch-icon still points to the full wordmark PNG.
- **Document SEO meta (default)** expanded in `index.html`: Italian copy, `keywords`, `author`, `canonical`, `og:site_name`, `og:locale=it_IT`, `og:type=website`, `twitter:title/description`. Per-page meta still overridden dynamically by `SEOHead` (set from `cms_pages.locale_meta` via `SitePage`).

### ITER151i — Batch 2: Hero alignment + Favicon + SEO meta editor + Anchor sections + Mini markdown (Feb 2026)

**Hero text alignment**
- `AudienceHeroSplit` and `TrainingHero` left text panels now align with the navigation container: `paddingLeft: max(1.5rem, calc((100vw - 1536px) / 2 + 4rem))` matches the logo's left edge at every breakpoint. The titles "Progettato per chi progetta il futuro." and "Conosci. Impara. Cresci." now read perfectly under the MOOD logo.

**Favicon & document-level SEO**
- `frontend/public/index.html`: real favicon + apple-touch-icon pointing to the MOOD wordmark, `theme-color: #121212`, updated default OG/Twitter meta (Italian copy, OG image set).
- New `SEOHead` component (`components/SEOHead.jsx`): imperative head manager — sets/upserts `<title>`, `meta[name=description]`, `og:title/description/image`, `twitter:image` on every page mount. No `react-helmet` dependency.

**Per-page SEO meta editor (Blueprint Command Center)**
- Backend endpoints (`routers/admin_site.py`):
  - `GET  /api/admin/site/pages/{page_key}/seo` — returns `locale_meta` with resolved `og_image_url` for each locale.
  - `PUT  /api/admin/site/pages/{page_key}/seo` — body `{locale, title, description, og_image}`. Validates, writes `cms_pages.locale_meta`, invalidates cache.
- Public resolver (`services/site_resolver.py`) now resolves `og_image` UUID → public `og_image_url` in the page payload.
- Admin UI (`PagesEditor.jsx`): collapsible **SEOEditor panel** at the top of each page — per-locale title (max 70 chars), description (max 170 chars), and og:image picker (uses the same `MediaPicker`). Shows char counter, dirty indicator, save status pill.

**`anchor_section` component**
- Renderer (`AnchorSection.jsx`): editorial landing for in-page anchors. Renders `<section id={anchor_id} data-anchor-id>`, eyebrow + serif title + italic Playfair subtitle + 2-column body+photo (markdown-aware). `options.reverse` flips columns, `options.background` alternates `#000000`/`#050606`. `scrollMarginTop: 92px` keeps target below fixed nav.
- Seed `db/seed_iter151_training_anchors.py`: 5 anchor sections on `/formazione` — `#percorsi · #tutorial · #guide · #webinar · #academy`. Each has full editorial copy with markdown (e.g. **bold** highlights). Updates `training_hero` CTAs to point to anchors.

**Mini Markdown Editor (admin) + safe renderer (public)**
- `PagesEditor.BlockEditor` — when `block_type === 'body'`, a minimal **MarkdownToolbar** is rendered above the textarea:
  - **B** → wraps selection with `**…**`
  - **I** → wraps selection with `*…*`
  - **↗** → prompts URL, inserts `[selection](url)`
  - **•** → appends a bullet line
  - **¶** → appends a paragraph break (`\n\n`)
  - inline hint: "markdown: **grassetto** · *corsivo* · [link](url)"
- Headlines / eyebrows / CTAs are NOT editable as markdown (intentional — preserves visual hierarchy).
- `utils/renderInlineMarkdown.jsx`: safe-by-construction inline parser used by `EditorialBodyWithPhoto` and `AnchorSection`. Token regex matches only `**bold**`, `*italic*`, `[label](url)`. Anything else renders as plain text. `\n\n` → `<br><br>`.

**Veil & navbar polish**
- Hero veils strengthened: `0.98 → 0.94 → 0.78 → 0.5 → 0.18 → 0` (was `0.92→0.82→0.55→0.25→0`). Uniform contrast on bright photos.
- `MinimalNav.showSolid = true` constant — `#121212` (`rgba(18,18,18,0.78)` + blur) visible immediately, no scroll required.

### ITER151h — Audience rebuild + Pricing 4-tier + Comparison table + Veil opacity (Feb 2026)
- **Navbar always solid**: `MinimalNav.showSolid = true` constant — `rgba(18,18,18,0.78)` with backdrop-blur visible immediately, no scroll required.
- **Veil opacity strengthened** on all panoramic heroes (`FeatureHeroSplit`, `PricingHeroCinematic`, `PageHero`, `SupportHero`, `LoginHero`): max α `0.98 → 0.94 → 0.78 → 0.5 → 0.18 → 0` over 0-92%. Text contrast on dark photos is now uniformly strong.
- **`audience_hero_split`** — new component for /dedicato-a: split layout (text on solid black left ~46%, cinematic photo right ~54% with subtle left-edge blend). Mirrors the user's mockup ("La nostra comunità · Progettato per chi progetta il futuro.").
- **`editorial_body_with_photo`** — new component: magazine-style 2-column editorial spread (eyebrow + serif title + long-form paragraph on left, 4:5 aspect photo on right). `options.reverse` flips columns. Used as second section on /dedicato-a.
- **`PricingTiersEditorial` extended to 5 slots**: declares tier_04 and tier_05 (empty source on seed) — invisible on public site until admin fills `title`/`body`. Auto-discoverable from Page Editor: 12 extra blocks + 1 media slot per new tier.
- **`pricing_comparison_table`** — new component on /versioni-prezzi: editorial feature matrix with up to 4 tier columns (Essential / Studio / Professional / Enterprise) in gold-italic Playfair, 12 declarable rows. Cell values:
  - `✓ / yes / true / si` → teal check icon
  - `- / empty / no` → dim em-dash
  - anything else → text label (e.g. "10 GB", "Email", "Prioritario")
  Empty tier columns auto-hidden; empty rows auto-hidden. Optional footer note + "Contatta il team" outlined CTA.
- **Seed** `db/seed_iter151_audience_pricing.py`: 98 editorial_blocks + 3 new sections + section reorder. Idempotent.

### ITER151g — Support / Training / Login redesign + chrome polish (Feb 2026)
- **Nav + Footer chrome** updated: navbar `rgba(18,18,18,0.78)` with 18px backdrop-blur + 140% saturation (scrolled state), footer `rgba(18,18,18,0.92)`. Hairline borders `rgba(255,255,255,0.06)`. Mobile panel matches.
- **4 new section renderers** registered in `SECTION_REGISTRY`:
  - `support_hero` — panoramic hero + global search bar with teal submit + 4 quick-access icon cards (BookOpen / HelpCircle / MessageSquare / Activity from lucide-react)
  - `editorial_card_grid` — flexible card grid: `options.columns` (2|3|4), `options.featured_last` (full-span Academy-style), `options.background` (#000|#0A0A0A). Each card: eyebrow + serif title + body + teal CTA arrow link + photo bleeding from bottom-right corner via diagonal mask (or full right-pane image when `featured_last`).
  - `training_hero` — split editorial hero (text left, photo right) with 3-line serif headline (each `title_line_N` on its own line) + body + dual CTA (outlined teal primary + ghost secondary)
  - `login_hero` — panoramic hero + overlaid email/password form (frosted glass inputs, teal solid CTA) + "Non hai un account? Registrati" link. Auth backend still placeholder per PRD Phase D.
- **Login route refactored**: `/accedi` (and locale variants) now flow through `SitePage('login')` → `LoginHero` from CMS. The legacy `LoginPage.jsx` standalone is no longer in the router. The new login content is fully editable from the Page Editor (Email/Password labels, CTA, register prompt, photo).
- **Seed** `db/seed_iter151_pages_v2.py`: 60 editorial_blocks + 6 cms_sections across `/supporto`, `/formazione`, `/accedi`. Idempotent (deletes legacy `page_hero`/`page_intro` and existing variants before inserting).
- **Tone**: Italian editorial sober register matches the user's mockups (Apple × Architectural Digest × Aman Journal). Default media slots cycle from latest library entries — replaceable via MediaPicker per slot.

### ITER151f — Unified panoramic hero pattern (Feb 2026)
- **Unified pattern** applied to all hero sections with a background photograph:
  `FeatureHeroSplit` (Caratteristiche), `PricingHeroCinematic` (Versioni e Prezzi), `PageHero` (Dedicato a / Formazione / Supporto / Accedi).
- **Layout**: single-column, photo runs edge-to-edge (`width: 100%`, `object-fit: cover`, `object-position: center 35-40%`), panoramic height (`clamp(520-560px, 62-68vh, 720-780px)` — NOT full viewport).
- **Veil**: horizontal left-to-right black gradient
  `linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 22%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.25) 62%, rgba(0,0,0,0) 82%)` — solid on the left for text contrast, fully transparent past 82%, letting the right side of the image breathe.
- **Text overlay**: top-left, max-width 560-640px (eyebrow + serif title + body + CTA). Reads like a magazine spread.
- The previous `FeatureHeroSplit` 46%/54% split layout has been replaced.

### ITER151d — Pricing page editorial ecosystem (Feb 2026)
- **4 new section renderers** registered in `SECTION_REGISTRY`:
  - `pricing_hero_cinematic` — full-bleed cinematic environment hero with magazine-cover low-left typography (eyebrow · serif title · italic Playfair subtitle)
  - `pricing_philosophy` — typographic intermezzo on black: left-rail eyebrow + italic Playfair headline + editorial body. No chrome.
  - `pricing_tiers_editorial` — 3 vertical card tiers as "modalità operative" (Studio · Atelier · Maison): top environment photograph, eyebrow tag, serif title, italic editorial subtitle, body, typographic inclusions (hairlines, no bullets), italic secondary price, outlined CTA pill. Center tier marked as "Consigliato" via `options.featured_index`.
  - `pricing_ecosystem_note` — closing 2-column block: editorial copy on the left + 3 outlined-serif numbered pillars (Onboarding curato · Formazione continua · Team dedicato) on the right. Elevates from "software pricing" to "ecosystem access".
- **Seed** `db/seed_iter151_pricing.py`: 52 editorial_blocks (3 hero + 3 philosophy + 38 tier + 11 ecosystem) + 4 cms_sections (replaces page_hero / page_intro / pricing_cards on `pricing`). Idempotent.
- **Default media** picked from latest 6 in library (cycled across hero + 3 tiers) — fully editable from the Page Editor MediaPicker.
- **Tone**: Italian editorial, register "Apple × Architectural Digest × Aman Journal". Tier prices are italic secondary, never the protagonist. Copy says "modalità operative" instead of "piani". Three pillars surface onboarding + training + dedicated team without using the word "enterprise".
- **Auto-discoverable from Page Editor**: all 52 blocks and 4 media slots flat-named → inline editable + MediaPicker-ready without backend changes.
- **Bug fix**: `FeatureHeroSplit` gradient overlay diluted (max 0.55 alpha vs 0.95) and starts further left (0% → 78% vs 0% → 70%) per user feedback. The right-pane photograph now reads naturally without a heavy black wash on the left edge.

### ITER151c — Bug fix + AI auto-translate (Feb 2026)
- **Bug fix**: `PUT /api/admin/site/sections/:id/media-slot` was failing with `ProgrammingError` due to `:s::jsonb` syntax (asyncpg parse conflict between bind params and PostgreSQL casts). Replaced with `CAST(:s AS jsonb)`. MediaPicker selection now works correctly.
- **AI auto-translate** (Claude Sonnet 4.5 via `/api/ai/editorial/translate`):
  - Per-block button "Traduci da IT" inside BlockEditor (visible only on non-IT locales when IT source has content)
  - Bulk-translate toolbar button "Traduci N blocchi → LOCALE" (visible when at least one block has IT source and missing target translation) — iterates over candidates with progress counter
  - Translations are pre-filled into the textarea; user must click "Salva" to persist (allows review)
  - `adminApi.translate(text, srcLocale, tgtLocale)` calls `/api/ai/editorial/translate` with admin headers

### ITER152 Phase 1 — Live Preview / Synchronized Editorial Canvas (Feb 2026)
- **Split layout** `/admin/pages`: editor on left (~60%), live preview iframe on right (~40%). Preview is sticky (always visible while scrolling editor).
- **Real renderer reuse**: the right pane embeds the actual public site via iframe — same React app, same `SectionRenderer`, same typography/spacing/animations. No duplicated rendering logic.

### Admin Page Content Editor — Editorial Operating Console (Feb 2026)
- **PreviewBridge** (`corporate/components/PreviewBridge.jsx`): mounts only when `window.parent !== window`. Sends `mood-preview:ready` on mount; listens for `mood-preview:scroll-to-section`; forwards user clicks as `mood-preview:section-clicked`. Shows a "LIVE PREVIEW" pill so the embedded context is unambiguous.
- **LivePreview** (`admin/components/LivePreview.jsx`): viewport modes Desktop (100%) / Tablet (820px) / Mobile (390px) with animated `width` transition (350ms cubic-bezier). Reload button + open-in-new-tab. Receives `refreshKey` to force iframe reload (e.g. after save).
- **Bidirectional sync**: clicking a block/section in the editor triggers preview scroll-to via postMessage; clicking inside the preview iframe pushes section id back to the editor (forwarded via parent).
- **Locale-aware URL**: locale switch in editor → resolves the localized slug via internal map and reloads iframe (e.g. `audience` + `en-us` → `/audience`, `audience` + `fr` → `/destine-a`).
- **Auto-reload on save**: every block save bumps `refreshKey`, causing the iframe to refetch the published page so changes appear instantly.
- **Section anchors**: `SectionRenderer` wraps every section in a `<div data-section-id="..." data-section-type="...">` for stable cross-frame targeting.
- **AdminShell**: padding removed for `/admin/pages` route to give the split layout edge-to-edge space.
- **Validated E2E**: Desktop → Tablet → Mobile viewport switching with animated resize; page switching reloads preview; locale switching reloads preview with localized slug; "LIVE PREVIEW" pill visible inside the embedded view.
- **Backend endpoints**:
  - `GET /api/admin/site/pages` — list of all cms_pages (ordered: home → audience → features → pricing → training → support → login → others)
  - `GET /api/admin/site/page-content/:page_key` — full editable content in ONE call (sections + auto-discovered text blocks with translations + media slots with full metadata)
  - `PUT /api/admin/site/sections/:id/media-slot` — assign/remove a media slot (validates media exists)
  - `GET /api/admin/site/media-usages` — `{media_id: [{page_key, section_type, slot}]}` map for the picker
- **Frontend `/admin/pages`** (new primary tab, set as default route):
  - Left sidebar with all CMS pages
  - Top locale tabs: IT · EN-US · EN-UK · FR · DE · ES
  - Each section renders: type heading, then per-block inline editor + per-media slot panel
  - **Block editor**: textarea + live preview with REAL typography (Playfair italic for body, Inter for cta/eyebrow, Playfair display for headlines). Save button with "Salvato" / "Non salvato" pill status.
  - **Media slot panel**: thumbnail with dominant color background, dimensions, color swatch, category. "Cambia foto" button opens MediaPicker.
- **MediaPicker** (`components/MediaPicker.jsx`): full-screen modal with:
  - Tabs "Tutte" (grid) + "Per categoria" (grouped by `category` field)
  - Global search across `alt_text`, `file_name`, `category`
  - Each card displays: image, aspect ratio chip (16:9, 4:5, 1:1, etc.), category pill, **current usage label** ("used in home · final cta immersive"), "IN USO" badge if currently assigned to the slot
  - "Carica nuova" button opens the existing MediaUploader (crop + filters pipeline) — uploaded image is auto-selected
- **Auto-discovery**: blocks and media slots are read from `cms_sections.settings.{blocks, media}` — adding a new section type doesn't require new admin code, just declare the slots.
- **Validated E2E**: navigated through all 7 pages, opened picker on real Home section, verified usage labels show "used in home · ...", verified search filter (`hero` → 2 results including the active one with IN USO badge).
- **Backend**: `POST /api/admin/site/media/upload` (multipart, JPEG/PNG/WebP/AVIF, max 25MB) — uploads to Supabase Storage bucket `cms-assets`, extracts width/height/dominant_color via Pillow, inserts into `media_library`.
- **Backend**: `DELETE /api/admin/site/media/{id}` — soft-archive (sets `archived_at`).
- **Frontend**: `src/admin/components/MediaUploader.jsx` — drag/drop, react-easy-crop for crop with 7 aspect presets (1:1, 4:5, 3:2, 16:9, 21:9, 9:16, free), 6 filter presets (Editoriale, Cinematico, B&N, Caldo, Freddo, Matte) + 6 fine sliders (brightness 50-150%, contrast 50-150%, saturate 0-200%, grayscale 0-100%, sepia 0-100%, blur 0-8px). Canvas pipeline produces a Blob with cropped + filtered output before upload.
- **Frontend**: `src/admin/utils/cropFilter.js` — pure canvas utility, no extra deps beyond `react-easy-crop`.
- **Frontend**: `MediaLibrary.jsx` updated with `Carica foto` (upload) and `Registra URL` buttons + per-card delete with confirm.
- **Validated**: real upload test produced `400×300` JPEG with `#7832C8` dominant color matching the source, then DELETE soft-archived correctly.

### ITER151 Phase 1 — Public Website Restructure (Feb 2026)
- **New top navigation** (Italian source, locale-fallback ready): Dedicato a · Caratteristiche · Versioni e Prezzi · Formazione + (Supporto · Accedi). Removed "Inizia il Percorso" / "Accesso Professionale" CTAs entirely.
- **Backend resolver**: `site_resolver.resolve_navigation()` now returns `{main, right, cta}` grouping nav items by `position` setting.
- **Homepage CTA collapse**: hero + final_cta now show a single `Scopri MOOD for DESIGN` button (cta_secondary forced empty for all locales).
- **6 new dynamic pages** in `cms_pages` (canonical EN slug: audience, features, pricing, training, support, login). Each has 2 sections (`page_hero` + `page_intro`) and editorial blocks (eyebrow/title/subtitle/intro_body/cta_label/seo_title/seo_description).
- **Localized routing**: `src/corporate/routes/localizedSlugs.js` maps 6 canonical keys × 6 locales (IT/EN-US/EN-UK/FR/DE/ES) → 36 React routes resolving to same component. IT slugs: `/dedicato-a`, `/caratteristiche`, `/versioni-prezzi`, `/formazione`, `/supporto`, `/accedi`. `/login` retained for backwards compat.
- **2 new section renderers**: `PageHero.jsx` (cinematic hero with optional bg), `PageIntro.jsx` (Playfair italic editorial intro + outline CTA pill). Both registered in `SECTION_REGISTRY`.
- **Legacy redirects**: `/begin-journey` → `/dedicato-a`, `/professional-access` → `/accedi`.
- **Seed script**: `db/seed_iter151_pages.py` — idempotent, 55 editorial_blocks + 6 cms_pages + 12 cms_sections + nav rewrite.
- **Tenant locales**: `tenants.active_languages` updated to `[it, en-us, en-uk, fr, de, es]` (was `[it, en]`).
- **Smart locale switcher** (`LocaleSwitcher.jsx` + `EditorialFooter.jsx`): when user changes locale on a localized page, it auto-navigates to the equivalent slug in the new locale (e.g. `/dedicato-a` IT → `/audience` EN, `/audience` EN → `/destine-a` FR, etc.). Validated E2E.
- **Smart locale detection** (`LocaleContext.js`): on initial mount, if the current URL path matches a known localized slug, it auto-sets the locale accordingly — so direct visits to `/destine-a` immediately switch UI to FR.
- **Tone**: Italian editorial copy (sober, cinematic, Apple × Architectural Digest × Aman Journal register). Non-IT locales inherit via fallback chain until Phase 3.
- **Validated**: home + /caratteristiche + /versioni-prezzi + /destine-a (FR) all render correctly via screenshots; locale switching round-trips via footer dropdown.

### Code review false-positive policy
- All `is`/`is not` comparisons in the codebase are `is None` / `is not None` — **PEP 8 mandated**, do NOT change to `==`. Any tool reporting these as bugs is producing systematic false positives (lacks `R0124` whitelisting).

---

## Test Status
- Iteration 1 (mocked): 100% (20/20)
- Iteration 2 (Supabase migration): 100% (29/29)
- Iteration 3 (Session I — Journal/Media/AI): 30/30 E2E green
- Lint (Feb 2026 refactor): 7/7 files clean, full backend imports OK, 4 public endpoints smoke-tested 200

## Mocked / Non-prod
- Contact form & newsletter persist to DB but NO email sent
- Studio registration persists intake but NO tenant auto-provisioning
- Admin routes use placeholder header auth (`X-Admin-Key` + `X-Tenant-Slug`) — to be replaced by Supabase JWT
