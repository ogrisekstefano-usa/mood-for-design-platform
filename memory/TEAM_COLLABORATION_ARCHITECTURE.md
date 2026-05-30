# TEAM COLLABORATION ARCHITECTURE™ · ITER174
## Architettura ER · Ownership · Notification · Assignment
> **Status:** 🔒 ARCHITECTURE PROPOSAL · 30 May 2026
> **Scope:** definire come Team Management, Design Journey™ ownership,
> notifiche e visibilità cliente devono coordinarsi.
> **Read-only audit + proposta · zero implementazione · zero modifiche DB**

---

## §0 · TL;DR

**Stato attuale del modulo "Team":**
1. Esiste già una tabella `studio_team_members` (con relazione 1:1 a `users_profile`) e un router `/api/orchestra-e/team` operativo.
2. **Oggi `studio_team_members` è VUOTA** per tutti i tenant (0 righe).
3. Il modulo "Team" del Founder vede **tutti i `users_profile` con role STUDIO** del tenant — ma oggi nel DB ci sono **solo `client` (8) e `super_admin` (1)** sotto `studio`. **Manca completamente la popolazione del team operativo.**
4. Le journey ownership oggi si basano su 3 campi sparsi: `projects.assigned_to`, `leads.designer_assigned`, `accounts.primary_owner_id`. **Nessun "team assegnato" alla journey come concetto.**
5. Esiste `human_assignments` (9 righe) come tabella generica usata per assegnare il referente al cliente — ma non è esposta nel modulo Team.

**Problema cardine:** il modulo Team oggi mescola **3 concetti distinti**:
- chi è membro dello studio (HR-like roster)
- chi è il referente principale di un cliente (Account Director)
- chi sta lavorando su una specifica Design Journey™ (Project Contributors)

L'audit propone di separarli formalmente con un modello **3-layer** (§3) e definire un protocollo notifiche **3-channel** (§4) e una **vista cliente cinematica selettiva** (§5).

---

## §1 · ENTITÀ AUDITED · CHE COSA SONO OGGI

### 1.1 · `users_profile` (canonico interno + cliente)
Tabella sorgente di verità per ogni essere umano nel sistema. Contiene:
- Studio operativo (designer, project coordinator, ecc.)
- ROOT_SUPERADMIN (Founder)
- **Client users** (post-magic-link)
- Soggetti interni invitati (tenant_admin)

Discriminante: `role` enum DB (`client`, `super_admin`, e in futuro `tenant_admin`, `designer`, `creative_director`, ecc.).

