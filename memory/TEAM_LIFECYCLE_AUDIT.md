# TEAM LIFECYCLE AUDIT™ · ITER176
## Come nasce, vive e lavora un collaboratore in MOOD for DESIGN

> **Status:** 🔒 ARCHITECTURE AUDIT · 31 May 2026
> **Modalità:** read-only · zero implementazione · zero modifica DB
> **Pre-condizione:** ITER174 CLEAN RESET completato — stato "Founder Only" (1 tenant attivo, 1 utente: `admin@moodfordesign.com`)
> **Companion doc:** `/app/memory/TEAM_COLLABORATION_ARCHITECTURE.md` (ER + assignment model)

---

## §0 · TL;DR (3 osservazioni cardinali)

**OSSERVAZIONE 1 — L'invito collaboratore È GIÀ COSTRUITO.**
`POST /api/members/invite` + Supabase Admin API + magic-link + license capacity + `member_invites` audit log + frontend drawer (`MembersPage.jsx`) sono operativi e mountati nella sidebar (`/settings/members`). **Non è mai stato esercitato in produzione perché non era ancora arrivato il momento di invitare nessuno.** Il sistema è pronto a ricevere il primo Designer.

**OSSERVAZIONE 2 — Esistono DUE sottosistemi "Team" paralleli, non unificati.**
- Layer canonico **`members`** (RBAC + invite) usa `users_profile` + `tenant_memberships` + 8 ruoli in `core/permissions.py`.
- Layer roster **`orchestra-e/team`** (HR-meta) usa `studio_team_members` + 9 ruoli locali (Direttore Creativo, Interior Designer, ecc.).
- **Stessa parola "team", due tabelle, due cataloghi ruoli, due endpoint.** Nessun sync formale.

**OSSERVAZIONE 3 — Il modello dati assignment è oggi un "single-handed" implicito.**
Ogni nuovo cliente che arriva via Begin Journey viene auto-assegnato a **`admin@moodfordesign.com`** come unico referente (via `human_assignments` con `assignment_reason='only_available_user'`). Non esiste `design_journey_assignments` (proposto in TEAM_COLLABORATION_ARCHITECTURE §3.1, non implementato). Una journey ha 4 campi ownership sparsi (`leads.designer_assigned`, `accounts.primary_owner_id`, `projects.assigned_to`, `design_journeys.created_by`) senza concetto di "team contributori".

---

## §1 · STATO ATTUALE per asse

### Legenda classificazione
- 🟢 **Già pronto** — operativo, esercitabile dal Founder oggi
- 🟡 **Parziale** — codice esiste ma manca un pezzo (DB enum, UI, test, end-to-end)
- 🔴 **Mancante** — feature non esiste o esiste solo come placeholder

---

### 1.1 · CREAZIONE COLLABORATORE 🟡

| Componente | Stato | Riferimento codice |
|---|---|---|
| Endpoint backend | 🟢 | `POST /api/members/invite` in `/app/backend/routers/members.py:208` |
| Frontend pagina | 🟢 | `/app/frontend/src/pages/settings/MembersPage.jsx` (471 righe, drawer invito + tabella + filter) |
| Sidebar entry | 🟢 | `feature_modules_registry` → `team` (group `studio-os`, route `/settings/members`, state `enabled`) |
| Route protezione | 🟢 | `StudioAdminRoute` (App.js:289) — solo `tenant_admin` / `super_admin` |
| RBAC capacity check | 🟢 | `assert_capacity(tenant_id, "users")` — license-aware prima di chiamare Supabase |
| DB scrittura | 🟢 | crea `users_profile (status=invited)` + `tenant_memberships` + `member_invites` |
| Audit log | 🟢 | `audit_log(..., "member.invited", ...)` |
| **Enum DB `users_profile.role`** | 🔴 | **L'enum DB accetta solo `client` e `super_admin`** — invitare un `designer` fallirà con `invalid_text_representation` |
| Idempotenza | 🟢 | 409 se email già nel tenant; multi-tenant via `tenant_memberships` |

**Verdetto §1.1:**
Il flow esiste fino al 95%. ⚠️ Il **blocker** è una migration DB che estenda l'enum `user_role` a `{client, super_admin, tenant_admin, designer, editor, project_manager, analyst, ad_partner}`.

**Stima per attivarlo:** 1 migration + smoke test = 1 ora.

---

### 1.2 · INVITO COLLABORATORE 🟡

**Flow desiderato:**
```
Founder/Admin → Invita → Email magic-link → Set password → Accesso
```

**Stato attuale:**
| Step | Stato | Note |
|---|---|---|
| 1. Founder apre `/settings/members` | 🟢 | esiste, sidebar ✓ |
| 2. Click "Invita membro" → drawer | 🟢 | `MembersPage.jsx` |
| 3. POST `/api/members/invite` | 🟡 | OK fino al DB enum (vedi §1.1) |
| 4. Supabase Admin API → `/auth/v1/admin/invite` | 🟢 | `members.py:_supabase_invite_user` invoca `POST /auth/v1/admin/invite` con `data` metadata + redirect |
| 5. Email magic-link inviata da Supabase | 🟡 | **Dipende dalla SMTP configurata nel Supabase project**. Codice ha fallback `_supabase_create_user_no_email` (silent create) → user dovrà usare `/forgot-password` |
| 6. Magic link → landing su frontend | 🟢 | `/auth/callback` esistente (vedi `services/auth_redirect.py`) |
| 7. Set password → accesso | 🟢 | flow Supabase Auth standard |
| 8. `users_profile.status='invited'` → `'accepted_at'` | 🔴 | **Nessun listener esistente che marchi `accepted_at=now()` quando l'invited user fa il primo login.** Lo status resterebbe `invited` per sempre |

