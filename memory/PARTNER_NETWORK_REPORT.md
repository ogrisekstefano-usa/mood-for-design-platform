# Partner Network Implementation Report
**Sprint:** Partner Network — Fase 5, 5.1
**Date:** 2026-06-19
**Status:** ✅ COMPLETE

## Architettura

### Source of Truth
- **Pre-approvazione**: `leads` table, `lead_type='partner_studio'`
- **Status tracking**: `metadata_json.partner_status` (applied | review | approved | active | archived)
- **Post-invito**: `users_profile.role='ad_partner'` (non implementato in questo sprint)

## Fase 5 — Backend APIs

### GET /api/partner-network/partners
- Autenticato (richiede `P_LEADS_READ`)
- Filtra `leads.lead_type='partner_studio'` per tenant
- Query param: `status`, `q` (ricerca), `limit`, `offset`
- Aggiunge `territory` e `partner_status` estratti da `metadata_json`
- Restituisce `status_counts` per badge filtri

### PATCH /api/partner-network/partners/{id}/status
- Autenticato (richiede `P_LEADS_WRITE`)
- Body: `{"status": "applied"|"review"|"approved"|"active"|"archived"}`
- Aggiorna `metadata_json.partner_status` (non `progression_state`)
- Risposta: `{"partner_id": "...", "status": "..."}`

### Test Results (iter 248)
- ✅ GET /api/partner-network/partners → 200, lista partner con status_counts
- ✅ GET con ?status=applied filtra correttamente
- ✅ PATCH status applied→review→approved→active→archived
- ✅ PATCH status invalido → 422
- ✅ GET senza auth → 401
- ✅ Campi obbligatori presenti in ogni partner

## Fase 5.1 — Frontend: /partner-network

### Componente
`frontend/src/pages/partner-network/PartnerNetworkPage.jsx`

### Route
`/partner-network` (autenticata, Blueprint OS)

### Features
- Tabella partner con colonne: Professionista, Studio, Categoria, Territorio, Candidatura, Stato
- Filtri stato nella toolbar: Tutti, Candidato, In Review, Approvato, Attivo, Archiviato
- Badge contatori per ogni stato
- Ricerca libera full-text
- StatusMenu dropdown per cambiare stato inline
- Statistiche header: Totale, Approvati, In Review

### Sidebar Navigation
- `code: 'partner_network'`
- `label: 'Partner Network'`
- `route: '/partner-network'`
- `icon: 'Network'`
- `position: 35` (dopo Design Journeys)
- `test_id: 'sidebar-nav-partner-network'`

### Test Results (iter 248)
- ✅ Pagina carica con titolo "Partner Network"
- ✅ Tabella mostra partner con tutte le colonne richieste
- ✅ Filtri stato presenti e cliccabili (Tutti, Candidato, In Review, Approvato, Attivo, Archiviato)
- ✅ Sidebar ha icona Partner Network selezionata (visibile nel screenshot)
- ⚠️ Transient 503 da Supabase osservato (RemoteProtocolError) - non codice bug, infrastruttura

## Note tecniche
- La colonna `title` NON esiste in `design_journeys` — **BUG FIXATO** in GET /api/partner-network/journeys
- Il filtro per status avviene in-memory dopo fetch (non a DB) — necessario perché `partner_status` è in `metadata_json`
