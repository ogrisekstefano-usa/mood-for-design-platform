# ITER143D · Tenant-Aware Email Orchestration™ + Auth Redirect Governance™

**Status**: ✅ DELIVERED · 23 Feb 2026

---

## 1. Migration

`074_email_orchestration.sql` ships:

- **Slug freeze**: `UPDATE tenants SET slug='studio' WHERE slug='mood-demo'` — the Golden Demo Tenant™ now lives at `studio.moodfordesign.com`.
- **`tenant_email_settings`** table (per-tenant white-label):
  `tenant_id (UNIQUE), sender_name, sender_email, reply_to, support_email, logo_url, primary_color, accent_color, footer_signature, email_domain, provider_type, locale_default, active`. Provider check constraint: `resend | smtp_custom | sendgrid | postmark | ses | console`.
- **`email_events`** extension:
  `template_key, source_domain, provider_message_id, recipient_email, bounced_at, failed_at, updated_at` (+ legacy `template, recipient, provider_id` retained for back-compat). Backfills `recipient_email` and `template_key` from legacy columns.

---

## 2. Backend services

| File | Purpose |
|---|---|
| `services/auth_redirect.py` | Tenant-aware redirect resolver. `classify_origin`, `build_callback_url`, `build_tenant_url`, `resolve_email_context`, `parse_subdomain`. Reserved subdomain list. Strict in-family routing. |
| `services/email_templates.py` | 7 cinematic HTML templates (`password_reset`, `invite`, `onboarding`, `lead_captured`, `magic_link`, `proposal_ready`, `generic`). Shared `_wrap_email()` shell. Tenant branding merge over platform defaults. |
| `services/email_service.py` | Single entrypoint `send_template_email(...)`. Drivers: `resend` (real send) + `console` (log + persist). ALWAYS writes `email_events` (audit-first). Reads `tenant_email_settings` for sender, reply-to, branding. |
| `routers/auth.py` · `/forgot-password` | Tenant-aware recovery. Calls Supabase Admin `generate_link?type=recovery` with `redirect_to = blueprint…/auth/callback?flow=recovery&origin={host}&next=/auth/reset-password`. Renders cinematic template via Resend. Always logs to `email_events`. Response is opaque to avoid enumeration. |
| `routers/blueprint_admin.py` | `GET /email-events[?status,event_type,tenant_id,limit]`, `GET /email-events/{id}`, `POST /email-events/resend-test`. Gated by `require_root_superadmin`. |

---

## 3. Frontend

### Auth callback routing
| Route | Component | Purpose |
|---|---|---|
| `/auth/callback` | `AuthCallbackPage` | Reads URL hash session, validates `origin`, bounces to right subdomain. Same-origin → SPA. Cross-origin → hand-over via hash. NEVER lands on `www.` or bare root. |
| `/auth/reset-password` | `ResetPasswordPage` | Installs hash session into localStorage, cinematic form, PUTs `auth/v1/user` with new password, sends user to `/auth/login`. |
| `/reset-password`, `/invite`, `/magic-link` | aliases → `ResetPasswordPage` / `AuthCallbackPage` | back-compat |

### Email Governance UI
`/admin/email-governance` (root only) now ships with:
- 4 metrics (sent · queued · failed · bounced)
- **Test invio**: 4-field form (destinatario, template, source host, send) → renders + delivers + audits
- **Filters**: status + event type
- **Events table** with origin host shown explicitly
- **Detail modal** (click row) — full JSON payload

---

## 4. Env / Provider

`backend/.env`:
```
RESEND_API_KEY=re_…
EMAIL_PROVIDER=resend
EMAIL_FROM=MOOD for DESIGN™ <onboarding@resend.dev>   # TODO swap to no-reply@mail.moodfordesign.com once Resend verifies the domain
EMAIL_REPLY_TO=support@moodfordesign.com
PLATFORM_ROOT_DOMAIN=moodfordesign.com
```

**Console fallback**: setting `EMAIL_PROVIDER=console` switches every send to logged-only mode without code changes. Audit row still written so the governance UI keeps working in dev.

**Provider abstraction**: `tenant_email_settings.provider_type` ∈ {resend, smtp_custom, sendgrid, postmark, ses, console} — schema accepts these but only `resend` + `console` drivers are implemented today (foundation ready, more drivers in future iterations).

---

## 5. Auth Redirect Governance™ — strict rules

