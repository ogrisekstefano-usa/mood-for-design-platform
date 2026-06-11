# DESIGNER_PUBLISH_FLOW_AUDIT.md
**Data:** 11 giugno 2026 | **Sprint:** Core Product Stabilization

---

## MATRICE COMPLETA: Asset × Publish Chain

### 1. CONCEPT DIRECTION / MOODBOARD

**Backend:** `concept_directions.py`  
**Endpoint share:** `POST /api/journeys/:jid/concept-directions/:set_id/share`

| Campo | Valore | Esiste? |
|-------|--------|---------|
| Owner | `moodboards.created_by` | ✓ |
| Visibility | `moodboards.visibility` — `"studio_only"` (draft) / `"client_visible"` (shared) | ✓ |
| Status workflow | `moodboards.status` — `draft → sent → approved/rejected` | ✓ |
| Shareability | `POST /journeys/:jid/concept-directions/:set_id/share` | ✓ **ESISTE** |
| Timeline event | `journey_timeline_events` INSERT al share | ✓ **ESISTE** |
| Notification | `notification_service.create_notification()` chiamato nel share | ✓ **ESISTE** |
| Client accessibility | `GET /api/client/concept-directions` + `ClientConceptReviewPage.jsx` | ✓ **ESISTE** |
| Client feedback | `POST /api/client/concept-directions/:id/feedback` (reactions: approved, revision_requested, preferred, comment) | ✓ **ESISTE** |

**WORKFLOW ESISTENTE:**
```
DRAFT → share() → status='sent', visibility='client_visible' → timeline_event + email
↓
Client reviews → POST /feedback → approval_state = 'approved' / 'revision_requested'
```

**GAP:**
- Designer non riceve notifica quando il cliente invia feedback (nessun notify_designer() nel feedback endpoint)
- Non verificato se il bottone "Share" esiste nell'UI del Journey workspace

---

### 2. MOODBOARD (standalone)

**Backend:** `moodboards.py`  
**Note:** Distinto da "concept direction sets"

| Campo | Valore | Esiste? |
|-------|--------|---------|
| Owner | `moodboards.created_by` | ✓ |
| Visibility | Campo `visibility` esiste nel model | ✓ |
| Status workflow | `moodboards.approval_state` (draft/sent/approved/rejected) | ✓ |
| Shareability | **NESSUN endpoint share dedicato** | ✗ MANCANTE |
| Timeline event | Non trovato | ✗ MANCANTE |
| Notification | Non trovato | ✗ MANCANTE |
| Client accessibility | Non trovato endpoint client moodboard | ✗ MANCANTE |

**GAP:** Il moodboard standalone non ha un publish workflow. Solo il concept direction SET ha il meccanismo completo.

---

### 3. PROPOSAL

**Backend:** `proposals.py`  
**Endpoint:** `PATCH /api/proposals/:id/decision`

| Campo | Valore | Esiste? |
|-------|--------|---------|
| Owner | `proposals.created_by` | ✓ |
| Visibility | `proposals.status` (draft / sent / signed / declined) | ✓ |
| Status workflow | draft → sent → signed/declined | ✓ |
| Shareability | `PATCH decision action='send'` | ✓ ESISTE (parziale) |
| Timeline event | Non verificato | INCERTO |
| Notification | `notification_service` non trovato nel router | ✗ MANCANTE |
| Client accessibility | Non trovato endpoint `/api/client/proposals` | ✗ MANCANTE |

**GAP:** Il cliente non ha un endpoint per vedere le proposte. L'invio esiste ma la ricezione non è implementata nel client portal.

---

### 4. BRIEF (Journey Brief)

**Backend:** `discover_brief.py`  
**Natura:** BIDIREZIONALE ma solo CLIENT → DESIGNER

| Campo | Valore | Esiste? |
|-------|--------|---------|
| Owner | Cliente (compila il brief) | ✓ |
| Visibility | Nessun campo visibility — sempre visibile al designer | ✓ (implicito) |
| Status workflow | `journey_briefs.closed_answers.discovery_status = in_progress/completed` | ✓ |
| Shareability | Il brief È del cliente — il designer lo legge, non lo "condivide" | N/A |
| Timeline event | Non trovato | ✗ |
| Notification | `unread_for_designer = 1` al submit del brief (via thread) | ✓ PARZIALE |
| Client accessibility | Il client crea il brief — è already client-owned | ✓ |

