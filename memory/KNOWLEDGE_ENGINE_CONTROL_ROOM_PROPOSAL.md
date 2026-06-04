# Knowledge Engine · CONTROL ROOM™ — Architecture Proposal

**Status**: 🟦 Architectural proposal · **no code change applied**
**Companion document**: `RIVA1920_EXTRACTION_DIAGNOSTIC.md`
**Audience**: producer / studio / advisor caricando 1.000+ pagine
**Design language locked**: Blueprint Chameleon™ (dark UI · serif headings · monospace numerals · teal/cyan accents · no white backgrounds)

---

## 0. Statement

La Catalog Set Detail page **non è una lista documenti**. È il **ponte di controllo** della fabbrica di brand knowledge. Quando un produttore carica 1.600 pagine di RIVA1920, in 5 secondi deve poter rispondere a 4 domande:

1. **Sta succedendo qualcosa?** (worker live / stalled / fermato)
2. **Cosa è stato trovato finora?** (KPI live: prodotti, designer, materiali, immagini, relazioni)
3. **Cosa manca?** (queue residua + ETA reale)
4. **Cosa richiede il mio intervento?** (warning categorizzati, ognuno cliccabile)

Tutto il resto è rumore.

---

## 1. Architettura della Control Room

### 1.1 Layout desktop · 12-column grid

```
╔════════════════════════════════════════════════════════════════════════════════╗
║ ┃ KNOWLEDGE STRIP (persistent) — RIVA1920 KNOWLEDGE PACKAGE™                  ┃ ║
║ ┃ Pagine 182/1623 · Prodotti 43 · Designer 11 · Materiali 18 · Img 287 · Rel 96│ ║
║ ┃                                          Score 32%  ·  17 da validare       ┃ ║
╠════════════════════════════════════════════════════════════════════════════════╣
║ ┌───────────────────────────────┐ ┌────────────────────────────────────────────┐
║ │ ▓ WORKER STATUS               │ │ ▓ LIVE ACTIVITY STREAM                     │
║ │  ● ACTIVE · Worker #1         │ │  15:48:21 · BRICCOLE · pag 46 elaborata    │
║ │  Doc corrente: BRICCOLE       │ │  15:48:05 · +3 immagini trovate            │
║ │  Pagina 46 / 90               │ │  15:47:53 · prodotto: KURA                 │
║ │  Stage: Vision Layer 2 · 35/162│ │  15:47:40 · designer: CR&S Riva1920        │
║ │  Heartbeat: 4s fa             │ │  15:47:02 · materiale: Noce Canaletto      │
║ │  Queue: 9 documenti           │ │  15:46:48 · BRICCOLE · pag 45 elaborata    │
║ │  ETA: ~18 min                 │ │  …                                         │
║ │                               │ │  [ tail -f live · max 30 righe ]           │
║ │  ─ Controlli ─                │ │                                            │
║ │  [⏸ Pausa] [⏹ Stop]           │ │                                            │
║ └───────────────────────────────┘ └────────────────────────────────────────────┘
║
║ ┌──────────────────────────────────────────────────────────────────────────────┐
║ │ ▓ EXTRACTION KPI · live deltas                                               │
║ │   Prodotti       43  +2   Designer    11  +1   Materiali     18  +3          │
║ │   Immagini      287 +14   Relazioni   96  +5   Brand Alias    4  +0          │
║ └──────────────────────────────────────────────────────────────────────────────┘
║
║ ┌─────────────────────────────────────┐ ┌────────────────────────────────────┐
║ │ ▓ DOCUMENT QUEUE                    │ │ ▓ WARNING CENTER                   │
║ │ ───────────────────────────────────  │ │ ⚠ Designer ambigui          5  →   │
║ │ ✓ BARRIQUE         96/96   review   │ │ ⚠ Materiali ambigui         7  →   │
║ │ ⟳ BRICCOLE        46/90   extracting│ │ ⚠ Brand duplicati           1  →   │
║ │ ✗ ICONS2025-1     27/274  failed [↻]│ │ ⚠ Prodotti sconosciuti      9  →   │
║ │ ✗ RAW EDITION     13/134  failed [↻]│ │ ⚠ Immagini senza match     14  →   │
║ │ ▢ CEDRO-1          0/194  pending   │ │ ⚠ Confidence < 0.6         11  →   │
║ │ ▢ CUCINE           0/114  pending   │ │ ⚠ Documenti failed (retry)  2  →   │
║ │ ▢ DAY_2022         0/370  pending   │ │                                    │
║ │ ▢ KAURI_2024       0/74   pending   │ │  ─ Tot warning: 49 ─               │
║ │ ▢ NOTTE            0/138  pending   │ │                                    │
║ │ ▢ FoodWine_2025    0/72   pending   │ │  ┌─────────────────────────────┐   │
║ │ ▢ Outdoor-2024     0/50   pending   │ │  │ → APRI REVIEW WORKSPACE™    │   │
║ │ ▢ Real Wood        0/17   pending   │ │  └─────────────────────────────┘   │
║ │ Azioni per riga (hover):            │ │                                    │
║ │ [▶ OPEN] [✎ REVIEW] [↻ RETRY]       │ │                                    │
║ └─────────────────────────────────────┘ └────────────────────────────────────┘
║
║ ┌─────────────────────────── ATLAS SYNC FOOTER (sticky) ───────────────────────┐
║ │ ● Brand Atlas Sync · Live   Entità 392   Nodi validati 104 +1                │
║ │                                 Knowledge Package pronto al 18% · 9 doc rimasti │
║ └──────────────────────────────────────────────────────────────────────────────┘
╚════════════════════════════════════════════════════════════════════════════════╝
```

