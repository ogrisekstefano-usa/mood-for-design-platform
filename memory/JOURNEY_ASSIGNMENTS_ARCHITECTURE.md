# JOURNEY ASSIGNMENTS™ ARCHITECTURE · ITER178 Phase 1

> **Status:** 🔒 ARCHITECTURE AUDIT · 31 May 2026 · zero modifica codice/DB
> **Pre-condizione:** ITER174 (Founder Only) + ITER177 (Team Foundation Phase 0) completati
> **Companion docs:** `TEAM_COLLABORATION_ARCHITECTURE.md`, `TEAM_LIFECYCLE_AUDIT.md`, `TEAM_FOUNDATION_REPORT.md`

---

## §0 · TL;DR (3 verità cardinali)

**VERITÀ 1 — Il sistema attuale è "Single-Owner Implicito".**
Ogni cliente che arriva ha **una sola persona**: l'assignee `human_assignments` con `subject_type='client'`. Quando esiste un solo utente nel tenant, `assignment_reason='only_available_user'`. Quando ci sono più candidati, c'è un **round-robin deterministico** già implementato in `core/human_assignment.py:assign()` (priority-based per role group: tenant_admin → project_manager → designer/editor → super_admin).

**VERITÀ 2 — Esistono 5 vettori di "ownership" sparsi.**
| Tabella | Campo | Stato uso | Note |
|---|---|---|---|
| `human_assignments` | `assignee_user_id` (`subject_type='client'`) | ✅ canonico oggi | account-level, 1 attivo |
| `accounts` | `primary_owner_id` | ⚠️ scritto in `journey_initiate.py`, mai letto da UI cliente | duplicato logico |
| `projects` | `assigned_to` | ⚠️ idem | duplicato |
| `design_journeys` | `created_by` | ✅ "chi ha avviato" | NON è owner operativo |
| `leads` | `assigned_to` + `designer_assigned` | 🔴 legacy, never reconciled | morti |

Sono 5 campi che dicono cose vicine ma non identiche. **L'unico realmente consumato dal client-side è `human_assignments`** (via `client_portal.welcome-summary` e `client-messages/assignee/queue`).

**VERITÀ 3 — Non esiste il concetto di "Team della Journey".**
Né tabella di assegnazione multipla, né endpoint per aggiungere/rimuovere contributors, né campo `client_visible`. Tutto ciò che è "team" per la journey si limita a quel singolo `assignee_user_id`. Aggiungere un secondo collaboratore oggi richiederebbe SQL diretto.

---

## §1 · STATO ATTUALE per asse

### 1.1 · `human_assignments` (canonico oggi) 🟢

```
human_assignments
─────────────────────────────────────────────
id                          uuid  PK
tenant_id                   uuid  NOT NULL
subject_type                text  NOT NULL  -- {'client','lead','project','studio_onboarding'}
subject_id                  uuid  NOT NULL
assignee_user_id            uuid  NULL      -- → users_profile.id
assignment_reason           text  NOT NULL  -- {'only_available_user','round_robin','manual_override','unassigned'}
status                      text  NOT NULL  -- {'active','reassigned','revoked'}
first_contact_suggested_at  tstz  NULL
first_contact_sent_at       tstz  NULL
first_contact_status        text  NULL      -- {'pending','suggested','sent','overdue'}
metadata_json               jsonb DEFAULT '{}'
created_at / updated_at / created_by
```

**Coverage:**
- ✅ 1 assignee per `(tenant, subject_type, subject_id)` attivo
- ✅ Round-robin con priority chain (`tenant_admin > project_manager > designer/editor > super_admin`)
- ✅ Manual override (`force_assignee`)
- ✅ Reassignment trail in `human_assignment_events`
- ✅ Letto da: `welcome-summary`, `assignee/queue` (designer cockpit), `client-messages`

**Gap rispetto al modello target:**
- 🔴 No multi-assignee (`assigned_team`, `contributors`)
- 🔴 No `assignment_role` (owner/contributor/observer)
- 🔴 No `client_visible` flag (è già implicitamente client-visible perché filtra il referente)
- 🔴 `subject_type='client'` accoppia l'assignment all'**account-cliente**, non alla **journey** (se il cliente ha più journey, una sola persona vale per tutte)

### 1.2 · Codice di consumo 🟢 (per ciò che fa oggi)

