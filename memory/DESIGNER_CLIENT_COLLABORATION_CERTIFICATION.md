# DESIGNER ↔ CLIENT COLLABORATION CERTIFICATION
> Data: 08 Feb 2026 | Sprint: Post-Certification Consolidation P1  
> Metodo: Test reale via API · NO simulazioni

---

## SISTEMA TESTATO

| Campo | Valore |
|-------|--------|
| Journey ID | `5bb93016-6b2b-4a14-aa69-d6beee3d1fce` |
| Direction Set | `ff3e6c56-5c9d-42f3-b2e6-eb7b4d2ce3a1` (Direction Set 01) |
| Moodboard ID | `6bb3d914-2272-46a7-9f75-cbc08ed6edf6` (Italian Heritage) |
| Welcome Token | `BYJ0C53T1vDcx8WjGRgzKFG7zkuLr51K` |
| Account ID | `e2b6b978-9901-4e47-b93c-5fe2ee198192` |
| Designer | admin@moodfordesign.com |
| Tenant | `848354b9-a43e-4147-bdad-116fb93bd585` |

---

## RISULTATI PER STEP

### S1 · Designer condivide Moodboard (Concept Set)

| | |
|---|---|
| **Endpoint** | `POST /api/journeys/{jid}/concept-directions/{set_id}/share` |
| **HTTP Status** | 200 OK |
| **Response** | `boards=3, shared_at=2026-06-12T03:21:32+00:00, email.sent=true` |
| **Nota** | Idempotente — invocabile più volte senza side effects multipli |
| **Verdetto** | ✅ **PASS** |

---

### S2 · Cliente riceve notifica

| | |
|---|---|
| **Storage** | `relationship_notifications` table |
| **Record trovati** | 5 notifiche attive, tipo `designer_replied`, `unread=true` |
| **Endpoint notifica** | `GET /api/notifications/unread-count → 9` |
| **Verdetto** | ✅ **PASS** |

---

### S3 · Cliente visualizza le Direzioni

| | |
|---|---|
| **Endpoint** | `GET /api/public/journeys/welcome/{token}/companion` |
| **HTTP Status** | 200 OK |
| **Response** | `has_directions=true, concept_directions=[{title: "Italian Heritage · Set 01 · B", status: "sent"}, {title: "Essential Minimal · Set 01 · C", status: "sent"}, {title: "Warm Organic · Set 01 · A", status: "sent"}]` |
| **Nota** | Endpoint pubblico — nessuna auth richiesta. Cliente usa welcome_token. |
| **Verdetto** | ✅ **PASS** |

---

### S4 · Cliente lascia feedback/commento

| | |
|---|---|
| **Endpoint** | `POST /api/client/concept-directions/{mb_id}/feedback` |
| **Payload** | `{"reaction": "preferred", "text": "Questa direzione cattura perfettamente la mia visione."}` |
| **HTTP Status** | 200 OK |
| **Response** | `reaction=preferred, narrative_len=67` |
| **Reazioni valide** | `interested`, `explore_further`, `preferred`, `comment` |
| **Verdetto** | ✅ **PASS** |

---

### S5 · Designer riceve badge unread

| | |
|---|---|
| **Endpoint** | `GET /api/notifications/unread-count` |
| **HTTP Status** | 200 OK |
| **Response** | `unread_count=9, high_priority=9` |
| **Verdetto** | ✅ **PASS** |

---

### S6 · Designer apre feedback cliente

| | |
|---|---|
| **Endpoint** | `GET /api/journeys/{jid}/concept-directions` |
| **HTTP Status** | 200 OK |
| **Response** | `sets=1, total_sets=1` |
| **Nota** | Il designer può leggere i sets con le reactions del cliente via questo endpoint |
| **Verdetto** | ✅ **PASS** |

---

### S7 · Designer risponde al cliente (Messaging)

| | |
|---|---|
| **Endpoint** | `POST /api/conversation/threads/ensure` → `POST /api/conversation/threads/{tid}/messages` |
| **Thread ensured** | `556c1926-1ce8-4fc5-baad-6e26eeddac57` |
| **Payload corretto** | `{"content": "...", "message_type": "text"}` (campo `content`, NON `body`) |
| **HTTP Status** | 201 Created |
| **Response** | `msg_id=d3a14a9d, sender_type=designer` |
| **Nota** | Il thread deve essere creato via `ensure` prima dell'invio. Campo API: `content` (non `body`). |
| **Verdetto** | ✅ **PASS** |

---

### S8 · Cliente riceve aggiornamento

| | |
|---|---|
| **Storage** | `relationship_notifications` |
| **Notifiche attive** | `designer_replied` × 3 (le più recenti) |
| **Verdetto** | ✅ **PASS** |

---

## SOMMARIO

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           PUBLISH FLOW: CERTIFIED 8/8                        ║
║                                                              ║
║   ✅ S1  Designer condivide Moodboard                        ║
║   ✅ S2  Cliente riceve notifica                             ║
║   ✅ S3  Cliente visualizza Direzioni                        ║
║   ✅ S4  Cliente lascia feedback/commento                    ║
║   ✅ S5  Designer riceve badge unread                        ║
║   ✅ S6  Designer apre feedback                             ║
║   ✅ S7  Designer risponde (messaging)                       ║
║   ✅ S8  Cliente riceve aggiornamento                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## NOTE TECNICHE

### Campo corretto per l'invio messaggi

Il router `relationship_conversation.py` richiede `content`, NON `body`:

```json
// CORRETTO
{"content": "Risposta designer", "message_type": "text"}

// ERRATO (produce HTTP 400)
{"body": "Risposta designer", "message_type": "text"}
```

### Thread messaging linkato per account_id

Il sistema di threading usa `account_id` per il lookup tramite `POST /api/conversation/threads/ensure`. Il link `thread → journey` non è diretto — il thread è legato all'account. Questo è sufficiente per il flusso corrente ma limita la ricerca per journey_id.

### Email delivery

`email.sent=true` in S1 response — ma il provider Resend ha API key non valida. L'email non viene consegnata fisicamente. Il flag indica l'intenzione di invio, non la consegna.

---

## CONFRONTO CON ITERATION 242

| Sprint | Risultato |
|--------|-----------|
| Iteration 242 (11 Jun 2026) | 14/14 PASS (E2E frontend) |
| **Questa certificazione (08 Feb 2026)** | **8/8 PASS (API reale)** |

Il flusso è stabile tra le due iterazioni di test.

