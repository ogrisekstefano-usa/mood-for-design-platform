# DISCOVERY CONSOLIDATION REPORT
> Data: 08 Feb 2026 | Sprint: Post-Certification Consolidation P1

---

## TABELLA ANALIZZATA: `discovery_interviews`

- **Righe totali**: 12
- **Collegata a**: `leads.id` (lead_id FK)
- **Status values**: `qualified` (10), `in_progress` (1), `pending` (1)
- **Source values**: `public_form` (10), `showroom` (2)

---

## ANALISI DEI DATI COLONNA PER COLONNA

### Campi ALWAYS NULL (mai scritti)

| Colonna | % Non-null | Classificazione |
|---------|-----------|----------------|
| `conducted_by` | 0% | ⛔ **DEPRECATE** — mai valorizzato |
| `disqualification_reason` | 0% | ⛔ **DEPRECATE** — tutti qualified |
| `recording_url` | 0% | ⛔ **DEPRECATE** — mai registrato |

### Campi SPARSE (< 20%)

| Colonna | % Non-null | Contenuto | Classificazione |
|---------|-----------|-----------|----------------|
| `started_at` | 16% | Timestamp inizio colloquio | ⚠️ **KEEP** (showroom only) |
| `notes` | 8% | Note libere designer | ⚠️ **KEEP** (showroom only) |

### Campi USATI (> 20%)

| Colonna | % Non-null | Contenuto | Classificazione |
|---------|-----------|-----------|----------------|
| `id` | 100% | PK | ✅ KEEP |
| `tenant_id` | 100% | FK tenant | ✅ KEEP |
| `lead_id` | 100% | FK leads | ✅ KEEP |
| `status` | 100% | qualified/in_progress/pending | ✅ KEEP |
| `source` | 100% | public_form/showroom | ✅ KEEP |
| `completed_at` | 83% | Timestamp completamento | ✅ KEEP |
| `qualification_signals` | 91% | JSONB con dati di qualifica | Vedi sotto |
| `metadata_json` | 100% | JSONB con metadati | Vedi sotto |
| `created_at` | 100% | Timestamp creazione | ✅ KEEP |
| `updated_at` | 100% | Timestamp aggiornamento | ✅ KEEP |

---

## ANALISI `qualification_signals` (JSONB)

| Key | Presente | Contenuto | Dove è duplicato | Classificazione |
|-----|----------|-----------|------------------|----------------|
| `journey_id` | 10/12 | UUID del design_journey creato | `design_journeys.id` (FK) | ♻️ **DUPLICATO** |
| `source_path` | 10/12 | Path di onboarding (`/begin-journey`) | `leads.onboarding_path`, `leads.source` | ♻️ **DUPLICATO** |
| `auto_qualified` | 10/12 | `true`/`false` | Implicito in `leads.progression_state` | ♻️ **DUPLICATO** |
| `rooms` | 1/12 | Es. `["living", "bedroom"]` | `journey_briefs.closed_answers.sections.project.rooms` | ♻️ **DUPLICATO** |
| `style` | 1/12 | Es. `"warm_minimal"` | `journey_briefs.closed_answers.sections.atmosphere` | ♻️ **DUPLICATO** |
| `budget` | 1/12 | Range budget | `leads.budget_range`, `journey_briefs.closed_answers` | ♻️ **DUPLICATO** |
| `timing` | 1/12 | Timeline progetto | `leads.timeline`, `journey_briefs.closed_answers` | ♻️ **DUPLICATO** |

**Conclusione `qualification_signals`**: 100% dei dati è duplicato in `design_journeys`, `leads`, o `journey_briefs`. **Nessun dato esclusivo.**

---

## ANALISI `metadata_json` (JSONB)

| Key | Contenuto | Classificazione |
|-----|-----------|----------------|
| `account_id` | UUID dell'account creato | ♻️ **DUPLICATO** — `accounts.id` esiste |
| `auto` | boolean auto-qualifica | ♻️ **DUPLICATO** |
| `entry_path` | Es. `/begin-journey` | ♻️ **DUPLICATO** — `leads.onboarding_path` |

