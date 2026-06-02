# RELATIONSHIP OS™ — M2 RELATIONSHIP TIMELINE — EXECUTION PLAN
> Vista unificata cronologica degli eventi/email/attività + predisposizione
> Relationship Health Foundation (data signals, no UI/scoring/dashboard).
> NESSUNA IMPLEMENTAZIONE in questo documento.

**Classificazione finale**: 🟢 **`READY_FOR_M2_IMPLEMENTATION`**

L'infrastruttura DB è già pronta da M0/M1:
- `v_relationship_timeline` operativa (135 righe storiche su preview)
- `relationship_score` + `last_touch_at` already on `tenant_contacts` and ready on `tenants` (vedi §2)
- Catalog `platform_relationship_event_types` con flag `show_in_timeline` per D5

Resta da progettare: **service hooks**, **cursor pagination**, **filters**,
**founder mirror**, **performance budget**. Tutto in ~3.5 giorni-uomo,
nessun debito tecnico residuo da M1.

---

## 0 · ESTENSIONE ARCHITETTURALE — Relationship Health Foundation

> **Solo predisposizione**. Nessuna UI, nessun dashboard, nessun ML.
> Ogni evento timeline e attività deve **alimentare** i due signal data
> già presenti sul modello. La regola di scoring resta intenzionalmente
> banale in M2: una formula a step, modificabile in futuro senza rompere
> chi consuma i campi.

### 0.1 Campi già esistenti (da M0)
| Tabella | Campo | Tipo |
|---|---|---|
| `tenant_contacts` | `relationship_score` | `INTEGER NOT NULL DEFAULT 0` |
| `tenant_contacts` | `last_touch_at` | `TIMESTAMPTZ NULL` |

### 0.2 Aggiunta in `tenants` (migration 033 — minima)
Per supportare l'**organization-level health signal** distinto dai signal
per-contatto, allineato al pattern Org. Relationship Owner di M1:
```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch_at      TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tenants_relationship_score
  ON tenants(relationship_score DESC) WHERE relationship_score > 0;
```

### 0.3 Catalog `platform_relationship_event_types` — nuova colonna `score_delta`
```sql
ALTER TABLE platform_relationship_event_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT FALSE;
```
- `score_delta`: incremento da applicare al `relationship_score` quando l'evento avviene
- `touch`: se TRUE, aggiorna `last_touch_at` (high-signal interaction)

### 0.4 Catalog `platform_activity_types` — stesso pattern
```sql
ALTER TABLE platform_activity_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT TRUE;
```

### 0.5 Seed valori M2 (proposta — solo data, no logica)
Event types (campioni rilevanti):
| code | score_delta | touch |
|---|---|---|
| relation_opened | +5 | TRUE |
| activated | +20 | TRUE |
| magic_link_consumed | +15 | TRUE |
| blueprint_first_access | +10 | TRUE |
| contact_added | +2 | FALSE |
| status_changed | +3 | TRUE |
| temperature_changed | 0 | FALSE |
| password_set | +1 | FALSE |
| password_reset_requested | 0 | FALSE |
| contact_archived | -2 | FALSE |
| qualification_done | +10 | TRUE |
| presentation_delivered | +12 | TRUE |
| ecosystem_aligned | +15 | TRUE |
| visit_recorded | +8 | TRUE |
| note_added | +1 | FALSE |
| archived | -50 | FALSE |

Activity types:
| code | score_delta | touch |
|---|---|---|
| call | +5 | TRUE |
| meeting | +8 | TRUE |
| visit | +10 | TRUE |
| email | +2 | TRUE |
| whatsapp | +2 | TRUE |
| linkedin | +1 | TRUE |
| internal_note | 0 | FALSE |
| task | 0 | FALSE |

I valori sono **dati di configurazione**, non logica. M+ potrà sostituirli
con un calcolo time-decay o un modello ML senza toccare il codice.

### 0.6 Service `services/relationship_health.py` (NEW)
Singolo entry point usato da tutti i writer:
```python
async def apply_signal(s, tenant_id, *, contact_id=None, source: str,
                       type_code: str) -> None:
    """source ∈ {'event','activity'}. Legge score_delta/touch dal catalog,
    applica:
      - tenant_contacts.relationship_score += delta  (se contact_id)
      - tenant_contacts.last_touch_at = NOW()        (se touch)
      - tenants.relationship_score += delta
      - tenants.last_touch_at = NOW()                (se touch)
    Idempotency: usa il caller-side guard (eventi append-only sono già unici).
    """
```

### 0.7 Vincoli e non-obiettivi M2
- ❌ Nessuna API espone `relationship_score` (M+)
- ❌ Nessun KPI visivo dello score
- ❌ Nessun dashboard
- ❌ Nessuna formula time-decay (M+ se servirà)
- ❌ Nessun batch recompute storico

