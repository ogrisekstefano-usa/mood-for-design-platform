# ITER185 · PHASE 1 IMPLEMENTATION PLAN™

**Iterazione:** ITER185 · Phase 1 · Implementation Plan (Final)  
**Status:** 🔓 **READY FOR FOUNDER APPROVAL** — last documentation step before coding starts  
**Tipo:** Conflict analysis · Execution plan · Test plan · Effort estimate · Risk register  
**Data:** 2026-06-01  
**Owner:** Product Governance  
**Vincolo Founder:** SOLO PIANO. Zero codice/migration/API/frontend.  
**Riferimenti:**  `CRM_FOUNDATION_LOCKED_MODEL.md` v1.0 (LOCKED), `CRM_FOUNDATION_AUDIT.md` (ITER184), `MOOD_LANGUAGE_CANON.md` v1.0.

**Founder decisions LOCKED (input a questo piano):**
- ✅ Design Journey non è fase CRM
- ✅ Journey nasce da Prospect O Customer (mai Lead)
- ✅ Customer è opzionale
- ✅ Discovery Progress deterministico
- ✅ Customer rollback consentito con audit
- ✅ CSV import rinviato a ITER186+

---

## 0 · Sommario esecutivo

L'implementazione di ITER185 Phase 1 richiede **chirurgia coordinata** su 3 livelli (DB · API · Frontend) **+ migrazione dati pulita**. Le 5 priorità P0:

1. **Fast Lead Capture™** (replacement `NewRelationshipModal` form) — il "30s flow" diventa il default.
2. **Endpoint `convert-to-customer`** + audit + rollback.
3. **Discovery Progress Engine™** — deterministico 0/25/50/75/100 con 4 sezioni.
4. **Promotion endpoint canonicalization** — l'attuale `/api/relations/leads/{lid}/promote` aggiorna solo `leads.progression_state` (NON crea account, NON allinea il canon). Va bypassato/sostituito.
5. **Journey enforcement** — eliminare i 2 percorsi residui che permettono "Lead → Account direct" e mostrare CTA disabilitate quando lo stato non è ammesso.

**Effort totale stimato: ~10 ore effettive** (Phase 1 only · escluso Phase 2-3-4).

**Rischio principale:** dati legacy. La tabella `accounts.lifecycle_stage` contiene valori **non canonici** (`new_inquiry`, `lead`, `discovery`, `active_project`, `existing_client`, `repeat_client`, `partner_ad`, `archived`) che non corrispondono al LOCKED model (`prospect | in_proposal | customer | churned | on_hold`). Phase 1 **non normalizza** l'enum (rinviato a Phase 2) ma adotta strategia "interpret-on-read" + lista valori-target white-list lato API per non rompere la produzione.

---

## 1 · CONFLICT ANALYSIS

### 1.1 · DB Conflicts

#### 1.1.1 · Tabelle coinvolte
| Tabella | Status | Note |
|---|---|---|
| `leads` | ✅ esiste · 53 colonne | OK ma over-engineered |
| `leads.progression_state` text libero | 🔴 **CONFLICT** | Sincronizzato via trigger 107 a `accounts.lifecycle_stage` (denormalized mirror). Phase 1 deve **leggere** solo da `accounts` come single-source-of-truth |
| `leads.source` text libero | 🟠 **MISMATCH ENUM** | Valori reali in produzione: `manual`, `public_form`, `begin_journey_ritual`, `intake_v2`, `public_lead_form` — NON in linea con enum LOCKED `showroom\|phone\|email\|website\|referral\|architect\|event\|import\|other` |
| `leads.first_journey_id` | 🟡 deprecated ma ancora scritto | Phase 1: spegnere scrittura |
| `accounts` | ✅ esiste · 30+ colonne | OK |
| `accounts.lifecycle_stage` text libero | 🔴 **VALUES DRIFT** | Migration 034 definisce 9 valori storici (`new_inquiry\|lead\|discovery\|prospect\|active_project\|existing_client\|repeat_client\|partner_ad\|archived`). LOCKED ne ammette solo 5. **NON cambiamo enum in Phase 1**, solo guardia application-level |
| `discovery_interviews` | ✅ esiste · ITER177.B | OK · zero conflitti |
| `design_journeys.account_id` NOT NULL | ✅ canon-correct (ITER168) | OK · zero conflitti |
| `funnel_events` | ✅ esiste | OK · usato per audit |

#### 1.1.2 · Enum coinvolti
| Enum / vincolo | Status | Action Phase 1 |
|---|---|---|
| `lead_status` enum (`new\|qualified\|not_qualified\|contacted\|project_opened\|archived`) — definito in 001 ma **commentato** | 🟡 NON applicato come enum | Phase 1 lavora con valori testo. Phase 2 normalizza |
| `accounts.lifecycle_stage` valori canonici | ❌ NO enum | Phase 2 migration |
| `leads.source` valori enum | ❌ NO enum | Phase 2 migration · Phase 1: validation application-level |
| `discovery_interviews.status` | ✅ enum già normalizzato | OK |
| `design_journeys.lifecycle_state` | ✅ enum già normalizzato | OK |

#### 1.1.3 · Constraints coinvolti
| Constraint | Status | Note |
|---|---|---|
| `design_journeys.account_id NOT NULL` | ✅ già enforced | OK |
| `discovery_interviews.lead_id NOT NULL` | ✅ già enforced | OK |
| `accounts.lifecycle_stage` CHECK constraint | ❌ non esiste | Phase 2 |
| Trigger `sync_leads_progression_from_account` (migration 107) | ✅ attivo | OK: lo lasciamo. Phase 1 scrive su `accounts.lifecycle_stage`, il trigger propaga a `leads.progression_state` |
| FK `accounts.signed_proposal_id → proposals.id` | ❌ non esiste | Phase 1 aggiunge **colonna nullable** (no FK ancora). Migration light. |

