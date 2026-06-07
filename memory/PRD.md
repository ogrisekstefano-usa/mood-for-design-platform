# MOOD for DESIGN™ — Product Requirements Document

> **Last update:** 06 Jun 2026
> **Status:** KE-005B.1 Foundation closed · 9/9 backend pytest PASS · ready for KE-005B.2 Surfaces UI

## Original problem statement

MOOD for DESIGN™ is a Relationship Operating System for advisors,
founders and the MOOD team, designed to manage the design relationships
between studios, brands and clients. The product is evolving away from
its early CMS-style surfaces toward a SaaS-first operational OS aligned
with Salesforce Private Banking, Linear, Notion, Attio, Pitch,
Superhuman. Function before aesthetic.

## Core domains

* Knowledge Engine (brands, collections, products, materials, designers)
  · **Review Workspace™ V3.1 ✅**
* Brand Atlas, Brand Embassy, Studio Library Bridge
* CRM / Relationship layer (accounts, contacts, interactions, follow-ups)
* Notification Center (M4 · ready)
* Relationship Center (M5/M6 · planned)
* Advisor Workspace (M6 · planned)
* Project Impact™ (M7 · placeholder only — schema ready)

## Implemented (high level)

* ITER204 · Studio Library Bridge (saved entities across types)
* ITER204-B/205 · Entity Navigation Layer
* Relationship OS™ architecture deliverable + HTML wireframes
* **M4 · Internal Notification Center (04 Jun 2026)**
* **Brand Registry Enhancement™ (04 Jun 2026)** — multi-categories + Tag system
* **Review Workspace™ V3.1 (04 Jun 2026)** — 4-col workspace (PDF → Knowledge Package → Brand Atlas → Ecosistema MOOD). See `REVIEW_WORKSPACE_V3_IMPLEMENTATION_REPORT.md`.
  * Migration 129 · `entity_operational_usage` (SSoT Future Uses) + `entity_future_uses_v` (view) + `knowledge_impact_events` (ROI ledger) + `entity_project_impact` (M7 placeholder)
  * 4 endpoints: future-uses · connected-assets · project-impact · apply-correction
  * React components: KnowledgeStrip · DocumentNavigator · DocumentViewer · EntityInspector (tabs Overview/Connected/Future/Project) · AIValidation (tri-scope) · KnowledgeImpactCard · PostCertificationLaunchpad
  * 6/6 backend pytest PASS · 100% testing agent PASS · SSoT audit clean