**Oggi 100% delle voci `users_profile` del tenant `studio` sono `client` (8) o `super_admin` (1).** ⚠️ Lo schema enum DB attuale ammette solo `'client'` e `'super_admin'` (verificato: l'enum rejecta `professional`). **Manca migration** per i ruoli studio.

### 1.2 · `studio_team_members` (roster operativo dello studio)
Tabella tenant-scoped (FK `tenant_id` + FK `user_id` → `users_profile.id`). Contiene metadati pubblici del membro del team:
- `role` (designer, project_coordinator, account_director, …)
- `role_label_it/en`
- `specialties`, `territories`, `languages`
- `bio`, `visibility` (`studio_only` | `studio_and_clients` | `public`)
- `status` (active | invited | suspended)

**Oggi 0 righe per tutti i tenants.** Il modulo Team admin esiste ma è vuoto.

### 1.3 · `human_assignments` (orchestrazione runtime)
Tabella generica per assegnare un "umano" a un "soggetto" (cliente, journey, lead, ecc.).
- `subject_type` (`client`, `journey`, `lead`, `account`, …)
- `subject_id` (UUID polimorfico)
- `assignee_user_id` → `users_profile.id`
- `assignment_reason` (`only_available_user`, `manual`, `auto_match`, …)
- `status` (active | reassigned | revoked)
- `first_contact_*` (orchestrazione "primo saluto")

**Oggi 9 righe per `studio`**: tutte hanno `subject_type='client'` e `assignee_user_id` = `caee7b92…` (ROOT_SUPERADMIN — l'unico utente non-client disponibile, da cui `assignment_reason='only_available_user'`).

### 1.4 · `leads` / `prospect` / `accounts` / `contacts` / `projects` / `design_journeys`
Le 6 entità del funnel relazionale. Tutte tenant-scoped. Ownership distribuita:
| Tabella | Campi ownership esistenti |
|---|---|
| `leads` | `assigned_to`, `client_user_id`, `designer_assigned` |
| `accounts` | `primary_owner_id` |
| `contacts` | (nessuno diretto · scope via `account_id`) |
| `projects` | `assigned_to`, `client_user_id` |
| `design_journeys` | `created_by` |

⚠️ **Convenzione poco chiara**: `assigned_to`, `designer_assigned`, `primary_owner_id`, `created_by` sono 4 sinonimi della stessa cosa con semantiche diverse. **Nessun campo "team assegnato"** né "contributori secondari" su `design_journeys`.

### 1.5 · `relationship_notifications` (notifiche in-app)
Tabella per le notifiche in-app dirette a un utente.
- `recipient_user_id` → `users_profile.id`
- `tenant_id`
- `read_at`, `archived_at`, `surface` (es. `journey_pulse_journey`)

Esiste anche `notifications` (generica) usata dal `core/notification_service.py`. ⚠️ Doppione: due tabelle per la stessa funzione, scelta non chiara da codice.

### 1.6 · `journey_pulse` (Pulse™ system esistente)
`/api/dashboard/pulse` aggrega segnali di "ritmo progettuale" già implementati:
- `journey_pulse_journey`, `_voice`, `_chapter`, `_revision`, `_evolution`, `_action`.
È il **third channel** della notifica oltre email + in-app.

---

## §2 · VERIFICA · QUALI ENTITÀ MOSTRA OGGI IL MODULO TEAM

### Modulo Team attuale = `/api/orchestra-e/team` + frontend (oggi non mountato nel V1 chrome)

**Cosa viene letto:** `studio_team_members WHERE tenant_id = ctx.tenant_id AND status='active'`.
Quindi mostra **SOLO** i membri esplicitamente aggiunti via `POST /api/orchestra-e/team`.

**Cosa NON viene mostrato (ma è presente nel tenant):**
- ❌ `users_profile` con `role='super_admin'` non aggiunti come team member.
- ❌ I `client` users (✅ giusto, devono essere esclusi).
- ❌ Gli `human_assignments` (✅ giusto, è meta-orchestrazione).
- ❌ Gli inviti pending (`status='invited'`) — visibile solo via filtro.

**Cosa potrebbe leakare se l'enum DB venisse esteso:**
Una volta che `users_profile.role` supporta `designer`, `creative_director`, ecc., un'eventuale UI che mostra "tutti gli utenti del tenant" mostrerebbe **anche i client** se non filtrato.

### Conclusione §2

| Entità | Mostrata oggi? | Dovrebbe essere mostrata? |
|---|---|---|
| `studio_team_members` riga active | ✅ | ✅ (è il ruolo della tabella) |
| `users_profile.role=client` | ❌ | ❌ (è il cliente, vive nel modulo CRM) |
| `users_profile.role=super_admin` | ❌ | 🟡 **DOVREBBE** essere mostrato come "Founder" automaticamente |
| `users_profile` invitati (no team_member) | ❌ | 🟡 **DOVREBBE** apparire come "In attesa di onboarding" |
| `human_assignments` | ❌ | ❌ (è meta-data orchestrazione, non roster) |
| `leads.designer_assigned` (free text) | ❌ | ❌ (legacy, da migrare a FK) |

---

## §3 · MODELLO PROPOSTO · 3-LAYER OWNERSHIP

### Principio: **separare WHO IS in studio da WHO OWNS un client da WHO WORKS on a journey**

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1 · STUDIO ROSTER                                         │
│ "Chi compone lo studio (HR-like)"                               │
│ Source of truth: studio_team_members                            │
│ Visibilità admin: lista nel modulo Team del Blueprint           │
│ Visibilità cliente: filtrata da `visibility` field              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2 · ACCOUNT OWNERSHIP (Customer Relationship)             │
│ "Chi è il principale referente di un cliente"                   │
│ Source of truth: accounts.primary_owner_id                      │
│ + human_assignments con subject_type='client'                   │
│ Visibilità admin: CRM tab dell'account                          │
│ Visibilità cliente: Card Referente nell'Atelier (1 sola persona)│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3 · JOURNEY ASSIGNMENT (Per-project team)                 │
│ "Chi sta lavorando su QUESTA specifica Design Journey™"         │
│ Source of truth: NUOVO `design_journey_assignments` (proposed)  │
│ Includes: Owner + Contributors + Observers                      │
│ Visibilità admin: Pannello laterale sulla journey               │
│ Visibilità cliente: "Il tuo team" filtrato (vedi §5)            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 · Schema nuovo · `design_journey_assignments`

```
design_journey_assignments
─────────────────────────────────────────────────────────────────
id                       UUID PK
tenant_id                UUID → tenants.id        (NOT NULL · scope)
journey_id               UUID → design_journeys.id (NOT NULL)
user_id                  UUID → users_profile.id   (NOT NULL)
assignment_role          ENUM ('owner','contributor','observer')
                         · owner       → 1 sola riga per journey
                         · contributor → N
                         · observer    → N (read-only)
client_visible           BOOLEAN  default true
                         · owner + contributor "visibili" → true
                         · observer → false (interno)
                         · contributors marked "shadow" → false
assigned_by              UUID → users_profile.id (chi ha fatto l'assignment)
assigned_at              TIMESTAMPTZ
revoked_at               TIMESTAMPTZ NULL (soft delete · keeps history)
revoked_by               UUID → users_profile.id NULL
note                     TEXT NULL (motivazione opzionale)

UNIQUE INDEX (tenant_id, journey_id, user_id) WHERE revoked_at IS NULL
INDEX (tenant_id, journey_id, assignment_role, revoked_at)
INDEX (user_id, revoked_at)   -- per "le mie journey"
```

### 3.2 · Mapping ai concetti utente

| Concetto spec utente | Realizzazione tecnica |
|---|---|
| **Journey Owner** | `design_journey_assignments WHERE assignment_role='owner'` · 1 sola riga attiva per journey |
| **Assigned Team** | `design_journey_assignments WHERE assignment_role='contributor'` |
| **Internal Contributors** | `design_journey_assignments WHERE assignment_role IN ('contributor','observer') AND client_visible=false` |

### 3.3 · Coerenza con i campi legacy

| Campo legacy | Cosa diventa |
|---|---|
| `design_journeys.created_by` | resta = chi ha creato la journey (post-rebind) |
| `projects.assigned_to` | sync mirror del `journey_assignments.owner` per backward compat |
| `accounts.primary_owner_id` | resta = Account Director (Layer 2) — può divergere dall'Owner della journey |
| `leads.designer_assigned` (free text) | deprecato, migrare a FK |

### 3.4 · Vincoli (regole di business)
- 1 owner SEMPRE attivo per ogni journey con `lifecycle_state ≠ 'closed'`.
- Solo membri del `studio_team_members` attivi possono essere assegnati.
- Quando un membro `studio_team_members` viene `suspended`, tutte le sue assignments vengono `revoked_at=now()` e si triggera un'alert per il tenant_admin di riassegnare.
- Owner change → invia notifica al client (Layer 5) + al nuovo Owner + all'Owner precedente.

---

## §4 · NOTIFICATION MODEL · 3-CHANNEL

### Principio: ogni "Client Event" → fan-out su 3 canali indipendenti

```
              ┌────────────────────────────────────────┐
              │ CLIENT EVENT (Domain Event Bus)        │
              │ es: brief_updated · message_sent ·     │
              │     recall_requested · proposal_shared │
              └─┬────────────────────────────────────┬─┘
                │                                    │
       ┌────────▼────────┐                  ┌────────▼────────────┐
       │ CHANNEL ROUTER  │                  │ AUDIENCE RESOLVER   │
       │ per-event rules │                  │ vedi §4.2 sotto     │
       └────────┬────────┘                  └────────┬────────────┘
                │                                    │
   ┌────────────┼──────────────┬──────────┐          │
   │            │              │          │          │
   ▼            ▼              ▼          ▼          ▼
EMAIL       IN-APP          PULSE™    DIGEST      (no-op)
(ITER173)   (in-app bell)   (atelier  (daily      eventi a basso
            relationship_  dashboard  email per   priority filtrati
            notifications) signal)    silent      via prefs
                                      events)
```

### 4.1 · Eventi domain (catalogue)

| Event key | Sorgente | Channels default | Audience |
|---|---|---|---|
| `journey.created` | `/api/public/journeys/initiate` | E · A | client + account_owner |
| `journey.brief_updated` | `/api/client/journeys/{jid}/voice` | I · P | journey.contributors |
| `journey.message_sent` | `/api/conversation/threads/{tid}/messages` | E · I · P | other thread participants |
| `journey.recall_requested` | `/api/client/recall-requests` | E · I · P | account_owner + journey.owner |
| `journey.recall_confirmed` | studio-side | E · I | client |
| `journey.proposal_shared` | proposals → published | E · I · P | client + journey.contributors |
| `journey.appointment_confirmed` | appointment flow | E · I · P | client + account_owner |
| `journey.milestone_advanced` | journey lifecycle | I · P | journey.contributors |
| `journey.assignment_changed` | `assignments` table change | E · I | involved users + client |
| `auth.magic_link` | `/api/auth/silent-magic-link` | **E only** (Protected) | client |

Legenda: E=Email · I=In-App · P=Pulse™ · D=Digest

### 4.2 · Audience Resolver

Per ogni event, l'audience set è derivata combinando:

```python
def audience_for(event):
    aud = set()
    if event.notify_client:
        aud.add(client_user_id_of(event.journey_id))
    if event.notify_team:
        aud |= {a.user_id for a in assignments
                if a.journey_id == event.journey_id
                and a.assignment_role in ('owner','contributor')
                and a.revoked_at is None}
    if event.notify_account_owner:
        aud.add(account_primary_owner_of(event.journey_id))
    if event.notify_admin:
        aud |= {u.id for u in tenant_admins(event.tenant_id)}
    # Apply user-level preferences (channel opt-out)
    return [(uid, channels & prefs(uid).channels) for uid in aud]
```

### 4.3 · User notification preferences (proposed table)
```
user_notification_prefs
─────────────────────────────────────────────────────────────────
user_id          UUID PK FK → users_profile.id
tenant_id        UUID FK → tenants.id
channel_email    BOOLEAN default true
channel_in_app   BOOLEAN default true
channel_pulse    BOOLEAN default true
channel_digest   BOOLEAN default true
mute_until       TIMESTAMPTZ NULL
event_overrides  JSONB  -- {"journey.message_sent": {"email": false}}
```

### 4.4 · Throttling & batching
- **Email**: rate-limit 1 per recipient per event-type per 5 min (evita spam su messaggi rapidi).
- **In-app**: nessun throttle (bell badge è cumulativo).
- **Pulse™**: aggregato per journey (max 1 segnale per journey ogni 60 min).
- **Digest**: 1 email/giorno alle 8:00 locale tenant con tutto ciò che è stato in_app-only.

### 4.5 · Tracking & idempotency
Tabella esistente `notifications` o nuova `notification_events`:
- `event_key`, `event_payload`, `dispatched_at`
- `recipient_user_id`, `channel`, `status` (queued|sent|failed|throttled)
- `dedup_key` (es. `hash(event_key + journey_id + recipient + 5min_bucket)`)
- Re-trigger dello stesso event_key per la stessa dedup_key è no-op.

---

## §5 · CLIENT VIEW MODEL · COSA VEDE IL CLIENTE

### Principio: il cliente vede **SOLO** chi è coinvolto E ha consenso a essere visibile.

### 5.1 · Card Referente principale (Atelier `AtelierReferenceCard`)
**Fonte**: 1 sola persona derivata da questa cascata:
```
1. design_journey_assignments WHERE journey_id=X AND assignment_role='owner'
   AND client_visible=true AND revoked_at IS NULL
2. accounts.primary_owner_id (account collegato alla journey)
3. human_assignments WHERE subject_id=client_id AND status='active'
4. fallback: solo nome studio, no persona
```

Campi esposti (filtrati): `first_name`, `last_name`, `avatar_url`, `role_label_it/en`, `short_bio` (truncated 140 char), `response_time_label`. **MAI** email, phone, internal notes, tenant_admin flag.

### 5.2 · "Il tuo team" (sezione opzionale Atelier · Phase 2)
**Fonte**: solo `design_journey_assignments WHERE journey_id=X AND assignment_role IN ('owner','contributor') AND client_visible=true`.

**Filtraggio aggiuntivo per visibilità individuale**:
```
ESCLUDI se:
  · users_profile.role = 'super_admin' AND NOT tenant_settings.show_founder_in_team
  · studio_team_members.visibility = 'studio_only'
  · assignment.client_visible = false
  · users_profile.status != 'active'
```

**Campi esposti** identici alla Card Referente.

### 5.3 · Cosa NON vede MAI il cliente
- Altri client del tenant.
- Membri non assegnati a NESSUNA delle SUE journey.
- Membri con assignment_role='observer'.
- Membri marcati `client_visible=false` (es. compliance, internal-only).
- Tenant_admin/super_admin che non sono ANCHE in `studio_team_members` (es: Founder ROOT che opera dietro le quinte).
- Email/phone di chiunque · solo `contact_cta_label` (es. "Scrivi al tuo referente") che apre il composer interno.

### 5.4 · Audit del leak risk
| Endpoint | Cosa restituisce oggi | Risk |
|---|---|---|
| `GET /api/client/welcome-summary` | `.referente` con first_name, role_label | 🟢 minimo se filtrato come §5.1 |
| `GET /api/client/journeys/{jid}/companion` | Section "Conversations" con thread participants | 🟡 verificare che mostri solo participants assegnati alla journey |
| `GET /api/orchestra-e/team` | Tutti i `studio_team_members` | 🔴 **per tenant_admin** — il cliente non deve mai chiamarlo |
| `GET /api/storefront/public/{slug}/team-leaders` | Public marketing | ✅ by design pubblico |

### 5.5 · Endpoint cliente da costruire (Phase 2)
```
GET /api/client/journeys/{jid}/team
  → restituisce SOLO i membri assigned a quella journey con client_visible=true
  → max 5 persone (UI cinematic), ordine: owner first
  → enriched con avatar, name, role_label, short_bio
```

---

## §6 · ER MODEL CONSOLIDATO

```
                 ┌───────────────┐
                 │   tenants     │
                 └───────┬───────┘
                         │ 1:N
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌──────▼────────┐  ┌────▼────────┐
│ users_profile│  │   accounts    │  │   leads     │
│ id           │  │ primary_owner │  │ assigned_to │
│ role         │  │ tenant_id     │  │ tenant_id   │
│ tenant_id    │  └──────┬────────┘  └────┬────────┘
└──┬───────────┘         │                │
   │ 1:N                 │ 1:N            │
   │                     │                │
┌──▼────────────────┐    │           ┌────▼────────────┐
│studio_team_members│    │           │   contacts      │
│ user_id (FK)      │    │           │ account_id      │
│ tenant_id         │    │           │ tenant_id       │
│ role, specialties │    │           └─────────────────┘
│ visibility        │    │
└───┬───────────────┘    │
    │                    │
    │ 1:N (assignee)     │ 1:N
    │                    │
    │              ┌─────▼────────────┐         ┌──────────────┐
    │              │    projects      │   N:1   │design_journeys│
    │              │ assigned_to (FK) │◄────────┤ project_id   │
    │              │ client_user_id   │         │ account_id   │
    │              │ tenant_id        │         │ created_by   │
    │              └────────┬─────────┘         │ tenant_id    │
    │                       │                   └──────┬───────┘
    │                       │                          │
    │                       └─────────────────────────►│
    │                                                  │ 1:N
    │                                                  │
    │   ╔══════════════════════════════════════════════▼══════════════╗
    │   ║  NEW · design_journey_assignments                            ║
    └──►║  user_id    journey_id    tenant_id                          ║
        ║  assignment_role (owner | contributor | observer)            ║
        ║  client_visible · assigned_by · assigned_at · revoked_at     ║
        ║  UNIQUE (tenant_id, journey_id, user_id) WHERE not revoked   ║
        ╚════════════════════════════════════════════╤═════════════════╝
                                                     │
                                                     │ feeds (read-only join)
                                                     ▼
                            ┌────────────────────────────────────────┐
                            │  CLIENT VIEW MODEL (Atelier Workspace) │
                            │  · Card Referente principale           │
                            │  · "Il tuo team" (filtered)            │
                            └────────────────────────────────────────┘

                    NOTIFICATION FAN-OUT (per ogni Client Event)
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        ┌──────────┐          ┌─────────────┐         ┌──────────┐
        │ EMAIL    │          │ IN-APP BELL │         │ PULSE™   │
        │ Resend + │          │ relationship│         │ Studio   │
        │ tenant   │          │_notifications│        │ dashboard│
        │ identity │          └─────────────┘         │ signals  │
        └──────────┘                                  └──────────┘
```

---

## §7 · OWNERSHIP MODEL · MATRICE DI RESPONSABILITÀ

| Azione | Layer 1 (Roster) | Layer 2 (Account) | Layer 3 (Journey) |
|---|---|---|---|
| Add team member | tenant_admin | – | – |
| Suspend team member | tenant_admin | – | – |
| Set Account Owner | – | tenant_admin / account_director | – |
| Assign Journey Owner | – | – | tenant_admin / account_owner |
| Add Contributor | – | – | journey.owner / tenant_admin |
| Add Observer (internal) | – | – | journey.owner / tenant_admin |
| Revoke any assignment | – | – | journey.owner / tenant_admin |
| Set member.visibility | tenant_admin | – | – |
| Set assignment.client_visible | – | – | journey.owner / tenant_admin |
| See ALL studio members | tenant_admin · super_admin | – | – |
| See ALL accounts | tenant_admin · account_owner di X | account_owner | – |
| See ALL journeys | tenant_admin · super_admin | account_owner di account collegato | owner + contributor + observer |
| See members assegnati a Journey X | tenant_admin | – | journey participants |
| Client sees referente | – | – | derived via §5.1 cascata |
| Client sees team | – | – | derived via §5.2 filter |

---

## §8 · ASSIGNMENT MODEL · TRANSITIONS

```
                 ┌──────────────────┐
                 │  NO ASSIGNMENT   │
                 └────────┬─────────┘
                          │
                  manual.assign(owner)
                          │
                          ▼
                 ┌──────────────────┐
                 │   active OWNER   │◄────────┐
                 └────────┬─────────┘         │
                          │                   │
              owner.change(new_owner)         │
                          │                   │
                          ▼                   │
            ┌──────────────────────────┐      │
            │ pending_handover (24h)   │      │
            │ both owner_old + new are │      │
            │ active in parallel       │      │
            └────────┬─────────────────┘      │
                     │                        │
        ┌────────────┴────────────┐           │
        │                         │           │
    accepted                    rejected      │
        │                         │           │
        ▼                         └───────────┘
  old.revoked_at=now
  new becomes active OWNER

CONTRIBUTOR / OBSERVER transitions:
  add → active
  remove → revoked_at = now (audit trail keeps history)
```

### Eventi triggherati da transition
| Transition | Event emitted | Channels |
|---|---|---|
| add(owner) where none existed | `journey.owner_assigned` | E · I to client + owner |
| change(owner) | `journey.owner_handover_pending` | E to old+new owner |
| handover.accept | `journey.owner_changed` | E · I · P to client + studio team |
| add(contributor) | `journey.contributor_joined` | I · P to journey team |
| remove(contributor) | `journey.contributor_left` | I to remaining team |
| add(observer) | (silent · audit log only) | – |
| revoke all on suspend | `journey.team_reorganize_needed` | E to tenant_admin |

---

## §9 · QUESTIONI APERTE (richiedono decisione Founder)

| # | Domanda | Opzioni |
|---|---|---|
| **Q1** | Lo schema enum DB `users_profile.role` oggi accetta SOLO `client` + `super_admin`. Va esteso? | a) Estendere a `client, super_admin, tenant_admin, designer, creative_director, account_director, project_coordinator, observer` ← migration · b) Tenere enum minimale e mettere il ruolo specifico SOLO in `studio_team_members.role` |
| **Q2** | Founder (ROOT_SUPERADMIN) deve apparire come "team member" agli occhi del cliente di default? | a) NO, mai (default) · b) SÌ se esplicitamente attivato in `tenant_settings.show_founder_in_team` · c) SÌ sempre |
| **Q3** | Più di 1 Owner per journey possibile? | a) NO, 1 solo (unique constraint) · b) SÌ, max 2 (co-owners) |
| **Q4** | "Internal Contributors" sono visibili nella timeline pubblica delle attività? | a) SÌ ma anonimizzati ("un membro dello studio ha aggiornato il brief") · b) NO, completamente invisibili al cliente · c) SÌ con nome se `client_visible=true` |
| **Q5** | Quando un membro lascia il team (suspend), cosa succede alle sue assignments attive? | a) tutte auto-revoked, alert al tenant_admin · b) freeze su `pending_reassignment`, journey continua read-only finché non viene riassegnata · c) manual cleanup richiesto |
| **Q6** | `human_assignments` (legacy 9 righe) va migrata in `design_journey_assignments`? | a) SÌ, migrazione one-shot · b) Coesistono, `human_assignments` resta per altri `subject_type` (lead, account) · c) Drop `human_assignments`, integrare la sua logica "first_contact_*" nel nuovo schema |
| **Q7** | Quale tabella unica per le notifiche in-app? | a) `notifications` (generica core) · b) `relationship_notifications` (orchestrazione) · c) consolidare in 1 sola con migration |

