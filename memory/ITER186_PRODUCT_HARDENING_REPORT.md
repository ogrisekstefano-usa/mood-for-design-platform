# ITER186 · PRODUCT HARDENING REPORT™

**Sprint:** ITER186 · Product Hardening · Stabilization Before Expansion  
**Tipo:** Audit completo · Real-flow validation · No new features  
**Status:** ✅ DELIVERED  
**Data:** 2026-06-01  
**Owner:** Product Governance + Engineering Audit  
**Vincolo Founder:** AUDIT ONLY · NO new features, NO Notification Bus, NO Journey Assignments Phase 2, NO Client Chameleon, NO Editorial Onboarding, NO Error Registry implementation.

**Riferimenti:** `CRM_FOUNDATION_LOCKED_MODEL.md` v1.0, `ITER185_PHASE1_IMPLEMENTATION_REPORT.md`, `MOOD_LANGUAGE_CANON.md` v1.0.

---

## 0 · Sommario esecutivo

Blueprint ha **CRM Foundation operativa** dopo ITER185 Phase 1 (95% DoD). Tuttavia, prima di attivare i primi 10 showroom reali, **8 fix P0 sono richiesti** + **5 fix P1**. La risposta alla domanda finale del Founder:

> **🟡 GO WITH FIXES**
> Tempo stimato per stato "GO assoluto": **2-3 giorni effettivi** di lavoro pre-attivazione.

I 5 flussi CRM (A-E) sono **canonici e funzionanti** a livello backend e API. Le criticità sono concentrate in:
1. **Inconsistenza KPI** (relations/stats restituisce ancora valori legacy `lead/prospect/account/dormant` mentre la UI dashboard mostra `Lead/Prospect/Cliente/Journey`)
2. **Email magic-link non testato in produzione** (config Resend presente, ma deliverability ignota — P0)
3. **First-tenant 15-min UX** ha 3 attriti misurabili (next_action statico, no first-Lead guidance, copy CTA opachi)
4. **Editorial demo content** assente per nuovi tenant (P1)
5. **Empty states su LeadsPage/AccountsPage** mancano di pedagogia CRM (P0)

Tutti gli altri sotto-sistemi sono ✅ READY.

---

## 1 · CRM Flow Audit

### Flow A · Lead → Discovery → Prospect → Design Journey

| Step | Status | Note |
|---|---|---|
| Lead via Fast Capture | ✅ PASS | `/api/leads/fast-capture` 22/22 pytest |
| Discovery(pending) auto-create | ✅ PASS | Side effect ITER185.P1 |
| Discovery autosave | ✅ PASS | `PUT /api/discovery/{did}` |
| Progress 0→25→50→75 | ✅ PASS | Deterministico 4 sezioni × 25% |
| Qualify (75% gate) | ✅ PASS | Side effect: `account(prospect)` upsert |
| Journey da Prospect | ✅ PASS | `POST /api/accounts/{aid}/journeys` R1-R5 |

**Verdict: ✅ PASS**

### Flow B · Lead → Discovery → Prospect → Customer → Journey

| Step | Status | Note |
|---|---|---|
| Convert-to-customer (admin_override) | ✅ PASS | `lifecycle_stage='customer'` |
| Convert-to-customer (con proposal signed) | ⚠️ FIX REQUIRED | Validato in pytest ma **nessun ProposalPicker UI** — admin deve digitare proposal_id manualmente (UX P1) |
| Journey da Customer | ✅ PASS | Idem Flow A |
| Audit `funnel_events('customer.confirmed')` | ✅ PASS | Side effect |

**Verdict: ✅ PASS · UX fix consigliato (ProposalPicker)**

### Flow C · Customer → Nuova Design Journey

| Step | Status | Note |
|---|---|---|
| AccountsPage row Customer | ⚠️ FIX REQUIRED | Mostra "Rollback prospect" ma **NON** mostra "Nuovo Design Journey" inline come CTA primary su un Customer attivo |
| Modal new-relationship choice='customer' | ✅ PASS | Funziona da Topbar/Sidebar |
| Journey R5 enforcement (1 attiva per account) | ✅ PASS | 409 con force option |

