# MOODBOARD PUBLISH FLOW AUDIT
## MOOD for DESIGN™ — FASE 1 + 2

**Data:** 11 Giugno 2026
**Sprint:** CORE PRODUCT STABILIZATION — MOODBOARD PUBLISH FLOW CERTIFICATION

---

## FLOW A — Concept Direction Sharing (Journey-bound) — CANONICAL

```
Designer pubblica
↓ POST /api/journeys/{jid}/concept-directions/{set_id}/share
↓
moodboards.status = 'sent' ✅
concept_seed.shared_at = NOW() ✅
journey_timeline_events (concept_set_shared) ✅
IN-APP client notification via notification_publisher ✅ (FIXED)
email (best-effort, BLOCKED_EXTERNAL_DEPENDENCY) ⚠️
↓
Cliente → /journey/{jid} (Atelier Gen 3)
↓ AtelierNotifications (FIXED: ora legge /api/notifications/unread-count)
↓ Badge REALE notifiche (rimossi dummy data) ✅
↓ AtelierActionPanel: CTA "Visualizza le Direzioni™" (AGGIUNTA) ✅
↓ Link → /journey/{jid}/concepts ✅ (Route AGGIUNTA in App.js)
↓
Cliente → ClientConceptReviewPage
↓ GET /api/client/journeys/{jid}/concept-directions
↓ Filtra shared_at != null ✅
↓ Mostra set di direzioni condivise ✅
↓
Cliente dà feedback
↓ POST /api/client/concept-directions/{moodboard_id}/feedback
↓ { reaction: 'approved' | 'revision_requested' | 'comment' }
↓
Designer riceve notifica in-app ✅ (FIXED in P0-2 sprint precedente)
Designer vede badge nella sidebar ✅
```

---

## FLOW B — Generic Moodboard Share Token — NON CANONICAL

```
POST /api/moodboards/{id}/share
↓ Crea moodboard_shares row con token
↓ Restituisce share_path: /moodboard/share/{token}
❌ Nessuna notifica al cliente
❌ Nessun timeline event
❌ Non linkato al Journey
❌ Nessun feedback loop

VERDICT: Non è il flusso MOOD. Non inviare PDF manuali.
```

---

## GAP TROVATI E STATO

| # | Gap | Stato prima | Stato dopo |
|---|-----|-------------|------------|
| 1 | Nessuna notifica in-app al cliente quando designer pubblica | ❌ MISSING | ✅ FIXED |
| 2 | AtelierNotifications mostrava dati dummy (hardcoded) | ❌ MOCKED | ✅ CONNECTED TO API |
| 3 | CTA "Visualizza Direzioni" assente in AtelierActionPanel | ❌ MISSING CTA | ✅ ADDED |
| 4 | Route `/journey/:jid/concepts` non esisteva (404) | ❌ 404 | ✅ ROUTED |
| 5 | Companion endpoint mostrava bozze al cliente | ❌ DRAFT LEAK | ✅ FILTERED |
| 6 | Companion non includeva concept direction moodboards | ❌ MISSING | ✅ FIXED |

---

## SOURCE OF TRUTH — MOODBOARD

```
Table: moodboards
  id                     → UUID primary key
  journey_id             → FK design_journeys.id (canonical link)
  project_id             → FK projects.id (legacy link)
  status                 → draft | sent | viewed | approved | revision_requested | rejected
  ai_metadata.concept_seed.set_id        → raggruppamento per set di direzioni
  ai_metadata.concept_seed.shared_at     → PUBLISH SIGNAL (null = non condiviso)
  ai_metadata.concept_seed.client_reactions[] → feedback del cliente
```

**Owner:** created_by = designer profile_id
**Visibility:** status != 'draft' AND concept_seed.shared_at != null
**Publish endpoint:** `POST /api/journeys/{jid}/concept-directions/{set_id}/share`

---

## NOTIFICATION CHAIN — VERIFICATA

```
1. share_concept_set() → notification_publisher.publish(
     recipient_user_id = projects.client_user_id,
     recipient_type = "client",
     category_key = "designer_replied",
     narrative = "Il tuo studio ha condiviso nuove direzioni progettuali: {set_label}",
     deep_link_url = "/journey/{jid}/concepts"
   )

2. Client → GET /api/notifications/unread-count → count += 1

3. AtelierNotifications badge shows REAL count (no longer dummy)

4. Client clicks notification → navigate to /journey/{jid}/concepts
   → ClientConceptReviewPage renders shared directions
```

---

## FILES MODIFICATI

| File | Modifica |
|------|---------|
| `/app/backend/routers/concept_directions.py` | Aggiunto `notification_publisher.publish()` per cliente + refactored client_user_id lookup |
| `/app/backend/routers/client_portal.py` | Filtro bozze + include concept direction moodboards nel companion |
| `/app/frontend/src/presets/client-profile/atelier/AtelierNotifications.jsx` | Rimossi dummy data, connesso a /api/notifications/unread-count reale |
| `/app/frontend/src/presets/client-profile/atelier/AtelierActionPanel.jsx` | Aggiunta CTA "Visualizza le Direzioni™" → /journey/:jid/concepts |
| `/app/frontend/src/routes/JourneyCanonicalRoutes.jsx` | Aggiunto export `CanonicalClientConcepts` |
| `/app/frontend/src/App.js` | Aggiunta route `/journey/:jid/concepts` → ClientConceptReviewPage |

---

## SUCCESS CRITERIA — VERIFICAZIONE

| Criterio | Stato |
|----------|-------|
| Il designer non invia PDF | ✅ Usa il publish flow digitale |
| Il cliente non riceve email manuale | ✅ Notifica in-app (email è best-effort) |
| Il Journey avanza tramite MOOD | ✅ Tutto via design_journeys + concept_directions |
| Loop completo chiuso | ✅ Designer → pubblica → cliente notificato → visualizza → feedback → designer notificato |
