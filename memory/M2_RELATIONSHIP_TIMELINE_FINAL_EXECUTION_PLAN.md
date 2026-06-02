# RELATIONSHIP OS™ — M2 RELATIONSHIP TIMELINE — **FINAL EXECUTION PLAN**

> Versione finale che recepisce le 4 decisioni utente del 2 Giu 2026.
> Sostituisce `M2_RELATIONSHIP_TIMELINE_IMPLEMENTATION_PLAN.md`.
> **STOP — nessuna implementazione prima del "VAI" finale dell'utente.**

**Classificazione finale**: 🟡 **`NEEDS_REWORK`** *(data gap)*

> La timeline tecnica è pronta a essere costruita, ma il tenant pilota
> **Martinel Interior Design** non ha ancora i dati CRM minimi per
> rendere il rilascio M2 osservabile end-to-end. Vedi §1 Data Validation.

---

## 1 · DATA VALIDATION — RISULTATO ESECUZIONE

Script: `backend/scripts/validate_m2_data_readiness.py` (eseguito 2 Giu 2026)
Tenant: `Martinel Interior Design` (`slug=martinel-interior-design`, id `c64659f6-5a76-41dd-8d8d-b901d29862af`)

| Check | Soglia | Reale | Esito |
|---|---:|---:|:--:|
| Tenant esiste | — | ✅ | PASS |
| Relationship owner assegnato | NOT NULL | NULL | **FAIL** |
| Contatti attivi | ≥ 3 | 0 | **FAIL** |
| Attività manuali | ≥ 5 | 0 | **FAIL** |
| Timeline rows (view) | ≥ 5 | 7 | PASS |
| Diversità type_code | ≥ 3 | 7 | PASS |

**Eventi automatici già presenti in `v_relationship_timeline`** (timeline tecnica funzionante):
- `studio_request_received`, `studio_request_review`, `studio_request_qualified`, `studio_request_approved` (catena lifecycle)
- `relation_opened`, `activated`
- `admin_new_studio_request` (email source)

**Gap**: la sezione "**manual_only**" della timeline (attività CRM) è vuota → uno dei filtri principali della UI non avrebbe nulla da mostrare in M2 acceptance.

### 1.1 Azione di sblocco — **PHASE M2-0: DATA SEED** (obbligatoria, ~0.3g)

Script da creare: `backend/scripts/seed_martinel_real_crm.py` (idempotente).

Contenuto minimo:
- Assegnare `tenant_relationship_owner_user_id` di Martinel all'admin `admin@moodfordesign.com` (o user designato dall'utente)
- Creare **3 contatti reali** (dati anagrafici Martinel) coerenti con i 3 ruoli previsti dal catalog `platform_contact_roles`:
  - `founder` (titolare studio)
  - `architect` (architetto referente)
  - `purchasing` (responsabile acquisti)
- Inserire **5 attività reali** in `relationship_activities` distribuite negli ultimi 30 giorni:
  - 1× `call` (qualifica iniziale, owner=admin)
  - 1× `meeting` (presentazione piattaforma)
  - 1× `email` (follow-up post-meeting)
  - 1× `visit` (visita showroom)
  - 1× `internal_note` (nota interna admin)
- Ogni inserimento triggera lo stesso writer service M1 (`create_quick_activity`) — **niente seed diretto in DB**, così la pipeline `apply_signal` (M2) verrà esercitata realisticamente

L'utente fornirà:
- ✅ Conferma dell'identità dell'owner da assegnare (default: `admin@moodfordesign.com`)
- ✅ Eventuali nomi reali dei contatti Martinel (altrimenti placeholder coerenti)

Solo dopo il PASS del re-run `validate_m2_data_readiness.py`, lo stato passa a 🟢 **`READY_FOR_M2_IMPLEMENTATION`**.

---

## 2 · DECISIONI UTENTE RECEPITE

### Decisione 1 · Relationship Health Foundation (CONFERMATA, scope ristretto)

