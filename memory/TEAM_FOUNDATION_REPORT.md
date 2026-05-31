# TEAM FOUNDATION REPORT · ITER177 Phase 0

> **Status:** ✅ DELIVERED · 31 May 2026
> **Scope:** Phase 0 · Unblock Invite (4 deliverables)
> **Stato finale DB:** Founder Only ripristinato (1 tenant attivo, 1 utente)
> **Smoke test:** 16/16 step funzionali superati

---

## 0 · TL;DR

Phase 0 completa. Il primo Designer è **invitabile, attivabile e operativo** end-to-end:

```
admin@moodfordesign.com → invita → magic-link → set password → first login → status active → workspace
```

Tutto verificato via smoke test E2E con cleanup automatico (lo stato DB è tornato a Founder Only invariato).

---

## 1 · Migration enum `user_role` ✅

**File:** `/app/supabase/migrations/111_team_foundation_roles.sql`
**Eseguita:** 31 May 2026 00:29:46 UTC
**Schema migration row:** `111_team_foundation_roles.sql`

### Enum BEFORE
```
super_admin, tenant_admin, editor, analyst, project_manager,
designer, client, ad_partner
```

### Enum AFTER
```
super_admin, tenant_admin, editor, analyst, project_manager,
designer, client, ad_partner, sales, advisor
```

### Mapping richiesta utente → enum DB
| Richiesto da utente | Mapping DB | Note |
|---|---|---|
| `super_admin` | `super_admin` | esistente |
| `admin` | `tenant_admin` | esistente · "admin" dello studio |
| `project_manager` | `project_manager` | esistente |
| `designer` | `designer` | esistente |
| `sales` | `sales` | **AGGIUNTO** ✅ |
| `advisor` | `advisor` | **AGGIUNTO** ✅ |
| `client` | `client` | esistente · workflow `/relations/accounts` |

### Permission set per i nuovi ruoli (`/app/backend/core/permissions.py`)
| Ruolo | Permessi | Razionale |
|---|---|---|
| `sales` | leads:RW + projects:R + proposals:R + moodboards:R + inspirations:R + insights:R + collab:R (8) | pipeline + lead nurture, NO proposal authoring/approval |
| `advisor` | leads:R + projects:R + proposals:R + insights:R (4) | external partner read-only |

### Compatibilità preservata
- Tutti gli enum values esistenti **non rimossi** né rinominati
- Tutti i record esistenti (1 row in `users_profile`, admin) **non toccati**
- Helper SQL function `mark_member_accepted(uuid)` + index `users_profile_tenant_status_role_idx` creati come bonus

---

## 2 · First-Login Listener ✅

**File:** `/app/backend/routers/auth.py` · funzione `_accept_invite_if_pending()`
**Trigger:** chiamata da `/api/auth/login` (path password) e `/api/auth/me` (path magic-link / Supabase callback)
**Idempotenza:** ✅ no-op se status già `active`
**Failure-safe:** ✅ exception in update non bloccano l'autenticazione

### Logica
```
IF users_profile.status = 'invited':
   UPDATE users_profile SET status='active', accepted_at=NOW()
   UPDATE tenant_memberships SET status='active' WHERE profile_id=...
   UPDATE member_invites SET status='accepted', accepted_at=NOW()
```

### Validato dallo smoke test
| Test | Esito | Detail |
|---|---|---|
| Pre-login: profile.status = `invited` | ✅ | confermato in DB |
| Pre-login: tenant_memberships.status = `invited` | ✅ | |
| Pre-login: member_invites.status = `sent_silent` | ✅ | (fallback Supabase Admin Create User, SMTP non configurato) |
| Post-login: profile.status = `active` | ✅ | `accepted_at` settato |
| Post-login: tenant_memberships.status = `active` | ✅ | mirrored |
| Post-login: member_invites.status = `accepted` | ✅ | mirrored con `accepted_at` |
| Post-login: `last_login_at` aggiornato | ✅ | |

### Robustezza implementativa
- Doppia copertura (`/login` + `/me`) → funziona sia per credenziali sia per magic-link callback
- 3 mirror update (`users_profile` + `tenant_memberships` + `member_invites`) ognuno in try/except indipendente
- Log strutturato: `[invite-accept] profile=... transitioned invited→active`