**Gap:**
- 🔴 **Webhook/listener "first-login accepted"** mancante. Senza, `MembersPage` mostrerà sempre "Invited" anche dopo che il designer ha effettivamente loggato.
- 🟡 SMTP Supabase: andrebbe verificato che il progetto cliente abbia SMTP configurato (al momento sconosciuto).
- 🟢 `POST /api/members/{id}/resend-invite` (riga 324) gestisce rinvio.

**Rischi:**
- R1 · Lo status `invited` persistente confonde l'admin (sembra che il designer non abbia mai accettato anche se sta lavorando).
- R2 · Se SMTP Supabase non è configurato, il fallback silent create funziona ma il designer deve essere informato off-band ("ti ho creato l'account, vai su /forgot-password").

**Verdetto §1.2:** flow al 70%. Manca: 1 hook server-side che ribalta lo status post-first-login.

---

### 1.3 · RUOLI 🟡

#### 1.3.1 · Catalogo ruoli **CANONICI** (`/app/backend/core/permissions.py`)

| Ruolo | Permessi (Set) | Dove vive | Note |
|---|---|---|---|
| `super_admin` | `_TENANT_FULL` ∪ {super:*} | `users_profile.role` + `is_root_superadmin=true` | Founder ROOT |
| `tenant_admin` | `_TENANT_FULL` (members:RW, settings, branding, locales, storage, collab, leads/projects/proposals/moodboards/inspirations/insights full) | `users_profile.role` | Manager dello studio |
| `editor` | leads/projects/proposals/moodboards/inspirations RW + storage RW + collab RW | `users_profile.role` | Content/copy editor |
| `project_manager` | leads/projects/proposals RW + proposals:approve + storage RW + collab RW | `users_profile.role` | PM |
| `designer` | projects:R, moodboards RW, proposals:R, inspirations RWP, storage RW, collab RW | `users_profile.role` | Designer |
| `analyst` | tutto :R su leads/projects/proposals/moodboards/inspirations/insights | `users_profile.role` | Read-only |
| `client` | projects:R, proposals R+approve, moodboards R, inspirations RW, collab RW | `users_profile.role` | Cliente esterno |
| `ad_partner` | projects:R, moodboards R, inspirations R | `users_profile.role` | A&D partner esterno |

**Dove vengono salvati:** colonna `users_profile.role` (string · enum DB).
**Cosa possono vedere/modificare:** computato runtime da `ROLE_PERMISSIONS[role]` in `core/permissions.py` (sorgente di verità per backend `require_permission`).

#### 1.3.2 · Catalogo ruoli **HR-roster** (`studio_orchestra.py:ROLE_LABELS`)

| Ruolo | Label IT | Layer | Note |
|---|---|---|---|
| `founder` | Fondatore | `studio_team_members.role` | label-only, no permission mapping |
| `creative_director` | Direzione creativa | `studio_team_members.role` | |
| `interior_designer` | Interior designer | `studio_team_members.role` | |
| `material_specialist` | Specialista materiali | `studio_team_members.role` | |
| `architect` | Architetto | `studio_team_members.role` | |
| `project_coordinator` | Project coordinator | `studio_team_members.role` | |
| `account_director` | Account director | `studio_team_members.role` | |
| `collaborator` | Collaboratore | `studio_team_members.role` | |
| `observer` | Osservatore | `studio_team_members.role` | |

**Dove vengono salvati:** `studio_team_members.role` (string · no enum DB).
**Cosa possono vedere/modificare:** **NIENTE in termini di permission** — questi sono solo etichette HR-pubbliche per la "Card Referente" cliente e il modulo Team admin.

#### 1.3.3 · Mismatch dei due cataloghi

| `users_profile.role` (RBAC) | `studio_team_members.role` (HR) |
|---|---|
| `tenant_admin` | – |
| `designer` | `interior_designer` |
| `project_manager` | `project_coordinator` |
| – | `account_director` |
| – | `creative_director` / `material_specialist` / `architect` |
| `editor` | – |

**Problema:** quando inviti un membro, il `MembersPage` chiede di scegliere un ruolo CANONICO (es. `designer`). Quando lo stesso membro deve essere mostrato come "Card Referente" al cliente, il sistema cerca in `studio_team_members.role_label_it/en` che però non viene popolato automaticamente. **Manca trigger che dato `users_profile.role` produca un `studio_team_members` row con role HR equivalente.**

#### 1.3.4 · Tabella riassuntiva

| Ruolo proposto dall'utente | Mapping canonico | Mapping HR | Stato |
|---|---|---|---|
| `root_super_admin` | `super_admin` + `is_root_superadmin=true` | `founder` | 🟢 |
| `super_admin` | `super_admin` | – | 🟢 |
| `admin` | `tenant_admin` | – | 🟡 (enum DB manca) |
| `project_manager` | `project_manager` | `project_coordinator` | 🟡 |
| `designer` | `designer` | `interior_designer` | 🟡 |
| `sales` | non esiste | non esiste | 🔴 |
| `advisor` | non esiste (ITER173 freeze) | `collaborator` (proxy) | 🟡 (frozen) |
| `client` | `client` | – (vive in CRM, NON in team roster) | 🟢 |

**Verdetto §1.3:** RBAC backend è completo. Manca: (a) migration enum DB (b) bridge tra canonico↔HR (c) ruolo `sales` se serve.