| Endpoint | Cosa legge | Output |
|---|---|---|
| `GET /api/client/welcome-summary` | `human_assignments WHERE subject_type='client'` + `users_profile` hydrate | `{ referente: {first_name, role_label, avatar_url, ...} }` |
| `GET /api/client-messages/assignee/queue` | `human_assignments WHERE assignee_user_id=current_user AND subject_type='client'` | lista clienti del designer logged |
| `POST /api/public/journeys/initiate` (`journey_initiate.py`) | `ensure_assignment_for_client(tenant_id, profile_id)` → crea/legge assignment | imposta referente alla creazione |
| `POST /api/client-messages/*` (send/suggest/approve) | gate sui ruoli (`is_admin` o `assignee_user_id=current_user`) | first-contact orchestration |

### 1.3 · Codice di mutazione 🟢

- `core/human_assignment.py:assign(tenant_id, subject_type, subject_id, force_assignee=…)` — già supporta `manual_override`
- Non c'è ancora un endpoint REST esposto per riassegnazione (deve essere creato in Phase 1 implementation)

### 1.4 · Workflow oggi (timeline reale)

```
T0 · Public form Begin Journey → POST /api/public/journeys/initiate
     │
     ├ create lead (assigned_to=NULL)
     ├ create account (primary_owner_id=ADMIN_ID — pre-set in code)
     ├ create contact (NULL ownership)
     ├ create project (assigned_to=ADMIN_ID)
     ├ create design_journey (created_by=ADMIN_ID)
     ├ create users_profile (role=client)
     └ ensure_assignment_for_client(tenant, client_profile_id)
              → human_assignments row
                 assignee_user_id = ADMIN_ID  (only_available_user)
                 subject_type='client', subject_id=client_profile_id

T+? · Admin opens AssignedClientsPanel → /api/client-messages/assignee/queue
     · cliente appare con assignment_status='pending' (24h overdue se ignorato)

T+? · Admin manda first message → first_contact_sent_at = NOW()
     · Conversation thread propagates

T+? · Client opens magic-link → /api/client/welcome-summary
     · Mostra referente (= ADMIN, che è l'unico)
```

---

## §2 · GAP rispetto al modello target

| Requisito user | Stato | Note |
|---|---|---|
| Journey Owner (1 e 1 solo) | 🟡 | Esiste `human_assignments` (1 attivo per subject) ma è **client-level** non **journey-level**. Se un cliente ha 2 journey, una sola persona vale per entrambe |
| Owner sempre visibile al cliente | 🟢 | `welcome-summary.referente` |
| Owner riceve notifiche principali | 🟡 | Architettura esiste (`assignee_queue` polling), no event bus |
| Owner può riassegnare | 🟡 | Funzione `assign(manual_override=True)` esiste, **no endpoint REST** |
| Assigned Team (molti) | 🔴 | Nessuna tabella che supporti N-to-N |
| Assigned Team possono partecipare a conversazioni | 🟡 | `client_messages.assignee_queue` filtra **strict** sull'assignee → un designer "secondario" non vedrebbe il cliente |
| Internal Contributors (facoltativi) | 🔴 | Nessun supporto |
| Internal Contributors NON visibili al cliente | 🔴 | Manca `client_visible` flag |
| Observer (read-only) | 🟡 | RBAC `analyst` ruolo c'è ma non scoped per-journey |
| Client non vede staff backoffice | 🟡 | Oggi vede 1 sola persona (admin). Quando arriveranno N team, serve filtro esplicito |

### Classificazione sintetica

| Asse | Backend | DB | Endpoint | UI | Verdetto |
|---|---|---|---|---|---|
| Single-owner per cliente | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 Già pronto |
| Riassegnazione manuale | 🟢 (funzione) | 🟢 | 🔴 (no REST) | 🔴 | 🟡 Parziale |
| Multi-assignment per journey | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 Mancante |
| Assignment role (owner/contrib/observer) | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 Mancante |
| Client visibility filter | 🟡 (filtro implicito) | 🔴 | 🔴 (no `/client/journey/team` endpoint) | 🔴 | 🟡 Parziale |
| Journey-scoped subject | 🔴 | 🟡 (campo `subject_type='journey'` esprimibile, ma non usato) | 🔴 | 🔴 | 🔴 Mancante |
| Audit trail riassegnazione | 🟢 | 🟢 (`human_assignment_events`) | 🟡 | 🔴 | 🟡 Parziale |

