# LIFECYCLE CONSOLIDATION AUDIT
> Data: 08 Feb 2026 | Sprint: Post-Certification Consolidation P1  
> Dati freschi da DB live — 18 journeys, 18 accounts, 14 leads

---

## OBIETTIVO

Identificare la **singola verità canonica** per il lifecycle di un cliente.

---

## INVENTARIO DEI CAMPI LIFECYCLE

### A — `leads.pipeline_stage`

| Campo | `pipeline_stage` |
|-------|-----------------|
| Tabella | `leads` |
| Tipo | `TEXT` |
| Valori in produzione | `lead_captured` (1), `prospect_initial_brief` (9), `active` (4) |
| Copertura | 100% non-null (14/14 leads) |
| **Scritto da** | `journey_initiate.py:470,511` · `lead_intake.py:163` · `lead_conversion.py:79,235` · `leads.py:462` |
| **Letto da** | `lead_conversion.py:78` (1 check per promozione automatica) |
| Frontend consumer | **ZERO** — nessuna pagina frontend usa questo campo |
| Conflitto | Coesiste con `leads.progression_state` che serve la stessa funzione per le API CRM |
| **Classificazione** | ⛔ **LEGACY** — scritto ovunque, letto quasi da nessuno |

---

### B — `leads.progression_state`

| Campo | `progression_state` |
|-------|---------------------|
| Tabella | `leads` |
| Tipo | `TEXT` |
| Valori in produzione | `lead` × 14 — **tutti identici** |
| Copertura | 100% non-null (14/14 leads) |
| **Scritto da** | `client_relations.py:promote` (endpoint promozione) |
| **Letto da** | `client_relations.py:_list_leads_by_state()` → `eq('progression_state', state)` |
| Frontend consumer | `LeadsPage.jsx` → `GET /api/relations/leads` → filtra per `progression_state='lead'` |
| Conflitto | Tutti i 14 lead hanno `progression_state='lead'` anche se `pipeline_stage='active'`. Non si sincronizzano. |
| **Classificazione** | ✅ **CANONICAL** per il layer lead — ma mai aggiornato dopo la promozione |

---

### C — `accounts.lifecycle_stage`

| Campo | `lifecycle_stage` |
|-------|-------------------|
| Tabella | `accounts` |
| Tipo | `TEXT` |
| Valori in produzione | `prospect` (14 accounts) · `active` (4 accounts) |
| Copertura | 100% non-null (18/18 accounts) |
| **Scritto da** | `discovery.py:106,122` · `account_lifecycle.py:161,248` · `editorial.py:649` |
| **Letto da** | `client_relations.py` → filtra per `lifecycle_stage` in tutte le CRM views |
| Frontend consumer | `ProspectsPage.jsx` · `AccountsPage.jsx` · `CrmAccountsPage.jsx:239,271` · `RelationshipsPage.jsx:35-42` |
| Conflitto | Usa valori propri (`prospect`/`active`) NON allineati agli stati Journey canonici richiesti. Entità separata da `design_journeys`. |
| **Classificazione** | ✅ **CANONICAL** per Prospect/Account — de facto SSoT del CRM oggi |

---

### D — `design_journeys.lifecycle_state`

| Campo | `lifecycle_state` |
|-------|-------------------|
| Tabella | `design_journeys` |
| Tipo | `TEXT` |
| Valori in produzione | `conversation_open` × 18 — **TUTTI i 18 journey hanno lo stesso stato** |
| Copertura | 100% non-null |
| **Scritto da** | `journey_initiate.py:164` · `design_journey.py:164` — SOLO alla creazione |
| **Letto da** | `client_relations.py:123,344` (enrichment badge) · `client_portal.py:496,713` (guard) · `dashboard_snapshot.py:130-132` (filtro stagnanti) |
| Frontend consumer | `StepContextHeader.jsx:59` · `ActiveJourneyRail.jsx:59` · `ProspectsPage.jsx:71` (badge decorativo) |
| **STATO CRITICO** | ❌ Non avanza MAI. Campo inteso come SSoT ma mai aggiornato dopo la creazione. |
| **Classificazione** | 🎯 **DESIGNED CANONICAL — NON IMPLEMENTATO** |

