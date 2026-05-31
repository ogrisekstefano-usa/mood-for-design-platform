# ACTIVATION FOUNDATION™ · AUDIT
## ITER179 · Mappa dello stato di onboarding tenant + roadmap activation experience

> **Status:** 📋 AUDIT DOCUMENT (no code change) · 31 May 2026
> **Riferimento:** `STUDIO_ACTIVATION_ARCHITECTURE.md`, `TEAM_LIFECYCLE_AUDIT.md`, `CRM_LIFECYCLE_CANON.md`
> **Scope:** un tenant nuovo deve capire **immediatamente** cosa configurare, cosa manca, qual è il prossimo passo operativo — prima ancora di toccare le funzionalità avanzate

---

## §0 · EXECUTIVE SUMMARY

Lo stato attuale dell'onboarding tenant è **frammentato**. La tabella `tenant_onboarding` esiste, alcuni componenti UI esistono (`TenantOnboardingHeader`, `OnboardingChecklist`), ma:
- **Nessun activation meter consolidato** mostra al Founder/admin lo stato globale del tenant
- **Nessun alert persistente** segnala mancanze critiche (es. "Blueprint non configurato", "0 membri team", "0 Lead in CRM")
- **Nessuna procedura "Activation Foundation 5-step"** è realmente cablata nel flusso utente (è documentata in `STUDIO_ACTIVATION_ARCHITECTURE` ma non implementata)

**Conseguenza:** un tenant nuovo apre il workspace, vede sezioni vuote, e non sa **da dove cominciare**. Il rischio è abbandono prima del primo Lead.

L'audit propone:
1. **5 step canonici** (Activation Foundation™): selezione Blueprint Chameleon, invito team, primo Lead, qualifica Prospect, prima Design Journey
2. **Activation meter** in header (`Workspace Activated™` quando i 5 sono completi)
3. **Persistent alert banner** quando >1 step critico manca
4. **Checklist UI** in dashboard accessibile sempre

---

## §1 · STATO ATTUALE — INVENTARIO

### 1.1 · Database

| Tabella | Colonne chiave | Stato |
|---|---|---|
| `tenants` | `id, slug, display_name, primary_color, active, created_at, …` | ✅ esiste, popolata per ogni tenant |
| `tenant_onboarding` | (vedi §1.2) | ⚠️ esiste ma sotto-utilizzata |
| `tenant_atelier_identity` | preset Blueprint Chameleon | ✅ esiste, 1 row per tenant attivo |
| `users_profile` | role, tenant_id | ✅ ITER177 schema ok |
| `users_profile_invitations` (o equivalente) | invio inviti | 🟡 da verificare |

### 1.2 · `tenant_onboarding` (sospetto schema)

