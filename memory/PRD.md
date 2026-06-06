# MOOD for DESIGN™ — Product Requirements Document

> **Last update:** 04 Jun 2026
> **Status:** Review Workspace™ V3.1 closed · ready for M5/M6/M7

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

## Backlog (priority)

### P0
* **KE-002 · Knowledge Engine Control Room™** — Worker Status pill (7 stati) + Live Activity Stream (consuma `extraction_event_log`) + KPI engine deltas + Warning Center 7 categorie cliccabili + Document Queue actions [OPEN/REVIEW/RETRY] + CTA `Apri Review Workspace™`. Backend foundation ready.
* **KE-003 · Review Workspace™ V3.1 deep-link wiring** — UI cablaggio del query param `?type=&focus=` da Warning Center → Entity Inspector. Backend endpoint `/needs-review?type=&include_first=true` già pronto.
* **CRM / Client Relations Refactor** — CREA unique global entry, Studio Intelligence™ section (Memory + Voice Notes), Rollback Modal Atelier rebuild
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