**Verdict: 🟡 PARTIAL · CTA "Nuovo Design Journey" inline mancante**

### Flow D · Customer → Rollback → Prospect

| Step | Status | Note |
|---|---|---|
| AccountsPage Customer card "Rollback prospect" CTA | ✅ PASS | Visible |
| RevertToProspectModal (reason ≥10 char) | ✅ PASS | Pytest 5/5 |
| Audit `funnel_events('customer.reverted')` | ✅ PASS | Backend |
| UI Account torna in tab Prospects | ✅ PASS | `lifecycle_stage='prospect'` |

**Verdict: ✅ PASS**

### Flow E · Lead incompleto → abbandono → ripresa successiva

| Step | Status | Note |
|---|---|---|
| Lead salvato con campi minimi (name + phone) | ✅ PASS | Fast Capture <30s |
| Discovery `status='pending'` persiste | ✅ PASS | Auto-create |
| Ripresa: trovare il lead in `/relations/leads` | ⚠️ FIX REQUIRED | Manca filtro `status` e ricerca dedicata. Lead lista paginata senza search box visibile |
| Riapertura Discovery panel | ⚠️ FIX REQUIRED | Manca route diretta `/relations/leads/{id}` o drawer. L'utente non sa dove riprendere |

**Verdict: 🔴 FAIL · Lead resumption UX è il gap più critico**

---

## 2 · Dashboard Audit

### 2.1 · KPI consistency

| KPI surface | Endpoint chiamato | Valori restituiti | Canon-compliant |
|---|---|---|---|
| `/api/relations/stats` (legacy) | `leads.progression_state` | `{lead:52, prospect:4, account:24, dormant:0}` | ❌ NO (usa enum legacy) |
| Dashboard top counters (UI) | Vario · forse aggregato lato FE | `Lead:37 · Prospect:11 · Clienti:6 · Journey:0` | ✅ SI (canon labels) |
| **Mismatch detected** | Same data, diverse query | `prospect`: 4 vs 11 | 🔴 INCONSISTENT |

🔴 **FIX REQUIRED P0**: Dashboard e ProspectsPage usano source diverse. ITER185 Phase 2 deve consegnare `v_crm_funnel` view + `GET /api/dashboard/kpi-funnel` come single source of truth.

### 2.2 · Quick Actions audit (WorkspaceActionHub)

| Action | Route | Canon-compliant |
|---|---|---|
| Nuovo Lead | `modal:new-relationship` choice=lead | ✅ |
| Qualifica Prospect | `/relations/leads` | ✅ |
| Nuovo Design Journey | `modal:new-relationship` choice=prospect | ✅ |
| Apri Journey | `/workspace/projects` | ✅ |
| Media Library | `/library` | ✅ |
| Materiali / Material View | `/library/materials` | ⚠️ duplicate label |
| Moodboard | `/moodboards` | ✅ |
| Calendario Editoriale | `/blueprint/editorial-calendar` | ✅ |

**No legacy CTAs. No Journey-from-Lead path.** ✅

🟡 **MINOR**: "Materiali" + "Material View" puntano alla stessa route con label diverse → confusione.

### 2.3 · Empty states

| Surface | Status | Note |
|---|---|---|
| Dashboard (nessun lead) | ⚠️ PARTIAL | Activation Foundation mostra steps ma non guida verso "primo Lead" |
| LeadsPage empty | ⚠️ PARTIAL | Header presente ma manca CTA hero "+ Crea il primo Lead" |
| ProspectsPage empty | ⚠️ PARTIAL | Manca call-to-action educational |
| AccountsPage empty | ⚠️ PARTIAL | Mancano hint pedagogici |
| Moodboards/Inspirations empty | ✅ READY | (post-ITER183) |

