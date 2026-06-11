# JOURNEY_FIRST_FLOW_MAP.md
**Data:** 11 giugno 2026 | **Sprint:** Core Product Stabilization

---

## MAPPA SCHERMATA PER SCHERMATA

### STEP A1 — `/begin-journey` (pubblico, unauthenticated)

| Voce | Valore |
|------|--------|
| **Scopo** | Acquisire il primo brief aspirazionale del cliente |
| **Utente** | Cliente (anonimo) |
| **Azione principale** | Compilare 3-step form (atmosfera → stile di vita → contatti) |
| **Azione secondaria** | — |
| **Evento generato** | `lead` INSERT + `design_journey` INSERT + `conversation_thread` INSERT + magic link Supabase |
| **Stato aggiornato** | `leads.status = 'qualified'`, `design_journeys.lifecycle_state = 'conversation_open'` |
| **Destinazione successiva** | `/journey/preparing` (schermata di attesa) |
| **BUG TROVATO** | `design_journeys.client_user_id = NULL` — il provisioning client avviene ma il field non viene mai scritto nel journey record |

---

### STEP A2 — `/journey/preparing` (pubblico, post-submit)

| Voce | Valore |
|------|--------|
| **Scopo** | Rassicurare il cliente che il Journey è in creazione |
| **Utente** | Cliente |
| **Azione principale** | Nessuna — schermata di attesa |
| **Azione secondaria** | Controlla email per magic link |
| **Evento generato** | Nessuno (schermata statica) |
| **Stato aggiornato** | — |
| **Destinazione successiva** | Email magic link → `/journey/:jid` (se email funziona) |
| **DEAD STATE** | Email BLOCKED (Resend API key invalida). Il cliente NON riceve nulla. La schermata è un vicolo cieco. |

---

### STEP A3 — `/journey/:jid` (client portal, post-magic-link)

| Voce | Valore |
|------|--------|
| **Scopo** | Spazio del cliente per seguire il Design Journey |
| **Utente** | Cliente (autenticato via magic link) |
| **Azione principale** | Visualizzare il progresso del Journey |
| **Azione secondaria** | Inviare messaggi, visualizzare moodboard condivisi |
| **Evento generato** | — |
| **Stato aggiornato** | — |
| **Destinazione successiva** | Rimane sul portale cliente |
| **BLOCCO** | Non testabile — email non funziona → client_user_id rimane NULL → redirect a `/auth/login` |

---

### STEP B1 — `/studio` · Dashboard Designer

| Voce | Valore |
|------|--------|
| **Scopo** | Panoramica giornaliera dello studio |
| **Utente** | Designer |
| **Azione principale** | Vedere cosa richiede attenzione oggi |
| **Azione secondaria** | Aprire un Journey, creare un nuovo lead |
| **Evento generato** | — |
| **Stato aggiornato** | — |
| **Destinazione successiva** | `/studio/journey/:jid` o `/relations/leads` |
| **STATUS** | PASS — dashboard funzionante, badge notifiche ora mostra 6 ✓ |

---

### STEP B2 — `/relations/leads` · CRM Leads

| Voce | Valore |
|------|--------|
| **Scopo** | Gestire i lead in entrata |
| **Utente** | Designer / Admin |
| **Azione principale** | Qualificare un lead, creare Design Journey |
| **Azione secondaria** | Cercare, filtrare, assegnare |
| **Evento generato** | `design_journey` CREATE (via Qualification Modal) |
| **Stato aggiornato** | `leads.pipeline_stage` (NON `journey.lifecycle_state`) |
| **Destinazione successiva** | `/studio/journey/:jid` |
| **WARNING** | CRM filtra su `leads.pipeline_stage`, non su `design_journeys.lifecycle_state` — doppia verità |

---

### STEP B3 — `/studio/journey/:jid` · Journey Operating Workspace

