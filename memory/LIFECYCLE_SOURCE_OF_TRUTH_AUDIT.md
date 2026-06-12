# LIFECYCLE SOURCE OF TRUTH AUDIT
> Data: 08 Feb 2026 | Agente: E1 | Sprint: Lifecycle Canonicalization

---

## MAPPA COMPLETA DEI LIFECYCLE STATE FIELDS

### 1. `leads.pipeline_stage`

**Classificazione: LEGACY**

| Aspetto | Dettaglio |
|---------|-----------|
| Tabella | `leads` |
| Valori in produzione | `lead_captured` (1), `prospect_initial_brief` (9), `active` (4) |
| Scritto da | `leads.py:462`, `journey_initiate.py:470+511`, `lead_intake.py:163`, `lead_conversion.py:79+235` |
| Letto da | `lead_conversion.py:78` (check per auto-promozione) |
| Frontend consumer | **NESSUNO** — nessuna pagina frontend legge questo campo direttamente |
| Funzione business | Traccia lo stadio del lead nel vecchio CRM funnel |
| Conflitto | Coesiste con `leads.progression_state` che serve la stessa funzione per le API |
| Stato | **LEGACY** — scritto ma mai consumato dai client CRM pages |

---

### 2. `leads.progression_state`

**Classificazione: CANONICAL (per il layer Lead)**

| Aspetto | Dettaglio |
|---------|-----------|
| Tabella | `leads` |
| Valori in produzione | `lead` (TUTTI i 14 lead hanno `progression_state='lead'`) |
| Scritto da | `client_relations.py:promote` (endpoint di promozione) |
| Letto da | `client_relations.py:_list_leads_by_state()` → `eq('progression_state', state)` |
| Frontend consumer | `LeadsPage.jsx` → `GET /api/relations/leads` → filtra per `progression_state='lead'` |
| Funzione business | Filtra quali lead appaiono nella CRM Leads page |
| Conflitto | Tutti i 14 lead hanno `progression_state='lead'` anche quelli con `pipeline_stage='active'` — non si sincronizzano |
| Stato | **CANONICAL** per il layer lead, ma disallineato con `pipeline_stage` |

---

### 3. `accounts.lifecycle_stage`

**Classificazione: CANONICAL (per il layer Prospect/Account)**

| Aspetto | Dettaglio |
|---------|-----------|
| Tabella | `accounts` |
| Valori in produzione | `prospect` (14), `active` (4) — totale 18 accounts |
| Scritto da | `discovery.py:106,122`, `account_lifecycle.py:161,248`, `editorial.py:649` |
| Letto da | `client_relations.py/prospects` → `eq('lifecycle_stage', 'prospect')`, `client_relations.py/accounts` → filter su stage |
| Frontend consumer | `ProspectsPage.jsx` (via `/api/relations/prospects`), `AccountsPage.jsx` (via `/api/relations/accounts`), `CrmAccountsPage.jsx:239,271`, `RelationshipsPage.jsx:35-42` |
| Funzione business | Determina quale CRM view mostra un client (Prospects vs Accounts) |
| Conflitto | Usa valori `prospect`/`active` che NON mappano direttamente agli stati canonici richiesti (`lead→prospect→customer→completed`) |
| Stato | **CANONICAL** per Prospect/Account, ma modello separato dalla Journey |

---

### 4. `design_journeys.lifecycle_state`

**Classificazione: PARTIALLY CANONICAL — STUCK**

| Aspetto | Dettaglio |
|---------|-----------|
| Tabella | `design_journeys` |
| Valori in produzione | `conversation_open` × 18 — **TUTTI e 18 i journey hanno lo stesso stato** |
| Scritto da | `journey_initiate.py:164` ("conversation_open"), `design_journey.py:164` ("conversation_open") |
| Letto da | `client_relations.py:123,344` (solo per enrichment), `client_portal.py:496,713`, `dashboard_snapshot.py:130-132` |
| Frontend consumer | `ProspectsPage.jsx:71` (mostra `journey_lifecycle_state`), `AccountsPage.jsx:101-103` (mostra `journey_lifecycle_state`), `StepContextHeader.jsx:59`, `ActiveJourneyRail.jsx:59`, `JourneyPulsePage.jsx:167` |
| Funzione business | **Dovrebbe** essere la SSoT del ciclo di vita cliente, ma è sempre `conversation_open` |
| Conflitto | Non avanza mai. Valore costante. CRM pages lo mostrano come "decorazione" sopra `accounts.lifecycle_stage` |
| Stato | **DESIGNED CANONICAL — NOT IMPLEMENTED**. Il campo c'è, le query giuste ci sono, ma il ciclo di vita non avanza mai oltre `conversation_open` |

---

## MAPPA DEI CONFLITTI

```
DATO SCRITTO                     DATO LETTO            CONSUMER
─────────────────────────────────────────────────────────────────────
leads.pipeline_stage             NESSUNO               CRM frontend
leads.progression_state          client_relations      LeadsPage
accounts.lifecycle_stage         client_relations      ProspectsPage, AccountsPage
design_journeys.lifecycle_state  [solo enrichment]     badge decorativi
─────────────────────────────────────────────────────────────────────
```

### SPLIT-BRAIN ATTIVO

**Domanda**: Chi decide se un client è "Prospect" o "Account"?
**Risposta attuale**: `accounts.lifecycle_stage` — non `design_journeys.lifecycle_state`

**Domanda**: Quando il Journey avanza da Discover a Inspire, cambia qualcosa nel CRM?
**Risposta attuale**: **NO** — `design_journeys.lifecycle_state` rimane `conversation_open`

---

## CLASSIFICAZIONE COMPLETA

| Field | File | Endpoint | Frontend | Funzione | Classificazione |
|-------|------|----------|----------|----------|----------------|
| `leads.pipeline_stage` | `leads.py`, `journey_initiate.py` | `POST /initiate` | Nessuno | Vecchio funnel | **LEGACY** |
| `leads.progression_state` | `client_relations.py` | `GET /relations/leads` | `LeadsPage` | Filtra lead view | **CANONICAL** |
| `accounts.lifecycle_stage` | `discovery.py`, `account_lifecycle.py` | `GET /relations/prospects` `GET /relations/accounts` | `ProspectsPage` `AccountsPage` | Separa Prospect da Account | **CANONICAL** |
| `design_journeys.lifecycle_state` | `journey_initiate.py` `design_journey.py` | `GET /journeys/mine` | `StepContextHeader` `ActiveJourneyRail` | SSoT intesa ma non implementata | **DESIGNED CANONICAL — STUCK** |
| `discovery_interviews.status` | `discovery.py` `leads.py` | Vari | Nessuno diretto | Audit trail | **LEGACY** |
| `accounts.relationship_journey_stage` | `accounts` table | Nessuno | `AccountsPage:103` (fallback) | Stage CRM vecchio | **DEPRECATED** |