| Origin | Callback redirect_to | Final landing |
|---|---|---|
| `studio.moodfordesign.com` | `https://blueprint.moodfordesign.com/auth/callback?flow=recovery&origin=studio.moodfordesign.com&next=/auth/reset-password` | `studio.moodfordesign.com/auth/reset-password` |
| `format.moodfordesign.com` | same callback, `origin=format.moodfordesign.com` | `format.moodfordesign.com/auth/reset-password` |
| `blueprint.moodfordesign.com` | same callback, `origin=blueprint.moodfordesign.com` | `blueprint.moodfordesign.com/auth/reset-password` |
| `www.moodfordesign.com` / bare root | rejected by `_isAllowedHost` | fallback → `blueprint.moodfordesign.com/auth/login` |

**Supabase whitelist**: only ONE URL needed in Supabase auth settings — `https://blueprint.moodfordesign.com/auth/callback` (plus `https://*.preview.emergentagent.com/auth/callback` for dev). The platform handles all tenant fan-out.

---

## 6. Live verification

```bash
$ curl http://localhost:8001/api/auth/forgot-password \
    -H "Host: studio.moodfordesign.com" \
    -d '{"email":"slabreality@gmail.com"}'

{ "redirect_to_will_be": "https://blueprint.moodfordesign.com/auth/callback
                          ?flow=recovery
                          &origin=studio.moodfordesign.com
                          &next=%2Fauth%2Freset-password" }

# email_events row:
event_type:           password_reset
status:               sent
provider:             resend
provider_message_id:  abd6c803-f332-468a-b015-ebb22f8c6f56
source_domain:        studio.moodfordesign.com
recipient_email:      slabreality@gmail.com
subject:              MOOD for DESIGN™ · Reset della password
```

---

## 7. Tests

`backend/tests/test_iter143d_email_orchestration.py` — **9/9 passed**:
- Auth redirect resolver unit (`classify_origin`, `build_callback_url`, `parse_subdomain`, `resolve_email_context`)
- forgot-password tenant-aware redirect (studio + format)
- email_events new fields visible via governance API
- resend-test endpoint round-trip (ok=true, provider_message_id present)
- tenant_email_settings for `studio` exists
- demo tenant slug == `studio` AND `is_demo=true`
- no `atelier.moodfordesign.com` references in active source

Aggregate suite: **23/23 passed** (ITER143A · ITER143C · ITER143D, no regression).

---

## 8. Audit — no `atelier.moodfordesign.com`, no operational `mood-demo`

- Grep across `/app/backend`, `/app/frontend/src`, `/app/supabase/migrations`: **0 hits** for `atelier.moodfordesign`.
- `mood-demo` slug: only references remaining are
  (a) the migration that performs the rename (kept for history),
  (b) `seed_demo_users.py` migration-style fallback (auto-renames legacy slug → `studio` on re-run),
  (c) `mood-demo-studio-81a09e` references in older seeds — different tenant slug, left for legacy data continuity.
- `provision_root_superadmin.py` updated to look up `slug='studio'`.

---

## 9. Deferred / Future

| Item | When |
|---|---|
| Verify `mail.moodfordesign.com` on Resend → swap sender from `onboarding@resend.dev` | When user verifies DNS |
| Webhook capture for `opened_at` / `clicked_at` / `bounced_at` | ITER143E |
| Editorial-runtime localization of email subjects + body chunks (currently IT-only with hard-coded copy in templates) | ITER143E |
| Custom SMTP per-tenant driver | ITER144 |
| Inline template preview in the governance UI (currently shows JSON only) | ITER143F |
| Retry / requeue button on failed events | ITER143F |

---

## 10. Architectural notes

1. **Audit-first**. Every send path persists to `email_events` BEFORE returning. Render failures, provider failures, console previews — all leave a row. Nothing is invisible.
2. **Branding cascade**. `tenant_email_settings` → platform defaults. Empty tenant fields = inherit. This keeps the platform white-label-ready without forcing every tenant to fill every field.
3. **Strict subdomain whitelist**. The frontend `_isAllowedHost` rejects `www.*` and bare root by design — the legacy "Awesome Site in The Making" trap can never happen because the AuthCallbackPage refuses to land users there.
4. **Single Supabase callback**. Whitelisting `blueprint…/auth/callback` is enough — Blueprint handles tenant fan-out after Supabase consumes the recovery token. This keeps the Supabase project clean and our routing controllable.
5. **Console mode** stays available behind `EMAIL_PROVIDER=console`. Used in CI / local dev where outbound traffic is undesirable.
