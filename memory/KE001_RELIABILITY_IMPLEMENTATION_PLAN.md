# Sprint KE-001 · Knowledge Engine Production Reliability™

> **Status**: 📋 Implementation plan · **no code change applied**
> **Scope**: backend infrastructure only — **NO UI work**
> **Companion docs**: `RIVA1920_EXTRACTION_DIAGNOSTIC.md`, `KNOWLEDGE_ENGINE_CONTROL_ROOM_PROPOSAL.md`
> **Author**: technical planning · 04 Jun 2026
> **Estimated total effort**: **5–6 working days** (1 sprint)

---

## 0. Executive summary

Il caso RIVA1920 ha dimostrato che il Knowledge Engine **può perdere lo stato di estrazione senza recovery**. Il sintomo (un Catalog Set bloccato a 11.2% per 16h) è il riflesso di tre lacune infrastrutturali sovrapposte:

1. **Path di trigger eterogenei**: `POST /catalog-sets/{id}/extract` usa `BackgroundTasks` FastAPI in-process (legacy), invece del job runner persistente `ITER197` che è già implementato e funzionante a metà piattaforma.
2. **Stati orfani**: il finalizer del legacy non viene eseguito su crash del processo, quindi `brand_catalog_sets.status` resta `extracting` per sempre.
3. **Eventi non persistiti**: la pipeline emette `log_step` e `vision_progress_cb` ma solo verso il DB di documenti, non come stream eventi consumabili da Control Room / Notification Center / Audit.

KE-001 chiude tutte e tre le lacune **senza toccare la UI**. Lo sprint produce:
- Una migration additiva (`130`).
- Un solo path di trigger (`extract` → `ITER197 enqueue_job`).
- Recovery automatico **idempotente** su startup + cron interno.
- Tabella `extraction_event_log` con eventi minimi standardizzati, già consumabili dagli sprint KE-002+.
- Document-level retry indipendente già esistente, esteso con `OPEN/REVIEW` come operazioni non-disruttive.

---

## 1. Architettura target (lifecycle)

```
                  ┌────────────────────────────────────────────────────┐
                  │            extraction_jobs lifecycle               │
                  └────────────────────────────────────────────────────┘

  POST /extract ─► enqueue_job() ─► [QUEUED] ──► _spawn_job() ──► [RUNNING]
                                                                     │
                                  ┌──────────────────────────────────┤
                                  │ pause_requested ──► [PAUSED]     │ heartbeat fresh
                                  │ cancel_requested ─► [CANCELLED]  │
                                  │ crash silenzioso ─► [STALLED]    │ (deduzione)
                                  │ exception in body ─► [FAILED]    │ recoverable
                                  └──────────────────────────────────┘
                                                                     │
                                                                     ▼
                                                   docs loop OK   [COMPLETED]
                                                                     │
                                                                     ▼
                              brand_catalog_sets.status = needs_review

      Recovery thread (every 60s):
         WHERE status='running' AND heartbeat_age > 120s  →  STALLED
         WHERE status='stalled' AND retry_count < 3       →  re-queue + spawn
         WHERE status='stalled' AND retry_count ≥ 3       →  failed + emit alert

      Document lifecycle (independent):
         pending ─► extracting ─► review ─► validated
                                  ↓
                                failed ─► (retry endpoint) ─► pending
```

### 1.1 Stati `extraction_jobs.status`

| Stato | Significato | Recovery? | Triggered by |
|---|---|---|---|
| `queued` | inserted, non ancora spawned | sì (spawn) | `enqueue_job` |
| `running` | task asyncio attivo, heartbeat fresca | n/a | `_execute_job_sync` |
| `paused` | utente ha richiesto pausa, task terminato | sì (`resume_job`) | `request_pause` |
| `stalled` | RUNNING ma heartbeat ≥ 120s | sì (`recover_orphan_jobs`) | recovery scanner (NEW) |
| `failed` | exception nel body OR > 3 retry | manuale (`resume_job`) | runner exception handler |
| `cancelled` | utente ha cancellato | no | `cancel_job` |
| `completed` | tutti i doc completati o saltati | terminale | finalizer |

> ⚠️ **NUOVO stato `stalled`**: oggi il sistema non lo materializza, fa solo `running → queued` direttamente nel recovery hook. Lo introduciamo come fase intermedia esplicita affinché il Control Room possa rappresentarlo.

### 1.2 Stati `brand_catalog_sets.status` (invariati)