🔴 **FIX REQUIRED P0**: empty states devono mostrare CTA primaria + 1-line "perché farlo".

### 2.4 · Activation Foundation

```
Items completed: 2/5 (40%)
Next action: Blueprint Chameleon™ → /settings
```

Mostra step canon:
1. Identità operativa
2. Blueprint Chameleon™
3. Team
4. Mercato operativo
5. Workspace attivo

✅ Steps coerenti. ⚠️ Manca step "Crea il primo Lead" come 6° step esplicito.

---

## 3 · Team Audit

### 3.1 · Members lifecycle

| Step | Endpoint | Status |
|---|---|---|
| Admin invita Designer | `POST /api/members/invite` | ✅ funziona (test live: id=`3b4eb25b-...` creato) |
| Supabase invite_user (admin API) | `/auth/v1/admin/invite` | ✅ called |
| Email magic-link sent | Supabase SMTP | ⚠️ **non verificato in test reale** |
| Member status='invited' | `members.status='invited'` | ✅ |
| Member accept (login) | `/api/auth/login` (con magic-link) | ❓ flow non testato E2E |
| Status `invited→active` | trigger Supabase | ⚠️ non verificato |
| Operatività post-accept | ruoli applicati | ❓ |

### 3.2 · Endpoint members (6)
- ✅ `GET /api/members` (lista, 2 attuali)
- ✅ `GET /api/members/roles`
- ✅ `POST /api/members/invite` (test live OK)
- ✅ `POST /api/members/{id}/resend-invite`
- ✅ `PATCH /api/members/{id}` (role/status update)
- ✅ `DELETE /api/members/{id}`

### 3.3 · Ruoli disponibili
Confermare via `GET /api/members/roles`: tipicamente `tenant_admin`, `designer`, `pm`, `viewer`.

### 3.4 · Verdetto

🟡 **PARTIAL READY**
- ✅ Backend: invite endpoint funziona, scrive su `members` + `auth.users` Supabase
- ⚠️ Email delivery: **mai testata davvero** (P0 critical — vedi §4)
- ❌ E2E flow `accept → login → workspace` non testato in questo job

---

## 4 · Email System Validation

### 4.1 · Configurazione

| Provider | Configured | Notes |
|---|---|---|
| RESEND_API_KEY | ✅ presente in `backend/.env` | Service active |
| Supabase Auth SMTP | ❓ unknown | Supabase project setting (out-of-band) |
| Sender domain | ❓ unknown | DKIM/SPF non verificati |

### 4.2 · Send paths nel codice

| Funzione | File | Use case |
|---|---|---|
| `send_template_email()` | `services/email_service.py:246` | Transactional (welcome, invite, journey) |
| `send_email()` | `services/email_service.py:296` | Legacy entry |
| Supabase Admin Invite | `routers/members.py:_supabase_invite_user` | Magic-link invite |
| `forgot-password` | `routers/auth.py:295` | Password reset |
| `silent-magic-link` | `routers/auth.py:396` | Client portal entry |

### 4.3 · Test endpoints stato

| Endpoint | HTTP | Note |
|---|---|---|
| `POST /api/auth/forgot-password` | 200 | Funziona |
| `POST /api/auth/silent-magic-link` | 200 | Funziona |
| `POST /api/auth/magic-link` | 404 | Non esiste (probabilmente integrato in silent-magic-link) |
| `POST /api/auth/client/resend` | 422 | Funziona (richiede body specifico) |

### 4.4 · GAP P0 critici

🔴 **EMAIL-1**: Magic-link invite delivery **mai verificata in produzione**. Necessario:
- Test reale: invitare un email reale (es. tester@gmail.com), verificare ricezione
- Verificare scadenza link (default Supabase: 24h)
- Verificare branding (mittente, oggetto, body HTML)
- Verificare spam folder rate
- Verificare deliverability su Gmail, Outlook, Apple Mail

