# PARTNER → APPROVAZIONE → TEAM CERTIFICATION
**Data**: 2026-06-20  
**Test ID**: iteration_254 — FLOW 2  
**Metodo**: API reali + test UI

---

## RISULTATO GLOBALE: ⚠️ PARTIAL

---

## STEP 1 — Compilazione /partner-application

**Form testato con 4 profili professionali**:
- Architetto (`architect`)
- Interior Designer (`interior_designer`)
- Showroom (`showroom`)
- Contractor (`contractor`)

| Check | Status | Evidenza |
|-------|--------|---------|
| Labels in italiano | ✅ PASS | Tutte da CMS `partner_form_labels` |
| Select Ruolo con opzioni CMS | ✅ PASS | 7 ruoli presenti |
| Submit architetto | ✅ PASS | `partner_id` restituito |
| Submit interior designer | ✅ PASS | `partner_id` restituito |

---

## STEP 2 — Registrazione nel sistema

**Endpoint**: `POST /api/partner/apply`  
**Status iniziale**: `applied`  

| Check | Status |
|-------|--------|
| Partner registrato | ✅ PASS |
| Status = applied | ✅ PASS |

---

## STEP 3 — Visibilità nel Partner Network Blueprint

**Endpoint**: `GET /api/partner-network/partners`  

| Check | Status | Evidenza |
|-------|--------|---------|
| Partner in lista via API | ✅ PASS | 5 partner presenti |
| UI Blueprint Partner Network | ⚠️ PARTIAL | `/partner-network` carica ma ha loading state lento |

---

## STEP 4 — Workflow di approvazione

**Lifecycle**: `applied → review → approved → active → archived`

| Azione | Endpoint | Status | Evidenza |
|--------|----------|--------|---------|
| Set status "review" | `PATCH /api/partner-network/partners/{id}/status` | ✅ PASS | `{partner_id, status}` restituito |
| Set status "approved" | stesso | ✅ PASS | OK |
| Set status "active" | stesso | ✅ PASS | OK |

---

## STEP 5 — Attivazione ruolo

| Check | Status | Evidenza |
|-------|--------|---------|
| Status `active` settabile | ✅ PASS | PATCH funziona |
| Badge/stato visibile nell'UI | ⚠️ Dipende dal rendering UI (non verificato) | |

---

## STEP 6 — Inserimento nel team / assegnazione a Design Journey

**Endpoint testato**: `POST /api/partner-network/partners/{id}/assign`  
**Risultato**: ❌ 400 Error — "Partner must have a platform account to be assigned"

| Check | Status | Causa |
|-------|--------|-------|
| Assegnazione a DJ | ❌ FAIL | Il partner ha una candidatura ma non un account utente sulla piattaforma. Necessita invite separato via Settings → Members |
| Workflow di invito | ⚠️ Non guidato nell'UI | Non c'è un pulsante "Invita alla piattaforma" visibile nel Partner Network |

---

## FRICTION POINTS

| # | Problema | Gravità |
|---|---------|---------|
| 1 | Assegnazione a DJ bloccata finché partner non ha account piattaforma | HIGH |
| 2 | Nessun bottone "Invita alla piattaforma" visibile nel Partner Network | HIGH |
| 3 | Un non-tecnico non sa che deve prima invitare il partner prima di assegnarlo | HIGH |
| 4 | URL `/blueprint/partner-network` → 404 (il corretto è `/partner-network`) | LOW |

---

## VERDETTO PER DOMANDA

| Domanda | Risposta |
|---------|----------|
| Partner si registra? | ✅ PASS |
| Appare nel Partner Network? | ✅ PASS (API), ⚠️ PARTIAL (UI) |
| Può essere approvato? | ✅ PASS |
| Può essere assegnato a un DJ? | ❌ FAIL — richiede step non guidato (invite platform) |

**VERDICT: ⚠️ PARTIAL**  
Il workflow di ricezione e approvazione funziona. L'assegnazione a un Design Journey è bloccata da un prerequisito non guidato nell'UI.
