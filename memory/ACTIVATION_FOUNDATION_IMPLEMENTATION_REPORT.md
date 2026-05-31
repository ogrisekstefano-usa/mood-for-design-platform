# ACTIVATION FOUNDATION™ — Implementation Report (ITER180)

**Sprint:** ITER180  
**Data chiusura:** 2026-05-31  
**Stato:** ✅ COMPLETATO · 10/10 backend tests PASS · Frontend smoke PASS · 0 action items su ITER180  
**Tenant di riferimento:** `848354b9-a43e-4147-bdad-116fb93bd585` (MOOD for DESIGN)  
**Test report:** `/app/test_reports/iteration_162.json`  
**Test suite pytest:** `/app/backend/tests/test_iter180_activation_foundation.py`

---

## 1 · Obiettivo

Permettere a un nuovo tenant di capire **contesto · cosa manca · prossimo step operativo** entro **30 secondi dal login**, senza tutorial, senza testo poetico, in conformità con CRM Lifecycle Canon e Copy Governance C3.

I 6 step canonici della Foundation:

| # | Step key | Titolo | CTA route |
|---|----------|--------|-----------|
| 0 | `identity` | Identità operativa | `/settings/identity` |
| 1 | `blueprint` | Blueprint Chameleon™ | `/settings` |
| 2 | `team` | Invita il primo collaboratore | `/settings/members` |
| 3 | `first_lead` | Primo Lead | `modal:new-relationship` |
| 4 | `first_prospect` | Primo Prospect qualificato | `/relations/leads` |
| 5 | `first_journey` | Prima Design Journey™ | `modal:new-relationship` |

---

## 2 · Building Blocks consegnati

### AF1 · PersistentAlertBanner™
**File:** `/app/frontend/src/components/activation/PersistentAlertBanner.jsx`  
**Iniezione:** `/app/frontend/src/App.js` L. 400, dentro `ActivationFoundationProvider`.

- Sticky in cima a tutta l'app (`position: sticky; z-index: 90`).
- Visibile **solo se**: studio member (non client) · `activated=false` · `next_action` esiste · non dismissato nelle ultime 24h.
- Mostra `completed/total · titolo step critico · descrizione · CTA Smart`.
- Bottone `X` salva un `localStorage` con TTL 24h (`mood.activation.banner_dismissed_until`).
- `data-testid`: `activation-banner`, `activation-banner-cta`, `activation-banner-dismiss`.

### AF2 · ActivationMeter™
**File:** `/app/frontend/src/components/activation/ActivationMeter.jsx` (export `ActivationMeter`).  
**Iniezione:** `AtelierDashboardPage.jsx` via `<ActivationFoundationCard />` L. 376.

- Widget compatto con progress bar e label `N / 6 step`.
- Modalità `compact={true}` disponibile (badge pill 11px) per Topbar/secondary surfaces.
- Badge `Workspace Activated™` quando `completed === total`.
- `data-testid`: `activation-meter`, `activation-meter-progress`, `activation-meter-compact`.

### AF3 · WorkspaceActivationChecklist™
**File:** stesso file di AF2 (export `WorkspaceActivationChecklist`).

- Lista a 6 step con icone `CheckCircle2`/`Circle`.
- Step done: testo strikethrough + opacità 0.65.
- Step pending: badge "Manca: {missing fields}" su `identity`, e CTA inline.
- A 6/6 mostra la card `activation-checklist-completed` con messaggio Workspace Activated™.
- `data-testid`: `activation-checklist`, `activation-step-{key}`, `activation-step-{key}-cta`.

### AF4 · Smart CTA Routing™
**File:** `/app/frontend/src/hooks/useSmartCtaRouter.jsx`.

- Riceve `cta_route` dal backend e instrada:
  - `modal:new-relationship` → apre `NewRelationshipModal` (CRM Canon-compliant)
  - `/path/...` → `navigate(path)` via react-router
- Tutti i CTA (banner, checklist) passano da questo hook → garantisce che ogni Lead/Journey nasca dal Modal e mai via deep-link laterale.

