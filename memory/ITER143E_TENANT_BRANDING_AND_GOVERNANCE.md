# ITER143E · Tenant Email Branding™ + Email Governance Expansion™

**Status**: ✅ DELIVERED · 23 Feb 2026

---

## 1. Migration

`075_tenant_email_branding_extras.sql` extends `tenant_email_settings`
with the brand-refinement columns the studio admin edits:
- `footer_company_name`, `footer_address`, `footer_phone`
- `socials` (JSONB), `email_signature`, `legal_footer`
- `privacy_url`, `terms_url`, `metadata` (JSONB)

The runtime/orchestration columns (`provider_type`, `sender_email`,
`active`, `locale_default`) stay reserved to Blueprint™.

---

## 2. Backend services

| Path | Purpose |
|---|---|
| `routers/tenant_email_branding.py` | `GET /api/tenant/email-branding`, `PATCH /api/tenant/email-branding`, `POST /api/tenant/email-branding/preview` — tenant_admin + root only |
| `routers/email_orchestration.py` | `POST /api/email/webhook/resend` (HMAC-verified, dev-friendly fallback), `POST /api/email/admin/email-events/{id}/retry`, `GET /api/email/admin/email-events/search`, `GET /api/email/admin/email-provider-health` |
| `services/email_templates.py` | Already supports tenant `tenant_settings` merge — no changes needed; preview API just passes a draft `tenant_settings` and the templates honour it |
| `scripts/swap_sender_to_production.py` | Interactive script that flips `EMAIL_FROM` in `.env` + every `tenant_email_settings.sender_email` from the testing default to `no-reply@mail.moodfordesign.com`. Run AFTER Resend domain verification. |

---

## 3. Frontend — `/settings/email-branding`

Route: `/settings/email-branding` (gated by `StudioAdminRoute` — only
tenant_admin and root_superadmin can reach it).

Cinematic UI ("brand refinement studio", NOT "mail server config"):
- Left column: 5 sections (Voce & Mittente · Identità visiva · Firma
  editoriale · Studio & contatti · Legali)
- Right column: sticky live preview with template selector
  (`password_reset`, `invite`, `onboarding`, `lead_captured`,
  `magic_link`, `generic`) and inline `<iframe srcDoc>`
- Save + Preview CTAs · Black-glass + cyan accent · Cormorant italic
  headings

Fields editable by the studio (15 total):
```
sender_name, reply_to, support_email,
logo_url, primary_color, accent_color,
footer_signature, footer_company_name, footer_address, footer_phone,
socials, email_signature,
legal_footer, privacy_url, terms_url
```

Reserved to Blueprint Command Center™ (NOT exposed in tenant UI):
```
provider_type, sender_email (domain-bound), email_domain,
active, locale_default
```

---

## 4. Email Governance Expansion™ — `/admin/email-governance`

Already-cinematic UI now powered by:

| New backend | UI surface |
|---|---|
| `GET /email-events/search?q=…&tenant_id=…&event_type=…&status=…` | Filter dropdowns + ready for full search field |
| `POST /email-events/{id}/retry` | Will be wired as "Retry" row action |
| `POST /webhook/resend` ingests `sent/delivered/opened/clicked/bounced/complained/failed` | Updates `opened_at`, `clicked_at`, `bounced_at`, `failed_at`, `status`, `bounce_reason` on existing rows; creates orphan rows for unmatched message_ids |
| `GET /email-provider-health` | Delivery score per provider + per tenant over last 200 events |

**Verified live**: a simulated `email.opened` webhook for an existing
`provider_message_id` correctly populates the `opened_at` timestamp on
the matching `email_events` row.

---

## 5. Sender swap — DNS checklist