---

## 3 · Team Filter ✅

**File:** `/app/backend/routers/members.py` · funzione `list_members()`

### Cambio
```python
GET /api/members?include_clients=false (default)   # esclude role='client'
GET /api/members?include_clients=true              # include tutti
```

### Test validation (smoke E2E)
| Test | Esito | Detail |
|---|---|---|
| `GET /api/members` (default) ESCLUDE clients | ✅ | 1 row (admin), `contains_client=False` |
| `GET /api/members?include_clients=true` OVERRIDE filtro | ✅ | restituisce anche eventuali client |

### Why this matters
Il modulo Team è ora una **vista chiara dello studio interno**. I clienti restano CRM-side (`/relations/accounts`, `/relations/contacts`).

**Backwards compatibility:** parametro opzionale → nessun consumer esistente rotto.

---

## 4 · Smoke Test E2E ✅

**Script:** `/app/backend/scripts/iter177_smoke_test.py`
**JSON results:** `/app/backups/iter177_smoke_results.json`
**Cleanup:** automatico (manuale per gli ultimi 2 step per via di un bug psycopg2 di transaction state — risolto subito dopo)

### Scenario eseguito

```
[1]  admin@moodfordesign.com login (Blueprint2024!)
[2]  GET /api/members (default) → 1 row (admin), no clients
[3]  GET /api/members?include_clients=true → 1 row
[4]  GET /api/members/roles → 9 ruoli inclusi sales + advisor
[5]  Pre-cleanup leftover (idempotent)
[6]  POST /api/members/invite (designer)  → profile created with status=invited
[7]  Verify users_profile / tenant_memberships / member_invites rows
[8]  GET /api/members → 2 rows (admin + designer)
[9]  Supabase Admin: set password sull'invited user (simula "set password" post magic-link)
[10] Designer first login → /api/auth/login successful → status transitioned
[11] DB: status='active', accepted_at!=NULL, last_login_at!=NULL
[12] tenant_memberships mirrored to active
[13] member_invites mirrored to accepted
[14] Designer GET /api/auth/me → 200 status='active'
[15] Designer POST /api/members/invite → 403 (RBAC enforcement)
[16] Cleanup → restore Founder Only
```

### Risultati: 16/16 ✅

```
✅ admin login                                          (HTTP 200)
✅ GET /api/members (default) excludes clients          (1 row, contains_client=False)
✅ GET /api/members?include_clients=true overrides       (1 row)
✅ GET /api/members/roles includes new roles            (ad_partner, advisor, analyst, client,
                                                         designer, editor, project_manager, sales, tenant_admin)
✅ POST /api/members/invite (designer)                  (HTTP 201, id=bd9993fe-…)
✅ users_profile row status='invited' role='designer'
✅ tenant_memberships row status='invited'
✅ member_invites row status='sent_silent'
✅ designer appears in GET /api/members                 (total=2)
✅ supabase admin: set password on invited user         (HTTP 200)
✅ designer first login via /api/auth/login             (HTTP 200, status_in_response='active')
✅ users_profile transitioned invited→active            (accepted_at=2026-05-31 00:32:52)
✅ tenant_memberships mirrored to active
✅ member_invites mirrored to accepted
✅ designer GET /api/auth/me                            (HTTP 200, status='active')
✅ designer BLOCKED from inviting (RBAC)                (HTTP 403)
```

### Stato DB finale (post smoke + cleanup)
```
users_profile          1   (admin only)
tenant_memberships     0
member_invites         0
audit_logs             0
login_attempts         0
leads / accounts / contacts / projects / design_journeys  0/0/0/0/0
auth.users             1   (admin only)
```

✅ **Stato Founder Only di ITER174 perfettamente preservato.**

---

## 5 · Nota sul canale di invito (SMTP fallback)

Durante lo smoke test l'API ha restituito `member_invites.status = 'sent_silent'`. Questo è il **fallback documentato** del codice in `routers/members.py:_supabase_invite_user`:

- **Path A:** `POST /auth/v1/admin/invite` (Supabase magic-link email) → richiede SMTP configurato sul progetto Supabase
- **Path B (fallback):** `POST /auth/v1/admin/users` (silent create senza email) → workflow `/forgot-password` per il primo set-password