---

## §3 · MODELLO TARGET (proposta canonica)

### 3.1 · Filosofia

**Tre principi-guida:**

1. **Non sostituire `human_assignments`**: continua a vivere come "single point of contact" account-level (referente principale del CLIENTE, indipendentemente da quante journey ha aperto). È il punto da cui il cliente legge "il MIO referente".
2. **Aggiungere `design_journey_assignments`**: nuova tabella **journey-scoped**, multi-row, con `assignment_role`. È il "Team della Journey".
3. **Sincronizzazione esplicita**: alla creazione di una Journey, automaticamente:
   - `human_assignments(subject_type='client')` resta com'è
   - `design_journey_assignments` riceve 1 row con `assignment_role='owner'` (= stesso assignee del client-level di default; ma può essere diverso)

Questo permette: **referente di account ≠ owner di una journey specifica**. Esempio: Stefano è referente del Cliente X, ma per la Journey "Appartamento Milano" l'owner è Designer A. Il cliente vede entrambi nel "Tuo Team" della journey, ma Stefano resta il referente master del rapporto.

### 3.2 · Schema proposto

```sql
design_journey_assignments
──────────────────────────────────────────────────────────────────
id                  uuid  PK
tenant_id           uuid  NOT NULL  → tenants.id
journey_id          uuid  NOT NULL  → design_journeys.id
user_id             uuid  NOT NULL  → users_profile.id
assignment_role     text  NOT NULL  -- {'owner','contributor','observer'}
client_visible      boolean NOT NULL DEFAULT true  -- false = internal-only
assigned_at         timestamptz NOT NULL DEFAULT NOW()
assigned_by         uuid  → users_profile.id (chi ha effettuato l'assegnazione)
revoked_at          timestamptz NULL
revoked_by          uuid  → users_profile.id
revoke_reason       text  NULL
metadata_json       jsonb DEFAULT '{}'  -- {role_label_it, role_label_en, specialty, note}
created_at / updated_at

-- Vincoli:
UNIQUE (journey_id, user_id) WHERE revoked_at IS NULL
  -- un membro può essere assegnato 1 sola volta per journey (active)
  -- ma se revocato può essere riassegnato con un nuovo role
CHECK (assignment_role IN ('owner','contributor','observer'))

-- 1 e 1 solo owner attivo per journey:
CREATE UNIQUE INDEX dja_one_owner_per_journey
   ON design_journey_assignments (journey_id)
   WHERE assignment_role = 'owner' AND revoked_at IS NULL;

CREATE INDEX dja_user_active_idx
   ON design_journey_assignments (user_id, revoked_at)
   WHERE revoked_at IS NULL;

CREATE INDEX dja_journey_role_visibility_idx
   ON design_journey_assignments (journey_id, assignment_role, client_visible)
   WHERE revoked_at IS NULL;
```

### 3.3 · Tabella eventi (audit) opzionale

Riusiamo lo schema `human_assignment_events`-pattern:

```sql
design_journey_assignment_events
──────────────────────────────────────────────────────────────────
id              uuid  PK
assignment_id   uuid  NOT NULL → design_journey_assignments.id
event_type      text  NOT NULL -- {'assigned','role_changed','visibility_changed','revoked','reinstated'}
actor_user_id   uuid  → users_profile.id
payload_json    jsonb DEFAULT '{}'
created_at      timestamptz NOT NULL DEFAULT NOW()
```

### 3.4 · Vincoli semantici (DB + applicativi)

| Vincolo | Tipo | Note |
|---|---|---|
| Owner unico attivo per journey | `UNIQUE INDEX` partial | DB enforce |
| Tutti i ruoli con `client_visible=true` non possono essere `tenant_admin`/`super_admin` di default | applicativo | `tenant_settings.client_shows_founders` toggle |
| Quando `users_profile.status='suspended'` → auto-revoke su tutti i suoi assignments | applicativo (trigger Python) | Phase 1 |
| Quando una journey `lifecycle_state='closed'` → assignments congelati ma non revocati | nessuno DB, applicativo | conservare audit |
| Tenant isolation | `tenant_id` check su tutte le query | come ovunque |

---

## §4 · CLIENT VISIBILITY MODEL™

### 4.1 · Regole di visibilità

