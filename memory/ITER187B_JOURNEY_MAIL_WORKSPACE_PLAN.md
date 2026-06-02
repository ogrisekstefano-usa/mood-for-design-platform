# ITER187.B · JOURNEY MAIL WORKSPACE™ — Phase 1 UI Plan

**Status:** 🔒 LOCKED · awaiting Founder approval BEFORE any code is written
**Date:** 02 Feb 2026
**Backend dependency:** ITER187.A (already delivered, 25/25 tests pass)
**Audit reference:** Frontend coverage = 0/7 (see previous turn)
**Goal:** Expose the existing `/api/journey-mail/*` backend through a minimal, production-quality Blueprint UI. **No new backend capabilities.**

---

## §0 · GUIDING PRINCIPLE

> Blueprint resta un **Email Intelligence Layer™**, non un client email.
> Questa sprint NON aggiunge capacità: rende usabili quelle già esistenti.

Vietato in questo sprint:
- AI summary / AI reply / AI auto-classification / AI auto-association
- Gmail OAuth / Outlook OAuth / Notification bus
- Calendar integration / Contact sync
- Campaigns / bulk send / "full mailbox client" experience
- Gmail/Outlook aesthetics
- Marketing language / poetic language / "luxury" language (APP-WIDE NAMING LOCK™)

---

## §1 · ROUTE MAP

Sole namespace consentito in Phase 1: `/communications/mail`.

| Route                                           | Page                          | Auth | Scope |
|---|---|---|---|
| `/communications/mail`                          | `MailWorkspaceLayout` (redirect → `/communications/mail/mailboxes`) | Tenant member | Index/landing |
| `/communications/mail/mailboxes`                | `MailboxesPage`               | `mailbox_view` baseline (admin actions gated separately) | Mailbox management cards |
| `/communications/mail/mailboxes/new`            | `MailboxFormDrawer` (modal/drawer over `MailboxesPage`) | `mailbox_admin` (tenant_admin baseline) | Connect new mailbox |
| `/communications/mail/mailboxes/:mailboxId/edit`| `MailboxFormDrawer`           | `mailbox_admin` | Edit existing mailbox |
| `/communications/mail/mailboxes/:mailboxId/health` | inline panel on Mailboxes card (not a separate page) — invoked via the "Test Connection" action | `mailbox_view` | Health probe inline |
| `/communications/mail/messages`                 | `MessagesListPage`            | tenant member, list filtered by mailbox visibility | Operational table |
| `/communications/mail/messages/:messageId`      | `MessageDetailPage`           | resolved via mailbox visibility | Single message + associations |
| `/communications/mail/compose`                  | `ComposePage` (drawer-style)  | `mailbox_send` on selected mailbox | New email composer |

**Routes NOT implemented in this sprint** (placeholders only, not registered):
`/communications/mail/threads`, `/communications/mail/labels`, `/communications/mail/calendar`, `/communications/mail/contacts`, `/communications/mail/templates`, `/communications/mail/automations`.

---

## §2 · INFORMATION ARCHITECTURE — Sidebar registration

The sidebar is consumed at runtime from `useNavigationTree()` which reads from the `modules` Postgres table (`nav_group` + `nav_route` + `nav_section_label`, see `services/tenant_config_resolver.py:resolve_navigation`).

**No frontend code change is required for the sidebar entry.** We will land **migration 121** that inserts one row into `modules`:

| Field | Value |
|---|---|
| `code` | `journey_mail_workspace` |
| `display_name` | `Mail` |
| `nav_group` | `communications` |
| `nav_section_label` | `Communications` (the new group label) |
| `nav_route` | `/communications/mail/mailboxes` |
| `nav_icon` | `Mail` (lucide-react) |
| `nav_visibility` | `tenant` |
| `nav_end_match` | `false` |
| `nav_test_id` | `sidebar-nav-mail` |
| `effective_state` | `enabled` |
| `position` | `10` |
| `group_position` | `40` (after Client Relations, before Operations) |
| `min_role` | `tenant_member` |