```
draft ─► extracting ─► needs_review ─► published
                    └─► failed (terminal, recoverable via new extraction)
```

Il fix garantisce che ogni transizione `extracting → *` sia **sempre** invocata dal job runner anche in caso di crash (vedi §2.4).

---

## 2. Fasi (5)

### Fase 1 · ITER197 full wiring

**Obiettivo**: eliminare il path legacy `BackgroundTasks → _run_set_extraction`. Tutti i trigger di estrazione devono passare per `extraction_job_runner`.

**Punti critici nel codice**:

| File | Modifica |
|---|---|
| `/app/backend/routers/brand_catalog_sets.py:817-832` `POST /catalog-sets/{id}/extract` | Sostituire `background_tasks.add_task(_run_set_extraction, ...)` con `runner.enqueue_job(tenant_id, catalog_set_id, brand_id, config={"max_candidates_per_doc": …, "rebuild_index": …})`. |
| `/app/backend/routers/brand_catalog_sets.py:596` `_run_set_extraction` | **Non eliminare**. Rinominare `_run_set_extraction_DEPRECATED` e mantenerlo solo come reference. Il job runner ha già la propria copia inline del loop (`_execute_job_sync`, lines 246-440). |
| `/app/backend/services/extraction_job_runner.py:160` `recover_orphan_jobs` | Estendere: introdurre lo stato intermedio `stalled` (vedi §2.2). |
| `/app/backend/routers/extraction_jobs.py:153` `retry_document` | Già coerente. Lascia invariato (usa `runner.enqueue_job`). |
| `/app/backend/server.py` | Verificare che `recover_orphan_jobs()` sia invocato in lifespan startup (già presente). Aggiungere lo scheduler periodico (vedi §2.2). |

**Deliverable**: ogni `POST /extract` crea **sempre** una `extraction_jobs` row. Test: `psql -c "SELECT COUNT(*) FROM extraction_jobs WHERE created_at > now()-interval '1 day'"` deve essere `≥` numero di trigger eseguiti.

---

### Fase 2 · Orphan Job Recovery

**Obiettivo**: nessun catalogo resta `extracting` all'infinito.

**Cambiamenti precisi**:

1. **Schema (migration 130)**: aggiungere stato `stalled` come valore valido di `extraction_jobs.status`. Lo schema attuale ha un CHECK constraint — va esteso senza rompere row esistenti.

```sql
-- migrate-up
ALTER TABLE extraction_jobs DROP CONSTRAINT IF EXISTS extraction_jobs_status_chk;
ALTER TABLE extraction_jobs ADD CONSTRAINT extraction_jobs_status_chk
  CHECK (status IN ('queued','running','paused','stalled',
                     'failed','cancelled','completed'));
ALTER TABLE extraction_jobs
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stalled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_id   TEXT;
CREATE INDEX IF NOT EXISTS idx_ej_status_heartbeat
  ON extraction_jobs (status, heartbeat_at) WHERE status IN ('running','stalled');
```

2. **Runner**: a ogni `_persist_current()` settare anche `last_seen_at = now()`, `worker_id = f"{hostname}:{pid}"`. Ogni heartbeat porta entrambi i campi.

3. **Recovery scanner** (`extraction_job_runner.recover_orphan_jobs`):
   - Fase A — **demote**: `UPDATE extraction_jobs SET status='stalled', stalled_at=now() WHERE status='running' AND heartbeat_at < now() - interval '120 seconds'`.
   - Fase B — **re-queue**: per ogni `status='stalled' AND retry_count < MAX_RETRY_COUNT(=3)` → set `status='queued'`, `retry_count = retry_count + 1`, `error_message='auto-recovered from stalled'`, poi `_spawn_job(id)`.
   - Fase C — **terminate**: `status='stalled' AND retry_count ≥ 3` → set `status='failed'`, `error_message='exceeded max retries'`, e **anche** transiziona `brand_catalog_sets.status` corrispondente a `needs_review` (o `failed` se nessun documento è in review/validated).

4. **Scheduler**: in `server.py` lifespan, aggiungere un task asyncio che esegue `recover_orphan_jobs()` ogni **60s**, oltre alla chiamata già esistente in startup. APScheduler è già installato per le notifiche cron.

```python
# pseudo-code dentro lifespan startup
scheduler.add_job(extraction_job_runner.recover_orphan_jobs,
                  trigger="interval", seconds=60,
                  id="extraction_orphan_recovery",
                  max_instances=1, coalesce=True)
```