---

### 1.4 · TEAM MANAGEMENT 🟡

#### Cosa contiene OGGI il modulo Team

**Modulo canonico** `/settings/members` (lista da `GET /api/members`):
- Legge: `users_profile WHERE tenant_id=ctx.tenant_id` (TUTTE le righe, qualunque ruolo).
- **Oggi (post-ITER174): mostra SOLO `admin@moodfordesign.com` (super_admin, root).**
- ⚠️ Se in futuro inviti `client`, anche loro appaiono qui (sbagliato per UX). Filtro `role != 'client'` necessario per separare Team vs CRM.

**Modulo HR** `/api/orchestra-e/team` (non mountato nella sidebar V1):
- Legge: `studio_team_members WHERE tenant_id=ctx.tenant_id AND status='active'`.
- **Oggi: 0 righe per tutti i tenants. Vuoto.**
- Idea originale: lo studio compila bio/specialties/visibility per ciascun membro per esporlo come "Card Referente" al cliente.

#### Cosa NON è Team (è CRM)

| Entità | Dove vive | Modulo |
|---|---|---|
| `leads` (potenziale cliente, pre-conversazione) | `leads` table | CRM: `/relations/leads` (route presente, registered in `feature_modules_registry`) |
| `prospects` | concept · non implementato come tabella dedicata | CRM: `/relations/prospects` (route placeholder) |
| `accounts` (cliente convertito) | `accounts` table | CRM: `/relations/accounts` |
| `contacts` (persone in un account) | `contacts` table | CRM: dentro account detail |
| `client` users (auth.users dei clienti) | `users_profile.role='client'` | **NON** dovrebbe apparire in Team. Vive sul Client Workspace (`/client/*`). Oggi `MembersPage` non li filtra! 🔴 |

#### Verdetto §1.4: il modulo Team **mescola team interni e clienti**

| Concetto | Tabella sorgente | Filtro UI corretto | Stato |
|---|---|---|---|
| Team (chi è studio) | `users_profile` | `role NOT IN ('client')` | 🔴 manca filtro |
| Clienti (CRM) | `accounts` + `users_profile.role='client'` | route separate `/relations/accounts` | 🟢 separato lato UI |
| Roster HR-pubblico (Card Referente) | `studio_team_members` | API a parte | 🟡 vuota |

**Azione richiesta:** in `members.py:list_members` aggiungere filtro default `role != 'client'` (parametrizzabile).

---

### 1.5 · DESIGN JOURNEY ASSIGNMENT™ 🔴

#### Oggi · cosa esiste per "chi possiede una journey"

| Campo | Tabella | Tipo | Popolato |
|---|---|---|---|
| `created_by` | `design_journeys` | UUID → `users_profile.id` | Sì (= chi avvia la journey, oggi sempre admin) |
| `assigned_to` | `projects` | UUID → `users_profile.id` | Sì (set in `journey_initiate`, sempre admin) |
| `designer_assigned` | `leads` | TEXT free-form | Legacy, non FK |
| `primary_owner_id` | `accounts` | UUID → `users_profile.id` | Set in `journey_initiate` (admin) |
| `assignee_user_id` | `human_assignments` | UUID + `subject_type='client'` | Sì (sempre admin) |

**Mancano:**
- 🔴 Tabella `design_journey_assignments` (proposta in TEAM_COLLABORATION_ARCHITECTURE §3.1)
- 🔴 Concetto di "contributor secondario" / "observer"
- 🔴 Endpoint `POST /api/admin/journeys/{jid}/assignments`
- 🔴 Vista "Le mie journey" per ogni team member

#### Modello target consigliato (da TEAM_COLLABORATION_ARCHITECTURE §3)

```
design_journey_assignments
─────────────────────────────────────────
journey_id        FK design_journeys
user_id           FK users_profile
assignment_role   ENUM (owner | contributor | observer)
client_visible    BOOLEAN
assigned_by       FK users_profile
assigned_at       TIMESTAMPTZ
revoked_at        TIMESTAMPTZ NULL
UNIQUE (journey_id, user_id) WHERE revoked_at IS NULL
```

| Concetto user | Tecnico |
|---|---|
| Journey Owner | `assignment_role='owner'` · 1 sola riga attiva |
| Assigned Team (visibili al cliente) | `assignment_role='contributor' AND client_visible=true` |
| Internal Contributors | `assignment_role IN ('contributor','observer') AND client_visible=false` |
| Reviewer | proposta: aggiungere `'reviewer'` come `assignment_role` (read+comment-only) |

**Vincoli proposti:**
- 1 owner sempre attivo per journey con `lifecycle_state ≠ 'closed'`.
- Solo membri `users_profile.status='active'` invitabili.
- Owner suspension → trigger alert all'admin per riassegnare.
- Magic-link cliente assegna implicitamente l'owner (oggi: `human_assignments` con `assignment_reason='only_available_user'`).

---

### 1.6 · NOTIFICATION MODEL™ 🟡

#### Stato componenti

