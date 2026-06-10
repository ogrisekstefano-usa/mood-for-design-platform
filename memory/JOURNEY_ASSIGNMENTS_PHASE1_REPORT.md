# JOURNEY ASSIGNMENTS™ Phase 1 · REPORT · ITER178

> **Status:** ✅ DELIVERED · 31 May 2026
> **Scope:** Phase 1 minima — Migration + Service + CRUD admin + Workspace endpoint + Audit + Auto-owner alla creazione Journey
> **Smoke test:** **24/24 step E2E passati** · Founder Only ripristinato post-cleanup
> **Decisioni Founder approvate:** Q1–Q9 (vedi §0)

---

## 0 · Decisioni Founder applicate

| # | Decisione | Stato |
|---|---|---|
| Q1 | Observer = SÌ | ✅ enum role `observer` |
| Q2 | Contributor multipli = SÌ | ✅ nessun upper bound applicativo (limite morbido suggerito Phase 3) |
| Q3 | Founder visibile = NO (tenant setting) | ✅ default su nuovi rows: rispetta `client_visible` per role. Founder owner non visibile a meno di toggle (toggle non-implementato in Phase 1, default off) |
| Q4 | `client_visible` flag = SÌ | ✅ colonna DB + ritornato in API |
| Q5 | Owner senza replacement = NO | ✅ guard applicativo `cannot_revoke_owner_without_replacement` (HTTP 409) |
| Q6 | Owner multipli = NO | ✅ DB `UNIQUE PARTIAL INDEX dja_one_owner_per_journey` |
| Q7 | Observer visibile = NO (default) | ✅ `_DEFAULT_CLIENT_VISIBLE['observer']=False` |
| Q8 | Owner handoff = SÌ | ✅ `change_owner()` + endpoint `POST .../change-owner` |
| Q9 | Audit events = SÌ | ✅ tabella `design_journey_assignment_events` + 6 event types |

---

## 1 · DELIVERABLE 1 · Migration DB ✅

**File:** `/app/supabase/migrations/113_design_journey_assignments.sql`
**Applicata:** 2026-05-31 09:53 UTC · `schema_migrations: 113_design_journey_assignments.sql`

### Tabella principale `design_journey_assignments`
```
id              uuid PK
tenant_id       uuid NOT NULL → tenants.id (ON DELETE CASCADE)
journey_id      uuid NOT NULL → design_journeys.id (ON DELETE CASCADE)
user_id         uuid NOT NULL → users_profile.id (ON DELETE CASCADE)
assignment_role text NOT NULL CHECK (∈ owner | contributor | observer)
client_visible  boolean NOT NULL DEFAULT true
assigned_at     timestamptz NOT NULL DEFAULT NOW()
assigned_by     uuid → users_profile.id (ON DELETE SET NULL)
revoked_at      timestamptz NULL
revoked_by      uuid → users_profile.id (ON DELETE SET NULL)
revoke_reason   text NULL
metadata_json   jsonb NOT NULL DEFAULT '{}'
created_at / updated_at
```

### Vincoli enforced
- 🔒 **`UNIQUE INDEX dja_one_owner_per_journey`** `(journey_id) WHERE role='owner' AND revoked_at IS NULL` → DB rifiuta 2 owner attivi
- 🔒 **`UNIQUE INDEX dja_one_active_per_user_per_journey`** `(journey_id, user_id) WHERE revoked_at IS NULL` → DB rifiuta doppia assegnazione attiva dello stesso user
- 📑 Trigger `updated_at` auto-set

### Tabella audit `design_journey_assignment_events`
```
id, tenant_id, assignment_id, journey_id, event_type, actor_user_id, payload_json, created_at
```
**Event types ammessi (CHECK):**
`owner_assigned · owner_changed · contributor_added · contributor_removed · observer_added · observer_removed · role_changed · visibility_changed · revoked · reinstated`

Append-only · indici su `(assignment_id, created_at)`, `(journey_id, created_at)`, `(tenant_id)`.

---

## 2 · DELIVERABLE 2 · Auto-owner alla creazione Journey ✅

**File modificato:** `/app/backend/services/client_provisioning.py` (step 2.b, +18 righe)