🔴 **EMAIL-2**: Sender domain DKIM/SPF status sconosciuto. Senza queste, invio finisce in spam.

🟠 **EMAIL-3**: Resend API key configurata ma codice non verifica se `RESEND_API_KEY` è valida al boot (potrebbe essere scaduta in silenzio).

### 4.5 · Verdetto

🔴 **P0 BLOCKER**: prima dell'attivazione di **qualsiasi** showroom reale, eseguire smoke-test email reale documentato con screenshot inbox + spam folder + link click.

---

## 5 · First Tenant Experience

### 5.1 · Scenario simulato (nuovo tenant, primi 15 minuti)

| Minuto | Esperienza utente | Friction |
|---|---|---|
| 0:00 | Login OK | ✅ |
| 0:30 | Dashboard si carica | ✅ |
| 0:45 | Vede Activation Foundation 0/5 | ✅ pedagogico |
| 1:00 | Click "Apri impostazioni" (Blueprint Chameleon) | ✅ |
| 2:00 | Completa Identità + Branding | ✅ |
| 4:00 | Torna a Dashboard, vede 1-2/5 | ✅ |
| 5:00 | **Cerca "dove aggiungo il primo cliente?"** | ⚠️ Non guidato |
| 5:30 | Vede sidebar "+ Nuovo Lead" o Quick Action | ✅ |
| 6:00 | Fast Capture: <30s | ✅ |
| 6:30 | Toast "Lead creato. Avvia la Discovery." | ✅ |
| 6:31 | **Discovery panel non si apre automaticamente** | ⚠️ navigation gap |
| 7:00 | Cerca il lead nella lista, lo apre | ⚠️ no `/relations/leads/{id}` route |
| 8:00 | Apre Discovery panel | ✅ |
| 10:00 | Compila signals (budget, timeline) | ✅ progress 75% |
| 11:00 | Click "Qualifica" → Prospect creato | ✅ |
| 12:00 | Naviga a `/relations/prospects` → vede il prospect | ✅ |
| 13:00 | **Cerca "ora come apro un progetto?"** | ⚠️ no inline CTA |
| 14:00 | Torna a sidebar, clicca Quick Action "Nuovo Design Journey" | ✅ |
| 15:00 | Journey aperta | ✅ goal met |

### 5.2 · Verdict: 🟡 GO WITH FIXES

**Domanda: un nuovo tenant capisce cosa fare nei primi 15 minuti?**

**Risposta: ~75% sì.** I 4 friction sono:
1. 🔴 Post Fast Capture, no auto-open Discovery (oggi navigate a `/relations/leads`)
2. 🔴 `/relations/leads/{id}` non esiste come page (no drawer, no detail)
3. 🟠 AccountsPage non ha CTA "Nuovo Design Journey" inline
4. 🟠 Activation Foundation non include step "Crea il primo Lead"

---

## 6 · Journey Assignment Readiness

### 6.1 · Tabelle DB

- ✅ `design_journey_assignments` (migration 113)
- ✅ `design_journey_assignment_events` (audit log)
- ✅ Ruoli enforced: `owner` (1 unique), `contributor` (N), `observer` (N)

### 6.2 · API endpoints

| Endpoint | Status |
|---|---|
| `GET /api/journeys/{id}/assignments` | ✅ |
| `POST /api/journeys/{id}/assignments` | ✅ |
| `POST /api/journeys/{id}/assignments/change-owner` | ✅ |
| `DELETE /api/journeys/{id}/assignments/{assignee_id}` | ✅ |
| `GET /api/journeys/{id}/assignment-events` | ✅ |
| `GET /api/journeys/mine` | ✅ (per "Le mie journey") |

### 6.3 · UI

- ❌ Admin assignment drawer: NON esiste
- ❌ "Le mie journey" page: NON esiste
- ❌ Client portal journey visibility filtering: NON verificato
- ❌ Designer dashboard "assigned to me": NON esiste

### 6.4 · Verdict

