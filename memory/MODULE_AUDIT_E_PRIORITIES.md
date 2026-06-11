# MODULE CONNECTION AUDIT — DOCUMENTO E: PRIORITÀ P0/P1/P2
> Prodotto: 10 Jun 2026 · Audit statico completo del codebase

---

## LEGENDA

| Livello | Definizione |
|---------|------------|
| **P0** | Rompe funzionalità visibile a utente finale o corrompe dati silenziosamente. Fix urgente. |
| **P1** | Comportamento non corretto ma non catastrofico. Causa dati inconsistenti su flussi secondari. |
| **P2** | Debito tecnico, naming, duplicazioni. Non blocca nulla. |

---

## P0 — FIX URGENTI

### P0-A · `design_journeys.account_id = NULL` su record storici
**Gap**: GAP-02  
**Impatto**: DesignJourneyTab mostra milestones vuote e stato "undefined". `JourneyOperatingPage` (pre-fix TASK 2E) mostrava "Untitled Journey".  
**Fix suggerito**: SQL backfill — per ogni `design_journeys.account_id = NULL`, derivare l'account_id da `projects.metadata_json.account_id` o da `leads.metadata_json.account_id` dove disponibile. Caso noto: journey `88c072b7`.  
**Tabelle**: `design_journeys`, `projects`, `leads`  
**Bloccato da**: Approvazione utente (SQL cleanup).

---

### P0-B · `projects.client_user_id = NULL` su journey creati via CRM (Path B, C, D)
**Gap**: GAP-01  
**Impatto**: Client portal vuoto per tutti i journey creati manualmente dal designer. Il cliente entra nel portal e vede "zero_data: true" anche se ha un journey attivo.  
**Fix suggerito**:
1. Breve: Aggiungere update `projects.client_user_id` in `lead_conversion.py` (path B) e `account_journeys.py` (path C), derivando l'email dell'account → cerca `users_profile.id` con `email = account.email`.
2. Lungo: Consolidare con `client_provisioning.py` e renderlo sincrono o con retry.  
**Tabelle**: `projects`, `accounts`, `users_profile`  
**Nota**: Il path A già chiama `provision_client_after_journey()` non-blocking. Se fallisce silenziosamente (GAP-04), questo diventa P0-B anche per il Path A.

---

### P0-C · `proposals.account_id` assente — check di sicurezza disabilitato
**Gap**: GAP-03  
**Impatto**: La transizione Prospect → Customer accetta qualsiasi `proposal_id`, anche di un altro account. Rischio di conversione erronea.  
**Fix suggerito**: Aggiungere `account_id` come colonna su `proposals` (o validare via `proposals.project_id → design_journeys.account_id`). Poi aggiornare il check in `account_lifecycle.py`.  
**Tabelle**: `proposals`, `accounts`

---

## P1 — FIX IMPORTANTI

### P1-A · Lead NON-blocking in Path A — fallimento silenzioso
**Gap**: GAP-04  
**Impatto**: Account/journey esiste ma `leads` non viene creato. CRM mostra 0 lead.  
**Fix suggerito**: Rendere l'insert `leads` bloccante (con timeout breve) oppure aggiungere un job di riconciliazione che verifica `accounts` senza `leads` corrispondente.  
**Tabelle**: `leads`, `accounts`, `funnel_events`

---

### P1-B · Deduplicazione account assente su Path A + B
**Gap**: GAP-05  
**Impatto**: Più account con stessa email. Portal mostra il più recente via email match, ma il designer vede duplicati nel CRM.  
**Fix suggerito**: In `journey_initiate.py`, prima di `INSERT accounts`, verificare `SELECT accounts WHERE email = ? AND tenant_id = ?`. Se esiste, riusare l'account (pattern già applicato in `lead_conversion.py` via `legacy_lead_id`).  
**Tabelle**: `accounts`

---

### P1-C · `design_journeys.owner_user_id = NULL` su Path A e B
**Gap**: GAP-06  
**Impatto**: Journey senza designer assegnato. Gli endpoint filtered-by-owner falliscono silenziosamente.  
**Fix suggerito**: Chiamare `ensure_owner()` da `journey_assignments` anche nei path A e B. In path A, usare il designer di default del tenant.  
**Tabelle**: `design_journeys`, `journey_assignments`

---