Result: a new sidebar **section** "Communications" appears, with one item "Mail". The section IS transversal (not nested under CRM, not nested under Design Journey, not nested under Content) — exactly as the Founder requested.

---

## §3 · PAGE MAP

### `MailWorkspaceLayout`
Frame surrounding all `/communications/mail/*` routes.
- Header: `MAIL` eyebrow + page title + count badge (e.g. "3 mailbox connesse")
- No tabs (the user picks a section from sidebar; tabs would mimic Gmail).
- `Outlet` for sub-pages.
- Empty state lives **inside** each sub-page, not in the layout.

### `MailboxesPage`
Card-grid layout (Blueprint dashboard style — see `pages/dashboard/dashboard-cockpit.css` for spacing tokens we will reuse).

Per-mailbox card (`MailboxCard`):
```
┌─────────────────────────────────────────────────────────────┐
│  ◐ Connected                          [⋯ menu]              │
│                                                             │
│  Projects · Showroom Milano                                 │
│  projects@showroom.it · shared                              │
│                                                             │
│  Ultimo sync: 12 min fa · 1.243 messaggi                    │
│  IMAP: imap.siteground.com · SMTP: smtp.siteground.com      │
│                                                             │
│  [ Sync ora ]  [ Test connessione ]  [ Modifica ]           │
└─────────────────────────────────────────────────────────────┘
```
Card content (per Founder spec):
- mailbox name (`mailbox_name`)
- mailbox address (`from_email`)
- mailbox type pill (`shared` / `team` / `personal` / `system`)
- connection_status badge (Connected / Warning / Error / Disabled)
- health subline (last_health_check_at, IMAP/SMTP host inline if connected)
- last sync timestamp (`last_sync_completed_at`)
- synced messages count (`messages_synced_total`, with inbox/sent split inline)

Actions per card:
| Action | API | Permission |
|---|---|---|
| Test connessione | `GET /mailboxes/:id/health` | `mailbox_view` |
| Sync ora | `POST /mailboxes/:id/sync` | `mailbox_view` |
| Modifica mailbox | `MailboxFormDrawer(edit)` → `PATCH /mailboxes/:id` and/or `PUT /mailboxes/:id/credentials` | `mailbox_admin` |
| Disabilita mailbox | `DELETE /mailboxes/:id` (soft delete) | `mailbox_admin` |

Top-right primary CTA: **"Connetti mailbox"** → opens `MailboxFormDrawer(new)`.

Card states:
- `Connected` → green pill, last sync live
- `Warning` → amber pill, subline "IMAP ok · SMTP error"
- `Error` → red pill, subline "Auth fallita" / "PEEK non supportato"
- `Disabled` (is_active=false) → grey pill, all actions except "Riattiva" disabled

### `MailboxFormDrawer`
Right-side drawer (`vaul`-style) with three sections in a single form:
1. **Identità** · `mailbox_name`, `mailbox_description`, `mailbox_type`, `from_name`, `from_email`, `reply_to_email`
2. **IMAP** · `imap_host`, `imap_port` (default 993), `imap_security` (select ssl/starttls), `imap_username`, `imap_password` (password input, write-only)
3. **SMTP** · `smtp_host`, `smtp_port` (default 587), `smtp_security`, `smtp_username`, `smtp_password`
4. **Visibilità** · `visibility_scope` selector (Tenant / Roles / Members / Owner only)
5. (Optional) Provider hint dropdown: `Gmail · Outlook · SiteGround · Exchange · Custom` → pre-fills hosts/ports.

Edit mode shows `*_password_set: true|false` and a "Ruota password" button → opens a separate modal that asks for the new password and calls `PUT /credentials`. The existing password is **never** displayed.

Footer: "Salva" (POST/PATCH) · "Annulla" · in edit mode also "Disabilita" (DELETE).

