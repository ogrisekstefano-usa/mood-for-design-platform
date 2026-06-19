# Partner Application Implementation Report
**Sprint:** Partner Network — Fase 3 & 4
**Date:** 2026-06-19
**Status:** ✅ COMPLETE

## Fase 3 — Backend: POST /api/partner/apply

### Endpoint
`POST /api/partner/apply` (pubblico, nessuna autenticazione richiesta)

### Funzionamento
- Riceve candidatura partner dal form /partner-application
- Crea lead con `lead_type='partner_studio'` (ENUM valido)
- `progression_state='lead'` (CHECK constraint rispettato)
- `metadata_json.partner_status='applied'` (tracking stato partner)
- **Deduplicazione soft**: stessa email → aggiorna esistente, restituisce `status='updated'`
- **NON crea**: account, contact, auth.user, users_profile

### Risposta 201
```json
{
  "status": "created" | "updated",
  "partner_id": "<uuid>",
  "message": "Candidatura ricevuta con successo."
}
```

### Campi obbligatori
`tenant_slug`, `first_name`, `last_name`, `company_name`, `email`

### Validazione
- Campi obbligatori mancanti → 422 Unprocessable Entity
- Tenant non trovato → 404

### Test Results (iter 248)
- ✅ 201 created con partner_id
- ✅ Deduplicazione email restituisce status='updated'
- ✅ Campi mancanti → 422
- ✅ Nessun account/user_id nel response

## Fase 4 — Frontend: /partner-application

### Componente
`frontend/src/pages/site/PartnerApplicationPage.jsx`

### Flusso
1. Form a 4 sezioni: Identità, Profilo online, Area geografica, Intenti
2. Submit → `POST {API_BASE}/api/partner/apply`
3. Success → stato inline "Candidatura ricevuta." (nessun redirect)
4. Error → messaggio inline

### Test Results (iter 248)
- ✅ Form si carica correttamente su /partner-application
- ✅ Campi compilabili (nome, cognome, studio, email, ruolo)
- ✅ Submit invia a POST /api/partner/apply
- ✅ Success state mostra "Candidatura ricevuta." con CheckCircle icon