| Cosa cliente vede | Regola |
|---|---|
| **Referente principale (Account-level)** | `human_assignments WHERE subject_type='client' AND subject_id=client_profile_id AND status='active'` |
| **Team della journey corrente** | `design_journey_assignments WHERE journey_id=<jid> AND client_visible=true AND revoked_at IS NULL` ordered by `assignment_role` (owner first) |
| **Singolo membro nello stream conversazione** | partecipante effettivo (`client_messages.sender_user_id`) → filtrato per `client_visible=true` |
| **Tutti i membri studio (lista pubblica)** | endpoint `/api/storefront/public/{slug}/team-leaders` — marketing only, NON nel client workspace |

### 4.2 · Cosa NON vede mai

- `assignment_role='observer'` (sempre internal)
- Qualunque assignment con `client_visible=false` (anche se ruolo è contributor)
- Membri con `users_profile.status != 'active'`
- Membri con ruolo `analyst`, `editor`, `super_admin`, `tenant_admin` salvo override `tenant_settings.show_admins_as_team`

### 4.3 · Endpoint cliente nuovo (proposto)

```
GET /api/client/journeys/{jid}/team

Response:
{
  "referent": {                 // = human_assignments level (cliente-master)
    "user_id": "...",
    "first_name": "Stefano",
    "last_name": "Ogrisek",
    "role_label_it": "Referente",
    "avatar_url": "...",
    "is_primary": true
  },
  "journey_team": [             // = design_journey_assignments client_visible=true
    {
      "user_id": "...",
      "first_name": "Designer A",
      "role_label_it": "Interior Designer",
      "assignment_role": "owner",
      "avatar_url": "..."
    },
    {
      "user_id": "...",
      "first_name": "Specialist M",
      "role_label_it": "Specialista Materiali",
      "assignment_role": "contributor",
      "avatar_url": "..."
    }
  ]
}
```

**Fields esposti per ogni team member:**
`user_id, first_name, last_name (last initial only?), avatar_url, role_label, assignment_role`.
**Mai esposto:** `email, phone, internal_note, last_login_at, is_root_superadmin, tenant_admin role`.

### 4.4 · Cascade referente

Se `referent` (human_assignments) è la stessa persona di un `journey_team.assignment_role='owner'`:
→ collapse logico: nel frontend mostra **una sola scheda** (no duplicato).

---

## §5 · OWNERSHIP MODEL

### 5.1 · Concetti

```
                    ┌─────────────────────────────┐
                    │     CLIENT ACCOUNT          │
                    │   (users_profile + accounts)│
                    └──────────────┬──────────────┘
                                   │
                       human_assignments
                       (subject_type='client')
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │     REFERENTE PRINCIPALE    │
                    │  Master of the relationship │
                    └─────────────────────────────┘
                                   │
                                   │ (può coincidere o no
                                   │  con owner journey)
                                   ▼
                    ┌─────────────────────────────┐
                    │       JOURNEY                │
                    │  (design_journeys)           │
                    └──────────────┬──────────────┘
                                   │
                  design_journey_assignments (N rows)
                                   │
                                   ▼
          ┌─────────────────────┬──────────────────┬────────────────┐
          │       OWNER         │   CONTRIBUTORS   │   OBSERVERS    │
          │  (1, unique)        │  (N, optional)   │  (N, optional) │
          │  client_visible:T   │  client_visible: │  client_visible│
          │                     │      configurable│      always F  │
          └─────────────────────┴──────────────────┴────────────────┘
```

### 5.2 · Regole

| Ruolo | Count max | Default `client_visible` | Riceve notifiche | Può modificare journey | Può chiudere journey |
|---|---|---|---|---|---|
| `owner` | **1** | `true` | sì (tutte) | sì | sì (con guard) |
| `contributor` | illimitati | `true` | sì (assegnate) | sì (writeup, no chiudere) | no |
| `observer` | illimitati | `false` | no di default | no | no |

### 5.3 · Hand-off owner

Quando l'owner cambia (es. Founder → Designer):
1. Vecchia row `assignment_role='owner'` viene revocata (`revoked_at=NOW()`, `revoke_reason='handed_off'`)
2. Nuova row `assignment_role='owner'` creata
3. Event `role_changed` su entrambe le row (audit)
4. Se `client_visible=true` ma cliente non aveva ancora visto l'owner precedente → silent swap
5. Se cliente HA già visto l'owner precedente → notification "Il tuo referente per questa Journey è ora …" (Notification Bus — Phase 3)

### 5.4 · Suspend / Delete propagation