**Permesso**:
- Tabelle: `tenant_contacts.relationship_score`, `tenant_contacts.last_touch_at`, `tenants.relationship_score`, `tenants.last_touch_at`
- Catalog driver: colonne `score_delta INTEGER DEFAULT 0` e `touch BOOLEAN DEFAULT FALSE` su `platform_relationship_event_types` e `platform_activity_types`
- Logica: **un solo step** → evento/attività → lookup `score_delta` dal catalog → UPDATE incrementale → eventuale set `last_touch_at = NOW()` se `touch=TRUE`

**Vietato in M2** (e oltre, fino a nuovo ordine):
- ❌ Health bands (`hot/warm/cold` ecc.)
- ❌ Time decay / recompute periodico
- ❌ AI scoring / modelli ML
- ❌ KPI / aggregati derivati dal punteggio
- ❌ Dashboard / widget di visualizzazione dello score
- ❌ Endpoint che espongono `relationship_score` al client (rimane data-only nel DB)

I valori si accumulano forward-only (no backfill storico). Le formule sono **dati di configurazione**, non logica cablata.

### Decisione 2 · Connection Pooling FUORI SCOPE M2

Rimosso completamente dal piano. Tracciato come task separato:

📋 **Task M1.1 — Performance Hardening** *(da pianificare separatamente)*
- Configurazione `pool_size`, `max_overflow`, `pool_recycle` su `AsyncSessionLocal`
- Statement caching audit
- Latency target ricalibrato dopo misure reali
- Report indipendente: `/app/memory/M1_1_PERFORMANCE_HARDENING_PLAN.md` (da generare quando richiesto)

In M2 i budget di performance rimangono **best-effort**, non bloccanti (no SLA gating).

### Decisione 3 · Notification Center — predisposizione architetturale (data-only)

**Solo schema**, nessun consumer:

```sql
ALTER TABLE platform_relationship_event_types
  ADD COLUMN IF NOT EXISTS notifiable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE platform_activity_types
  ADD COLUMN IF NOT EXISTS notifiable BOOLEAN NOT NULL DEFAULT FALSE;
```

Seed indicativo (proposta, riconfigurabile in M4):
- `notifiable=TRUE`: `activated`, `magic_link_consumed`, `blueprint_first_access`, `qualification_done`, `presentation_delivered`, `visit_recorded` (eventi); `meeting`, `visit` (attività)
- `notifiable=FALSE`: tutto il resto

**Vincoli M2**:
- ❌ Nessun servizio di delivery in M2
- ❌ Nessun endpoint che legge `notifiable`
- ❌ Nessuna UI di Notification Center
- ✅ Solo schema + seed valori → M4 (Notification Center) troverà il dato già coerente

### Decisione 4 · Data Validation pre-codice (ESEGUITA)

Vedi §1. Esito **NEEDS_REWORK** → richiede PHASE M2-0 (data seed) prima di scrivere codice M2.

---

## 3 · ARCHITETTURA M2 RIFINITA

### 3.1 Migration `033_relationship_timeline_and_health.sql`

```sql
-- 033_relationship_timeline_and_health.sql
BEGIN;

-- 1) Health hooks (data-only) sui tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_relationship_score
  ON tenants(relationship_score DESC) WHERE relationship_score > 0;

-- 2) Catalog driver: score + touch + visibility + notifiable
ALTER TABLE platform_relationship_event_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'all'
    CHECK (visibility IN ('all','admin_only')),
  ADD COLUMN IF NOT EXISTS notifiable  BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE platform_activity_types
  ADD COLUMN IF NOT EXISTS score_delta INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS touch       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS visibility  TEXT NOT NULL DEFAULT 'all'
    CHECK (visibility IN ('all','admin_only')),
  ADD COLUMN IF NOT EXISTS notifiable  BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
```

Rollback simmetrico in `033_relationship_timeline_and_health.rollback.sql`.

### 3.2 Seed di configurazione

Script: `backend/scripts/seed_relationship_health_signals.py` (idempotente, UPSERT).

Valori event types (subset rilevante):