---

## §10 · ROADMAP PROPOSTA (NON ESEGUITA)

### Phase A · Foundation (2-3 giorni)
1. Estendere enum DB `users_profile.role` (Q1.a)
2. Creare `design_journey_assignments` table + migration
3. Backfill: `projects.assigned_to` → `assignments(role='owner')` per journey esistenti
4. Endpoint admin: `POST/GET/PATCH/DELETE /api/admin/journeys/{jid}/assignments`

### Phase B · Team Module UI (3-4 giorni)
5. Estendere modulo Team in Blueprint: list `studio_team_members` + invite flow + `users_profile` enriched (Q2)
6. Drawer per gestire `assignments` su una journey
7. Lista "Le mie journey" per ogni team member

### Phase C · Notification Bus (1 settimana)
8. Domain event bus interno (`emit('journey.brief_updated', payload)`)
9. Channel routers per email/in-app/pulse (riusa ITER173 P1 templates)
10. Audience resolver con preferences
11. Dedup + throttling

### Phase D · Client View (2-3 giorni)
12. `GET /api/client/journeys/{jid}/team` filtered
13. Sezione "Il tuo team" nell'AtelierWelcomePanel (Phase 2 spec)
14. Card referente aggiornata con cascata §5.1

### Phase E · Polish & migration (2 giorni)
15. Migrare `leads.designer_assigned` (string) → FK
16. Decisione Q6 e migrazione `human_assignments`
17. Consolidamento `notifications` vs `relationship_notifications` (Q7)

**Stima totale**: ~15-20 giorni-uomo per implementazione completa.
**Stima MVP**: Phase A + B (5-7 giorni) — abbastanza per il primo customer reale.

---

## §11 · ALLEGATI

- 📊 **Inventory tabelle** §1
- 🔍 **Verifica modulo attuale** §2
- 🧱 **ER model** §6
- 🗝 **Schema proposto** §3.1
- 🔔 **Notification catalogue** §4.1
- 👁 **Client view filters** §5
- 📋 **Decisioni aperte** §9 (richiedono OK Founder)

> ⚠️ Come da direttiva: zero implementazione, zero modifica DB, zero migration. Solo documento architetturale.