- `users_profile.status='suspended'` → trigger applicativo: tutte le sue active assignments diventano `status='paused'` (nuovo campo? oppure `revoked_at=NOW(), revoke_reason='suspended'`)
- Se l'utente sospeso era `owner` di journey con `lifecycle_state != 'closed'` → **alert** all'admin per riassegnare manualmente (no auto-pick perché potrebbe scegliere male)

### 5.5 · Founder visibility default

Quando il Founder (`is_root_superadmin=true`) assegna se stesso come owner:
- `client_visible=true` di default solo se `tenant_settings.show_founder_in_team=true` (default false)
- Se `false`: Founder è owner ma il cliente NON lo vede nel `journey_team` — `referent` (human_assignments) resta visibile solo se quella relazione è esplicita

---

## §6 · NOTIFICATION IMPLICATIONS

> Non implementare il Notification Bus in questa iterazione (è Phase 3). Solo capire quali eventi nasceranno.

### 6.1 · Eventi che la tabella genera

| Event key | Trigger | Audience | Channels |
|---|---|---|---|
| `journey.assignment.created` | `INSERT design_journey_assignments` | tutti i membri attivi della journey | in-app, email |
| `journey.assignment.role_changed` | `UPDATE assignment_role` | tutti i membri attivi | in-app |
| `journey.assignment.visibility_changed` | `UPDATE client_visible` | nessuno (silent) | – |
| `journey.assignment.revoked` | `UPDATE revoked_at` | utente revocato + owner | in-app, email |
| `journey.owner_changed` | revoke + insert combinato | tutti i membri + cliente (se Phase 2 client notif) | in-app, email |
| `journey.assigned_to_me` | `INSERT … WHERE user_id=current_user` | il membro stesso | in-app |

### 6.2 · Coordinamento con `human_assignments`

`human_assignments` continua a emettere i propri eventi (`first_contact_*`). Il nuovo subsystem `design_journey_assignments` emette eventi **propri**, senza interferire. Il Notification Bus (Phase 3) ascolta entrambi.

---

## §7 · MIGRATION STRATEGY (non eseguire ora)

### 7.1 · Sequenza ordinata

```
Step 1 · Migration `113_design_journey_assignments.sql`
        → CREATE TABLE design_journey_assignments + events
        → CREATE INDEX (unique owner partial, user_active, role_visibility)
        → CREATE FUNCTION mark_journey_owner_handoff()
        → INSERT schema_migrations row

Step 2 · Backfill (one-shot script)
        Per ogni design_journey ESISTENTE:
          → leggi projects.assigned_to (oppure design_journeys.created_by come fallback)
          → INSERT design_journey_assignments
              (journey_id, user_id=assigned_to, assignment_role='owner',
               client_visible=true, assigned_by=created_by)
          → log line in events
        Verify: ogni journey ha esattamente 1 owner

Step 3 · Refactor `journey_initiate.py`
        Dopo aver creato design_journey:
          ensure_journey_assignment(journey_id, user_id=primary_owner,
                                    role='owner', client_visible=true)
        Non rimuovere ancora `projects.assigned_to` (compat)

Step 4 · Endpoint REST
        GET    /api/admin/journeys/{jid}/assignments
        POST   /api/admin/journeys/{jid}/assignments
        PATCH  /api/admin/journeys/{jid}/assignments/{aid}
        DELETE /api/admin/journeys/{jid}/assignments/{aid} (= revoke)
        + GET /api/client/journeys/{jid}/team (filtered)

Step 5 · Refactor consumer
        - AssignedClientsPanel oggi legge human_assignments → estendere a design_journey_assignments (UNION soft)
        - client_messages permission check: NON solo "sono assignee del client" ma "sono attivo nella journey OR assignee del client"

Step 6 · Deprecation soft
        - leads.designer_assigned + leads.assigned_to → segnare come DEPRECATED in commenti, non droppare
        - projects.assigned_to → segnare come "denormalized mirror" della journey owner (auto-mantained)
```

### 7.2 · Compatibilità con dati esistenti

Post-ITER174 il DB ha **0 design_journeys**. La migration può essere applicata senza alcun backfill. Quando arriveranno le prime journey reali, lo step 3 (refactor `journey_initiate.py`) le scriverà già correttamente.

### 7.3 · Rollback strategy