| code | score_delta | touch | visibility | notifiable |
|---|---:|:--:|:--:|:--:|
| `relation_opened` | +5 | T | all | F |
| `activated` | +20 | T | all | **T** |
| `magic_link_issued` | 0 | F | all | F |
| `magic_link_consumed` | +15 | T | all | **T** |
| `blueprint_first_access` | +10 | T | all | **T** |
| `password_set` | +1 | F | all | F |
| `password_reset_requested` | 0 | F | all | F |
| `contact_added` | +2 | F | all | F |
| `contact_archived` | -2 | F | all | F |
| `status_changed` | +3 | T | all | F |
| `temperature_changed` | 0 | F | all | F |
| `qualification_done` | +10 | T | all | **T** |
| `presentation_delivered` | +12 | T | all | **T** |
| `ecosystem_aligned` | +15 | T | all | F |
| `visit_recorded` | +8 | T | all | **T** |
| `admin_new_studio_request` (email) | 0 | F | **admin_only** | F |
| `studio_request_*` (email founder) | +2 | T | all | F |
| `archived` | -50 | F | all | F |

Valori activity types:

| code | score_delta | touch | visibility | notifiable |
|---|---:|:--:|:--:|:--:|
| `call` | +5 | T | all | F |
| `meeting` | +8 | T | all | **T** |
| `visit` | +10 | T | all | **T** |
| `email` | +2 | T | all | F |
| `whatsapp` | +2 | T | all | F |
| `linkedin` | +1 | T | all | F |
| `internal_note` | 0 | F | all | F |
| `task` | 0 | F | all | F |

### 3.3 Service `services/relationship_health.py` (NEW)

```python
# Singolo entry point — usato da tutti i writer M0/M1
async def apply_signal(
    s: AsyncSession,
    *,
    tenant_id: UUID,
    contact_id: UUID | None,
    source: Literal["event", "activity"],
    type_code: str,
) -> None:
    """
    1. Legge (score_delta, touch) dal catalog corrispondente.
    2. Se contact_id: UPDATE tenant_contacts SET relationship_score = relationship_score + delta,
                                          last_touch_at = NOW() (se touch).
    3. UPDATE tenants SET relationship_score = relationship_score + delta,
                          last_touch_at = NOW() (se touch).
    4. NO read-back, NO emit altro evento, NO logging applicativo.
    Idempotency: garantita dai writer (eventi/attività append-only con UUID).
    """
```

Vincoli implementativi:
- Singola transazione condivisa con il writer chiamante (stesso `s`)
- Nessun catch-and-swallow: errori re-raise → rollback del writer
- Floor a 0 **solo sui tenants** (la voce per-contact può scendere negativa, è un signal valido)

### 3.4 Service `services/timeline.py` (NEW)

```python
async def list_timeline(
    s: AsyncSession, *,
    tenant_id: UUID,
    scope: Literal["admin", "founder"],   # determina applicazione visibility filter
    sources: list[str] | None = None,     # subset di {'event','email','activity'}
    type_codes: list[str] | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    owner_user_id: UUID | None = None,
    contact_id: UUID | None = None,
    manual_only: bool = False,
    cursor: str | None = None,            # base64({"at": ISO, "id": UUID})
    limit: int = 30,
) -> TimelineResponse: ...
```

Sorgente: `v_relationship_timeline` (M0) JOIN sui catalog (label_it/label_en, icon, color).
Founder scope: WHERE `coalesce(et.visibility, at.visibility, 'all') <> 'admin_only'`.
Ordering: `at DESC, id DESC` (tie-break stabile per cursor).

### 3.5 Writer hook points (8)