### P1-D · `moodboards.journey_id = NULL` per moodboard studio
**Gap**: GAP-07  
**Impatto**: Moodboard studio non compaiono nel portal concept-directions del cliente.  
**Fix suggerito**: Aggiungere `journey_id` lookup nel POST `/api/moodboards` — se `project_id` è fornito, cercare il journey associato e settare `journey_id`.  
**Tabelle**: `moodboards`, `design_journeys`

---

### P1-E · `funnel_events.lead_id = NULL` per account creati via Path C
**Gap**: GAP-08  
**Impatto**: Audit pipeline incompleto. `account_lifecycle.py` scrive `lead_id = account.get("lead_id") = None` su tutti gli account CRM-only.  
**Fix suggerito**: In `account_lifecycle.py`, derivare `lead_id` da `accounts.legacy_lead_id` (se esiste) invece di cercare `account.get("lead_id")`.  
**Tabelle**: `funnel_events`, `accounts`

---

## P2 — DEBITO TECNICO

### P2-A · 4 template diversi per `projects.title`
**Gap**: GAP-09  
**Fix suggerito**: Standardizzare a `"{account_name} · {project_type}"` via helper condiviso. Bassa priorità.

---

### P2-B · Cultural profile triplicato
**Gap**: GAP-10  
**Fix suggerito**: Designare `journey_briefs.closed_answers` come source of truth e deprecare i mirror in `projects.metadata_json` (usato solo per read nel portal, non per write).

---

### P2-C · Naming inconsistente `legacy_lead_id` vs `lead_id`
**Gap**: GAP-08  
**Fix suggerito**: Rinominare `accounts.legacy_lead_id` → `accounts.source_lead_id` e aggiornare tutti i consumer. Migration DB richiesta.

---

### P2-D · `proposal_signoffs` — mancanza di verifica client_user_id
**Gap**: GAP-11  
**Fix suggerito**: In `proposals.py → signoff()`, verificare `proposals.project_id → projects.client_user_id == current_user.profile_id` prima di accettare la firma.

---

### P2-E · `discovery_interviews.lead_id` — FK formale mancante
**Gap**: GAP-12  
**Fix suggerito**: Aggiungere FK constraint su `discovery_interviews.lead_id → leads.id ON DELETE SET NULL` via migration Supabase.

---

## Riepilogo Priorità

| Priorità | Gap | Descrizione | Effort stimato |
|----------|-----|-------------|----------------|
| 🔴 P0-A | GAP-02 | `design_journeys.account_id = NULL` backfill | SQL 1h |
| 🔴 P0-B | GAP-01 | `projects.client_user_id` non settato su Path B/C/D | Backend 2-3h |
| 🔴 P0-C | GAP-03 | `proposals.account_id` assente — check conversione disabilitato | DB + Backend 1h |
| 🟠 P1-A | GAP-04 | Lead NON-blocking in Path A | Backend 1h |
| 🟠 P1-B | GAP-05 | Dedup account per email in Path A | Backend 1h |
| 🟠 P1-C | GAP-06 | `owner_user_id` NULL su Path A/B | Backend 1h |
| 🟠 P1-D | GAP-07 | `moodboards.journey_id` NULL | Backend 30min |
| 🟠 P1-E | GAP-08 | `funnel_events.lead_id = NULL` per Path C | Backend 30min |
| 🟡 P2-A | GAP-09 | Title template diversi | Backend 30min |
| 🟡 P2-B | GAP-10 | Cultural profile triplicato | Refactor 2h |
| 🟡 P2-C | GAP-08 | Naming inconsistente `legacy_lead_id` | Migration 1h |
| 🟡 P2-D | GAP-11 | Signoff senza verifica ownership | Backend 30min |
| 🟡 P2-E | GAP-12 | FK formale mancante su `discovery_interviews` | Migration 30min |

---

## Sequenza di Fix Raccomandata

```
Sprint 1 (breve, nessuna nuova feature):
  P0-A · SQL backfill account_id (approvazione utente)
  P0-C · proposals.account_id column + check
  P1-E · funnel_events.lead_id da legacy_lead_id

Sprint 2:
  P0-B · projects.client_user_id su Path B e C
  P1-A · leads insert bloccante in journey_initiate
  P1-B · dedup account per email

Sprint 3:
  P1-C · ensure_owner() su tutti i path
  P1-D · moodboards.journey_id auto-linking
  P2-D · signoff ownership check

Sprint 4 (refactoring):
  P2-A, P2-B, P2-C, P2-E
```

---

*Audit statico — MODULE CONNECTION AUDIT*
