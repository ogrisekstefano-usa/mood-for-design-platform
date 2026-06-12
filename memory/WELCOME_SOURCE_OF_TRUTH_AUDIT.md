# WELCOME SOURCE OF TRUTH AUDIT
> Data: 08 Feb 2026 | Revisore: E1 Agent | Stato: PASS

## Domanda 1: È lo stesso endpoint usato dal Client Portal?

**NO — endpoint diversi, scopo diverso.**

| Endpoint | Path | Auth | File sorgente |
|----------|------|------|---------------|
| Public Companion | `GET /api/public/journeys/welcome/{token}/companion` | Nessuna auth (welcome_token) | `journey_initiate.py:660` |
| Client Portal Companion | `GET /api/client/journeys/{journey_id}/companion` | Session Supabase (role=client) | `client_portal.py:532` |

Il Public Companion è un subset semplificato (5 campi). Il Client Portal Companion è completo (7 sezioni narrative, ownership check, milestone state, timeline).

---

## Domanda 2: È lo stesso endpoint usato dal Journey Companion?

**NO — semantica diversa.**

Il Journey Companion (`/api/client/journeys/{jid}/companion`) richiede autenticazione e fa ownership check. Il Welcome Companion è pubblico per design: il client non ha ancora un account attivo al primo accesso.

---

## Domanda 3: È la sorgente dati canonica delle Concept Directions per utenti non autenticati?

**SÌ.** Per accesso pubblico via welcome_token, `/api/public/journeys/welcome/{token}/companion` è l'unica sorgente. Legge `moodboards` dove `ai_metadata.concept_seed.shared_at` è valorizzato — stessa logica del client portal.

---

## Domanda 4: Esistono endpoint paralleli che restituiscono dati simili?

Tre endpoint esistenti toccano concept_directions:

| Endpoint | Auth | Payload | Scopo |
|----------|------|---------|-------|
| `GET /api/public/journeys/welcome/{token}/companion` | welcome_token | Minimal (id, title, status, set_label, shared_at, cover_url) | Welcome Page pubblica |
| `GET /api/client/journeys/{jid}/concept-directions` | Session client | Completo (reactions, is_preferred, style_dna, palette, etc.) | Client Portal Review |
| `GET /api/journeys/{jid}/concept-directions` | Session designer | Studio view con tutti i set | Designer Workspace |

**Non sono duplicazioni problematiche.** Servono tre contesti di autenticazione differenti con payload di fidelità crescente.

---

## Domanda 5: Esistono duplicazioni di modello?

**NO.** Tutti e tre leggono dalla stessa tabella `moodboards` con la stessa chiave `ai_metadata.concept_seed.shared_at`. Non ci sono tabelle intermedie o snapshot. SSoT confermata.

---

## VERDICT: FASE 0 — PASS

Nessun endpoint duplicato problematico. Nessuna duplicazione di modello.  
La `JourneyWelcomePage` deve usare esclusivamente `/api/public/journeys/welcome/{token}/companion`.  
Nessun nuovo endpoint richiesto. Procedere con FASE 1.

---

## Mappa dati disponibili via Companion (public)

```json
{
  "journey_id": "uuid",
  "lifecycle_state": "conversation_open | ...",
  "concept_directions": [
    {
      "id": "moodboard_id",
      "title": "Natural Luxury",
      "status": "sent | viewed | ...",
      "set_id": "uuid",
      "set_label": "Direction Set 01",
      "shared_at": "ISO timestamp",
      "cover_url": "https://... | null",
      "updated_at": "ISO timestamp"
    }
  ],
  "has_directions": true,
  "next_action": {
    "kind": "review_directions",
    "label": "Visualizza le Direzioni™",
    "description": "N direzioni condivise dal tuo studio"
  }
}
```

### Campi usabili per JourneyWelcomePage
- `journey_id` → navigazione verso `/journey/{id}/concepts`
- `has_directions` → guard per mostrare sezione direzioni
- `concept_directions[].title` → nome direzione
- `concept_directions[].set_label` → "Direction Set 01"
- `concept_directions[].cover_url` → anteprima opzionale
- `next_action.description` → copy dinamica ("N direzioni condivise")