#### 1.1.4 · Campi legacy
| Campo | Stato | Action |
|---|---|---|
| `leads.first_journey_id` | deprecated | Phase 1: stop write in `journey_initiate.py`. Read-only audit. |
| `leads.progression_state` | shadow di `accounts.lifecycle_stage` | Phase 1: usare solo come read-only |
| `accounts.relationship_journey_stage` | 🟡 unclear semantics | Phase 1: ignorare; Phase 2 audit |
| `accounts.relationship_temperature` | analytics, non lifecycle | Phase 1: ignorare |
| `accounts.account_type` (`private_client \| architecture_studio \| ...`) | OK | nessuna interferenza |

#### 1.1.5 · Incompatibilità critiche

**INCOMP-1 (P0):** L'endpoint `/api/relations/leads/{lid}/promote` aggiorna `leads.progression_state` direttamente e ammette `lead → account` skip-step. **Bypass del canon.** Action: deprecare logicamente in Phase 1; redirect verso `discovery/{did}/qualify`.

**INCOMP-2 (P1):** `accounts.lifecycle_stage='new_inquiry'` viene scritto dal funnel pubblico (`journey_initiate.py` line ~310). Il LOCKED model parte da `prospect`. Action Phase 1: dopo Begin Journey, immediatamente upsertare a `prospect` (compatible: era già nel funnel).

**INCOMP-3 (P1):** Dati produzione con `lifecycle_stage` outside LOCKED set. Phase 1 read-API deve fare **mapping resiliente**:
```
new_inquiry, lead, discovery → "prospect" (display semantics)
active_project, existing_client, repeat_client → "customer"
archived → "churned"
NULL → "prospect" (default)
```

### 1.2 · API Conflicts

#### 1.2.1 · Endpoint da CREARE (5)
| Method | Path | Owner | Notes |
|---|---|---|---|
| POST | `/api/leads/fast-capture` | `leads.py` | Fast Lead Capture™ — 4 campi obbligatori (name+phone OR email, origin). Idempotent via fingerprint. |
| POST | `/api/accounts/{aid}/convert-to-customer` | `account_journeys.py` (o nuovo `account_lifecycle.py`) | Manual conversion + audit |
| POST | `/api/accounts/{aid}/revert-to-prospect` | idem | Rollback con audit reason obbligatorio |
| GET | `/api/discovery/{did}/progress` | `discovery.py` | Deterministic 0/25/50/75/100 calculator |
| GET | `/api/dashboard/kpi-funnel` | `dashboard.py` (deferred Phase 2) | NOT in Phase 1 |

#### 1.2.2 · Endpoint da MODIFICARE (3)
| Method | Path | Change |
|---|---|---|
| POST | `/api/leads` | Add `source` mandatory validation (enum white-list). Auto-create discovery_interviews(pending). |
| POST | `/api/discovery/{did}/qualify` | Add hard-validation: discovery `progress >= 75%` (vedi §4.4) prima di permettere qualify. |
| POST | `/api/relations/leads/{lid}/promote` | **DEPRECATE in Phase 1**: ritornare 410 Gone con messaggio "Use POST /api/discovery/{did}/qualify". Frontend hook va aggiornato. |

#### 1.2.3 · Endpoint da DEPRECARE (1)
| Method | Path | Reason |
|---|---|---|
| POST | `/api/relations/leads/{lid}/promote` | Bypassa Discovery canon. Mantenuto solo come 410-Gone redirect. |

#### 1.2.4 · Endpoint coinvolti senza modifiche (audit-only)
| Method | Path | Note |
|---|---|---|
| POST | `/api/public/journeys/initiate` | Special case canon §F.1. Conferma: setta `accounts.lifecycle_stage='prospect'` (non `new_inquiry`) — **micro-fix** se necessario. |
| POST | `/api/accounts/{aid}/journeys` | R1-R5 già OK. Phase 1: aggiungere validazione R2 esplicita su valori LOCKED `prospect\|in_proposal\|customer`. |

### 1.3 · Frontend Conflicts

#### 1.3.1 · Pagine coinvolte (6)
| Page | Path | Action Phase 1 |
|---|---|---|
| `LeadsPage` | `/relations/leads` | Verificare CTA `+ Nuovo Lead` chiama Fast Lead Capture. Mostra empty state allineato. |
| `LeadDetailPage` | `/relations/leads/:id` | **Embed Discovery Progress widget**. Embed Complete Lead Capture™ progressive disclosure. |
| `ProspectsPage` | `/relations/prospects` | **Disabilitare** CTA `Promuovi ad Account` legacy. Sostituire con CTA `Conferma Cliente` (apre modal `convert-to-customer`). |
| `AccountsPage` | `/relations/accounts` | Aggiungere CTA `Revert to Prospect` (admin only) per rollback. |
| `AtelierDashboardPage` | `/dashboard` | (Phase 2: KPI funnel) — Phase 1 nessuna modifica |
| `JourneyPulsePage` | `/dashboard/pulse` | (nessuna modifica Phase 1) |

#### 1.3.2 · Componenti coinvolti (8)
| Component | Action |
|---|---|
| `NewRelationshipModal.jsx` | **Refactor maggiore:** Lead branch diventa Fast Lead Capture™ (4 campi). Prospect/Customer branch invariati. |
| `DiscoveryInterviewPanel.jsx` | Embed progress bar 0-100% calcolato da `GET /api/discovery/{did}/progress`. |
| `Sidebar.jsx` (`NewRelationshipCta`) | Nessuna modifica (CTA già "Nuovo Lead"). |
| `WorkspaceActionHub.jsx` | Nessuna modifica (action `new-lead` già canon). |
| `CommandPalette.jsx` | Nessuna modifica (apre modal canon). |
| **NEW** `ConvertToCustomerModal.jsx` | Modal conferma cliente con `proposal_id` picker. |
| **NEW** `RevertToProspectModal.jsx` | Modal rollback con `reason` mandatory. |
| **NEW** `DiscoveryProgressWidget.jsx` | Widget visivo 0-100% riusabile. |