5. **Safety net su startup** (idempotente): scansionare anche i catalog sets:

```python
# Convergenza forzata: orphan catalog_sets senza job attivo
SELECT id FROM brand_catalog_sets
WHERE status='extracting'
  AND id NOT IN (SELECT catalog_set_id FROM extraction_jobs
                 WHERE status IN ('queued','running','paused','stalled'))
  AND updated_at < now() - interval '5 minutes';
-- For each → status='needs_review' if documents_extracted > 0 else 'draft'
```

**Deliverable**: `recover_orphan_jobs()` test scenario:
- inject `extraction_jobs` con `status='running'`, `heartbeat_at = now() - 3 min`
- chiamare `recover_orphan_jobs()` 2 volte
- prima call → status='stalled', `stalled_at` set
- seconda call → status='queued', `retry_count` incrementato, task spawn-ata

---

### Fase 3 · Extraction Event Log

**Obiettivo**: stream eventi persistente. Consumatore primario è il futuro Control Room, ma il log diventa anche audit trail.

**Schema (migration 130)**:

```sql
CREATE TABLE extraction_event_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id       UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  catalog_document_id  UUID,           -- nullable (job-level events)
  job_id               UUID,           -- nullable (out-of-band events)
  ts                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind                 TEXT NOT NULL,
  message              TEXT NOT NULL,
  entity_id            UUID,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT extraction_event_log_kind_chk CHECK (
    kind IN (
      'JOB_STARTED','JOB_COMPLETED','JOB_FAILED','JOB_STALLED','JOB_RECOVERED',
      'JOB_PAUSED','JOB_RESUMED','JOB_CANCELLED',
      'DOCUMENT_STARTED','DOCUMENT_FAILED','DOCUMENT_COMPLETED','DOCUMENT_RETRIED',
      'PAGE_PROCESSED',
      'STAGE_TRANSITION',
      'IMAGE_FOUND','PRODUCT_FOUND','DESIGNER_FOUND','MATERIAL_FOUND',
      'BRAND_ALIAS_FOUND','RELATION_FOUND',
      'WARNING_CREATED','ERROR'
    )
  )
);
CREATE INDEX idx_eel_set_ts  ON extraction_event_log (catalog_set_id, ts DESC);
CREATE INDEX idx_eel_job_ts  ON extraction_event_log (job_id, ts DESC) WHERE job_id IS NOT NULL;
CREATE INDEX idx_eel_kind    ON extraction_event_log (catalog_set_id, kind, ts DESC);
```

**Eventi emessi (mappa)**:

| Punto runner | Evento emesso |
|---|---|
| `_execute_job_sync` start | `JOB_STARTED` (payload: `{config}`) |
| `for d in docs` start iteration (non-skipped) | `DOCUMENT_STARTED` (payload: `{name, page_count}`) |
| `_make_job_stage_cb` su transizione | `STAGE_TRANSITION` (payload: `{stage, est_page}`) |
| `_make_job_vision_cb` ogni 5 immagini | `PAGE_PROCESSED` (payload: `{vision_current, vision_total}`) |
| `product_composer` callback "product_composed" | `PRODUCT_FOUND` (payload: `{entity_id, confidence}`) |
| `compose_products_from_pdf` su entity emit | `DESIGNER_FOUND`, `MATERIAL_FOUND`, `IMAGE_FOUND` (payload: `{entity_id, label, confidence}`) |
| doc finalize success | `DOCUMENT_COMPLETED` (payload: `{pages_written, products, designers, materials, images}`) |
| doc except block | `DOCUMENT_FAILED` (payload: `{error, traceback_hash}`) |
| `_terminal` con completed | `JOB_COMPLETED` |
| `_terminal` con failed | `JOB_FAILED` |
| recovery scanner Phase A | `JOB_STALLED` |
| recovery scanner Phase B | `JOB_RECOVERED` |
| recovery scanner Phase C | `JOB_FAILED` (with `payload.cause='max_retries'`) |

**Helper unico** (`extraction_job_runner.emit_event(c, kind, **kwargs)`) per non sporcare il loop principale. Batch insert opzionale (10 eventi o 250ms, qualunque arrivi prima).

**Volumetria attesa**: ~80 eventi per documento medio (90 pagine, 35 immagini Vision, 20 entità). Per RIVA1920 (1.623 pagine, 12 doc, ~80 entità) ≈ **2.000 eventi totali**. Trascurabile per PostgreSQL. TTL: keep 30 days, cron purge.

