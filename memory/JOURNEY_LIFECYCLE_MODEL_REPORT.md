# JOURNEY LIFECYCLE MODEL REPORT
> Data: 08 Feb 2026 | Sprint: Lifecycle Canonicalization P1

---

## MODELLO CANONICO RICHIESTO

```
lead → prospect → active → waiting_client → customer → completed → archived
```

---

## VERIFICA SUPPORTO SISTEMA ATTUALE

### Stato scritto oggi

| Stato richiesto | Scritto in `design_journeys.lifecycle_state`? | Alternativa attuale |
|-----------------|----------------------------------------------|---------------------|
| `lead` | ❌ MAI | `leads.progression_state='lead'` + `leads.pipeline_stage='lead_captured'` |
| `prospect` | ❌ MAI | `accounts.lifecycle_stage='prospect'` |
| `active` | ❌ MAI | `accounts.lifecycle_stage='active'` |
| `waiting_client` | ❌ MAI | Nessuna rappresentazione |
| `customer` | ❌ MAI | `accounts.lifecycle_stage='customer'` (in account_lifecycle.py) |
| `completed` | ❌ MAI | `design_journeys.overall_status` (non verificato) |
| `archived` | ❌ MAI | Nessuna rappresentazione |

**UNICO VALORE SCRITTO**: `conversation_open` × 18 (tutti i journey presenti)

---

## DOVE VIENE SCRITTO `lifecycle_state`

```python
# journey_initiate.py:164
"lifecycle_state": "conversation_open"   # scritto alla creazione del journey

# design_journey.py:164
"lifecycle_state": "conversation_open"   # scritto alla creazione manuale del journey
```

**Nessun altro punto nel codebase scrive `design_journeys.lifecycle_state`.**
Non esiste una funzione di transizione di stato. Non esiste un endpoint `PATCH /api/journeys/:id/lifecycle`.

---

## DOVE VIENE LETTO

| File | Contesto | Tipo utilizzo |
|------|----------|---------------|
| `client_relations.py:123,344` | Enrich prospects/accounts con journey state | **Read-for-display** |
| `client_portal.py:496,713` | Check `closed`/`certified_closure` per bloccare accesso | **Business logic** |
| `dashboard_snapshot.py:130-132` | Dashboard: journey stagnanti (≠ `closed`) | **Business logic** |
| `account_journeys.py:110-113` | Verifica journey attivi (ACTIVE_STATES) | **Business logic** |
| `g3_constellation.py:146,274` | Constellation graph | **Display** |

---

## DOVE VIENE DUPLICATO / GENERA CONFLITTI

### Conflitto 1: Prospect identity
- `accounts.lifecycle_stage='prospect'` — il sistema usa questo per decidere chi è Prospect
- `design_journeys.lifecycle_state='conversation_open'` — non comunica se il journey è in fase prospect o meno
- **DUPLICAZIONE FUNZIONALE**: due tabelle cercano di rispondere alla stessa domanda

### Conflitto 2: Active/Customer
- `account_lifecycle.py` promuove `accounts.lifecycle_stage` da `'prospect'` → `'customer'`
- Journey rimane sempre `conversation_open` — non si sincronizza
- Un cliente può essere `customer` in `accounts` ma `conversation_open` nel Journey

### Conflitto 3: Lead stage
- `leads.pipeline_stage='active'` esiste per 4 lead
- Ma `leads.progression_state='lead'` per tutti i 14 lead (inclusi quelli con pipeline_stage='active')
- I 4 lead con `pipeline_stage='active'` hanno `first_journey_id` set, ma lo stato del journey rimane `conversation_open`

---

## ANALISI DI FATTIBILITÀ

### Come dovrebbe funzionare il modello canonico:

```
POST /api/public/journeys/initiate
→ leads.pipeline_stage = 'lead_captured'
→ design_journeys.lifecycle_state = 'lead'          ← MANCANTE

POST /api/relations/{lead_id}/promote (Prospect)
→ accounts.lifecycle_stage = 'prospect'
→ design_journeys.lifecycle_state = 'prospect'      ← MANCANTE

POST /api/journeys/{jid}/concept-directions/{sid}/share
→ design_journeys.lifecycle_state = 'active'        ← MANCANTE

Designer + Cliente completano deliverable
→ account_lifecycle.py convert_to_customer
→ design_journeys.lifecycle_state = 'customer'      ← MANCANTE
```

### Schema support: COMPLETO

La colonna `design_journeys.lifecycle_state` esiste già nel DB (`TEXT`, attualmente solo `conversation_open`).
Non serve alcuna migrazione. Serve solo:
1. Un set di valori canonici concordato
2. PATCH dei punti di scrittura esistenti

---

## RECOMMENDED CANONICAL STATE TRANSITIONS

```
[EVENTO TRIGGER]                    [SCRIVI lifecycle_state]

POST /journeys/initiate             → 'lead'
POST /relations/{id}/promote        → 'prospect'
POST /journeys/{jid}/concept-directions/{sid}/share → 'active'
POST /client/concept-directions/{id}/feedback       → 'waiting_client' (designer attende)
POST /account-lifecycle/{id}/convert-to-customer    → 'customer'
POST /journeys/{jid}/close          → 'completed'
DELETE/archive journey              → 'archived'
```

---

## IMPATTO ATTUALE DEL BUG

Tutti i 18 journey hanno `lifecycle_state='conversation_open'`.
Questo significa che:
- Il badge `journey_lifecycle_state` nelle CRM pages mostra sempre `conversation open` per tutti
- Non è possibile filtrare journey per fase senza usare `accounts.lifecycle_stage` (che è il layer sbagliato)
- Il `next_action` e il `Concept Pulse™` non possono guidare le transizioni di stato
- La SSoT del sistema è de facto `accounts.lifecycle_stage`, non `design_journeys.lifecycle_state`

