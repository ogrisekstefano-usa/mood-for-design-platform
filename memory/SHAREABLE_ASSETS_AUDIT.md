# SHAREABLE_ASSETS_AUDIT.md
**Versione:** 1.0  
**Data:** 11 giugno 2026  
**Sprint:** Core Model Consolidation  
**Obiettivo:** Mappare lo stato attuale della condivisione assets designer→cliente

---

## WORKFLOW TARGET

```
Designer pubblica
↓
Cliente riceve notifica
↓
Cliente visualizza
↓
Cliente commenta
↓
Designer riceve riscontro
```

---

## ENTITÀ AUDITATE

### 1. MOODBOARD

**Creazione:** `POST /api/journeys/:jid/concept-directions/generate` (via concept directions)  
**Tabella:** `moodboards`

| Domanda | Stato | Dettaglio |
|---------|-------|-----------|
| Può essere visibile al cliente? | ✓ IN PRINCIPIO | Campo `visibility` esiste |
| Come viene condiviso? | **NON IMPLEMENTATO** | Nessun endpoint di condivisione esplicita |
| Esiste flag di visibilità? | ✓ SÌ | `moodboards.visibility = "studio_only"` (default) — possibili valori: `studio_only`, `client_preview`, `client_visible` |
| Esiste stato workflow? | ✓ PARZIALE | `moodboards.approval_state = "draft"` (draft / sent / approved / rejected) + `moodboards.status = "draft"` |
| Esiste notifica? | **NO** | Nessuna call a `notification_service` al cambio di visibility |
| Esiste timeline event? | **NO** | Nessun `journey_timeline_events` insert al publish |

**Gap per il workflow target:**
- Manca endpoint `PATCH /api/moodboards/:id/publish` che cambia `visibility → client_visible` + emette notifica
- Manca polling/realtime dal lato cliente per vedere nuovi moodboard
- Il cliente non ha modo di commentare direttamente un moodboard

---

### 2. PROPOSAL

**Creazione:** `POST /api/proposals`  
**Tabella:** `proposals`

| Domanda | Stato | Dettaglio |
|---------|-------|-----------|
| Può essere visibile al cliente? | ✓ SÌ | Esiste workflow signoff cliente |
| Come viene condiviso? | ✓ PARZIALE | `PATCH /api/proposals/:id/decision` con `action: 'send'` |
| Esiste flag di visibilità? | ✓ SÌ | `proposals.status` (draft / sent / signed / declined) |
| Esiste stato workflow? | ✓ SÌ | Stati: draft → sent → signed/declined |
| Esiste notifica? | **PARZIALE** | `notification_service.create_notification()` chiamato ma solo per alcuni eventi — non verificato per `send` |
| Esiste timeline event? | **NON VERIFICATO** | `journey_timeline_events` non trovato esplicitamente nel router |

**Gap per il workflow target:**
- Non verificato se il cliente riceve notifica push quando la proposta viene inviata
- Commento cliente: non esiste campo `client_comment` sulla proposta (solo sign/decline)
- Designer non notificato quando cliente visualizza (solo sign/decline)

---

### 3. CONCEPT DIRECTION

**Creazione:** `POST /api/journeys/:jid/concept-directions/generate`  
**Tabella:** `moodboards` con tipo concept direction + `concept_directions` (se esiste)

| Domanda | Stato | Dettaglio |
|---------|-------|-----------|
| Può essere visibile al cliente? | ✓ IN PRINCIPIO | Campo `visibility: "studio_only"` come default |
| Come viene condiviso? | **NON IMPLEMENTATO** | Nessun endpoint publish su concept direction |
| Esiste flag di visibilità? | ✓ SÌ | `visibility` su `moodboards` |
| Esiste stato workflow? | ✓ PARZIALE | `approval_state: "draft"` su moodboards |
| Esiste notifica? | **NON VERIFICATO** | Parametro `notify` in endpoint ma non wired |
| Esiste timeline event? | ✓ SÌ | `journey_timeline_events` insert trovato nel router concept_directions |

**Gap per il workflow target:**
- Publish concept direction → cliente non notificato
- Cliente non può esprimere preferenza tra direction A/B/C in modo strutturato

---

### 4. BRIEF (Journey Brief / Discover Brief)

**Creazione:** `POST /api/journeys/:jid/brief` (da `discover_brief.py`)  
**Tabella:** `journey_briefs`

| Domanda | Stato | Dettaglio |
|---------|-------|-----------|
| Può essere visibile al cliente? | ✓ SÌ | Il brief è compilato DAL cliente (public journey) |
| Come viene condiviso? | **UNIDIREZIONALE** | Il cliente crea il brief, il designer lo legge. Non esiste revisione/condivisione inversa |
| Esiste flag di visibilità? | **NO** | Nessun campo `visibility` su `journey_briefs` |
| Esiste stato workflow? | ✓ PARZIALE | `closed_answers.discovery_status = "in_progress" / "completed"` |
| Esiste notifica? | ✓ PARZIALE | Il thread di sistema notifica il designer quando il brief viene completato (`unread_for_designer = 1`) |
| Esiste timeline event? | **NON VERIFICATO** | |

