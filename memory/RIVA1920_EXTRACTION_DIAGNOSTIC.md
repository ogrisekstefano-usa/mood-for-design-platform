# RIVA1920 · Extraction Worker Diagnostic

**Audit date**: 2026-06-04 21:19 UTC
**Catalog Set under audit**: `a1b8cfac-4c27-4b9d-88f7-877f75f8445c` — *RIVA1920 · Master Library*
**Audit scope**: forensic only · **NO code change applied**

---

## 1. Situazione attuale (snapshot DB)

### 1.1 Catalog Set state

| Campo | Valore |
|---|---|
| `id` | `a1b8cfac-4c27-4b9d-88f7-877f75f8445c` |
| `brand` | RIVA1920 |
| `status` | `extracting` **← STALE** |
| `extraction_progress` | `11.21%` |
| `extraction_started_at` | 2026-06-04 **04:41:48** UTC |
| `extraction_completed_at` | `null` |
| `updated_at` | 2026-06-04 **04:50:45** UTC |
| **Idle age** | **~16h 28min** |
| `pages_processed / total_pages` | **182 / 1623** |
| `document_count` | 12 |
| `documents_extracted` | 1 |
| `documents_failed` | 2 |
| `index_summary` | `{}` (vuoto — nessuna unified index build) |

### 1.2 Documents (per-PDF state)

| status | document | pages | upd_age | errs |
|---|---|---|---|---|
| 🔴 **failed** | `Riva1920_1006 Catalogue _ RAW EDITION` | 13/134 | 998m | 1 |
| 🟢 **review** | `RIVA1920_catalogo_BARRIQUE-1 1` | 96/96 | 991m | 0 |
| 🟡 **extracting** | `RIVA1920_catalogo_BRICCOLE` | 46/90 | 989m | 0 |
| ⚪ pending | `RIVA1920_catalogo_CEDRO-1` | 0/194 | 1000m | 0 |
| ⚪ pending | `RIVA1920_catalogo_CUCINE` | 0/114 | 1000m | 0 |
| ⚪ pending | `RIVA1920_catalogo_DAY_2022` | 0/370 | 998m | 0 |
| ⚪ pending | `RIVA1920_catalogo_KAURI_2024` | 0/74 | 998m | 0 |
| ⚪ pending | `RIVA1920_catalogo_NOTTE` | 0/138 | 998m | 0 |
| ⚪ pending | `Riva1920_FoodWine_2025` | 0/72 | 998m | 0 |
| 🔴 **failed** | `RIVA1920_ICONS2025-1` | 27/274 | 997m | 1 |
| ⚪ pending | `RIVA1920_If It's Real Wood, It Lasts Forever` | 0/17 | 998m | 0 |
| ⚪ pending | `Riva1920_Outdoor-2024` | 0/50 | 998m | 0 |

**BRICCOLE** (il documento "vivo") metrics:
```json
{
  "stage": "vision_layer2",
  "stage_at": "2026-06-04T04:50:45.255737+00:00",
  "stage_pct": 0.513,
  "vision_total": 162,
  "vision_current": 35
}
```
→ Bloccato dentro Vision Layer 2 al 35esimo asset di 162. Nessuna scrittura DB su questa row da **16h 28min**.

### 1.3 Failed docs · error logs

Entrambi i fallimenti riportano `Server disconnected`:

```
ICONS2025-1  · 2026-06-04 04:41:53 · "Server disconnected" (after section_detection_done)
1006 RAW EDITION · 2026-06-04 04:42:00 · "Server disconnected" (after section_detection_done)
```

→ Lo stesso pattern di errore che si è ripetuto nei log backend stamattina (`21:05:55 — Transient RemoteProtocolError on /extraction-status`).

### 1.4 brand_detected_entities (Unified Brand Index)

| Conteggio | 0 rows |
|---|---|
| Interpretazione | Nessuna entità è stata costruita per RIVA1920. La pipeline è morta **prima** di `brand_index_builder.build_unified_index`. |

### 1.5 brand_catalog_pages (page snapshots)

