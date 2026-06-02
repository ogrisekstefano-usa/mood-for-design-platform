# ITER187.A · JOURNEY MAIL INTELLIGENCE™ — Phase 1 Plan

**Status:** 🔒 LOCKED · awaiting Founder approval BEFORE any code is written
**Date:** 02 Feb 2026
**Founder addendum:** Multi-Mailbox Architecture™ + Read-Only IMAP Guarantee™ supersede every previous assumption.
**Out of scope (Phase 1):** AI auto-classification, automatic Journey association, MIRROR/FULL_WORKSPACE modes, in-product mail UI replacing the user's mailbox.

---

## §0 · GUIDING PRINCIPLE

> **Blueprint is NOT an email client. Blueprint is an Email Intelligence Layer™.**

The user's mailbox (Gmail / Outlook / SiteGround / Exchange / any IMAP/SMTP) remains the **single source of truth**. Blueprint **observes** and **enriches**. Blueprint **never mutates** mailbox state.

Any implementation that:
- marks messages as `\Seen` during sync,
- assumes 1 tenant = 1 mailbox,
- silently auto-assigns a message to a Lead/Journey without explicit user action,

is by definition a **failed implementation** and must not ship.

---

## §1 · MULTI-MAILBOX ARCHITECTURE™ (Workstream M)

### 1.1 Model
```
1 tenant   = N mailboxes   (1:N)
1 mailbox  = 1 IMAP+SMTP pair, 1 mailbox_type, 1 visibility_scope
1 mailbox  = N email_messages
1 message  = N email_links  (Lead | Prospect | Customer | Journey | none)
```

### 1.2 Entity · `email_mailboxes`
| Column                  | Type      | Notes |
|---|---|---|
| `id`                    | UUID PK    | |
| `tenant_id`             | UUID FK    | `tenants(id)` ON DELETE CASCADE |
| `mailbox_name`          | TEXT       | "Projects · Showroom Milano" |
| `mailbox_description`   | TEXT NULL  | Optional |
| `mailbox_type`          | TEXT       | `shared` \| `team` \| `personal` \| `system` |
| `from_name`             | TEXT       | "MOOD for DESIGN — Projects" |
| `from_email`            | TEXT       | Must match SMTP-authenticated identity |
| `reply_to_email`        | TEXT NULL  | |
| `imap_host`             | TEXT       | |
| `imap_port`             | INT        | default 993 |
| `imap_security`         | TEXT       | `ssl` \| `starttls` \| `plain` (FORBID plain in prod) |
| `imap_username`         | TEXT       | |
| `imap_password_enc`     | BYTEA      | AES-GCM ciphertext, key derived from `MAILBOX_VAULT_KEY` env |
| `imap_password_kid`     | TEXT       | Key id (rotation-ready) |
| `smtp_host`             | TEXT       | |
| `smtp_port`             | INT        | default 587 |
| `smtp_security`         | TEXT       | `ssl` \| `starttls` \| `plain` |
| `smtp_username`         | TEXT       | |
| `smtp_password_enc`     | BYTEA      | Same vault as IMAP |
| `smtp_password_kid`     | TEXT       | |
| `sync_enabled`          | BOOLEAN    | default true |
| `sync_mode`             | TEXT       | `READ_ONLY` (Phase 1 only allowed value) |
| `is_primary`            | BOOLEAN    | default false (1 primary per tenant max — partial unique index) |
| `is_active`             | BOOLEAN    | default true |
| `visibility_scope`      | JSONB      | See §2 below |
| `connection_status`     | TEXT       | `unknown` \| `connected` \| `warning` \| `error` |
| `last_health_check_at`  | TIMESTAMPTZ| |
| `last_sync_started_at`  | TIMESTAMPTZ| |
| `last_sync_completed_at`| TIMESTAMPTZ| |
| `last_sync_error`       | TEXT NULL  | |
| `messages_synced_total` | INTEGER    | denormalized counter |
| `metadata_json`         | JSONB      | provider hints (Gmail/Outlook/Exchange/SiteGround), folder map |
| `created_by`            | UUID       | profile id |
| `created_at`/`updated_at` | TIMESTAMPTZ | |

**Constraints:**
- UNIQUE `(tenant_id, lower(from_email))` — same `from_email` cannot be added twice in a tenant.
- Partial UNIQUE INDEX `(tenant_id) WHERE is_primary = true` — single primary mailbox per tenant.
- CHECK `sync_mode IN ('READ_ONLY')` for Phase 1 (CHECK loosens in Phase 2).
- CHECK `mailbox_type IN ('shared','team','personal','system')`.