**Gap per il workflow target:**
- Il designer non può inviare al cliente un "brief revisionato" o una "sintesi"
- Il cliente non può commentare il brief dopo averlo inviato

---

### 5. MILESTONE ATTACHMENT / JOURNEY MILESTONE

**Creazione:** `journey_milestones` (fasi Discover/Inspire/etc.)  
**Tabella:** `journey_milestones`, `milestone_dialogue.py`

| Domanda | Stato | Dettaglio |
|---------|-------|-----------|
| Può essere visibile al cliente? | **NON IMPLEMENTATO** | Non trovato flag di visibilità sulle milestone |
| Come viene condiviso? | **NESSUN MECCANISMO** | Le milestone sono interne al workspace designer |
| Esiste flag di visibilità? | **NO** | `journey_milestones` non ha `visibility` |
| Esiste stato workflow? | ✓ SÌ | Milestone ha status (upcoming/in_progress/completed) |
| Esiste notifica? | **NO** | Nessuna notifica al cliente su avanzamento milestone |
| Esiste timeline event? | ✓ SÌ | `journey_timeline_events` presente in `milestone_dialogue.py` |

**Gap per il workflow target:**
- Le milestone sono completamente invisibili al cliente
- Avanzamento milestone → nessuna notifica cliente

---

### 6. MEDIA ASSET

**Creazione:** `POST /api/atelier/media/upload` (da `atelier_media.py`)  
**Tabella:** `atelier_media` o storage Supabase

| Domanda | Stato | Dettaglio |
|---------|-------|-----------|
| Può essere visibile al cliente? | **SCONOSCIUTO** | Upload esiste ma condivisione non verificata |
| Come viene condiviso? | **NON IMPLEMENTATO** | Nessun endpoint di share trovato |
| Esiste flag di visibilità? | **NON VERIFICATO** | Non trovato `visibility` in atelier_media.py |
| Esiste stato workflow? | **NON VERIFICATO** | |
| Esiste notifica? | **NO** | |
| Esiste timeline event? | **NO** | |

**Gap per il workflow target:**
- I media caricati dal designer non hanno un meccanismo di condivisione con il cliente

---

### 7. MESSAGE / CONVERSATION

**Creazione:** `POST /api/conversation/threads/:id/messages`  
**Tabella:** `conversation_messages`, `conversation_threads`

| Domanda | Stato | Dettaglio |
|---------|-------|-----------|
| Può essere visibile al cliente? | ✓ SÌ | Campo `visibility: "client_visible" / "internal_only"` |
| Come viene condiviso? | ✓ SÌ | Thread condiviso designer↔cliente in tempo reale |
| Esiste flag di visibilità? | ✓ SÌ | `conversation_messages.visibility` |
| Esiste stato workflow? | ✓ SÌ | `unread_for_designer`, `unread_for_client` in `conversation_threads` |
| Esiste notifica? | ✓ PARZIALE | `unread_for_designer` aggiornato ma **badge UI non sincronizzato** |
| Esiste timeline event? | **NON VERIFICATO** | |

**Gap per il workflow target:**
- Badge notifiche admin non legge `unread_for_designer` in tempo reale (**P0 già documentato**)
- Il cliente riceve notifica in-app? Non verificato per messaggi inviati dal designer

---

## MATRICE DI COMPLETAMENTO

| Asset | Cliente vede | Notifica cliente | Commento cliente | Notifica designer | Gap |
|-------|-------------|-----------------|-----------------|------------------|-----|
| **Moodboard** | No (visibility=studio_only) | No | No | — | P0 |
| **Proposal** | Sì (status=sent) | Non verificato | Solo sign/decline | Solo sign/decline | P1 |
| **Concept Direction** | No (studio_only) | No | No | — | P0 |
| **Brief** | Sì (cliente crea) | Parziale (unread) | No (post-invio) | Parziale | P1 |
| **Milestone** | No | No | No | — | P1 |
| **Media Asset** | Non implementato | No | No | — | P1 |
| **Message** | Sì | Non verificato | Sì | Parziale (badge KO) | P0 |

---

## RISPOSTA ALLA DOMANDA: Quanto manca per il workflow target?

Il workflow `Designer pubblica → Cliente riceve notifica → Cliente visualizza → Cliente commenta → Designer riceve riscontro` è:

**COMPLETAMENTE ASSENTE per:** Moodboard, Concept Direction, Milestone, Media Asset  
**PARZIALMENTE PRESENTE per:** Proposal (sign/decline ma non commento), Brief (one-way)  
**PIÙ AVANZATO per:** Message (thread bidirezionale, ma badge KO)

**Elementi già esistenti da connettere:**
1. `moodboards.visibility` esiste → manca il publish endpoint + notifica
2. `conversation_threads.unread_for_designer` esiste → manca la sync con il badge
3. `proposal` ha stato sent → manca notifica push al cliente
4. `journey_timeline_events` esiste in alcuni router → manca utilizzo coerente

**Il lavoro rimanente non è creare ex novo — è connettere ciò che esiste.**

---

*Report generato il 11/06/2026*