### 1.2 Layout mobile (single column, stacked)

```
╔══════════════════════════════════════╗
║ KNOWLEDGE STRIP (compatta)           ║
║ RIVA1920 KP™                         ║
║ 182/1623 pages · Score 32%           ║
║ ⚠ 17 da validare                     ║
╠══════════════════════════════════════╣
║ ● WORKER · ACTIVE                    ║
║ BRICCOLE · pag 46/90                 ║
║ Stage: Vision Layer 2 · 35/162       ║
║ Heartbeat: 4s · ETA ~18 min          ║
║ Queue: 9 documenti                   ║
║ [⏸ Pausa]    [⏹ Stop]                ║
╠══════════════════════════════════════╣
║ ▓ KPI                                ║
║ Prodotti 43 +2 · Designer 11 +1      ║
║ Materiali 18 +3 · Img 287 +14        ║
║ Relazioni 96 +5                      ║
╠══════════════════════════════════════╣
║ ⚠ WARNING CENTER                     ║
║   Designer ambigui          5  →     ║
║   Materiali ambigui         7  →     ║
║   Brand duplicati           1  →     ║
║   Prodotti sconosciuti      9  →     ║
║   Immagini senza match     14  →     ║
║   Confidence < 0.6         11  →     ║
║   Doc failed (retry)        2  →     ║
║                                      ║
║   [→ APRI REVIEW WORKSPACE™]         ║
╠══════════════════════════════════════╣
║ 🔴 LIVE STREAM (tabbable)            ║
║ 15:48:21 BRICCOLE pag 46             ║
║ 15:48:05 +3 immagini                 ║
║ 15:47:53 prodotto KURA               ║
║ …                                    ║
╠══════════════════════════════════════╣
║ DOCUMENTI (collapsable accordion)    ║
║ ✓ BARRIQUE        review             ║
║ ⟳ BRICCOLE        extracting         ║
║ ✗ ICONS2025-1     failed   [↻]       ║
║ ▢ CEDRO-1         pending            ║
║ … (espandi)                          ║
╠══════════════════════════════════════╣
║ Atlas Sync · Live                    ║
║ Knowledge Package pronto al 18%      ║
╚══════════════════════════════════════╝
```

---

## 2. Specifiche dei 6 elementi obbligatori

### 2.1 KNOWLEDGE ENGINE STATUS (Worker badge)

Stati visualizzabili come **status pill** con dot animato:

| Stato | Visual | Trigger | Microcopy |
|---|---|---|---|
| 🟢 **ACTIVE** | dot teal + ring pulsante | `extraction_jobs.status='running'` AND `heartbeat_age < 30s` | "Worker #N · Doc *NAME* · pag X/Y · Stage *STAGE_LABEL* · ETA *XX min*" |
| 🟡 **STALLED** | dot ambra + ring statico | `heartbeat_age >= 30s AND < 2 min` | "Nessun progresso da *N* minuti · auto-recover entro 2 min" |
| 🟠 **STALLED+RECOVERY** | dot ambra animato veloce | `heartbeat_age >= 2 min · retry_count > 0` | "Recovery automatico in corso (retry *N*/3)" |
| 🔴 **FAILED** | dot rosso | `status='failed' OR retry_count >= 3` | "Estrazione fallita · *error_message* · [Riprova batch] [Riprova solo doc fallit]" |
| 🟣 **REVIEW REQUIRED** | dot viola | tutti i doc completati con warning > 0 | "*N* warning da validare · [Apri Review Workspace →]" |
| 🟢 **CERTIFIED** | dot teal solid + sparkle | `catalog_set.status='published'` | "Brand Knowledge Package certificato · [Apri Launchpad →]" |
| ⚪ **IDLE** | dot grigio | nessun job + status=draft/needs_review | "Pronto a caricare PDF · [Trigger extraction]" |

Sotto la status pill, **3 metrics fisse** in monospace:
- `Doc corrente: BRICCOLE`
- `Pagina: 46 / 90`
- `Stage: Vision Layer 2 · 35 / 162`

Con bottoni controllo: `[⏸ Pausa]` `[⏹ Stop]` `[↻ Riprova doc fallit]` (visibili in base allo stato).

### 2.2 LIVE ACTIVITY STREAM

Source dati: nuova tabella `extraction_event_log` (vedi §4.1). Polling 2s OR Server-Sent Events.

- 30 righe max, scroll-locked al top.
- Ogni riga: `timestamp · entity_type icon · 1-line description`.
- Color coding per evento:
  - blu — pagina processata
  - cyan — entità rilevata (prodotto/designer/materiale)
  - giallo — warning generato
  - rosso — errore
- Click su riga → highlight nella sezione corrispondente (Warning Center / Document Queue / Entity Inspector).

Esempi di event copy:
```
15:48:21 [page]    BRICCOLE · pag 46 elaborata
15:48:05 [image]   +3 immagini trovate · BRICCOLE pag 46
15:47:53 [product] Prodotto identificato: KURA (confidence 94%)
15:47:40 [designer] Designer identificato: CR&S Riva1920
15:47:32 [warning] Designer ambiguo: "C R & S Riva" vs "CR&S Riva1920"
15:47:02 [material] Materiale identificato: Noce Canaletto
```

### 2.3 EXTRACTION KPI · live deltas

6 KPI obbligatori, in monospace, con delta `+N` in teal:

| KPI | Source DB |
|---|---|
| Prodotti estratti | `COUNT brand_detected_entities WHERE entity_type='product'` |
| Designer | `… entity_type='designer'` |
| Materiali | `… entity_type='material'` |
| Immagini | `COUNT media_library WHERE category='brand_catalog_asset'` |
| Relazioni | `COUNT brand_entity_relations` |
| Brand Alias | `jsonb_array_length(SUM aliases)` |

I delta sono calcolati **client-side** confrontando lo snapshot precedente del polling con quello corrente (intervallo di 2s o configurabile).

### 2.4 WARNING CENTER (cliccabile, categorizzato)

Sostituisce il vago "Necessita controllo" attuale con **7 categorie** distinte, ognuna cliccabile e che porta a una vista filtrata del Review Workspace™ già implementato.

| Categoria | Filtro applicato | Endpoint sorgente |
|---|---|---|
| Designer ambigui | `entity_type='designer' AND status='needs_review'` | `/needs-review?type=designer` |
| Materiali ambigui | `entity_type='material' AND status='needs_review'` | `/needs-review?type=material` |
| Brand duplicati | dup detection cross-doc | `/needs-review?type=brand_dup` |
| Prodotti sconosciuti | `entity_type='product' AND confidence < 0.6` | `/needs-review?type=product_unclassified` |
| Immagini senza match | `media_library` senza entity link | `/needs-review?type=orphan_image` |
| Confidence < 0.6 | tutti i type | `/needs-review?confidence_lt=0.6` |
| Documenti failed (retry) | `extraction_status='failed'` | `/documents?status=failed` |