### `MessagesListPage`
Blueprint operational table (NOT a Gmail clone). Columns (per Founder spec):
| Col | Source | Notes |
|---|---|---|
| Data | `received_at` | `dd MMM HH:mm` (relative for <24h) |
| Mittente | `from_addr` parsed display name | Tooltip with full address |
| Oggetto | `subject` | Truncated 80ch + `…` |
| Mailbox | resolved from `mailbox_id` | Pill, color from mailbox `connection_status` |
| Direzione | `direction` (inbound/outbound) | Arrow icon |
| Linkata a | first `email_links` entry resolved | "Lead: Mario Rossi" / "Journey: Villa Como" / "—" |

Filters (top toolbar, all combinable):
- **Mailbox** (multi-select, only those visible to the user)
- **Linked / Unlinked** (segment: "Tutte" / "Linkate" / "Da linkare")
- **Direzione** (segment: "Tutte" / "In entrata" / "In uscita")
- **Periodo** (presets: 7g / 30g / 90g / personalizzato)
- **Cerca** (free-text on `subject` via ILIKE)

Pagination: 50 per page, server-side via `limit` + `offset`.

No folders tree. No labels sidebar. No reading pane. Click on a row → push `/communications/mail/messages/:id`.

### `MessageDetailPage`
Two-column layout on wide screens, single column on mobile.

**Left column — message body**
- Subject + sender + recipients (To/Cc) + date + mailbox pill
- "In entrata da info@cliente.it · 12 nov 2025 14:32"
- Body: signed body URL (HTML preferred, fall back to text). `iframe` sandbox=`allow-same-origin` to prevent script execution from third-party HTML.
- Attachments strip with download links (signed URLs via storage).

**Right column — associations panel** (`MessageAssociationsPanel`)
- Header: "Collegamenti"
- For each existing `email_links` row: pill with linked_type icon + linked entity name + ✕ button (DELETE link)
- Below: "Associa a…" dropdown with 4 options:
  - **Lead** → opens entity-picker autocomplete (queries existing `/api/leads`)
  - **Prospect** → entity-picker on `/api/prospects`
  - **Customer** → entity-picker on `/api/customers`
  - **Design Journey** → entity-picker on `/api/projects` (or `/api/design-journeys`)
- Note field (optional, per `email_links.note`).
- Save → `POST /messages/:mid/links`.

No automatic association. No AI suggestion. The dropdown does NOT propose entities.

**Action menu (top-right):**
- Rispondi → `/communications/mail/compose?reply_to=:id`
- Inoltra  → `/communications/mail/compose?forward_of=:id`
- Apri nella mailbox (deep-link to webmail, optional, only if provider hint known)

### `ComposePage` (drawer-style)
Reuses the existing rich-text editor pattern from `ComposeProposalWizard` / `ProposalComposerPage` for body field consistency.

Fields:
- **Da Mailbox** (required) — dropdown of mailboxes with `mailbox_send` permission
- **A**, **Cc**, **Ccn** — token inputs (validated EmailStr)
- **Oggetto**
- **Corpo** — tiptap editor (existing) with text/HTML output; allows attachments via paperclip button
- (When reply/forward) `in_reply_to` and `references` headers are prefilled from query string + the parent message detail

Submit → `POST /mailboxes/:mailboxId/send` with the payload schema already defined in `SendBody`. On 200:
- Toast: "Email inviata. Copia in Sent: ok / non riuscita (warning)"
- Drawer closes
- If `outbound_append_to_sent === false` → secondary persistent banner: "Inviata via SMTP. Copia in Sent non riuscita — il messaggio è registrato nel log uscite di Blueprint."

No drafts. No scheduling. No bulk recipients.

### Phase 4 · Design Journey integration · **Communications tab**
Add a new tab to the existing Design Journey detail page (`ProjectDetailPage.jsx` at `/app/frontend/src/pages/workspace/`).

Tab strip:
```
Overview · References · Proposals · Communications · Files · Notes · Settings
                                    ▲ new
```

