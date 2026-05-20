# MOOD for DESIGN™ — Journey Alignment Audit™ (Sprint G.0)
**Document date**: 21 Feb 2026 · iter101  
**Purpose**: bloccare definitivamente l'architettura prima di qualunque refactor UI/UX.  
**Source of truth**: inventario reale del codice (60+ backend routers, ~80 frontend pages, ~90 DB tables).  
**Status**: 🔒 LOCKED — qualunque sprint successivo deve coerentemente referenziare questo documento.

---

## 0 · Root Principle

> MOOD for DESIGN **non è** una collezione di moduli.  
> MOOD for DESIGN **è** un ecosistema orchestrato dal Design Journey™.

Ogni schermata, ogni endpoint, ogni entità deve rispondere a:
1. **A quale Journey appartiene?**
2. **A quale Step del Journey serve?**
3. **Quale decisione progettuale supporta?**

Se la risposta è "nessuna" → quel modulo è **Global Archive** o **Studio OS** e **non deve rompere il flow operativo del Journey**.

---

## 1 · Entity Hierarchy™ (DEFINITIVA)

```
┌────────────────────────────────────────────────────────────────────┐
│  ROOT ENTITY                                                       │
│  ── Account (relazione viva con il cliente)                        │
│       └── 1..N Contact (persone fisiche dell'Account)              │
│            │                                                       │
│            │   un Account può essere "in dialogo" anche senza      │
│            │   journey attivo — vive come relazione, non come deal │
│            ▼                                                       │
│  JOURNEY ENTITY                                                    │
│  ── Design Journey™ (1 per "viaggio progettuale" condiviso)        │
│       │   un Account può avere 0..N Journey nel tempo              │
│       │   un Journey appartiene a 1 Account                        │
│       │   un Journey ha 1..N Contact coinvolti come "lettori"      │
│       ▼                                                            │
│  JOURNEY STEP                                                      │
│  ── Journey Milestone (10 pietre miliari narrative italiane)       │
│       brief · inspirations · moodboard_direction · material_dir.   │
│       concept_design · technical_package · curated_selections      │
│       site_evolution · final_presentation · certified_closure      │
│       ▼                                                            │
│  STEP ARTIFACT                                                     │
│  ── Artefatto editoriale legato a uno Step:                        │
│       Moodboard · Material Selection · Concept Document · Render  │
│       Site Photo Set · Final Presentation · Closure Document       │
│       │   ogni artifact è "puntato" da uno step via linked_entity  │
│       ▼                                                            │
│  VERSION (capitolo progettuale)                                    │
│  ── Milestone Version (chapter_kind italiano editoriale)           │
│       Direzione iniziale · Evoluzione proposta · Variante cond.    │
│       Revisione materica · Nuova interpretazione · Direzione fin.  │
│       │   ogni version può portare un Artifact nuovo o evolverne 1 │
│       ▼                                                            │
│  FEEDBACK / APPROVAL (voce curatoriale)                            │
│  ── Milestone Feedback (10 kind editoriali italiani)               │
│       embraces · explore_atmosphere · request_variant · ...        │
│       │   tono: embrace · curious · reorient · voice               │
│       ▼                                                            │
│  ANALYTICS (memoria viva)                                          │
│  ── Journey Timeline Event (narrative_text in italiano editoriale) │
│       chapter_added · client_voice · milestone_*                   │
│  ── Journey Insight (aggregato cross-progetto)                     │
│  ── Studio Pulse (la grammatica dello studio)                      │
└────────────────────────────────────────────────────────────────────┘
```

### Relazioni DB reali esistenti

| Tavolo | Mappa nella gerarchia | FK verso |
|---|---|---|
| `accounts` | Root Entity | – |
| `contacts` | Root Entity (child di Account) | `account_id` |
| `relationship_projects` | Bridge legacy (CRM↔Project) | da deprecare a favore di Journey |
| `projects` | Project shell (sopravvive come "container") | `tenant_id` |
| `design_journeys` ✅ | **Journey Entity** | `project_id` (unique) |
| `journey_milestones` ✅ | **Journey Step** | `journey_id` |
| `journey_timeline_events` ✅ | Analytics narrativa | `journey_id`, `milestone_id` |
| `milestone_versions` ✅ NEW | **Version** | `milestone_id` |
| `milestone_feedback` ✅ NEW | **Feedback** | `milestone_id`, `version_id` |
| `moodboard_pages` | Step Artifact (linked al moodboard_direction step) | `project_id` |
| `material_assets`, `material_registry` | Step Artifact (material_direction) | – |
| `inspirations_*` | Step Artifact (inspirations step) + Global Archive | – |
| `proposal_market_versions` | Step Artifact (final_presentation) | – |
| `media_library`, `media_collections` | Global Archive (Curatorial Atlas) | – |
| `curated_collections`, `saved_references` | Step Artifact + Global Archive | – |
| `cms_pages`, `magazine_articles` | Publishing Layer | – |
| `client_messages` | Relationship Layer | – |
| `relationship_*` (8 tables) | Relationship Intelligence Layer | `account_id` |

### Gap di gerarchia identificati

- **Manca** `account_id` su `design_journeys` → il journey è collegato al progetto, non direttamente all'Account. Si naviga via `projects.relationship_account_id` (se presente). **DA FIXARE** con FK esplicita.
- **Manca** `journey_id` su `moodboard_pages`, `material_assets`, `proposals`, `inspirations_boards` → gli artefatti non sanno a quale Journey appartengono (si risolve via `project_id` ma è indiretto).
- **Manca** `milestone_id` (o `journey_step_id`) sugli artifact → impossibile sapere a quale STEP del Journey appartiene un moodboard/material/proposta senza euristica.
- **Manca** entità `journey_artifacts` opzionale che fa da bridge unificato (può vivere come VIEW).