| Componente | Stato | File |
|---|---|---|
| Bell badge in Topbar | 🟢 | `Topbar.jsx:18 NotificationBell` |
| Lista notifiche `/api/orchestra-e/notifications` | 🟢 | `studio_orchestra.py:67` |
| Unread count `/api/orchestra-e/notifications/unread-count` | 🟢 | `studio_orchestra.py:89` |
| Mark read / mark-all-read | 🟢 | `studio_orchestra.py:102, 122` |
| Tabella `relationship_notifications` | 🟢 esistente · 0 righe | DB |
| Tabella `notifications` (core) | 🟡 esistente · 0 righe · doppione | DB |
| Email channel | 🟢 | `services/email_service.py` (ITER173 P1 templates + tenant_email_identity fallback) |
| Pulse™ channel | 🟢 | `/api/dashboard/pulse` (atelier dashboard signals) |
| Domain event bus | 🔴 | Non esiste |
| Audience resolver | 🔴 | Non esiste (codice scrive nel target table direttamente, non c'è fan-out) |
| User notification prefs | 🔴 | Nessuna tabella `user_notification_prefs` |
| Dedup / throttling | 🔴 | Non esiste — re-trigger crea duplicati |
| Digest daily | 🔴 | Non esiste |

#### Eventi cliente — copertura attuale

| Evento | Email | In-app | Pulse | Note |
|---|---|---|---|---|
| `journey.created` (Begin Journey) | 🟢 (welcome email via `space_ready:it` template) | 🟡 viene creato `relationship_threads` riga ma non `relationship_notifications` per il referente | 🟡 PULSE legge da `journey_*` direttamente | parzialmente coperto |
| `journey.brief_updated` (voice) | 🔴 nessuna email al referente | 🔴 nessuna `relationship_notifications` row | 🟡 PULSE indica progresso | mancante per il team |
| `journey.message_sent` (conversation) | 🔴 | 🟡 dipende da `client_messages` (oggi non collegato a notification table) | 🔴 | gap significativo |
| `journey.recall_requested` | 🔴 (oggi nessun trigger automatico) | 🔴 | 🔴 | **gap totale** — `recall_requests=0` post-cleanup, no listener |
| `journey.proposal_shared` | 🟡 esiste in `proposals` module ma non legato a `relationship_notifications` | 🔴 | 🔴 | gap |
| `journey.appointment_confirmed` | 🔴 module appointments non esiste | 🔴 | 🔴 | backlog P0 |
| `auth.magic_link` | 🟢 | – | – | ✅ |
| `journey.assignment_changed` | 🔴 | 🔴 | 🔴 | richiede `design_journey_assignments` |

**Verdetto §1.6:** infrastruttura in-app + Pulse + email ESISTE separatamente. **Manca il bus che li orchestri.** Senza bus, ogni router scrive a mano in 1 dei 3 canali → coverage incoerente, no dedup, no preferenze.

---

### 1.7 · CLIENT VISIBILITY™ 🟡

Principio target (da spec utente):
- **Sempre visibile**: referente principale
- **Facoltativo**: designer assegnati
- **Mai visibile**: collaboratori interni non coinvolti

#### Stato attuale endpoint client

| Endpoint | Cosa restituisce oggi | Conforme al principio? |
|---|---|---|
| `GET /api/client/welcome-summary` | `.referente = { first_name, role_label, avatar_url, ... }` derivato da `human_assignments WHERE subject_type='client'` (= sempre admin oggi) | 🟢 mostra solo 1 persona (referente principale) — corretto |
| `GET /api/client/journeys/{jid}/companion` | Section "conversation" thread participants | 🟡 thread participants oggi sono solo {client, admin}, ma se domani aggiungiamo contributor potrebbero leakare |
| `GET /api/orchestra-e/team` (admin-only) | TUTTI gli `studio_team_members` | 🟢 endpoint NON chiamato dal client (è admin-only) — safe |
| `GET /api/storefront/public/{slug}/team-leaders` | Public marketing team | 🟢 by-design pubblico (è il sito vetrina) |
| `GET /api/client/journeys/{jid}/team` | **NON ESISTE** | 🔴 endpoint mancante per "Il tuo team" filtrato |

#### Filtri di sicurezza necessari (proposti, NON implementati)

1. Mai esporre `email`, `phone`, `internal notes`, `last_login_at` di un team member al cliente.
2. Mai esporre `tenant_admin`/`super_admin` come team member, a meno che `tenant_settings.show_founder_in_team=true`.
3. Mai esporre membri con `studio_team_members.visibility='studio_only'`.
4. Mai esporre `assignment_role='observer'` o `client_visible=false`.

**Verdetto §1.7:** principio rispettato OGGI perché c'è 1 solo utente operativo (admin = referente). Diventerà critico nel momento in cui inviti il primo Designer e devi decidere "il cliente vede anche lui?".

---

### 1.8 · DESIGNER WORKSPACE™ 🟡

#### Cosa vede oggi un utente dopo il login (assumendo `role='designer'` permesso dall'enum)

| Surface | Esiste? | File / route |
|---|---|---|
| **Dashboard cockpit** | 🟢 | `/dashboard` → `DashboardPage.jsx` (cockpit operativo) |
| **AssignedClientsPanel** (inbox cliente assegnati) | 🟢 | `components/dashboard/AssignedClientsPanel.jsx` legge `GET /api/client-messages/assignee/queue` |
| **Studio Onboarding checklist** | 🟢 | `StudioOnboardingPanel` legge `/api/tenant-onboarding/status` |
| **RelationshipLiveTimeline** | 🟢 | timeline live delle relazioni |
| **JourneyPulsePage** | 🟢 | `/admin/pulse` (gated `super_admin`) — pulse aggregato |
| **AtelierDashboardPage** | 🟢 | `/atelier-dashboard` — dashboard cinematica B-wave (DB-driven config) |
| **ProjectsPage** | 🟢 | `/workspace/projects` |
| **DesignerConversationsPage** | 🟢 | `/workspace/conversations` (130 righe, esiste) |
| **LeadsPage** legacy + **/relations/leads** | 🟢 (legacy redirect) | `/relations/leads` |
| **Inbox dedicato a designer** (separato da assigned clients) | 🟡 | `AssignedClientsPanel` è l'inbox; non c'è una pagina /inbox standalone |
| **Tasks system** | 🔴 | `tasks` table esiste (0 righe), no UI, no endpoint pubblico |
| **Mie journey assegnate** | 🟡 | derivato da `human_assignments` (oggi 0). Non c'è una pagina "Le mie journey" dedicata |
| **Notification center dedicato** | 🟡 | bell badge esiste (Topbar), no full-page `/notifications` |

#### Gating ruoli (App.js)

```js
StudioRoute → exclude 'client', redirect to /client
StudioAdminRoute → exclude tutto tranne tenant_admin / super_admin
```

⚠️ **Oggi** un utente con `role='designer'` passerebbe `StudioRoute` MA fallirebbe `StudioAdminRoute`. Il designer vede dashboard + workspace pages, MA non `/settings/members` (corretto), né `/admin/*` (corretto), né `/settings/brand` (corretto).

**Verdetto §1.8:** workspace designer è 70% pronto. Manca: (a) enum DB per abilitare `role='designer'` (b) pagina "Le mie journey" (c) task system.

---

## §2 · TEAM ONBOARDING TEST™ (simulazione teorica)

```
admin@moodfordesign.com  →  Invita Designer A  →  Designer A accetta
   ↓                                                    ↓
Crea Cliente (Begin Journey) → Crea Journey → Assegna Designer A → Designer riceve attività
```

### Step-by-step

| # | Azione | Sistema | Stato | Note bloccanti |
|---|---|---|---|---|
| 1 | Admin va su `/settings/members` | Frontend route esiste, sidebar entry esiste | 🟢 | – |
| 2 | Click "Invita membro", scelta ruolo `designer` | Drawer in `MembersPage.jsx` | 🟢 | – |
| 3 | POST `/api/members/invite` | Backend `members.py` | 🟡 | **🔴 BLOCKER**: enum DB `users_profile.role` non accetta `designer` → 500 `invalid_text_representation` |
| 4 | Supabase Admin API crea auth.user + invia magic-link | `_supabase_invite_user` | 🟡 | dipende da SMTP configurato sul Supabase project |
| 5 | Designer A apre email, click magic-link | Supabase Auth | 🟢 | – |
| 6 | Designer A imposta password | Supabase Auth | 🟢 | – |
| 7 | Designer A reindirizzato su `/dashboard` | `auth_redirect.py` | 🟢 | – |
| 8 | Backend marca `users_profile.status='active'` + `accepted_at=now()` | 🔴 listener mancante | 🔴 | resta `invited` a vita |
| 9 | Designer A vede DashboardPage + AssignedClientsPanel (vuoto) | OK | 🟢 | – |
| 10 | Admin crea Cliente test via Begin Journey (form pubblico) | `POST /api/public/journeys/initiate` | 🟡 | ⚠️ bug pre-esistente metadata_json (ITER174 §7) se manca country_code |
| 11 | Lead/Account/Contact/Project/Journey creati | `journey_initiate.py` | 🟢 | – |
| 12 | Auto-assignment al referente | `human_assignments` con `subject_type='client'` | 🟢 (sempre admin) | – |
| 13 | Admin ri-assegna Designer A come owner della Journey | **🔴 ENDPOINT MANCANTE**: nessun `PATCH /api/admin/journeys/{jid}/owner` né `POST /api/admin/journeys/{jid}/assignments` | 🔴 | possibile solo via raw SQL UPDATE `projects.assigned_to` + `human_assignments` |
| 14 | Designer A vede il cliente in `AssignedClientsPanel` | legge `client-messages/assignee/queue` filtrato per `assignee_user_id=current_user` | 🟢 | works se Step 13 aggiorna `human_assignments` |
| 15 | Designer A invia primo messaggio | `client_messages` router | 🟢 | – |
| 16 | Cliente riceve email + in-app + Pulse | 🟡 oggi solo email (welcome). Nessun notification dispatch per messaggi | 🟡 | gap §1.6 |
| 17 | Admin riceve audit visibility "Designer A ha contattato Cliente X" | 🔴 audit_log scrive, ma no UI di consultazione log per admin | 🔴 | – |

### Sintesi simulation

| Stato | Step blocking |
|---|---|
| 🟢 Funziona oggi | 1, 2, 4-7, 9, 11, 12, 14-15 |
| 🟡 Funziona con caveat | 4 (SMTP), 10 (bug metadata_json), 16 (notification gap) |
| 🔴 BLOCCA il flow | **3** (enum DB), **8** (no first-login listener), **13** (no assignment endpoint) |
| 🔴 Manca ma non blocca | 17 (admin audit UI) |

**Tempo stimato per sbloccare il flow E2E:** 1-2 giorni.

---

## §3 · FLUSSI ESISTENTI · MAP

```
┌────────────────────── INVITE FLOW (95% pronto) ───────────────────────┐
│                                                                       │
│  Admin → /settings/members  → POST /api/members/invite               │
│         (UI ready)            (capacity check → Supabase Admin API)  │
│                                ↓                                      │
│                            Email magic-link (Supabase SMTP)          │
│                                ↓                                      │
│                            Designer clicks → /auth/callback          │
│                                ↓                                      │
│                            Set password → /dashboard                 │
│                                ↓                                      │
│                            ⚠ status stays 'invited' (gap)            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌────────────────────── CLIENT JOURNEY FLOW (100% pronto) ─────────────┐
│                                                                       │
│  Public → /  → Begin Journey form                                    │
│              → POST /api/public/journeys/initiate                    │
│                ├ create lead/account/contact/project/journey         │
│                ├ create human_assignment (subject=client → admin)    │
│                ├ create magic_link                                   │
│                ├ create thread + welcome message                     │
│                └ send welcome email (space_ready:it)                 │
│                                                                       │
│  Client → magic-link → /auth/client/callback → /journey/:jid         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌────────────────────── ASSIGNED CLIENTS QUEUE (lato studio) ─────────┐
│                                                                       │
│  Designer logged in → /dashboard                                     │
│                       → AssignedClientsPanel mounts                  │
│                       → GET /api/client-messages/assignee/queue      │
│                          (joins human_assignments WHERE assignee=me)  │
│                       → row per cliente con first_contact_status     │
│                       → "Suggerisci messaggio" (AI) + "Invia"        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## §4 · FLUSSI MANCANTI · ROADMAP

### 4.1 · Lifecycle handoff (status accepted)
**Goal:** quando il designer fa il primo login post-invito, `users_profile.status` passa da `invited` ad `active` e si setta `accepted_at`.

**Implementazione minima:** hook nel callback Supabase Auth o webhook event `user.signed_in` → `UPDATE users_profile SET status='active', accepted_at=NOW() WHERE auth_user_id=:uid AND status='invited'`.

**Stima:** 2 ore.

### 4.2 · Journey assignment endpoint
**Goal:** admin/owner può assegnare/riassegnare team su una journey.

**Componenti:**
- Migration `design_journey_assignments` (spec §3.1 TEAM_COLLABORATION_ARCHITECTURE)
- `POST /api/admin/journeys/{jid}/assignments` body `{user_id, assignment_role, client_visible}`
- `PATCH /api/admin/journeys/{jid}/assignments/{aid}` revoke
- `GET /api/admin/journeys/{jid}/assignments` list
- Backfill: per ogni journey esistente, crea row `(journey_id, projects.assigned_to, 'owner', client_visible=true)`

**Stima:** 1 giorno.

### 4.3 · Domain Event Bus (lightweight)
**Goal:** ogni "Client Event" emette su un bus → 3 channel routers (email, in-app, pulse) fan-out.

**Componenti:**
- `core/events.py` con `emit(event_key, payload)`
- Channel routers che ascoltano e scrivono nel target appropriato
- Tabella `notification_events` per audit + dedup `(event_key, dedup_key, dispatched_at)`
- User preferences: `user_notification_prefs` table

**Stima:** 3-4 giorni.

### 4.4 · "Le mie journey" page per Designer
**Goal:** ogni team member vede una pagina con SUE journey (owner + contributor).

**Componenti:**
- `GET /api/workspace/journeys/mine` filtra per `assignments WHERE user_id=current_user`
- Page `/workspace/journeys` con cards o table
- Sidebar entry (gated `role IN (designer, project_manager)`)

**Stima:** 1-2 giorni.

### 4.5 · "Il tuo team" client view
**Goal:** cliente vede sezione filtrata del team assegnato alla sua journey.

**Componenti:**
- `GET /api/client/journeys/{jid}/team` con filtri di visibilità §5 TEAM_COLLABORATION_ARCHITECTURE
- Sezione nel `BriefGuidedPage` o `ClientWelcomePresetPage`

**Stima:** 1 giorno.

### 4.6 · Team filter su MembersPage
**Goal:** non mostrare `role='client'` nel modulo Team.

**Implementazione:** 1 riga in `members.py:list_members` → `q = q.neq('role', 'client')` di default, parametrizzabile.

**Stima:** 30 minuti.

### 4.7 · Audit log UI
**Goal:** admin può consultare audit_logs.

**Componenti:**
- `GET /api/admin/audit-logs?subject_id=…` (esiste backend?)
- Page `/admin/audit` con filter (oggi `audit_logs` table esiste, 0 righe post-cleanup, ma viene scritta su ogni `audit_log()` call).

**Stima:** 1 giorno (low priority).

---

## §5 · MODELLO TARGET CONSIGLIATO

### 5.1 · Schema lifecycle utente (state machine)
```
auth.users (Supabase)
   └─ users_profile (canonical: 1 row per (auth_user_id, tenant_id))
       ├─ status: invited → active → suspended → (deleted)
       ├─ role:   canonical RBAC permission set
       └─ FK ─→ tenant_memberships (multi-tenant future)
                └─ FK ─→ studio_team_members (HR/public roster · OPTIONAL)
                         └─ FK ─→ design_journey_assignments (per-journey · OPTIONAL)
```

### 5.2 · Separazione concettuale STRETTA
```
┌───────────────────────────┬───────────────────────────────────┐
│  TEAM (interni studio)    │  CRM (esterni · clienti)          │
├───────────────────────────┼───────────────────────────────────┤
│ users_profile.role IN     │ users_profile.role = 'client'     │
│   (tenant_admin,          │   + leads, accounts, contacts,    │
│    designer,              │     projects                      │
│    project_manager,       │                                   │
│    editor, analyst)       │                                   │
│                           │                                   │
│ Modulo: /settings/members │ Modulo: /relations/*              │
│ Sidebar: studio-os        │ Sidebar: client-relations         │
│                           │                                   │
│ Endpoint admin:           │ Endpoint admin:                   │
│   /api/members            │   /api/leads, /api/accounts, ...  │
│                           │                                   │
│ Roster pubblico (Card):   │ Workspace cliente:                │
│   studio_team_members     │   /client/*, /journey/:jid        │
│                           │                                   │
│ Visibilità cliente:       │ Visibilità tra clienti:           │
│   filtered by assignment  │   ZERO (isolamento totale)        │
└───────────────────────────┴───────────────────────────────────┘
```

### 5.3 · Catalogo ruoli unificato (proposta)
Una sola lista di ruoli, mapping 1:1 tra RBAC e HR-label.

| Canonical role | Default HR label IT | Default HR label EN | Permission set | Client-visible default |
|---|---|---|---|---|
| `super_admin` | Founder | Founder | tutto | configurabile (default no) |
| `tenant_admin` | Direzione | Studio Director | _TENANT_FULL | sì |
| `creative_director` | Direzione creativa | Creative Director | designer + project_manager | sì |
| `project_manager` | Project coordinator | Project Coordinator | project_manager set | sì |
| `designer` | Interior designer | Interior Designer | designer set | sì |
| `editor` | Content editor | Content Editor | editor set | no |
| `analyst` | Analista | Analyst | read-only | no |
| `material_specialist` | Specialista materiali | Material Specialist | designer subset | sì |
| `account_director` | Account director | Account Director | leads + projects RW | sì |
| `ad_partner` | A&D partner | A&D Partner | restricted | sì (no email/phone) |
| `observer` | Osservatore | Observer | read-only | no |
| `client` | (Cliente) | (Client) | client set | – (è il cliente stesso) |

**Implementazione:** estendere enum DB + creare seed in `feature_modules_registry` o tabella dedicata `studio_role_catalog`.

---

## §6 · RISCHI

| # | Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|---|
| R1 | Enum DB `user_role` blocca primo invite | 100% (verificato) | 🔴 BLOCCANTE | migration prima del primo invite |
| R2 | Status `invited` persistente | 90% | 🟡 UX poor | hook first-login |
| R3 | SMTP Supabase non configurata | 50% | 🟡 silent fallback funziona | verificare progetto Supabase |
| R4 | Modulo Team mostra anche client | 100% se ci sarà più di 1 client | 🟡 UX confusa | filtro `role != 'client'` |
| R5 | Senza domain event bus, notifiche per nuovi eventi vanno scritte 1 per 1 | 100% | 🟠 debt cresce | implementare bus prima di 5+ eventi |
| R6 | Nessun journey assignment table → 1 sola persona può gestire ogni cliente | 100% post-onboarding designer | 🔴 BLOCCA scaling | migration + endpoint §4.2 |
| R7 | `studio_team_members` resta vuoto → "Card Referente" cliente cade su fallback "nome studio" | 100% | 🟡 estetico | seed admin + automation post-invite |
| R8 | Mismatch ruoli `permissions.py` vs `ROLE_LABELS` orchestra-e | 100% | 🟡 confusione future-state | unificare cataloghi |
| R9 | Audit log non leggibile da UI → forensics difficile | 100% | 🟢 BASSO | UI in backlog |

---

## §7 · PRIORITÀ IMPLEMENTATIVE (consigliata)

### 🔴 Phase 0 · Unblock invite (1 giorno)
1. **Migration enum `user_role`** → aggiungere `tenant_admin, designer, editor, project_manager, analyst, ad_partner` ai valori validi
2. **First-login listener** → marca `accepted_at` + status `active`
3. **Filter `role != 'client'`** in `members.list_members`
4. **Verifica SMTP Supabase** + documenta fallback procedure
5. **Smoke test E2E**: admin invita designer → designer accetta → designer vede dashboard

**Esito:** primo Designer onboardable.

### 🟠 Phase 1 · Foundation Journey Assignment (2-3 giorni)
6. Migration `design_journey_assignments` table
7. Backfill da `projects.assigned_to` + `human_assignments`
8. CRUD endpoint admin assignments
9. Aggiornare `journey_initiate.py` per scrivere assignment row alla creazione (oltre a `human_assignments`)
10. Mini-UI drawer "Assegna team" nel detail journey

**Esito:** journey può avere owner + contributors espliciti.

### 🟡 Phase 2 · Designer Workspace (2 giorni)
11. Page `/workspace/journeys/mine` legge da `assignments WHERE user_id=current_user`
12. Sidebar entry "Le mie journey" (gated `role IN (designer, project_manager, creative_director)`)
13. Polish AssignedClientsPanel: ora legge anche da `assignments` oltre a `human_assignments`

**Esito:** designer ha vista dedicata su carico lavoro.

### 🟡 Phase 3 · Notification Bus (3-4 giorni)
14. Domain events catalogue (`core/events.py`)
15. Channel routers (email/in-app/pulse) listening
16. `user_notification_prefs` table + endpoint
17. Dedup + throttling layer
18. Migrare scritture esistenti su bus

**Esito:** notifiche coerenti su 3 canali per ogni evento.

### 🟢 Phase 4 · Client View polish (1-2 giorni)
19. `GET /api/client/journeys/{jid}/team` con filtri visibilità §5 TEAM_COLLABORATION_ARCHITECTURE
20. Sezione "Il tuo team" nell'Atelier client workspace (opzionale, depending on Q2 risposta Founder)
21. Cascade referente §5.1 TEAM_COLLABORATION_ARCHITECTURE

**Esito:** cliente vede team filtrato in modo cinematic.

### 🟢 Phase 5 · Consolidation (2 giorni)
22. Unificare cataloghi ruoli (`permissions.py` ↔ `ROLE_LABELS`)
23. Trigger automatico: alla creazione `users_profile` con role studio → crea row `studio_team_members` minimale
24. Consolidare `notifications` vs `relationship_notifications` (Q7 architecture)

---

## §8 · CLASSIFICAZIONE SINTETICA per asse

| Asse | Backend | Frontend | DB | Verdetto |
|---|---|---|---|---|
| Creazione collaboratore | 🟢 endpoint pronto | 🟢 MembersPage | 🔴 enum DB | 🟡 |
| Invito + magic link | 🟢 Supabase Admin | 🟢 invite drawer | 🟢 member_invites | 🟡 (manca first-login listener) |
| Ruoli RBAC | 🟢 permissions.py | 🟢 role picker dinamico | 🔴 enum incompleto | 🟡 |
| Team management (canonico) | 🟢 members router | 🟢 MembersPage | 🟢 users_profile + tenant_memberships | 🟡 (mescola con clients) |
| Team management (HR roster) | 🟢 orchestra-e/team | 🔴 nessuna UI mountata in V1 | 🟢 studio_team_members | 🟡 |
| Journey assignment | 🔴 no endpoint dedicato | 🔴 no UI | 🔴 no design_journey_assignments | 🔴 |
| Notification model | 🟡 3 canali separati | 🟢 bell badge | 🟡 2 tabelle doppione | 🟡 |
| Client visibility | 🟡 dipende da assignment | 🟢 Atelier Card Referente | 🟢 (a livello row) | 🟡 |
| Designer workspace | 🟢 dashboard + workspace | 🟢 AssignedClientsPanel | 🟡 enum DB | 🟡 |
| First contact orchestration | 🟢 client-messages/assignee/queue | 🟢 AssignedClientsPanel | 🟢 human_assignments | 🟢 |

---

## §9 · DOMANDE APERTE (richiedono decisione Founder)

| # | Domanda | Suggestion |
|---|---|---|
| Q1 | Quale catalogo ruoli unificato adottiamo? | Vedi §5.3 (12 ruoli + observer + client) |
| Q2 | Il founder appare di default nella "Card Referente" cliente? | Default NO. Toggle in `tenant_settings.show_founder_in_team` |
| Q3 | 1 owner per journey o co-owners? | 1 owner unique, contributors illimitati |
| Q4 | Internal contributors visibili in timeline cliente (anonimizzati)? | Anonimizzati come "il team dello studio" |
| Q5 | Quando un member viene suspeso, cosa succede alle sue journey assigned? | Auto-revoke + alert admin per riassegnare |
| Q6 | `human_assignments` (legacy) va migrato in `design_journey_assignments`? | Coesistono: human_assignments per `subject_type='client'` (account-level), nuovo schema per journey-level |
| Q7 | Unificare `notifications` ↔ `relationship_notifications`? | SÌ in Phase 3 — 1 sola tabella con `surface` field |
| Q8 | Implementiamo "sales" role? | Solo se modello B2B/showroom richiede. Per ora `account_director` copre |
| Q9 | "Le mie journey" è una sidebar entry o un tab in `/dashboard`? | Sidebar entry sotto `studio-os` (dopo Team) — più discoverable |

---

## §10 · STATO "Founder Only" → PRONTO PER

Dopo ITER174, la piattaforma è PRONTA per:

```
Founder           ✅ (admin@moodfordesign.com, super_admin, root)
   ↓
Invita Team       🟡 (sblocco con 1 migration enum, Phase 0)
   ↓
Crea Cliente      ✅ (Begin Journey funziona end-to-end)
   ↓
Design Journey™   ✅ (canonical Gen 3 Atelier + Brief Guidato™)
```

E può evolvere verso:

```
Designer Workspace™    🟡 (70% pronto — manca enum DB + "Le mie journey" + tasks)
Team Collaboration™    🟡 (50% pronto — manca journey assignment table)
Journey Assignment™    🔴 (0% — migration + endpoint da fare)
Notification Center™   🟡 (60% pronto — bell + 3 canali esistono, manca bus)
```

**Senza compromettere il Design Journey First™:** ✅ (tutto il flusso cliente esistente è intatto e l'aggiunta del team è additiva, non sostitutiva).

---

## §11 · ALLEGATI

- 📁 Companion: `/app/memory/TEAM_COLLABORATION_ARCHITECTURE.md` (ER + notification model + assignment schema)
- 📁 Companion: `/app/memory/ITER174_CLEANUP_REPORT.md` (stato Founder Only)
- 📁 Companion: `/app/memory/test_credentials.md` (admin login)
- 📂 Codice rilevante:
  - `/app/backend/routers/members.py` (invite + RBAC)
  - `/app/backend/routers/studio_orchestra.py` (HR roster + notifications API)
  - `/app/backend/routers/client_messages.py` (assignee queue)
  - `/app/backend/routers/journey_initiate.py` (auto-assignment)
  - `/app/backend/core/permissions.py` (RBAC catalogue)
  - `/app/backend/core/tenant_context.py` (require_permission)
  - `/app/frontend/src/pages/settings/MembersPage.jsx` (invite UI)
  - `/app/frontend/src/components/dashboard/AssignedClientsPanel.jsx` (designer inbox)
  - `/app/frontend/src/components/layout/Topbar.jsx` (NotificationBell)

> ⚠️ Come da direttiva ITER176: zero modifica codice, zero migration, zero invito utenti. Solo audit architetturale.