### STEP 0 · Identità Operativa
**File:** `/app/frontend/src/pages/settings/IdentityPage.jsx`  
**Route:** `/settings/identity` (admin only, `StudioAdminRoute`)  
**Backend:** `POST /api/tenant-onboarding/identity` (admin only)

Form a 4 campi obbligatori, tutti in italiano professionale:
- Nome studio (free text)
- Mercato principale (select: IT, EU, US, UK, Globale)
- Lingua principale (select: it-IT, en-US, en-GB, fr-FR, de-DE, es-ES)
- Timezone (select: 11 valori standard)

Salva su `tenants.name`, `tenants.default_language`, `tenants.default_locale_code`, `tenants.branding_settings.{primary_market, timezone}`.  
Submit → redirect `/dashboard` → step `identity` torna done al refresh.  
`data-testid`: `identity-page`, `identity-name`, `identity-market`, `identity-language`, `identity-timezone`, `identity-save`.

---

## 3 · Bug critico risolto

**Issue P0:** crash dashboard / screenshot timeout previsto in handoff.  
**Causa:** in `AtelierDashboardPage.jsx` la funzione `ActivationFoundationCard()` era stata iniettata **dentro** la funzione `AtelierDashboardPage` (prima del `</div>` finale), lasciando `);` e `};` orfani in coda (righe 458-459) → SyntaxError.  
**Fix:** spostata la funzione FUORI dal componente principale, ripristinate le chiusure `</div>`, `);`, `};` nel punto corretto, mantenuto `export default AtelierDashboardPage`.

**Bonus fix:**
- `useActivationFoundation.jsx` e `IdentityPage.jsx` usavano `localStorage.getItem('token')` (legacy) → corretti per usare il wrapper `api` da `/app/frontend/src/lib/api.js`, che legge correttamente `mfd_session.access_token`.
- Backend `_AF_CATALOGUE` conteneva il termine bandito **"atmosfera"** → sostituito con `"stile"` (C3 compliant).

---

## 4 · File modificati / creati

### Creati in questo sprint
- `/app/backend/routers/tenant_onboarding.py` (esteso: `_activation_state`, `_AF_CATALOGUE`, `GET /activation-foundation`, `POST /identity`)
- `/app/frontend/src/hooks/useActivationFoundation.jsx`
- `/app/frontend/src/hooks/useSmartCtaRouter.jsx`
- `/app/frontend/src/components/activation/PersistentAlertBanner.jsx`
- `/app/frontend/src/components/activation/ActivationMeter.jsx`
- `/app/frontend/src/pages/settings/IdentityPage.jsx`
- `/app/backend/tests/test_iter180_activation_foundation.py` (10 test, generato da testing subagent)

### Modificati per integrazione
- `/app/frontend/src/App.js` (import provider + banner + lazy IdentityPage + route + wrap)
- `/app/frontend/src/pages/dashboard/AtelierDashboardPage.jsx` (import + `<ActivationFoundationCard />` injection)

### Report
- `/app/memory/ACTIVATION_FOUNDATION_IMPLEMENTATION_REPORT.md` (questo documento)

---

## 5 · API consegnate

### `GET /api/tenant-onboarding/activation-foundation`
Studio members only (403 client). Risposta:

```json
{
  "tenant_id": "...",
  "items": [ { "key": "identity", "ordinal": 0, "title": "...", "description": "...",
               "cta_label": "...", "cta_route": "...", "critical": true,
               "done": true|false, "metadata": {...} }, ... ],
  "completed": 1,
  "total": 6,
  "progress": 17,
  "activated": false,
  "next_action": { ...primo step critical non done... }
}
```

Logica `_activation_state`: signal-driven, no hardcoded flag. Verifica live:
- `identity` → tenants.name + branding.primary_market + default_language + branding.timezone
- `blueprint` → `tenant_atelier_identity.preset_code` esiste
- `team` → ≥ 2 `users_profile` attivi sul tenant
- `first_lead` → ≥ 1 row in `leads`
- `first_prospect` → ≥ 1 `accounts.lifecycle_stage = 'prospect'`
- `first_journey` → ≥ 1 row in `design_journeys`