**Consumatori futuri** (NON parte di KE-001, solo predisposizione):
- Control Room Live Activity Stream → `GET /api/knowledge/catalog-sets/{id}/live-stream`
- Notification Center → `WARNING_CREATED` → emit notification
- Audit Trail → audit_logs viewer
- Analytics → KPI engine snapshot

---

### Fase 4 · Document Level Recovery

**Obiettivo**: ogni documento è una unità indipendente.

**Stato attuale**:
- ✅ `POST /api/knowledge/catalog-sets/{id}/documents/{doc_id}/retry` esiste (extraction_jobs.py:153). Resetta il doc a `pending` ed enqueue un nuovo job.
- ❌ Non esiste un endpoint dedicato `OPEN` (sola lettura preview).
- ❌ Non esiste un endpoint `REVIEW` come deep-link.
- ❌ Manca un endpoint per "retry solo i doc failed" senza toccare quelli completati.

**Nuovi endpoint richiesti**:

```
GET  /api/knowledge/catalog-sets/{id}/documents/{doc_id}
     Read-only preview: ritorna lo stato doc + ultima pagina elaborata + asset count.
     Per OPEN button.

GET  /api/knowledge/catalog-sets/{id}/documents/{doc_id}/review-context
     Ritorna i needs_review filtrati per source_document_id == doc_id.
     Restituisce anche il "first_anomaly_entity_id" (vedi Fase 5).
     Per REVIEW button → deep link.

POST /api/knowledge/catalog-sets/{id}/retry-failed
     Reset di tutti i doc con status='failed' (NO touch su review/validated).
     Enqueue un nuovo job che processerà solo quei doc.
     Body: { dry_run?: bool }
```

**Vincolo**: `retry_document` esistente non deve essere modificato (è già testato e usato). Ci si aggancia accanto.

**Idempotency**: ogni retry crea un nuovo `extraction_jobs` con `parent_job_id` (nuova column nullable) per audit. NON serializziamo il job in coda — la `uq_extraction_jobs_active_per_set` impone che ce ne sia uno solo attivo per set, quindi il caller riceve `409` se tenta retry mentre un job è attivo. Comportamento atteso.

---

### Fase 5 · Review Workspace Deep Link

**Obiettivo**: cliccare un warning porta l'utente direttamente all'elemento offending nel Review Workspace™ V3 già implementato.

**Backend (questo sprint)**:

1. **Endpoint nuovo**:
```
GET /api/knowledge/catalog-sets/{id}/needs-review?filter=designer_ambiguous
                                                  &cursor=<entity_id>
                                                  &include_first=true
```
Filtri supportati (passati come `?type=`):
- `designer_ambiguous`
- `material_ambiguous`
- `brand_duplicate`
- `product_unclassified` (status=needs_review + entity_type=product + confidence<0.6)
- `image_orphan`
- `low_confidence` (confidence<0.6 any type)
- `failed_document` (mappato a catalog_document failed list)

2. La risposta include `first_anomaly` quando `include_first=true` — l'entity_id che il frontend deve aprire by default.

3. **NO modifica frontend** in KE-001. Il deep-link si attiva con `?focus=<entity_id>` come query param sull'URL del Review Workspace, ma l'integrazione UI sarà parte di KE-002. Backend deve esporre l'endpoint **adesso** così KE-002 non si blocca.

**Test sintetico**:
```
GET /needs-review?type=material_ambiguous&include_first=true
→ { items: [...], first_anomaly: "<uuid>" }
GET /entities/{uuid}/future-uses  -- esistente, deve risolvere a 200
```

---

## 3. Migration

**Unica migration**: `131_ke001_reliability.sql`

(Saltiamo `130_*` perché numerazione interna — usiamo prossimo libero. Il file conterrà tutto il DDL delle fasi 2 + 3.)