I valori si accumulano solo per **eventi futuri** post-M2. Lo storico
38 eventi + 0 attività in `relationship_activities` non viene rielaborato
retroattivamente (decisione esplicita: accumulo forward, no backfill).

---

## 1 · MODULO 1 — RELATIONSHIP TIMELINE

### 1.1 Service `services/timeline.py` (NEW)
```python
async def list_timeline(
    tenant_id: str, *,
    since: datetime | None = None,
    until: datetime | None = None,
    sources: list[str] | None = None,  # ['event','email','activity']
    type_codes: list[str] | None = None,
    cursor: dict | None = None,        # {'at': ISO8601, 'id': UUID}
    limit: int = 30,
) -> dict:
    """Returns paginated cronologica DESC. Cursor on (at, id) — index-friendly."""
```

### 1.2 Sorgenti (già coperte dalla view M0)
Read-only su `v_relationship_timeline`, filtrata per tenant_id e
arricchita dal catalog per la label localizzata (`label_it`/`label_en` e icona Lucide).

### 1.3 Cursor pagination
Ordering: `at DESC, id DESC`. Cursor encodes (at, id). Index `idx_relationship_events_tenant_when` + `idx_relationship_activities_tenant_when` già creati in M0.

### 1.4 Response shape
```json
{
  "items": [{
    "source": "event|email|activity",
    "id": "uuid",
    "at": "2026-06-02T...",
    "type_code": "magic_link_consumed",
    "label": "Primo accesso",        // localized via catalog
    "icon": "log-in",
    "color": "#22c55e",
    "subject": "...",                 // null per event-source
    "owner_user_id": "uuid|null",
    "owner_display": "...|null",
    "contact_id": "uuid|null",
    "payload": { ... }
  }],
  "next_cursor": "<base64 encoded>",
  "total_returned": 30
}
```

---

## 2 · MODULO 2 — EVENT AGGREGATION

### 2.1 Hooks su writer esistenti (writer side)
| Writer | Quando emette | event_type_code |
|---|---|---|
| `studio_activation.activate_studio_ecosystem` | activate | `activated`, `magic_link_issued` |
| `auth.magic_link_consume` | post-consume | `magic_link_consumed` |
| `auth.set_password` | post-set | `password_set` |
| `routers/admin_studio.update_*` | status change | `status_changed` |
| `services/tenant_contacts.create_contact` | already emits | `contact_added` |
| `services/tenant_contacts.archive_contact` | already emits | `contact_archived` |
| `services/relationship_activities.create_quick_activity` | inserts activity row (no event needed) | — |
| Middleware `BlueprintApp` mount (first time per user/tenant) | first access | `blueprint_first_access` |

Tutti i writer chiamano **al termine** `relationship_health.apply_signal(...)`
prima del commit.

### 2.2 Idempotency
Eventi append-only. `magic_link_consumed` può comparire una volta sola
(token one-shot). `blueprint_first_access` ha guard via cookie/session:
solo se `events.first_blueprint_access_at IS NULL` su `studio_relations`.

### 2.3 Email aggregation (D5 filtered)
La view già filtra solo 7 template ad alto valore. Nessuna ulteriore
aggregazione applicativa è necessaria in M2.

---

## 3 · MODULO 3 — TIMELINE FILTERS

### 3.1 Filter API surface
| Filtro | Param | Comportamento |
|---|---|---|
| Sorgente | `source=event,email,activity` | UNION ALL filtered |
| Tipo evento | `type_code=magic_link_consumed,activated,...` | WHERE type_code IN |
| Solo manuali | `manual_only=1` | category='manual' OR source='activity' |
| Da data | `since=2026-01-01` | at >= since |
| Fino data | `until=2026-12-31` | at <= until |
| Owner | `owner=<user_id>` | owner_user_id = user_id |
| Contatto | `contact_id=<uuid>` | filtra activity.contact_id; events join via payload |

### 3.2 Catalog endpoint per i chip filter
Nuovo helper: `GET /api/admin/timeline/filter-options?tid=...` ritorna
solo i type_code che hanno almeno una occorrenza per quel tenant. Evita
chip vuoti nella UI.

---

## 4 · MODULO 4 — FOUNDER TIMELINE MIRROR (D4)

### 4.1 Surface
- Admin: `GET /api/admin/tenants/{tid}/timeline`
- Founder: `GET /api/blueprint/timeline` (scope-locked su own tenant)

### 4.2 D4 enforcement
Founder NON vede:
- Email dei super-admin (es. `admin_new_studio_request`) — filtrate via catalog
- Internal_note dei super-admin (se mai si arriverà a multi-tenant viewer)

