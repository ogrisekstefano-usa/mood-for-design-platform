# MODULE CONNECTION AUDIT — DOCUMENTO C: SOURCE OF TRUTH MAP
> Prodotto: 10 Jun 2026 · Audit statico completo del codebase

---

## 1. Source of Truth per Concetto di Business

| Concetto | Source of Truth Dichiarato | Conflitti / Alternative |
|----------|--------------------------|------------------------|
| **Stato pipeline cliente** (lead/prospect/customer) | `accounts.lifecycle_stage` | ⚠️ Conflitto: `leads.progression_state` (legacy), `leads.pipeline_stage`, `leads.status` coesistono. `client_relations.py` stats endpoint chiarisce: il canon è `accounts.lifecycle_stage` |
| **Fase journey** | `design_journeys.lifecycle_state` | ✅ Unica sorgente |
| **Milestone corrente** | `design_journeys.current_milestone_id` | ⚠️ Conflitto: `client_portal.py` usa fallback `next (m for m in milestones if m.get("status") == "in_progress")` se `current_milestone_id` è NULL |
| **Identità cliente** | `accounts.email` | ⚠️ Conflitto: `leads.email`, `contacts.email`, `users_profile.email` — tutti possono divergere se non sincronizzati |
| **Titolo progetto** | `projects.title` | ✅ Unica sorgente, ma generata da 4 template diversi |
| **Stato proposta** | `proposals.status` | ✅ Unica sorgente |
| **Copertura culturale cliente** | `leads.cultural_register`, `leads.atmosphere_signals`, `leads.behavioral_tags` | ⚠️ Conflitto: mirroring parziale in `projects.metadata_json.atmosphere` e `journey_briefs.closed_answers` |
| **Firma proposta** | `accounts.signed_proposal_id` + `proposal_signoffs` | ⚠️ `signed_proposal_id` è colonna recente (Phase 1); storicamente si leggeva solo da `proposals.status` |
| **Accesso portal** | `projects.client_user_id` | ⚠️ Conflitto: `welcome-summary` usa `accounts.email` invece di `client_user_id` — doppia risoluzione (vedi Doc B) |

---

## 2. Stato Pipeline Clienti — Analisi del Conflitto

Il sistema ha **tre rappresentazioni parallele** dello stato pipeline per un cliente:

```
leads.status          = 'new' | 'qualified' | 'contacted' | ...  ← LEGACY
leads.pipeline_stage  = 'lead_captured' | 'prospect' | 'active' | ...  ← TRANSITION
leads.progression_state = 'lead' | 'prospect' | 'account'  ← COMPUTED (da intake signals)

accounts.lifecycle_stage = 'prospect' | 'in_proposal' | 'customer'  ← CANON
```

**Dichiarazione canon** (`client_relations.py` comment §98-100):
> "Single source of truth aligned to the CRM canon (Lead → Prospect → Customer)"
> `lead = leads table count · prospect/customer = accounts.lifecycle_stage`

**Implicazione**: `leads.progression_state` è **legacy**. È ancora usato nei filtri di `client_relations.py` per `/relations/leads` e `/relations/prospects`, ma non è più il source of truth per KPI sidebar.

---

## 3. Percorso di Creazione — Doppio Stato Lead

Il percorso A (`journey_initiate`) crea entità nella seguente sequenza:

```
Step 1: INSERT accounts (lifecycle_stage='prospect') ← SOURCE OF TRUTH
Step 2: INSERT leads    (status='new')               ← retroattivo
Step 3: UPDATE leads    (status='qualified', pipeline_stage='prospect_initial_brief')
```

**Problema**: `leads` viene inserito NON-blocking. Se fallisce, `accounts` esiste ma `leads` no → il CRM mostra 0 lead per quell'account, ma l'account è già `prospect`.

---

## 4. Moodboard — Source of Truth journey vs. project

```
moodboards.project_id  → si usa per /api/moodboards?project_id=X (workspace)
moodboards.journey_id  → si usa per concept_directions (client portal)
```

Entrambe le colonne possono coesistere sullo stesso moodboard. Se `journey_id` è NULL ma `project_id` è presente, il moodboard NON è accessibile dall'endpoint concept-directions del portal.

---

## 5. Cultural Profile — Triplicazione

Il profilo culturale / atmosferico del cliente è salvato in 3 posti:

| Sorgente | Campo | Aggiornato da |
|----------|-------|---------------|
| `leads.atmosphere_signals` | JSONB array | `lead_intake_engine.py` (compute_signals) |
| `projects.metadata_json.atmosphere` | JSONB nested | `journey_initiate.py` (path A) |
| `journey_briefs.closed_answers.atmosphere` | JSONB nested | `journey_initiate.py` (path A) |

Non esiste sincronizzazione automatica: se il lead aggiorna le preferenze dopo la creazione del journey, i tre campi divergono.

---

## 6. Title Generation — 4 Template Diversi

`projects.title` viene generato in modo diverso a seconda del percorso:

| Percorso | Template titolo |
|----------|----------------|
| A (journey_initiate) | `"Conversazione di {first_name} {last_name}"` |
| B (lead_conversion) | `"{name} · Design Journey"` |
| C (account_journeys) | `"Design Journey · {account_name}"` |
| D (design_journey) | Ereditato da query; default `"Untitled"` |

Non esiste normalizzazione post-creazione.

---

## 7. Mappa Dipendenze Cross-Module

```
                  ┌─────────────┐
                  │    leads    │
                  └──────┬──────┘
                         │ legacy_lead_id (inverso)
                  ┌──────▼──────┐
                  │   accounts  │◄──── signed_proposal_id
                  └──────┬──────┘          ▲
                         │ account_id       │
                  ┌──────▼──────┐     ┌────┴────┐
                  │  d.journeys │     │proposals│
                  └──────┬──────┘     └─────────┘
                         │ project_id      ▲
                  ┌──────▼──────┐          │ project_id
                  │   projects  │──────────┘
                  │ client_user │
                  │   _id       │
                  └──────┬──────┘
                         │ project_id
                  ┌──────▼──────┐
                  │  moodboards │
                  └─────────────┘
```

**Nodo critico**: `projects` è il punto di integrazione centrale. Porta:
- `client_user_id` (portal ownership)
- `lead_id` (traccia origine, solo path B)
- `tenant_id`
- `metadata_json.account_id` (solo path D, fragile)

---

*Audit statico — MODULE CONNECTION AUDIT*