- Migration reversibile: `DROP TABLE design_journey_assignments + events`
- Codice consumer protegge con feature flag `tenant_settings.journey_assignments_v1=true` durante rollout
- `human_assignments` continua a funzionare in parallelo per la durata del flag

---

## §8 · COMPATIBILITÀ CON SISTEMI ESISTENTI

### 8.1 · Compat matrix

| Sistema esistente | Impatto | Strategia |
|---|---|---|
| **Founder Only™ (ITER174)** | Nessuno | DB vuoto: migration zero-risk |
| **Team Foundation™ (ITER177)** | Nessuno | `users_profile.role` enum già esteso (10 ruoli) |
| **Begin Journey™ pubblico** | Refactor `journey_initiate.py` (step 3 migrazione) | additivo: aggiunge 1 INSERT, mantiene tutto il resto |
| **Client Design Journey™ (Atelier Gen3)** | Aggiunge sezione "Tuo Team" facoltativa nel companion page | NON modifica il flusso esistente |
| **AssignedClientsPanel** | Estensione UNION: legge da entrambe le tabelle | retro-compat preservata |
| **first_contact orchestration** | `assignee_user_id` resta single point of contact | nessun cambio |
| **Magic-link Auth flow** | Nessuno | indipendente |
| **Email Templates / Tenant Email Identity** | Nessuno | indipendente |
| **CMS / Editorial** | Nessuno | indipendente |
| **Tenant Isolation™** | Rispettato: `tenant_id` su ogni row | conforme |

### 8.2 · Test surface da regredire dopo l'implementazione

| Endpoint | Verifica |
|---|---|
| `POST /api/public/journeys/initiate` | crea 1 row `design_journey_assignments` con role='owner' |
| `GET /api/client/welcome-summary` | referente invariato |
| `GET /api/client/journeys/{jid}/team` (nuovo) | restituisce owner + contributors filtered |
| `GET /api/client-messages/assignee/queue` | designer vede journey assegnate |
| `POST /api/admin/journeys/{jid}/assignments` | 1 owner unique enforce |

---

## §9 · SMOKE SCENARIO (validazione teorica)

```
[1] Founder admin@moodfordesign.com logged
[2] /settings/members → invita Designer A (role='designer')
[3] Designer A accetta (first-login listener attiva status='active')
[4] Public form Begin Journey → cliente Mario Rossi
       ↓
       journey_initiate.py crea:
         · users_profile (mario.rossi@…, role=client)
         · account / lead / project / design_journey
         · human_assignments(subject='client') → admin (only_available_user logic)
         · design_journey_assignments(role='owner') → admin    ← NUOVO (post migration)
[5] Founder apre Admin UI → /admin/journeys/<jid> → "Assegna Team"
       ↓
       POST /api/admin/journeys/<jid>/assignments
         { user_id: <designer_A_id>, assignment_role: 'owner',
           client_visible: true, handoff_from: <admin_id> }
       ↓
       Backend revokes admin's owner row, inserts Designer A as owner
       Event: assignment.owner_changed (audit)
[6] Designer A login → DashboardPage
       ↓
       AssignedClientsPanel reads:
         human_assignments WHERE assignee=designer_A      (no row — admin ancora qui)
         UNION
         design_journey_assignments WHERE user=designer_A (1 row: Mario Rossi journey)
       ↓
       Designer A vede Mario Rossi in "Le mie Journey"
[7] Cliente Mario apre magic-link → /journey/<jid>
       ↓
       GET /api/client/welcome-summary → referente = admin (Stefano)
       GET /api/client/journeys/<jid>/team →
         { referent: Stefano (admin · account-level),
           journey_team: [{ Designer A (owner), client_visible:true }] }
       ↓
       UI Client mostra:
         · Stefano come Referente master
         · Designer A come Owner della Journey
         · (eventuali altri Contributors se aggiunti dopo)
```

**Risultati attesi:**
- Designer A entra nel suo workspace e vede 1 journey assegnata
- Cliente continua a vedere Founder come referente master
- Cliente vede anche Designer A come owner della journey specifica
- Founder ha audit log completo del passaggio di consegne

---

## §10 · PROTOTIPO TECNICO

### 10.1 · Perché `design_journey_assignments` (e non estendere `human_assignments`?)

