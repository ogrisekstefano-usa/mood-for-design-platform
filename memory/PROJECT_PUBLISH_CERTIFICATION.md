# PROJECT → PUBLISH → FRONTEND CERTIFICATION
**Data**: 2026-06-20  
**Test ID**: iteration_254 — FLOW 3  
**Metodo**: API reali + test UI frontend pubblico

---

## RISULTATO GLOBALE: ⚠️ PARTIAL — 1 blocco critico

---

## STEP 1 — Creazione progetto da Blueprint

**Endpoint**: `POST /api/admin/published-journeys/`  
**Payload**: titolo, slug, tipo, location, anno, canonical_locale  

| Check | Status | Evidenza |
|-------|--------|---------|
| Progetto creato | ✅ PASS | `id` restituito |
| Slug auto-generato (deduplicato) | ✅ PASS | cert-go-live-test-2 su re-run |
| Modale Blueprint chiara | ✅ PASS | Campi etichettati, slug auto |

---

## STEP 2 — Hero image + gallery + hotspot + YouTube

**Endpoint**: `PATCH /api/admin/published-journeys/{id}`  
**Payload story_content**:
```json
{
  "gallery": [{"id":"gal1","url":"https://...","caption":"Test","hotspots":[{"id":"h1","x":50,"y":50,"label":"Marble detail"}]}],
  "body_blocks": [{"id":"blk1","type":"youtube","url":"https://youtube.com/watch?v=dQw4w9WgXcQ","video_id":"dQw4w9WgXcQ","title":"Test video"}]
}
```

| Check | Status | Evidenza |
|-------|--------|---------|
| Hero image field | ✅ PASS | EditorialMediaField presente |
| Gallery salvata | ✅ PASS | `story_content.gallery` persistita |
| Hotspot salvati in gallery | ✅ PASS | `hotspots` array in ogni item gallery |
| YouTube in body_blocks | ✅ PASS | `video_id` estratto, salvato |

---

## STEP 3 — Traduzione EN-US

**Endpoint**: `PUT /api/admin/published-journeys/{id}/translations/en-US`  

| Check | Status |
|-------|--------|
| Traduzione upsertata | ✅ PASS |
| Tab Traduzioni Blueprint | ✅ PASS |
| 7 locale disponibili | ✅ PASS |

---

## STEP 4 — Pubblicazione

**Endpoint**: `PATCH /api/admin/published-journeys/{id}` con `{visibility_status: 'published'}`  

| Check | Status |
|-------|--------|
| Status cambia a published | ✅ PASS |
| Pulsante "Pubblica" Blueprint | ✅ PASS |

---

## STEP 5 — 🚨 BLOCCO CRITICO: Listing pubblico

**Endpoint**: `GET /api/public/published-journeys/studio/feed`  
**Problema**: il parametro `featured_only` ha default `True`.  
Un progetto appena pubblicato con `homepage_featured=False` (default) **NON appare nel listing pubblico**.  

| Check | Status | Evidenza |
|-------|--------|---------|
| Progetto nel feed pubblico | ❌ FAIL | `featured_only=True` di default, `homepage_featured=False` di default |
| Workaround: `?featured_only=false` | ✅ funziona ma non controllabile dall'UI |
| Pagina dettaglio diretta (`/projects/slug`) | ✅ PASS | Il progetto è raggiungibile via URL diretto |

**Impatto**: Un cliente pubblica un progetto ma non lo vede nella lista pubblica. Non capisce perché. Nessun toggle visibile nel Blueprint per "Metti in evidenza".

---

## STEP 6 — Frontend pubblico `/projects`

| Check | Status | Evidenza |
|-------|--------|---------|
| Lista `featured` projects | ✅ PASS | 6 progetti con immagini, filtri categoria |
| Dettaglio progetto `/projects/villa-lago-di-como` | ✅ PASS | Hero, titolo italiano, gallery, body |
| Gallery renderizzata | ✅ PASS |
| Hotspot visibili | ✅ PASS |
| YouTube embed | ✅ PASS |
| Traduzione EN-US | ✅ PASS |
| SEO fields (titolo, desc) | ✅ PASS |

---

## VERDETTO PER STEP

| Step | Status |
|------|--------|
| Crea progetto | ✅ PASS |
| Hero + Gallery + Hotspot + YouTube | ✅ PASS |
| Traduzione EN-US | ✅ PASS |
| Pubblicazione | ✅ PASS |
| Appare nel listing pubblico | ❌ FAIL (featured_only=True default) |
| Pagina dettaglio pubblica | ✅ PASS |
| SEO + immagini + video funzionano | ✅ PASS |

**VERDICT: ⚠️ PARTIAL**  
Il progetto è pubblicato e la pagina di dettaglio funziona. Il blocco critico è che un progetto pubblicato non appare nel listing pubblico `/projects` a meno che l'admin non attivi "In evidenza" — e questo toggle non è visibile/chiaro nell'UI Blueprint attuale.