Soluzione: il catalog `platform_relationship_event_types` avrà una
colonna addizionale **`visibility`** in seed:
```sql
ALTER TABLE platform_relationship_event_types
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'all';
  -- 'all' | 'admin_only'
ALTER TABLE platform_activity_types
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'all';
```
La view `v_relationship_timeline` diventa scope-aware via parametro nel service.

Founder mirror: ricostruisce la query escludendo `visibility='admin_only'`
e i 2 template email admin-only (`admin_new_studio_request`).

### 4.3 UI placeholder M2 → tab live
Le tab placeholder `<TimelineFeed>` in `TenantDetail` (admin) e
`BlueprintOverview` (founder) vengono **sostituite** dal componente reale.

### 4.4 Componente UI
- `<TimelineFeed tenantId scope='admin'|'founder'>` con:
  - Lista cronologica DESC, gruppi per giorno
  - Filter chips (sourceTypeIcon · type_code label · count)
  - "Carica altri" via cursor
  - Icone Lucide dal catalog (`icon` field)

---

## 5 · MODULO 5 — RELATIONSHIP HEALTH HOOKS

### 5.1 Writer integration
Tutti i writer M0/M1 che già emettono eventi/attività chiamano
`relationship_health.apply_signal(...)` come ultimo step prima del commit
nella stessa transazione.

### 5.2 Garantisce
- `tenant_contacts.relationship_score` ≥ 0 dopo ogni operazione
- `tenant_contacts.last_touch_at` aggiornato solo se `touch=TRUE`
- `tenants.relationship_score` e `tenants.last_touch_at` agganciati allo stesso evento (anche se nessun `contact_id` è coinvolto)

### 5.3 Connection pooling pre-fix (cross-cutting)
Approfittiamo di M2 per chiudere il **performance gap** segnalato in M1:
- Configurare `pool_size=10, max_overflow=20, pool_recycle=300` su `AsyncSessionLocal`
- Validare con statement caching che le query attuali (~1.7s) scendano sotto 300ms

Effort delta: +0.3g · Beneficio: tutta la piattaforma diventa <300ms
prima di M3.

---

## 6 · MODULO 6 — SECURITY VALIDATION (script M2)

`backend/scripts/validate_m2_security.py` — 14 check pianificati:

1. Founder JWT → `/blueprint/timeline` own → 200
2. Founder JWT → `/admin/tenants/{other}/timeline` → 403
3. Founder timeline NOT include `admin_new_studio_request` email
4. Founder timeline NOT include `visibility='admin_only'` events
5. Anon → `/admin/tenants/{tid}/timeline` → 401
6. Cursor pagination consistent (same record never appears twice across pages)
7. Filter by `type_code` returns only matching
8. Filter by `since` boundary correct
9. `since`/`until` reject malformed dates → 422
10. `apply_signal` increments `tenant_contacts.relationship_score`
11. `apply_signal` updates `last_touch_at` only when `touch=TRUE`
12. Concurrent writers don't double-apply (idempotency on event UUID)
13. Archive contact decreases score (negative delta)
14. Tenant relationship_score never negative

---

## 7 · MODULO 7 — PERFORMANCE VALIDATION

### 7.1 Budget M2
| Endpoint | Budget | Mitigazione |
|---|---|---|
| `GET /timeline?limit=30` | <300ms p95 | Cursor + indexed view |
| `GET /timeline?type_code=...` | <300ms p95 | Filtered union pruned by catalog join |
| `GET /timeline/filter-options` | <150ms | Cached 60s |
| `apply_signal` overhead | <30ms | Single UPDATE per row, single tx |

### 7.2 Test plan
- 10 round per endpoint con `EXPLAIN ANALYZE`
- Volume target test: seed sintetico 5k eventi + 2k attività + 1k email su 50 tenant
- Cursor stability: pagina 1→10 mai duplicati

### 7.3 Connection pool warm-up
Post-deploy, primo hit endpoint = baseline. Da 2° hit in poi va sotto budget.

---

## 8 · API SURFACE M2 (totale 5 nuovi)

| Verb | Path | Scope |
|---|---|---|
| GET | `/api/admin/tenants/{tid}/timeline` | advisor/admin |
| GET | `/api/admin/tenants/{tid}/timeline/filter-options` | advisor/admin |
| GET | `/api/blueprint/timeline` | founder |
| GET | `/api/blueprint/timeline/filter-options` | founder |
| GET | `/api/catalogs/event-types-with-stats?tid=...` | helper UI |

---

## 9 · DB MIGRATION 033 (parte di M2)

