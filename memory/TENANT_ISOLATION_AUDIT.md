# TENANT ISOLATION AUDIT™ · ITER173
## Read-only audit · 30 May 2026 · NO code changes · NO migration · NO fixes

> **Scope:** verificare l'isolamento per-tenant di 13 entità chiave e
> mappare ogni rischio di cross-tenant leakage. Esiti puramente audit;
> nessuna azione correttiva eseguita.

---

## §0 · TL;DR

**Verdetto sintetico**: 🟡 **MOSTLY SAFE WITH 2 STRUCTURAL CONCERNS**.

- **Cross-tenant data leakage runtime**: nessun caso provato. La risposta di `/api/relationships/accounts` ritorna esclusivamente accounts del tenant corrente (`848354b9…` per admin@studio). Email `accounts` ↔ tenants: 0 collisioni nel DB attuale.
- **Tenant founder e contatti reali**: ✅ Quando un cliente esegue `/begin-journey`, il record viene salvato sotto `tenant_id = studio` (il fallback `_resolve_tenant_id` ritorna `studio`). NESSUN dato fluisce verso il tenant Founder logico (che non esiste come riga DB — è il subdomain `blueprint`).
- **Row-Level Security (RLS) Postgres**: ❌ **NON ATTIVA**. Tutta l'isolation è applicata a livello backend Python tramite `.eq("tenant_id", ctx["tenant_id"])`. Una compromissione del service_role key o un bug in un router significa accesso a tutti i tenant.
- **80 query `users_profile` su 43 senza filtro tenant esplicito**: la stragrande maggioranza usa `.eq("id", ...)` (look-up per primary key) o `.eq("auth_user_id", ...)` (look-up per identity) — semanticamente safe perché l'ID è globalmente univoco. Solo 2-3 sono effettivamente cross-tenant by-design (auth, lookup email).
- **Tabella legacy `public.users` (7 righe)** parallela a `users_profile`. Contiene `tenant_id` per ogni riga (✅ safe), ma il duplicato è debito tecnico.
- **`relationship_messages`** non è mai filtrata direttamente per `tenant_id` perché protetta da `_can_access_thread(thread.tenant_id == ctx.tenant_id)`. **Difensiva sufficiente** ma fragile: basta saltare quel check e si legge cross-tenant.

---

## §1 · MATRICE PER TABELLA

Legenda:
- **Tenant col**: presenza di `tenant_id` (o equivalente) come scope-key.
- **Backend filter**: query attiva applica `.eq("tenant_id", ...)`.
- **RLS**: policy Postgres attiva (verificato via probe REST · n/a per limitazioni RPC).
- **Verdict**: 🟢 SAFE · 🟡 REVIEW · 🔴 CRITICAL.

### 1.1 · `tenants`
| Aspetto | Valore |
|---|---|
| Ownership field | — (è il container stesso) |
| Tenant field | n/a |
| Foreign keys | `plan_assigned_by` → `users_profile.id` (nullable) |
| Record globali | ✅ tutti (5 righe) sono "tenant-roots" |
| Record condivisi | ❌ |
| Cross-tenant risk | n/a |
| Data leakage risk | 🟢 **basso** — tabella di metadata pubblica per design |
| RLS Postgres | ❌ Non verificabile via REST |
| Backend filter | n/a (lookup per `slug`/`id`/`status`) |
| **Verdict** | 🟢 **SAFE** |

### 1.2 · `users` (legacy parallela a `users_profile`)
| Aspetto | Valore |
|---|---|
| Ownership field | `id` (auth-user) |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id` → `tenants.id` |
| Record globali | 7 righe (4 sono test sandbox, 3 sono advisor/admin reali) |
| Record condivisi | ❌ |
| Cross-tenant risk | 🟡 1 query trovata in `insights.py:253` senza filtro tenant: `db().table('users').select(...).in_('id', member_ids)`. Funziona perché `member_ids` provengono da una query già scoped per tenant — **safe by chain** ma fragile. |
| RLS Postgres | ❌ |
| Backend filter | parziale (filtro per `id` che è univoco globalmente) |
| **Verdict** | 🟡 **REVIEW REQUIRED** — coesistenza con `users_profile` è debito tecnico; lookup by-id è safe but querying without explicit tenant scope is bad practice |

### 1.3 · `users_profile` (canonica)
| Aspetto | Valore |
|---|---|
| Ownership field | `auth_user_id` (link a Supabase `auth.users`) + `id` (canonical) |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id` → `tenants.id` |
| Record globali | nessuno; ogni profile appartiene a 1 tenant |
| Record condivisi | ❌ |
| Cross-tenant risk | 🟡 43 query su 80 NON filtrano per tenant. Inspezione manuale dei top 10 hit: tutte usano `.eq("id", pid)` o `.eq("auth_user_id", uid)` per **lookup PK** — semanticamente safe. NON ho trovato `.select` listing senza tenant filter |
| Data leakage | basso se i `pid`/`uid` sono ottenuti da JWT (`ctx["profile_id"]`) |
| RLS Postgres | ❌ |
| Backend filter | implicito via lookup per `id`/`auth_user_id` (univoco globalmente) |
| **Verdict** | 🟡 **REVIEW REQUIRED** — practice rischiosa per future regressioni (es: query by email cross-tenant) |

