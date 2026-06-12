# NEXT STABILIZATION ROADMAP
> Data: 08 Feb 2026 | Sprint: Lifecycle Canonicalization P1

---

## REGOLA DI PRIORITÀ (VINCOLANTE)

1. Source of Truth
2. Lifecycle
3. Module Connections
4. UX
5. Solo dopo: nuove feature

Qualsiasi attività non rientrante nei punti 1-4 è **BACKLOG**.

---

## P0 — SOURCE OF TRUTH BLOCKER

### P0-1: `design_journeys.lifecycle_state` non avanza mai

**Problema**: Tutti i 18 journey presenti hanno `lifecycle_state='conversation_open'`. Lo stato non avanza mai. Questo rende impossibile usare `design_journeys` come SSoT.

**Causa**: Nessun punto nel codebase scrive `lifecycle_state` oltre alla creazione iniziale. Non esiste una funzione di transizione.

**Fix richiesto**:
```
POST /api/public/journeys/initiate           → lifecycle_state = 'lead'
POST /api/relations/{id}/promote             → lifecycle_state = 'prospect'
POST /api/journeys/{jid}/concept-directions/{sid}/share → lifecycle_state = 'active'
POST /api/account-lifecycle/{id}/convert-to-customer    → lifecycle_state = 'customer'
```

**File da modificare**:
- `routers/journey_initiate.py:164` (cambia `conversation_open` → `lead`)
- `routers/client_relations.py:promote endpoint` (add lifecycle_state write)
- `routers/concept_directions.py:share_concept_set` (add lifecycle_state write)
- `routers/account_lifecycle.py:convert_to_customer` (add lifecycle_state write)

**NESSUN nuovo endpoint. NESSUNA nuova tabella.**

---

### P0-2: CRM pages filtrano per `accounts.lifecycle_stage` invece di `design_journeys.lifecycle_state`

**Problema**: `ProspectsPage` → `client_relations.py` → `accounts.lifecycle_stage='prospect'`. Non usa `design_journeys`.

**Fix richiesto** (post-P0-1):
Una volta che `design_journeys.lifecycle_state` avanza correttamente, modificare `client_relations.py`:
```python
# OGGI:
.eq('lifecycle_stage', 'prospect')   # legge accounts

# DOPO P0-1:
.in_('lifecycle_state', ['prospect', 'active'])  # legge design_journeys
```

Poi ProspectsPage mostra Journey WHERE lifecycle_state='prospect', Accounts mostra WHERE lifecycle_state IN ('active', 'waiting_client', 'customer').

**Dipende da**: P0-1 risolto

---

## P1 — LIFECYCLE CONNECTIONS

### P1-1: Messaging thread non linkato al Journey

**Problema**: `relationship_threads` usa `lead_id` come link. I Journey post-onboarding hanno `account_id` ma non necessariamente un `lead_id` in `relationship_threads`.

**Causa**: `relationship_conversation.py:_ensure_thread` cerca per `lead_id` → se non trovato cerca thread orfano → crea thread ma con `lead_id=null`.

**Fix richiesto**:
Aggiungere `journey_id` a `relationship_threads` come campo opzionale. Modificare `_ensure_thread` per cercare anche per `journey_id`.

**File**: `routers/relationship_conversation.py:119-165`
**No migration** se si usa `metadata JSONB` esistente per stoccare `journey_id` temporaneamente.

---

### P1-2: `leads.pipeline_stage` ancora scritto ma mai letto

**Problema**: Campo LEGACY scritto in 4 punti ma nessun consumer. Genera confusione sulla SSoT.

**Fix richiesto**: 
Smettere di scrivere `pipeline_stage` nei nuovi flussi. Il campo può rimanere per retrocompatibilità ma non deve essere aggiornato da nuovi path.

**File**:
- `routers/journey_initiate.py:470,511` → rimuovere `pipeline_stage` dal payload INSERT leads
- `routers/lead_intake.py:163` → rimuovere `pipeline_stage`

---

### P1-3: `discovery_interviews` backfill dal begin_journey_ritual da rimuovere

**Problema**: `journey_initiate.py:530-553` inserisce un `discovery_interview` row come "audit trail" ma i dati sono già in `journey_briefs`. Crea un'entità ridondante.

**Fix richiesto**: Rimuovere il blocco `try: c.table("discovery_interviews").insert(...)` da `journey_initiate.py:530-553`.

**Nessun impatto consumer** (verificato: nessuna pagina legge questi record).

---

### P1-4: Email delivery (Resend) BLOCKED

**Azione utente**: Verificare dominio `mail.moodfordesign.com` su resend.com + rigenerare API key.
**Non è un task di codice.** Vedi `EMAIL_DELIVERY_AUDIT.md`.

---

## P2 — MODULE CONNECTIONS

### P2-1: Concept Pulse → lifecycle_state transition

Una volta che P0-1 è implementato, il `Concept Pulse™` dovrebbe triggerare `lifecycle_state = 'waiting_client'` quando il set è condiviso e si attende feedback.

**Post-P0-1 dependency.**

---

### P2-2: Deprecation `discovery_interviews` dal public form

Rimuovere backfill insert da `journey_initiate.py`. Mantenere tabella per il showroom CRM flow.

**Dipende da**: P1-3 verificato

---

### P2-3: REACT_APP_EDITORIAL_DEBUG=false in produzione

Debug bar visibile su tutte le pagine in preview. Disabilitare in produzione.

**File**: `frontend/.env`

---

### P2-4: `accounts.relationship_journey_stage` mai valorizzato

Campo esistente mai scritto. Nessuno lo legge in modo significativo. **DEPRECATED** — lasciare null.

---

## BACKLOG (nuove feature — solo dopo P0-P2)

- Timezone field in Identity Model
- Auto-reassignment su revoca owner
- Capacity score per membro (max concurrent journeys)
- Engine i18n unification E3 → E1
- M6 · Advisor Workspace
- Messaging bidirezionale in-journey (consumer di P1-1)
- Variant Engine + Client Proposal View (V2.2)

---

## EXECUTION ORDER

```
SPRINT 1 (questa settimana):
  ✦ P0-1: lifecycle_state transitions (journey_initiate + account_lifecycle + concept_directions)
  ✦ P1-2: rimuovere pipeline_stage write
  ✦ P1-3: rimuovere discovery_interviews backfill

SPRINT 2 (settimana prossima):
  ✦ P0-2: CRM pages su design_journeys (dipende da P0-1 con dati reali)
  ✦ P1-1: messaging thread ↔ journey_id link

SPRINT 3 (dopo):
  ✦ P2-1/2/3 (cleanup)
```

---

## INVESTIMENTO STIMATO

| Task | Complexity | Files |
|------|-----------|-------|
| P0-1 lifecycle transitions | Medium | 4 router files |
| P0-2 CRM re-filter | Low | 1 file (client_relations.py) |
| P1-1 messaging link | Low | 1 file (relationship_conversation.py) |
| P1-2 pipeline_stage cleanup | Trivial | 2 files |
| P1-3 discovery backfill remove | Trivial | 1 file |

**ZERO nuove tabelle. ZERO nuovi endpoint. ZERO nuovi modelli.**