#### 1.3.3 · CTA coinvolte
| CTA | Pre Phase 1 | Post Phase 1 |
|---|---|---|
| Sidebar `+ Nuovo Lead` | apre modal 4-field inline | apre Fast Lead Capture (stesso UX, diverso payload) |
| Dashboard QuickAction `Nuovo Lead` | idem | idem |
| ProspectsPage `Promuovi ad Account` | **chiama promote endpoint legacy** ❌ | **rimuovere** (rimpiazzo: `Conferma Cliente` → `convert-to-customer`) |
| AccountsPage (no CTA primary) | empty | aggiungere `Conferma Cliente` (se prospect) o `Revert` (se customer) |
| WelcomeDrawer `Promuovi` (kind=promote_account) | chiama `promote` legacy | rimpiazzato da CTA navigation a `convert-to-customer` modal |

#### 1.3.4 · Modali coinvolti
| Modal | Status | Action |
|---|---|---|
| `NewRelationshipModal` | esistente | refactor Lead branch (Fast Capture) |
| **NEW** `ConvertToCustomerModal` | da creare | modal flow |
| **NEW** `RevertToProspectModal` | da creare | modal flow |
| `DiscoveryInterviewPanel` | esistente | embed progress widget |

#### 1.3.5 · Hook coinvolti (3)
| Hook | Action |
|---|---|
| `useRelations.js` | `promote()` function: **rimuovere chiamata `/promote`**, sostituire con flow Discovery (apertura `DiscoveryInterviewPanel`) o `convert-to-customer`. |
| `useNewRelationship.js` | Nessuna modifica strutturale, nuovo payload (`source`, `source_detail`). |
| **NEW** `useDiscoveryProgress.js` | Custom hook che chiama `/api/discovery/{did}/progress` e ritorna percentuale + completed_sections. |

#### 1.3.6 · i18n keys coinvolte
| Key | Locale | Action |
|---|---|---|
| `relationships.newModal.fast.source.placeholder` | en-US, it-IT, others | nuova chiave (label step 3) |
| `relationships.newModal.fast.source.options.*` | tutti | 9 nuove chiavi (showroom, phone, email, website, referral, architect, event, import, other) |
| `relationships.discovery.progress.label` | tutti | nuova chiave |
| `relationships.discovery.progress.section.*` | tutti | 4 chiavi sezioni |
| `relationships.actions.convert_to_customer` | tutti | nuova chiave |
| `relationships.actions.revert_to_prospect` | tutti | nuova chiave |

---

## 2 · FAST LEAD CAPTURE™ — Implementation Plan

### 2.1 · Target

- **Time-to-save < 30 secondi** (telefono in mano, designer in showroom).
- **4 campi** + 1 condizionale.

### 2.2 · Campi

| # | Field | Type | Mandatory | Validation |
|---|---|---|---|---|
| 1 | `name` (first_name + last_name combined) | text | ✅ | min 2 char |
| 2 | `phone` (con ISO prefix) | text | conditional (1-of phone/email) | regex E.164 |
| 3 | `email` | text | conditional (1-of phone/email) | regex RFC5322 |
| 4 | `source` | enum | ✅ | white-list LOCKED |
| 5 | `source_detail` | text | **only if source='other'** | min 3 char |

### 2.3 · UX flow

```
┌─────────────────────────────────────────────┐
│  + Nuovo Lead    (Fast Capture · ~25s)      │
│  ─────────────────────────────────────────  │
│                                             │
│  Nome*                                      │
│  ┌──────────────────────────────────────┐  │
│  │ Marco Rossi                          │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Telefono     OR     Email   (almeno uno)  │
│  ┌──────────────┐    ┌─────────────────┐   │
│  │ +39 333 0123 │    │ marco@email.it  │   │
│  └──────────────┘    └─────────────────┘   │
│                                             │
│  Origine*                                   │
│  [showroom ●] [phone ○] [email ○]           │
│  [website ○]  [referral ○] [architect ○]    │
│  [event ○]    [import ○]   [other ○]        │
│                                             │
│  ↳ se source = other → mostra textarea      │
│    "Specifica origine"                      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Salva Lead (Cmd+Enter)             │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  → Aggiungi altri dettagli (skip-to-end)    │
└─────────────────────────────────────────────┘
```

**Comportamento:**
- Submit immediato → POST `/api/leads/fast-capture` → Lead + Discovery(pending) creati in transazione.
- Toast `Lead "Marco Rossi" salvato. Inizia la Discovery?` con due CTA: `Apri Discovery` | `Aggiungi più dettagli`.
- Se l'utente clicca `Aggiungi più dettagli` → naviga a `LeadDetailPage` con Complete Capture in modal aperto.

### 2.4 · Componenti coinvolti

| Component | Role |
|---|---|
| `NewRelationshipModal.jsx` (modificato) | Container modale, branch `choice='lead'` ora monta `FastLeadCaptureForm` |
| **NEW** `FastLeadCaptureForm.jsx` | Form 4-field con state minimale (useState locale) |
| **NEW** `SourcePickerChips.jsx` | 9 chip selezionabili (1 active) + textbox condizionale `other` |
| `PhoneCountryPrefix.jsx` (esistente) | Riutilizzato per telefono |

### 2.5 · API

```
POST /api/leads/fast-capture
Headers: Authorization: Bearer <jwt>
Body:
{
  "name": "Marco Rossi",
  "phone": "+39333012345",      // optional if email
  "email": "marco@email.it",    // optional if phone
  "source": "showroom",         // mandatory, enum
  "source_detail": null         // mandatory if source='other'
}
Response 201:
{
  "lead": { ...full lead object },
  "discovery": { "id": "...", "status": "pending" }
}
```

