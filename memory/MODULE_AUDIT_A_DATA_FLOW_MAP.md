# MODULE CONNECTION AUDIT — DOCUMENTO A: DATA FLOW MAP
> Prodotto: 10 Jun 2026 · Audit statico completo del codebase

---

## 1. Flusso Canonico

```
LEAD ─────────────────────► ACCOUNT ──────────────────► JOURNEY
  │                              │                          │
  │                              │                     milestones (10x)
  │                              │                     journey_milestones
  │                              │
  │                         DISCOVERY ──────────────► PROSPECT
  │                     (discovery_interviews)
  │
  └──── public intake ──────────────────────────────► ACCOUNT (diretta)
         (journey_initiate)
                                                          │
                                               ┌──────────┴──────────┐
                                               │                     │
                                          MOODBOARD              PROPOSAL
                                       (moodboard_pages)       (proposal_items)
                                       (moodboard_elements)    (proposal_signoffs)
                                               │                     │
                                               └──────────┬──────────┘
                                                          │
                                                       PORTAL
                                                  (client_portal)
```

---

## 2. Tabelle per Step

### STEP 1 — LEAD
| Tabella principale | `leads` |
|--------------------|---------|
| Chiavi primarie | `id`, `tenant_id` |
| Colonne chiave | `first_name`, `last_name`, `email`, `phone`, `source`, `status`, `pipeline_stage`, `lead_type`, `first_journey_id`, `progression_state` |
| Tabelle satellite | `discovery_interviews` (lead_id FK), `funnel_events` (lead_id FK), `relationship_answer_events` (lead_id FK) |
| Creazione entry point | `/api/leads/fast-capture`, `/api/leads/public`, `/api/relationships/intake/closed-answers` |

### STEP 2 — ACCOUNT
| Tabella principale | `accounts` |
|--------------------|------------|
| Chiavi primarie | `id`, `tenant_id` |
| Colonne chiave | `account_name`, `account_type`, `lifecycle_stage`, `email`, `phone`, `legacy_lead_id`, `primary_owner_id`, `signed_proposal_id` |
| Tabelle satellite | `contacts` (account_id FK), `relationship_events` (subject_id), `relationship_answer_events` (account_id) |
| Creazione entry point | Tre percorsi diversi (vedi §3) |

### STEP 3 — JOURNEY
| Tabella principale | `design_journeys` |
|--------------------|------------------|
| Chiavi primarie | `id`, `tenant_id` |
| Colonne chiave | `project_id`, `account_id`, `current_milestone_id`, `lifecycle_state`, `overall_status`, `welcome_token`, `created_by`, `owner_user_id` |
| Tabelle satellite | `journey_milestones` (journey_id FK), `journey_timeline_events` (journey_id FK), `journey_briefs` (journey_id FK), `milestone_versions` (milestone_id FK), `milestone_feedback` (milestone_id FK) |
| Intermedio obbligatorio | `projects` (project_id FK) — ogni journey ha un project shell 1:1 |
| Creazione entry point | 4 percorsi diversi (vedi §3) |

### STEP 4 — MOODBOARD
| Tabella principale | `moodboards` |
|--------------------|-------------|
| Chiavi primarie | `id`, `tenant_id` |
| Colonne chiave | `project_id`, `journey_id` (per concept directions), `created_by`, `status`, `ai_metadata` (concept_seed) |
| Tabelle satellite | `moodboard_pages` (moodboard_id FK), `moodboard_elements` (moodboard_id FK), `working_moodboards` |
| Nota | `account_id` **NON è una colonna** di `moodboards`. Viene risolto per join via `project_id → design_journeys.account_id` o via `project_id → account_id in metadata_json`. In `client_relations.py` viene letto `moodboards.account_id` in modo best-effort (campo non standard). |

### STEP 5 — PROPOSAL
| Tabella principale | `proposals` |
|--------------------|------------|
| Chiavi primarie | `id`, `tenant_id` |
| Colonne chiave | `project_id`, `created_by`, `title`, `status`, `total_value`, `currency` |
| Tabelle satellite | `proposal_items` (proposal_id FK), `proposal_signoffs` (proposal_id FK) |
| Nota | `account_id` **NON è una colonna standard** di `proposals`. `account_lifecycle.py` tenta `.get("account_id")` per validazione, che restituisce sempre `None` → il check è di fatto disabilitato |