Ogni riga: `<icon> <label> <count, monospace> →`. Click → apre Review Workspace™ V3.1 con filtro pre-applicato.

In fondo: **CTA primaria sempre visibile** `[→ APRI REVIEW WORKSPACE™]`.

### 2.5 DOCUMENT QUEUE (list with actions)

Tabella dei 12 documenti. Ogni riga ha hover-actions sempre disponibili (no riga morta):

| Status doc | Azioni disponibili |
|---|---|
| `pending` | `[▶ OPEN]` (read-only preview) |
| `extracting` | `[⏸ Pause this doc]` |
| `review` | `[▶ OPEN]` `[✎ REVIEW]` |
| `failed` | `[▶ OPEN]` `[↻ RETRY]` `[🗑 Remove]` |
| `validated` | `[▶ OPEN]` `[✎ REVIEW]` |

Click su nome doc → apre `DocumentViewer` (Review Workspace col. 2) focalizzato su quel doc.

Indicatore di stage corrente accanto al doc `extracting`: small inline progress bar (35/162 vision assets).

### 2.6 REVIEW WORKSPACE ENTRY · CTA principale

Quando `needsReview.length > 0`:
- nella **status pill superiore**: badge `⚠ N warning · apri review →`
- nel **Warning Center**: CTA `[→ APRI REVIEW WORKSPACE™]` full-width teal
- nella **Atlas Sync footer**: testo `Risolvi le ambiguità per certificare il Knowledge Package` (già presente in V3.1)

Quando `gate.ready_to_publish === true`:
- la status pill diventa 🟣 REVIEW REQUIRED
- CTA aggiunge `[✓ CERTIFICA KNOWLEDGE PACKAGE]` accanto a `[Apri Review Workspace]`

---

## 3. Endpoint backend richiesti per la Control Room

Tutti additivi (zero rewrite di endpoint esistenti).

### 3.1 GET `/api/knowledge/catalog-sets/{id}/worker-status`

Risponde con:
```json
{
  "state": "active | stalled | stalled_recovery | failed | review_required | certified | idle",
  "job": {
    "id": "uuid",
    "worker_id": null,
    "current_document_name": "BRICCOLE",
    "current_page": 46,
    "total_pages_doc": 90,
    "stage": "vision_layer2",
    "stage_label": "Analisi Vision Layer 2…",
    "vision_current": 35,
    "vision_total": 162,
    "heartbeat_at": "2026-06-04T21:18:01Z",
    "heartbeat_age_seconds": 4,
    "retry_count": 0
  },
  "queue": {
    "pending": 9,
    "extracting": 1,
    "review": 1,
    "failed": 2
  },
  "eta": {
    "seconds": 1080,
    "pages_per_second": 0.31,
    "documents_remaining": 9
  },
  "warnings_total": 49
}
```

### 3.2 GET `/api/knowledge/catalog-sets/{id}/live-stream?since={ts}`

Returns last N events from `extraction_event_log` (newest first). Supports `?since=ISO` for incremental polling.

```json
{
  "events": [
    {"ts":"15:48:21Z","kind":"page","doc":"BRICCOLE","msg":"pag 46 elaborata"},
    {"ts":"15:47:53Z","kind":"product","entity_id":"…","msg":"Prodotto identificato: KURA","confidence":0.94}
  ],
  "next_since": "2026-06-04T15:48:22Z"
}
```

### 3.3 GET `/api/knowledge/catalog-sets/{id}/warning-breakdown`

Risponde con i 7 contatori del Warning Center (categorizzati, vedi §2.4).

### 3.4 POST `/api/knowledge/catalog-sets/{id}/recover`