### 2.6 · Validazioni

| Layer | Rule |
|---|---|
| Frontend | `name` non vuoto (trim, min 2 char) |
| Frontend | almeno uno tra `phone` e `email` non vuoto + valido |
| Frontend | `source` selezionato (no submit senza) |
| Frontend | se `source === 'other'` → `source_detail` non vuoto |
| Backend | re-validazione tutti i campi |
| Backend | `source ∈ enum LOCKED` → 400 `LEAD-INVALID-SOURCE` se fuori |
| Backend | dedup-check email/phone → restituisce 409 con `existing_lead_id` (frontend mostra warning + CTA "Apri esistente") |
| Backend | auto-creazione `discovery_interviews(pending)` per il nuovo lead |
| Backend | `funnel_events(stage='lead_captured', event='fast_capture.created')` |

---

## 3 · COMPLETE LEAD CAPTURE™ — Implementation Plan

### 3.1 · Scelta architetturale: **Progressive Disclosure** (non Wizard multi-step)

**Motivazione:**
- Il founder ha esplicitamente prioritizzato la rapidità (Fast Capture <30s). Un wizard multi-step a 6 step pesa anche solo come UI rituale, e gli operatori lo salterebbero.
- I dati aggiuntivi (azienda, ruolo, interesse, budget, tempistiche, note) sono **opzionali** e arrivano nel tempo, non nel momento dell'intake.
- Il pattern Progressive Disclosure permette al designer di **aprire/chiudere sezioni a piacere** mentre parla con il cliente.
- Riduce attrito su mobile/showroom (touch + non-perfect signal).

### 3.2 · UX layout

```
LeadDetailPage / Lead drawer
─────────────────────────────────────────────────
HEADER     [Avatar] Marco Rossi · showroom · 2 min fa

Discovery Progress  ████░░░░░░░░░░░░  25% (vedi §4)
  [Apri Discovery]

▼ Informazioni base                        [editato]
  Azienda    [ Studio Lombardi              ]
  Ruolo      [ CEO / Founder                ]

▶ Contatti                                 (collapsed)
▶ Interesse e progetto                     (collapsed)
▶ Budget e tempistiche                     (collapsed)
▶ Note operative                           (collapsed)
▶ Owner & team                             (collapsed)

[Conferma qualifica → Promuovi a Prospect]
                                    (disabled fino a Discovery 75%+)
```

### 3.3 · Sezioni progressive (6)

| Sezione | Campi | Salvataggio |
|---|---|---|
| 1. Informazioni base (default expanded) | first_name, last_name, company_name, role | autosave onBlur (debounce 500ms) |
| 2. Contatti | email, phone, city, country, country_code | autosave |
| 3. Interesse e progetto | market_sector (enum), project_type, decision_maker | autosave |
| 4. Budget e tempistiche | budget_range, timeline | autosave (mapped to `discovery_interviews.qualification_signals`) |
| 5. Note operative | notes (textarea expandable) | autosave |
| 6. Owner & team | assigned_to (designer dropdown), team_ids | autosave |

### 3.4 · Componenti

| Component | Role |
|---|---|
| **NEW** `CompleteCapturePanel.jsx` | Container con 6 sezioni collapsible |
| **NEW** `ProgressiveSection.jsx` | Generic collapsible con stato `editato`/`vuoto`/`completo` |
| `DiscoveryInterviewPanel.jsx` (esistente) | Embed nel LeadDetailPage |

### 3.5 · API

Tutte le mutations passano per `PATCH /api/leads/{lid}` (già esistente). Aggiunte:
- nuovo campo `market_sector` (Phase 2 migration, Phase 1 jsonb in `metadata_json`)
- nuovo campo `country_code` (Phase 2 migration, Phase 1 metadata_json)

---

## 4 · DISCOVERY PROGRESS ENGINE™ — Implementation Plan

### 4.1 · Principio: deterministico, 4 sezioni × 25%

| Sezione | Weight | Required fields | Source |
|---|---:|---|---|
| **A** · Identificazione | 25% | `first_name` non vuoto · `source ∈ enum` · (`email` OR `phone`) | `leads` |
| **B** · Contatto qualificato | 25% | `company_name` OR `role` OR `city` non vuoto (1-of-3) | `leads` |
| **C** · Interesse identificato | 25% | `market_sector ∈ enum` OR `qualification_signals.interest_level != null` | `leads` + `discovery_interviews.qualification_signals` |
| **D** · Brief raccolto | 25% | `qualification_signals.budget != null` AND `qualification_signals.timeline != null` AND `notes` non vuoto (≥20 char) | `discovery_interviews` |

### 4.2 · Stati visualizzati

```
0%    [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   Solo nome registrato
25%   [██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]   Identificato
50%   [████████████████████░░░░░░░░░░░░░░░░░░░]   Contatto qualificato
75%   [██████████████████████████████░░░░░░░░░]   Interesse identificato
100%  [███████████████████████████████████████]   Brief raccolto · pronto per qualifica
```

### 4.3 · Endpoint

```
GET /api/discovery/{did}/progress
Response 200:
{
  "discovery_id": "uuid",
  "lead_id": "uuid",
  "progress_pct": 75,
  "sections": [
    { "key": "identification", "weight": 25, "completed": true,  "missing_fields": [] },
    { "key": "contact",        "weight": 25, "completed": true,  "missing_fields": [] },
    { "key": "interest",       "weight": 25, "completed": true,  "missing_fields": [] },
    { "key": "brief",          "weight": 25, "completed": false, "missing_fields": ["budget","timeline","notes"] }
  ],
  "qualify_eligible": false,  // true se progress_pct >= 75
  "calculated_at": "2026-06-01T08:34:12Z"
}
```

### 4.4 · Gating rule