| Writer | type_code emesso (già esistente in M0/M1) | Nuovo: chiamata `apply_signal` |
|---|---|:--:|
| `services/studio_activation.activate_studio_ecosystem` | `activated`, `magic_link_issued`, `relation_opened` | ✅ |
| `services/auth.magic_link_consume` | `magic_link_consumed` | ✅ |
| `services/auth.set_password` | `password_set` | ✅ |
| `routers/admin_studio.update_*` | `status_changed`, `temperature_changed` | ✅ |
| `services/tenant_contacts.create_contact` | `contact_added` | ✅ |
| `services/tenant_contacts.archive_contact` | `contact_archived` | ✅ |
| `services/relationship_activities.create_quick_activity` | n/a (la riga *è* la sorgente) | ✅ (source='activity') |
| Middleware `BlueprintApp` first-mount guard | `blueprint_first_access` | ✅ |

### 3.6 API surface M2 (5 endpoint)

| Verb | Path | Scope |
|---|---|---|
| GET | `/api/admin/tenants/{tid}/timeline` | advisor/admin |
| GET | `/api/admin/tenants/{tid}/timeline/filter-options` | advisor/admin |
| GET | `/api/blueprint/timeline` | founder (own tenant) |
| GET | `/api/blueprint/timeline/filter-options` | founder (own tenant) |
| GET | `/api/catalogs/timeline-types` | helper UI (label/icon/color) |

**Nessun endpoint** espone `relationship_score` o `last_touch_at` al client (Decisione 1).

### 3.7 Frontend `<TimelineFeed>`

Componente unico, riutilizzato in due context:
- `TenantDetail.jsx` (admin) → tab "Timeline" (sostituisce placeholder M1)
- `BlueprintOverview.jsx` (founder) → tab "Timeline" (sostituisce placeholder M1)

Feature:
- Lista DESC con day-grouping (`format(at, 'eeee d MMMM yyyy', { locale: it })`)
- Filter chips: source, type_code (popolato da `filter-options`), manual_only toggle
- Date range picker (since/until)
- "Carica altri" via cursor (lazy)
- Icone Lucide dinamiche dal catalog
- Stati: loading skeleton, empty state, error retry
- Tutti i `data-testid` obbligatori per testing agent

### 3.8 Security validation script

`backend/scripts/validate_m2_security.py` — 14 check:

1. Founder JWT → `/blueprint/timeline` own → 200
2. Founder JWT → `/admin/tenants/{other}/timeline` → 403
3. Founder timeline NON include `admin_new_studio_request`
4. Founder timeline NON include qualunque `visibility='admin_only'`
5. Anon → `/admin/tenants/{tid}/timeline` → 401
6. Cursor pagination consistente (zero duplicati su pag 1→N)
7. Filter `type_code` filtra correttamente
8. Filter `since`/`until` rispetta i confini
9. Malformed date → 422
10. `apply_signal` incrementa `tenant_contacts.relationship_score` (delta corretto)
11. `apply_signal` aggiorna `last_touch_at` **solo se** `touch=TRUE`
12. `apply_signal` aggiorna anche `tenants.relationship_score` / `last_touch_at`
13. Archive contact applica delta negativo
14. `tenants.relationship_score` mai negativo (floor 0)

---

## 4 · NON OBIETTIVI M2 (riepilogo deciso)

- ❌ Connection pool / performance hardening → **Task M1.1 separato**
- ❌ Notification Center delivery / consumer / UI → **M4**
- ❌ Health bands, decay, AI scoring, KPI, dashboard → **fuori roadmap**
- ❌ Endpoint che leggono `relationship_score` → **mai (data-only)**
- ❌ Email open/click events → sempre out (D5)
- ❌ Backfill scoring storico → no (forward-only)
- ❌ Advisor Workspace → **M5**
- ❌ Analytics / AI / Launch Pack → **fuori scope intero roadmap CRM**

---

## 5 · EFFORT M2 RIVISTO

| Componente | Effort (g) |
|---|---:|
| **PHASE M2-0** Data seed Martinel + re-run validation | 0.3 |
| Migration 033 + rollback | 0.2 |
| Seed signals (idempotent) | 0.2 |
| `services/relationship_health.py` | 0.3 |
| Writer hook integration (8 punti) | 0.6 |
| `services/timeline.py` + cursor | 0.5 |
| Routers admin + founder timeline | 0.4 |
| Frontend `<TimelineFeed>` componente | 1.0 |
| Frontend filter chips + day grouping | 0.3 |
| Security script (14 check) | 0.3 |
| QA / smoke E2E | 0.3 |
| **Totale** | **4.4d** |