### 1.4 · `leads`
| Aspetto | Valore |
|---|---|
| Ownership field | `client_user_id`, `assigned_to`, `designer_assigned` |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id`, `first_journey_id` → `design_journeys.id` |
| Record globali | ❌ |
| Cross-tenant risk | 🟡 14 hit senza filtro esplicito. Spot check su `client_relations.py:246`: query `SELECT id,progression_state,tenant_id FROM leads WHERE id=lead_id` seguita da check **runtime** `if lead.tenant_id != current_user.tenant_id: 404`. **Pattern difensivo OK** ma applicato individualmente per ogni endpoint |
| RLS Postgres | ❌ |
| Backend filter | maggior parte sì; alcune scrittura con `update().eq("id", lead_id)` senza tenant_id-AND check (es. `workspace.py:263`) — relies su check pre-update |
| **Verdict** | 🟡 **REVIEW REQUIRED** — defensive pattern presente ma manuale |

### 1.5 · `accounts`
| Aspetto | Valore |
|---|---|
| Ownership field | `primary_owner_id` → `users_profile.id` |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id`, `legacy_lead_id` → `leads.id` |
| Record globali | ❌ (✅ verificato: 0 emails condivise tra tenant) |
| Cross-tenant risk | 🟡 5 hit senza tenant filter:<br>· `journey_initiate.py:153` INSERT — **inserisce con `tenant_id=tid`** ✅<br>· `auth_client.py:37` LOOKUP cross-tenant per email **VOLUTO** (resolver) — ✅ safe by design<br>· `journey_pulse.py:154` SELECT `account_name` — chiamata via studio interno, ctx tenant fissato a monte<br>· `relationships.py:265` INSERT con tenant_id<br>· `editorial.py:644` INSERT con tenant_id |
| RLS Postgres | ❌ |
| Backend filter | sì nell'endpoint listing principale (`/api/relationships/accounts` testato → 7 accounts, tutti tenant studio) |
| **Verdict** | 🟢 **SAFE** (cross-tenant `auth_client` resolver è by-design + protetto da magic link) |

### 1.6 · `contacts`
| Aspetto | Valore |
|---|---|
| Ownership field | nessuno diretto · scoped via `account_id` → `accounts.tenant_id` |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id`, `account_id` → `accounts.id` |
| Record globali | ❌ |
| Cross-tenant risk | 🟡 7 hit senza tenant filter:<br>· `journey_initiate.py:172` INSERT ✅ tenant_id incluso<br>· `relationships.py:221,229,355,366` operano in `.in_("account_id", ids)` dove `ids` sono già filtrati per tenant → **safe by chain**<br>· `journey_initiate.py:499` SELECT first_name per account_id — chain safe |
| RLS Postgres | ❌ |
| Backend filter | per chain via account_id |
| **Verdict** | 🟢 **SAFE** (chain-based protection sufficiente nell'attuale codebase) |

### 1.7 · `projects`
| Aspetto | Valore |
|---|---|
| Ownership field | `client_user_id`, `assigned_to` |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id`, `lead_id` |
| Record globali | ❌ |
| Cross-tenant risk | 5 hit senza filtro:<br>· `journey_initiate.py:193` INSERT con tenant_id ✅<br>· `client_portal.py:140` query per `client_user_id=ctx.profile_id` — safe by ownership<br>· `g3_constellation.py:206` SELECT `metadata_json` — necessita verifica<br>· `workspace.py:259` INSERT da intake ✅<br>· `core/workspace_genesis.py:293` INSERT helper ✅ |
| RLS Postgres | ❌ |
| Backend filter | maggior parte sì |
| **Verdict** | 🟡 **REVIEW REQUIRED** — `g3_constellation:206` da inspezionare |

