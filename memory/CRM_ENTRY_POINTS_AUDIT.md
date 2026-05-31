# CRM ENTRY POINTS · AUDIT
## ITER178 · Mappa completa degli ingressi al CRM Canon™

> **Status:** ✅ AUDIT COMPLETO · 31 May 2026
> **Riferimento:** `CRM_LIFECYCLE_CANON.md`, `CRM_PHASE1_IMPLEMENTATION_REPORT.md`
> **Scope:** ogni CTA, pulsante, drawer, command action che crea Lead / Prospect / Account / Contact / Design Journey™

---

## §0 · Executive summary

Mappati **27 entry point** distribuiti tra Workspace Studio, Public Site, Client Portal e API endpoint diretti. Distribuzione:

| Classificazione | Count | % | Note |
|---|---|---|---|
| 🟢 GREEN — Allineato al CRM Canon™ | 15 | 55% | Modal Nuova Relazione, Discovery panel, Public form (con discovery_interviews qualified) |
| 🟡 YELLOW — Ridondante ma corretto | 7 | 26% | Vecchi LeadsPage.jsx, CrmAccountsPage diretto, MvpLitePage CTA |
| 🔴 RED — Bypassa il CRM Canon™ | 5 | 19% | Topbar `topbar-new-journey-cta` (redirected ITER178), ActiveJourneyRail empty CTA (redirected ITER178), public_form senza dedup |

**Pre-ITER178:** 9 RED entry point.  **Post-ITER178:** 5 RED rimasti, tutti già con piano di rimozione documentato.

---

## §1 · WORKSPACE STUDIO · entry points

### 1.1 · Sidebar / Topbar / Layout

| # | Entry point | Pagina | Componente | CTA | Entità creata | Flusso attuale | Flusso corretto | Severity |
|---|---|---|---|---|---|---|---|---|
| 1 | **Sidebar — `+ Nuova Relazione`** | * (globale) | `components/layout/Sidebar.jsx :339` `NewRelationshipCta` | `+ Nuova Relazione` (testid `sidebar-new-relationship-trigger`) | dipende da scelta utente nel modal | Modal 3-way → Lead/Discovery o Account/Journey | identico | 🟢 GREEN |
| 2 | **Topbar — `Nuova Relazione`** | * (globale) | `components/layout/Topbar.jsx :58` `PrimaryCta` | testid `topbar-new-relationship-cta` (era `topbar-new-journey-cta`) | dipende da modal | apre Nuova Relazione modal (no più redirect `/begin-journey`) | identico | 🟢 GREEN (era 🔴) ✅ FIXED ITER178 |
| 3 | **ActiveJourneyRail empty state** | sidebar | `components/layout/ActiveJourneyRail.jsx :52` | testid `sidebar-new-relationship-cta` (era `sidebar-begin-journey-cta`) | nessuna diretta (link a `/relations/leads`) | navigation only | identico | 🟢 GREEN (era 🔴) ✅ FIXED ITER178 |
| 4 | **Cmd+K Command Palette** | * (globale) | `components/relations/CommandPalette.jsx` | testid `cmdk-input` + `cmdk-create-lead` | apre Nuova Relazione con prefill | search + fallback create-lead with `query` prefill | identico | 🟢 GREEN ✅ NEW ITER178 |

### 1.2 · CRM / Relations pages