| Pro estendere `human_assignments` | Contro |
|---|---|
| Tabella unica, 1 sola logica | `subject_type='client'` ha semantica account-level (1 cliente = 1 referente). Mischiare con journey-level crea ambiguità |
| Riusa `human_assignment_events` | Conflitto sul vincolo "1 attivo per subject" |
| Meno migration | Refactor query massivo → maggiore rischio regressione |

| Pro nuova tabella `design_journey_assignments` | Contro |
|---|---|
| Semantica chiara: `human_assignments` = referente del rapporto, `dja` = team della journey | 2 tabelle da mantenere |
| `assignment_role` enum esplicito | – |
| `client_visible` flag dedicato | – |
| `UNIQUE owner partial index` enforceable | – |
| Zero rischio regressione su flusso first_contact (che resta a `human_assignments`) | – |
| Backfill semplice (post-ITER174 = 0 righe) | – |

**Decisione raccomandata:** nuova tabella `design_journey_assignments`. Sintetizzando:
- `human_assignments` = "Chi è il referente master di questo cliente?" (1 referente per cliente)
- `design_journey_assignments` = "Chi sta lavorando su questa journey?" (N membri per journey)

I due sistemi convivono. Il referente master è frequentemente anche owner della journey, ma può non esserlo.

### 10.2 · Alternative considerate (e scartate)

| Alternativa | Perché scartata |
|---|---|
| Estendere `human_assignments` con `subject_type='journey'` | Mischia semantica account vs journey-level; rende il vincolo "1 attivo per subject" ambiguo |
| Aggiungere colonna `journey_team_user_ids uuid[]` su `design_journeys` | Array senza FK enforce; impossibile fare join e audit |
| Tabella generica `entity_collaborators` (qualsiasi tipo) | Over-engineering per uno scope ancora ristretto a 1 dominio (journey) |
| Promuovere `tenant_memberships` a "journey membership" | Già usato per tenant-level licensing; rompe semantica |

### 10.3 · API design proposta

```
GET  /api/admin/journeys/{jid}/assignments
     → list (owner first, contributors, observers)
     → permission: P_PROJECTS_READ + tenant ownership

POST /api/admin/journeys/{jid}/assignments
     body: { user_id, assignment_role, client_visible }
     → permission: P_PROJECTS_WRITE
     → enforce: 1 owner unique, user.status='active', user.tenant_id matches
     → if assignment_role='owner' and existing owner exists:
         → revoke existing, create new (handoff)
         → emit events

PATCH /api/admin/journeys/{jid}/assignments/{aid}
     body: { assignment_role?, client_visible? }
     → permission: P_PROJECTS_WRITE

DELETE /api/admin/journeys/{jid}/assignments/{aid}
     → soft delete (revoked_at=NOW())
     → permission: P_PROJECTS_WRITE
     → enforce: if revoking owner, must have replacement (or reject)

GET /api/workspace/journeys/mine
     → list journeys where current_user has active assignment
     → role-aware: shows only assigned + role badge

GET /api/client/journeys/{jid}/team
     → filtered output (referent + journey_team with client_visible=true)
     → permission: client must be participant of journey (account.email match)
```

---

## §11 · ROADMAP IMPLEMENTATIVA (post-questo audit)

| Fase | Item | Effort | Dipendenze |
|---|---|---|---|
| 🔴 P0 | Migration `113_design_journey_assignments.sql` + helper function | 0.5g | Phase 0 done ✓ |
| 🔴 P0 | Refactor `journey_initiate.py` per insert assignment owner alla creazione | 0.5g | migration |
| 🔴 P0 | Endpoint CRUD `/api/admin/journeys/{jid}/assignments` | 1g | migration |
| 🔴 P0 | Endpoint `GET /api/workspace/journeys/mine` | 0.5g | CRUD |
| 🟠 P1 | Endpoint `GET /api/client/journeys/{jid}/team` (filtered) | 0.5g | migration |
| 🟠 P1 | UI Drawer "Assegna Team" sul detail journey admin | 1g | CRUD |
| 🟠 P1 | UI "Le mie Journey" page (`/workspace/journeys`) | 1g | endpoint |
| 🟢 P2 | UI sezione "Tuo Team" nel client companion | 0.5g | client endpoint |
| 🟢 P2 | Auto-revoke on user suspend (trigger applicativo) | 0.5g | – |
| 🟢 P2 | Audit UI per assignment events | 1g | – |

**Totale Phase 1 minima (P0):** ~2.5 giorni.

---

## §12 · DOMANDE APERTE (decisione Founder)