| Action | Required progress |
|---|---:|
| `POST /api/discovery/{did}/qualify` | **>= 75%** (sezioni A+B+C complete) |
| `POST /api/discovery/{did}/disqualify` | **0%** (sempre OK) |
| `POST /api/discovery/{did}/recycle` | sempre OK |

### 4.5 · UI

| Surface | Component | Display |
|---|---|---|
| `LeadDetailPage` header | `DiscoveryProgressWidget` | progress bar + label + completed sections list |
| `LeadsPage` row hover | `DiscoveryProgressMini` | mini-bar inline |
| `DiscoveryInterviewPanel` top | `DiscoveryProgressWidget` | enlarged + "missing fields" chips |
| Promotion CTA `Promuovi a Prospect` | disabled tooltip | "Complete almeno il 75% della Discovery" |

---

## 5 · PROSPECT QUALIFICATION™ — Implementation Plan

### 5.1 · Trigger

Manuale via CTA `Promuovi a Prospect` nel `LeadDetailPage` (dopo Discovery ≥75%) **o** dentro `DiscoveryInterviewPanel`.

### 5.2 · Endpoint

```
POST /api/discovery/{did}/qualify
Headers: Authorization: Bearer <jwt>
Body:
{
  "qualification_notes": "optional string",
  "force": false  // bypass progress gate, admin-only
}
Response 200:
{
  "discovery": {...},     // status='qualified', completed_at=now
  "lead":      {...},     // status='qualified'
  "account":   {...},     // lifecycle_stage='prospect' (upserted)
  "warnings": []          // soft warning se manca alcune signal
}
```

### 5.3 · Validazioni backend

| Rule | HTTP code if violated |
|---|---|
| Discovery `status IN ('pending','in_progress')` | 400 `DISCOVERY-INVALID-STATE` |
| Discovery progress >= 75% (vedi §4.4) o `force=true` (admin) | 422 `DISCOVERY-PROGRESS-INSUFFICIENT` |
| User has `P_LEADS_WRITE` permission | 403 |
| Lead.tenant_id == current_user.tenant_id | 404 |

### 5.4 · Side effects