| Voce | Valore |
|------|--------|
| **Scopo** | Spazio operativo del designer per un singolo Journey |
| **Utente** | Designer |
| **Azione principale** | Lavorare sulle fasi del Journey (Discover → Inspire → ...) |
| **Azione secondaria** | Inviare messaggi, condividere contenuti |
| **Evento generato** | Dipende dalla fase — `journey_timeline_events` |
| **Stato aggiornato** | `design_journeys.lifecycle_state`, `journey_milestones.status` |
| **Destinazione successiva** | `/studio/journey/:jid/step/:milestone` |
| **BUG** | Journey con `milestones = 0` → loading infinito "Caricamento workspace operativo..." |
| **TRADUZIONE** | 12 chiavi mancanti — sezione traduzione non completa |

---

### STEP B4 — `/studio/journey/:jid/step/inspire` · Step Workspace (Inspire)

| Voce | Valore |
|------|--------|
| **Scopo** | Creare concept direction / moodboard per il cliente |
| **Utente** | Designer |
| **Azione principale** | Generare concept direction con AI, selezionare immagini |
| **Azione secondaria** | Condividere con il cliente |
| **Evento generato** | `moodboards` INSERT + `journey_timeline_events` |
| **Stato aggiornato** | `moodboards.status = 'draft'`, `moodboards.visibility = 'studio_only'` |
| **Destinazione successiva** | Publish → `/api/journeys/:jid/concept-directions/:set_id/share` |
| **STATUS** | ENDPOINT ESISTE — UX del bottone share DA VERIFICARE |

---

### STEP B5 — Concept Direction Published → Cliente notificato

| Voce | Valore |
|------|--------|
| **Scopo** | Il designer condivide una direction con il cliente |
| **Utente** | Designer (trigger) → Cliente (destinatario) |
| **Azione principale** | Click "Share with client" dal designer |
| **Evento generato** | `moodboards.status = 'sent'` + `journey_timeline_events` + email opzionale |
| **Stato aggiornato** | `moodboards.status = 'sent'` |
| **Destinazione successiva** | Cliente riceve email → `/journey/:jid` → `ClientConceptReviewPage` |
| **BLOCCO** | Email BLOCKED (Resend). Notifica in-app non verificata. |

---

### STEP C1 — `/journey/:jid` (client) · Concept Direction Review

| Voce | Valore |
|------|--------|
| **Scopo** | Il cliente visualizza e risponde alla concept direction |
| **Utente** | Cliente |
| **Azione principale** | Approvare / Richiedere revisione / Inviare messaggio |
| **Azione secondaria** | Esprimere preferenza tra direction A/B/C |
| **Evento generato** | `POST /api/client/concept-directions/:id/feedback` |
| **Stato aggiornato** | `moodboards.approval_state = 'approved' / 'revision_requested'` |
| **Destinazione successiva** | Designer riceve notifica → Journey avanza |
| **GAP** | Designer non riceve notifica in-app quando il cliente risponde |

---

### STEP C2 — Designer riceve feedback

| Voce | Valore |
|------|--------|
| **Scopo** | Il designer vede il feedback del cliente |
| **Utente** | Designer |
| **Azione principale** | Leggere il feedback, aggiornare la direction |
| **Evento generato** | — |
| **Stato aggiornato** | — |
| **Destinazione successiva** | Designer aggiorna, ri-pubblica |
| **GAP** | Nessun evento di notifica generato da `concept-directions/feedback` → designer non sa che il cliente ha risposto |

---

## RIEPILOGO DEAD SCREENS / STATI SENZA USCITA

| Screen | Tipo | Root Cause |
|--------|------|-----------|
| `/journey/preparing` | DEAD STATE | Email BLOCKED → cliente non riceve nulla |
| Journey workspace (loading infinito) | DEAD SCREEN | `milestones = 0` → loader non si risolve |
| `/journey/:jid` (client portal) | NON ACCESSIBILE | `client_user_id = NULL` → redirect a login |
| Discovery Interview (status ≠ pending) | WARNING | Già fixato (409 graceful handling) |