### 1.3 Mailbox examples mapped to the model

| from_email                                   | mailbox_type | visibility_scope (see §2)                 |
|---|---|---|
| `info@showroom.it`                           | shared       | role ∈ {tenant_admin, designer, sales}    |
| `sales@showroom.it`                          | shared       | role ∈ {tenant_admin, sales}              |
| `projects@showroom.it`                       | shared       | role ∈ {tenant_admin, project_manager}    |
| `design@showroom.it`                         | team         | designers + tenant_admin                  |
| `accounting@showroom.it`                     | shared       | role ∈ {tenant_admin}, members ∈ {finance contact} |
| `hello@studio.com`                           | shared       | tenant-wide                               |
| `procurement@studio.com`                     | team         | specified members only                    |
| `projects.ruggieri@gmail.com` (Founder)      | personal     | owner-only (`created_by` profile)         |
| `hello@moodfordesign.com`                    | shared       | tenant-wide                               |
| `noreply@company.com`                        | system       | tenant_admin + super_admin                |

### 1.4 Provider abstraction
Phase 1 supports any provider that exposes **IMAP4rev1** (RFC 3501) for read and **SMTP** for send. Helpers:
- **`MailboxConnector`** (Python abstract): `health_check()`, `iter_messages(folder, since, with_peek=True)`, `fetch_message_rfc822(uid, with_peek=True)`, `send_rfc822(rfc822_bytes)`.
- Implementations: `ImapSmtpConnector` (generic), `GmailConnector` (uses IMAP/SMTP — OAuth refresh is Phase 2; Phase 1 = app password), `OutlookImapConnector`, `SitegroundConnector`, `ExchangeImapConnector` (legacy basic-auth-with-app-password where allowed).
- **Phase 1 keeps it simple:** all providers use the generic `ImapSmtpConnector` with provider-specific port/SSL defaults and a `provider_hint` in `metadata_json`. OAuth is Phase 2.

### 1.5 Indexed messages · `email_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK | |
| `mailbox_id` | UUID FK → `email_mailboxes` | |
| `uid_validity` | BIGINT | IMAP UIDVALIDITY (resync trigger if changes) |
| `uid` | BIGINT | IMAP UID within UIDVALIDITY |
| `message_id_header` | TEXT | RFC 822 `Message-Id:` (de-dupe across folders) |
| `thread_id` | TEXT NULL | Provider-specific (X-GM-THRID for Gmail; else References reconstruction) |
| `folder` | TEXT | "INBOX" \| "Sent" \| etc. |
| `direction` | TEXT | `inbound` \| `outbound` |
| `from_addr` / `to_addrs` / `cc_addrs` / `bcc_addrs` | TEXT[] | |
| `subject` | TEXT | |
| `snippet` | TEXT | first 280 chars plain-text |
| `body_text_path` | TEXT NULL | Object storage path; never persist raw body in DB |
| `body_html_path` | TEXT NULL | Same |
| `headers_json` | JSONB | sanitized headers |
| `internal_date` | TIMESTAMPTZ | IMAP INTERNALDATE |
| `received_at` | TIMESTAMPTZ | parsed Date header |
| `size_bytes` | INTEGER | |
| `attachments_count` | INTEGER | |
| `imap_flags_observed` | TEXT[] | read-only snapshot of `\Seen \Flagged \Answered…` at fetch time (we never write these) |
| `created_at` | TIMESTAMPTZ | |
| UNIQUE | `(mailbox_id, uid_validity, uid)` | |
| UNIQUE | `(tenant_id, message_id_header) WHERE message_id_header IS NOT NULL` | dedupe across folders/mailboxes within a tenant |

**Critical:** `imap_flags_observed` is a *snapshot at read time*, not a Blueprint-managed field. It exists only so the UI can show "this was unread when we synced it" — it is never sent back to the IMAP server.

### 1.6 Attachments · `email_attachments`
PK + `email_message_id` FK, `filename`, `mime_type`, `size_bytes`, `storage_path` (private bucket `mailbox-attachments`), `phash` (optional, for de-dup with PDFs already in Knowledge Engine).