**GAP:** Il designer non può inviare al cliente un "brief revisionato". Flusso solo one-way.

---

### 5. MEDIA ASSET

**Backend:** `atelier_media.py`

| Campo | Valore | Esiste? |
|-------|--------|---------|
| Owner | `atelier_media.created_by` | ✓ |
| Visibility | Non trovato campo visibility | ✗ |
| Status workflow | Non trovato | ✗ |
| Shareability | Non trovato endpoint share | ✗ |
| Timeline event | Non trovato | ✗ |
| Notification | Non trovato | ✗ |
| Client accessibility | Non trovato endpoint `/api/client/media` | ✗ |

**GAP:** I media asset sono completamente interni. Nessun meccanismo di condivisione.

---

### 6. MILESTONE CONTENT

**Backend:** `milestone_dialogue.py`, `journey_assets.py`

| Campo | Valore | Esiste? |
|-------|--------|---------|
| Owner | Designer | ✓ |
| Visibility | `journey_assets.visibility = 'studio'` (default) | ✓ CAMPO ESISTE |
| Status workflow | Milestone ha status (upcoming/in_progress/completed) | ✓ |
| Shareability | Non trovato endpoint publish/share | ✗ |
| Timeline event | `journey_timeline_events` INSERT trovato | ✓ |
| Notification | Non trovato | ✗ |
| Client accessibility | Non trovato endpoint client milestone | ✗ |

**GAP:** Avanzamento milestone non visibile al cliente. Solo interno al workspace designer.

---

### 7. MESSAGES (Thread conversazione)

**Backend:** `relationship_conversation.py`

| Campo | Valore | Esiste? |
|-------|--------|---------|
| Owner | Mittente del messaggio | ✓ |
| Visibility | `conversation_messages.visibility = 'client_visible' / 'internal_only'` | ✓ |
| Status workflow | `unread_for_designer`, `unread_for_client` | ✓ |
| Shareability | Thread condiviso per default | ✓ |
| Timeline event | Non trovato automaticamente | ✗ |
| Notification | `unread_for_designer` aggiornato | ✓ PARZIALE (badge ora funziona) |
| Client accessibility | `GET /api/client-messages/:journey_id` | ✓ ESISTE |
| Designer accessibility | `GET /api/conversation/threads/:id` | ✓ ESISTE |

**STATUS: Più completo — bidirezionale**

---

## RIEPILOGO WORKFLOW ESISTENTI VS MANCANTI

| Asset | Draft→Share | Timeline | Notify Designer | Notify Client | Client View | Client Feedback |
|-------|------------|---------|----------------|--------------|------------|----------------|
| Concept Direction | ✓ | ✓ | ✗ MANCA | ✓ (email BLOCKED) | ✓ | ✓ |
| Moodboard (standalone) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Proposal | ✓ parziale | ✗ | ✗ | ✗ | ✗ | solo sign/decline |
| Brief | N/A | ✗ | ✓ parziale | N/A | ✓ (cliente crea) | ✗ |
| Media Asset | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Milestone | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Message | ✓ | ✗ | ✓ (badge) | non verificato | ✓ | ✓ |

---

## WORKFLOW DA CONNETTERE (solo wiring, nessuna nuova tabella)

### Priorità P0: Concept Direction → Notifica Designer su Feedback

**Cosa manca:** In `POST /api/client/concept-directions/:id/feedback`, dopo aver salvato la reaction, chiamare `notification_service.create_notification(designer_profile_id, ...)` e aggiornare `conversation_threads.unread_for_designer += 1`.

**File da modificare:** `/app/backend/routers/client_portal.py` (feedback endpoint)

### Priorità P1: Proposal → Client Portal Visibility

**Cosa manca:** `GET /api/client/proposals/:jid` endpoint che restituisce solo le proposte con `status = 'sent'`.

### Priorità P1: Message → Notifica in-app al cliente

**Cosa manca:** Quando il designer invia un messaggio, `conversation_threads.unread_for_client += 1`. Verificare se il client portal ha un badge notifiche che legge questo valore.