### Logica
1. Begin Journey crea la `design_journey` row
2. `core.human_assignment.assign(subject='client')` calcola il referente (round-robin priority chain: `tenant_admin > project_manager > designer/editor > super_admin`)
3. ➕ **NEW**: `core.journey_assignments.ensure_owner(tenant, journey, primary_designer_id, created_by)` inserisce 1 row owner nel nuovo subsystem
4. Le due tabelle convivono: `human_assignments` = referente master del rapporto, `design_journey_assignments` = team della journey

**Idempotente:** se l'owner è già lo stesso user, no-op. Se è diverso, handoff.
**Failure-safe:** exception loggata (non-fatal). La creazione del Journey non viene bloccata se il dja insert fallisce.

### Verificato dal smoke test
```
Begin Journey (public) → 201
  journey_id=i18n-recovery-1
  ✅ auto-created 1 owner row at journey init
     rows=[('58d93d46', 'owner', 'ff66feac')] (Designer A by priority)
```

---

## 3 · DELIVERABLE 3 · CRUD Admin ✅

**File:** `/app/backend/routers/journey_assignments_admin.py`
**Mount:** `api_router.include_router(admin_router, prefix="/admin/journeys", tags=["journey-assignments"])`

### Endpoints

| Verb | Path | Permission | Note |
|---|---|---|---|
| `GET`    | `/api/admin/journeys/{jid}/assignments` | `P_PROJECTS_READ` | List active (owner first, contributors, observers) — hydrated con `first_name, last_name, email, role, avatar_url` |
| `POST`   | `/api/admin/journeys/{jid}/assignments` | `P_PROJECTS_WRITE` | Body: `{user_id, assignment_role: contributor\|observer, client_visible?}` |
| `POST`   | `/api/admin/journeys/{jid}/assignments/change-owner` | `P_PROJECTS_WRITE` | Body: `{user_id, reason?}` — handoff atomico |
| `DELETE` | `/api/admin/journeys/{jid}/assignments/{aid}` | `P_PROJECTS_WRITE` | Soft revoke (only contributor/observer; owner rifiutato) |
| `GET`    | `/api/admin/journeys/{jid}/assignments/events` | `P_PROJECTS_READ` | Audit trail recent (default 50, max 200) |

### Guard verificate dal smoke test
| Guard | Test | Esito |
|---|---|---|
| user non esistente | n/a (FK + 404) | implicito |
| user di altro tenant | hard-coded check | implicito |
| user `status='suspended'` | 409 user_suspended | n/a (testato in code review) |
| user `role='client'` | 409 cannot_assign_client | n/a |
| re-add stesso user attivo | 409 user_already_assigned | ✅ |
| revoke owner senza replacement | 409 cannot_revoke_owner_without_replacement | ✅ |
| add via POST con role='owner' | 400/422 (Pydantic Literal) | implicito |
| journey di altro tenant | 404 journey_not_found | implicito |

---

## 4 · DELIVERABLE 4 · `GET /api/workspace/journeys/mine` ✅

**File:** `/app/backend/routers/journey_assignments_admin.py:my_journeys()`
**Mount:** `api_router.include_router(router, prefix="/workspace", tags=["workspace"])`

### Contratto
```
GET /api/workspace/journeys/mine
Auth: any team member (block role='client')
Response: [MyJourneyOut]
```

```json
[
  {
    "assignment_id":   "uuid",
    "assignment_role": "owner | contributor | observer",
    "client_visible":  true,
    "assigned_at":     "ISO timestamp",
    "journey_id":      "uuid",
    "lifecycle_state": "...",
    "overall_status":  "...",
    "started_at":      "...",
    "closed_at":       null,
    "account": { "id", "account_name", "email" }
  }
]
```

### Verificato dal smoke test
- Designer A pre-handoff: 1 row (owner) ✅
- Admin pre-handoff: 0 rows ✅
- Post handoff: Designer A 0 rows, Admin 1 row (owner) ✅

---

## 5 · DELIVERABLE 5 · Audit Events ✅

**Service helper:** `core.journey_assignments._emit_event()` (failure-safe insert)

### Event types implementati (6/6 richiesti)