---

## 2 · Journey Alignment Map™

Per ogni modulo/page/router attuale → **categoria architetturale** + **status di allineamento**.

Legenda status:
- 🟢 **ALIGNED** — già coerente con Journey OS™
- 🟡 **PARTIAL** — funziona ma deve essere "embedded" o ri-orchestrato
- 🔴 **MISALIGNED** — oggi vive come standalone CRUD/SaaS e va rifatto
- ⚫ **LEGACY** — duplicato o da deprecare
- 🔵 **GLOBAL** — è correttamente archivio/global (non deve essere Journey-bound)
- ⚪ **STUDIO** — Studio OS (governance, branding, billing)

### 2.1 — Root Entity Layer (Account / Contact)

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/leads.py` | Root Entity ingress | 🔴 MISALIGNED | "Lead" è terminologia CRM aggressiva. Deve diventare "**Account in dialogo aperto**" |
| `routers/relationships.py` | Relationship Layer | 🟡 PARTIAL | OK come substrato, ma deve esporre "Journey per Account" come vista primaria |
| `pages/crm/CrmAccountsPage.jsx` | Root Entity list | 🔴 MISALIGNED | Pagina CRM-style. Manca colonna "Journey attivi" + "ultima voce ricevuta" |
| `pages/crm/AccountDetailPage.jsx` | Root Entity detail | 🔴 MISALIGNED | Tab "Activity/Notes/Files" CRUD. Deve essere "**I Journey con questo cliente · Le voci · I capitoli**" |
| `pages/workspace/LeadsPage.jsx` | Root Entity list | ⚫ LEGACY | Redirige già a /crm/accounts. Verificare zero referenze residue |
| `pages/public/LeadFormPage.jsx` | Public ingress | 🔴 MISALIGNED | Chiede budget upfront. NON è "Inizia il Design Journey" |
| `pages/site/StartProjectWizard.jsx` | Public ingress | 🟡 PARTIAL | 867 righe — può diventare il vero "Initia il viaggio" se semplificato |

### 2.2 — Journey Entity Layer

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/design_journey.py` ✅ | Journey backbone | 🟢 ALIGNED | Endpoint per Project; manca shortcut per Account |
| `routers/milestone_dialogue.py` ✅ NEW | Step Dialogue | 🟢 ALIGNED | Sprint F.B chiuso |
| `pages/workspace/DesignJourneyTab.jsx` ✅ | Journey UI | 🟢 ALIGNED | Centro narrativo. Manca: Site Evolution™, Documents inline panels (placeholder) |
| `pages/workspace/ProjectDetailPage.jsx` | Project shell | 🟡 PARTIAL | Journey è già default tab. Altre tab (Overview/Ispirazioni/Materiali/Proposte) sono "ambienti collegati" — OK ma andrebbe rinominato "Project Studio del Journey" |
| `components/journey/JourneyContextHeader.jsx` ✅ | Continuity strip | 🟢 ALIGNED | Montato in 4 satelliti |
| `components/journey/MilestoneDialogue.jsx` ✅ NEW | Step Dialogue UI | 🟢 ALIGNED | Sprint F.B chiuso |

### 2.3 — Step Artifact Layer

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/moodboards.py`, `moodboards_v1.py` | Step Artifact (moodboard_direction) | 🟡 PARTIAL | Funzionano. Manca FK esplicita `milestone_id` |
| `pages/moodboards/MoodboardsPage.jsx` | Global list di moodboard | 🔴 MISALIGNED | Lista globale flat. Dovrebbe essere "**Moodboards aperti nel Journey X · nello Step Y**" |
| `pages/moodboards/MoodboardEditor.jsx` | Step Artifact editor | 🟢 ALIGNED | Ha già JCH |
| `routers/proposals.py`, `proposal_composer.py` | Step Artifact (final_presentation) | 🟡 PARTIAL | Manca FK `milestone_id` |
| `pages/workspace/ProposalsPage.jsx` | Global list | 🔴 MISALIGNED | Pagina lista standalone. Deve vivere dentro lo step `final_presentation` |
| `pages/workspace/ProposalComposerPage.jsx` | Step Artifact editor | 🟡 PARTIAL | Manca JCH |
| `routers/inspirations.py`, `inspirations_boards.py` | Step Artifact + Global Archive | 🟡 PARTIAL | OK come archivio; manca link forte allo step `inspirations` |
| `pages/inspirations/InspirationsPage.jsx` | Global Archive | 🔵 GLOBAL | Coerente |
| `pages/inspirations/MaterialViewPage.jsx` | Curatorial Layer | 🔵 GLOBAL | Coerente |
| `pages/inspirations/ProductGalleryPage.jsx` | Curatorial Layer | 🔵 GLOBAL | Coerente |
| `pages/library/MaterialsPage.jsx`, `MaterialDetailPage.jsx` | Step Artifact (material_direction) | 🔴 MISALIGNED | Pagina library globale. Dovrebbe esporre "Materiali scelti per il Journey X" |
| `pages/library/MediaLibraryPage.jsx` | Global Archive | 🔵 GLOBAL | Coerente |
| `pages/workspace/ReferencesPage.jsx` | Step Artifact | ⚫ LEGACY | Redirect a /inspirations. OK |
| `routers/curated_references.py` | Step Artifact bridge | 🟡 PARTIAL | "Curated Collections" → manca FK opzionale `journey_id` |
| `routers/templates.py`, `inspirations_archive.py` | Global Archive | 🔵 GLOBAL | Coerente |
| `routers/brands_registry.py`, `supplier_catalogs.py` | Curatorial Layer | 🔵 GLOBAL | Coerente |

### 2.4 — Version & Feedback Layer

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/milestone_dialogue.py` ✅ | Version + Feedback | 🟢 ALIGNED | Coerente |
| `routers/client_preview.py` | Version preview | 🟡 PARTIAL | "Preview Link Cliente" è una version-share. Manca link a `milestone_id` |
| `pages/ClientPreviewPage.jsx` | Public version view | 🟡 PARTIAL | OK ma non sa che è "Capitolo X del Journey Y" |
| `routers/collab.py` | Comment/Review | 🔴 MISALIGNED | "Comments" sui moodboard. Vocabolario PM-style. Deve essere convogliato dentro Milestone Dialogue™ |
| `pages/collab/ReviewMode.jsx` | Comment view | 🔴 MISALIGNED | Idem |

