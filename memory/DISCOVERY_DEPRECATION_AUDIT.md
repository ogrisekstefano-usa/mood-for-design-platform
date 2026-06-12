# DISCOVERY DEPRECATION AUDIT
> Data: 08 Feb 2026 | Sprint: Lifecycle Canonicalization P1

---

## TABELLA: `discovery_interviews`

### Schema

```sql
id, tenant_id, lead_id, status, source, started_at, completed_at,
conducted_by, notes, qualification_signals (JSONB), disqualification_reason,
recording_url, metadata_json (JSONB), created_at, updated_at
```

**Nota**: NON ha colonna `journey_id`, `account_id`. Collegamento al Journey: solo via `qualification_signals.journey_id` (JSON string, non FK).

---

## VOLUME

- **12 righe totali** in produzione
- Tutti collegati a `leads.id`
- `status` values: `qualified` (10), `in_progress` (1), `pending` (1)
- `source` values: `public_form` (10), `showroom` (2)

---

## ANALISI DATO PER DATO

### `qualification_signals` keys

| Key | Presenti in | Presente in Journey/Brief? | Classificazione |
|-----|-------------|---------------------------|----------------|
| `journey_id` | 10/12 righe | `design_journeys.id` (FK) | **DUPLICATO** — è il journey_id, già in `design_journeys` |
| `source_path` | 10/12 righe | `leads.source` / `leads.onboarding_path` | **DUPLICATO** |
| `auto_qualified` | 10/12 righe | `leads.progression_state` / logic | **DERIVATO** |
| `rooms` | 1/12 | `leads.closed_answers` / `journey_briefs.closed_answers` | **PARZIALMENTE DUPLICATO** |
| `style` | 1/12 | `leads.atmosphere_signals`, `journey_briefs.atmosphere_signals` | **PARZIALMENTE DUPLICATO** |
| `budget` | 1/12 | `leads.budget_range`, `journey_briefs.closed_answers.welcome.investment_range` | **PARZIALMENTE DUPLICATO** |
| `timing` | 1/12 | `leads.timeline`, `journey_briefs.closed_answers.welcome.timeline` | **PARZIALMENTE DUPLICATO** |

### `metadata_json` keys

| Key | Valore | Classificazione |
|-----|--------|----------------|
| `account_id` | UUID account | **DUPLICATO** — già in `accounts.id` |
| `auto` | boolean | **DEPRECATO** — flag di processing non più rilevante |
| `entry_path` | string | **DUPLICATO** — `leads.onboarding_path` |

---

## CHI LEGGE DISCOVERY_INTERVIEWS?

### Backend
| File | Utilizzo | Business impact |
|------|----------|----------------|
| `account_journeys.py:92` | `INSERT` discovery_interview quando journey creato | Scrive, non legge logicamente |
| `leads.py:215,498` | `INSERT` discovery_interview alla lead creation | Scrive, non legge |
| `journey_initiate.py:532` | `INSERT` discovery_interview come backfill audit | Scrive, non legge |
| `discovery.py:68,80,160,188,213,387,437,460` | CRUD discovery interview (showroom flow) | Solo showroom CRM interno |

### Frontend
| File | Utilizzo |
|------|----------|
| `AccountDetailPage.jsx:40,52` | `discovery_interview` come icona/label per timeline activity type |
| `useDiscoveryProgress.js` | Hook che legge progress di un discovery_interview per showroom CRM |

**Conclusione**: `discovery_interviews` è consumato solo dal **Showroom CRM** interno (vecchio flow `discovery.py`). Il `begin_journey_ritual` scrive records ma NON li legge mai — li crea solo come audit trail.

---

## DATI UNICI (non duplicati altrove)

1. `notes` — note libere del designer durante la discovery (showroom only) — UNICO
2. `conducted_by` — chi ha condotto il colloquio — UNICO (ma nessuno legge questo)
3. `recording_url` — URL recording — UNICO (sempre null in produzione)
4. `disqualification_reason` — motivo disqualifica — UNICO (sempre null per `qualified`)

**Unici ma mai letti da nessun consumer attivo.**

---

## CLASSIFICAZIONE FINALE

| Dato | Classificazione | Azione |
|------|----------------|--------|
| `qualification_signals.journey_id` | MERGE INTO JOURNEY | Già in `design_journeys.id` — usare direttamente |
| `qualification_signals.source_path` | DEPRECATE | `leads.source` + `leads.onboarding_path` esistono |
| `qualification_signals.auto_qualified` | DEPRECATE | `leads.progression_state` e journey creation già lo implicano |
| `qualification_signals.rooms/style/budget/timing` | MERGE INTO JOURNEY | Già in `journey_briefs.closed_answers` |
| `metadata_json.account_id` | DEPRECATE | `accounts.id` disponibile |
| `notes`, `conducted_by`, `recording_url` | KEEP | Solo per showroom CRM — preservare per retrocompatibilità |
| `status` | KEEP | Utile per showroom flow — `qualified`/`in_progress`/`pending` |
| `source` | KEEP | Distingue `public_form` da `showroom` |

---

## RACCOMANDAZIONE

### Azione immediata (P1)
**Smettere di creare `discovery_interviews` per il public_form flow** (`begin_journey_ritual`).

In `journey_initiate.py:530-553`, rimuovere il backfill insert di `discovery_interviews`. I dati sono già in `journey_briefs`.

### Azione a medio termine (P2)
Mantenere la tabella e gli endpoint `discovery.py` per il Showroom CRM (dove ancora utili), ma aggiungere deprecation notice.

### NON fare
Non eliminare la tabella. Contiene `notes` del showroom che non sono in nessun altro posto.

---

## DIPENDENZA CON DESIGN JOURNEY

Il `discovery_interview.qualification_signals.journey_id` è l'UNICO link dal vecchio sistema al nuovo. Questo link NON è una FK — è un JSON string. Se si consolida `design_journeys` come SSoT, questo link diventa ridondante.

Il percorso `begin_journey_ritual → design_journey` funziona correttamente SENZA `discovery_interviews`. La prova: i 4 lead con `first_journey_id` non hanno `discovery_interviews` associati.