Once `mail.moodfordesign.com` is verified on Resend
(https://resend.com/domains), run:

```bash
cd /app && python3 backend/scripts/swap_sender_to_production.py
sudo supervisorctl restart backend
```

Then live-test from `/admin/email-governance` → "Test invio" panel.

The script:
- Updates `EMAIL_FROM` in `backend/.env` to
  `MOOD for DESIGN™ <no-reply@mail.moodfordesign.com>`
- Updates every `tenant_email_settings.sender_email` row that still
  holds `onboarding@resend.dev` → `no-reply@mail.moodfordesign.com`
- Idempotent (safe to re-run)

DNS records (added on the user's DNS provider, NOT in code):
- SPF `TXT  send.mail.moodfordesign.com  "v=spf1 include:amazonses.com ~all"`
- DKIM 3× `CNAME` records shown on Resend dashboard
- MX `feedback-smtp.…amazonses.com` for return-path
- Return-Path subdomain

---

## 6. Supabase Auth Hardening — manual checklist

These are **dashboard settings** (not source). To complete the freeze the
user must, on https://supabase.com/dashboard/project/<id>/auth/url-configuration :

| Setting | Value |
|---|---|
| Site URL | `https://blueprint.moodfordesign.com` |
| Additional Redirect URLs | `https://blueprint.moodfordesign.com/auth/callback` · `https://*.moodfordesign.com/auth/callback` · `https://i18n-recovery-1.preview.emergentagent.com/auth/callback` (dev) |
| Cookie domain (Auth → Settings → Advanced) | `.moodfordesign.com` |

When done, every `redirect_to` we generate (already pointing at
`blueprint…/auth/callback`) will be accepted by Supabase, and the
session cookie will persist across `studio.*`, `format.*`, etc.

⚠️ The codebase enforces `_isAllowedHost` rejection of `www.` and bare
root regardless of dashboard config, so the "Awesome Site in The Making"
trap is impossible even if Supabase drifts.

---

## 7. Tests

`backend/tests/test_iter143e_tenant_branding.py` — **8/8 passed**:
- GET branding shape + editable_fields list
- PATCH persists across all 15 fields
- Preview renders HTML containing the draft `primary_color` + signature
- A regular `designer` is rejected (HTTP 403)
- Search by subject works
- Provider health returns the `providers` + `tenants` aggregation
- Webhook accepts unsigned payload in dev (no secret set)
- No Supabase hosted UI in any redirect_to

Aggregate suite: **31/31** (ITER143A · 143C · 143D · 143E, no regression).

---

## 8. Deferred / Future-ready

| Item | When |
|---|---|
| Wire **Retry** row action in the Email Governance table | next UI iteration |
| Full-text search field in the governance UI (backend ready) | next UI iteration |
| `tenant_id`/`user_id` filter dropdowns in governance | next UI iteration |
| Real Resend webhook secret (`RESEND_WEBHOOK_SECRET`) once user configures it in Resend dashboard | when user is ready |
| **Automated onboarding sequences** (welcome → 24h check-in → 7d nurture) | ITER143F · the `template_key` registry + email_events audit is already the backbone |
| **CRM automations** (lead_captured → studio notification + thank-you-to-prospect) | ITER143F · plumbing in place via `template_key` |
| **Editorial digest** (weekly newsletter per tenant) | ITER143G · `tenant_email_settings.email_domain` + branding ready |
| **Milestone notifications** (project tasks reaching status=done) | drop-in: same `send_template_email(template_key="generic", …)` |
| **Advisor referral workflows** | drop-in; template registry already has the slot |
| **Multi-tenant white-label scaling** | the only operational change per-tenant is `tenant_email_settings` rows; no code change needed |

---

## 9. Architectural notes

1. **Brand cascade in templates**: `_branding(tenant_settings)` in
   `services/email_templates.py` merges tenant fields over platform
   defaults. When a tenant leaves `primary_color` blank, the email
   uses the MOOD cyan automatically. White-label without forcing every
   field to be set.

2. **Audit-first webhook ingestion**: even payloads with no matching
   `provider_message_id` are persisted (`metadata.orphan_webhook=true`).
   Nothing the provider sends us is silently dropped.

3. **Provider abstraction**: `tenant_email_settings.provider_type` ∈
   `{resend, smtp_custom, sendgrid, postmark, ses, console}`. Adding a
   new driver only requires extending `_send_X(...)` in
   `services/email_service.py`. The template + audit + governance UI
   pipeline stays untouched.

4. **Why tenant UI is _settings_ not _admin_**: the path
   `/settings/email-branding` follows the user's existing
   "Studio Settings" mental model, while the operational pieces
   (delivery logs, webhook health, retry queue) live in
   `/admin/email-governance` — accessible only to the platform ROOT.
   This keeps the two mental models clean: studios refine voice,
   Blueprint operates delivery.

5. **Preview without sending**: `POST /tenant/email-branding/preview`
   renders the template with the DRAFT settings (not what's persisted)
   so the studio can iterate visually before committing. No
   `email_events` row, no provider call.