### 2.5 — Relationship & Analytics Layer

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/insights.py` | Analytics globale (Studio Pulse) | 🟢 ALIGNED | OK come "grammatica dello studio" |
| `pages/insights/InsightsPage.jsx` | Studio Pulse | 🟢 ALIGNED | OK |
| `routers/dashboard.py` | Home dashboard | 🔴 MISALIGNED | Oggi stat-cards CRUD. Deve essere "**I Journey in corso · Le voci da ascoltare · I capitoli da scrivere**" |
| `pages/dashboard/DashboardPage.jsx` | Home | 🔴 MISALIGNED | Idem |
| `pages/dashboard/CockpitTimeline.jsx` | Activity feed | 🟡 PARTIAL | Buona base, ma deve raccontare "ultime voci dei tuoi Journey" non "attività utente" |
| `routers/crm_intelligence.py`, `crm_voice_notes.py` | Relationship Intelligence | 🟡 PARTIAL | OK come substrato; deve esporsi dentro Account → Journey |
| `routers/usage_memory.py` | Studio Language analytics | 🟢 ALIGNED | OK |
| `routers/events.py` | Event bus | ⚪ STUDIO | Infrastruttura |

### 2.6 — Publishing Layer (storefront pubblico)

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/storefront.py`, `pages.py`, `navigation.py` | Publishing | 🔵 GLOBAL | Coerente |
| `routers/public.py`, `forms.py` | Public ingress | 🔴 MISALIGNED | Forms ingestion non sa che genera un Journey |
| `routers/portfolio.py` | Public portfolio | 🔵 GLOBAL | OK — è il pubblico "design stories" |
| `routers/magazine.py` | Publishing | 🔵 GLOBAL | OK |
| `pages/site/HomePage.jsx`, `ProjectsIndexPage.jsx`, `ProfessionalsGatewayPage.jsx` | Public | 🟡 PARTIAL | Devono parlare di "Journey" non "Projects" come prodotto |
| `pages/storefront/StorefrontStudioPage.jsx` | Studio editor | ⚪ STUDIO | OK |
| `pages/site/StartProjectWizard.jsx` | Public ingress | 🟡 PARTIAL | Deve diventare il vero "Inizia il Design Journey" |
| `pages/site/ProfessionalIntakePage.jsx` | Public ingress | 🟡 PARTIAL | Idem per i professionisti |