Le ultime 10 page snapshots scritte appartengono **tutte** a BARRIQUE (l'unico doc completato), con `updated_at` a 04:50 UTC. Nessuna scrittura successiva.

### 1.6 extraction_jobs table

```
extraction_jobs rows EVER created for RIVA1920 catalog set = 0
extraction_jobs running/pending/paused across the whole platform = 0
Last platform job = 7077443d (set 00e33d7f, status=completed, on 2026-06-02 17:01)
```

⚠️ **Smoking gun #1**: **Mai esistita** una row `extraction_jobs` per RIVA1920. Il batch di estrazione è partito attraverso il flusso *legacy* che NON crea persistence row.

---

## 2. Root Cause Analysis

### 2.1 Mappatura sintomi → cause

| Ipotesi dell'utente | Esito audit |
|---|---|
| **A · il worker è realmente fermo** | ✅ **CONFERMATO** |
| **B · il worker lavora ma il frontend non aggiorna** | ❌ falso — i DB record sono fermi da 16h |
| **C · il polling è rotto** | ❌ falso — il polling chiama `/extraction-status` ogni 2s e riceve 200 OK |
| **D · il websocket è rotto** | N/A — il sistema **non usa websocket**, solo polling |
| **E · extraction-summary è stale** | ✅ vero, ma è **sintomo**, non causa (il DB è fermo) |
| **F · la queue è bloccata** | ✅ confermato, ma il vero termine è "**inesistente**" — non c'è coda persistita |

### 2.2 Causa primaria

> Il task `_run_set_extraction` (in `/app/backend/routers/brand_catalog_sets.py:596`) è spawnato come **FastAPI BackgroundTask in-process** dal `POST /catalog-sets/{set_id}/extract`. È un'esecuzione sincrona, single-threaded, **non persistita**, eseguita dentro il processo `uvicorn`.
>
> Alle **04:50:45 UTC del 04-Giu-2026** il processo backend è morto silenziosamente mentre stava processando il documento BRICCOLE al 35esimo asset di Vision Layer 2. Cause più probabili (in ordine di plausibilità):
>
> 1. **OOM kill / container restart** durante l'inferenza Vision (i PDF Vision Layer 2 caricano gli asset interi in memoria, RIVA1920 = 1.623 pagine totali).
> 2. **Anthropic / Vision API silent hang** che ha lasciato il thread bloccato finché Kubernetes non ha killato il pod.
> 3. **Hotfix / deploy** che ha riavviato il container (preview env).
>
> Quando il processo è morto, il task ha smesso di esistere. **Il loop non è entrato nel suo `except`** quindi:
> - `brand_catalog_documents.extraction_status` per BRICCOLE è rimasto `'extracting'` (nessun marker `failed`).
> - `brand_catalog_sets.status` è rimasto `'extracting'` (il finalizer `status='needs_review'` non è mai stato eseguito).
> - Gli 8 documenti `pending` non sono mai stati toccati.

### 2.3 Causa secondaria (architettura)

> Esiste un **secondo sistema** di extraction (`ITER197 · Persistent Extraction Jobs` in `/app/backend/services/extraction_job_runner.py`) con:
> - row persistita in `extraction_jobs`
> - heartbeat ogni 5s
> - `recover_orphan_jobs()` su startup FastAPI che ripristina i job con heartbeat > 2 min
> - retry counter (max 3) e re-spawn automatico
>
> **MA il trigger pubblico `POST /catalog-sets/{set_id}/extract` NON usa ITER197.** Usa il path legacy `BackgroundTasks` → `_run_set_extraction`. Quindi:
> - Nessuna row `extraction_jobs` viene creata.
> - `recover_orphan_jobs()` su startup non trova nulla da recuperare.
> - Il sistema non si auto-ripara dopo un crash del processo.

### 2.4 Causa terziaria (UX)

> L'endpoint `/extraction-status` legge da `brand_catalog_sets` + `brand_catalog_documents` **senza** validare l'attualità dei dati. Calcola ETA da `extraction_started_at` confrontato a `now()`, ottenendo numeri falsi (es. "ETA −16h" quando i dati sono stale).
>
> Il frontend non ha **nessun indicatore di liveness**: l'utente non può sapere se il backend sta effettivamente lavorando, perché vede solo le percentuali ferme.

### 2.5 Evidenze chiave (riassuntive)

| Evidenza | Valore | Significato |
|---|---|---|
| `extraction_jobs` row per il set | **0** | Path legacy, no persistence |
| Ultimo `updated_at` su DB | **16h 28min fa** | Il worker è morto |
| `status='extracting'` su set | **vero** | Status non transizionato |
| BRICCOLE `metrics.stage_at` | **04:50:45 UTC** | Ultima scrittura del worker |
| BRICCOLE `extraction_status` | **`extracting`** | Mai marcato `failed` perché crash hard |
| 8 documenti `pending` | **mai partiti** | Loop interrotto prima |
| `brand_detected_entities` count | **0** | Nessuna entità costruita |
| Polling frontend ogni 2s | ✅ attivo | Chiama `/extraction-status` |
| Backend errors recenti | `Server disconnected` ricorrente sulle chiamate ad Anthropic vision | Causa pattern del crash |
| Recovery hook ITER197 | scatta su startup ma trova 0 orphan | Non applicabile a path legacy |

---

## 3. Fix proposto (NON applicato — solo design)

### 3.1 Hot-fix immediato (LOW risk)

Un unico script SQL marca lo stato corrente come "needs_review" e i documenti `extracting` come `failed`, permettendo all'utente di rilanciare manualmente i 9 documenti non completati via l'endpoint esistente `POST /catalog-sets/{id}/documents/{doc_id}/retry`:

```sql
-- Marker manuale post-crash · da eseguire SOLO dopo approvazione utente
UPDATE brand_catalog_documents
   SET extraction_status='failed',
       error_logs = error_logs || jsonb_build_array(
         jsonb_build_object('error','Backend process died · auto-marked failed',
                            'at', now()::text)),
       updated_at=now()
 WHERE catalog_set_id='a1b8cfac-4c27-4b9d-88f7-877f75f8445c'
   AND extraction_status='extracting';

UPDATE brand_catalog_sets
   SET status = CASE
         WHEN documents_extracted > 0 THEN 'needs_review'
         ELSE 'draft' END,
       extraction_completed_at = now(),
       updated_at = now()
 WHERE id='a1b8cfac-4c27-4b9d-88f7-877f75f8445c';
```

### 3.2 Fix architetturale (medium effort)

Migrare il trigger `POST /catalog-sets/{id}/extract` dal path legacy `BackgroundTasks` → `_run_set_extraction` al path **ITER197 persistent jobs**:

1. `trigger_extraction` crea una row `extraction_jobs` (status=`queued`, heartbeat fresca, retry_count=0, total_pages, documents_total) e chiama `extraction_job_runner._spawn_job(job_id)`.
2. `_run_set_extraction` viene wrappato in modo che ogni iterazione di documento aggiorni `extraction_jobs.heartbeat_at` + `current_document_name` + `progress_pct`.
3. Il recovery hook esistente (`recover_orphan_jobs`, `HEARTBEAT_STALE_AFTER_S=120`) ricovera automaticamente entro 2 minuti dal crash.

Beneficio: **self-healing automatico** dopo deploy/crash, e la Control Room può leggere `extraction_jobs` come SSoT del worker.

### 3.3 Fix UX (Control Room — vedi `KNOWLEDGE_ENGINE_CONTROL_ROOM_PROPOSAL.md`)

Anche con il fix architetturale, l'utente deve **vedere** lo stato del worker (active / stalled / review-required) e capire **cosa sta succedendo**. Vedi documento dedicato.

### 3.4 Anti-regression checklist

| Check | Cosa verificare |
|---|---|
| `extraction_jobs` viene effettivamente creata dal nuovo `trigger_extraction`? | Smoke test: dopo POST /extract, deve esistere una row con status `queued` → `running`. |
| Heartbeat aggiornata a ogni page processed? | `heartbeat_at` deve avanzare almeno ogni 30s. |
| Recovery dopo restart funziona? | `kubectl rollout restart` durante extraction → entro 2 min il job ricompare e riprende. |
| Status finale `needs_review` o `failed` mai bloccato a `extracting`? | Anche se ogni doc fallisce, lo status set passa a `needs_review` o `failed`. |
| `failed` doc esposti con `[Retry]` button in UI? | Già esiste `POST /documents/{id}/retry` — basta cablarlo. |

---

## 4. Conclusion

> **Il worker NON sta lavorando. È morto il 04-Giu alle 04:50 UTC e non si è mai riavviato.**
>
> La causa primaria è il path legacy `BackgroundTasks` non persistente.
> La causa terziaria è l'assenza di indicatori di liveness in UI: l'utente non distingue tra "in corso lentissimo" e "fermo da 16h".
>
> 9 documenti su 12 non sono mai stati processati (`pending` mai toccati), 2 sono `failed` per `Server disconnected`, 1 è bloccato a metà (`BRICCOLE`), 1 è completato (`BARRIQUE`).
>
> Nessun dato è perso ma il batch va riavviato manualmente. Per la prossima volta servono i fix architetturali e UX descritti sopra (§3.2 + §3.3).