| # | Domanda | Default suggerito |
|---|---|---|
| Q1 | Implementiamo `observer` role o aspettiamo richiesta concreta? | **Sì da subito** — costa 0 (è solo un enum value). Senza, è impossibile esprimere "il mio capo legge ma non interagisce" |
| Q2 | Owner deve coincidere col referente `human_assignments` di default? | **Sì** — semplifica UX. Override esplicito disponibile |
| Q3 | Il Founder appare di default nel `journey_team` del cliente? | **No** — solo come `referent` se è l'unico assignment. Toggle `tenant_settings.show_founder_in_team` |
| Q4 | Contributors hanno permesso write su milestones? | **Sì** (default). Observer = read-only |
| Q5 | Revocare l'owner senza replacement è permesso? | **No** — vincolo applicativo: rifiuto |
| Q6 | Quando journey va in `closed`, gli assignments restano attivi o si congelano? | **Restano attivi ma read-only** (preserva audit + future re-open) |
| Q7 | Limite team per journey (anti-abuse)? | **Limite morbido**: 20 membri attivi per journey. Notifica founder se superato |
| Q8 | Il cliente può "rifiutare" un team member? | **No nel MVP**. Backlog Phase 3+ |
| Q9 | Multi-tenant: un utente può essere assignment in journey di tenant diversi? | **Sì** purché `tenant_memberships` lo autorizzi su entrambi |

---

## §13 · VINCOLI RISPETTATI (questa iterazione)

| Vincolo direttiva | Stato |
|---|---|
| Non modificare DB | ✅ (0 migration eseguite) |
| Non creare CRUD | ✅ |
| Non modificare frontend | ✅ |
| Non implementare Notification Bus | ✅ (solo §6 cita gli eventi futuri) |
| Non implementare Designer Workspace redesign | ✅ |
| Solo audit + architettura | ✅ |

---

## §14 · IMPATTO SU SISTEMI CARDINE

| Principio cardinale | Impatto progettuale | Conforme? |
|---|---|---|
| **Design Journey First™** | Estende, non sostituisce. La journey resta il centro | ✅ |
| **Client Design Journey™ (Gen3 Atelier)** | Aggiunge nuovo blocco "Tuo Team" senza modificare i 3 capitoli esistenti (Lessico, Brief, Conversazione) | ✅ |
| **Tenant Isolation™** | `tenant_id` su nuova tabella + check su tutte le query | ✅ |
| **Team Foundation™ (ITER177)** | Coerente con catalogo ruoli (10 ruoli) + `users_profile.role` + RBAC | ✅ |
| **Email Identity™** | Notification email future useranno la stessa fallback hierarchy | ✅ |
| **Founder Only™ baseline** | Migration zero-risk su DB vuoto | ✅ |

---

## §15 · CONCLUSIONE

Il sistema è **pronto** per ricevere `design_journey_assignments`. La nuova tabella è additiva, retro-compatibile, e copre tutti i casi del modello target. Resta da implementare (P0 ~2.5 giorni) ma l'architettura è ora congelata in questo documento e non richiede ulteriori decisioni progettuali se non i 9 toggle elencati in §12.

**Raccomandazione finale Founder:**
Approvare il modello e Phase 1 implementativa (sequenza §7.1 + §11). La piattaforma passa da "single-handed" a "team-ready" con un'unica iterazione mirata, senza compromettere alcun sistema esistente.

---

## ALLEGATI

- **Codice di riferimento (oggi):**
  - `/app/backend/core/human_assignment.py` (assign + ensure + hydrate)
  - `/app/backend/routers/journey_initiate.py` (begin journey)
  - `/app/backend/routers/client_portal.py:welcome-summary`
  - `/app/backend/routers/client_messages.py:assignee_queue`
- **Schema DB attuale:**
  - `human_assignments` (canonico, account-level)
  - `human_assignment_events` (audit)
  - `users_profile` (10-role enum ITER177)
  - `tenant_memberships` (license + multi-tenant)
- **Companion docs:**
  - `TEAM_COLLABORATION_ARCHITECTURE.md` (§3 originale: prima proposta dja)
  - `TEAM_LIFECYCLE_AUDIT.md` (§1.5 gap journey assignment)
  - `TEAM_FOUNDATION_REPORT.md` (Phase 0 done)
  - `ITER174_CLEANUP_REPORT.md` (Founder Only baseline)