| Trigger | Event type emitted | Payload tipico |
|---|---|---|
| `ensure_owner` (journey init) | `owner_assigned` | `{user_id, client_visible}` |
| `change_owner` | `owner_changed` (sulla nuova row) | `{from_user_id, from_assignment, to_user_id, to_assignment, reason}` |
| `change_owner` (se target era contributor/observer) | `role_changed` (sulla vecchia row) | `{from, to: 'owner', note}` |
| `add_assignment(role=contributor)` | `contributor_added` | `{user_id, client_visible}` |
| `add_assignment(role=observer)` | `observer_added` | `{user_id, client_visible}` |
| `revoke_assignment(contributor)` | `contributor_removed` | `{user_id, reason}` |
| `revoke_assignment(observer)` | `observer_removed` | `{user_id, reason}` |

### Verificato dal smoke test
```
audit events include all expected types
  got = ['contributor_added', 'observer_added', 'observer_removed',
         'owner_assigned', 'owner_changed', 'role_changed']
  missing = ∅
```

---

## 6 · SMOKE TEST E2E (24/24 ✅)

**Script:** `/app/backend/scripts/iter178_smoke_test.py`
**Risultati JSON:** `/app/backups/iter178_smoke_results.json`

### Scenario eseguito

```
[1]  admin@moodfordesign.com login (Blueprint2024!)
[2]  invite Designer A (role=designer)
[3]  set Designer A password (via Supabase Admin API)
[4]  Designer A login → status='active' (first-login listener ITER177 attivo)
[5]  Begin Journey pubblico (Mario ITER178)
[6]  Verify dja owner row auto-created (Designer A per round-robin priority)
[7]  Admin POST add admin himself as contributor
[8]  GET list → 2 rows ordered owner-first
[9]  POST change-owner → handoff Designer A → admin
[10] Verify owner == admin, old Designer A row revoked
[11] Verify admin's previous contributor row auto-revoked ("promoted_to_owner")
[12] DB invariant: exactly 1 active owner
[13] Designer A /workspace/journeys/mine → 0
[14] Admin /workspace/journeys/mine → 1 (as owner)
[15] Re-add admin → 409 user_already_assigned
[16] Add Designer A as observer (client_visible=False default ✓)
[17] DELETE owner via revoke → 409 (refused — Q5)
[18] DELETE observer → 200
[19] DB confirm revoked_at != NULL
[20] Designer A GET admin assignments (P_PROJECTS_READ) → 200
[21] GET audit events → all 6 expected types present
[22] Verify client referente (Designer A by priority)
[23] Cleanup
[24] Founder Only restored (users=1, journeys=0, dja=0)
```

### Output finale
```
=== SUMMARY ===
  24/24 steps passed
```

---

## 7 · Verifica invarianti DB (post-test)

| Invariante | Mechanism | Test |
|---|---|---|
| 1 owner attivo per journey | `UNIQUE INDEX dja_one_owner_per_journey` PARTIAL | ✅ count=1 dopo handoff |
| 1 active assignment per (journey, user) | `UNIQUE INDEX dja_one_active_per_user_per_journey` PARTIAL | ✅ 409 su re-add |
| Owner non revocabile senza replacement | App-level guard | ✅ 409 |
| FK preserve tenant_id | Schema | ✅ |
| Tenant isolation | All queries filter by `tenant_id` | ✅ (verificato code review) |

---

## 8 · File creati / modificati

| Path | Tipo | Note |
|---|---|---|
| `/app/supabase/migrations/113_design_journey_assignments.sql` | NEW | Tabelle + indici + trigger updated_at |
| `/app/backend/core/journey_assignments.py` | NEW | Service layer (309 righe): `ensure_owner`, `add_assignment`, `change_owner`, `revoke_assignment`, `list_user_journeys`, `list_events`, `get_*` helpers |
| `/app/backend/routers/journey_assignments_admin.py` | NEW | Router admin CRUD + workspace endpoint (210 righe) |
| `/app/backend/server.py` | EDIT | Mount routers (+14 righe) |
| `/app/backend/services/client_provisioning.py` | EDIT | +18 righe step 2.b auto-owner |
| `/app/backend/scripts/iter178_smoke_test.py` | NEW | Smoke test E2E 24 step con cleanup |
| `/app/backups/iter178_smoke_results.json` | NEW | Output JSON 24/24 |
| `/app/memory/JOURNEY_ASSIGNMENTS_ARCHITECTURE.md` | EXISTING | Architettura (ITER178 audit) |
| `/app/memory/JOURNEY_ASSIGNMENTS_PHASE1_REPORT.md` | NEW | Questo file |

