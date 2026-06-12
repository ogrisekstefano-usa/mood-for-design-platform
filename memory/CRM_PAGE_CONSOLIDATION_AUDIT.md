# CRM PAGE CONSOLIDATION AUDIT
> Data: 08 Feb 2026 | Sprint: Lifecycle Canonicalization P1
> Nota: Questo documento è OUTPUT della FASE 2 — solo audit, NESSUN codice

---

## PAGINE ANALIZZATE

### 1. LEADS PAGE (`/relations/leads`)

| Aspetto | Stato attuale |
|---------|--------------|
| **Component** | `LeadsPage.jsx` |
| **API** | `GET /api/relations/leads` |
| **Backend** | `client_relations.py:_list_leads_by_state()` |
| **Legge da** | `leads` table |
| **Filtro principale** | `leads.progression_state = 'lead'` |
| **Legge da design_journeys?** | ❌ NO — non tocca `design_journeys` |
| **Legge da accounts?** | ❌ NO |
| **Enrichment journey** | ❌ Nessuno — mostra solo dati `leads` |

**Obiettivo dichiarato**: Journey WHERE lifecycle_state='lead'

**Gap**: La Leads Page legge da `leads.progression_state='lead'` — NON da `design_journeys.lifecycle_state='lead'`. Fino a quando `design_journeys.lifecycle_state` non verrà scritto come `'lead'` alla creazione, le due viste sono identiche numericamente ma concettualmente diverse.

**Incoerenza**: 14 leads hanno `progression_state='lead'`, ma 18 design_journeys esistono con `lifecycle_state='conversation_open'`. C'è un disallineamento di 4 unità.

---

### 2. PROSPECTS PAGE (`/relations/prospects`)

| Aspetto | Stato attuale |
|---------|--------------|
| **Component** | `ProspectsPage.jsx` |
| **API** | `GET /api/relations/prospects` |
| **Backend** | `client_relations.py:_list_prospects_from_accounts()` |
| **Legge da** | `accounts` table (PRIMARY) + `design_journeys` (ENRICHMENT) |
| **Filtro principale** | `accounts.lifecycle_stage = 'prospect'` |
| **Legge da design_journeys?** | ⚠️ PARZIALE — per enrichment `journey_lifecycle_state` |
| **Legge da accounts?** | ✅ SÌ — è il filtro primario |
| **Enrichment journey** | `journey_lifecycle_state`, `project_id`, `current_milestone_id` |

**Obiettivo dichiarato**: Journey WHERE lifecycle_state='prospect'

**Gap attuale**: Filtra per `accounts.lifecycle_stage='prospect'` ma mostra `journey_lifecycle_state` (che è sempre `conversation_open`). Due stati coesistono sulla stessa card senza indicare quale è autoritativo.

**Incoerenza**: `accounts.lifecycle_stage='prospect'` (14 accounts) vs `design_journeys.lifecycle_state='conversation_open'` (18 journeys). Non coincidono.

---

### 3. ACCOUNTS PAGE (`/relations/accounts`)

| Aspetto | Stato attuale |
|---------|--------------|
| **Component** | `AccountsPage.jsx` |
| **API** | `GET /api/relations/accounts` |
| **Backend** | `client_relations.py:list_accounts()` |
| **Legge da** | `accounts` table (PRIMARY) + `design_journeys` (ENRICHMENT) |
| **Filtro principale** | `accounts.lifecycle_stage IN ('prospect', 'customer', ...)` |
| **Legge da design_journeys?** | ⚠️ PARZIALE — per enrichment `journey_lifecycle_state` |
| **Legge da accounts?** | ✅ SÌ — è il filtro primario |
| **Enrichment journey** | `journey_lifecycle_state`, `project_id` |

**Obiettivo dichiarato**: Journey WHERE lifecycle_state IN ('customer','active')

**Gap attuale**: Filtra per `accounts.lifecycle_stage` con valori come `prospect`, `active` (NON `customer`). La semantica è diversa dagli stati Journey richiesti.

**Nota**: `AccountsPage.jsx:177` usa `isProspectStage(a.lifecycle_stage)` e `:195` usa `isCustomerStage(a.lifecycle_stage)` — funzioni che mappano `accounts.lifecycle_stage` values, non `design_journeys.lifecycle_state` values.

---

## MAPPA INCOERENZE

```
PAGINA        FILTRA PER              DOVREBBE FILTRARE PER
──────────────────────────────────────────────────────────────
Leads         leads.progression_state  design_journeys.lifecycle_state='lead'
Prospects     accounts.lifecycle_stage design_journeys.lifecycle_state='prospect'
Accounts      accounts.lifecycle_stage design_journeys.lifecycle_state='active'/'customer'
```

### Perché non è ancora un P0 critico per gli utenti

I valori semantici si allineano accidentalmente:
- `leads.progression_state='lead'` ≈ "journey in fase lead"
- `accounts.lifecycle_stage='prospect'` ≈ "journey in fase prospect"
- `accounts.lifecycle_stage='active'` ≈ "journey in fase active"

Ma sono due sistemi che convergono per coincidenza, non per design. Un cambiamento in uno non propaga all'altro.

---

## SCHEMA DEL CONSOLIDAMENTO POST P0-1

Una volta che `design_journeys.lifecycle_state` avanza correttamente:

```python
# client_relations.py — DOPO P0-1

def _list_leads_from_journeys(tenant_id, ...):
    # INVECE di leads.progression_state='lead'
    c.table('design_journeys').select('...').eq('lifecycle_state', 'lead')

def _list_prospects_from_journeys(tenant_id, ...):
    # INVECE di accounts.lifecycle_stage='prospect'
    c.table('design_journeys').select('...').eq('lifecycle_state', 'prospect')

def _list_accounts_from_journeys(tenant_id, ...):
    # INVECE di accounts.lifecycle_stage in various
    c.table('design_journeys').select('...').in_('lifecycle_state', ['active', 'waiting_client', 'customer'])
```

Questo richiede che `design_journeys` contenga tutti i dati necessari per hydratare le card (account_name, email, project_id). Verifica: `design_journeys` ha `account_id` → JOIN `accounts` → ha tutti i dati necessari.

---

## STATO DELLA CONVERGENZA

| Componente | Convergenza attuale | Convergenza target |
|-----------|--------------------|--------------------|
| Leads Page | 0% — reads leads | 100% — reads design_journeys |
| Prospects Page | 30% — reads accounts + enriches with journeys | 100% — reads design_journeys |
| Accounts Page | 30% — reads accounts + enriches with journeys | 100% — reads design_journeys |
| Client Portal | 70% — reads design_journeys directly | 90% (messaging gap) |
| Notification System | 80% — uses journey context | 90% |

**MEDIA CONVERGENZA SISTEMA: ~46%**