Verifica dello schema reale via DB introspection:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tenant_onboarding' ORDER BY ordinal_position;
```

**Atteso (da `STUDIO_ACTIVATION_ARCHITECTURE.md`):**
- `tenant_id` (PK FK)
- `blueprint_selected_at`
- `first_member_invited_at`
- `first_lead_created_at`
- `first_prospect_qualified_at`
- `first_journey_opened_at`
- `activation_completed_at`
- `metadata_json`

**Status reale:** colonne parzialmente presenti, eventi non tutti tracciati. Da consolidare.

### 1.3 · Componenti UI esistenti

| Componente | File | Stato |
|---|---|---|
| `OnboardingChecklist` | `components/onboarding/OnboardingChecklist.jsx` | 🟡 presente ma not wired su dashboard |
| `TenantOnboardingHeader` (presunto) | `components/layout/Topbar.jsx` o `Sidebar` | 🟠 da verificare/creare |
| `ActivationMeter` (proposto) | (non esiste) | 🔴 da creare |
| `BlueprintChameleonPicker` | `pages/atelier/AtelierIdentityPage.jsx` | ✅ esiste |
| `MembersInvitePage` | `pages/blueprint/MembersPage.jsx` | ✅ esiste |

### 1.4 · Endpoint backend

| Endpoint | Stato |
|---|---|
| `GET /api/tenant-onboarding/me` | 🟡 esiste, ritorna stato |
| `POST /api/tenant-onboarding/{key}/mark` | 🟡 esiste, marca step completato |
| `GET /api/blueprint/chameleon/active` | ✅ ITER177.B nuovo |
| `POST /api/members/invite` | ✅ ITER178 ok |
| `POST /api/leads` | ✅ ITER177.B ok |
| `POST /api/discovery/{did}/qualify` | ✅ ITER177.B ok |
| `POST /api/accounts/{aid}/journeys` | ✅ ITER177.B ok |

**Verdict:** la **plumbing** c'è. Manca solo la **UX consolidata** che la rende visibile.

---

## §2 · ACTIVATION FOUNDATION™ — i 5 step canonici

Confermati da `STUDIO_ACTIVATION_ARCHITECTURE.md` e dalla decisione Founder ITER176.B:

| # | Step | Trigger event | Dependency | Visibilità UX |
|---|---|---|---|---|
| **1** | **Blueprint Chameleon™ selezionato** | `blueprint_selected_at` settato | DB row `tenant_atelier_identity` con preset | Topbar badge · Settings page · Persistent banner se mancante |
| **2** | **Primo collaboratore invitato** | `first_member_invited_at` settato | `users_profile_invitations` row OR `users_profile` count >= 2 | Topbar badge · Members page CTA · Banner se 0 inviti dopo 7gg |
| **3** | **Primo Lead creato** | `first_lead_created_at` settato | `leads` count >= 1 | Topbar badge · Dashboard CTA primary se 0 Lead |
| **4** | **Primo Prospect qualificato** | `first_prospect_qualified_at` settato | `accounts` con lifecycle_stage='prospect' >= 1 | Topbar badge · Prospects page |
| **5** | **Prima Design Journey™ aperta** | `first_journey_opened_at` settato | `design_journeys` count >= 1 | Topbar badge · Journey dashboard |

**Quando tutti i 5 sono ✅ → `activation_completed_at` settato → label `Workspace Activated™` in header.**

---

## §3 · CONFIGURAZIONI OBBLIGATORIE vs OPZIONALI

### 3.1 · OBBLIGATORIE (per "Workspace Activated™")
- Step 1 · Blueprint Chameleon™
- Step 3 · Primo Lead
- Step 4 · Primo Prospect (deriva da step 3 + Discovery qualify)
- Step 5 · Prima Design Journey™

### 3.2 · CONSIGLIATE (warning ma non bloccanti)
- Step 2 · Primo collaboratore invitato (Founder Only è uno stato accettabile a tempo indeterminato)
- Tenant brand info: `display_name`, `primary_color`, logo upload
- Default locale (`it`, `en`)
- Notification preferences (email digest frequency)

### 3.3 · OPZIONALI (deep customization)
- Editorial calendar config (se tenant pubblica Magazine)
- Storefront config (se tenant ha e-commerce attivo)
- Domain custom (`tenant_domains`)
- Voice journal default settings
- Brand Atlas references upload

---

## §4 · UI ELEMENTS PROPOSED

### 4.1 · `<ActivationMeter />` (nuovo componente — proposta)

```
┌─────────────────────────────────────────────────────────┐
│  Activation Foundation · 3 / 5 step completati         │
│                                                         │
│  ✅ Blueprint Chameleon™                                │
│  ⏳ Invita primo collaboratore     [Vai →]              │
│  ✅ Primo Lead                                          │
│  ⏳ Qualifica primo Prospect       [Vai →]              │
│  ⏳ Apri prima Design Journey      [Vai →]              │
└─────────────────────────────────────────────────────────┘
```

**Surface:** widget in dashboard hero quando tenant non-activated · scomparente quando 5/5.

### 4.2 · `<PersistentAlertBanner />` (proposta)

Solo se step **critico** mancante:
- Step 1 mancante per >0gg → "Configura il Blueprint dello studio" (rosso, alta priorità)
- Step 3 mancante per >3gg → "Crea il primo Lead per attivare il CRM" (giallo)

**Surface:** sticky in alto a tutta la app, sotto Topbar. Dismissable per 24h.

### 4.3 · `<TenantOnboardingHeader />` (esistente o nuovo)

Topbar badge molto compatto:
```
[3/5] Activation Foundation™ →
```
Click → apre drawer `<ActivationMeter />` completo.

Quando 5/5: badge `Workspace Activated™` con check verde, click → drawer celebrativo + link "Vai oltre" (Studio Activation 10-step).

### 4.4 · `<OnboardingChecklist />` (refresh del componente esistente)

Wire-up:
- Mostrato in dashboard SE `activation_completed_at = NULL`
- Pull da `GET /api/tenant-onboarding/me`
- Ogni "Vai →" porta alla pagina giusta (e.g. step 1 → `/settings/blueprint`)
- Auto-refresh on focus per riflettere step completati altrove

---

## §5 · LIFECYCLE EVENT FIRING

Quando ogni step viene completato, il backend DEVE:
1. **Insert/update `tenant_onboarding`** con la colonna pertinente
2. **Emit lifecycle event** `tenant.activation.step_completed` con `step_key`
3. **Se 5/5 → emit `tenant.activation.completed` + set `activation_completed_at`**

### 5.1 · Trigger points già esistenti

| Step | Trigger | Endpoint | Patch necessaria? |
|---|---|---|---|
| 1 Blueprint | `PUT /api/blueprint/chameleon/active` | `routers/atelier_identity.py` | 🟡 add side-effect `mark_onboarding('blueprint_selected_at')` |
| 2 Team | `POST /api/members/invite` | `routers/members.py` | 🟡 add side-effect |
| 3 Lead | `POST /api/leads` (Modal flow) | `routers/leads.py` | 🟡 add side-effect (only first lead) |
| 4 Prospect | `POST /api/discovery/{did}/qualify` | `routers/discovery.py` | 🟡 add side-effect (only first prospect) |
| 5 Journey | `POST /api/accounts/{aid}/journeys` | `routers/account_journeys.py` | 🟡 add side-effect (only first journey) |

**Implementation hint:** un helper `_mark_onboarding_step(tenant_id, step_key, only_if_first=True)` da chiamare in fondo a ogni endpoint.

---

## §6 · USER STORIES — un tenant nuovo

### Story 1 · Founder appena registrato
> Stefano si registra con email Founder. Il tenant `studio-rossi` viene creato. Login → dashboard.
>
> **Stato auspicato:**
> - Topbar mostra badge `0/5 · Activation Foundation™`
> - Dashboard hero: `<ActivationMeter />` con 5 step tutti grigi e CTA puntate
> - Banner persistente: "Configura il Blueprint dello studio" (step 1 critico)
> - Sidebar: tutti i moduli avanzati hanno hint "Disponibile dopo l'attivazione"

### Story 2 · Founder completa step 1
> Stefano clicca "Configura Blueprint" → Apre Settings/Blueprint Chameleon → seleziona "Milano Editoriale™" → Save.
>
> **Backend side-effect:**
> - `tenant_atelier_identity` updated
> - `tenant_onboarding.blueprint_selected_at = NOW()`
> - Event `tenant.activation.step_completed { step: 'blueprint_selected' }`
>
> **UX side-effect:**
> - Toast "Blueprint Chameleon configurato"
> - Topbar badge si aggiorna a `1/5`
> - ActivationMeter mostra `✅ Blueprint Chameleon™`
> - Banner: ora "Crea il primo Lead per attivare il CRM"

### Story 3 · Founder apre primo Lead via Modal Nuova Relazione™
> ⌘+K → "Mario Rossi" → no results → Crea nuovo Lead → form prefilled → Save.
>
> **Backend:**
> - Lead created
> - Discovery(pending) auto-created
> - `tenant_onboarding.first_lead_created_at = NOW()`
> - Topbar badge → `2/5`

### Story 4 · Qualifica Prospect → step 4
> Discovery panel → Promuovi a Prospect.
>
> **Backend:**
> - `leads.status = 'qualified'`
> - `accounts(lifecycle_stage='prospect')` creato
> - `tenant_onboarding.first_prospect_qualified_at = NOW()`
> - Topbar → `3/5`

### Story 5 · Apre prima Design Journey™ → 5/5 → Activated
> Modal Choice B → seleziona Prospect → "Apri Design Journey"
>
> **Backend:**
> - Journey created
> - `tenant_onboarding.first_journey_opened_at = NOW()`
> - **`activation_completed_at = NOW()`** ← 5/5 reached
> - Event `tenant.activation.completed`
>
> **UX:**
> - Drawer celebrativo "Workspace Activated™"
> - Banner persistente scompare
> - Sidebar abilita tutti i moduli avanzati
> - Welcome email "Sei pronto" inviata al Founder (opzionale)

---

## §7 · IMPLEMENTATION PLAN (proposta per ITER180/181)

| Phase | Scope | Effort |
|---|---|---|
| **AF1 · Schema verify** | DB introspection di `tenant_onboarding`, eventuale migration per allineare le 6 colonne canon | 0.25g |
| **AF2 · Backend wiring** | Helper `mark_onboarding_step` + integrazione nei 5 endpoint trigger | 0.5g |
| **AF3 · `<ActivationMeter />` UI** | Componente nuovo, query GET /tenant-onboarding/me, render step | 0.5g |
| **AF4 · `<PersistentAlertBanner />`** | Banner sticky, dismiss 24h, mostra solo se step critico mancante | 0.5g |
| **AF5 · `<TenantOnboardingHeader />` badge** | Topbar badge che apre drawer ActivationMeter | 0.25g |
| **AF6 · Wire dashboard** | Mostra ActivationMeter in hero se tenant non-activated; nascondi quando attivato | 0.25g |
| **AF7 · Empty state copy** | Tutti gli empty state critici (LeadsPage, ProspectsPage, etc.) puntano al next step | 0.5g |
| **AF8 · Test playwright** | Scenario end-to-end "tenant nuovo → 5 step → Activated" | 0.5g |

**Totale stimato:** 3.25 giorni di lavoro · 1.5 sprint.

---

## §8 · ESCLUSIONI

- ❌ **Studio Activation 10-step completo** — l'Activation Foundation 5-step è il subset minimo. Il 10-step (con storefront, magazine, calendar, ecc.) resta per dopo
- ❌ **Editorial Onboarding** — separato (read-only demo content)
- ❌ **Tenant invitation flow** — il processo di Stefano che invita altri Founder a creare loro tenant — fuori scope, ITER181+
- ❌ **Multi-Blueprint switching** — l'utente cambia preset un'unica volta in Foundation; flussi avanzati per A/B test del preset → futuro

---

## §9 · METRICHE DI SUCCESSO

Quando l'Activation Foundation™ è implementato, vogliamo misurare:

| KPI | Target |
|---|---|
| % tenant nuovi che raggiungono `Workspace Activated` entro 7gg | >80% |
| Tempo medio da signup a `first_journey_opened_at` | <72h |
| % tenant abbandonati (no step completato dopo 14gg) | <10% |
| Soddisfazione Founder (NPS post-activation) | >50 |

---

## §10 · LINK AD ALTRI DOCUMENTI

- `STUDIO_ACTIVATION_ARCHITECTURE.md` — architettura completa 10-step (out of scope ora)
- `TEAM_LIFECYCLE_AUDIT.md` — step 2 dettagliato
- `CRM_LIFECYCLE_CANON.md` — step 3-4-5 canonici
- `DESIGN_JOURNEY_CANON.md` — step 5 canonico
- `BLUEPRINT_CHAMELEON_AUDIT.md` — step 1 dettagliato

---

**Fine audit. Tenant nuovo capisce subito cosa fare. Implementazione = ITER180.**