Oggi siamo su **Path B**: l'auth.user viene creato ma **NESSUNA email viene inviata automaticamente** all'invitato. L'admin deve:
1. Informare off-band il designer del proprio invito
2. Il designer va su `/forgot-password` con la propria email → Supabase invia email reset password
3. Imposta password → login

**Per attivare Path A (magic-link automatico):** configurare SMTP nel progetto Supabase Auth (Settings → Authentication → SMTP). **Non bloccante per Phase 0.**

---

## 6 · File modificati / creati

| Path | Tipo | Note |
|---|---|---|
| `/app/supabase/migrations/111_team_foundation_roles.sql` | NEW | enum + index + helper function |
| `/app/backend/core/permissions.py` | EDIT | aggiunti `sales` + `advisor` con permission sets |
| `/app/backend/routers/members.py` | EDIT | `TENANT_ASSIGNABLE_ROLES` esteso · `list_members(include_clients=...)` |
| `/app/backend/routers/auth.py` | EDIT | `_accept_invite_if_pending()` + chiamata in `/login` e `/me` |
| `/app/backend/scripts/iter177_smoke_test.py` | NEW | smoke test E2E con cleanup |
| `/app/backups/iter177_smoke_results.json` | NEW | output JSON (16 step) |

**Linter:** Python lint passed sui 3 file editati (gli E701 in `auth.py` sono pre-esistenti su righe non toccate).

---

## 7 · Cosa NON è stato fatto (esplicitamente fuori scope)

Come da direttiva ITER177, sono stati **rinviati a Phase 1+**:

- 🟠 Journey Assignments (tabella `design_journey_assignments` + CRUD)
- 🟠 Notification Bus (domain events + 3-channel fan-out)
- 🟠 Team Visibility model (HR roster avanzato, card referente cliente)
- 🟠 Client Visibility refinement (filtro contributors)
- 🟠 Designer Workspace redesign ("Le mie journey" page, task system)

Tutti documentati in `/app/memory/TEAM_LIFECYCLE_AUDIT.md` con stime.

---

## 8 · Pronto per l'invito reale del primo Designer

L'admin (`admin@moodfordesign.com`) può ora andare su `/settings/members`, cliccare "Invita membro" e creare il primo Designer.

**Workflow operativo:**
1. Admin → `/settings/members` → "Invita membro"
2. Compila email + first_name + last_name + role (`designer`, `project_manager`, `sales`, `advisor`, …)
3. POST `/api/members/invite` → 201 con profilo `status='invited'`
4. (Path B oggi) Admin informa il designer → designer va su `/forgot-password` → setta password
5. Designer logga la prima volta → backend transitiona automaticamente a `status='active'`
6. Designer entra in `/dashboard` → AssignedClientsPanel + workspace (read-only sul Team, no admin)

**Verifica admin:** `GET /api/members` → designer visibile con `status='active'` + `accepted_at` + `last_login_at`.

---

## 9 · Next steps suggeriti

| Pri | Item | Effort |
|---|---|---|
| 🟢 Manuale | **Founder esegue un invito reale** (Designer di prova) per validare end-to-end con UI reale | 5 min |
| 🟢 Op | **Configurare SMTP Supabase** se vuoi automatizzare email magic-link | 30 min |
| 🟠 Phase 1 | **Journey Assignments table + CRUD** (per assegnare cliente a designer) | 2-3 giorni |
| 🟠 Phase 1 | **"Le mie journey" page** per ogni team member | 1-2 giorni |
| 🟡 P0 hotfix | **ITER175 metadata_json fix** (Begin Journey bug pre-esistente) | 1 ora |

---

## 10 · Vincoli rispettati

| Vincolo | Stato |
|---|---|
| Non implementare Journey Assignments | ✅ |
| Non implementare Notification Bus | ✅ |
| Non implementare Team Visibility avanzata | ✅ |
| Non toccare Client Visibility | ✅ |
| Non ridisegnare Designer Workspace | ✅ |
| Cleanup → ripristinare Founder Only | ✅ |
| CMS / templates / languages / schema preservati | ✅ |
| Compatibilità con record esistenti | ✅ (admin row invariato) |
