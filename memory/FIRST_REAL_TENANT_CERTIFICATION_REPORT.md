# FIRST REAL TENANT — GO-LIVE CERTIFICATION REPORT
> Dry-run completo eseguito sul Preview environment con scenario reale
> **"Martinel Interior Design / Mario Rossi / Pordenone IT → US · GB · AE"**
> per certificare l'invito del primo showroom reale.

**Esito finale**: 🟢 **`READY_TO_INVITE_FIRST_REAL_TENANT`**

| Parametro | Valore |
|---|---|
| Data esecuzione | 2 Giu 2026, 05:37–05:58 UTC |
| Backend | `https://editorial-platform-4.preview.emergentagent.com` |
| Lead Reference primario | `MOOD-4A7D-2622` (audit) + `MOOD-F93E-DFE1` (browser) |
| Tenant slug creati | `martinel-interior-design-5` … `-11` (collisione handler verificato) |
| Domain email | `mail.moodfordesign.com` · **verified** · Sandbox **OFF** |
| Findings totali | 47 audit + 5 verifiche browser-side |
| P0 PASS | 30 / 30 |
| P1 design-by-design | 2 / 2 (lingue facoltative, advisor pool digest) |
| P0 bug **trovati e risolti durante il dry-run** | **3** ⚠ |

---

## 0 · BUG P0 TROVATI E RISOLTI DURANTE IL DRY-RUN

> Senza questo passaggio operativo, il primo founder reale sarebbe entrato
> in un **loop di login** dopo aver consumato il magic-link.
> Tutti e tre i bug sono stati riprodotti, fixati e verificati.

### Bug 1 — Password-login dal `/accedi` non scriveva la chiave token Production
- **File**: `frontend/src/corporate/pages/AccessContinuityPage.jsx`
- **Sintomo**: dopo `/accedi → email+password → /command-center/overview`
  il `AdminApp.AuthGate` rilevava sessione assente (chiamava `whoami` con
  `Authorization: Bearer ""`) e ri-mostrava il form di login.
- **Causa**: il password submit scriveva solo `mood_jwt` / `mood_user` /
  `mood_tenant`, mentre `adminApi.headers()` legge `mood_auth_token`.
  Le chiavi di sessione fra `/accedi` e `/command-center` erano sfasate.
- **Fix**: introdotto helper `_persistSession()` che scrive **tutte** le
  6 chiavi attese (legacy + production), riusato sia dal magic-link
  consume sia dai due rami del password submit (compreso il fallback
  tenant disambiguation).
- **Evidence**: `02_command_center_after_login_FIX.jpeg`
  `localStorage` post-login: `{jwt:true, auth_t:true, auth_user:true, auth_tenant:true, admin_t:"studio"}`.

### Bug 2 — `/api/admin/site/whoami` rifiutava `role=owner` (HTTP 403)
- **File**: `backend/routers/admin_site.py`
- **Sintomo**: dopo il magic-link consume (HTTP 200, JWT owner), il
  founder arrivava su `/command-center/welcome` ma il `AuthGate` riceveva
  403 sul `whoami` e mostrava di nuovo il form "Accedi al tuo workspace
  · MOOD · FOUNDER".
- **Causa**: `admin_whoami` delegava a `require_advisor_scope`, che per
  policy **P0-A Tenant Isolation** esclude intenzionalmente `owner`
  (giusto su `/pipeline` e `/studio/requests`, **non** sul whoami che è
  un puro session-check per tutte le shell).
- **Fix**: implementato guard inline nel solo `whoami` che accetta
  `{admin, editor, advisor, owner}` + risoluzione tenant dal claim JWT
  o dall'header `X-Tenant-Slug`. Le altre rotte continuano ad usare
  `require_advisor_scope`, quindi la tenant-isolation resta **intatta**.
- **Evidence (post-fix)**:
  - `GET /admin/site/whoami` con JWT owner → **HTTP 200**
    `{tenant:{slug:"martinel-interior-design-8"}, role:"owner", ...}`
  - `GET /admin/tenant-activation/pipeline` con JWT owner → **HTTP 403** ✅
  - `GET /admin/studio/requests`            con JWT owner → **HTTP 403** ✅
  - `GET /admin/tenants/studio/manifest`    con JWT owner → **HTTP 404** ✅
  - `06_founder_workspace_welcome.jpeg` — Founder Welcome screen reso
    correttamente con monogram "MD", studio name "Martinel Interior
    Design", founder "Mario Rossi", lingua "Italiano · IT".