| Action | Detail |
|---|---|
| `discovery_interviews.update()` | status='qualified', completed_at=now, conducted_by=user_id |
| `leads.update()` | status='qualified' |
| `accounts.upsert()` | lifecycle_stage='prospect', lead_id=L. Idempotent (riusa esistente se c'è già) |
| `funnel_events.insert()` | stage='prospect', event='discovery.qualified', metadata={discovery_id, lead_id, account_id} |

### 5.5 · Audit trail

Tutte le qualifiche scrivono in `funnel_events` con `conducted_by` e timestamp. Vista admin: query funnel_events filter stage='prospect'.

### 5.6 · CTA da MODIFICARE

| Surface | Pre Phase 1 | Post Phase 1 |
|---|---|---|
| `ProspectsPage.handlePromote(p, 'account')` | chiama `/api/relations/leads/{lid}/promote` (legacy) | rimuovere · CTA scompare per lead non-discovery-completed |
| `WelcomeDrawer.kind=promote_account` | idem | rimpiazzato da modal navigation |

---

## 6 · CUSTOMER CONVERSION™ — Implementation Plan

### 6.1 · Trigger

Manuale via CTA `Conferma Cliente` nel `AccountsPage` o `WorkspaceProjectPage` (post-firma proposta).

### 6.2 · Endpoint principale

```
POST /api/accounts/{aid}/convert-to-customer
Headers: Authorization: Bearer <jwt>
Body:
{
  "proposal_id": "uuid",         // mandatory
  "signed_at": "2026-06-01",     // mandatory (ISO date)
  "signed_by_contact_id": "uuid", // optional
  "notes": "Cliente firma in studio, contratto controfirmato dal partner"
}
Response 200:
{
  "account": {...},     // lifecycle_stage='customer'
  "audit_event_id": "uuid"
}
```

### 6.3 · Endpoint rollback

```
POST /api/accounts/{aid}/revert-to-prospect
Headers: Authorization: Bearer <jwt>
Body:
{
  "reason": "Proposta annullata, cliente non firma",  // mandatory
  "admin_override": false
}
Response 200:
{
  "account": {...},     // lifecycle_stage='prospect'
  "audit_event_id": "uuid"
}
```

### 6.4 · Validazioni Convert-to-Customer

| Rule | HTTP code if violated |
|---|---|
| `account.lifecycle_stage IN ('prospect', 'in_proposal')` | 400 `ACCOUNT-INVALID-STAGE` |
| `proposals.id` esiste e `tenant_id` matches | 404 |
| `proposals.account_id == aid` | 422 |
| `proposals.status IN ('signed', 'approved')` | 422 `PROPOSAL-NOT-SIGNED` (admin can override con `admin_override=true`) |
| Permission `P_ACCOUNTS_WRITE` | 403 |

### 6.5 · Validazioni Revert-to-Prospect

| Rule | HTTP code if violated |
|---|---|
| `account.lifecycle_stage == 'customer'` | 400 |
| `reason` non vuoto (min 10 char) | 422 |
| Permission: `P_ACCOUNTS_WRITE` + `is_admin` | 403 |

### 6.6 · Side effects

#### Convert-to-customer
- `accounts.update()`: `lifecycle_stage='customer'`, `signed_proposal_id=proposal_id`
- `funnel_events.insert()`: `stage='customer'`, `event='customer.confirmed'`, `metadata={proposal_id, signed_at, conducted_by}`
- Trigger DB sync_leads_progression propaga a `leads.progression_state='account'` (legacy mirror, OK)

#### Revert-to-prospect
- `accounts.update()`: `lifecycle_stage='prospect'`, `signed_proposal_id=NULL`
- `funnel_events.insert()`: `stage='prospect'`, `event='customer.reverted'`, `metadata={reason, conducted_by, reverted_from='customer'}`

### 6.7 · UI

| Component | Surface |
|---|---|
| **NEW** `ConvertToCustomerModal.jsx` | aperto da AccountsPage row CTA `Conferma Cliente` |
| **NEW** `RevertToProspectModal.jsx` | aperto da AccountsPage row CTA `Revert` (admin only) |

### 6.8 · No automazioni

Phase 1: nessun trigger DB auto su `proposals.signed`. Tutto manuale.  
(Phase 4 opzionale: trigger auto se Founder approva.)

---

## 7 · DESIGN JOURNEY ENFORCEMENT™ — Plan

### 7.1 · Audit completo punti di creazione Journey

| # | Surface / endpoint | Crea Journey? | Classification | Action Phase 1 |
|---|---|---|---|---|
| 1 | `POST /api/accounts/{aid}/journeys` (auth) | ✅ canon | ✅ CORRETTO | Aggiungere validation esplicita su LOCKED enum `prospect\|in_proposal\|customer` |
| 2 | `POST /api/public/journeys/initiate` (anon) | ✅ Begin Journey public | ✅ CORRETTO (special case §F.1) | Verificare che setti `lifecycle_stage='prospect'` (NON `new_inquiry`) — micro-fix |
| 3 | `NewRelationshipModal` choice='prospect' | ✅ via #1 | ✅ CORRETTO | OK |
| 4 | `NewRelationshipModal` choice='customer' | ✅ via #1 | ✅ CORRETTO | OK |
| 5 | `NewRelationshipModal` choice='lead' | ❌ apre solo Discovery | ✅ CORRETTO | OK |
| 6 | `WorkspaceActionHub.newJourney` | ✅ via modal | ✅ CORRETTO | OK |
| 7 | Dashboard `Apri Journey` | ❌ naviga · no create | ✅ CORRETTO | OK |
| 8 | `WelcomeDrawer kind='promote_account'` | 🟡 chiama `useRelations.promote()` legacy | 🔴 ERRATO | **DA BLOCCARE**: rimuovere chiamata legacy, sostituire con navigation |
| 9 | `ProspectsPage.handlePromote('account')` | 🟡 idem | 🔴 ERRATO | **DA BLOCCARE**: deprecare endpoint + rimuovere CTA |
| 10 | Endpoint legacy `POST /api/design_journeys` | ❓ esiste? | da verificare | check & remove if exists |

### 7.2 · Verifica "Lead → Journey" impossibile

#### Lato Backend
- ✅ `POST /api/accounts/{aid}/journeys` richiede `aid` valido + `lifecycle_stage IN LOCKED enum` → impossibile da Lead
- ✅ `POST /api/public/journeys/initiate` crea Lead+Account+Journey **in transazione** → no skip Discovery (la Discovery `qualified` viene creata nella stessa transazione)
- ❌ `POST /api/relations/leads/{lid}/promote` target='account' aggiorna `leads.progression_state` ma **NON crea journey** (audit confermato §1.2). È rotto ma non bypass-canon.

#### Lato Frontend
- ✅ `NewRelationshipModal` separa choice in 3 pulsanti (Lead/Prospect/Customer)
- ✅ Lead branch non offre CTA "Crea Journey"
- 🟡 `WelcomeDrawer.kind='promote_account'` da audit + fix

### 7.3 · Plan enforcement

| Action | Effort |
|---|---|
| 7.3.1 · Deprecate `/api/relations/leads/{lid}/promote` (410 Gone) | 0.1g |
| 7.3.2 · Fix `useRelations.promote()` → remove `/promote` call, throw deprecation error in dev | 0.1g |
| 7.3.3 · Audit `WelcomeDrawer kind='promote_account'` → replace with modal nav | 0.25g |
| 7.3.4 · Strengthen `account_journeys.py` R2 validation: explicit LOCKED enum check | 0.1g |
| 7.3.5 · Add tooltip "Why no journey from Lead?" on disabled CTA | 0.1g |
| 7.3.6 · Verify no `POST /api/design_journeys` legacy endpoint exists | 0.1g audit |

---

## 8 · TEST PLAN™

### 8.1 · Backend (pytest · `/app/backend/tests/test_iter185_phase1.py`)

#### Test 8.1.1 · Fast Lead Capture
```
test_fast_capture_minimal()                  → 201, lead + discovery(pending) created
test_fast_capture_missing_name()             → 400
test_fast_capture_missing_contact()          → 400 (both phone+email empty)
test_fast_capture_missing_source()           → 400 LEAD-INVALID-SOURCE
test_fast_capture_invalid_source()           → 400 (source='foobar')
test_fast_capture_other_without_detail()     → 400
test_fast_capture_dedup_email_match()        → 409 with existing_lead_id
test_fast_capture_creates_funnel_event()     → verify funnel_events row
```

#### Test 8.1.2 · Discovery Progress Engine
```
test_progress_0_only_name()                  → 0%
test_progress_25_identification()            → 25% (name + source + email/phone)
test_progress_50_contact_qualified()         → 50% (+ company OR role OR city)
test_progress_75_interest_identified()       → 75% (+ market_sector OR interest_level)
test_progress_100_brief_collected()          → 100% (+ budget + timeline + notes>=20)
test_progress_response_shape()               → JSON validation
```

#### Test 8.1.3 · Prospect Qualification
```
test_qualify_below_75pct_blocked()           → 422 DISCOVERY-PROGRESS-INSUFFICIENT
test_qualify_at_75pct_success()              → 200 + account(prospect) created
test_qualify_at_100pct_success()             → 200
test_qualify_admin_force_below_75()          → 200 (admin bypass)
test_qualify_creates_account_idempotent()    → upsert, no duplicate accounts
test_qualify_creates_funnel_event()          → verify
test_qualify_already_qualified()             → 400 DISCOVERY-INVALID-STATE
```

#### Test 8.1.4 · Customer Conversion
```
test_convert_to_customer_happy_path()        → 200, account.lifecycle_stage='customer'
test_convert_missing_proposal_id()           → 422
test_convert_proposal_not_signed()           → 422 PROPOSAL-NOT-SIGNED
test_convert_account_not_prospect()          → 400 ACCOUNT-INVALID-STAGE
test_convert_admin_override_unsigned()       → 200 (admin bypass)
test_convert_creates_funnel_event()          → verify
test_revert_to_prospect_happy_path()         → 200
test_revert_missing_reason()                 → 422
test_revert_not_customer()                   → 400
test_revert_creates_audit_event()            → verify
```

#### Test 8.1.5 · Journey Enforcement
```
test_journey_create_from_prospect()          → 201
test_journey_create_from_customer()          → 201
test_journey_create_from_lead_blocked()      → 400 ACCOUNT-INVALID-STAGE
test_journey_create_no_account_404()         → 404
test_journey_active_already_409()            → 409 with existing_journey_id
test_journey_force_override_active()         → 201
test_legacy_promote_endpoint_410_gone()      → 410 Gone with deprecation message
```

### 8.2 · Frontend (Playwright via testing agent)

| # | Test | Expected |
|---|---|---|
| 1 | Sidebar `+ Nuovo Lead` click → modal opens | Fast Capture form rendered |
| 2 | Fill name + email + source=showroom → Save | Toast "Lead salvato" |
| 3 | Lead created → navigate to `/relations/leads/{id}` | Discovery Progress 25% visible |
| 4 | Expand `Informazioni base` → fill company_name | autosave, progress → 50% |
| 5 | Fill market_sector | progress → 75%, "Promuovi a Prospect" enabled |
| 6 | Click "Promuovi a Prospect" | success toast, account(prospect) created |
| 7 | Navigate to `/relations/prospects` | new prospect visible |
| 8 | Click row → AccountDetail → "Conferma Cliente" CTA visible | modal opens |
| 9 | Submit convert with proposal → account becomes customer | success |
| 10 | Click "Revert" → modal with reason mandatory | rollback OK |
| 11 | On Lead detail (not qualified) → "Crea Journey" CTA disabled with tooltip | tooltip shown |
| 12 | Try to call `POST /api/relations/leads/{lid}/promote` directly | 410 Gone |

### 8.3 · E2E smoke (manual + testing agent)
- Flow A: showroom intake → Fast Capture → Discovery → Qualify → Journey (skip Customer)
- Flow B: showroom intake → Fast Capture → Discovery → Qualify → Customer → Journey
- Flow C: public Begin Journey → automatic prospect→Journey

---

## 9 · EFFORT ESTIMATE

| Task | Effort | Priority | Dependencies |
|---|---:|---|---|
| 9.1 · Audit `useRelations.promote` + deprecate legacy promote endpoint | 0.25g | P0 | none |
| 9.2 · Backend `POST /api/leads/fast-capture` | 0.5g | P0 | none |
| 9.3 · Backend `GET /api/discovery/{did}/progress` | 0.5g | P0 | none |
| 9.4 · Backend `POST /api/discovery/{did}/qualify` — add progress gate | 0.25g | P0 | 9.3 |
| 9.5 · Backend `POST /api/accounts/{aid}/convert-to-customer` | 0.5g | P0 | none |
| 9.6 · Backend `POST /api/accounts/{aid}/revert-to-prospect` | 0.25g | P0 | 9.5 |
| 9.7 · Backend audit fix: `journey_initiate.py` setta `lifecycle_stage='prospect'` (no `new_inquiry`) | 0.1g | P1 | none |
| 9.8 · Frontend `FastLeadCaptureForm` + `SourcePickerChips` | 1g | P0 | 9.2 |
| 9.9 · Frontend `DiscoveryProgressWidget` + hook `useDiscoveryProgress` | 0.5g | P0 | 9.3 |
| 9.10 · Frontend `CompleteCapturePanel` (6 progressive sections) | 1.5g | P0 | 9.8 |
| 9.11 · Frontend `ConvertToCustomerModal` | 0.5g | P0 | 9.5 |
| 9.12 · Frontend `RevertToProspectModal` | 0.25g | P0 | 9.6 |
| 9.13 · Frontend remove `handlePromote` legacy from `ProspectsPage` + `WelcomeDrawer` | 0.25g | P0 | 9.1 |
| 9.14 · Backend pytest test suite (40+ tests) | 1g | P0 | 9.2-9.6 |
| 9.15 · Frontend Playwright via testing_agent_v3 | 0.5g | P0 | all |
| 9.16 · i18n: new keys × 7 locales | 0.5g | P0 | 9.8-9.12 |
| 9.17 · DB migration: add `accounts.signed_proposal_id` nullable column | 0.1g | P0 | none |
| 9.18 · Docs: `ITER185_PHASE1_IMPLEMENTATION_REPORT.md` | 0.25g | P0 | all |

**Totale Phase 1: ~8.75 giorni effettivi** (~2 sprint settimanali single-dev, o ~1.5 sprint con AI-assisted pairing).

---

## 10 · RISK ANALYSIS

### 10.1 · Risk register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Legacy `accounts.lifecycle_stage` values outside LOCKED enum cause UI display gaps | 🟠 high | 🟠 medium | Phase 1 read-API: mapping resiliente (vedi §1.1.5 INCOMP-3). No migration enum in Phase 1. |
| R-2 | Removing `handlePromote` legacy breaks existing user habits | 🟡 medium | 🟡 medium | Mantenere CTA in UI ma redirect to canon flow (qualify-via-discovery). Show banner "Promotion now requires Discovery qualified". |
| R-3 | Fast Capture dedup-check returns false-positive (es. nome simile) | 🟡 medium | 🟢 low | Frontend mostra "esistente trovato" come warning, non blocco. User decide. |
| R-4 | Progress gate 75% blocca workflow esistenti dove le discovery sono compilate parzialmente | 🟠 high | 🟠 medium | Admin override `force=true` documented. Migration backfill: discovery already-qualified pre-Phase-1 NON ricalcolate. |
| R-5 | Public Begin Journey ancora crea lifecycle_stage='new_inquiry' | 🟡 medium | 🟡 medium | Micro-fix in Phase 1 (§9.7) + retroactive UPDATE migration su rows pre-fix. |
| R-6 | `proposals.status='signed'` vs `'approved'` ambiguity in convert-to-customer | 🟡 medium | 🟢 low | Accept both values. Document. |
| R-7 | i18n key gap rompe UI dopo deploy | 🟡 medium | 🟢 low | Aggiungere fallback en-US in tutti i `t()` call |
| R-8 | Performance: DiscoveryProgress calculation per request lento | 🟢 low | 🟢 low | Cache 60s lato API, ricalcolo on-mutation only. |
| R-9 | DB schema migration `signed_proposal_id` rompe rows esistenti | 🟢 low | 🟠 medium | Nullable column, no default, no FK in Phase 1. Index in Phase 2. |
| R-10 | testing_agent_v3 fail su 1 dei 12 frontend tests | 🟡 medium | 🟡 medium | Bug-fix + retest cycle. Budget 0.25g per fix. |

### 10.2 · Dipendenze esterne

| Dep | Owner | Impact se blocked |
|---|---|---|
| Supabase availability | infra | API tests fail · environment-dependent |
| `proposals` table popolata (per test convert-to-customer) | testing agent seeded data | mocked test fixtures se assente |
| i18n locales already exist | ITER183 | ✅ OK, già consegnato |
| `discovery_interviews` migration 114 applicata | ITER177.B | ✅ OK |

### 10.3 · Rollback plan

Se ITER185 Phase 1 introduce regressioni critiche post-deploy:

| Issue | Rollback action |
|---|---|
| Fast Capture rotto | Revert `NewRelationshipModal.jsx` Lead branch to inline 4-field |
| Discovery Progress crash | Disable widget via feature flag `VITE_DISCOVERY_PROGRESS_ENABLED=false` |
| Convert-to-customer 500 | Endpoint return 503 with retry-after; UI mostra "Funzionalità temporaneamente non disponibile" |
| Legacy promote 410 rompe ProspectsPage | Re-enable endpoint behind admin flag · 1 day fix |
| Migration `signed_proposal_id` non riesce | Migration idempotente (`IF NOT EXISTS`) — no rollback necessario |

**Strategia:** ogni cambio backend è dietro **feature flag** lato API (header `X-Feature-Flag` o tenant setting). Frontend usa fallback compat per locale strings.

### 10.4 · Definition of Done (DoD)

✅ Phase 1 è done **SOLO** quando:
1. Tutti i 40+ test pytest passano
2. testing_agent_v3 reporta ≥95% pass rate
3. Smoke E2E manual Flow A, B, C confermati
4. Zero CI lint violations
5. `ITER185_PHASE1_IMPLEMENTATION_REPORT.md` generato
6. PRD.md aggiornato
7. test_credentials.md verificato

---

## 11 · VINCOLO RISPETTATO

✅ Zero modifiche in questa iterazione (Plan only):
- DB schema / migrations
- Backend routers / endpoint
- Frontend componenti / pages
- i18n strings
- Configuration files

✅ Solo file creato:
- `/app/memory/ITER185_PHASE1_IMPLEMENTATION_PLAN.md` (questo documento)

---

## 12 · DECISION GATE

### 12.1 · Output finale completato (10 punti come da Founder directive)

| # | Output | Sezione |
|---|---|---|
| 1 | Conflict Analysis | §1 |
| 2 | Fast Lead Capture Plan | §2 |
| 3 | Complete Lead Capture Plan | §3 |
| 4 | Discovery Progress Engine Plan | §4 |
| 5 | Prospect Qualification Plan | §5 |
| 6 | Customer Conversion Plan | §6 |
| 7 | Journey Enforcement Plan | §7 |
| 8 | Test Plan | §8 |
| 9 | Effort Estimate | §9 |
| 10 | Risk Analysis | §10 |

### 12.2 · Domande aperte al Founder

1. **DoD coverage di test:** approvi target 95% testing_agent_v3 pass rate? o richiedi 100%?
2. **Feature flag strategy:** preferisci env-var flag (più semplice) o tenant-setting flag (più granulare, più effort)?
3. **Public Begin Journey lifecycle_stage='new_inquiry'**: confermi che il fix `prospect` deve essere retroattivo (UPDATE migration su dati esistenti) o solo forward (nuove rows)?
4. **Effort budget:** 8.75g è coerente con il sprint? Se serve squeeze, suggerisci:
   - a. Skip `RevertToProspectModal` (rinvio Phase 2) → -0.5g
   - b. Skip `CompleteCapturePanel` 6-sezioni → -1.5g (ma rompi UX promise)
   - c. Skip i18n localization per Phase 1 (solo it-IT + en-US) → -0.25g
5. **Test schedule:** preferisci backend test in batch a fine sviluppo (1g) o test-as-you-go (distribuito)?

---

## 13 · Revision log

| Versione | Data | Autore | Note |
|---|---|---|---|
| 1.0 | 2026-06-01 | Product Governance | Phase 1 implementation plan iniziale · awaiting Founder approval |

---

**Status:** 🔓 **PLAN READY FOR FOUNDER APPROVAL**  
**Next gate:** Approvazione Founder → kickoff **ITER185 Phase 1 implementation** (coding starts).  
**Blocked iterations until ITER185 Phase 1 shipped + tested:** Phase 2-3-4, Notification Bus, Journey Assignments Phase 2, Editorial Onboarding, Error Registry, Client Chameleon.