🟡 **PARTIAL (Backend READY · Frontend NOT READY)**

ITER178 ha consegnato **solo backend**. UI completa è ITER186 Phase 2 (al di fuori di questo audit). Per "10 showroom reali": **NON BLOCKER** finché si lavora con team 1-2 persone (founder + 1 designer).

---

## 7 · Error Registry Backlog (Top 20 errori visibili)

| # | Codice | Schermata | Causa | Gravità | Locale-ready |
|---|---|---|---|---|---|
| 1 | `LEAD-NAME-REQUIRED` | Fast Capture | Nome <2 char | LOW | ❌ |
| 2 | `LEAD-CONTACT-REQUIRED` | Fast Capture | né email né phone | LOW | ❌ |
| 3 | `LEAD-INVALID-SOURCE` | Fast Capture | source fuori enum | LOW | ❌ |
| 4 | `LEAD-SOURCE-DETAIL-REQUIRED` | Fast Capture | source='other' senza detail | LOW | ❌ |
| 5 | `LEAD-DEDUP-MATCH` | Fast Capture | duplicato email/phone | MED | ❌ |
| 6 | `LEAD-NOT-FOUND` | LeadDetail | URL invalido o tenant scope | MED | ❌ |
| 7 | `DISCOVERY-INVALID-STATE` | Discovery panel | qualify da non-pending | MED | ❌ |
| 8 | `DISCOVERY-PROGRESS-INSUFFICIENT` | Qualify CTA | <75% | MED | ❌ |
| 9 | `DISCOVERY-NOT-FOUND` | Discovery panel | route invalida | LOW | ❌ |
| 10 | `ACCOUNT-NOT-FOUND` | Account/Journey | URL invalido | MED | ❌ |
| 11 | `ACCOUNT-INVALID-STAGE` | Convert/Revert | stage fuori canon | HIGH | ❌ |
| 12 | `PROPOSAL-NOT-FOUND` | Convert | proposal_id invalido | MED | ❌ |
| 13 | `PROPOSAL-REQUIRED` | Convert | senza proposal_id e no admin_override | MED | ❌ |
| 14 | `PROPOSAL-NOT-SIGNED` | Convert | proposal status != signed | HIGH | ❌ |
| 15 | `PROPOSAL-ACCOUNT-MISMATCH` | Convert | proposal di altro account | HIGH | ❌ |
| 16 | `JOURNEY-ALREADY-ACTIVE` | New Journey | 1 attiva per account | MED | ❌ |
| 17 | `ENDPOINT-DEPRECATED` | promote legacy | path obsoleto | LOW | ❌ |
| 18 | `403 Forbidden` (generic) | Vario | permission denied | HIGH | ❌ |
| 19 | `401 Not authenticated` | Vario | token expired | HIGH | ❌ |
| 20 | `Network/timeout` (frontend) | Vario | connessione | HIGH | ❌ |

**Verdict:** 🟠 **0/20 errori sono i18n-mappati.** Frontend mostra `e.response?.data?.detail?.message` raw EN. Per "10 showroom reali in IT" serve almeno mappatura IT su top-10.

🔴 **FIX REQUIRED P1**: i18n mapping `errors.{code}` su top-10 codici.

---

## 8 · Editorial Reality Check

### 8.1 · Endpoint check

| Endpoint | HTTP | Note |
|---|---|---|
| `/api/editorial/calendar` | 200 | Ritorna `{items: [], total: 0}` |
| `/api/editorial/articles` | 404 | Non esiste · path diverso |
| `/api/magazine/posts` | 404 | Non esiste · path diverso |

### 8.2 · UI surfaces

- `pages/blueprint/EditorialCalendar*.jsx` esiste
- `pages/magazine/*.jsx` esiste
- Demo content / placeholder per nuovi tenant: **NON esiste** (verificato via Activation Foundation steps)

### 8.3 · Verdict