### Bug 3 — Logout non puliva le chiavi legacy (token zombie)
- **File**: `frontend/src/admin/adminApi.js`
- **Sintomo**: dopo `Logout` dal Command Center, `mood_auth_token`/
  `mood-admin-tenant` venivano rimossi correttamente, ma `mood_jwt`/
  `mood_user`/`mood_tenant` rimanevano nel localStorage.
- **Causa**: `adminAuth.clear()` era stato aggiornato a `mood_auth_*`
  ma non aveva mai dimenticato le chiavi legacy scritte
  dall'`AccessContinuityPage`.
- **Fix**: `clear()` ora rimuove anche `mood_jwt`/`mood_user`/`mood_tenant`.
- **Evidence**:
  - Prima del fix: `{jwt:True, auth_t:False}` post-logout (zombie).
  - Dopo il fix: `{jwt:False, user:False, tenant:False, auth_t:False, admin_t:False}` ✅.

---

## 1 · FASE 1 — ACQUISITION

**Submit funnel V2** eseguito con scenario reale Martinel Interior Design.

| Verifica | Esito | Evidence |
|---|---|---|
| Funnel V2 UI raggiungibile pubblicamente | ✅ | `01_studio_v2_landing.jpeg` (step archetype) |
| `POST /api/studio/v2/submit` HTTP 200 | ✅ | audit `v2.submit_ok` — `ref=MOOD-4A7D-2622` |
| `studio_requests.studio_name` salvato | ✅ | audit `data.studio_name_real` — `"Martinel Interior Design"` |
| HQ geo + `target_country_isos` (US, GB, AE) | ✅ | audit `data.headquarter_country`, `data.target_countries` |
| Reference editoriale generata | ✅ | `MOOD-4A7D-2622` (e tutti i nuovi: `MOOD-F93E-DFE1`, `MOOD-8484-36C5` …) |
| Email **founder** `studio_request_received` | ✅ | audit `email.visitor.received` — `status=sent`, subject IT |
| Email **admin** `admin_new_studio_request` | ✅ | audit `email.super_admin.notified` — `status=sent` |
| Email **advisor** `advisor_new_lead` | ⚠ design | 0 per submission organica (no `attribution_advisor_id`). Documentato in P1 backlog (digest pool). |

> Domain Resend `mail.moodfordesign.com` **verified**, sandbox OFF, dispatch in produzione.

---

## 2 · FASE 2 — COMMAND CENTER

| Verifica | Esito | Evidence |
|---|---|---|
| Lead presente in pipeline (`new`, `under_review`, `qualified`, `rejected`, `awaiting_founder`) | ✅ | audit `cc.request_in_pipeline` |
| Studio Requests UI mostra lead | ✅ | `03_command_center_studio_requests.jpeg` — Martinel Interior Design, Pordenone IT, Mario Rossi, +39 345 1234567, ref MOOD-4A7D-2622, status Activated |
| Tenant Activation Pipeline UI | ✅ | `04_activation_console.jpeg` — Kanban con 5 colonne, banner Email Layer "READY · Resend OK · Domain mail.moodfordesign.com · Sandbox OFF · sent 165 · failed 0", contatori 16/1/1/0/24 |
| `studio_name` in DB | ✅ | exact match `"Martinel Interior Design"` |
| `founder_name` in DB | ✅ | `"Mario Rossi"` |
| Market HQ (`Pordenone, IT`) | ✅ | audit `cc.drawer_geo_hq` |
| Target countries (US·GB·AE) | ✅ | audit `cc.drawer_geo_targets` |