Force-recovery endpoint operativo: se la pagina rileva `state=stalled` per > 5 min, mostra `[Forza recovery]` che chiama questo endpoint. Internamente:
1. Verifica `extraction_jobs.heartbeat_age`
2. Se > 2 min → re-queue + spawn (riusa logica `recover_orphan_jobs`)
3. Se non esiste job (path legacy) → crea nuovo job e riavvia da last document `pending`/`extracting`

### 3.5 POST `/api/knowledge/catalog-sets/{id}/extract` (modifica esistente)

Stesso path, ma internamente:
- Sostituisce `BackgroundTasks` con `extraction_job_runner.create_and_spawn_job(set_id, …)`
- Crea row `extraction_jobs` persistente
- Il loop legacy `_run_set_extraction` diventa il body del job → ogni iter aggiorna `heartbeat_at`, `current_document_name`, `current_page`, `progress_pct`
- Il finalizer (set→`needs_review`) viene eseguito **anche** se il loop ha eccezioni grezze, perché il job runner ha il proprio `try/finally`

---

## 4. Schema DB (additivo)

### 4.1 `extraction_event_log` (nuova tabella)

Append-only stream per Live Activity Stream.

```sql
CREATE TABLE extraction_event_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  catalog_set_id  UUID NOT NULL,
  catalog_document_id UUID,
  job_id          UUID,
  ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind            TEXT NOT NULL,
    -- 'page'|'image'|'product'|'designer'|'material'|'warning'|'error'|'stage'
  message         TEXT NOT NULL,
  entity_id       UUID,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_eel_set_ts ON extraction_event_log(catalog_set_id, ts DESC);
```

Il job runner emette eventi a ogni page processed / entity detected / warning raised. Per evitare write storm, batch ogni 250ms.

### 4.2 Riuso di `extraction_jobs` (già esistente)

Nessuna nuova column richiesta. Solo wiring del trigger legacy.

### 4.3 Nessuna modifica a `brand_catalog_sets` / `brand_catalog_documents` / `brand_detected_entities`

Pure additive policy preservata (come V3.1).

---

## 5. Stati visuali · matrice di rendering

| Worker state | Background panel | Status pill | Live stream | Warning center | CTA primaria |
|---|---|---|---|---|---|
| **IDLE** | dark calm | ⚪ Idle | hidden | hidden | `[▶ TRIGGER ESTRAZIONE]` |
| **ACTIVE** | dark + subtle teal pulse | 🟢 Active | live | live | `[⏸ Pausa]` |
| **STALLED** | dark + ambra wash | 🟡 Stalled | freeze | live | `[↻ Forza recovery]` |
| **FAILED** | dark + red wash | 🔴 Failed | last error | persist | `[↻ Riprova batch]` `[↻ Solo doc fallit]` |
| **REVIEW REQUIRED** | dark + purple wash | 🟣 Review | recap | mandatory | `[→ APRI REVIEW WORKSPACE™]` |
| **CERTIFIED** | dark + teal glow | 🟢 Certified ✨ | recap | hidden | `[🚀 OPEN LAUNCHPAD →]` |

---

## 6. Priorità implementativa

Ordine consigliato (dopo approvazione visuale). **Tutte le sezioni sono indipendenti** e possono essere rilasciate incrementalmente.

| Priorità | Item | Effort | Rationale |
|---|---|---|---|
| 🔴 **P0** | Hot-fix DB · sblocco RIVA1920 (script SQL §3.1 diagnostic) | 5 min | sblocca l'utente subito |
| 🔴 **P0** | Migrazione `trigger_extraction` su ITER197 persistent job | 1 sprint | elimina la causa primaria del bug |
| 🟠 **P1** | Endpoint `/worker-status` + Knowledge Engine Status pill | 1 sprint | dà liveness reale all'utente |
| 🟠 **P1** | Endpoint `/warning-breakdown` + Warning Center 7 categorie | 1 sprint | rende ogni warning cliccabile, no più "Necessita controllo" generico |
| 🟠 **P1** | Document Queue actions [OPEN][REVIEW][RETRY] cablate | 1 sprint | nessuna riga morta |
| 🟡 **P2** | Tabella `extraction_event_log` + endpoint `/live-stream` + Live Activity Stream component | 1.5 sprint | dà "il motore è vivo" visivamente |
| 🟡 **P2** | KPI live deltas (riuso polling esistente, delta client-side) | 0.5 sprint | nudge psicologico, non blocca workflow |
| 🟢 **P3** | Endpoint `/recover` + bottone Force Recovery | 0.5 sprint | utile ma raro se P0 architettura applicata |
| 🟢 **P3** | Wireframe high-fidelity HTML/CSS della Control Room (chiamata design agent) | 0.5 sprint | solo se serve confronto visivo prima del React |