```sql
-- 131_ke001_reliability.sql

-- §1 · extraction_jobs · new stalled state + recovery fields
ALTER TABLE extraction_jobs DROP CONSTRAINT IF EXISTS extraction_jobs_status_chk;
ALTER TABLE extraction_jobs ADD CONSTRAINT extraction_jobs_status_chk
  CHECK (status IN ('queued','running','paused','stalled',
                     'failed','cancelled','completed'));
ALTER TABLE extraction_jobs
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stalled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_id   TEXT,
  ADD COLUMN IF NOT EXISTS parent_job_id UUID
    REFERENCES extraction_jobs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ej_recovery_scan
  ON extraction_jobs (status, heartbeat_at)
  WHERE status IN ('running','stalled');

-- §2 · extraction_event_log
CREATE TABLE IF NOT EXISTS extraction_event_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_set_id       UUID NOT NULL REFERENCES brand_catalog_sets(id) ON DELETE CASCADE,
  catalog_document_id  UUID,
  job_id               UUID,
  ts                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind                 TEXT NOT NULL,
  message              TEXT NOT NULL,
  entity_id            UUID,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT extraction_event_log_kind_chk CHECK (
    kind IN ( /* full list in §Fase 3 */ )
  )
);
CREATE INDEX idx_eel_set_ts  ON extraction_event_log (catalog_set_id, ts DESC);
CREATE INDEX idx_eel_job_ts  ON extraction_event_log (job_id, ts DESC)
  WHERE job_id IS NOT NULL;
CREATE INDEX idx_eel_kind    ON extraction_event_log (catalog_set_id, kind, ts DESC);

COMMENT ON TABLE extraction_event_log IS
  'KE-001 · append-only event stream for Knowledge Engine extraction. '
  'Consumed by Control Room (KE-002), Notification Center, Audit Trail.';

-- §3 · TTL helper view (purgeable rows > 30d)
CREATE OR REPLACE VIEW extraction_event_log_to_purge AS
  SELECT id FROM extraction_event_log
  WHERE ts < NOW() - INTERVAL '30 days';

-- §4 · stamp
INSERT INTO schema_migrations (version, applied_at)
VALUES ('131_ke001_reliability', NOW())
ON CONFLICT (version) DO NOTHING;
```

**Migration script**: `/app/backend/scripts/apply_migration_131.py` (pattern già stabilito dal 129).

---

## 4. File backend impattati

| File | Modifica | Tipo |
|---|---|---|
| `/app/supabase/migrations/131_ke001_reliability.sql` | NEW | additive |
| `/app/backend/scripts/apply_migration_131.py` | NEW | runner |
| `/app/backend/services/extraction_job_runner.py` | edit `recover_orphan_jobs` (3-fase), aggiungi `emit_event`, instrumenta `_execute_job_sync` con event emissions, `_persist_current` write `last_seen_at` + `worker_id` | medium-risk |
| `/app/backend/services/extraction_event_publisher.py` | NEW · helper `emit_event(...)` con batch optional | low-risk |
| `/app/backend/routers/brand_catalog_sets.py` | edit `trigger_extraction` → `runner.enqueue_job()`; mark `_run_set_extraction` as `_DEPRECATED_run_set_extraction` (lascia solo come reference) | **high-risk** (test obbligatorio) |
| `/app/backend/routers/extraction_jobs.py` | NEW endpoint: `GET .../documents/{id}`, `GET .../documents/{id}/review-context`, `POST .../catalog-sets/{id}/retry-failed`, estensione `GET .../needs-review?type=...&include_first=true` | additive |
| `/app/backend/server.py` | aggiungere scheduler ogni 60s per `recover_orphan_jobs`; safety-net startup per orphan catalog_sets | low-risk |
| `/app/backend/tests/test_extraction_reliability.py` | NEW pytest (vedi §6) | additive |

**Nessun file frontend toccato.**

---

## 5. Endpoint API nuovi/modificati

### Modifiche

| Endpoint | Modifica |
|---|---|
| `POST /api/knowledge/catalog-sets/{id}/extract` | internamente delega a `runner.enqueue_job`. Risposta cambia: oggi `{status:'queued', catalog_set_id}` → domani `{status:'queued', catalog_set_id, job_id}` (backward-compatible, aggiunge `job_id`). |
| `GET /api/knowledge/catalog-sets/{id}/needs-review` | nuovo query param `?type=` (vedi Fase 5) + `?include_first=true` |

### Nuovi