> ⚠ **P1 minor cosmetic**: la card Studio Requests non renderizza ancora i
> chip *MARKETS / LANGUAGES / EXPERIENCES* (i campi sono valorizzati in
> DB e visibili nell'audit `geo`/`targets`). Non blocca l'attivazione del
> primo tenant. Da aggiungere nel prossimo ciclo UI senza modifiche di
> dati. **Esplicitamente non in scope di questo dry-run.**

---

## 3 · FASE 3 — REVIEW

| Transizione | Esito | Email gemella |
|---|---|---|
| `submitted → reviewing` | ✅ HTTP 200 | `studio_request_review` `status=sent` |
| `reviewing → contacted`  | ✅ HTTP 200 | (intermedio, no email gemella richiesta) |
| `contacted → qualified`  | ✅ HTTP 200 | `studio_request_qualified` `status=sent` |

Audit log via `studio_email_dispatch_log` confermato per ogni stadio.

---

## 4 · FASE 4 — ACTIVATION

| Verifica | Esito | Evidence |
|---|---|---|
| Activation preview API | ✅ | `tenant_name="Martinel Interior Design"`, `suggested_slug="martinel-interior-design-5"`, `founder_email`, `founder_name="Mario Rossi"`, `magic_link_validity_days=30`, `current_status="qualified"` |
| `POST /admin/studio/requests/{id}/activate` | ✅ HTTP 200 | `tenant_id` creato, `slug=martinel-interior-design-5`, `magic_link_url` issued |
| Tenant row in `tenants` | ✅ | `plan_assigned_at` valorizzato |
| Tenant-membership creata (founder=owner) | ✅ | jwt `role="owner"` su consume |
| Magic link generato | ✅ | URL `…/journey/continue?token=<32 byte>` salvato in dispatch log |
| Email `studio_request_approved` al founder | ✅ | audit `email.founder.approved_sent` — `status=sent`, subject `"Il tuo Blueprint è pronto · Martinel Interior Design"` |
| `magic_link_validity_days = 30` | ✅ | audit `email.founder.validity_30d` |

---

## 5 · FASE 5 — FOUNDER (Magic Link)

| Verifica | Esito | Evidence |
|---|---|---|
| `POST /auth/magic-link/consume` | ✅ HTTP 200 | `{ok:true, jwt, user, tenant, redirect_url:"/command-center/welcome"}` |
| Redirect target | ✅ | `/command-center/welcome` |
| `auth/me` ruolo `owner` | ✅ | audit `founder.auth_me_role_owner` |
| Tenant slug propagato | ✅ | `martinel-interior-design-7` (browser test) |
| **Nessuna fuga di `raw_token`** | ✅ | `/api/auth/magic-link/request` risponde **solo** `{delivered:true, expires_in_minutes:15}` — `/api/auth/password-reset/request` idem |

Console errors lato browser: nessuno bloccante. Restano warnings non-critici:
- `<a> nested in <a>` (LinkWithRef nel footer logo) — non bloccante.
- `block_heading / block_text "Unknown section type"` — fallback CMS innocuo.

---

## 6 · FASE 6 — WORKSPACE FOUNDER

`06_founder_workspace_welcome.jpeg` mostra il **Founder Welcome** completo:

- Monogram **"MD"** (dal payload V2)
- Headline **"Il tuo ecosistema è pronto."**
- Card data:
  - Lo Studio · **Martinel Interior Design**
  - Il Founder · **Mario Rossi**
  - L'Advisor curatoriale · **—** (organic submission, no assignment)
  - Lingua principale · **Italiano · IT**
  - Esperienze attivate · — (V2 capture, da arricchire)
- CTA **"ENTRA NELLO STUDIO"** verso il Blueprint workspace
- Firma `Con cura, il team curatoriale di MOOD`

Cosa NON ha visto il founder (come atteso):
- ❌ Editor CMS (`/blueprint/pages`, `/blueprint/blocks`) — protetto da AuthGate
- ❌ Schermata vuota / errore
- ❌ Pagina admin (`/command-center/overview`) — AuthGate redirige `owner` su `/welcome`

> ⚠ **P1 minor**: nella firma "Con cura,\nil team curatoriale di MOOD"
> il `\n` viene reso letterale (mancato `whitespace-pre-line` sul
> componente / o newline real in CMS block). Cosmetico, fuori scope.

---

## 7 · FASE 7 — RECOVERY FLOWS

| Flow | Esito | Evidence |
|---|---|---|
| Logout completo | ✅ | `07e_logout_state.jpeg` — tutti i 5 token cleared |
| Login email/password | ✅ | `07b_login_password_stage.jpeg` (probing → password) → `02_command_center_after_login_FIX.jpeg` |
| Password reset request (anti-enumerazione) | ✅ | `POST /auth/password-reset/request` → `{delivered:true, expires_in_minutes:15}`; nessun token in HTTP |
| Password reset landing senza token | ✅ | `07d_password_reset_page.jpeg` — "Manca il token di reset" + CTA "Torna all'accesso" |
| Magic link self-service | ✅ | `07a_login_identity_probe.jpeg` + link "Prosegui con magic-link" sullo stage password |
| Recovery suite (Password / Magic Link / Reinvia invito / Workspace) | ✅ | `07c_recovery_options_visible.jpeg` |

---

## 8 · FASE 8 — SECURITY

| Check | Esito |
|---|---|
| `/api/auth/magic-link/request` → no `raw_token`/`jwt` nella response | ✅ `{delivered:true, expires_in_minutes:15}` |
| `/api/auth/password-reset/request` → no token | ✅ `{delivered:true, expires_in_minutes:15}` |
| Founder JWT → `/admin/tenant-activation/pipeline` | ✅ HTTP **403** |
| Founder JWT → `/admin/studio/requests` | ✅ HTTP **403** |
| Founder JWT → manifest di un altro tenant (`studio`) | ✅ HTTP **404** |
| Founder JWT → `/admin/site/whoami` (own tenant) | ✅ HTTP **200** (post-fix) |
| Founder JWT → manifest del PROPRIO tenant | ✅ HTTP **200** |
| Anon → `/admin/*` | ✅ HTTP **401** (4 endpoint testati) |
| Anon → `/auth/me` | ✅ HTTP **401** |

---

## 9 · ISSUE RESIDUI NOTI (NON BLOCCANTI · esplicitamente FUORI SCOPE)

| Sev | Item | Decisione |
|---|---|---|
| P1 | `studio_requests.languages` array vuoto — V2 non chiede ancora le lingue parlate dallo studio | Tracked; non blocca attivazione. |
| P1 design | `advisor_new_lead` 0 email per submission organica (no advisor attribuito) | By design — digest pool è nel backlog P1. |
| P1 cosmetic | Card Studio Requests senza chip Markets/Languages/Experiences (dati esistono in DB) | UI-only, prossimo ciclo. |
| P2 cosmetic | "Con cura,\nil team curatoriale di MOOD" newline letterale nella firma Founder Welcome | i18n template polish. |
| P2 cosmetic | Console warning `<a> nested` nel footer logo | DOM-safe, da rifattorizzare. |
| P2 cosmetic | Console `Unknown section type: block_heading/block_text` | fallback CMS innocuo. |
| P1 — frozen by user | Corporate Footer `MERCATO` i18n mismatch | Esplicitamente in pausa. |

---

## 10 · ARTEFATTI

- `/tmp/first_real_tenant_audit.json` — audit raw (47 findings, 45 pass, 2 P1 design)
- `/app/memory/first_real_tenant_dry_run_*.json` — copia archiviata
- `/app/backend/scripts/first_real_tenant_audit.py` — audit script
- `/app/backend/scripts/dry_run_fresh_lead.py` — generatore lead+magic-link per browser
- `/app/memory/dry_run_screenshots/` — 110+ screenshot

### Screenshot critici (FASE → file)
- FASE 1 → `01_studio_v2_landing.jpeg`
- FASE 2 → `03_command_center_studio_requests.jpeg`
- FASE 4 → `04_activation_console.jpeg`
- FASE 5/6 → `06_founder_workspace_welcome.jpeg`
- FASE 7 → `07a_login_identity_probe.jpeg`, `07b_login_password_stage.jpeg`, `07c_recovery_options_visible.jpeg`, `07d_password_reset_page.jpeg`, `07e_logout_state.jpeg`
- POST-FIX → `02_command_center_after_login_FIX.jpeg`

---

## 11 · VERDETTO

> **`READY_TO_INVITE_FIRST_REAL_TENANT`** ✅
>
> La pipeline `Visitor → V2 Submit → Advisor Review → Tenant Activation
> → Founder Magic Link → Workspace` è certificata end-to-end con dati
> reali. Tutti i 3 P0 emersi durante il dry-run sono stati identificati,
> corretti e ri-verificati.
>
> Gli unici residui sono cosmetici/by-design (sez. 9) e non
> compromettono il go-live del primo showroom.

Generato il 2026-06-02 da E1 (Emergent), su istruzione utente "GO-LIVE DRY RUN — FIRST REAL TENANT CERTIFICATION".
