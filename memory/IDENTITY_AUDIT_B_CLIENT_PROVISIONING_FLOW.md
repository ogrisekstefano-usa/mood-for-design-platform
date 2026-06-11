# IDENTITY & CLIENT PROVISIONING AUDIT — DOCUMENTO B: CLIENT PROVISIONING FLOW
> Prodotto: 11 Jun 2026 · Audit statico completo

---

## 1. I 4 Percorsi di Creazione Utente

### PERCORSO P1 — Designer/Studio Signup (`/api/auth/signup`)

```
POST /api/auth/signup
  body: { email, password, first_name, last_name, company_name, locale }
  
  1. admin.create_user({ email_confirm: true }) → auth.users.id
  2. INSERT tenants (nuovo tenant per ogni signup — multi-tenant by design)
  3. INSERT users_profile(role='tenant_admin', status='active')
  4. password_grant(email, password) → session JWT
  
  Output: { session, user }
  
  Nota: ogni signup crea un nuovo tenant. Design intenzionale.
```

**Email verification**: BYPASS (`email_confirm: True`) — confermata automaticamente.

---

### PERCORSO P2 — Member Invite (`/api/members/invite`)

```
POST /api/members/invite
  body: { email, first_name, last_name, role }
  Requires: tenant_admin or super_admin
  
  1. Verifica duplicati nello stesso tenant
  2. TENTATIVO: admin.invite({ email, metadata }) → email magic link
     SE SMTP non configurato → fallback: admin.create_user({ email_confirm: true })
  3. INSERT users_profile(role=body.role, status='invited')
  4. INSERT tenant_memberships(status='invited')
  5. UPSERT member_invites (audit log invito)
  
  First Login: _accept_invite_if_pending()
    → UPDATE users_profile(status='active', accepted_at=now)
    → UPDATE tenant_memberships(status='active')
    → UPDATE member_invites(status='accepted')
```

**Email verification**: BYPASS se SMTP assente (`email_confirm: True` nel fallback).  
**Status iniziale**: `invited` → diventa `active` al primo login.  
**Questo è il path che ha creato `ogrisekadvisor@gmail.com`.**

---

### PERCORSO P3 — Begin Journey Ritual (`/api/public/journeys/initiate`)

```
POST /api/public/journeys/initiate  (pubblico, no auth)
  body: { first_name, last_name, email, phone, ... }
  
  STEP A (bloccante):
    1. INSERT accounts(lifecycle_stage='prospect')
    2. INSERT contacts
    3. INSERT projects
    4. INSERT design_journeys(account_id ✅)
    5. INSERT journey_milestones ×10
    6. INSERT milestone_versions(brief)
    7. INSERT journey_timeline_events ×2
    8. INSERT journey_briefs
  
  STEP B (NON-blocking, best-effort):
    9. INSERT leads (può fallire silenziosamente)
   10. INSERT funnel_events
   11. INSERT discovery_interviews
  
  STEP C (NON-blocking, provision_client_after_journey):
   12. _find_auth_user(email) → cerca auth.users per email
       SE non trovato → _create_auth_user({ email_confirm: true, passwordless })
   13. _ensure_profile() → INSERT users_profile(role='client', status='active')
   14. ensure_owner() → designer assignment
   15. _ensure_thread() → relationship_thread + message
   16. _generate_magic_link(email, redirect_to) → magic link
   17. send_template_email('journey_started', magic_link_url) → EMAIL
   
   ← MANCANTE: UPDATE projects SET client_user_id = profile_id  ← BUG P0-B
```

**Email verification**: BYPASS (`email_confirm: True`).  
**Portal access**: ❌ ROTTO — `projects.client_user_id` mai settato.  
**Passwordless**: il client riceve solo magic link, mai password.

---

### PERCORSO P4 — Onboarding Wizard (`/api/onboarding/private/submit`)

```
POST /api/onboarding/private/submit  (pubblico, no auth)
  body: { email, password, first_name, last_name, locale, payload }
  
  1. admin.create_user({ email_confirm: true }) → auth.users
  2. INSERT users_profile(role='client', status='active', 
     metadata_json.acquired_via='storefront_wizard')
  3. workspace_genesis.generate(...) → project + moodboard + assignment
  4. password_grant(email, password) → session JWT
```

**Email verification**: BYPASS (`email_confirm: True`).  
**Differenza da P3**: il client sceglie la password. `metadata_json.password_chosen` dovrebbe essere settato a `True`.  
**Portal access**: dipende da workspace_genesis (non analizzato in dettaglio).

---

## 2. Lifecycle States (`users_profile.status`)

```
            ┌─────────────┐
            │   invited   │ ← P2 (member invite)
            └──────┬──────┘
                   │ primo login (_accept_invite_if_pending)
                   ▼
            ┌─────────────┐
   P1/P3/P4 │   active    │ ← P1, P3, P4 (creati direttamente active)
            └──────┬──────┘
                   │ PATCH /members/{id} { status: 'suspended' }
                   ▼
            ┌─────────────┐
            │  suspended  │
            └─────────────┘
```

---

## 3. Magic Link Flow (Clienti)

```
Trigger A: journey_initiate → provision_client_after_journey()
  → _generate_magic_link(email, redirect_to='/journey/auto')
  → send_template_email('journey_started')
  → Cliente riceve link, clicca → Supabase autentica → frontend /auth/callback
  → frontend chiama GET /api/auth/me
  → _accept_invite_if_pending() (no-op se già active)
  → _resolve_role_redirect(role='client') → redirect a /client

Trigger B: POST /api/auth/silent-magic-link
  → cerca users_profile per email
  → genera nuovo magic link
  → email silente

Trigger C: POST /api/auth/client/resend
  → cerca accounts per email
  → genera magic link
  → email resend
```

**Scadenza magic link**: gestita da Supabase (default: 1 ora).  
**Multi-use**: i magic link Supabase sono monouso (invalidati al primo click).

---

## 4. Adaptive Access (`/api/auth/identify`)

Prima di mostrare il form di login, il frontend chiama:

```
POST /api/auth/identify { email: "..." }
→ { kind: 'client'|'professional', password_exists: bool }
```

- `kind = 'professional'` → mostra form password
- `kind = 'client'` → mostra "Continua via email" (magic link)
- Email sconosciuta → risponde sempre `kind='client', password_exists=false` (anti-enumeration)

**Impatto**: un cliente che ha scelto una password (via onboarding wizard) può comunque usare il form password se `metadata_json.password_chosen = true`.

---

*Audit B — IDENTITY & CLIENT PROVISIONING AUDIT*