**Linter:** ✅ ruff su entrambi i nuovi file Python (`core/journey_assignments.py` + `routers/journey_assignments_admin.py`).

---

## 9 · Cosa NON è stato fatto (per direttiva esplicita)

Rinviato a Phase 2/3:
- 🟠 **UI drawer** "Assegna Team" admin
- 🟠 **Team cards cliente** (endpoint `GET /api/client/journeys/{jid}/team`)
- 🟠 **Notification Bus** fan-out (in-app + email + pulse)
- 🟠 **Designer Workspace redesign** (page `/workspace/journeys` con cards)
- 🟠 **Auto-revoke on user suspend** (trigger applicativo)

Tutti dimensionati in `JOURNEY_ASSIGNMENTS_ARCHITECTURE.md §11`.

---

## 10 · Sintesi compatibilità

| Sistema esistente | Stato post Phase 1 |
|---|---|
| Founder Only™ (ITER174) | ✅ Stato ripristinato post smoke test |
| Team Foundation™ (ITER177) | ✅ Enum role + first-login listener intatti |
| Begin Journey pubblico | ✅ Aggiunge 1 INSERT senza modificare il resto del flusso |
| Client Design Journey™ (Atelier Gen3) | ✅ Nessuna modifica UI cliente (Phase 2) |
| `human_assignments` (referente account-level) | ✅ Coesiste senza interferenza |
| AssignedClientsPanel | 🟢 Continua a funzionare; estensione UNION a `dja` rinviata a Phase 2 |
| Magic-link Auth | ✅ Indipendente |
| Email Templates | ✅ Indipendente |
| CMS / Editorial | ✅ Indipendente |
| Tenant Isolation™ | ✅ `tenant_id` enforcement su tutte le query |

---

## 11 · Stato DB finale (verificato post-cleanup)

```
users_profile          1   (admin@moodfordesign.com only)
auth.users             1   (admin@moodfordesign.com only)
design_journeys        0
design_journey_assignments         0  ← NEW table, vuota
design_journey_assignment_events   0  ← NEW table, vuota
leads / accounts / contacts / projects   0/0/0/0
human_assignments      0
relationship_threads   0
schema_migrations      include '113_design_journey_assignments.sql' ✅
```

✅ Founder Only™ baseline ITER174 perfettamente preservato.

---

## 12 · Vincoli direttiva ITER178 Phase 1 rispettati

| Vincolo | Stato |
|---|---|
| NON implementare UI drawer | ✅ |
| NON implementare team cards cliente | ✅ |
| NON implementare Notification Bus | ✅ |
| NON implementare Designer Workspace redesign | ✅ |
| Solo migration + CRUD + workspace endpoint + audit | ✅ |
| Smoke test completo Founder → Designer → Journey → Assignment → My Journeys | ✅ |

---

## 13 · Next steps suggeriti

| Pri | Item | Effort |
|---|---|---|
| 🟢 Manuale | Founder esegue un invito Designer + 1 Begin Journey via UI per validare con dati reali | 5 min |
| 🟠 Phase 2 | UI drawer "Assegna Team" sul detail journey admin | 1g |
| 🟠 Phase 2 | Endpoint cliente `GET /api/client/journeys/{jid}/team` (filtered) | 0.5g |
| 🟠 Phase 2 | Page `/workspace/journeys` con cards "Le mie Journey™" | 1-2g |
| 🟡 P1 | Auto-revoke on user suspend (trigger applicativo) | 0.5g |
| 🟢 Phase 3 | Notification Bus fan-out (in-app + email + pulse) | 3-4g |

---

✅ **JOURNEY ASSIGNMENTS™ Phase 1 — DELIVERED**
- Migration + service + 5 endpoints CRUD + workspace/mine + 6 audit event types
- 24/24 smoke test E2E
- DB Founder Only ripristinato
- Vincoli direttiva 100% rispettati