### 2.7 — Editorial / Cultural Layer

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/editorial.py`, `editorial_calendar.py`, `editorial_variants.py`, `ai_editorial.py` | Publishing Layer | 🔵 GLOBAL | OK — vive nello Studio Content Studio |
| `routers/magazine.py`, `markets.py`, `market_intelligence.py`, `market_perspectives.py` | Publishing/Cultural | 🔵 GLOBAL | OK |
| `routers/cultural_editions.py` | Bridge Journey↔Culture | 🟡 PARTIAL | Cultural Editions devono essere **generate alla Certified Closure** del Journey |
| `pages/cultural/CulturalEditionsListPage.jsx`, `CulturalEditionReviewPage.jsx` | Editorial Layer | 🟡 PARTIAL | OK ma manca link "generato dal Journey X" |
| `pages/editorial/*` | Editorial Studio | 🔵 GLOBAL | OK |
| `pages/governance/*` (BrandVoice, MarketMatrix, MarketInsights) | Studio OS | ⚪ STUDIO | OK |

### 2.8 — Studio OS (governance)

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/auth.py`, `profile.py`, `members.py`, `settings.py`, `superadmin.py`, `license.py`, `branding.py`, `domains.py`, `locale_runtime.py`, `tenant_onboarding.py`, `onboarding.py` | Studio OS | ⚪ STUDIO | OK |
| `routers/blueprint.py` | Studio Builder | ⚪ STUDIO | OK |
| `pages/settings/*`, `pages/admin/*`, `pages/auth/*` | Studio OS | ⚪ STUDIO | OK |
| `routers/advisor_network.py`, `advisor_suggestions.py`, `human_assignment.py` | Studio Layer | 🟡 PARTIAL | Advisor è il "leader" di un Journey ma il legame oggi è debole |
| `pages/advisor/AdvisorDashboardPage.jsx` | Advisor home | 🔴 MISALIGNED | Dashboard advisor con stat cards. Deve essere "**I miei Journey · le voci attive**" |
| `routers/storage.py`, `media.py`, `media_enrichment.py` | Studio infra | ⚪ STUDIO | OK |

### 2.9 — Client Portal

| Module | Category | Status | Note |
|---|---|---|---|
| `routers/client_portal.py`, `client_messages.py`, `client_preview.py` | Client side Journey view | 🟡 PARTIAL | Manca la lettura cliente del Journey come "il mio viaggio" |
| `pages/client/ClientOverviewPage.jsx`, `ClientMessagesPage.jsx`, `ClientStubPages.jsx` | Client UI | 🔴 MISALIGNED | Oggi è "portal CRUD" con tab Files/Approvals/Messages. Deve essere "**Il tuo Design Journey · I capitoli condivisi · Le tue voci**" |

---

## 3 · Module Relationship Matrix™

### 3.1 — Cosa DEVE vivere DENTRO il Journey (operativo)

```
JOURNEY (1 per progetto attivo)
  ├── Brief Cliente              → step "brief"
  ├── Inspirations Picker        → step "inspirations"  (artefatto: inspirations_boards)
  ├── Moodboard Direction™       → step "moodboard_direction"   (artefatto: moodboard_pages)
  ├── Material Direction™        → step "material_direction"    (artefatto: material_assets / curated_collections)
  ├── Concept Design™            → step "concept_design"        (artefatto: concept document)
  ├── Technical Package™         → step "technical_package"     (artefatto: technical docs)
  ├── Curated Selections™        → step "curated_selections"    (artefatto: curated_collections)
  ├── Site Evolution™            → step "site_evolution"        (artefatto: photo timeline + before/after)
  ├── Final Presentation™        → step "final_presentation"    (artefatto: proposal_market_versions)
  └── Certified Closure™         → step "certified_closure"     (artefatto: cultural_edition_drafts)
```

Tutti gli artifact qui dentro **devono mostrare Journey breadcrumb + Milestone context**.

### 3.2 — Cosa è correttamente GLOBAL ARCHIVE (Curatorial Atlas)

```
CURATORIAL ATLAS (sempre disponibile, vive parallelo al Journey)
  ├── Inspirations™               (archive culturale tenant-wide)
  ├── Brand Mode™ / Brands       (registry brand + collections)
  ├── Material View™              (materioteca curatoriale)
  ├── Product Gallery™            (visual atlas per prodotto)
  ├── Media Library              (asset globale + Cultural Editions™)
  └── Cultural Editions™          (signature editoriale culturale)
```

Questi moduli **non devono avere obbligo di Journey-context** ma **devono offrire** "Aggiungi al Journey X · Step Y" come azione contestuale.

### 3.3 — Cosa è ENTITÀ VIVA (relationship)

```
ACCOUNT (root)
  ├── Contact (1..N persone)
  ├── Relationship signals (engagement, affinity)
  ├── Voice notes / interactions
  └── Journey (0..N)
       └── ...
```

L'Account può esistere SENZA Journey (relazione in incubazione). Ma ogni Journey richiede Account.

### 3.4 — Cosa è SOLO ARCHIVIO / NON DEVE ROMPERE IL FLOW

```
PUBLISHING LAYER (storefront)
  ├── Magazine / Articles
  ├── Public Project Stories (portfolio)
  ├── Storefront Pages (CMS)
  └── Forms (lead intake)
```

```
STUDIO OS (governance)
  ├── Team / Members
  ├── Brand Studio
  ├── Domains / Locales / Languages
  ├── Billing / Plan
  ├── Integrations
  └── Settings
```

### 3.5 — Cosa è ARTEFATTO vs ENTITÀ VIVA (linea di demarcazione)

| Concetto | Tipo | Vive senza Journey? |
|---|---|---|
| Account | Entità viva | ✅ Sì |
| Contact | Entità viva | ✅ Sì (figli di Account) |
| Journey | Entità viva | ❌ No — richiede Account |
| Milestone | Step | ❌ No — richiede Journey |
| Moodboard | Artefatto | ⚠️ Tecnicamente sì, ma se non legato perde senso narrativo |
| Material Selection | Artefatto | ⚠️ Stessa cosa |
| Proposal | Artefatto | ❌ Deve essere legato a Journey |
| Inspiration item | Artefatto (Curatorial) | ✅ Sì (archive) |
| Brand registry entry | Curatorial | ✅ Sì |
| Cultural Edition | Artefatto editoriale | ⚠️ Idealmente generato DA un Journey closure |

---

## 4 · Current Misalignments™ (le 12 ferite aperte)

### M1 · Lead intake = form commerciale
- `pages/public/LeadFormPage.jsx` chiede **budget upfront**.
- **Effetto**: il primo touchpoint è transazionale, NON relazionale.
- **Severità**: 🔴 CRITICA.

### M2 · "Lead → Project" workflow CRM-style
- Il termine "lead" è ovunque (router `leads.py`, lead_assignments, magazine_anonymous_leads).
- **Effetto**: terminologia funnel marketing aggressivo, contrario al Direction Lock.
- **Severità**: 🔴 CRITICA.

### M3 · Pagine standalone per artefatti del Journey
- `MoodboardsPage` (lista globale flat), `ProposalsPage` (lista globale flat), `MaterialsPage` (libreria globale).
- **Effetto**: l'utente perde il "viaggio" e atterra in liste CRUD.
- **Severità**: 🟠 ALTA.

### M4 · Dashboard home = stat-cards CRUD
- `DashboardPage.jsx` mostra count progetti/moodboard/insights.
- **Effetto**: percezione SaaS dashboard. Non racconta dove sono i Journey.
- **Severità**: 🟠 ALTA.

### M5 · CRM Account = entità separata da Journey
- `AccountDetailPage` ha tab Activity/Notes/Files.
- **Effetto**: il cliente è "scheda CRM", non "compagno di viaggio".
- **Severità**: 🟠 ALTA.

### M6 · Manca FK forte Account → Journey
- `design_journeys` ha `project_id` ma non `account_id` esplicito.
- **Effetto**: navigare "Journey per Account" richiede JOIN indiretto via `projects.relationship_account_id`.
- **Severità**: 🟡 MEDIA (schema).

### M7 · Manca FK forte Artifact → Milestone
- `moodboard_pages`, `material_assets`, `proposal_market_versions` non hanno `milestone_id`.
- **Effetto**: impossibile sapere "questo moodboard a quale Step appartiene" senza euristica.
- **Severità**: 🟡 MEDIA (schema).

### M8 · Comments su moodboards (collab.py) ≠ Milestone Dialogue™
- `collab.py` ha un suo sistema di comments/versions.
- **Effetto**: due conversazioni parallele (collab + milestone dialogue). Duplicato concettuale.
- **Severità**: 🟡 MEDIA (consolidamento).

### M9 · Client Portal duplica i concetti del Journey
- `client/*` ha tab Moodboards/Timeline/Approvals/Files come pagine separate.
- **Effetto**: il cliente vede "portal SaaS" invece di "il tuo viaggio condiviso".
- **Severità**: 🟠 ALTA.

### M10 · Advisor Dashboard senza Journey
- `AdvisorDashboardPage` è dashboard generico con stat cards.
- **Effetto**: l'advisor non sa quali Journey sta accompagnando.
- **Severità**: 🟡 MEDIA.

### M11 · Cultural Editions disconnesse dal Journey
- Cultural Editions oggi sono entità editoriale standalone.
- **Effetto**: la "signature culturale" non nasce dal viaggio progettuale concluso.
- **Severità**: 🟡 MEDIA (future).

### M12 · Insights mostra "stato dello studio" senza "stato dei Journey"
- `InsightsPage` ha pulse studio, ma non risponde a "quali Journey hanno bisogno della tua voce ora?"
- **Severità**: 🟢 BASSA (nice to have).

---

## 5 · UI/UX Misalignment Report™

| Area | Cosa sembra oggi | Cosa manca per essere Journey-centric | Severity |
|---|---|---|---|
| **Public homepage** (`/`) | Vetrina marketing studio | Path "Inizia il tuo Design Journey" come unica CTA primaria | 🟠 |
| **Public lead form** (`/form/:slug`) | Form raccolta dati + budget | "Una stanza di conversazione": nome, email, atmosfera che cerchi, libera espressione | 🔴 |
| **Start Project Wizard** (`/start-project`) | 867 righe multi-step wizard | Onboarding curatoriale 3-step max, niente budget, output = "Il viaggio inizia" | 🔴 |
| **Workspace Dashboard** (`/dashboard`) | Stat cards 6-grid | "I Journey in corso", "Le voci ricevute oggi", "I capitoli da scrivere", "Le pietre miliari in attesa di voce" | 🟠 |
| **Projects list** (`/workspace/projects`) | Atelier list (già migliorata iter98) | Mostra solo "Journey", non "Project". Eyebrow "Design Journey · Atelier" già OK | 🟡 |
| **Project Detail** (`/workspace/projects/:id`) | Tab bar Design Journey/Overview/Ispirazioni/Materiali/Proposte/Conversazioni/Timeline | Design Journey è default e full-bleed → OK. Le altre tab dovrebbero essere "ambienti dello Step" non "moduli paralleli" | 🟡 |
| **MoodboardsPage** (`/moodboards`) | Lista flat globale | Deve essere "Moodboard del Journey X · Step Moodboard Direction" raggruppati per Journey | 🟠 |
| **MaterialsPage** (`/library/materials`) | Libreria globale | OK come archive, ma deve avere "Materiali del Journey X" sezione contestuale | 🟡 |
| **ProposalsPage** (`/workspace/proposals`) | Lista flat globale | Deve essere "Proposte del Journey X · Step Final Presentation" | 🟠 |
| **CRM Accounts** (`/crm/accounts`) | Lista CRM con stage/funnel | Mostra prima "Journey attivi per ogni Account", poi contatti/note | 🟠 |
| **CRM Account Detail** (`/crm/accounts/:id`) | Tab Activity/Notes/Files | "I Journey con [nome cliente]", "Le ultime voci ricevute", "I prossimi capitoli" | 🟠 |
| **Client Portal** (`/client/*`) | Multi-page CRUD-like | Single immersive "Il tuo Design Journey" con capitoli + voci | 🟠 |
| **Advisor Dashboard** (`/advisor`) | Stat-card layout | "I Journey che sto accompagnando", "le voci di oggi" | 🟡 |
| **Insights** (`/insights`) | Studio Pulse già editoriale | Aggiungere "Journey alive · le voci che hai ricevuto · i capitoli che hai scritto" | 🟢 |

---

## 6 · Required Refactor Order™ (sprint stack lockato)

> **PRINCIPIO**: ogni sprint successivo lascia il sistema funzionante. Niente big-bang.

### Sprint G.1 — Schema strengthening (foundation, invisible)
**Durata stimata**: 1 sessione · **Risk**: bassissimo · **Distruptive**: NO  
- Migration 063: `ALTER TABLE design_journeys ADD account_id UUID REFERENCES accounts(id)` + backfill da `projects.relationship_account_id` (best-effort).
- Migration 063: `ADD milestone_id UUID` opzionale su `moodboard_pages`, `material_assets`, `proposal_market_versions`, `curated_collections` + backfill euristico via `linked_entity_id` quando possibile.
- VIEW `journey_artifacts` che unifica tutti gli artifact per `journey_id` (lettura).
- Pytest regression: tutto rimane funzionante.

### Sprint G.2 — Lead intake → "Inizia il tuo Design Journey"
**Durata**: 1-2 sessioni · **Risk**: medio · **Distruptive**: solo public form  
- Refit `LeadFormPage` + `StartProjectWizard` → 3 step max: (1) "Come ti chiamiamo", (2) "Cosa stai sognando" (atmosphere + free voice), (3) "Come ti contattiamo".
- ZERO budget upfront. ZERO timing aggressivo. Eyebrow editoriale "Inizia il tuo Design Journey".
- Backend: `routers/leads.py` accetta nuovo schema "soft" + auto-crea Account + apre Journey con primo step "brief" `in_progress` + emette narrative event "Una conversazione ha inizio".
- Vocabolario nuovo: "**conversazione aperta**" non "lead pendente".

### Sprint G.3 — Account = Constellation of Journeys
**Durata**: 1 sessione · **Risk**: medio  
- Refit `CrmAccountsPage` e `AccountDetailPage` → vista primaria "I Journey aperti con [cliente]" come hero.
- Tabs: Journey (default) · Contatti · Voce del cliente (interactions) · Memoria.
- Niente più "lead pipeline funnel". L'Account vive come relazione.

### Sprint G.4 — Workspace Dashboard "Journey Pulse"
**Durata**: 1 sessione · **Risk**: basso  
- Refit `DashboardPage` → "I tuoi Journey vivi", "Le voci di oggi", "I capitoli da scrivere", "Le pietre miliari in attesa".
- Recupera dati da `journey_timeline_events` newest 7d + `journey_milestones.status=in_progress`.

### Sprint G.5 — Sidebar v5 (Journey-first navigation)
**Durata**: 1 sessione · **Risk**: medio (UX visibile)  
- Riorganizzazione finale (vedi sezione 7 sotto).
- Moodboards/Materials/Proposals/Documents NON sono più voci primarie, ma "Apri Journey → Step → Artifact".

### Sprint G.6 — Step-anchored artifact pages
**Durata**: 2 sessioni · **Risk**: medio  
- `MoodboardsPage`, `ProposalsPage`, `MaterialsPage` raggruppano per Journey con header italic Playfair "Per ·".
- Ogni artifact tile mostra Journey + Step come breadcrumb.

### Sprint G.7 — Client Portal Journey-first
**Durata**: 2 sessioni · **Risk**: medio  
- Refit `/client/*` → single immersive surface "Il tuo Design Journey" con capitoli + voci + memory.

### Sprint G.8 — Sprint F.C (Site Evolution™) — DA SBLOCCARE solo dopo G.1–G.6
- Timeline fotografica before/after del cantiere.

### Sprint G.9 — Sprint F.D (Presentation Continuity + Certified Closure ceremony)
- Crystallization finale del Journey.

### Sprint G.10 — Cultural Editions generation alla Closure
- Auto-generate Cultural Edition draft quando un Journey raggiunge Certified Closure.

### Sprint G.11 — Advisor "I miei Journey"
**Durata**: 1 sessione  
- Refit `AdvisorDashboardPage`.

### Sprint G.12 — Consolidamento collab.py dentro Milestone Dialogue™
**Durata**: 1-2 sessioni · **Risk**: alto (deprecation)  
- Migrare i comments di `collab.py` come Milestone Feedback (kind='request_detail' fallback).
- Deprecare endpoints `collab/comments`.

### Future / Backlog
- Brand Studio Extended Presentation (Brand Story/Manifesto)
- Memoria del Sentire™ (vista cross-journey delle voci ricorrenti per studio)

---

## 7 · Definitive Information Architecture™

### 7.1 — Sidebar v5 (Journey-first)

```
┌─ HOME
│   └─ Dashboard                          → "I tuoi Journey vivi"
│
├─ DESIGN JOURNEY™ (sezione dominante)
│   └─ I tuoi Journey                     → /workspace/projects (atelier list)
│       └─ Apri un Journey → Step → Artifact (Moodboard/Material/Proposal/Doc)
│
├─ CLIENT RELATIONS
│   ├─ Accounts                           → /crm/accounts (constellation di Journey)
│   ├─ Voci aperte                        → /crm/follow-ups (last narrative voices)
│   └─ Memoria                            → /crm/archived
│
├─ CURATORIAL ATLAS (sempre disponibile)
│   ├─ Inspirations™
│   ├─ Brand Mode™
│   ├─ Material View™
│   ├─ Media Library
│   └─ Cultural Editions™
│
├─ CONTENT STUDIO (admin)
│   ├─ Editorial Calendar
│   ├─ Magazine
│   ├─ Design Stories
│   ├─ Publishing Queue
│   ├─ Market Matrix
│   └─ Web Presence
│
├─ STUDIO OS
│   ├─ Team
│   ├─ Insights                           → Studio Pulse
│   ├─ Brand Studio
│   ├─ Forms & Journeys                   → public ingress editor
│   ├─ Integrations
│   ├─ Billing
│   └─ Settings
│
└─ ⛨ PLATFORM (super-admin)
    └─ Super Admin
```

**Rimossi dal sidebar primario**: Moodboards, Materials (singoli), Proposals, Documents, References. Vivono SOLO dentro il Journey → Step.

### 7.2 — Root Navigation (public)

- `/` — HomePage "Inizia il tuo Design Journey"
- `/projects` — Public portfolio (Design Stories)
- `/magazine` — Editorial
- `/professionals` — Professionals gateway
- `/start-journey` — NEW (rinomina da `/start-project`)
- `/form/:slug` — Public soft-intake form

### 7.3 — Journey Navigation (workspace, dentro un progetto)

```
/workspace/projects/:id
  └─ tab "Design Journey™" (DEFAULT, full-bleed, absorbing)
      ├─ Rail Steps (10 milestones)
      ├─ Focus Panel (active milestone)
      ├─ Inline panels (Brief, Site Evolution, Closure)
      ├─ Open Buttons → satellite (Moodboard/Material/Render/...)
      ├─ Evolution Timeline (narrative events)
      └─ Milestone Dialogue™ (chapters + client voice)
  └─ Tab "Overview" (project identity)
  └─ Tab "Conversazioni" (con il cliente — message thread)
  └─ Tab "Memoria" (timeline + rationale + audit narrative)
```

Tab da CONSOLIDARE: "Ispirazioni/Materiali/Proposte/Timeline" attualmente come tab → diventano "ambienti dello Step" raggiungibili da Open CTA.

### 7.4 — Contextual Navigation (satellite)

Dovunque vai in un satellite (Moodboard, Material, Document, Render), c'è sempre:
- **JourneyContextHeader™** in alto: `Stai attraversando · {progetto} → {step} · {status}`
- **Back to Journey** CTA sempre presente
- **Apri prossima pietra miliare** CTA opzionale

### 7.5 — Global vs Local tools

| Tool | Scope | Accessibile da |
|---|---|---|
| Inspirations / Brand Mode / Material View / Product Gallery | GLOBAL | Sidebar Curatorial Atlas + "Aggiungi al Journey X" inline |
| Cultural Editions | GLOBAL (output) | Sidebar Curatorial Atlas + auto-generate al Journey closure |
| Moodboard editor | LOCAL al Journey/Step | Solo via Journey → Open Moodboard Direction |
| Material picker | LOCAL al Journey/Step | Solo via Journey → Open Material Direction |
| Proposal composer | LOCAL al Journey/Step | Solo via Journey → Open Final Presentation |
| Insights (Studio Pulse) | GLOBAL | Sidebar Studio OS |
| Brand Studio | GLOBAL | Sidebar Studio OS |

---

## 8 · Journey States™

### 8.1 — Lifecycle states (Journey)

```
                  ┌──────────────────────┐
                  │   conversation_open  │  (Sprint G.2)
                  │   "Una voce arriva"   │
                  └──────────┬────────────┘
                             │
                             ▼
                  ┌────────────────────────┐
                  │       in_progress       │  (Sprint F.A)
                  │  "Il viaggio è iniziato"│
                  └──────────┬──────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌────────────┐ ┌────────────┐ ┌────────────┐
        │ on_pause   │ │ presenting │ │  drifting  │
        │ "in attesa │ │ "direzione │ │ "il cliente│
        │  del cliente│ │ presentata │ │  ha esitato│
        └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
                  ┌────────────────────────┐
                  │      approved           │
                  │  "direzione approvata"  │
                  └──────────┬──────────────┘
                             │
                             ▼
                  ┌────────────────────────┐
                  │   certified_closure     │  (Sprint F.D / G.9)
                  │   "il viaggio si è      │
                  │    concluso · capitolo  │
                  │    cristallizzato"      │
                  └──────────┬──────────────┘
                             │
                             ▼
                  ┌────────────────────────┐
                  │   cultural_editioned    │  (Sprint G.10)
                  │   "signature culturale" │
                  └─────────────────────────┘
```

### 8.2 — Milestone states (per Journey Step)

```
not_started ─▶ in_progress ─▶ presented ─▶ revision_requested ─▶ approved ─▶ closed
                                  │                  │
                                  └──▶ partially_approved
```

(Già implementato in Sprint F.A — vedere `STATUS_TRANSITIONS`.)

### 8.3 — Approval states (Version + Feedback)

Le approvazioni NON sono booleane "approve/reject". Sono **voci editoriali**:

| Tono | Significato | Effetto sul Milestone |
|---|---|---|
| `embrace` | Il cliente accoglie | suggerisce transizione → approved |
| `curious` | Vuole approfondire | resta in_progress, nuova version proposta |
| `reorient` | Vuole una direzione diversa | resta in_progress, milestone_revision_requested |
| `voice` | Voce libera narrativa | no transition, segna timeline |

### 8.4 — Drop-off states (analytics)

- `conversation_open` > 30gg senza voce → drift_warning
- `presented` > 14gg senza feedback → silence_alert
- `revision_requested` > 21gg senza version_proposed → reorient_overdue
- `approved` ma nessun avanzamento al prossimo step > 30gg → bridge_pause

Da implementare come query analytics (NON come state machine, no flag DB) per non rompere semantica viva.

### 8.5 — Analytics states (visibili nella UI)

- "I Journey vivi" → `overall_status = 'in_progress'`
- "Le voci ricevute oggi" → `journey_timeline_events WHERE event_type = 'client_voice' AND created_at >= today`
- "I capitoli da scrivere" → milestones con feedback `curious` ma nessuna version_proposed
- "Le pietre miliari in attesa di voce" → milestones in `presented` da > 7gg senza feedback
- "I viaggi chiusi" → `overall_status = 'closed'` (per studio reflection)

---

## 9 · Dependency Graph

```
                  ┌──────────────────────┐
                  │      Account         │
                  │      Contact         │
                  └──────────┬────────────┘
                             │
                  ┌──────────▼────────────┐
                  │      Journey          │
                  │   (1 per project)     │
                  └──────────┬────────────┘
                             │
                  ┌──────────▼────────────┐
                  │    Milestone (10)      │
                  └──────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  Artifact  │ │  Version   │ │ Feedback   │
       │ (moodboard,│ │ (chapter)  │ │  (voice)   │
       │  material, │ │             │ │             │
       │  proposal) │ │             │ │             │
       └────────────┘ └────────────┘ └────────────┘
                             │              │
                             └──────┬───────┘
                                    ▼
                  ┌──────────────────────────┐
                  │  Timeline Event           │
                  │  (narrative memory)       │
                  └──────────┬────────────────┘
                             │
                             ▼
                  ┌──────────────────────────┐
                  │  Studio Pulse / Insights  │
                  │  Cultural Edition (closure)│
                  └──────────────────────────┘
```

### Cross-references parallele (NON dipendenze gerarchiche)

- Artifacts possono **citare** Inspirations / Brands / Materials dal Curatorial Atlas.
- Artifacts possono **derivare** da Cultural Editions™.
- Journey events possono **riferire** Account interactions / voice notes.

---

## 10 · Output summary — sprint stack lockato

**Status**: 🔒 ARCHITETTURA BLOCCATA. Da qui in avanti ogni sprint inizia citando questo audit.

**Prossima azione consigliata**: **Sprint G.1 (Schema strengthening)**.  
Non visibile all'utente, sblocca tutti gli sprint successivi (G.2 in poi) con FK pulite.

**Alternativa**: **Sprint G.2 (Lead intake → Inizia il tuo Design Journey)**.  
Visibile, ad alto impatto narrativo, ma lavora su FK indirette finché G.1 non chiude.

**NON procedere con**: Sidebar v5, Dashboard v5, CRM refactor completo, Moodboard redesign, Sprint F.C (Site Evolution™), Sprint F.D (Closure), Cultural Editions auto-gen — finché G.1 / G.2 / G.3 non sono chiusi.

---

## Appendix A · File reference per ogni misalignment

| Misalignment | File principali |
|---|---|
| M1 (Lead form) | `/app/frontend/src/pages/public/LeadFormPage.jsx`, `/app/backend/routers/leads.py` |
| M2 (CRM funnel) | `/app/backend/routers/leads.py`, `/app/backend/routers/lead_assignments` (in human_assignment) |
| M3 (Standalone artifact lists) | `/app/frontend/src/pages/moodboards/MoodboardsPage.jsx`, `/app/frontend/src/pages/workspace/ProposalsPage.jsx`, `/app/frontend/src/pages/library/MaterialsPage.jsx` |
| M4 (Dashboard CRUD) | `/app/frontend/src/pages/dashboard/DashboardPage.jsx`, `/app/backend/routers/dashboard.py` |
| M5 (CRM tab) | `/app/frontend/src/pages/crm/AccountDetailPage.jsx`, `CrmAccountsPage.jsx` |
| M6 (Account FK) | `/app/supabase/migrations/061_design_journey.sql` |
| M7 (Artifact FK) | `/app/supabase/migrations/057_supplier_catalogs.sql`, `054_inspirations_foundation.sql` etc. |
| M8 (collab vs dialogue) | `/app/backend/routers/collab.py`, `/app/frontend/src/pages/collab/ReviewMode.jsx` |
| M9 (Client portal) | `/app/frontend/src/pages/client/*.jsx` |
| M10 (Advisor) | `/app/frontend/src/pages/advisor/AdvisorDashboardPage.jsx` |
| M11 (Cultural Editions) | `/app/backend/routers/cultural_editions.py`, `/app/supabase/migrations/053_cultural_edition_drafts.sql` |
| M12 (Insights) | `/app/frontend/src/pages/insights/InsightsPage.jsx`, `/app/backend/routers/insights.py` |

---

## Appendix B · Editorial vocabulary lock (immutable)

**OBBLIGATORIO** (sempre):
- Design Journey™, Journey, Capitolo, Voce del cliente, Voce libera, Conversazione progettuale
- Inizia il tuo Design Journey · Il viaggio è iniziato · Il viaggio si conclude
- Direzione iniziale/proposta/condivisa/finale · Evoluzione proposta/condivisa · Variante condivisa
- Atmosfera, materia, linguaggio progettuale, memoria viva, capitolo cristallizzato

**VIETATO** (sempre):
- task, sprint (in UI cliente), kanban, workflow, dashboard widget, ticket, todo, doing, done
- approve/reject button, V1/V2/V3, revision history, compare revisions, add comment
- change request, pending review, upload center, attachment center, audit log, file management, review queue
- lead, funnel, pipeline, deal, opportunity, close rate, win rate, conversion (in UI cliente — nel backend i nomi tecnici sono OK)
- Get a quote, Get started for free, Sign up to begin, Request demo
- HubSpot/Asana/Trello/Canva/Pinterest-like patterns

**SOSTITUZIONI**:
- "Lead" → "Conversazione aperta" / "Voce arrivata"
- "Convert lead" → "Apri il Journey"
- "Project pipeline" → "I Journey vivi"
- "Project stage" → "Capitolo del Journey"
- "Client" (in UI) → "Compagno di viaggio" o "il cliente" (lowercase, never marketing-y)

---

🔒 **End of audit. Architettura bloccata.**  
Aggiornare questo documento solo via ask_human + approvazione esplicita dell'utente.
