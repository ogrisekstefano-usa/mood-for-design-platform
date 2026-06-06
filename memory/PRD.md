# MOOD for DESIGN™ — Product Requirements Document

> **Last update:** 06 Jun 2026
> **Status:** KE-003 Knowledge Certification Workspace™ closed · ready for KE-004

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
* **KE-003 · Knowledge Certification Workspace™ (06 Jun 2026)** — 7 P0 chiusi: Warning Deep-Link (`?type=&focus=`), Entity Inspector V3.1 (4 CTAs APPROVA/RIFIUTA/UNISCI/MODIFICA × 3 scope), Scope Correction propagazione, Real Knowledge Impact da entity.mention_count + scope, Failed Document Modal (glass-dark con error/retry/related), Certification Flow gated, Post-Certification toast 5s con KPI reali. New files: `FailedDocumentModal.jsx`+`.css`. Backend endpoint `/documents/{id}/failure-context`. Contract fix: `needs-review` ora ritorna sempre `first_anomaly`. See `KE003_KNOWLEDGE_CERTIFICATION_WORKSPACE_REPORT.md`. Classification: 🟢 KNOWLEDGE_CERTIFICATION_READY.

## Backlog (priority)

### P0
* **KE-004 · Future Uses™ + Knowledge Impact™ wiring** — autowrite di `entity_operational_usage` da moodboard/journey/material_board insertion paths · sfrutta i counts reali già disponibili da KE-002.1 e il ledger `knowledge_impact_events` già popolato da KE-003.
* **KE-003.1 (follow-up, non-blocking)** — replace `window.confirm()` per RIFIUTA con modale glass-dark · typeahead lookup per UNISCI entity_id input · estendere `_compute_real_impact` scope=brand con query cross-catalog-sets · auto-select su `product_id` quando `brand_detected_entities` è vuoto
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
