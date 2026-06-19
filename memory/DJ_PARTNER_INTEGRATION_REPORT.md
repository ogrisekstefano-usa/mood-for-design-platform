# DJ Partner Integration Report
**Sprint:** Partner Network — Fase 6
**Date:** 2026-06-19
**Status:** ✅ IMPLEMENTED — ⚠️ Assegnazione richiede users_profile

## Architettura

### Flusso assegnazione
```
Partner (approved) → AssignDJModal → POST /api/partner-network/partners/{id}/assign
                                   → add_assignment(role='contributor')
                                   → metadata_json.partner_status = 'active'
```

### Vincoli
1. `partner_status` deve essere `approved` o `active`
2. Il partner deve avere un `users_profile` (email match nel tenant)
3. Il `design_journey` deve appartenere al tenant

## Backend APIs

### GET /api/partner-network/journeys
- Autenticato (P_PROJECTS_READ)
- Lista DJ con `lifecycle_state` IN ('conversation_open', 'active', 'draft', 'in_progress', 'open')
- **Bug fixato**: `title` → colonne corrette `id, lifecycle_state, overall_status, created_at, project_id`

### POST /api/partner-network/partners/{id}/assign
- Body: `{"journey_id": "...", "notes": "..."}`
- Verifica partner esiste e status è approved/active
- Cerca users_profile per email del partner
- Chiama `add_assignment(role='contributor')`
- Se status era 'approved' → aggiorna a 'active'
- Risposta: `{assignment_id, partner_id, journey_id, role, message}`

### DELETE /api/partner-network/partners/{id}/assignment/{journey_id}
- Rimuove partner da DJ tramite `revoke_assignment(role='contributor')`

## Frontend: AssignDJModal

### Componente
`AssignDJModal` inline in `PartnerNetworkPage.jsx`

### Trigger
- Visibile solo per partner con `partner_status` in ('approved', 'active')
- Aperto da menu azioni "..." → "Aggiungi a Design Journey"

### Features
- Lista radio dei DJ disponibili
- Pulsante "Assegna come Contributor"
- Gestione errore inline (es. partner senza account)
- Auto-close e aggiornamento stato locale

## Test Results (iter 248)

### Backend
- ✅ GET /api/partner-network/journeys → 200 (dopo fix colonna title)
- ⚠️ POST /api/partner-network/partners/{id}/assign non testato in E2E (richiede users_profile per partner)

### Frontend
- ✅ Menu azioni "..." visibile su ogni riga partner
- ✅ "Aggiungi a Design Journey" appare solo per partner approved/active
- ✅ Modal AssignDJModal si apre al click (confermato da screenshot precedente con data funzionante)

## Limitazione Fase 6
Il flusso completo di assegnazione richiede che il partner abbia già un `users_profile` nel sistema (deve essere stato invitato come membro). I partner in fase 'applied' ricevono errore 400 con messaggio chiaro: *"Il partner non ha ancora un account sulla piattaforma. Invitalo prima tramite Impostazioni → Membri."*