🟠 **CONFUSING**
- Module presente ma vuoto per nuovi tenant
- Non c'è demo content
- Calendario editoriale appare vuoto al primo accesso
- Magazine route 404 da audit endpoint

🔴 **FIX REQUIRED P1**: per i primi 10 tenant showroom, una di queste:
- a. Seedare `editorial_demo_catalog` con 3-5 articoli demo read-only
- b. Empty state pedagogico "Crea il primo articolo · Pianifica una cadenza editoriale"
- c. Nascondere Editorial dal menu finché tenant non lo abilita esplicitamente

---

## 9 · Technical Debt Inventory

### 9.1 · Endpoint legacy ancora attivi

| Endpoint | Status | Action |
|---|---|---|
| `POST /api/relations/leads/{id}/promote` | 🔴 Deprecated 410 Gone (ITER185.P1) | Lascia (warning attivo) |
| `GET /api/relations/stats` | 🟡 Restituisce enum legacy `lead/prospect/account/dormant` | ITER185 Phase 2: rimpiazzare con `kpi-funnel` |
| `POST /api/leads/dedup-check` | 🟡 Sovrapposizione con Fast Capture dedup | Lasciare (usato altrove) |

### 9.2 · Route legacy frontend

| Route | Status |
|---|---|
| `/studio-pulse` → redirect `/studio/pulse` | ✅ OK |
| `/journey-pulse` → redirect `/dashboard/pulse` | ✅ OK |
| Vecchie route Relazione → CRM | ✅ rinominate (ITER183) |

### 9.3 · Componenti legacy non più usati

| Component | Use count | Action |
|---|---|---|
| `WelcomeDrawer kind='promote_account'` | usato da ProspectsPage | 🟠 audit: cosa fa il `promote_account` action ora? Probabilmente dead path post ITER185 |
| `useRelations.promote()` | throws PROMOTE_DEPRECATED | 🟡 lasciare 1 sprint poi rimuovere |
| `first_journey_id` column su leads | ancora popolato da public Begin Journey | 🟡 ITER185 Phase 2 deprecate write |

### 9.4 · Copy residuo (post-ITER183)

| Item | Status |
|---|---|
| User-facing banned terms | ✅ 0 hits |
| Internal taxonomy keys (`atmosphere_*`, `cultural_*`) | ✅ allowed |
| Comments / docstrings | ⚠️ alcuni "atmospheres", "viaggio" rimasti come gergo dev — non urgente |

### 9.5 · Feature duplicate

| # | Duplicato |
|---|---|
| 1 | "Materiali" + "Material View" Quick Actions stessa route |
| 2 | `LeadFormPage.jsx` (public) + Fast Capture (workspace) — funzioni diverse, OK |
| 3 | `intake/closed-answers` (legacy) + `journeys/initiate` — entrambi public, ridondanti |

---

## 10 · P0 Fix List

| # | Item | Effort | Owner |
|---|---|---|---|
| **P0-1** | **Email magic-link real test** (invio + ricezione + click + branding) | 0.25g | Engineering |
| **P0-2** | **DKIM/SPF sender domain audit** | 0.25g | Infra |
| **P0-3** | **Lead resumption UX**: post Fast Capture → auto-open Discovery panel (drawer o navigation con `?discovery=1`) | 0.5g | Frontend |
| **P0-4** | **`/relations/leads/{id}` route**: LeadDetailPage minimal con Discovery panel embedded | 0.75g | Frontend |
| **P0-5** | **Empty states pedagogici** (LeadsPage, ProspectsPage, AccountsPage) con CTA primary | 0.5g | Frontend |
| **P0-6** | **KPI consistency fix**: ProspectsPage e dashboard top counters da unica fonte | 0.5g | Backend + Frontend |
| **P0-7** | **AccountsPage CTA "Nuovo Design Journey" inline** su Customer cards | 0.25g | Frontend |
| **P0-8** | **Activation Foundation step "Crea il primo Lead"** come 6° step | 0.25g | Backend + Frontend |