`Communications` tab has sub-tabs (NOT in this sprint beyond Emails):
| Sub-tab | Phase | Source |
|---|---|---|
| **Emails** | THIS sprint | `GET /api/journey-mail/messages?linked_type=journey&linked_id=:projectId` |
| Files | future | existing `/files` |
| Notes | future | existing `/notes` |

`Communications/Emails` panel content:
- Reuses the `MessagesListPage` columns minus the "Linkata a" column (implicit context).
- Empty state: see §6.
- Click → `/communications/mail/messages/:id?return=journey/:projectId` (the detail page shows a "Torna al Design Journey" back link).
- Does **not** duplicate inbox; shows only linked messages.

---

## §4 · COMPONENT HIERARCHY

```
src/pages/communications/mail/
├── MailWorkspaceLayout.jsx          (Outlet + page-level header)
├── MailboxesPage.jsx                (card grid)
│    ├── MailboxCard.jsx
│    ├── MailboxStatusBadge.jsx      (Connected/Warning/Error/Disabled)
│    └── MailboxFormDrawer.jsx       (new/edit, 4 sections)
├── MessagesListPage.jsx
│    ├── MessagesToolbar.jsx         (filters)
│    ├── MessagesTable.jsx           (Shadcn Table)
│    └── MessageRow.jsx              (memoized)
├── MessageDetailPage.jsx
│    ├── MessageBodyFrame.jsx        (sandboxed iframe)
│    ├── MessageAttachmentsStrip.jsx
│    └── MessageAssociationsPanel.jsx
│         └── EntityPicker.jsx       (autocomplete; one per linked_type)
└── ComposePage.jsx                  (drawer-style; reuses RichTextEditor)

src/pages/workspace/
└── (modify) ProjectDetailPage.jsx
       └── tabs.communications.emails.jsx   (new tab pane importing MessagesTable in scoped mode)

src/lib/
└── journeyMailApi.js                 (NEW — wraps all 13 endpoints; mirrors knowledgeApi.js)

src/styles/
└── communications-mail.css           (Blueprint tokens; no Gmail styling)
```

**Shared infra reused (no rewrite):**
- `lib/api.js` axios client
- `components/ui/*` (Card, Drawer, Sheet, Badge, Button, Input, Table, Sonner toast)
- `components/ui/sonner` for toasts
- TipTap-based editor from `components/proposals/ComposeProposalWizard`
- `useNavigationTree()` for the sidebar entry

---

## §5 · API MAPPING

Single new API client file `src/lib/journeyMailApi.js`. All endpoints already exist in `/app/backend/routers/journey_mail.py` (ITER187.A).

| UI action | Endpoint | Method | Note |
|---|---|---|---|
| List mailboxes | `/api/journey-mail/mailboxes` | GET | Sidebar visibility-scoped on backend |
| Create mailbox | `/api/journey-mail/mailboxes` | POST | Body = `MailboxCreate` schema |
| Get mailbox detail | `/api/journey-mail/mailboxes/:id` | GET | Passwords masked → boolean |
| Edit mailbox | `/api/journey-mail/mailboxes/:id` | PATCH | Non-credential fields |
| Rotate credentials | `/api/journey-mail/mailboxes/:id/credentials` | PUT | imap and/or smtp password |
| Disable mailbox | `/api/journey-mail/mailboxes/:id` | DELETE | Soft delete |
| Health probe | `/api/journey-mail/mailboxes/:id/health` | GET | Live IMAP+SMTP probe |
| Trigger sync | `/api/journey-mail/mailboxes/:id/sync` | POST | Background task |
| List messages | `/api/journey-mail/mailboxes/:id/messages` | GET | + filters |
| Inverse query | `/api/journey-mail/messages?linked_type=&linked_id=` | GET | Powers Design Journey tab |
| Message detail | `/api/journey-mail/messages/:mid` | GET | Signed body URLs |
| Create link | `/api/journey-mail/messages/:mid/links` | POST | manual only |
| Remove link | `/api/journey-mail/messages/:mid/links/:lid` | DELETE | manual only |
| Send email | `/api/journey-mail/mailboxes/:id/send` | POST | SMTP + APPEND-to-Sent best-effort |