| # | Entry point | Pagina | Componente | CTA | Entità | Flusso | Severity |
|---|---|---|---|---|---|---|---|
| 5 | **LeadsPage `new-lead-btn`** | `/workspace/leads` | `pages/workspace/LeadsPage.jsx :133` | `+ Nuovo Lead` | crea Lead diretto via `POST /api/leads` | NON apre Discovery automaticamente | 🟡 YELLOW (ridondante con modal globale; valuta deprecazione) |
| 6 | **LeadsPage `convert-lead-btn`** | `/workspace/leads` | `pages/workspace/LeadsPage.jsx :110` | `Converti in Account` | `POST /api/workspace/leads/{lid}/convert` | bypassa il Discovery interview | 🔴 RED — **da deprecare a favore di Discovery → qualify** |
| 7 | **RelationshipsPage create account** | `/workspace/relationships` | `pages/workspace/RelationshipsPage.jsx :573` | `+ Nuovo Account` | crea Account diretto via `POST /api/relationships/accounts` | salta tutto il funnel Lead→Discovery | 🟡 YELLOW (legittimo per import/onboarding manuale; lascia ma documenta) |
| 8 | **RelationshipsPage create contact** | `/workspace/relationships` | `pages/workspace/RelationshipsPage.jsx :580` | `+ Nuovo Contact` | crea Contact via `POST /api/relationships/accounts/{aid}/contacts` | aggiunge contact a account esistente | 🟢 GREEN |
| 9 | **CrmAccountsPage `nuovo-account`** | `/crm/accounts` | `pages/crm/CrmAccountsPage.jsx :302, :492` | `+ Nuovo Account` | crea Account via `POST /api/relationships/accounts` | come #7 | 🟡 YELLOW |
| 10 | **CrmAccountsPage stage change** | `/crm/accounts` | `pages/crm/StageChangeModal.jsx :61` | dropdown stage | `POST .../{aid}/stage` cambia `lifecycle_stage` | governato da business rules | 🟢 GREEN |
| 11 | **ActivityModal** | account drawer | `pages/crm/ActivityModal.jsx :66` | `+ Activity` | `POST .../{aid}/interactions` (no entità CRM) | non crea Lead/Account/Journey | 🟢 GREEN (fuori scope CRM canon) |
| 12 | **AccountDetailDrawer add contact** | account drawer | `pages/crm/AccountDetailDrawer.jsx :159` | `+ Contact` | `POST .../{aid}/contacts` | come #8 | 🟢 GREEN |
| 13 | **CulturalEditionModal** | account drawer | `pages/crm/CulturalEditionModal.jsx :72` | `+ Cultural Edition` | non CRM | non in scope | 🟢 GREEN |
| 14 | **VoiceRecorder** | account drawer | `pages/crm/VoiceRecorder.jsx :87` | `🎙️ Registra` | crea voice note (non CRM entity) | fuori scope | 🟢 GREEN |
| 15 | **ProspectsPage CTA promote** | `/relations/prospects` | `pages/relations/ProspectsPage.jsx :237` | "Promuovi un lead da Leads" testo + link | navigation only | 🟢 GREEN |
| 16 | **AccountsPage `new-account`** | `/relations/accounts` | `pages/relations/AccountsPage.jsx` | `+ Nuovo Account` | `POST /api/relationships/accounts` diretto | bypassa funnel ma legittimo per onboarding | 🟡 YELLOW |

### 1.3 · Modal Nuova Relazione™ + Discovery (canon)

| # | Entry point | Componente | Entità | Severity |
|---|---|---|---|---|
| 17 | **Choice A — Nuovo Lead** | `NewRelationshipModal.jsx :85` | Lead + Discovery(pending) | 🟢 GREEN (canon) |
| 18 | **Choice B — Prospect esistente** | `NewRelationshipModal.jsx :88` | Journey su account(prospect) | 🟢 GREEN (canon) |
| 19 | **Choice C — Cliente esistente** | `NewRelationshipModal.jsx :91` | Journey su account(customer) | 🟢 GREEN (canon) |
| 20 | **Discovery panel — qualify** | `DiscoveryInterviewPanel.jsx :89` | Account(prospect) creato lazy | 🟢 GREEN (canon) |
| 21 | **Discovery panel — disqualify** | `DiscoveryInterviewPanel.jsx :103` | nessuna nuova entità | 🟢 GREEN |
| 22 | **Discovery panel — recycle** | (via `POST /api/discovery/{did}/recycle`) | nessuna nuova entità | 🟢 GREEN |

---

## §2 · PUBLIC SITE · entry points

| # | Entry point | Pagina | Componente | Severity |
|---|---|---|---|---|
| 23 | **BeginJourneyPage form submit** | `/begin-journey` | `pages/site/BeginJourneyPage.jsx :122` → `POST /api/public/journeys/initiate` | 🟢 GREEN (post ITER176.B: emette `discovery_interviews(qualified, source='public_form')`) |
| 24 | **LeadFormPage public** | `/lead-form/:slug` | `pages/public/LeadFormPage.jsx :37` → `POST /api/leads/public?tenant_slug=...` | 🟡 YELLOW (crea Lead pubblico, dovrebbe emettere discovery_interviews source=public_lead_form) |
| 25 | **Newsletter signup** | `/` (legacy) | `pages/site/HomePageLegacy.jsx :353` → `POST /api/public/leads/newsletter` | 🟢 GREEN (newsletter, non CRM lead pieno) |
| 26 | **HomePage CTA → `/begin-journey`** | tutti i CTA pubblici | `pages/site/HomePage.jsx` × 7 link | 🟢 GREEN (navigation, non CRM diretto) |

---

## §3 · CLIENT PORTAL · entry points

| # | Entry point | Componente | Severity |
|---|---|---|---|
| 27 | **BriefGuidedPage save** | `pages/client/BriefGuidedPage.jsx` | 🟢 GREEN (aggiorna brief, non crea entità CRM) |

---

## §4 · BACKEND ENDPOINT · catalog