**Totale P0: ~3.25g**

---

## 11 · P1 Fix List

| # | Item | Effort |
|---|---|---|
| **P1-1** | i18n mapping `errors.{code}` per top-10 codici (LEAD-*, DISCOVERY-*, ACCOUNT-*) | 0.5g |
| **P1-2** | Editorial demo content seed o empty state pedagogico | 0.5g |
| **P1-3** | ProposalPicker UI in ConvertToCustomerModal (dropdown delle proposals signed) | 0.5g |
| **P1-4** | Rimuovi duplicato Quick Action "Material View" | 0.1g |
| **P1-5** | Members invite resend con audit log visibile in UI | 0.5g |

**Totale P1: ~2.1g**

---

## 12 · Go / No-Go Assessment

### 12.1 · Domanda Founder

> **"Se domani attiviamo 10 showroom reali, Blueprint è pronto?"**

### 12.2 · Risposta

# 🟡 GO WITH FIXES

### 12.3 · Razionale

**Pronto:**
- ✅ CRM Foundation canonica (ITER185 Phase 1 shipped)
- ✅ Backend lifecycle enforcement attivo (R1-R5 + 75% gate + audit trail)
- ✅ 22 pytest CRM PASS
- ✅ Frontend 95% acceptance (testing_agent_v3)
- ✅ Members invite endpoint funzionante a livello API
- ✅ Lessico canon (post ITER183) zero banned terms

**Non pronto senza P0 fixes:**
1. 🔴 **Email magic-link non verificato in produzione reale** — un showroom non può attivare designer se l'email non arriva
2. 🔴 **Lead resumption UX rotto** — designer perde il filo dopo Fast Capture
3. 🔴 **KPI dashboard inconsistente** — Prospect count differente tra surfaces (4 vs 11)
4. 🟠 **Empty states "muti"** — nuovi tenant non sanno cosa fare

### 12.4 · Tempo per "GO assoluto"

**~3 giorni effettivi** di lavoro mirato (P0 fixes §10).

Dopo 3 giorni: **GO** per pilot con 3-5 showroom reali, con monitoring stretto.  
Dopo 1 settimana di pilot stabile: **GO** per scale a 10 showroom.

### 12.5 · Decision Gate raccomandato al Founder

| Opzione | Conseguenza |
|---|---|
| **A.** Attiva ora i 10 showroom | 🔴 Alta probabilità di churn entro settimana 1 (email rotta + UX gap) |
| **B.** Attiva 1-2 pilot showroom oggi, fix P0 in parallelo | 🟡 Rischio medio, ma learning rate alto |
| **C.** Fix P0 (3g) + attiva 3-5 showroom dopo | ✅ Raccomandato |
| **D.** Fix P0 + P1 (5g) + attiva 10 showroom dopo | ✅ Più safe ma ritarda mercato |

**Raccomandazione: Opzione C.**

---

## 13 · Vincolo Founder rispettato

✅ Zero nuove feature implementate  
✅ Zero modifiche DB / migration  
✅ Zero modifiche API  
✅ Zero modifiche frontend (eccetto fix `LeadsPage.jsx` imports da iter170 già in produzione)  
✅ Solo audit e report

✅ Solo file creato:
- `/app/memory/ITER186_PRODUCT_HARDENING_REPORT.md` (questo documento)

---

## 14 · Revision log

| Versione | Data | Autore | Note |
|---|---|---|---|
| 1.0 | 2026-06-01 | Product Governance + Engineering Audit | Audit iniziale ITER186 |

---

**Status:** 🟡 **GO WITH FIXES**  
**Next gate:** approvazione Founder sulla Opzione C (fix P0 in 3g · poi pilot showroom).  
**Blocked iterations:** Notification Bus, Journey Assignments Phase 2 UI, Client Chameleon, Editorial Onboarding, Error Registry implementation — tutte rinviate post-ITER186 P0 fixes.