| Endpoint | Scopo |
|---|---|
| `GET /api/knowledge/catalog-sets/{id}/extraction-jobs` | Storico job (oltre l'attivo). Per audit/Control Room. |
| `GET /api/knowledge/catalog-sets/{id}/documents/{doc_id}` | OPEN preview |
| `GET /api/knowledge/catalog-sets/{id}/documents/{doc_id}/review-context` | REVIEW deep-link |
| `POST /api/knowledge/catalog-sets/{id}/retry-failed` | Bulk retry doc failed |
| `GET /api/knowledge/catalog-sets/{id}/events?since=ISO&kind=&limit=` | Read-only event stream (consumato da KE-002 ma esposto già qui) |

---

## 6. Strategia recovery

### 6.1 Crash scenario coverage

| Scenario | Detection | Recovery |
|---|---|---|
| Backend pod restart (OOM, deploy) | startup hook + 60s scheduler | startup recovery + first scheduler tick (max 2 min) |
| Long-hang Vision API (silent) | heartbeat stale > 120s | scheduler tick demote→requeue |
| Storage download fail (intermittent) | already handled inline (4 retry × 1.5s backoff) | doc marker `failed` con error log |
| DB connectivity loss durante runner | `try/except` wrapping `_execute_job_async` setta job `failed` | manuale `POST /resume` |
| Job runner exception non catturata | `_execute_job_async` outer try → `status='failed'` | manuale `POST /resume` |
| Stalled in `paused` per ore | non è un crash, è user action | nessuna azione |
| 3 retry sequenziali tutti stalled | scheduler Phase C terminate | job `failed` + brand_catalog_sets→`needs_review` se almeno 1 doc ok, altrimenti `draft` |

### 6.2 Property d'invariante

> **Nessun `brand_catalog_sets.status='extracting'` può sopravvivere oltre `heartbeat_threshold * (max_retries+1) = 8 min` senza un job runner attivo.**

Garantito da: scheduler 60s × demote 120s + Phase A→B→C max 3 cicli = 6 min worst case.

### 6.3 Idempotency

- `enqueue_job` rispetta `uq_extraction_jobs_active_per_set` (esistente). Se l'utente clicca `/extract` 5 volte in 1s, solo il primo passa, gli altri ricevono `409`. ✅
- `recover_orphan_jobs` può essere chiamato 100x al secondo senza creare job duplicati (le query WHERE filtrano per status corrente). ✅
- `retry-failed` con `dry_run=true` deve restituire la lista dei doc target senza scriverla.

### 6.4 Safe-rollback

La migration 131 è puramente additive. Per rollback:
- `DROP TABLE extraction_event_log`
- `ALTER TABLE extraction_jobs DROP COLUMN last_seen_at, stalled_at, worker_id, parent_job_id`
- ripristinare CHECK constraint precedente
- Il codice fa `try/except` su event emit (graceful degrade): se la tabella non esiste, il runner continua a girare.

---

## 7. Acceptance checklist (Definition of Done)

| # | Criterio | Verifica |
|---|---|---|
| AC1 | Ogni `POST /extract` crea esattamente una row `extraction_jobs` | `SELECT COUNT(*) FROM extraction_jobs WHERE catalog_set_id=$id` ≥ 1 dopo trigger |
| AC2 | `_run_set_extraction` legacy non è più chiamato in produzione | grep `BackgroundTasks` in router → 0 chiamate residue al pipeline extraction |
| AC3 | Restart del backend durante extraction recupera il job entro 2 minuti | E2E test: avvia job, `supervisorctl restart backend`, attendi 130s, verifica job di nuovo `running` con heartbeat fresca |
| AC4 | Job orphan demote→requeue→retry cycle funziona | Test sintetico: insert mock row `status='running' heartbeat_at=now()-3min`, chiama 2x `recover_orphan_jobs`, verifica `status='stalled'` poi `status='queued'` con retry_count=1 |
| AC5 | Max 3 retry, poi `failed` | Test: simula 3 stallout consecutivi → 4° tick deve produrre `status='failed'` |
| AC6 | `brand_catalog_sets.status='extracting'` non sopravvive > 8 min senza job attivo | startup safety-net riconcilia orphan sets in 1 tick |
| AC7 | Eventi minimi emessi nel log | dopo un job completo, `SELECT kind, COUNT(*) FROM extraction_event_log GROUP BY kind`: tutti i 10 eventi obbligatori presenti |
| AC8 | Document retry indipendente (`POST .../documents/{id}/retry`) non rilancia doc già `review` | docs in `review`/`validated` continuano a saltare nel loop |
| AC9 | `POST /retry-failed` rilancia SOLO i `failed`, lasciando intatti review/validated/pending | conta documenti per status prima/dopo |
| AC10 | `GET /needs-review?type=designer_ambiguous` ritorna 200 con filtro applicato | smoke test |
| AC11 | `include_first=true` ritorna `first_anomaly` non null se ci sono items | smoke test |
| AC12 | Nessuna regressione su V3.1 (`/future-uses`, `/connected-assets`, `/project-impact`, `/apply-correction`) | esegui `pytest tests/test_review_workspace_v3.py` → 6/6 ancora PASS |
| AC13 | Nessuna modifica file frontend | `git diff --name-only` non contiene `.jsx/.tsx/.css` |
| AC14 | RIVA1920 sbloccato e rilanciabile | dopo migration applicata, hot-fix SQL eseguito (vedi §8), `POST /extract` su `a1b8cfac-...` parte e popola `extraction_jobs` |
| AC15 | Volumetria eventi < 100k/giorno per tenant medio | `SELECT COUNT(*) FROM extraction_event_log WHERE ts > now()-interval '1 day'` |
| AC16 | TTL purge view operativa | `SELECT COUNT(*) FROM extraction_event_log_to_purge` ritorna 0 il primo giorno |

---

## 8. Piano di test

### 8.1 Pytest backend (NUOVI)

File: `/app/backend/tests/test_extraction_reliability.py`

```
# Test cases
def test_trigger_creates_extraction_job_row():
    # POST /extract → SELECT * FROM extraction_jobs WHERE catalog_set_id=...
    assert job exists with status in ('queued','running')

def test_double_trigger_returns_409():
    POST twice rapidly → second returns 409 active_job_exists

def test_orphan_demotion_phase_a():
    insert running row with stale heartbeat
    call recover_orphan_jobs()
    assert status == 'stalled', stalled_at set

def test_orphan_requeue_phase_b():
    insert stalled row, retry_count=1
    call recover_orphan_jobs()
    assert status == 'queued', retry_count == 2

def test_orphan_terminate_phase_c():
    insert stalled row, retry_count=3
    call recover_orphan_jobs()
    assert status == 'failed', error_message contains 'max_retries'

def test_orphan_set_safety_net():
    insert catalog_sets row status='extracting', updated_at = now()-1h
    no active job row
    call startup_safety_net()
    assert catalog_set.status in ('needs_review','draft')

def test_event_log_emission():
    enqueue job, wait for completion (or simulate)
    assert COUNT(extraction_event_log) > 0
    assert kinds include {JOB_STARTED, DOCUMENT_STARTED, DOCUMENT_COMPLETED, JOB_COMPLETED}

def test_retry_failed_does_not_touch_review_docs():
    setup: doc1 review, doc2 failed, doc3 validated
    POST /retry-failed
    assert doc1.status unchanged
    assert doc2.status == 'pending'
    assert doc3.status unchanged

def test_needs_review_filter_type():
    GET /needs-review?type=designer_ambiguous
    assert all items.entity_type == 'designer'

def test_needs_review_include_first():
    GET /needs-review?type=material_ambiguous&include_first=true
    assert 'first_anomaly' in response
```

### 8.2 Manual E2E

Procedura sotto supervisione utente:
1. `POST /extract` su un set piccolo (1 PDF da 10 pagine).
2. Verificare `extraction_jobs` row creata + `JOB_STARTED` event.
3. `sudo supervisorctl restart backend` durante extraction.
4. Attendere 130s. Verificare:
   - `extraction_jobs.status` torna `running` (con retry_count=1).
   - Doc viene completato.
   - `JOB_RECOVERED` event presente.

### 8.3 RIVA1920 readiness (post-fix)

1. Eseguire hot-fix SQL dalla §3.1 del diagnostic per sbloccare il set.
2. Applicare migration 131.
3. Restart backend.
4. UI rimane invariata, ma ora `POST /extract` su `a1b8cfac-...` userà il job runner persistente.
5. Validare che il batch riprende e completa senza intervento manuale.

### 8.4 No-regression sweep

| Suite | Comando | Atteso |
|---|---|---|
| Review Workspace V3 | `pytest tests/test_review_workspace_v3.py -v` | 6 PASS |
| Brand Registry | `pytest tests/test_brand_registry_enhancement.py -v` | tutti PASS |
| Form engine | `pytest tests/test_form_engine.py -v` | tutti PASS |
| Smoke load preview URL | `curl /api/health` | 200 |
| Frontend lint | `mcp_lint_javascript /app/frontend/src/` | 0 blocking |

---

## 9. Effort stimato

| Fase | Lavoro | Effort | Risk |
|---|---|---|---|
| **Fase 1 · ITER197 wiring** | Migrate `trigger_extraction`, rinomina legacy, smoke E2E | **0.5 day** | **HIGH** (refactor di una hot path) |
| **Fase 2 · Orphan recovery** | Migration 131, runner 3-fase, scheduler 60s, safety-net startup | **1.0 day** | medium |
| **Fase 3 · Event log** | Tabella + helper publisher + 10 emit points nel runner | **1.5 day** | low |
| **Fase 4 · Document recovery** | 4 nuovi endpoint (OPEN/REVIEW/retry-failed/extraction-jobs) | **0.5 day** | low |
| **Fase 5 · Deep-link** | Estensione `/needs-review` con filtri + first_anomaly | **0.5 day** | low |
| **Pytest reliability** | 10 test case con fixture DB sintetiche | **0.5 day** | low |
| **Manual E2E + RIVA1920 unblock** | Test guidati + hot-fix SQL utente | **0.5 day** | medium |
| **Buffer / no-regression** | Sweep + adjustment | **0.5 day** | low |
| **TOTAL** | | **5–6 day** (1 sprint) | |

Risk hotspot: **Fase 1**. Mitigation: deploy in feature branch, rollout solo dopo Fase 2+3 testate. Possibilità di feature flag `KE001_USE_PERSISTENT_JOB_RUNNER=true` per A/B durante stabilizzazione (opzionale, no scope creep).

---

## 10. Out-of-scope (esplicitamente NON in KE-001)

- ❌ Knowledge Engine Control Room UI (sprint **KE-002**)
- ❌ Review Workspace V3 refactor / UI deep-link wiring (sprint **KE-003**)
- ❌ Future Uses™ / Knowledge Impact™ extensions (sprint **KE-004**)
- ❌ Designer Journey Integration™ (sprint **KE-005**)
- ❌ WebSocket / SSE per live updates (futuro, polling 2s sufficiente)
- ❌ Push notification verso device esterni
- ❌ Vision API hardening / rate limit Anthropic / per-image timeout già esistente
- ❌ Cross-tenant admin dashboard

---

## 11. Dipendenze

**Esistenti** (già in produzione, NON serve installarle):
- APScheduler (per cron 60s)
- `extraction_jobs` table (presente)
- `extraction_job_runner.py` (presente)
- `recover_orphan_jobs` (presente, da estendere)
- `retry_document` endpoint (presente)
- `tenants.id`, `brand_catalog_sets.id`, `brand_catalog_documents.id` (FK target)

**Da introdurre**:
- Solo le 5 column su `extraction_jobs` + 1 tabella nuova (event_log) + 1 view di purge.

---

## 12. Sign-off richiesto prima di start

Per dare il go all'implementazione tecnica:

1. ✅ Approvazione della **migration 131** (additive, zero-risk schema-wise)
2. ✅ Approvazione dello stato `stalled` come fase intermedia esplicita
3. ✅ Approvazione dei 4+1 endpoint nuovi (OPEN/REVIEW/retry-failed/extraction-jobs/events)
4. ✅ Approvazione della **deprecazione di `_run_set_extraction`** (mantenuto come reference, non cancellato)
5. ✅ Conferma che **non c'è hot-fix SQL applicato** finché lo sprint non parte (RIVA1920 resta `extracting` orfano fino al deploy, oppure si applica subito il fix isolato della §3.1 del diagnostic se l'utente vuole sbloccare prima)

Una volta dato il go:
- Branch `sprint/ke-001-reliability`
- Daily check-in su `extraction_jobs` count + `JOB_RECOVERED` events
- Demo finale: kill+restart durante estrazione live su set RIVA1920

---

## 13. Roadmap successiva (fuori scope KE-001)

```
KE-001 · Production Reliability™               ← QUESTO SPRINT
    │
    ▼
KE-002 · Control Room™                          (Worker Status + Live Stream + Warning Center)
    │
    ▼
KE-003 · Review Workspace™ V3.1 deep-link       (UI cablaggio dei filtri ?type=&focus=)
    │
    ▼
KE-004 · Future Uses™ + Knowledge Impact™ wiring (autowrite entity_operational_usage)
    │
    ▼
KE-005 · Designer Journey Integration™          (entity → moodboard/journey single click)
```

Tutti dipendono dal log eventi e dai job persistenti introdotti **qui**.

---

**End of plan.** In attesa di approvazione esplicita per partire.