**Conclusione `metadata_json`**: 100% duplicato. **Nessun dato esclusivo.**

---

## CHI LEGGE DISCOVERY_INTERVIEWS?

### Backend (attivo)
| File | Riga | Utilizzo | Impact |
|------|------|----------|--------|
| `discovery.py` | 68,80,160,188,213,387,437,460 | CRUD showroom flow | **Showroom CRM interno** — ancora utile |
| `account_journeys.py` | 92 | INSERT discovery_interview quando journey creato | Scrive senza mai rileggere |
| `leads.py` | 215, 498 | INSERT discovery_interview alla creazione lead | Scrive senza mai rileggere |
| `journey_initiate.py` | 530-553 | INSERT backfill discovery_interview dal public form | Scrive senza mai rileggere — **RIDONDANTE** |

### Frontend (attivo)
| File | Utilizzo |
|------|----------|
| `AccountDetailPage.jsx:40` | Usa `discovery_interview` come tipo di activity nel timeline |
| `useDiscoveryProgress.js` | Hook per showroom CRM flow (non usato nel main UI) |

---

## CLASSIFICAZIONE DATI

### KEEP
- `status`, `source`, `completed_at`, `started_at`, `notes`, `lead_id`, `tenant_id`
- Tutto il flow `discovery.py` (showroom CRM)
- La tabella stessa — non eliminare

### MERGE INTO JOURNEY (già fatto, smettere di duplicare)
- `qualification_signals.journey_id` → già in `design_journeys.id`
- `qualification_signals.rooms/style/budget/timing` → già in `journey_briefs.closed_answers`
- `metadata_json.account_id` → già in `accounts.id`

### DEPRECATE (smettere di scrivere)
- `conducted_by` — mai valorizzato
- `disqualification_reason` — mai valorizzato
- `recording_url` — mai valorizzato
- INSERT da `journey_initiate.py:530-553` (backfill dal public form — ridondante)
- INSERT da `leads.py:215,498` (write-only, mai letto)
- INSERT da `account_journeys.py:92` (write-only, mai letto)

---

## RACCOMANDAZIONI PRIORITIZZATE

### P1 — Rimuovere backfill write-only da begin_journey_ritual

**File**: `journey_initiate.py:530-553`  
**Azione**: Eliminare il blocco `try: c.table("discovery_interviews").insert(...)` dal path `/begin-journey`.  
**Impatto**: Zero — nessun consumer legge questi records.  
**Benefit**: Elimina una scrittura ridondante e rafforza `journey_briefs` come SSoT del brief.

### P2 — Stop write da leads.py

**File**: `leads.py:215,498`  
**Azione**: Rimuovere INSERT `discovery_interviews` dalla lead creation.  
**Note**: I leads creati da showroom possono ancora creare discovery_interviews via `discovery.py`.

### P3 — Pulizia colonne ALWAYS NULL

Non richiede DROP COLUMN (lasciare per retrocompatibilità). Solo smettere di includerle in nuove query.

---

## DIPENDENZA CRITICA

`discovery_interviews` è ancora necessaria per il **Showroom CRM** (`discovery.py`). **Non eliminare la tabella.**

Per il percorso `begin_journey_ritual` (public form), il dato rilevante è già in `journey_briefs.closed_answers`. Il record `discovery_interview` creato da questo path è ridondante al 100%.

---

## SCHEMA DATI UNICI (non duplicati altrove)

Dopo l'analisi, i **soli dati esclusivi** in `discovery_interviews` sono:

1. `notes` — note libere del designer durante colloquio showroom (non in nessun altro posto)
2. `started_at` — momento preciso inizio colloquio (non in nessun altro posto)

Tutto il resto è duplicato. La tabella vale il suo mantenimento SOLO per il showroom flow.