**Polling for sync status:** After triggering sync, the UI polls `GET /mailboxes/:id` every 4s for 60s OR until `last_sync_completed_at` advances. After 60s the UI stops polling and shows a passive last-sync hint; the worker may still be running for very large mailboxes (this is acceptable Phase 1 behaviour and reduces server load).

---

## §6 · PERMISSIONS MAPPING

Backend evaluates `visibility_scope` per request. UI mirrors the same rules client-side **only for affordance** (showing/hiding buttons); the source of truth remains the backend.

| UI surface | Required client signal | Backend check |
|---|---|---|
| See "Connetti mailbox" CTA | `role ∈ {tenant_admin, super_admin}` | `_user_is_super(ctx) or 'tenant_admin' in roles` enforced on `POST /mailboxes` |
| See "Modifica" / "Ruota password" / "Disabilita" buttons on a card | `mailbox_admin` (role-based + `created_by` for `owner_only` mailboxes) | `_require_mailbox(required='mailbox_admin')` |
| See "Sync ora" / "Test connessione" | `mailbox_view` | `_can_access(required='mailbox_view')` |
| See "Componi" CTA from a mailbox card | `mailbox_send` | `_require_mailbox(required='mailbox_send')` on `/send` |
| See "Associa a…" on message detail | `mailbox_link` | `_require_mailbox(required='mailbox_link')` |
| See "Communications · Emails" tab on Design Journey | tenant member | inverse-link query already filters by visibility |

To keep the UI source code stripped of duplicated permission logic, the new `journeyMailApi.js` returns the **error shape** verbatim and the UI surfaces a generic "Permesso insufficiente" toast on 403 — same pattern as the rest of Blueprint.

---

## §7 · DESIGN INTEGRATION STRATEGY

Inherit from existing dashboard/relations design language. No new design tokens.

| Element | Source pattern | File |
|---|---|---|
| Page spacing/typography | DashboardPage | `pages/dashboard/dashboard-cockpit.css` |
| Cards | Shadcn `Card` + Blueprint shadow `--mfd-shadow-soft` | `components/ui/card.jsx` |
| Badges | Shadcn `Badge` + tone variants | `components/ui/badge.jsx` |
| Tables | Shadcn `Table` with Blueprint row hover | `components/ui/table.jsx` |
| Drawers / Sheets | Shadcn `Sheet` (vaul backbone) | `components/ui/sheet.jsx` |
| Toasts | Sonner | `components/ui/sonner.tsx` |
| Tabs (Design Journey · Communications) | Shadcn `Tabs` already used in ProjectDetailPage | `components/ui/tabs.jsx` |
| Empty states | mirror `/app/frontend/src/pages/inspirations/knowledge-engine.css` `.ke-empty` block | `.cm-empty` namespace |

Single new CSS namespace `communications-mail.css` exposing variables `--cm-*` thinly wrapping `--mfd-*` so the file is one screen long.

Icons: lucide-react `Mail`, `Inbox`, `Send`, `Plug`, `RefreshCw`, `ShieldCheck`, `AlertTriangle`, `PowerOff`. No emojis.

---

## §8 · EMPTY STATES (verbatim copy, Italian, operational only)

### `MailboxesPage`
```
Nessuna mailbox connessa.

Collega la tua prima mailbox per sincronizzare le comunicazioni e
associarle ai record CRM e ai Design Journey.

[ Connetti mailbox ]
```

### `MessagesListPage`
```
Nessun messaggio disponibile.

Sincronizza una mailbox per iniziare a importare le comunicazioni.

[ Vai alle mailbox ]
```

### Design Journey · Communications · Emails
```
Nessuna email collegata.

Associa i messaggi dalla sezione Mail per mantenere ordinate le
comunicazioni del progetto.

[ Apri Mail ]
```

