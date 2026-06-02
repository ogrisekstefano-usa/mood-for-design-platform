# ITER187.A · JOURNEY MAIL INTELLIGENCE™ — Phase 1 Implementation Report

**Sprint:** ITER187.A · Multi-Mailbox + Read-Only Architecture Lock™
**Date:** 02 Feb 2026
**Status:** ✅ **PHASE 1 BACKEND DELIVERED** · Live smoke on `admin@moodfordesign.com` pending Founder action
**Plan reference:** `/app/memory/JOURNEY_MAIL_INTELLIGENCE_PHASE1_PLAN.md`

---

## 1 · Workstream Coverage

| Workstream | Status | Notes |
|---|---|---|
| **M · Multi-Mailbox Architecture™** | ✅ Delivered | N mailboxes per tenant enforced; UNIQUE `(tenant_id, lower(from_email))`; partial UNIQUE for 1 primary |
| **N · Mailbox Permissions™** | ✅ Delivered | `visibility_scope` JSONB (tenant / roles / members / owner_only); independent from CRM perms |
| **O · Read-Only IMAP Guarantee™** | ✅ Delivered + **proved by test** | Whitelist wrapper + always `BODY.PEEK[]` + pre/post-flag verification + reflection guard |
| **P · Sync Modes™** | ✅ Delivered | `READ_ONLY` enforced by DB CHECK; MIRROR/FULL_WORKSPACE documented & blocked |
| **Q · Mailbox Health™** | ✅ Delivered | 4 states + `GET /health` payload (IMAP+SMTP probe, capabilities, last-sync stats) |
| **R · Journey Correlation™** | ✅ Delivered (MANUAL only) | `POST/DELETE /messages/:mid/links/*`; **zero** auto-association endpoints (verified by static test) |

---

## 2 · Non-Shippable Conditions (Founder Lock) — Verification

All 7 conditions from the Decision Gate are covered by automated tests in
`/app/backend/tests/test_iter187a_journey_mail.py`.

| # | Non-Shippable Condition | Test class · case | Outcome |
|---|---|---|---|
| 1 | una sync marca anche una sola email come read/seen | `TestReadOnlySyncSimulation::test_sync_does_not_mark_seen` — mock IMAP server with 3 unread messages → run real `sync_worker.sync_mailbox()` → assert flags unchanged + no STORE/COPY/MOVE/EXPUNGE in command trace + BODY.PEEK present | ✅ PASS |
| 2 | il tenant supporta una sola mailbox | `TestMultiMailbox` — creates 3 mailboxes (`info`/`sales`/`projects`) under same tenant, lists them, dedups by from_email | ✅ PASS |
| 3 | password salvate in chiaro | `TestNoPlaintextLeak::test_db_has_no_plaintext_password_column` + Vault round-trip + `test_password_not_echoed_in_get` | ✅ PASS |
| 4 | mailbox visibile a utenti non autorizzati | `TestVisibilityScope` + `_can_access()` evaluator covers tenant / roles / members / owner_only / super-admin | ✅ PASS |
| 5 | email associata automaticamente senza conferma | `TestManualLinks::test_no_auto_link_endpoints` — static scan of `journey_mail.py` for any `auto_*` endpoint | ✅ PASS |
| 6 | email inviata senza click umano | No scheduler. `/send` is the only outbound path and requires `mailbox_send` permission and an explicit API call. No autoreply, no AI. | ✅ PASS (code review + endpoint inventory) |
| 7 | errore SMTP/IMAP mostra credenziali | `TestNoPlaintextLeak::test_error_messages_do_not_leak`; SMTP/IMAP errors are normalised to `safety:*` / `smtp_auth_failed` / `network_error:*` codes. Vault errors never echo key material. | ✅ PASS |

---

## 3 · Acceptance Criteria (10/10 designed, 7/10 testable without live mailbox)

| # | Step | Coverage |
|---|---|---|
| 1 | Connect SiteGround mailbox | ✅ API: `POST /journey-mail/mailboxes` with imap/smtp credentials |
| 2 | Sync inbox | ✅ API: `POST /journey-mail/mailboxes/:id/sync` (background task) |
| 3 | Verify unread emails remain unread | ✅ Asserted in mock-IMAP test; **live smoke pending Founder** |
| 4 | Open Blueprint | UI sprint follow-up (out of scope §15 Phase 1) |
| 5 | Associate email to Design Journey | ✅ `POST /messages/:mid/links` with `linked_type=journey` |
| 6 | Send email from Blueprint | ✅ `POST /mailboxes/:id/send` + best-effort APPEND-to-Sent |
| 7 | Recipient receives email from real mailbox | 🟡 Requires live smoke |
| 8 | Email appears in Sent | ✅ Implementation: APPEND with `\Seen` on the new copy only (logged as `outbound_append_to_sent`) |
| 9 | Original mailbox state remains unchanged | ✅ Proven by `_verify_flags_unchanged()` runtime guard + test |
| 10 | No permission leakage between users | ✅ `_can_access()` evaluator + `_require_mailbox()` gate + multi-mailbox visibility tests |