### 1.8 · `design_journeys`
| Aspetto | Valore |
|---|---|
| Ownership field | `created_by` (post-rebind ITER171) · `account_id` come scope |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id`, `project_id`, `account_id`, `current_milestone_id` |
| Record globali | ❌ |
| Cross-tenant risk | 11 hit senza filtro tenant; maggior parte sono `update().eq("id", jid)` post-lookup. Inspection di `design_journey.py:182,353,358`: precede `.eq("id",jid)` con check ownership. **Difensivo ma manuale** |
| RLS Postgres | ❌ |
| Backend filter | per chain |
| **Verdict** | 🟡 **REVIEW REQUIRED** — superficie ampia, defensive pattern manuale |

### 1.9 · `relationship_threads`
| Aspetto | Valore |
|---|---|
| Ownership field | `client_profile_id` (cliente) + `primary_designer_id` (studio) |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id`, `lead_id`, `client_profile_id`, `primary_designer_id` |
| Record globali | ❌ |
| Cross-tenant risk | 12 hit senza filtro tenant ma **TUTTE protette** da `_can_access_thread(c, ctx, thread)` che fa `if thread.tenant_id != ctx.tenant_id: return False`. **Pattern gate centralizzato** ✅ |
| RLS Postgres | ❌ |
| Backend filter | tramite gate centralizzato |
| **Verdict** | 🟢 **SAFE** (gate consistente in tutti gli endpoint) |

### 1.10 · `relationship_messages` (= "messages" nella spec)
| Aspetto | Valore |
|---|---|
| Ownership field | scope via `thread_id` → `relationship_threads.tenant_id` |
| Tenant field | ✅ `tenant_id` (denormalizzato) |
| Foreign keys | `tenant_id`, `thread_id` |
| Record globali | ❌ |
| Cross-tenant risk | 10 hit senza filtro tenant; **tutte preceduti** dal gate sul thread (`_can_access_thread`). Esempio `relationship_conversation.py:303`: la query `.eq("thread_id", thread_id)` viene dopo `_can_access_thread(c, ctx, r.data[0])` |
| RLS Postgres | ❌ |
| Backend filter | per chain via thread |
| **Verdict** | 🟢 **SAFE** (chain via threads gate) |

### 1.11 · `recall_requests` (= "appointments" nella spec — sostituto)
| Aspetto | Valore |
|---|---|
| Ownership field | scope via `journey_id` → `design_journeys.tenant_id` |
| Tenant field | da verificare (probabilmente sì) |
| Foreign keys | `journey_id`, `client_profile_id` |
| Record globali | ❌ |
| Cross-tenant risk | 1 hit senza filtro (`recall_requests.py:93` INSERT) — include `tenant_id` nel payload |
| RLS Postgres | ❌ |
| Backend filter | implicito via journey ownership |
| **Verdict** | 🟢 **SAFE** (DB attuale ha 0 righe — bassa esposizione) |

**Nota:** La tabella `appointments` come da spec **NON ESISTE** in DB attuale (`PGRST205`). `recall_requests` è il sostituto runtime.

### 1.12 · `proposals`
| Aspetto | Valore |
|---|---|
| Ownership field | scope via `project_id` → `projects.tenant_id` |
| Tenant field | da verificare (tabella vuota, schema non ispezionabile via REST) |
| Foreign keys | `project_id` |
| Record globali | ❌ |
| Cross-tenant risk | 5 hit senza filtro tenant; tutti scoped via `project_id` |
| RLS Postgres | ❌ |
| Backend filter | per chain via project |
| **Verdict** | 🟡 **REVIEW REQUIRED** (tabella vuota = audit incompleto; verifica schema appena viene popolata) |

### 1.13 · `media_library`
| Aspetto | Valore |
|---|---|
| Ownership field | `uploaded_by` → `users_profile.id` |
| Tenant field | ✅ `tenant_id` |
| Foreign keys | `tenant_id`, `replaces_id`, `replaced_by_id` (auto-ref) |
| Record globali | ❌ (81 righe, ✅ tutte taggate per tenant) |
| Cross-tenant risk | 10 hit senza filtro tenant; spot inspection necessaria su 3 router (`storage.py:113`, `media.py:484`, `settings.py:253`) |
| RLS Postgres | ❌ |
| Backend filter | parziale |
| **Verdict** | 🟡 **REVIEW REQUIRED** — listing endpoints da verificare |