Pool fix non più nello scope (era +0.3g): tornati al budget originale ~4.4d.
Calendario in parallelo BE+FE: ~2.5d.

---

## 6 · ACCEPTANCE GLOBALE M2

Test E2E post-implementazione (estende `validate_m1_security.py`):

1. **PHASE M2-0** completata → Martinel ha owner + 3 contatti + 5 attività
2. Migration 033 applicata, rollback verificata in staging
3. Seed signals applicato (idempotent — re-run no-op)
4. Admin `GET /tenants/martinel/timeline` → ≥ 12 voci (7 esistenti + 5 attività nuove)
5. Founder `GET /blueprint/timeline` → stesso conteggio **MENO** `admin_new_studio_request`
6. Filter chips funzionano (manual_only mostra solo le 5 attività)
7. Cursor pagina 1→N senza duplicati
8. `tenant_contacts.relationship_score > 0` su almeno 2 contatti (toccati dalle attività)
9. `tenants.relationship_score > 0`, `tenants.last_touch_at` aggiornato
10. 14/14 check security PASS
11. UI testid completi, day grouping renderizzato in italiano
12. Nessuna regressione su `first_real_tenant_audit.py`

---

## 7 · DIPENDENZE & RISCHI

### Dipendenze
- ✅ M0 view + indici disponibili
- ✅ M1 contatti + attività infrastruttura disponibile
- 🟡 **PHASE M2-0 obbligatoria** prima di qualunque scrittura di codice M2
- 🟢 Migration 033 obbligatoria prima del codice service/router

### Rischi
| Rischio | Severità | Mitigazione |
|---|:--:|---|
| Seed M2-0 introduce dati inconsistenti | 🟡 | Idempotency + dry-run pre-commit |
| Founder vede event admin-only | 🔴 P0 | Check 3+4 blocking nel security script |
| Cursor instabile su INSERT concorrenti | 🟡 | Tie-break `id` |
| `apply_signal` overhead degrada writer | 🟢 | Singolo UPDATE indicizzato, no read-back |
| Punteggio per-contact diventa negativo | 🟢 | Documentato §3.3 — signal valido |

---

## 8 · COSA SERVE DALL'UTENTE PER PROCEDERE

Per chiudere PHASE M2-0 e passare lo stato a 🟢 `READY_FOR_M2_IMPLEMENTATION`:

1. **Identità owner Martinel**
   - Default proposto: `admin@moodfordesign.com`
   - Alternativa: indicare email user da assegnare
2. **Anagrafica contatti Martinel** (opzionale)
   - Se disponibili nomi reali (founder, architetto, acquisti) → li usiamo
   - Altrimenti: placeholder coerenti con i ruoli
3. **Conferma**: procedere con PHASE M2-0 seed → re-run validation → implementazione M2

---

## 9 · VERDETTO

🟡 **`NEEDS_REWORK`** *(data gap, non architetturale)*

L'architettura del piano è completa, le 4 decisioni utente sono recepite,
la migration 033 è progettata, gli hook points sono identificati,
la sicurezza è dimensionata. **L'unico blocker è il vuoto dati su Martinel**
che impedirebbe un'acceptance E2E significativa.

PHASE M2-0 (~0.3g) chiude il gap e abilita 🟢 `READY_FOR_M2_IMPLEMENTATION`.

**STOP. Nessun codice M2 verrà scritto finché l'utente non conferma:**
- (a) di voler procedere con PHASE M2-0
- (b) l'owner Martinel da assegnare

---

*Generato il 2 Giu 2026 da E1 (Emergent).*
*Sostituisce M2_RELATIONSHIP_TIMELINE_IMPLEMENTATION_PLAN.md.*
*Nessuna migration eseguita. Nessuna feature implementata. Solo data validation eseguita su Martinel.*
