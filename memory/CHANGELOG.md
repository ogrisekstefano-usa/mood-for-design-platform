# CHANGELOG — MOOD for Design

## 11 Giugno 2026 — Core Model Consolidation Sprint

### Fix P0 implementati

**Fix 1: Begin Journey Lingua (P0)**
- File: `frontend/src/site/SiteContext.jsx`
- Problema: `detectInitialCanonicalLocale()` restituiva 'en-US' da `navigator.languages` del browser Chromium
- Fix: ritorna `getDefaultLocale()` ('it-IT') direttamente senza consultare browser preferences
- Risultato: `/begin-journey` carica in italiano al primo render, `missing 0`

**Fix 2: Discovery 409 Race Condition (P0)**
- File: `frontend/src/components/relations/DiscoveryInterviewPanel.jsx`
- Problema: `start()` catch block mostrava errore "Impossibile aprire la Discovery" su tutti gli errori, incluso il 409 state conflict
- Fix: il catch gestisce `status=409 / DISCOVERY-INVALID-STATE` ricaricando lo stato con toast informativo
- Risultato: nessun errore visivo in caso di discovery già in_progress

**Fix 3: Notification Badge Desincronizzato (P0)**
- File: `backend/routers/notifications.py`
- Problema: `/api/notifications/unread-count` leggeva solo da `relationship_notifications` (sempre vuota), ignorando `conversation_threads.unread_for_designer`
- Fix: endpoint ora somma anche `unread_for_designer` da `relationship_threads` per il designer autenticato
- Risultato: badge mostra count corretto (es: 6)

### Documenti prodotti (nessun codice in questi)

- `CORE_FLOW_CERTIFICATION_REPORT.md` — 8 blocchi P0, Dream Score 4.3/10
- `MODEL_CONSISTENCY_REPORT.md` — SOURCE_OF_TRUTH_TABLE, God Object leads
- `CLIENT_MODEL_CONSOLIDATION_FINAL.md` — Design Journey come pivot, P0/P1/P2
- `SHAREABLE_ASSETS_AUDIT.md` — Stato condivisione moodboard/proposal/brief/media
- `JOURNEY_CANONICAL_MODEL_REPORT.md` — Root cause analysis + fix documentati

### Testing

- Test ID: iteration_238.json
- Backend: 8/8 pass
- Frontend: 100% pass