### 1.7 Association · `email_links` (manual only in Phase 1)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email_message_id` | UUID FK | |
| `linked_type` | TEXT | `lead` \| `prospect` \| `customer` \| `account` \| `journey` \| `contact` |
| `linked_id` | UUID | |
| `linked_by` | UUID | profile id |
| `linked_at` | TIMESTAMPTZ | |
| `note` | TEXT NULL | optional reason |
| UNIQUE | `(email_message_id, linked_type, linked_id)` | |

No trigger that auto-creates links. Phase 2 may add `email_link_suggestions` separately.

### 1.8 Sent log · `email_outbound_sent`
Phase 1 outbound (when a user sends from Blueprint UI) appends to a tenant-scoped log + tries to APPEND to the mailbox's `Sent` folder via IMAP (read-only-safe operation: `APPEND` does not modify existing messages; it adds a new one). If the provider rejects APPEND, the message still went via SMTP — we log the APPEND failure but never block sending.

---

## §2 · MAILBOX PERMISSIONS™ (Workstream N)

### 2.1 Core idea
Mailbox permissions are **independent** from CRM permissions. A `sales` role with `leads:RW` may have **zero** access to `accounting@showroom.it`.

### 2.2 Scope encoding · `email_mailboxes.visibility_scope` JSONB
```json
{
  "mode": "members",                  // 'tenant' | 'roles' | 'members' | 'owner_only'
  "roles": ["tenant_admin","designer"],
  "member_ids": ["uuid…","uuid…"],
  "guest_emails": []                  // Phase 2
}
```
Evaluation precedence at request time:
1. Super-admin (Founder root) → always allowed.
2. `mode='owner_only'` → only `created_by` profile.
3. `mode='tenant'` → any active member of the tenant.
4. `mode='roles'` → user role ∈ `roles[]`.
5. `mode='members'` → user profile_id ∈ `member_ids[]` (always added to whoever is in `roles[]`).
6. Otherwise → 403.

### 2.3 Per-mailbox actions
| Permission         | Allows |
|---|---|
| `mailbox_view`     | List & read messages in mailbox |
| `mailbox_send`     | Send via mailbox SMTP |
| `mailbox_link`     | Associate messages to Lead/Journey/etc. |
| `mailbox_admin`    | Edit mailbox config, rotate credentials, change visibility_scope |

These are computed dynamically from `visibility_scope` + role baseline + explicit overrides on `mailbox_member_grants` (Phase 1 keeps it simple: visibility_scope ⇒ all four implicit permissions; per-action overrides are Phase 2).

### 2.4 Audit
Every visibility_scope edit emits `audit_logs.action='mailbox.visibility_changed'` with before/after diff.

---

## §3 · READ-ONLY IMAP GUARANTEE™ (Workstream O)

