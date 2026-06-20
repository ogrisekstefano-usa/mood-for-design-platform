# PROJECTS CERTIFICATION REPORT
**Data**: 2026-06-20  
**Sprint**: Final Sales Readiness Sprint  
**Tenant**: studio (MOOD for DESIGN™)

---

## CERTIFICAZIONE: Published Design Journeys

### Fonte dati pubblica
| Endpoint | Status | Note |
|----------|--------|------|
| `GET /api/public/published-journeys/{tenant}` | ✅ PASS | Legge da `published_design_journeys` (reale, no mock) |
| `GET /api/public/published-journeys/{tenant}/{slug}` | ✅ PASS | Restituisce `gallery`, `body_blocks` da `story_content` |

### Blueprint Admin
| Endpoint | Status | Note |
|----------|--------|------|
| `GET /api/admin/published-journeys/` | ✅ PASS | Lista tutti i journeys del tenant |
| `POST /api/admin/published-journeys/` | ✅ PASS | Crea nuovo journey |
| `GET /api/admin/published-journeys/{id}` | ✅ PASS | Dettaglio + traduzioni |
| `PATCH /api/admin/published-journeys/{id}` | ✅ PASS | Aggiorna campi + `story_content` |
| `DELETE /api/admin/published-journeys/{id}` | ✅ PASS | Archivia (soft delete) |
| `PUT /api/admin/published-journeys/{id}/translations/{locale}` | ✅ PASS | Upsert traduzione |
| `GET /api/admin/published-journeys/{id}/translations` | ✅ PASS | Lista traduzioni |

### Frontend Blueprint (`/blueprint/projects-studio`)
| Feature | Status | Note |
|---------|--------|------|
| Lista projetti nel rail | ✅ PASS | 6 journeys pubblicati |
| Selezione e caricamento dettaglio | ✅ PASS | Item + translations caricate |
| Tab "Progetto" | ✅ PASS | Tutti i campi presenti |
| Gallery via `ProjectGalleryEditor` | ✅ PASS | Legge/scrive `story_content.gallery` |
| Hotspot via `ProjectGalleryEditor` | ✅ PASS | Hotspot per immagine in `story_content.gallery[n].hotspots` |
| Body blocks via `StorySectionsEditor` | ✅ PASS | Legge/scrive `story_content.body_blocks` |
| Blocco YouTube | ✅ PASS | URL → `video_id` estratto, iframe preview |
| Tab "Traduzioni" | ✅ PASS | 7 locali selezionabili |
| Salvataggio traduzione | ✅ PASS | Upsert via `PUT` |
| Tab "SEO & Visibilità" | ✅ PASS | SEO fields + visibility_status |
| Pubblica progetto | ✅ PASS | PATCH visibility_status = 'published' |
| Archivia progetto | ✅ PASS | PATCH visibility_status = 'archived' |
| Crea nuovo progetto | ✅ PASS | Modale con auto-slug |

### Frontend Pubblico (`/projects/:slug`)
| Feature | Status | Note |
|---------|--------|------|
| Gallery renderizzata | ✅ PASS | Legge `p.gallery` (da `story_content`) |
| Hotspot pubblici | ✅ PASS | `PublicHotspotImage` con `p.gallery[n].hotspots` |
| Body blocks YouTube | ✅ PASS | Iframe embed `youtube.com/embed/{video_id}` |
| Dati da DB reale | ✅ PASS | Zero mock data |

### Struttura DB
| Campo | Tabella | Type | Note |
|-------|---------|------|------|
| `story_content` | `published_design_journeys` | JSONB | `{gallery: [...], body_blocks: [...]}` |
| `locale` | `published_design_journey_translations` | text | BCP-47 |

---

## DOMANDA CLIENTE — RISPOSTA

| Domanda | Risposta |
|---------|----------|
| Posso creare un progetto da Blueprint? | **SÌ** |
| Posso pubblicarlo? | **SÌ** |
| Posso tradurlo? | **SÌ** (7 lingue BCP-47) |
| Posso modificare immagini/gallery? | **SÌ** (ProjectGalleryEditor) |
| Posso modificare hotspot? | **SÌ** (HotspotCanvas in gallery) |
| Posso modificare video YouTube? | **SÌ** (StorySectionsEditor, tipo youtube) |

**VERDICT: ✅ PASS**