### `POST /api/tenant-onboarding/identity`
Admin only (tenant_admin / super_admin). Body opzionale:
```json
{ "name": "...", "primary_market": "IT|EU|US|UK|GLOBAL", "language": "it-IT|en-US|...", "timezone": "Europe/Rome|..." }
```
Aggiornamenti parziali idempotenti, preserva `branding_settings` esistente via merge.

---

## 6 · Criteri di completamento (acceptance) — esito

| Criterio | Atteso | Esito |
|---|---|---|
| Banner sticky visibile su dashboard quando non attivato | sì | ✅ verificato (`activation-banner` presente) |
| Banner dismiss 24h funzionante | sì | ✅ verificato |
| Activation Meter mostra `N/6 step` + progress bar | sì | ✅ "1 / 6 step" |
| Checklist 6 step con CTA Smart per ogni step pending | sì | ✅ tutti i `activation-step-{key}` presenti |
| Step `identity` riconosciuto come done quando i 4 campi sono presenti | sì | ✅ verificato (strikethrough sul seed tenant) |
| Smart CTA `modal:new-relationship` apre `NewRelationshipModal` | sì | ✅ Playwright click + modal opened |
| Smart CTA path `/...` naviga via react-router | sì | ✅ verificato |
| Route `/settings/identity` accessibile da admin | sì | ✅ verificato |
| Form Identità: tutti i 4 campi obbligatori + bottone save disabled finché vuoti | sì | ✅ verificato |
| POST `/identity` aggiorna `tenants` correttamente, idempotente | sì | ✅ pytest PASS |
| Endpoint Activation Foundation 403 per role=client | sì | ✅ pytest PASS |
| Endpoint POST `/identity` 403 per non-admin | sì | ✅ pytest PASS |
| Tutto il copy in italiano professionale C3 | sì | ✅ `atmosfera` rimosso, lint pulito su nuovi file |
| Backend pytest suite | green | ✅ 10/10 |
| Frontend smoke screenshot | render OK | ✅ vedi `/tmp/dashboard_iter180.png` |

---

## 7 · CTA associate per step (mappa)

| Step | CTA label | Route | Target |
|---|---|---|---|
| identity | Configura identità | `/settings/identity` | `IdentityPage` |
| blueprint | Apri impostazioni | `/settings` | `SettingsPage` (Chameleon picker) |
| team | Invita un membro | `/settings/members` | `MembersPage` |
| first_lead | Apri Nuova Relazione | `modal:new-relationship` | `NewRelationshipModal` |
| first_prospect | Vai ai Lead | `/relations/leads` | `LeadsPage` |
| first_journey | Apri Nuova Relazione | `modal:new-relationship` | `NewRelationshipModal` |

---

## 8 · Screenshot di riferimento

- `/tmp/dashboard_iter180.png` — Dashboard post-login con banner sticky + ActivationMeter + Checklist 6 step (step 0 done, 5 pending).

---

## 9 · Limiti residui / pre-existing

Nessuno bloccante per ITER180. Issue cosmetici **carried-over** (già flaggati in iter161, fuori scope ITER180):

- Overlay "EDITORIAL · DEBUG runtime · missing N" visibile in preview env → da gateare a `NODE_ENV==='development'`.
- Chiavi i18n `auth.login.*`, `auth.access.*`, `nav.*` non presenti nel registry editorial — fallback IT funziona.
- React warning `LocalizationOverlay` setState durante render del `Sidebar` su mount dashboard.
- Alcune chiamate 403 silenziose nella console post-login (probe admin non autorizzati).

Tutti questi sono fuori scope ITER180 e nessuno tocca l'esperienza Activation Foundation.

---

## 10 · Compliance

- **CRM Lifecycle Canon** ✅ — Tutti i CTA "primo lead / primo journey" passano dal `NewRelationshipModal`, mai shortcut diretti che permetterebbero di saltare Discovery.
- **Copy Governance C3** ✅ — `_AF_CATALOGUE` non contiene termini banditi (`atmosfera`, `cinematic`, `ecosistema`, `curatoriale`); `copy_lint.py` pulito sui file Activation Foundation.
- **RBAC** ✅ — `client` 403, non-admin 403 su POST identity.
- **No mock** ✅ — `_activation_state` legge segnali live da Supabase, nessun flag finto.

---

**ITER180 chiuso.**