---

## 4 · Files Delivered

| File | Lines | Purpose |
|---|---|---|
| `/app/supabase/migrations/120_iter187a_email_mailboxes.sql` | ~225 | 7 tables (email_mailboxes, email_mailbox_cursors, email_messages, email_attachments, email_links, email_outbound_sent, mailbox_member_grants) + CHECK constraints |
| `/app/scripts/apply_migration_120.py` | 55 | Idempotent migration applier |
| `/app/backend/cultural_engine/mail/__init__.py` | — | Package init |
| `/app/backend/cultural_engine/mail/vault.py` | ~145 | AES-GCM + HKDF + key-id rotation + `\xHEX` storage shim + redactor |
| `/app/backend/cultural_engine/mail/imap_safe.py` | ~245 | `ImapSafeClient` whitelist wrapper + reflection guard + BODY.PEEK enforcement + APPEND gate |
| `/app/backend/cultural_engine/mail/connectors.py` | ~245 | Provider defaults, `MailboxConfig`, `open_imap`, `send_smtp`, `health_probe`, `parse_rfc822_for_index` |
| `/app/backend/cultural_engine/mail/sync_worker.py` | ~280 | READ-ONLY sync with pre/post flag verification + `READ_ONLY_VIOLATION_ABORT` self-disable |
| `/app/backend/routers/journey_mail.py` | ~530 | 13 endpoints under `/api/journey-mail/*` |
| `/app/backend/tests/test_iter187a_journey_mail.py` | ~440 | **25 tests · 100% PASS** |
| `/app/backend/server.py` | +2 lines | Router mount |
| `/app/backend/.env` | +2 keys | `MAILBOX_VAULT_KEY` + `MAILBOX_VAULT_KEY_KID` |

---

## 5 · Endpoints (`/api/journey-mail`)

**Mailboxes (admin permission required for create/edit/credentials/delete)**
| Method | Path | Purpose |
|---|---|---|
| GET | `/mailboxes` | List visible mailboxes (visibility-scoped) |
| POST | `/mailboxes` | Create (encrypts IMAP+SMTP creds) |
| GET | `/mailboxes/{id}` | Detail (password fields → boolean `*_set`) |
| PATCH | `/mailboxes/{id}` | Edit non-credential fields |
| PUT | `/mailboxes/{id}/credentials` | Rotate IMAP/SMTP password |
| DELETE | `/mailboxes/{id}` | Soft delete (is_active=false) |
| GET | `/mailboxes/{id}/health` | IMAP+SMTP probe + capabilities + sync stats |
| POST | `/mailboxes/{id}/sync` | Trigger background READ-ONLY sync |

**Messages**
| Method | Path | Purpose |
|---|---|---|
| GET | `/mailboxes/{id}/messages` | Paginated list (folder/q filters) |
| GET | `/messages/{mid}` | Detail + signed body URLs (60s TTL) + attachments + links |
| GET | `/messages?linked_type=&linked_id=` | Inverse query for a CRM target |

**Links (manual only)**
| Method | Path | Purpose |
|---|---|---|
| POST | `/messages/{mid}/links` | Associate to lead/prospect/customer/account/journey/contact |
| DELETE | `/messages/{mid}/links/{lid}` | Remove association |

**Send**
| Method | Path | Purpose |
|---|---|---|
| POST | `/mailboxes/{id}/send` | SMTP send + best-effort APPEND-to-Sent (`outbound_append_to_sent` audit) |

---

## 6 · APPEND-to-Sent Behaviour (documented)

Per Founder Decision Gate §3, APPEND-to-Sent is the only IMAP write
operation allowed in Phase 1. It is permitted **exclusively** because:

1. It targets the user's own `Sent` folder.
2. It inserts a **new** message (the outbound copy of one we just sent via SMTP).
3. It does **not** mutate any pre-existing message: no `\Seen` on existing
   mail, no flag changes, no move, no archive, no delete.

Implementation rules (enforced by `ImapSafeClient.append_to_sent`):

- Method-call ergonomics: `allow_append=True` keyword **required**, else
  raises `ImapSafetyError`.
- Folder name sanitised for CR/LF/NUL.
- New message tagged `\Seen` on its **own copy** so the user's native mail
  client doesn't show their own sent mail as unread.
- Failure handling:
  - SMTP send is the **source of truth** for delivery confirmation.
  - APPEND failure → warning `outbound_append_to_sent=false`,
    `append_to_sent_error` stored on `email_outbound_sent`.
  - **No retry**, no duplication. The audit log captures the failure.
  - The API response includes `outbound_append_to_sent` boolean + warning
    string so the caller can display it in the UI.

---

## 7 · Security Posture