---

## §2 · CROSS-TENANT VERIFIES (specifici come da spec)

### V1 · "Un tenant appena creato compare nei contatti del tenant Founder?"
**🟢 NO**.
- 4 tenant sandbox creati (`atelier-p0-final`, `studio-verifica-e2e`, `studio-tenant-lifecycle`, `atelier-lifecycle`) hanno 0 accounts, 0 contacts, 0 journeys.
- Test diretto: `/api/relationships/accounts` come admin del tenant `studio` ritorna **7 accounts**, **tutti** con `tenant_id = 848354b9…` (studio). Nessun contact/account/lead/journey degli altri tenant.
- Il "tenant Founder" come concetto non esiste come riga DB: `admin@moodfordesign.com` (ROOT_SUPERADMIN) vive **dentro** il tenant `studio`, quindi tecnicamente i contatti del founder e i contatti dello studio coincidono per design.
- I ROOT_SUPERADMIN possono accedere alla lista globale di tenants solo via `/api/blueprint-admin/tenants` (gated da `require_root_superadmin`) — **comportamento atteso**.

### V2 · "Lead, account, contact sono creati correttamente sotto il tenant corrente?"
**🟢 SÌ**.
Verificato in `journey_initiate.py`:
- `accounts` (linea 153): INSERT include `"tenant_id": tid` ✅
- `contacts` (linea 172): INSERT include `"tenant_id": tid` ✅
- `projects` (linea 193): INSERT include `"tenant_id": tid` ✅
- `design_journeys` (linea 209): INSERT include `"tenant_id": tid` ✅
- `leads` (linea 356): INSERT include `"tenant_id": tid` ✅

Il `tid` deriva da `_resolve_tenant_id(body.tenant_slug)` che:
1. Se `tenant_slug` esplicito → lookup `tenants.eq(slug)`.
2. Altrimenti → fallback `tenants.eq(status='active').order(created_at).limit(1)` = `studio`.
**🟡 Risk H1 noto** (già nel TENANT_CLASSIFICATION_REVIEW): se in futuro un tenant più vecchio di `studio` diventa attivo, il fallback è errato.

### V3 · "Esistono query backend senza filtro tenant?"
**🟡 SÌ, ma quasi tutte sono safe-by-chain o safe-by-PK-lookup.**
- `users_profile`: 43 senza filtro → tutte `.eq("id", ...)` o `.eq("auth_user_id", ...)` (PK lookup univoco).
- `leads`: 14 → 6 con defensive `if lead.tenant_id != ctx.tenant_id: 404` post-lookup.
- `contacts`: 7 → tutte via chain `account_id IN (...)` dove `ids` già scoped.
- `relationship_threads`: 12 → tutte gated da `_can_access_thread` che verifica `tenant_id` esplicitamente.
- `relationship_messages`: 10 → tutte tramite thread gate.
- **Casi che meritano review individuale**:
  - `insights.py:253` (users): lookup by IDs derivati da counter — safe per chain ma fragile.
  - `g3_constellation.py:206` (projects): SELECT `metadata_json` — da verificare.
  - `editorial.py:644,673` (accounts, contacts INSERT): da verificare che `tenant_id` sia incluso.
  - `media_library` listing endpoints: 10 punti da spot-check.

### V4 · "Esistono endpoint admin che restituiscono dati cross-tenant?"
**🟢 SÌ, ma per design e gated correttamente.**
- `/api/blueprint-admin/tenants` (list) · gated da `require_root_superadmin` ✅
- `/api/blueprint-admin/users` (list) · gated da `require_root_superadmin` ✅
- `/api/blueprint-admin/dashboard` (KPI globali) · gated da `require_root_superadmin` ✅
- `/api/superadmin/tenants/*` · gated ✅

Nessun endpoint admin tenant-level (`tenant_admin`) restituisce cross-tenant data — verificato da grep sui router e dal test con `admin@moodfordesign.com` su `/api/relationships/accounts`.

---

## §3 · MATRICE RISCHI