### 3.1 Mandatory invariants
During any sync run on any mailbox:
- ❌ **No `STORE` command issued.**
- ❌ No `MOVE`, `COPY` (to anywhere except sending via `APPEND` to user's own `Sent` after an outbound from Blueprint — and only in that case).
- ❌ No `EXPUNGE`.
- ❌ No flag changes (`\Seen`, `\Flagged`, `\Answered`, `\Deleted`, labels, etc.).
- ❌ No folder change.
- ❌ No subscription change.

### 3.2 Forbidden IMAP commands list (enforced)
A wrapper `cultural_engine/mail/imap_safe.py` exposes only a vetted whitelist:
```
LOGIN / AUTHENTICATE
LIST · LSUB · SELECT (read-only) · EXAMINE
SEARCH · UID SEARCH
UID FETCH BODY.PEEK[...]
UID FETCH (FLAGS UID INTERNALDATE RFC822.SIZE ENVELOPE BODYSTRUCTURE)
NOOP · CAPABILITY · LOGOUT · IDLE (read only)
APPEND  → only on the mailbox's own `Sent` folder, only after a Blueprint outbound
```
Any non-whitelisted verb raises `ImapSafetyError` and the sync aborts before sending to the socket.

### 3.3 PEEK enforcement
- **Always use `BODY.PEEK[]`** for body retrieval (RFC 3501 §6.4.5).
- For header/structure fetches: `UID FETCH n (FLAGS UID INTERNALDATE RFC822.SIZE ENVELOPE BODYSTRUCTURE)` — fetching these fields does **not** set `\Seen`.
- Servers that do not honor PEEK (rare): the connector raises `ProviderPeekUnsupported` → mailbox is marked `connection_status='warning'` with `last_sync_error='PEEK_UNSUPPORTED'` and **sync is refused** until the Founder explicitly overrides. We never trade correctness for coverage.
- Use `EXAMINE` instead of `SELECT` whenever possible (EXAMINE = read-only SELECT, RFC 3501 §6.3.2). For providers that only support `SELECT`, we send `SELECT` with no subsequent modifying commands.

### 3.4 Send-path (`SMTP + APPEND-to-Sent`)
- SMTP send is the source of truth for outbound delivery.
- After successful SMTP delivery, attempt `APPEND` of the same RFC822 message to the mailbox `Sent` folder with `\Seen` flag set on the **new** message only (this is required so the user's own client doesn't show their own sent mail as unread — and it does not violate the read-only guarantee since we're not modifying an existing message, we're inserting a fresh one).
- If `APPEND` fails, do NOT retry indefinitely; log + mark `last_sync_error='APPEND_SENT_FAILED'` and continue.

### 3.5 Acceptance test (must pass before ship)
1. SiteGround inbox has 3 unread emails (`\Seen` absent).
2. Blueprint runs `sync_mailbox(id)`.
3. Open webmail in browser → inbox still shows 3 unread.
4. Repeat for Gmail (IMAP enabled).
5. Repeat for Outlook (IMAP-enabled M365 account).
A single mailbox where Step 3 fails = whole feature is rejected. Test scripted in `/app/backend/tests/test_iter187a_imap_readonly.py` against a recorded IMAP fixture + live smoke against `projects.ruggieri@gmail.com` sandbox.

---

## §4 · SYNC MODES™ (Workstream P)

| Mode             | Phase | sync (read) | send | mailbox mutations | Notes |
|---|---|---|---|---|---|
| `READ_ONLY`      | 1 ✅  | ✅          | ✅ (with APPEND to Sent on best-effort) | ❌ | Default. Only mode allowed by DB CHECK in Phase 1. |
| `MIRROR`         | 2 🔒  | ✅          | ✅                                       | ❌ | Same as READ_ONLY plus user-explicit "Move to folder" replication is still forbidden. |
| `FULL_WORKSPACE` | 3 🔒  | ✅          | ✅                                       | ✅ (explicit user actions only)    | NOT implemented Phase 1. Requires re-opening DB CHECK. |

The `sync_mode` column is set at mailbox creation; switching modes goes through `mailbox_admin` permission + audit log + Founder confirmation modal.

---

## §5 · MAILBOX HEALTH™ (Workstream Q)

### 5.1 Health states
| State        | Meaning |
|---|---|
| `unknown`    | Never tested |
| `connected`  | IMAP login OK + SMTP login OK + at least one folder enumerated |
| `warning`    | One of: IMAP OK / SMTP failed, or PEEK unsupported, or rate-limited, or last_sync >24h |
| `error`      | IMAP auth failed, SSL handshake failed, hostname unresolved |

### 5.2 Probe payload (returned by `GET /mailboxes/:id/health`)
```json
{
  "mailbox_id": "…",
  "connection_status": "warning",
  "imap": { "ok": true,  "host": "imap.siteground.eu", "port": 993, "security": "ssl",
             "capabilities": ["IMAP4REV1","IDLE","UIDPLUS","MOVE"], "peek_supported": true },
  "smtp": { "ok": false, "host": "smtp.siteground.eu", "port": 587, "security": "starttls",
             "last_error": "535 Authentication failed" },
  "sync": {
    "last_started_at": "…", "last_completed_at": "…",
    "last_error": null,
    "messages_synced_total": 3812,
    "messages_inbox": 2105,
    "messages_sent": 1707
  },
  "checked_at": "2026-02-02T…Z"
}
```

### 5.3 Health cron
- On-demand probe (UI button) — synchronous.
- Background probe — every 30 minutes per active mailbox. If 3 consecutive errors → `connection_status='error'` and the Founder receives an in-app notification (no public alarm).

---

## §6 · DESIGN JOURNEY CORRELATION™ (Workstream R)

### 6.1 Phase 1 behavior — **manual only**
- A user with `mailbox_link` opens a message detail page.
- Sidebar offers: "Associa a → Lead / Prospect / Customer / Account / Journey".
- Clicking creates an `email_links` row.
- A single message may be linked to multiple targets (e.g. both an account and a journey).

### 6.2 Phase 1 explicitly FORBIDDEN
- No automatic creation of leads from inbound emails.
- No AI classification.
- No rule-based routing.
- No hidden side effects when reading a message.

### 6.3 Phase 2 (future, scaffolded but disabled)
Optional `email_link_suggestions` table populated by a deterministic matcher (email domain → contact, subject ↔ project name, References thread → existing thread). Always **suggestion-only**; user must confirm. Confidence + rationale stored. UI gate: founder feature flag `journey_mail_suggestions_v1`.

---

## §7 · SECURITY MODEL

### 7.1 Credentials vault
- Plaintext passwords NEVER persisted, NEVER logged, NEVER returned via API.
- AES-GCM(256). Key = HKDF(`MAILBOX_VAULT_KEY` env, `salt = tenant_id || mailbox_id`).
- Two env keys supported simultaneously (`MAILBOX_VAULT_KEY` + `MAILBOX_VAULT_KEY_PREVIOUS`) for rotation; `imap_password_kid`/`smtp_password_kid` tag every ciphertext.
- The plaintext is held in memory only for the duration of a single IMAP/SMTP connection inside the connector; zeroed before returning to the pool.

### 7.2 Transport
- IMAP: require `ssl` (993) or `starttls` (143 → STARTTLS). `plain` rejected at validation time outside `localhost`/dev.
- SMTP: same.

### 7.3 PII handling
- Body text/HTML stored in **private** object storage (`mailbox-bodies` bucket, signed URLs only, default 60s expiry).
- Snippets in DB are stripped to 280 chars and pass through a redaction pass for credit-card-shaped digits (Luhn match) before persistence.
- All bodies inherit the tenant ON DELETE CASCADE; deleting a tenant tombstones bodies within 24h.

### 7.4 Audit log entries (mandatory)
| `action`                          | When |
|---|---|
| `mailbox.added`                   | POST /mailboxes |
| `mailbox.edited`                  | PATCH /mailboxes/:id |
| `mailbox.deleted`                 | DELETE /mailboxes/:id |
| `mailbox.visibility_changed`      | visibility_scope mutated |
| `mailbox.credentials_rotated`     | password update |
| `mailbox.sync_started`            | sync run begins |
| `mailbox.sync_completed`          | sync run ends (counts in metadata) |
| `mailbox.send_email`              | outbound dispatch |
| `mailbox.send_failure`            | SMTP error |
| `mailbox.health_probe`            | health check (manual or cron) |
| `mailbox.link_created` / `_removed` | email_links mutation |

All entries: `tenant_id`, `user_id`, `resource_type='email_mailbox'`, `resource_id=mailbox_id`, `metadata_json` redacted.

### 7.5 API never echoes secrets
GET endpoints return `imap_password_set: true|false` booleans — never the ciphertext or any masked form. To rotate, a dedicated `PUT /mailboxes/:id/credentials` accepts the new plaintext over TLS body and immediately discards it.

---

## §8 · ENDPOINTS (proposed Phase 1)

All under `/api/journey-mail` to keep the namespace distinct from `/api/email/*` (which is Resend-outbound transactional).

| Method | Path                                                  | Auth        | Purpose |
|---|---|---|---|
| GET    | `/journey-mail/mailboxes`                             | tenant_ctx  | List mailboxes visible to caller |
| POST   | `/journey-mail/mailboxes`                             | mailbox_admin (tenant_admin baseline) | Create mailbox (encrypts creds) |
| GET    | `/journey-mail/mailboxes/:id`                         | mailbox_view| Mailbox config (passwords masked) |
| PATCH  | `/journey-mail/mailboxes/:id`                         | mailbox_admin | Edit non-credential fields |
| PUT    | `/journey-mail/mailboxes/:id/credentials`             | mailbox_admin | Rotate IMAP/SMTP password |
| DELETE | `/journey-mail/mailboxes/:id`                         | mailbox_admin | Soft-delete + cascade later |
| GET    | `/journey-mail/mailboxes/:id/health`                  | mailbox_view| Live probe |
| POST   | `/journey-mail/mailboxes/:id/sync`                    | mailbox_view| Trigger background sync |
| GET    | `/journey-mail/mailboxes/:id/messages`                | mailbox_view| List messages (paginated, filters: folder, since, q) |
| GET    | `/journey-mail/messages/:mid`                         | mailbox_view (resolved) | Message detail (+ signed body URLs) |
| POST   | `/journey-mail/messages/:mid/links`                   | mailbox_link| Associate to Lead/Journey/etc. |
| DELETE | `/journey-mail/messages/:mid/links/:lid`              | mailbox_link| Remove association |
| POST   | `/journey-mail/mailboxes/:id/send`                    | mailbox_send| Send via SMTP + best-effort APPEND to Sent |
| GET    | `/journey-mail/messages?linked_type=&linked_id=`      | tenant_ctx  | Inverse query: emails linked to a Lead/Journey |

All POST/PATCH/DELETE → audit log.

---

## §9 · BACKGROUND WORKER

- **Worker**: `cultural_engine/mail/sync_worker.py` (FastAPI BackgroundTask in Phase 1, Celery/RQ in Phase 2 once mailboxes per tenant > 10).
- **Scheduling**: every mailbox `sync_enabled=true` polled every **5 minutes** with jitter.
- **Resume**: per-mailbox `(uid_validity, last_uid)` cursor in `email_mailbox_cursors`. UIDVALIDITY change ⇒ full resync of last 90 days.
- **Idempotency**: dedup by `(mailbox_id, uid_validity, uid)` + by `message_id_header` within tenant.
- **Rate**: max 1 active connection per mailbox; back-off `1.5s · 3s · 4.5s · 6s` on transient errors.
- **Initial scope**: only `INBOX` + `Sent` (provider-mapped) in Phase 1. Other folders skipped.

---

## §10 · INTEGRATION HOOKS

### 10.1 With existing CRM
- A `Lead`, `Prospect`, `Customer`, `Account`, `DesignJourney` detail page exposes a "Email" tab (read-only) that calls `GET /journey-mail/messages?linked_type=&linked_id=`.
- No CRM table modified in Phase 1.

### 10.2 With Knowledge Engine
- If an inbound email has a PDF attachment, the attachment row is created in `email_attachments` with its pHash. A future hook may surface "this PDF looks like brand X catalog — add to Catalog Set?" — **suggestion only**, Phase 2.

### 10.3 With email_orchestration (Resend)
- Coexists. Resend remains the channel for **transactional, branded** mail (`magic_link`, `space_ready`, etc.). The new `/journey-mail/send` is for **human-authored** mail from a real mailbox identity. Both paths share an audit log namespace but distinct tables.

---

## §11 · DATA & PRIVACY EXIT

- `DELETE /journey-mail/mailboxes/:id` performs soft-delete (`is_active=false`) immediately and schedules hard purge of `email_messages` + bodies + attachments within 24h via a cleanup task. Audit log entries are retained (anonymized after 12 months).
- Tenant deletion cascades all of the above.

---

## §12 · TEST PLAN

### 12.1 Backend pytest
- `test_iter187a_imap_safe_whitelist.py` — fuzz: every IMAP verb not in whitelist must raise `ImapSafetyError`.
- `test_iter187a_imap_readonly.py` — fixture: mock IMAP server with `\Seen` tracking. Run `sync_mailbox()` on a mailbox with 3 unseen messages → assert all 3 still unseen after sync. Run on body fetch → still unseen. Run with PEEK forced off (server simulated as non-supporting) → sync refused.
- `test_iter187a_multi_mailbox.py` — same tenant, 3 mailboxes, 3 different visibility scopes; user A sees 1, user B sees 2, user C sees 3.
- `test_iter187a_credentials_vault.py` — round-trip AES-GCM, key rotation via `imap_password_kid`.
- `test_iter187a_send_path.py` — SMTP send + APPEND-to-Sent best-effort.
- `test_iter187a_dedup.py` — same `Message-Id` across folders ⇒ single `email_messages` row.

### 12.2 Live smoke (Founder sandbox, opt-in)
- `projects.ruggieri@gmail.com` — Gmail IMAP+SMTP via app password.
- `hello@moodfordesign.com` — SiteGround.
- Run §3.5 acceptance test by hand + screenshots attached to the next sprint report.

### 12.3 Frontend (Phase 1.5, not now)
Out of scope for this plan document. A separate UI sprint will land after backend acceptance.

---

## §13 · RISK REGISTER

| ID | Risk                                                | Severity | Mitigation |
|---|---|---|---|
| R-1 | Server quietly sets `\Seen` despite `BODY.PEEK[]`   | 🔴 HIGH  | Pre-sync flag snapshot + post-sync re-fetch flag diff on N sample messages; if any `\Seen` added by us → abort + alarm. |
| R-2 | Provider auth lockout from password leakage         | 🔴 HIGH  | Vault + no logging of headers/credentials + reject `plain` outside dev. |
| R-3 | UIDVALIDITY churn → duplicate inserts               | 🟠 MED   | Composite UNIQUE + `Message-Id` fallback. |
| R-4 | Large mailbox first-sync timeout                    | 🟠 MED   | First-sync window default 90 days; resumable cursor; backgrounded. |
| R-5 | OAuth-only providers (M365 modern auth, Gmail with 2FA without app password) | 🟠 MED   | Phase 1 documents the limitation; OAuth = Phase 2. |
| R-6 | Tenant has 50+ mailboxes                           | 🟡 LOW   | FastAPI background tasks → Celery worker pool in Phase 2. |
| R-7 | Multi-mailbox visibility leak                       | 🔴 HIGH  | Every list/get endpoint applies `visibility_scope` evaluation; `test_iter187a_multi_mailbox.py` covers cross-user negative cases. |
| R-8 | Attachments containing PII archived improperly      | 🟠 MED   | Private bucket, signed URLs 60s, retention policy. |

---

## §14 · ACCEPTANCE CRITERIA (Founder lock — repeated verbatim)

1. Connect SiteGround mailbox.
2. Sync inbox.
3. Verify unread emails remain unread.
4. Open Blueprint.
5. Associate email to Design Journey.
6. Send email from Blueprint.
7. Recipient receives email from real mailbox.
8. Email appears in Sent folder of the original mailbox.
9. Original mailbox state remains unchanged for all unrelated messages.
10. No permission leakage between users.

A red ✗ on any of the 10 = **non-shippable**.

---

## §15 · NON-GOALS (Phase 1)

- ❌ Replacing the user's mail UI.
- ❌ AI auto-tagging / auto-routing.
- ❌ Calendar / contacts sync.
- ❌ MIRROR or FULL_WORKSPACE mode.
- ❌ OAuth providers (Gmail OAuth, M365 Modern Auth).
- ❌ Mobile push.
- ❌ Frontend UI in this sprint (next sprint, separate plan).

---

## §16 · NEW FILES (when coding starts — DO NOT YET)

- `/app/supabase/migrations/120_iter187a_email_mailboxes.sql`
- `/app/backend/cultural_engine/mail/__init__.py`
- `/app/backend/cultural_engine/mail/imap_safe.py`
- `/app/backend/cultural_engine/mail/connectors.py`
- `/app/backend/cultural_engine/mail/sync_worker.py`
- `/app/backend/cultural_engine/mail/vault.py`
- `/app/backend/routers/journey_mail.py`
- `/app/backend/tests/test_iter187a_*.py`
- `/app/scripts/apply_migration_120.py`

Updated:
- `/app/backend/server.py` (router mount)
- `/app/backend/.env.example` (`MAILBOX_VAULT_KEY=…`)

---

## §17 · DECISION GATE (Founder action required)

Before any code:
1. ✅ Confirm Phase 1 scope = Workstreams M + N + O + P (READ_ONLY only) + Q + R-manual-only.
2. ✅ Confirm the **DB CHECK on `sync_mode='READ_ONLY'`** is acceptable for Phase 1.
3. ✅ Confirm SMTP `APPEND to Sent` is acceptable (it does NOT violate read-only on existing messages — it inserts a fresh outbound copy).
4. ✅ Confirm Phase 1 = IMAP/SMTP with **app passwords** only (no OAuth this sprint).
5. ✅ Confirm sandbox mailboxes for live smoke: `projects.ruggieri@gmail.com` + `hello@moodfordesign.com`.
6. ✅ Confirm out-of-scope items in §15.

On all six ✅ → I open ITER187.A coding sprint with **§16 file plan** in this order:
  Migration 120 → Vault → ImapSafe wrapper → Connector → Sync worker → Router → Tests → Live smoke.

---

## §18 · FOUNDER LOCK (re-stated)

- ❌ Marking any pre-existing message as `\Seen` during sync → **non-shippable**.
- ❌ Assuming 1 tenant = 1 mailbox at any layer (DB, API, UI) → **non-shippable**.
- ❌ Automatic association of inbound email to a Lead/Journey without explicit user action → **non-shippable**.
- ❌ Plaintext credentials anywhere (DB, logs, API response) → **non-shippable**.

Sign-off: **__________________________** (Founder)