---

### E — `accounts.relationship_journey_stage`

| Campo | `relationship_journey_stage` |
|-------|------------------------------|
| Valori in produzione | **NULL** × 18 — mai scritto |
| **Classificazione** | ⛔ **DEPRECATED** — eliminare da query, non rimuovere colonna |

---

## SPLIT-BRAIN ATTUALE

```
DATO                                  CONSUMER CRM
──────────────────────────────────────────────────────
leads.progression_state               LeadsPage → mostra Lead
accounts.lifecycle_stage              ProspectsPage → mostra Prospect
accounts.lifecycle_stage              AccountsPage → mostra Account/Customer
design_journeys.lifecycle_state       Badge decorativo (sempre 'conversation_open')
──────────────────────────────────────────────────────

SINGOLA VERITÀ CANONICA OGGI: accounts.lifecycle_stage
SINGOLA VERITÀ CANONICA PROGETTATA: design_journeys.lifecycle_state
```

**Il sistema OGGI è governato da `accounts.lifecycle_stage`, NON da `design_journeys.lifecycle_state`.**

---

## MAPPA STATI RICHIESTI vs IMPLEMENTAZIONE ATTUALE

| Stato richiesto | `design_journeys.lifecycle_state`? | Stato corrispondente oggi |
|----------------|-------------------------------------|--------------------------|
| `lead` | ❌ Mai scritto | `leads.progression_state='lead'` |
| `prospect` | ❌ Mai scritto | `accounts.lifecycle_stage='prospect'` |
| `active` | ❌ Mai scritto | `accounts.lifecycle_stage='active'` |
| `waiting_client` | ❌ Mai scritto | Nessuna rappresentazione |
| `customer` | ❌ Mai scritto | `accounts.lifecycle_stage='customer'` (account_lifecycle.py) |
| `completed` | ❌ Mai scritto | `design_journeys.overall_status` (non verificato) |
| `archived` | ❌ Mai scritto | Nessuna rappresentazione |

**Tutti i 7 stati del modello canonico richiesto NON sono scritti nel campo dedicato.**

---

## PERCORSO DI CONVERGENZA

### Requisiti tecnici

1. Nessuna nuova tabella richiesta
2. Nessun nuovo endpoint richiesto
3. Solo aggiornamento dei punti di scrittura esistenti

### Azioni per la SSoT

```
TRIGGER ESISTENTE                           ACTION DA AGGIUNGERE
────────────────────────────────────────────────────────────────
journey_initiate.py:164                  → scrivere lifecycle_state='lead'
client_relations.py:promote endpoint    → scrivere lifecycle_state='prospect'
concept_directions.py:share_concept_set → scrivere lifecycle_state='active'
account_lifecycle.py:convert_to_customer → scrivere lifecycle_state='customer'
design_journey.py:close_journey          → scrivere lifecycle_state='completed'
```

### Post-convergenza: CRM filter

Una volta che `design_journeys.lifecycle_state` avanza:

```
LeadsPage     → design_journeys WHERE lifecycle_state='lead'
ProspectsPage → design_journeys WHERE lifecycle_state='prospect'
AccountsPage  → design_journeys WHERE lifecycle_state IN ('active','waiting_client','customer')
```

---

## VERDETTO LIFECYCLE

```
SSoT OGGI:       accounts.lifecycle_stage (CANONICAL per CRM)
SSoT PROGETTATA: design_journeys.lifecycle_state (STUCK a conversation_open)
CONVERGENZA:     46%
```

**Azione P0**: Scrivere `lifecycle_state` nei 5 punti di transizione esistenti.  
**File modificati**: 4 router, ~20 righe, zero nuove tabelle, zero nuovi endpoint.