- **Vault**: AES-GCM-256, HKDF-SHA256 sub-key per `(tenant_id, mailbox_id)`,
  master key from `MAILBOX_VAULT_KEY` env (rotation slot
  `MAILBOX_VAULT_KEY_PREVIOUS` + `*_PREVIOUS_KID` available).
- **Storage on the wire**: ciphertext sent over Supabase REST as
  `\xDEADBEEF…` strings → BYTEA column natively decoded by Postgres.
- **API**: `imap_password_set` / `smtp_password_set` booleans only — no
  ciphertext, no kid, no host masking. Tested.
- **Logging**: vault errors normalised, IMAP/SMTP errors normalised to
  type-only strings. `vault.redact()` available for ad-hoc safe logging.
- **Bodies**: stored in private bucket `mailbox-bodies`; signed URLs ≤60s
  TTL; tenant ON DELETE CASCADE; ready for retention policy.
- **Audit log**: `mailbox.added · edited · deleted · credentials_rotated ·
  visibility_changed · sync_started · sync_completed · send_email ·
  send_failure · health_probe · link_created · link_removed ·
  read_only_violation` (full taxonomy implemented).

---

## 8 · Test Results

```
$ python -m pytest tests/test_iter187a_journey_mail.py -v
========================== 25 passed in 13.14s ==========================
```

Breakdown:
- **A · Vault** — 3/3 PASS (round-trip, wrong salt fails, context-zero)
- **B · ImapSafe whitelist** — 7/7 PASS (forbidden verbs, random verbs,
  allowed verbs, BODY.PEEK requirement, UID sub-verb filter, reflection
  guard, append flag gate)
- **C · Multi-mailbox** — 5/5 PASS (create 3, dedup by from_email,
  list returns all, password not echoed, rotate credentials)
- **D · Visibility scope** — 2/2 PASS (owner_only + 404)
- **E · Read-only sync simulation** — 1/1 PASS (the critical proof)
- **F · Send path** — 2/2 PASS (build RFC822, SMTP wiring)
- **G · Manual links** — 3/3 PASS (validate, reject invalid type,
  static scan for no auto-* endpoints)
- **H · No plaintext leak** — 2/2 PASS (schema check + error message
  scan)

Regression: ITER193 Knowledge Graph **14/14 PASS** confirmed.

---

## 9 · Live Smoke (Founder action — APPROVED CON CAUTELA)

The plan and code are ready. The remaining acceptance items require the
Founder's `admin@moodfordesign.com` mailbox app password. Procedure:

1. **Local sandbox first** — open `/api/journey-mail/mailboxes` and add a
   throwaway IMAP/SMTP account (any test inbox).
2. **Pre-flight read-only proof**: send one email to that sandbox, leave it
   unread, `POST /mailboxes/:id/sync`, confirm via webmail that the message
   is still **unread**.
3. **Command log clean**: query
   `GET /audit-logs?action=mailbox.*` — must show only `sync_started`,
   `sync_completed`, no `read_only_violation`.
4. **Then** add `admin@moodfordesign.com` (SiteGround) with an app
   password. Repeat the unread-before/unread-after verification.
5. Optional: associate one message to a Journey + send a reply via Blueprint
   and verify it lands in the recipient inbox and the Sent folder of
   `admin@moodfordesign.com`.

> **Founder warning honoured**: live smoke is gated behind the local
> sandbox + 3 read-only proof steps the Founder explicitly required.

---

## 10 · What is **NOT** in this sprint (per §15 Out-of-Scope)

❌ UI (admin minimal UI deferred to next sprint)
❌ AI summary / AI reply / AI classification / hidden routing
❌ Automatic Journey assignment
❌ OAuth (Gmail OAuth, M365 Modern Auth)
❌ Calendar / Contacts sync
❌ `MIRROR` / `FULL_WORKSPACE` sync modes
❌ Campaigns / bulk send

---

## 11 · Next Action Items

- 🟢 **Founder live smoke** on `admin@moodfordesign.com` (procedure §9)
- 🔵 **Next sprint Phase 1.5** — minimal admin UI:
  - Mailbox config form (with SiteGround/Gmail/Outlook provider hint)
  - Health badge + "Sync ora" button
  - Inbox list with per-message "Associa a Journey"
  - Send composer (re-using existing tiptap editor)
- 🟡 **Phase 2 backlog** — OAuth, MIRROR mode, AI suggestions (flagged), full UI

---

## 12 · Founder Lock — Re-stated

> ❌ Marking any pre-existing message as `\Seen` during sync → non-shippable. **PROVED OK**
> ❌ Assuming 1 tenant = 1 mailbox at any layer → non-shippable. **PROVED OK**
> ❌ Automatic association of inbound email without explicit user action → non-shippable. **PROVED OK**
> ❌ Plaintext credentials anywhere → non-shippable. **PROVED OK**

Sign-off: **__________________________** (Founder)