### STEP 6 — PORTAL
| Superficie | `client_portal` endpoints |
|------------|--------------------------|
| Tabelle lette | `projects` (via `client_user_id`), `moodboards` (via `project_id`), `proposals` (via `project_id`), `design_journeys` (via `account_id` o `project_id`), `journey_milestones`, `journey_timeline_events`, `milestone_feedback` |
| Tabella di ancoraggio | `projects.client_user_id = users_profile.id` |

---

## 3. Percorsi Alternativi di Creazione

### PERCORSO A — Begin Journey Ritual (pubblico)
```
POST /api/public/journeys/initiate
  → INSERT accounts (lifecycle_stage='prospect')
  → INSERT contacts
  → INSERT projects
  → INSERT design_journeys (account_id ✅)
  → INSERT journey_milestones (10x)
  → INSERT milestone_versions (brief initial)
  → INSERT journey_timeline_events (2x)
  → INSERT journey_briefs
  → INSERT leads (NON-blocking, retroattivo)
  → INSERT funnel_events (NON-blocking)
  → INSERT discovery_interviews (status='qualified', NON-blocking)
  → provision_client_after_journey() → users_profile, thread, magic_link
```
**account_id**: ✅ sempre popolato  
**projects.client_user_id**: ❌ mai settato — portal non trova il progetto via `client_user_id`

---

### PERCORSO B — Lead → Start Journey (CRM)
```
POST /api/conversion/leads/{id}/start-journey
  → SELECT leads (verifica esistenza)
  → SELECT/INSERT accounts (via legacy_lead_id — crea se non esiste)
  → INSERT projects
  → INSERT design_journeys (account_id ✅)
  → INSERT journey_milestones (10x)
  → UPDATE leads (first_journey_id, pipeline_stage='active')
```
**account_id**: ✅ sempre popolato  
**projects.client_user_id**: ❌ mai settato  
**leads.first_journey_id**: ✅ aggiornato  

---

### PERCORSO C — Account → Journey (CRM manuale)
```
POST /api/accounts/{aid}/journeys
  → SELECT accounts (verifica stage: prospect/in_proposal/customer)
  → CHECK discovery_interviews (soft R4)
  → CHECK existing active journey (R5 max 1 active)
  → INSERT projects
  → INSERT design_journeys (account_id ✅)
  → ensure_owner() → journey_assignments
```
**account_id**: ✅ sempre popolato  
**projects.client_user_id**: ❌ mai settato  
**welcome_token**: ✅ generato  

---

### PERCORSO D — Project → Journey (designer workspace legacy)
```
GET/POST /api/projects/{pid}/journey
  → SELECT design_journeys (by project_id) — se esiste, return
  → INSERT design_journeys (account_id = projects.metadata_json.account_id ← FRAGILE)
  → INSERT journey_milestones (10x)
```
**account_id**: ⚠️ derivato da `projects.metadata_json.account_id` — può essere NULL  
**projects.client_user_id**: non verificato  
**welcome_token**: ❌ non generato su questo path  

---

## 4. Tabella Intermedie Rilevanti

| Tabella | Ruolo | FK chiave |
|---------|-------|-----------|
| `projects` | Wrapper 1:1 per ogni journey | `tenant_id`, `client_user_id` (portal ownership), `lead_id` (solo su path B), `metadata_json.account_id` (solo su path D) |
| `contacts` | Anagrafica persona fisica di un account | `account_id` FK |
| `discovery_interviews` | Prova di qualifica Lead → Prospect | `lead_id` FK, `tenant_id` |
| `funnel_events` | Audit pipeline trasversale | `lead_id`, `tenant_id` |
| `journey_assignments` | Owner assignment su journey | `journey_id`, `user_id` |
| `journey_briefs` | Rich brief entity 1:1 con journey | `journey_id` FK |
| `milestone_versions` | Versioning contenuto milestone | `milestone_id` FK |
| `milestone_feedback` | Voci cliente + feedback concetti | `milestone_id`, `author_user_id` |
| `journey_timeline_events` | Storia narrativa journey | `journey_id` FK |
| `proposal_signoffs` | Firma/revisione proposta | `proposal_id`, `project_id`, `client_user_id` |

---

*Audit statico · routers analizzati: leads.py, lead_conversion.py, lead_intake.py, client_relations.py, account_lifecycle.py, account_journeys.py, design_journey.py, moodboards.py, proposals.py, client_portal.py, journey_initiate.py*