```sql
-- 033_relationship_timeline_and_health.sql
BEGIN;

-- Health on tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch_at      TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tenants_relationship_score
  ON tenants(relationship_score DESC) WHERE relationship_score > 0;

-- Health hooks data on catalogs
ALTER TABLE platform_relationship_event_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'all';
ALTER TABLE platform_activity_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'all';

-- View update with visibility-aware filter (admin variant unchanged, founder
-- variant lives in the service since it takes a scope arg).

COMMIT;
```

Seed script `seed_relationship_health_signals.py` riapplica i valori della §0.5
in idempotency.

---

## 10 · EFFORT M2 AGGIORNATO

| Componente | Eff. (g) | Note |
|---|---|---|
| Migration 033 + seed signals | 0.4 | DDL minimal + idempotent seed |
| `services/relationship_health.py` (apply_signal) | 0.4 | Single function, table-driven |
| Writer hook integration (8 punti) | 0.6 | Tocco minimo sui writer esistenti |
| `services/timeline.py` + cursor | 0.5 | + EXPLAIN tuning |
| Routers admin + founder timeline | 0.4 | Mirror D4 |
| Connection pool fix (M1 perf debt) | 0.3 | AsyncSessionLocal config |
| Frontend `<TimelineFeed>` | 1.0 | Lista + filtri chip + load more |
| Frontend filter pills + day-grouping | 0.3 | Component |
| Security script (14 check) | 0.3 | |
| Performance script | 0.2 | EXPLAIN + cursor stability |
| QA / smoke | 0.3 | |
| **Totale** | **4.7d** | (vs roadmap v1: 3.5d — +1.2g per health hooks + perf fix) |

In parallelo backend+frontend: ~2.5d calendario.

---

## 11 · DIPENDENZE & RISCHI

### Dipendenze
- ✅ M0 fornisce: view, indici, catalog
- ✅ M1 fornisce: `tenant_contacts`, `relationship_activities`, founder mirror pattern
- 🔴 Migration 033 obbligatoria PRIMA del codice timeline

### Rischi
| Rischio | Sev | Mitigazione |
|---|---|---|
| Score over/under-flow | 🟡 P1 | Cap `GREATEST(0, ...)` sul tenant; per-contact può andare negativo (signal valido) |
| Cursor instabile su INSERT concorrenti | 🟡 P1 | Cursor su `(at, id)` con tie-break id |
| Founder vede admin-only email | 🔴 P0 | Test 3+4 in security script blocking |
| Performance pool fix introduce regressioni | 🟡 P1 | Smoke audit `first_real_tenant_audit.py` post-fix |
| Backfill scoring storico → user expectation | 🟢 | Documentato §0.7: no backfill, forward-only |

---

## 12 · ACCEPTANCE GLOBALE M2

Test E2E: estensione di `validate_m1_security.py` con scenario timeline:
1. Genera tenant fresco
2. Esegue full pipeline (submit → activate → magic-link consume → blueprint access)
3. Crea 2 contatti + 3 quick activities (call/email/whatsapp)
4. Admin `GET /timeline` → verifica almeno 8 voci con type_code corretti
5. Founder `GET /timeline` → verifica stesso conteggio MENO admin-only
6. Verifica `tenant_contacts.relationship_score > 0` per il contatto coinvolto
7. Verifica `tenants.last_touch_at` aggiornato
8. Performance: ogni call < 300ms p95

---

## 13 · COSA È ESPLICITAMENTE FUORI SCOPE M2

- ❌ Notification Center → M4
- ❌ Advisor KPI dashboard → M5
- ❌ Analytics → fuori roadmap
- ❌ AI / scoring ML → fuori roadmap
- ❌ Scoring UI / visibility dei punteggi → fuori roadmap
- ❌ Backfill scoring storico
- ❌ Time-decay sul score
- ❌ Email open/click events nel timeline (sempre esclusi D5)

---

## 14 · VERDETTO

🟢 **`READY_FOR_M2_IMPLEMENTATION`**

- Schema delta minimale e idempotente (migration 033)
- Relationship Health Foundation predisposta come **data-only**
  (catalog-driven signal config, nessuna logica cablata)
- Performance gap M1 chiuso nello stesso milestone (+0.3g)
- Founder mirror D4 esteso con `visibility` catalog flag (preserva isolation)
- 14 security check pianificati
- Effort onesto ~4.7d (vs 3.5d v1) per scope esteso

**Pronto per l'esecuzione M2 allo "Vai" dell'utente.**

---

*Generato il 2 Giu 2026 da E1 (Emergent), su istruzione utente
"M2 RELATIONSHIP TIMELINE — EXECUTION PLAN".*
*Nessuna migration eseguita. Nessuna feature implementata. Solo piano definitivo.*
