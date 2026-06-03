# MOOD for DESIGN™ — Product Requirements Document

> **Last update:** 04 Jun 2026
> **Status:** Relationship OS™ Sprint M4 closed · ready for M5

## Original problem statement

MOOD for DESIGN™ is a Relationship Operating System for advisors,
founders and the MOOD team, designed to manage the design relationships
between studios, brands and clients. The product is evolving away from
its early CMS-style surfaces toward a SaaS-first operational OS aligned
with Salesforce Private Banking, Linear, Notion, Attio, Pitch,
Superhuman. Function before aesthetic.

## Core domains

* Knowledge Engine (brands, collections, products, materials, designers)
* Brand Atlas, Brand Embassy, Studio Library Bridge
* CRM / Relationship layer (accounts, contacts, interactions, follow-ups)
* Notification Center (M4 · ready)
* Relationship Center (M5/M6 · planned)
* Advisor Workspace (M6 · planned)

## Implemented (high level)

* ITER204 · Studio Library Bridge (saved entities across types)
* ITER204-B/205 · Entity Navigation Layer (Collection/Product/Material/Designer detail pages)
* Relationship OS™ architecture deliverable + HTML wireframes
* **M4 · Internal Notification Center (04 Jun 2026)** ← see `M4_IMPLEMENTATION_REPORT.md`
  * DB-driven catalog of 9 categories + preferences foundation
  * Bell + drawer + tabs + deep-link nav + archive + HIGH-priority badge
  * APScheduler cron at 08:00 Europe/Rome for `followup_overdue`
  * Strict RBAC on `recipient_user_id`, no cross-user access
  * 20/20 pytest pass · Playwright smoke pass

## Backlog (priority)

### P0
* **M5 · Relationship Center** — 3-col (Summary / Timeline / Follow-up Queue)
* **M6 · Advisor Workspace** — sidebar + KPI + panels (SaaS-style)

### P1
* M3.1 · Voice Notes foundation (audio capture + waveform, no STT)
* M3.2 · Email Activity foundation (counters only, no Gmail OAuth)
* Theme Engine fix & i18n audit (remove residual hardcoded backgrounds)

### P2
* Phase 2 Mail (Gmail/Outlook OAuth)
* Voice STT (Whisper)
* Academy Builder, Magazine Builder, Marketboard Generator
* Persistent Entity Resolution Jobs
* AI-suggested next-best-action per follow-up
* Mobile push notifications

## Key files (current)

* `/app/memory/RELATIONSHIP_OS_ARCHITECTURE_DELIVERABLE.md` — canonical architecture
* `/app/memory/M4_IMPLEMENTATION_REPORT.md` — M4 implementation
* `/app/frontend/public/wireframes/relationship-os/index.html` — wireframes
* `/app/backend/routers/notifications.py` — M4 API
* `/app/backend/services/notification_publisher.py` — emission entrypoint
* `/app/backend/services/notification_cron.py` — APScheduler
* `/app/frontend/src/components/notifications/NotificationBell.jsx` — UI

## Test credentials

See `/app/memory/test_credentials.md`. Default super_admin:
`admin@moodfordesign.com / Blueprint2024!`
