# DESIGN JOURNEY — END-TO-END CERTIFICATION
**Data**: 2026-06-20  
**Sprint**: Pre-Production Certification  
**Metodo**: Testing Agent v4 (iteration_255) + curl API test  
**Journey di test**: `fe495a99-0c98-4390-9e90-5c8296d1af33`

---

## FLUSSO TESTATO

```
Lead (begin-journey)
  ↓
CRM (relations/accounts + leads)
  ↓
Design Journey (overview + workspace)
  ↓
Team Assignment (admin/journeys/{id}/assignments)
  ↓
Workspace (7 fasi DISCOVER→CELEBRATE)
  ↓
Milestone (overview con milestones)
  ↓
Lifecycle change (conversation_open → in_progress)
  ↓
Timeline (journal eventi)
```

---

## STEP 1 — Lead Creation

**API**: `POST /api/public/journeys/initiate`  
**Payload**:
```json
{
  "tenant_slug": "studio",
  "welcome": {
    "first_name": "Test",
    "last_name": "E2E",
    "email": "test.e2e.cert2@test.com",
    "phone": "+39333000222"
  }
}
```
**Risposta**: `action: "created"`, `journey_id` + `lead_id` generati, `welcome_token` emesso.  
**Esito**: PASS ✓

---

## STEP 2 — CRM Visibility

**API**: `GET /api/relations/accounts` + `GET /api/relations/leads`  
**Risposta**: 200, dati presenti  
**Esito**: PASS ✓

---

## STEP 3 — Design Journey Workspace

**URL**: `/studio/journey/fe495a99-0c98-4390-9e90-5c8296d1af33`  
**Risultato**: pagina carica correttamente con workspace Design Journey™ visibile e 7 fasi operative (DISCOVER → CELEBRATE)  
**Esito**: PASS ✓

---

## STEP 4 — Milestones Overview

**API**: `GET /api/journeys/{jid}/overview`  
**Risposta**: 200, milestones presenti con struttura corretta  
**Esito**: PASS ✓

---

## STEP 5 — Lifecycle Change

**API**: `PATCH /api/journeys/{jid}/lifecycle`  
**Payload**: `{"lifecycle_state": "in_progress"}`  
**Risposta**: 200  
**Note**: il campo si chiama `lifecycle_state` (non `status`). Valori validi: `conversation_open`, `in_progress`, `presenting`, `drifting`, `on_pause`, `approved`, `closed`, `editioned`, `abandoned`.  
**Esito**: PASS ✓

---

## STEP 6 — Team Assignment

**API**: `GET /api/admin/journeys/{jid}/assignments`  
**Risposta**: 200  
**Esito**: PASS ✓

---

## STEP 7 — Timeline

**API**: `GET /api/journeys/{jid}/timeline`  
**Risposta**: 200  
**Esito**: PASS ✓

---

## RISULTATI

| Step | API/URL | Esito |
|------|---------|-------|
| Lead Creation | `POST /api/public/journeys/initiate` | PASS |
| CRM Visibility | `GET /api/relations/accounts` | PASS |
| DJ Workspace | `/studio/journey/{id}` (7 fasi) | PASS |
| Milestones | `GET /api/journeys/{id}/overview` | PASS |
| Lifecycle | `PATCH /api/journeys/{id}/lifecycle` | PASS |
| Team Assignment | `GET /api/admin/journeys/{id}/assignments` | PASS |
| Timeline | `GET /api/journeys/{id}/timeline` | PASS |

**Score**: 7/7

---

## RISCHI RESIDUI

Nessun blocco funzionale. Un solo item documentazione:
- Il campo PATCH lifecycle è `lifecycle_state` (non `status`). Non è un bug, ma va documentato per gli sviluppatori futuri.

---

## VERDETTO

**PASS**

Il flusso Design Journey End-to-End è completamente operativo: dalla creazione del lead tramite il form pubblico, alla visibilità in CRM, al workspace 7 fasi, alle milestones, al lifecycle management e all'assignment del team.