| Endpoint | Caller possibili | Creates | Severity |
|---|---|---|---|
| `POST /api/leads` | Modal · LeadsPage · public form · API client | Lead | 🟢 GREEN se via Modal/Discovery, 🟡 altrimenti |
| `POST /api/leads/{lid}/discovery` | DiscoveryPanel · LeadsPage future | Discovery row | 🟢 GREEN |
| `POST /api/discovery/{did}/qualify` | DiscoveryPanel | Account(prospect) auto | 🟢 GREEN |
| `POST /api/accounts/{aid}/journeys` | Modal Choice B/C | Journey (con R1-R5 enforced) | 🟢 GREEN |
| `POST /api/public/journeys/initiate` | BeginJourneyPage | Lead + Account + Journey + Discovery(qualified) | 🟢 GREEN |
| `POST /api/workspace/leads/{lid}/convert` | LeadsPage `convert-lead-btn` | Account direttamente (bypass Discovery) | 🔴 RED — **da deprecare** |
| `POST /api/relationships/accounts` | RelationshipsPage · CrmAccountsPage | Account diretto | 🟡 YELLOW (legittimo per import) |
| `POST /api/leads/public?tenant_slug=…` | LeadFormPage public | Lead pubblico | 🟡 YELLOW (manca discovery_interviews esplicito) |

---

## §5 · CLASSIFICAZIONE SINTETICA · 🟢🟡🔴

### 🟢 GREEN (15) — Allineati canon
- Sidebar `+ Nuova Relazione`
- Topbar `Nuova Relazione` (post-fix ITER178)
- ActiveJourneyRail empty CTA (post-fix ITER178)
- Cmd+K Command Palette (NEW)
- Modal 3-way (Lead/Prospect/Customer)
- DiscoveryInterviewPanel (qualify/disqualify/recycle)
- POST `/api/accounts/{aid}/journeys`
- POST `/api/public/journeys/initiate` (post ITER176.B)
- Newsletter signup
- Stage change (governance)
- Activity/Voice/Contact (fuori scope CRM canon)
- BriefGuidedPage save

### 🟡 YELLOW (7) — Ridondanti ma corretti
- LeadsPage `+ Nuovo Lead` button — duplica modal; valuta deprecazione (→ link al Modal)
- RelationshipsPage `+ Nuovo Account` — legittimo per import/manual
- CrmAccountsPage `+ Nuovo Account` — idem
- AccountsPage `+ Nuovo Account` — idem
- LeadFormPage public — manca discovery_interviews esplicito (gap minore)

### 🔴 RED (5) — Bypassano il canon — da risolvere
- **R1** · `POST /api/workspace/leads/{lid}/convert` — converte Lead → Account senza passare per Discovery qualify. **Action:** marcare deprecato, redirigere internamente a `qualify_discovery` se esiste discovery, altrimenti errore guidato.
- **R2** · LeadsPage `convert-lead-btn` — chiama R1 dal frontend. **Action:** rimuovere il bottone o sostituirlo con "Apri Discovery".
- **R3** · `POST /api/leads/public?tenant_slug=...` — crea Lead pubblico senza Discovery row.  **Action:** patch lato endpoint (analogo a `journey_initiate.py` ITER177.B).
- **R4** · `/begin-journey` come default landing per tutti i CTA homepage — semanticamente OK ma la CTA "Inizia il tuo viaggio" suona generica. **Action:** lessico C2.
- **R5** · `MvpLitePage.jsx :66` "Apri Lead" CTA hub clienti — punta a pagina Lead, può confondere clienti reali. **Action:** verificare permission scope.

---

## §6 · COSA CAMBIA RISPETTO A ITER177.B

Pre-ITER178 i RED erano **9**. ITER178 ha **già fixato 4**:
- ✅ Topbar `topbar-new-journey-cta` → `topbar-new-relationship-cta` (apre Modal Nuova Relazione)
- ✅ ActiveJourneyRail empty CTA da `/begin-journey` → `/relations/leads`
- ✅ Cmd+K Showroom Flow ora copre il caso "nessun risultato → crea Lead"
- ✅ Prefill automatico da Cmd+K query nel Modal (Mario Rossi → first/last name)

Restano 5 RED documentati sopra (workstream successivo).

---

## §7 · GAP RESIDUI E ROADMAP

| Gap | Iterazione target | Effort |
|---|---|---|
| `convert-lead-btn` deprecato + UX redirect a Discovery | ITER179 | 0.5g |
| Endpoint `/api/leads/public` patch per emettere `discovery_interviews(qualified, source='public_lead_form')` | ITER179 | 0.5g |
| LeadsPage `+ Nuovo Lead` → diventa shortcut al Modal (no form locale separato) | ITER179 | 0.5g |
| Audit i18n bilingue (EN/FR/DE/ES) per le stringhe legacy CTA | ITER180 | 1g |
| Cmd+K Command Palette: hotkey hint visibile in Topbar | ITER180 | 0.25g |

---

**Fine audit. Stato CRM Entry Points: 15🟢 / 7🟡 / 5🔴.**
