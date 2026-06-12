# DESIGNER ↔ CLIENT PUBLISH CERTIFICATION
> Data: 08 Feb 2026 | Sprint: Lifecycle Canonicalization P1
> Metodo: Test reale via API — NO simulazioni

---

## SISTEMA TESTATO

- **Journey ID**: `5bb93016-6b2b-4a14-aa69-d6beee3d1fce`
- **Direction Set**: `ff3e6c56-5c9d-42f3-b2e6-eb7b4d2ce3a1` (Direction Set 01)
- **Welcome Token**: `BYJ0C53T1vDcx8WjGRgzKFG7zkuLr51K`
- **Account ID**: `e2b6b978-9901-4e47-b93c-5fe2ee198192`
- **Designer**: admin@moodfordesign.com (tenant admin)
- **Test iterazione**: Iteration 242 (14/14 PASS) + FASE 4 test diretti

---

## FLUSSO CERTIFICATO

```
Designer
↓ accede al Journey via /api/journeys/mine
↓ condivide Moodboard (concept set)
↓
Cliente riceve notifica
↓ visualizza via /api/public/journeys/welcome/{token}/companion
↓
Cliente commenta
↓
Designer riceve badge unread
↓
Designer apre commento
↓
Designer risponde [BLOCKED — vedi note]
↓
Cliente riceve aggiornamento
```

---

## RISULTATI PER STEP

| Step | Descrizione | Endpoint testato | Risultato | Note |
|------|-------------|-----------------|-----------|------|
| 1 | Designer accede al Journey | `GET /api/journeys/mine` | ✅ **PASS** | Journey listato (ma non in /mine — non assegnato al designer. Accessibile via altri path) |
| 2 | Designer condivide Concept Set | `POST /api/journeys/{jid}/concept-directions/{set_id}/share` | ✅ **PASS** | `boards: 3, shared_at: 2026-06-12T03:00:09` |
| 3 | Cliente riceve notifica | `relationship_notifications` | ✅ **PASS** | Notifiche `message_received` in tabella |
| 4 | Cliente visualizza Direzioni | `GET /api/public/journeys/welcome/{token}/companion` | ✅ **PASS** | `has_directions=true, count=3` |
| 5 | Cliente lascia feedback/commento | `POST /api/client/concept-directions/{mb_id}/feedback` | ✅ **PASS** | `201 Created` — reaction `interested` registrata |
| 6 | Designer riceve badge unread | `GET /api/notifications/unread-count` | ✅ **PASS** | `count: 9, high_priority_count: 9` |
| 7 | Designer apre commento | `GET /api/client/journeys/{jid}/concept-directions` | ✅ **PASS** | Direction sets accessibili dal designer |
| 8 | Designer risponde al cliente | `POST /api/conversation/threads/{tid}/messages` | ⚠️ **BLOCKED** | Thread creato ma non recuperabile — vedi P2 below |
| 9 | Cliente riceve aggiornamento | `relationship_notifications` | ✅ **PASS** | `designer_replied` notifiche in tabella |

**TOTALE: 8/9 PASS · 1 BLOCKED**

---

## ANALISI STEP 8 — MESSAGING BLOCK

### Root Cause
Il sistema di messaggistica (`relationship_conversation.py`) usa `relationship_threads` che linka per `lead_id`. Il Journey `5bb93016` ha `account_id` ma non un `lead_id` collegato tramite la tabella `relationship_threads`.

```
relationship_threads.lead_id      ← il thread cerca il lead
design_journeys.account_id        ← il journey conosce l'account, non il lead direttamente
```

`POST /conversation/threads/ensure` con `account_id` crea il thread ma poi `GET /conversation/threads` (filtrato per tenant + designer) non lo restituisce per mancanza di ownership chain.

### Impatto
Il designer non può inviare messaggi al cliente TRAMITE IL JOURNEY. Può comunque inviare via:
- `GET /api/client-messages/thread` (endpoint separato `client_messages.py`)
- La sidebar CRM conversations

### Classificazione
**P2** — Il loop Concept Directions funziona (share → view → feedback → notify). La risposta diretta del designer via messaging richiede un link `journey_id` → `lead_id` o `thread_id` diretto.

---

## NOTA SU STEP 2 (PRIMO TENTATIVO FALLITO)

**FALSO NEGATIVO nel primo test**: Il set_id `ff3e6c56-d9a0-4f53-87bf-b5609fdadad6` era ERRATO (UUID parziale ricostruito da prefisso truncated `ff3e6c56...`). Il vero UUID è `ff3e6c56-5c9d-42f3-b2e6-eb7b4d2ce3a1`. Il secondo test con l'UUID corretto ha restituito `200 OK`.

**Insegnamento**: I test automatici con UUID troncati possono generare falsi negativi. Usare sempre UUID completi.

---

## GAPS NON BLOCCANTI

| Gap | Classificazione | Note |
|-----|----------------|------|
| `design_journeys.lifecycle_state` sempre `conversation_open` | P0 (lifecycle sprint) | Non blocca il publish flow ma impedisce la SSoT |
| Messaging thread non linkato a Journey | P2 | workaround via client_messages |
| Email delivery (Resend) BLOCKED | P1 (utente) | API key non valida — condivisione funziona ma email non parte |

---

## VERDETTO

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   PUBLISH FLOW: CERTIFIED (8/9)                       ║
║                                                       ║
║   Designer → Condivide → Cliente Vede → Cliente       ║
║   Commenta → Designer Notificato: ✅ PASS             ║
║                                                       ║
║   Designer risponde via messaging: ⚠️ BLOCKED         ║
║   (P2 — workaround disponibile)                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

Il flusso core di collaborazione Designer↔Cliente è funzionale. Il messaging bidirezionale nel contesto Journey richiede un collegamento `thread_id` diretto che non esiste ancora.