* **KE-001 · Knowledge Engine Production Reliability (05 Jun 2026)** — persistent `extraction_jobs`, `extraction_event_log`, 60s orphan recovery scheduler, document-level retry. Migration 131 applied. AC17 passed on RIVA1920.
* **KE-002 · Knowledge Engine Control Room™ (06 Jun 2026)** — 5-component Mission Control panel (Worker Status pill 7 stati · KPI strip · Live Activity Stream · Warning Center 7 categorie · Document Queue OPEN/REVIEW/RETRY). See `KE002_CONTROL_ROOM_IMPLEMENTATION_REPORT.md` + `KE002_VISUAL_REVIEW_REPORT.md`.
* **KE-002.1 · Value Wiring (06 Jun 2026)** — chiusura 3 P0 percettivi: KPI strip su counts reali (333 prodotti/26 designer/12 materiali per RIVA1920) · semantic event stream (PRODUCT_FOUND / DESIGNER_FOUND / MATERIAL_FOUND / IMAGE_FOUND) · 6 condition-based warning filters. New file `services/knowledge_kpi.py`. Backfill endpoint `/catalog-sets/{id}/backfill-semantic-events`. See `KE002_1_VALUE_WIRING_REPORT.md`. Classification: 🟢 READY_FOR_KE003.
* **KE-003 · Knowledge Certification Workspace™ (06 Jun 2026)** — 7 P0 chiusi: Warning Deep-Link (`?type=&focus=`), Entity Inspector V3.1 (4 CTAs APPROVA/RIFIUTA/UNISCI/MODIFICA × 3 scope), Scope Correction propagazione, Real Knowledge Impact da entity.mention_count + scope, Failed Document Modal (glass-dark con error/retry/related), Certification Flow gated, Post-Certification toast 5s con KPI reali. New files: `FailedDocumentModal.jsx`+`.css`. Backend endpoint `/documents/{id}/failure-context` + `/documents/{id}/pages` (Doc Viewer P0-5b · contenuto reale per pagina). Contract fix: `needs-review` ora ritorna sempre `first_anomaly`. See `KE003_KNOWLEDGE_CERTIFICATION_WORKSPACE_REPORT.md`. Classification: 🟢 KNOWLEDGE_CERTIFICATION_READY.
* **KE-004 · Future Uses™ + Connected Assets™ (06 Jun 2026)** — 5 P0 chiusi: Future Uses con sezione duale UTILIZZATO IN / DISPONIBILE PER (8 surfaces mappate) · Connected Assets™ hub-and-spoke (10 tipologie nodo da 682 brand_entity_relations) · Knowledge Impact History timeline da `knowledge_impact_events` (8 eventi reali · scope color-coded) · Certification Metrics nel Knowledge Strip (DECISIONI · PROPAGATE · TEMPO CERT) · Operational Readiness 5 surfaces (Moodboard / Design Journey / Material Board / Client Presentation / Brand Atlas) con regole server-side. 3 nuovi endpoint backend: `impact-history`, `certification-metrics`, `operational-readiness`. New files: `OperationalReadinessPanel.jsx`, `ImpactHistoryTimeline.jsx`. See `KE004_FUTURE_USES_CONNECTED_ASSETS_REPORT.md`. Classification: 🟢 ECOSYSTEM_READY.
* **KE-005A · Moodboard Knowledge Audit (06 Jun 2026)** — READ-ONLY · Moodboard classificata LEGACY_ISLAND (0/4 hook al KE · 5/8 drift SSoT). See `KE005A_MOODBOARD_KNOWLEDGE_INTEGRATION_AUDIT.md`.
* **KE-005B.0 · Design Journey Knowledge Audit (06 Jun 2026)** — READ-ONLY · Design Journey LEGACY_ISLAND transitivo (linked_entity_id → moodboards.id, non a Brand Atlas). Proposta sprint unificato KE-005B. See `KE005B0_DESIGN_JOURNEY_KNOWLEDGE_AUDIT.md`.
* **KE-005B.0.5 · Entity Usage Architecture Review (06 Jun 2026)** — READ-ONLY · validata foundation cross-surface · 8/8 surface coperte dallo schema esistente · Entity Context Panel™ design. See `KE005B05_ENTITY_USAGE_ARCHITECTURE_REVIEW.md`.
* **KE-005B.1 · Knowledge-Native Surfaces™ Foundation (06 Jun 2026)** — backend-only · migration 132 (entity_id su moodboard_elements, entity_refs JSONB su journey_milestones, source_type/target_type su brand_entity_relations, view entity_usage_lookup_v) · service `knowledge_usage_hooks.py` riscritto (5 direttive utente · idempotente · tenant-isolated · zero scrittura in knowledge_impact_events) · side-effect attach/detach wired in `moodboards_v1.py` + `design_journey.py` · endpoint aggregator `GET /api/knowledge/entities/{id}/context-panel` (9 sezioni nell'ordine approvato) · pytest suite 9/9 PASS. See `KE005B_FOUNDATION_REPORT.md`. Classification: 🟢 FOUNDATION_READY.
* **Dashboard Editorial Redesign (07 Jun 2026)** — `AtelierDashboardPage.jsx` riscritta come "Editorial Studio". 7 sezioni: Hero immersivo (NO KPI), Spotlight "In evidenza oggi", 4 Destination cards Netflix-style (Nuovo Journey · Crea Moodboard · Material Board · Presentazione Cliente), Progetti attivi visuali (immagine + stato + ultimo movimento + cliente), MOOD Intelligence™ live (suggerimenti calcolati da DB · no LLM), Attività narrative, Ecosistema MOOD™ 8 KPI patrimonio. KPI CRM eliminati. Backend nuovo `GET /api/dashboard/ecosystem-snapshot` + `POST /api/workspace/prepare-intent`. `PersistentAlertBanner` nascosta su /dashboard. 2 nuove pagine: `WorkspacePreparePage` (wizard premium per Material Board + Presentazione Cliente). CSS editoriale `atelier-dashboard-editorial.css` (refs Apple/AD/Mohd/Artemest).
* **KE-005B.2 · Knowledge-Native Surfaces UI (07 Jun 2026)** — Moodboard e Design Journey diventano i primi consumatori reali del Brand Atlas. Nuovi componenti condivisi in `/components/knowledge/`: `EntityPicker.jsx` (Spotlight-style universal search · refs macOS Spotlight/Linear/Raycast · typeahead live ILIKE · filter chip per tipologia · keyboard nav arrows + enter + esc); `EntityContextPanel.jsx` (cuore dell'ecosistema · 9 sezioni nell'ordine approvato · Hero · Brand/Designer/Collection · Operational Readiness · Future Uses™ + Connected Assets™ visivamente evidenti · Certification · Materials · Provenance · Actions); `KnowledgeAnchorsRail.jsx` (riusabile · usa `/api/surfaces/{type}/{id}/attach|detach|entities`). Wire in `MoodboardEditor.jsx`: intercetta `addBlock('product'|'material'|'designer')` → apre EntityPicker → POST `/blocks` con `entity_id` · click su block con entity_id mostra chip "Knowledge" → apre EntityContextPanel · swap entity supportato. Wire in `MoodboardDirectionWorkspace.jsx` e `MaterialDirectionWorkspace.jsx`: KnowledgeAnchorsRail su milestone con SSoT via `entity_id`. Smoke test E2E verificato live (40 prodotti reali da Brand Atlas mostrati nel picker).
* **Store Success Path Audit™ (07 Jun 2026)** — READ-ONLY · audit completo delle 10 fasi Cliente→Approvazione · 3 P0 blocker identificati per go-live 4 luglio (Material Board UI · Specification Package · Client Presentation cinematic) · 17 surface da nascondere in modalità STORE · Priority matrix P0/P1/P2 · roadmap 4 settimane. See `STORE_SUCCESS_PATH_AUDIT.md`.
* **STORE-002 · Material Board Studio™ (07 Jun 2026)** — surface autonoma knowledge-native chiusura primo P0 dell'audit. Migration 133 (`material_boards` + `material_board_elements` con `entity_id` soft-FK). Backend router completo (`/api/material-boards` CRUD + add/remove element + `convert-from-moodboard/{moodboard_id}` con preselezione automatica entità material/finish + `/palette` auto-extract). Pages: `MaterialBoardsListPage.jsx` (editorial list con 6 template pills · Residenziale/Cucina/Hospitality/Retail/Outdoor/Luxury) + `MaterialBoardWorkspace.jsx` (canvas drag&drop + library con EntityPicker + element click → EntityContextPanel · riusa al 100% i componenti KE-005B.2). Route `/material-boards` + `/material-boards/:id`. CTA "Converti in Material Board" nel MoodboardEditor (visibile quando approved · clona materiali certificati). Smoke test E2E live: 21 finiture reali del Brand Atlas selezionabili via Spotlight picker (Nero · Bianco · Rovere · Laminam · Oak · Ceramica...). Single Source of Truth garantita: nessuno snapshot · solo `entity_id`.
* **STORE-003 · Specification Package™ (07 Jun 2026)** — chiusura 2° P0 dell'audit · documento operativo per chiudere la trattativa. Migration 134 (`specification_packages` + `specification_items` con entity_id soft-FK + status proposed/confirmed/replaced/removed). Backend `routers/specifications.py` completo (CRUD pkg/item + `convert-from-moodboard` + `convert-from-material-board` con autopopolazione · brand hydration in detail). Pages unificate in `SpecificationPages.jsx` (List + Workspace) + CSS editoriale. Workspace: header (titolo editabile + status dropdown draft/review/approved/ready + CTA Aggiungi), 3 summary tiles (Elementi · Confermati · Stima € live computed), tabella editoriale 10 colonne (Brand · Nome · Tipo · Quantità · Unità · Finitura · Codice · Prezzo · Stato · Trash) tutti editabili inline. CTA "Converti in Specification" su MaterialBoardWorkspace. Smoke test E2E live: row "ARBI Test Bathroom · Nero ✓ FINISH · 1 pz · Proposto" knowledge-native con cert badge da Brand Atlas.

## Backlog (priority)

### P0
* **KE-005 · TBD** — eventuale sprint successivo: Designer Journey UI o Moodboard Engine o Page Visual (PDF rendering) o cross-catalog Brand Atlas — in attesa di direttiva utente
* **KE-003.1 (follow-up, non-blocking)** — replace `window.confirm()` per RIFIUTA con modale glass-dark · typeahead lookup per UNISCI · estendere `_compute_real_impact` scope=brand con query cross-catalog-sets · auto-select su `product_id` quando `brand_detected_entities` è vuoto
* **CRM / Client Relations Refactor** — **ON HOLD by user**
* **Project Detail Page** — premium SaaS design coherent with new Projects index

### P1
* **KE-004 · Future Uses™ + Knowledge Impact™ wiring** — autowrite di `entity_operational_usage` da moodboard/journey/material_board insertion paths
* **KE-005 · Designer Journey Integration™** — entity → moodboard/journey single click
* **M6 · Advisor Workspace** — sidebar + KPI + panels (SaaS-style)
* M3.1 · Voice Notes foundation (audio capture + waveform, no STT)
* M3.2 · Email Activity foundation (counters only, no Gmail OAuth)
* PDF viewer real (react-pdf) inside Document Viewer column
* Theme Engine fix & i18n audit (remove residual hardcoded backgrounds)

### P2
* **M7 · Project Impact™** — wire real economic KPIs into the placeholder schema
* Phase 2 Mail (Gmail/Outlook OAuth)
* Voice STT (Whisper)
* Academy Builder, Magazine Builder, Marketboard Generator
* Persistent Entity Resolution Jobs
* AI-suggested next-best-action per follow-up
* Mobile push notifications
* TTL cron purge on `extraction_event_log` (view `extraction_event_log_to_purge` ready)

## Key files (current)

* `/app/memory/RELATIONSHIP_OS_ARCHITECTURE_DELIVERABLE.md` — canonical architecture
* `/app/memory/M4_IMPLEMENTATION_REPORT.md` — M4 implementation
* `/app/memory/BRAND_REGISTRY_ENHANCEMENT_REPORT.md` — Brand Registry
* `/app/memory/REVIEW_WORKSPACE_V3_IMPLEMENTATION_REPORT.md` — Review Workspace V3.1
* `/app/frontend/public/wireframes/relationship-os/index.html` — wireframes
* `/app/frontend/public/wireframes/review-workspace[-v2|-v3]/` — Review Workspace mockups
* `/app/backend/routers/review_workspace_v3.py` — V3.1 API
* `/app/backend/routers/notifications.py` — M4 API
* `/app/backend/services/notification_publisher.py` — emission entrypoint
* `/app/backend/services/notification_cron.py` — APScheduler
* `/app/frontend/src/components/review-workspace/` — V3.1 React components
* `/app/frontend/src/components/notifications/NotificationBell.jsx` — UI

## Test credentials

See `/app/memory/test_credentials.md`. Default super_admin:
`admin@moodfordesign.com / Blueprint2024!`
