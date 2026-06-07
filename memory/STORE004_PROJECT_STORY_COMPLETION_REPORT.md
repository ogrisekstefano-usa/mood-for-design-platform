# STORE-004 · PROJECT STORY™ COMPLETION REPORT
**Date:** 07 Jun 2026  
**Classification (provisional):** PROJECT_STORY_READY *(pending testing agent E2E)*

## Scope chiuso
Surface narrativa cinematic generata in <5s da una Specification approvata. Knowledge-native (zero snapshot · solo `entity_id`).

## Deliverable
- **DB**: migration `135_store004_project_stories.sql` — tabella `project_stories` (sections JSONB · share_token UUID · status draft/published · source_specification_id / source_material_board_id / source_moodboard_id).
- **Backend** `routers/project_stories.py`:
  - `GET /api/project-stories` · lista (tenant-isolata)
  - `POST /api/project-stories` · create vuota
  - `GET /api/project-stories/{id}` · detail
  - `PATCH /api/project-stories/{id}` · update
  - `DELETE /api/project-stories/{id}` · soft delete
  - `POST /api/project-stories/generate-from-specification/{spec_id}` · **autopopolazione 6 sezioni** leggendo Specification → Material Board → Moodboard
  - `GET /api/story/{share_token}` · **public showroom mode** (no auth · tenant_id/created_by stripped)
- **Frontend** `pages/project-stories/ProjectStoryPages.jsx`:
  - `ProjectStoriesListPage` (lista editoriale `/project-stories`)
  - `ProjectStoryViewer` (full-screen scroll `/project-stories/:id` · toolbar Studio · share token copy · public link)
  - `PublicProjectStoryViewer` (route `/story/:token` · NO chrome studio · pulizia client-side)
- **6 sezioni cinematic** (`project-story.css`):
  1. **Cover** — titolo + cliente + studio + cover_image_url
  2. **Vision** — headline + body (editabile da PATCH sections)
  3. **Moodboard** — entity_ids dal moodboard sorgente (max 16 tile)
  4. **Material Board** — entity_ids dal material board sorgente (max 12 tile · entity_type chip)
  5. **Selected Products** — riga per riga dalle specification_items (brand · nome · tipo · qty · finitura · status)
  6. **Summary** — counts (elementi · moodboard · materiali) + closing line

## CTA wiring
- **Specification Workspace** · CTA "Genera Project Story" visibile **solo se `status ∈ {approved, ready}`** (gated dallo Store Success Path lineare).  
  *File*: `pages/specifications/SpecificationPages.jsx` linee 138-152.
- **Dashboard Editorial** · card "Presentazione Cliente" ora punta a `/project-stories` (era `/workspace/presentations/new`).
- **Routes**:
  - `/project-stories` · lista (App.js:644)
  - `/project-stories/:id` · viewer studio (App.js:645)
  - `/story/:token` · viewer pubblico (App.js:897, fuori dalla shell autenticata)

## Backend smoke (curl · admin Stefano)
- POST generate-from-specification → 201 con 6 sezioni popolate (2 selected_products knowledge-native: ARBI Test Bathroom · Nero finish + Juta mat).
- GET /api/story/{token} senza auth → OK · `tenant_id` rimosso.

## Conformità ai vincoli
- **Knowledge Native**: nessun snapshot · le sections referenziano `entity_id` puri + display_name volutamente cached al momento della generazione (read-only · non drift di SSoT).
- **Blueprint Chameleon™**: viewer full-screen scuro · cover veil + grain · NO white backgrounds (CSS dedicato `project-story.css`).
- **Workflow lineare**: CTA Project Story disabilitata fuori dagli stati `approved/ready`.

## Fuori scope (per scelta utente)
- PDF Export (STORE-004.1 · backlog)
- Editing avanzato (Vision/Cover) inline
- Fallback Material Board → Story
- Generazione da Specification draft/review
- Session Timer / Closing Speed Metric
- Store Mode flag

## Next
- Pass testing_agent_v3_fork sui flussi backend (5 endpoints) + frontend cinematic (lista · viewer studio · viewer pubblico · CTA gating).
- Se PASS → upgrade classification a **PROJECT_STORY_READY** (chiusura 3° P0 dell'audit STORE).