### 6.1 Note rischio

- L'integrazione `trigger_extraction` ↔ ITER197 richiede di mantenere backward-compat con `_run_set_extraction` (rinominarlo `_run_set_extraction_inner` e wrapparlo). Test E2E obbligatorio.
- `extraction_event_log` può esplodere su set da 1.000+ pagine. Soluzione: index + TTL retention 7 giorni (cron Apache già attivo).
- Live Stream via polling vs SSE: polling 2s è sufficiente per V1; SSE solo se l'utente lamenta lag.

---

## 7. Coerenza con V3.1 implementato

La Control Room **non sostituisce** il Review Workspace™ V3.1 — lo **precede**:

```
[Catalog Set Detail Page]
   ├── Section 1 · Upload PDFs               (esistente)
   ├── Section 2 · Extraction Control Room   ← QUESTA PROPOSTA
   └── Section 3 · Review Workspace™ V3.1    (esistente, sblocca quando warnings > 0)
```

La sezione 2 attualmente è una semplice "ExtractionPanel" che mostra percentuale + lista doc. Va sostituita con il Control Room layout descritto qui.

La sezione 3 (V3.1) resta invariata: viene attivata dal Warning Center con filtri pre-applicati.

---

## 8. Deliverable richiesto (per il prossimo sprint)

Quando questa proposta sarà approvata:

1. **Design agent** produrrà mockup high-fidelity di `control-room-desktop.html` + `control-room-mobile.html` con tutti i 6 stati visuali (§5) e i 3 elementi maggiori (Worker Status, Live Stream, Warning Center).
2. **Backend**: migration `130_control_room.sql` (solo `extraction_event_log`) + nuovo router `routers/extraction_control_room.py` (3 endpoint additivi).
3. **Backend**: refactor del trigger legacy → ITER197 wiring.
4. **Frontend**: nuovo modulo `components/control-room/` con i componenti `WorkerStatus.jsx`, `LiveActivityStream.jsx`, `ExtractionKPI.jsx`, `WarningCenter.jsx`, `DocumentQueue.jsx` + integrazione in `CatalogSetWorkspacePage.jsx`.
5. **Pytest + Playwright E2E**: simulazione di crash worker + recovery automatico < 2min.
6. **No regressione** del flusso Upload (sezione 1) e Review Workspace (sezione 3).

---

## 9. Quel che NON è incluso (per evitare scope creep)

- ❌ Server-Sent Events / WebSocket (polling 2s è sufficient nel V1)
- ❌ Notifiche push verso device esterni quando worker stalled (può andare in backlog M4)
- ❌ Dashboard cross-tenant per amministratori MOOD (out-of-scope di questo control room per-tenant)
- ❌ Tuning Vision Layer 2 / retry strategy / rate-limit Anthropic (problema separato di pipeline, non UX)
- ❌ Persistent Project Impact / Future Uses (già coperti dal V3.1)

---

## 10. Sign-off richiesto

Prima di passare all'implementazione (sprint a parte), conferma:

1. ✅ Layout 4-blocchi desktop (Worker · KPI · Live Stream · Warning · Queue · Atlas footer) ?
2. ✅ Status pill a 7 stati (idle / active / stalled / stalled_recovery / failed / review_required / certified) ?
3. ✅ Categorie del Warning Center (7 categorie elencate in §2.4) ?
4. ✅ Document Queue con `[OPEN][REVIEW][RETRY]` per riga ?
5. ✅ Migrazione `trigger_extraction` → ITER197 come priorità P0 architetturale ?

Una volta approvato, lo sprint successivo apre con il design agent per i mockup HTML/CSS e poi React.