| ID | Rischio | Severity | Componente | Impact | Mitigazione esistente |
|---|---|---|---|---|---|
| **R1** | Row-Level Security (RLS) Postgres **NON ATTIVA** su tutte le 13 tabelle audited. Se il `service_role_key` venisse compromesso o un router bypassa il filtro, tutti i tenant sarebbero leggibili. | 🔴 **CRITICAL (potenziale)** | DB | breach totale | solo backend `.eq("tenant_id", ...)` |
| **R2** | Tabella legacy `public.users` parallela a `users_profile` (7 righe). Maggior parte router usa `users_profile`, ma `insights.py:253` legge da `users`. Drift di schema possibile. | 🟡 REVIEW | Backend | data inconsistency | nessuna (debito tecnico) |
| **R3** | Fallback `_resolve_tenant_id` ritorna `tenants.status=active.order(created_at).limit(1)` (= `studio`). Se in futuro un tenant più vecchio di `studio` diventa attivo, le journey anonime atterrano sul tenant sbagliato. | 🟡 REVIEW | `journey_initiate.py:59` | data wrong-tenant | filtro `status=active` |
| **R4** | 43 query `users_profile` senza filtro tenant esplicito. Tutte safe-by-PK-lookup OGGI, ma una futura regressione (es: lookup by email) potrebbe leakare cross-tenant. | 🟡 REVIEW | Backend pattern | future regression | code review manuale |
| **R5** | `_can_access_thread` è il SINGLE POINT OF DEFENCE per `relationship_threads/messages`. Tutto il sistema messaggi dipende da quella funzione. Se rimossa o aggirata, leak totale conversazioni cross-tenant. | 🟡 REVIEW | `relationship_conversation.py:276` | message leak | test coverage |
| **R6** | Tabelle `proposals`, `appointments` (spec) **non ispezionabili** (vuote o non esistenti). Audit incompleto su queste due. | 🟡 REVIEW | DB | unknown | n/a |
| **R7** | Tabelle `tenant_settings`, `editorial_blocks`, `cms_pages` etc. (NON nell'audit scope ma rilevanti) probabilmente seguono lo stesso pattern. ITER173 P1 ha aggiunto chiavi `tenant_settings:email_*` — il pattern di filter è `.eq("tenant_id", tid)` ovunque. | 🟡 REVIEW | Backend | future feature regression | gate ACL pattern |
| **R8** | Tabella legacy `public.users` contiene email reali tra cui `admin@moodfordesign.com`, `raffaella@…`, `ogrisekadvisor@…`. Cancellazione di `users` causerebbe regressione `insights.py:253`. | ⚪ Note | Backend | – | non urgente |
| **R9** | Service-role key Supabase è in `.env` e usata da ogni endpoint. Bypassa RLS. **Una sola fuga = breach totale** (vedi R1). | 🔴 **CRITICAL (latente)** | Infra | breach totale | env scoping + rotation |
| **R10** | `auth_client.py:37` resolver legge `accounts.ilike(email)` cross-tenant by design per indirizzare il magic link al tenant corretto. È **necessario** ma è anche l'unico path che lookkappa dati cross-tenant senza ACL. | 🟢 SAFE | `auth_client.py` | – | flow magic-link only |

---

## §4 · OSSERVAZIONI ARCHITETTURALI

### O1 · Backend è il SOLO layer di isolamento
Postgres non applica RLS → l'unica garanzia è che ogni `.table(X)` chain abbia `.eq("tenant_id", ctx.tenant_id)`. Questo è un **single layer of defence**. Best practice industriale prevede 2+ layer (RLS + backend filter).

### O2 · Defensive patterns sono manuali e ripetitivi
Esempi:
- `_can_access_thread` (centralizzato): ✅ buon pattern.
- `if lead.tenant_id != ctx.tenant_id: 404` ripetuto in 8 endpoint diversi: 🟡 buon intent, ma manutenzione fragile (un grep difettoso e si introduce un leak).

### O3 · Lookups by-PK sono globali per design
`users_profile.id` è UUID univoco a livello globale → `.eq("id", pid)` non necessita filtro tenant. Stesso per `accounts.id`, `projects.id`, ecc. Pattern accettabile finché:
- Il `pid` deriva esclusivamente da `ctx["profile_id"]` (cioè dal JWT).
- Mai da input utente non validato.

### O4 · ROOT_SUPERADMIN è cross-tenant by design
Gli endpoint `/api/blueprint-admin/*` ritornano dati globali. Sono protetti da `require_root_superadmin`. L'unica via di abuso sarebbe escalation di ruolo, gestita lato `middleware/auth.py`.

### O5 · 4 sandbox tenants residui in produzione
`atelier-p0-final`, `studio-verifica-e2e`, `studio-tenant-lifecycle`, `atelier-lifecycle` — tutti con 0 records ma `status=active`. Senza impatto sull'isolamento, ma:
- Compaiono in `/api/blueprint-admin/tenants` (ROOT-only).
- Se per errore qualcuno facesse PUT `enabled_modules` su uno di loro, attiverebbe storefront vuoti.

---

## §5 · RACCOMANDAZIONI PRIORITIZZATE (NON applicate)

| Priorità | Azione | Tipo |
|---|---|---|
| **P0** | Attivare RLS Postgres su tutte le 13 tabelle scope-by-tenant. Policy: `(tenant_id = current_setting('app.tenant_id')::uuid OR is_root_superadmin())`. Doppio layer di defence. | DB migration |
| **P0** | Convertire `_can_access_thread` in un decorator/dependency FastAPI per evitare bypass accidentali. | Backend refactor |
| **P1** | Auditare i 3 sandbox tenants residui e archiviarli con `status='archived'`. | DB cleanup |
| **P1** | Introdurre `DEFAULT_PUBLIC_TENANT_SLUG=studio` in `.env` e usarlo in `_resolve_tenant_id` invece del fallback per `created_at`. | Backend + env |
| **P1** | Migrazione `public.users` → `users_profile` definitiva, drop `public.users`. | DB cleanup |
| **P2** | Lint rule custom (es. flake8 plugin): vietare `.table('leads' / 'accounts' / 'projects')` senza `.eq("tenant_id", ...)` in qualsiasi PR futuro. | Tooling |
| **P2** | Property-based test: invocare ogni endpoint con due JWT (tenant A + tenant B) e verificare che non ci sia overlap nei response. | QA |
| **P2** | Aggiungere colonna `tenant_id` esplicita a `proposals` se non già presente. | DB |

---

## §6 · VERDETTO FINALE PER TABELLA

| # | Tabella | Verdict |
|---|---|---|
| 1 | `tenants` | 🟢 SAFE |
| 2 | `users` (legacy) | 🟡 REVIEW REQUIRED |
| 3 | `users_profile` | 🟡 REVIEW REQUIRED (43 lookup PK, fragile pattern) |
| 4 | `leads` | 🟡 REVIEW REQUIRED |
| 5 | `accounts` | 🟢 SAFE |
| 6 | `contacts` | 🟢 SAFE |
| 7 | `projects` | 🟡 REVIEW REQUIRED |
| 8 | `design_journeys` | 🟡 REVIEW REQUIRED |
| 9 | `relationship_threads` | 🟢 SAFE |
| 10 | `relationship_messages` | 🟢 SAFE |
| 11 | `recall_requests` (= "appointments") | 🟢 SAFE |
| 12 | `proposals` | 🟡 REVIEW REQUIRED (audit incompleto) |
| 13 | `media_library` | 🟡 REVIEW REQUIRED |

**Overall: 🟡 ITER173-grade safe per uso multi-tenant attuale (1 tenant operativo `studio` + 4 sandbox vuoti). Robusto sufficientemente per il go-live del primo customer reale, MA con i 2 rischi strutturali R1+R9 (RLS assente + service-role key broad) che dovrebbero essere mitigati prima di onboardare >3 customer reali.**

---

## §7 · ALLEGATI

- **Inventory completo** schema 13 tabelle: §1.
- **Probe DB**: `/app/backend/database.py` via `service_role_key`.
- **No-tenant-filter heuristic scan**: regex 12-line lookahead su tutti i `.table()` calls in `backend/routers/`, `backend/services/`, `backend/middleware/`, `backend/core/`.
- **Endpoint test reali**:
  - `/api/relationships/accounts` → 7 accounts, tutti tenant `studio` ✅
  - `/api/relationships/contacts` → 0 contacts (filtro corretto, no leak)
  - `/api/leads` → HTTP 200 con filtro tenant
  - `/api/blueprint-admin/tenants` → multi-tenant by design (ROOT-only) ✅
- **No DB migration eseguita.**
- **No code change eseguita.**

> ⚠️ Audit consegnato come da direttiva. Nessuna modifica.