### `MessageDetailPage` (no associations yet)
```
Nessun collegamento.

Associa questo messaggio a un lead, prospect, customer o Design Journey.
```

### `ComposePage` (no mailboxes with `mailbox_send`)
```
Nessuna mailbox disponibile per l'invio.

Chiedi all'amministratore del tenant di abilitare i permessi di invio
su almeno una mailbox.
```

No marketing copy. No "curated communications", no "studio correspondence", no "relationship memory". Operational only.

---

## §9 · TESTING PLAN

### 9.1 Frontend lint
- ESLint pass on the 8 new files
- No new dependencies (TipTap + Sheet + Sonner all already in `package.json`)

### 9.2 Backend regression
- Re-run `test_iter187a_journey_mail.py` — must remain 25/25.
- Re-run `test_iter187_knowledge_factory.py` and `test_iter194_brand_catalog_ingestion.py` — no expected impact (no backend code changes), but verified.

### 9.3 Frontend E2E (testing_agent_v3_fork after coding)
Acceptance scenarios (mirror the 10 Founder verification items + the showroom success criteria):

| # | Scenario | Test ID anchors |
|---|---|---|
| 1 | Sidebar shows "Communications · Mail" item after migration | `sidebar-section-communications`, `sidebar-nav-mail` |
| 2 | `/communications/mail/mailboxes` renders empty state when no mailbox | `cm-empty-mailboxes` |
| 3 | "Connetti mailbox" opens drawer, validates required fields | `cm-mailbox-drawer`, `cm-mailbox-submit` |
| 4 | Create mailbox with valid sandbox creds → card appears | `cm-mailbox-card-{id}` |
| 5 | "Test connessione" → live health probe, no credential leak in response | `cm-mailbox-health-btn`, `cm-health-imap-ok` |
| 6 | "Sync ora" → status returns `queued`, polling updates `last_sync_completed_at` | `cm-mailbox-sync-btn` |
| 7 | Messages page renders messages after sync; filters work | `cm-msg-row-{id}`, `cm-msg-filter-mailbox` |
| 8 | Message detail loads body via signed URL | `cm-msg-body-frame` |
| 9 | Associate to Design Journey → link appears in panel | `cm-assoc-add`, `cm-assoc-pill-{id}` |
| 10 | Remove association → link removed | `cm-assoc-remove-{id}` |
| 11 | Composer sends email, toast confirms `outbound_append_to_sent` | `cm-compose-send`, `cm-toast-sent` |
| 12 | Communications · Emails tab on Design Journey shows only linked messages | `dj-comm-tab-emails`, `dj-comm-empty` |
| 13 | Permissions: non-admin user does not see "Modifica" button | absence of `cm-mailbox-edit-{id}` |
| 14 | Tenant isolation: second tenant sees nothing of tenant A's mailboxes | inferred via cross-login test |

### 9.4 No new backend tests required
Backend surface unchanged. The only backend touchpoint is the `modules` row inserted by migration 121 — verified by the migration applier script + a 1-line assertion: navigation tree contains `journey_mail_workspace`.

---

## §10 · ROLLOUT PLAN

Single shippable sprint. No feature flag is required (the migration row alone gates visibility per tenant via `nav_visibility='tenant'`).

Order of work (Founder approval → start):

1. **Migration 121** · single `INSERT INTO modules` for the sidebar entry.
2. **`journeyMailApi.js`** · 13 helpers + axios interceptors already inherited.
3. **`MailboxesPage` + `MailboxCard` + `MailboxFormDrawer`** · Phase 1.
4. **`MessagesListPage` + `MessageDetailPage` + `MessageAssociationsPanel`** · Phases 2 + 3.
5. **`ProjectDetailPage` Communications tab** · Phase 4.
6. **`ComposePage`** · Phase 5.
7. **Empty states + CSS** · Phase 6.
8. **Single smoke screenshot** (login → sidebar → mailboxes empty state).
9. **`testing_agent_v3_fork`** with the 14 scenarios in §9.3.
10. **Founder QA on real `admin@moodfordesign.com`** (after the live IMAP smoke from ITER187.A §9 has been performed by the Founder).

Failure isolation:
- If `testing_agent_v3_fork` flags any frontend-only issue (a11y label, focus ring, copy regression) we patch before declaring done.
- If a backend regression is discovered (it shouldn't be — no backend code change), we revert frontend mounting and ship a 0-line frontend patch.

Out-of-scope from Phase 1 (acceptance ✅ does NOT require these — they go to backlog for Phase 1.5/2):
- Drafts
- Search across full body
- Threaded view
- Per-message audit log viewer
- Bulk select
- Tenant settings page for mailbox quotas
- Replies-while-on-the-Detail-page inline composer

---

## §11 · FILES NEW / TOUCHED (when coding starts — NOT YET)

**New files (10 frontend, 2 backend):**
- `/app/frontend/src/lib/journeyMailApi.js`
- `/app/frontend/src/pages/communications/mail/MailWorkspaceLayout.jsx`
- `/app/frontend/src/pages/communications/mail/MailboxesPage.jsx`
- `/app/frontend/src/pages/communications/mail/MailboxCard.jsx`
- `/app/frontend/src/pages/communications/mail/MailboxFormDrawer.jsx`
- `/app/frontend/src/pages/communications/mail/MessagesListPage.jsx`
- `/app/frontend/src/pages/communications/mail/MessageDetailPage.jsx`
- `/app/frontend/src/pages/communications/mail/MessageAssociationsPanel.jsx`
- `/app/frontend/src/pages/communications/mail/ComposePage.jsx`
- `/app/frontend/src/pages/communications/mail/communications-mail.css`
- `/app/supabase/migrations/121_iter187b_journey_mail_module.sql`
- `/app/scripts/apply_migration_121.py`

**Touched:**
- `/app/frontend/src/App.js` · register the 7 routes
- `/app/frontend/src/pages/workspace/ProjectDetailPage.jsx` · add the "Communications" tab

---

## §12 · DECISION GATE (Founder action required)

Before any code is written I need explicit ✅ on:

1. **Route namespace** = `/communications/mail/*` (not `/journey-mail`, not `/mail`). Confirm?
2. **Sidebar via `modules` table** (migration 121 single row) — accept the data-driven approach instead of hardcoding the entry in `Sidebar.jsx`?
3. **Design Journey tab** added as a new tab `Communications` (with one sub-tab `Emails`) on `ProjectDetailPage.jsx` — confirm the host page is correct?
4. **Composer = drawer route** `/communications/mail/compose` (with `?reply_to=` / `?forward_of=` query params), not an in-place inline composer on detail — confirm?
5. **Body rendering inside a sandboxed `<iframe>`** (sandbox attribute, no allow-scripts) — confirm the security trade-off (some legacy HTML emails may render imperfectly but no XSS risk).
6. **Polling sync status by re-fetching `GET /mailboxes/:id` every 4s for 60s** — confirm, or do you want the simpler "fire and forget + manual refresh" UX?
7. **Migration 121 must touch only the `modules` table** (zero schema change) — confirm.

On 7 ✅ I open the coding sprint following the order in §10.

---

## §13 · NON-NEGOTIABLE FOUNDER LOCK (re-stated)

- ❌ Gmail aesthetics / Outlook aesthetics — non-shippable
- ❌ AI summary / AI reply / AI auto-classification / AI auto-association — non-shippable
- ❌ Bulk send / campaigns / drafts — non-shippable in Phase 1
- ❌ Marketing copy / poetic copy / "luxury correspondence" — non-shippable (APP-WIDE NAMING LOCK™)
- ❌ Automatic email-to-Journey assignment without explicit user click — non-shippable
- ❌ Cross-mailbox or cross-tenant visibility leak — non-shippable
- ❌ Any frontend that bypasses `visibility_scope` enforcement on the backend — non-shippable

Sign-off: **__________________________** (Founder)
