# CLIENT DESIGN JOURNEY™ · RECONSOLIDATION AUDIT
## ITER172 · Pre-implementation map · NO code changes

> **Status:** 🔒 AUDIT ONLY · 30 May 2026
> **Author:** E1 · Composed strictly from filesystem inventory + memory docs
> **Scope:** mappare 100% di ciò che esiste, individuare ridondanze, definire
> il percorso di consolidamento minimo. **Zero proposte di nuove feature**.

---

## §0 · TL;DR

Esistono oggi **3 esperienze parallele del Client Design Journey™**, costruite in 3 iterazioni successive senza demolire le precedenti:

| Generazione | Iter | Route | Pagina | Layout | Stato |
|---|---|---|---|---|---|
| **Gen 1** | iter ~120 | `/client/overview-legacy` | `ClientOverviewPage.jsx` | Zero-data + project hero | LEGACY, accessibile solo per QA |
| **Gen 2** | Sprint G.7 (iter ~155) | `/client/journey/:jid` + `/journey/:jid` | `ClientCompanionPage.jsx` | 7 sezioni narrative full-height | LIVE, montata su 2 route |
| **Gen 3** | iter 162 | `/client/welcome` (+ `/client` redirect) | `ClientWelcomePresetPage.jsx` → `AtelierWelcomePanel` | three-column preset engine | LIVE, default per `role=client` post-magic-link |

Tutte e 3 leggono parzialmente gli **stessi endpoint backend** (`welcome-summary`, `overview`, `companion`), ma renderizzano viste **diverse**, **non interscambiabili**, **non navigabili dall'una all'altra**.

La spec del prompt **"Welcome Workspace V1"** che hai appena fornito è **già al 90% l'AtelierWelcomePanel di Gen 3**, mancano solo:

1. Brief Guidato come superficie navigabile autonoma (`/journey/:jid/brief`)
2. Composer messaggi inline ("Scrivi al referente")
3. Sezione "Riassunto prime indicazioni" in formato puro testo (oggi è card con Atmospheric Panel image)
4. Visione unica: oggi il cliente atterra su `/client/welcome` (Gen 3) ma `/journey/:jid` resta visibile e mostra Gen 2 → confusione

**Decisione architetturale richiesta**: scegliere quale Generazione promuovere a V1 e archiviare le altre 2 (filosofia FROZEN già adottata per Advisor Network).

---

## §1 · INVENTARIO

### 1.1 · Pagine (frontend/src/pages/)

| File | Linee | Mounted at | Generazione | Note |
|---|---|---|---|---|
| `client/ClientOverviewPage.jsx` | 258 | `/client/overview-legacy` | Gen 1 | Zero-data + project hero + ProjectProgressTracker. Ancora richiamato per QA. |
| `client/ClientCompanionPage.jsx` | 544 | `/client/journey/:jid` **e** `/journey/:jid` (via `CanonicalClientJourney`) | Gen 2 | 7 sezioni narrative anchor-based (capitolo · direzioni · conversazioni · evoluzione · materia · cantiere · memoria). |
| `client/ClientWelcomePresetPage.jsx` | 79 | `/client/welcome` | Gen 3 | Wrapper sottile che risolve il preset (sempre `atelier`) e renderizza `AtelierWelcomePanel`. |
| `client/ClientJourneysIndexPage.jsx` | 239 | `/client/journeys` | Gen 2.5 | Lista journey multipli per stesso cliente. |
| `client/ClientMessagesPage.jsx` | 25 | `/client/messages` | Gen 2.5 | Wrapper minimo per messaging cliente. |
| `client/ClientStubPages.jsx` | 99 | non-mounted (legacy stubs) | Gen 1 | Premium "coming soon" stubs. |
| `site/JourneyWelcomePage.jsx` | – | `/journey/welcome/:token` | Sprint G.2 | Read-only welcome **pubblico** mostrato subito dopo Begin Journey via token (no auth). |
| `journey/JourneyPreparingPage.jsx` | – | `/journey/preparing` | iter166 | Transitional cinematic post-3-step ("Stiamo preparando il tuo spazio…"). |

### 1.2 · Componenti `frontend/src/components/client/`

| Componente | Usato da | Generazione | Riusabile in V1? |
|---|---|---|---|
| `ClientDashboardLayout.jsx` (117) | wrapper `/client/*` | Gen 2 | ✅ semplificabile |
| `ClientSidebar.jsx` (145) | `ClientDashboardLayout` | Gen 2 | ⚠️ 7 voci `#anchor` legate a `ClientCompanionPage` — da rivedere |
| `ClientUserMenu.jsx` (363) | header layout | Gen 2 | ✅ |
| `ClientWelcomeHero.jsx` (112) | `ClientOverviewPage` Gen 1 | Gen 1 | 🟡 superato da `AtelierHero` |
| `ClientWelcomePanel.jsx` (212) | nessuno (orphan, "old preset") | Gen 1.5 | 🔴 dead code |
| `ClientHumanCard.jsx` (206) | `ClientOverviewPage` Gen 1 | Gen 1 | 🟡 superato da `AtelierReferenceCard` |
| `CuratorialTeamCluster.jsx` (238) | nessuno (orphan) | Gen 1 | 🔴 dead code |
| `CreatePasswordPanel.jsx` (262) | optional, password setup post-magic-link | Gen 2 | ✅ |
| `DossierSection.jsx` (353) | `ClientCompanionPage` | Gen 2 | 🟡 narrative-only |
| `HowItWorksSection.jsx` (86) | `ClientOverviewPage` Gen 1 | Gen 1 | 🟡 superato |
| `MessageReferentModal.jsx` (146) | ovunque | Gen 2 | ✅ **chiave per V1** |
| `ProjectProgressTracker.jsx` (195) | `ClientOverviewPage` Gen 1 | Gen 1 | 🟡 superato da `AtelierTimeline` |
| `RecallRequestModal.jsx` (203) | `AtelierActionPanel`, `ClientCompanionPage` | Gen 2+3 | ✅ **chiave per V1** |
| `SharedVoiceComposer.jsx` (140) | `ClientCompanionPage` (capitolo) | Gen 2 | ✅ riutilizzabile come "voce libera" |
| `SiteEvolutionSection.jsx` (138) | `ClientCompanionPage` | Gen 2 | 🟡 narrative-only |
| `WhatYouWillFindSection.jsx` (66) | `ClientOverviewPage` Gen 1 | Gen 1 | 🟡 superato |

### 1.3 · Preset Engine (`frontend/src/presets/client-profile/`)

| File | Ruolo | Stato |
|---|---|---|
| `presetEngine.js` | risoluzione preset (oggi sempre `atelier`, infra pronta per `axis`/`gallery`/`residence`) | ✅ |
| `atelier/AtelierWelcomePanel.jsx` | **layout three-column COMPLETO**: sidebar narrativa + hero + quote + quickSummary + referenceCard + actionPanel + timeline + nextStep + passwordPrompt floating | ✅ **questo è il candidato V1** |
| `atelier/AtelierSidebar.jsx` | sidebar narrativa (sx) | ✅ |
| `atelier/AtelierHero.jsx` | hero con cover + quote | ✅ |
| `atelier/AtelierQuickSummary.jsx` | 4 card riassunto (atmosfera/lifestyle/materiali/priorità) — usa Atmospheric Panels images | ✅ ⚠️ con foto stock |
| `atelier/AtelierReferenceCard.jsx` | card referente (dx) | ✅ |
| `atelier/AtelierActionPanel.jsx` | 3 CTA principali (Brief · Recall · Messaggi) | ✅ |
| `atelier/AtelierTimeline.jsx` | timeline cinematic (bottom) | ✅ |
| `atelier/AtelierNextStep.jsx` | prossimo capitolo | ✅ |
| `atelier/AtelierPasswordPrompt.jsx` | discreet floating bottom-right | ✅ |
| `atelier/AtelierNotifications.jsx` | topbar bell | ✅ |
| `atelier/AtelierUserMenu.jsx` | topbar avatar | ✅ |
| `atelier/atelierViewModel.js` | **funzione pura** che mappa response `/welcome-summary` → view model + dummy editoriale | ✅ |
| `atelier/atelier.css` | – | ✅ |

> ⚠️ Sub-component non scaffoldati per gli altri preset (`axis`, `gallery`, `residence`): fall back ad atelier. Coerente con la regola "1 preset fatto bene".

### 1.4 · Atmospheric Panels (immagini editoriali)

| File | Scope |
|---|---|
| `components/chameleon/AtmosphericPanels.jsx` + CSS | Componente standalone usato in `AtelierQuickSummary` per renderizzare le 4 card con texture editoriali (luce/ombra/materia, no persone). |
| `pages/AtmosphericPreviewPage.jsx` | Preview admin per testare i panel. |
| `pages/relations/AtmosphereShiftCard.jsx` | Diversa cosa: card "atmosphere shift" per CRM, non per cliente. |
| `styles/mood-atmosphere.css` | Token grafici. |

### 1.5 · Routes coinvolte (`App.js`)

```
/journey/welcome/:token       JourneyWelcomePage         (pubblica, post-Begin Journey, no auth)
/journey/preparing            JourneyPreparingPage       (transitional, post-3-step)
/journey/access               AccessEntryPage            (resend magic link)
/journey/:journeyId           CanonicalClientJourney     → ClientCompanionPage (Gen 2)
/journey/:projectId/step/:m   LegacyStepRedirect         (studio-side workspace)
/journey/render/hotspots/...  ComingSoonPage             (stub)
/client/welcome               ClientWelcomePresetPage    (Gen 3, default per client)
/client                       Redirect → /client/welcome
/client/journeys              ClientJourneysIndexPage    (lista multi-journey)
/client/journey/:jid          ClientCompanionPage        (Gen 2, alias di /journey/:jid)
/client/messages              ClientMessagesPage
/client/overview-legacy       ClientOverviewPage         (Gen 1, QA only)
/client/{project,moodboards,timeline,approvals,files}  redirect → /client o /client#anchor
```

### 1.6 · Modali / overlay

| Modale | File | Usato da |
|---|---|---|
| `RecallRequestModal` ("Possiamo sentirci…") | `components/client/RecallRequestModal.jsx` | Gen 2 + Gen 3 |
| `MessageReferentModal` ("Scrivi al referente") | `components/client/MessageReferentModal.jsx` | Gen 2 |
| `AtelierPasswordPrompt` (set password) | `presets/.../AtelierPasswordPrompt.jsx` | Gen 3 |
| `CallBookingModal` (alternativa Gen 1) | `components/booking/CallBookingModal.jsx` | Gen 1 only |
| `WelcomeDrawer` (CRM-side, not client) | `pages/relations/WelcomeDrawer.jsx` | NOT client |
| `GuidedTourWelcome` (onboarding studio) | `components/onboarding/GuidedTourWelcome.jsx` | NOT client |

### 1.7 · Endpoint backend (per il Client)

| Endpoint | Router | Cosa restituisce |
|---|---|---|
| `GET /api/client/welcome-summary` | `client_portal.py:86` | nome cliente, studio, referente, summary brief, atmosphere/lifestyle/materials/priority, journey_id, next_step |
| `GET /api/client/overview` | `client_portal.py:191` | project + counts + zero_data flag |
| `GET /api/client/projects` | `client_portal.py:282` | progetti del cliente |
| `GET /api/client/moodboards` | `client_portal.py:310` | moodboards |
| `GET /api/client/approvals` | `client_portal.py:351` | approval requests pending |
| `GET /api/client/journeys` | `client_portal.py:436` | tutti i journey del cliente |
| `GET /api/client/journeys/{jid}/companion` | `client_portal.py:528` | dati per le 7 sezioni Gen 2 (capitolo, direzioni, conversazioni, ecc.) |
| `POST /api/client/journeys/{jid}/voice` | `client_portal.py:767` | scrive voce libera (SharedVoiceComposer) |
| `GET /api/client/messages/thread` | `client_messages.py:78` | thread con il referente |
| `POST /api/client/messages/send` | `client_messages.py:138` | invia messaggio |
| `POST /api/client/messages/{id}/read` | `client_messages.py:213` | mark as read |
| `POST /api/client/recall-requests` | `recall_requests.py:40` | "possiamo sentirci?" |
| `GET /api/client/recall-requests/mine` | `recall_requests.py:191` | recall richiesti |
| `GET /api/journeys/mine` | `journeys.py:583` | resolver journey primario + rebind logic (ITER171) |
| `GET /api/journeys/{jid}/overview` | `journeys.py` | journey overview KPI |
| `GET /api/client/profile-config` | `client_profile_config.py` | placeholders + tenant overrides per il preset |

> ✅ **Tutti gli endpoint necessari esistono.** Niente da scrivere lato backend per la V1.

### 1.8 · Documenti di memoria rilevanti

| Doc | Rilevanza |
|---|---|
| `G1_SEMANTIC_ARCHITECTURE_LOCK.md` | Architettura semantica Journey (LOCKED) |
| `G2_BEGIN_JOURNEY_SPEC.md` | Spec del flusso anonimo `/begin-journey` |
| `JOURNEY_ALIGNMENT_AUDIT.md` | Principio root: tutto orbita attorno al Journey |
| `ITER168_DJ_OPERATIONAL_REFACTOR.md` | Refactor canonico URL → `/journey/:jid` & `/studio/journey/:jid` |
| `PRD.md` | "Phase 3 ITER168 — Welcome Workspace™" (pending) |

---

## §2 · CONFRONTO

| Elemento | Esiste già | Da riutilizzare per V1 | Da archiviare (FROZEN) | Da eliminare |
|---|---|---|---|---|
| **Layout three-column atelier** | ✅ `AtelierWelcomePanel` | ✅ **base canonica V1** | – | – |
| **Header "Studio · Brief in corso"** | ✅ `AtelierHero` + `atelier-topbar` | ✅ | – | – |
| **Timeline "Il tuo percorso"** | ✅ `AtelierTimeline` (Gen 3) + `ProjectProgressTracker` (Gen 1) | ✅ `AtelierTimeline` | ⚪ `ProjectProgressTracker` | – |
| **Referente card** | ✅ `AtelierReferenceCard` (Gen 3) + `ClientHumanCard` (Gen 1) + sezione narrativa Companion | ✅ `AtelierReferenceCard` | ⚪ `ClientHumanCard` | – |
| **3 CTA principali (Brief · Call · Msg)** | ✅ `AtelierActionPanel` | ✅ | – | – |
| **Recall Modal** | ✅ `RecallRequestModal` | ✅ | – | – |
| **Messaggio al referente** | ✅ `MessageReferentModal` | ✅ | – | – |
| **Riassunto prime indicazioni** | ✅ `AtelierQuickSummary` (con AtmosphericPanels stock images) | ✅ ⚠️ rimuovere foto stock obbligatorie come da spec | – | – |
| **Atmospheric Panels images** | ✅ `chameleon/AtmosphericPanels.jsx` | ⚠️ rendere opzionali / fallback testuale | – | – |
| **Brief Guidato (superficie)** | ❌ **NON ESISTE come pagina dedicata** | – | – | – ⚠️ **GAP REALE** |
| **7 sezioni narrative companion** | ✅ `ClientCompanionPage` (capitolo · direzioni · conversazioni · evoluzione · materia · cantiere · memoria) | ⚠️ **conflitto V1** (sostituite da AtelierWelcomePanel) | ⚪ archiviare in `ClientCompanionPage.legacy.jsx` | – |
| **`ClientWelcomePanel` (orphan Gen 1.5)** | ✅ ma 0 riferimenti | – | – | 🔴 **dead code** |
| **`CuratorialTeamCluster` (orphan)** | ✅ ma 0 riferimenti | – | – | 🔴 **dead code** |
| **`ClientWelcomeHero` (Gen 1)** | ✅ usato solo da `ClientOverviewPage` Gen 1 | – | ⚪ con `ClientOverviewPage` | – |
| **`ClientOverviewPage` (Gen 1)** | ✅ mounted su `/client/overview-legacy` | – | ⚪ archiviare | – |
| **`ClientStubPages` (premium coming soon)** | ✅ ma 0 route mounted | – | – | 🔴 **dead code** (ITER168 ha rimosso le route) |
| **`HowItWorksSection` + `WhatYouWillFindSection`** | ✅ usate solo da Gen 1 | – | ⚪ archiviare con Gen 1 | – |
| **Sidebar `ClientSidebar` (7 anchor)** | ✅ usata da `ClientDashboardLayout` | ⚠️ **rivedere**: i 7 anchor puntano alla narrativa Gen 2 | ⚪ sostituire con sidebar minimale 3 voci (Panoramica · Brief · Messaggi) | – |
| **`SharedVoiceComposer`** | ✅ usato in Companion Gen 2 | ✅ riutilizzabile come "voce libera" sotto AtelierActionPanel | – | – |
| **`DossierSection` + `SiteEvolutionSection`** | ✅ narrativa Gen 2 | ⚠️ relegare a Phase 2 / Future Backlog | – | – |
| **`CreatePasswordPanel`** | ✅ | – | – | duplicato di `AtelierPasswordPrompt`; ⚪ archiviare la versione legacy |
| **`CallBookingModal` (Gen 1)** | ✅ usato solo da `ClientOverviewPage` Gen 1 | – | – | 🔴 superato da `RecallRequestModal` |

---

## §3 · GAP

### 3.1 · Cosa manca **davvero**

| # | Gap | Severity | Azione |
|---|---|---|---|
| **G1** | **Brief Guidato** come superficie navigabile (`/journey/:jid/brief`) — multi-step form: ambienti · budget · tempi · priorità · vincoli · foto/planimetrie · note libere | 🔴 P0 | Costruire **una sola pagina** dedicata. Backend già pronto: `journey_milestones[milestone_type='brief']` + `milestone_versions`. |
| **G2** | **CTA "Continua il brief guidato"** in `AtelierActionPanel` oggi punta a CTA generica — manca destinazione concreta | 🔴 P0 | Wiring: `AtelierActionPanel` CTA brief → `/journey/:jid/brief`. |
| **G3** | **Sezione "Riassunto prime indicazioni" in puro testo** (spec esplicita "niente foto stock obbligatorie") | 🟠 P1 | Modificare `AtelierQuickSummary` per supportare modalità `text-only` (atmosfera/lifestyle/materiali/priorità/note) con immagini opzionali. |
| **G4** | **Composer "Scrivi al referente" inline** (oggi è modale, ok, ma manca lo stato "ha già scritto / sta aspettando risposta") | 🟡 P2 | Espandere `MessageReferentModal` con badge unread / preview ultimo messaggio. |
| **G5** | **Visione unica del Client Journey** — oggi `/client/welcome` (Gen 3) e `/journey/:jid` (Gen 2) sono entrambi visibili e mostrano UI diverse | 🔴 P0 | **Promuovere AtelierWelcomePanel** anche su `/journey/:jid` (`CanonicalClientJourney`) → un'unica vista canonica. |

### 3.2 · Cosa è **ridondante**

| # | Ridondanza | Effetto sull'utente |
|---|---|---|
| **R1** | 3 implementazioni di "Welcome": `ClientOverviewPage` (Gen 1) · `ClientCompanionPage` (Gen 2) · `AtelierWelcomePanel` (Gen 3) | Tre stili visuali diversi su tre URL diversi per la stessa funzione |
| **R2** | 2 implementazioni di Timeline: `ProjectProgressTracker` (Gen 1) vs `AtelierTimeline` (Gen 3) | – |
| **R3** | 2 implementazioni di Referente card: `ClientHumanCard` (Gen 1) vs `AtelierReferenceCard` (Gen 3) | – |
| **R4** | 2 implementazioni di Password setup: `CreatePasswordPanel` (Gen 2) vs `AtelierPasswordPrompt` (Gen 3) | – |
| **R5** | 2 modali "Call me back": `CallBookingModal` (Gen 1) vs `RecallRequestModal` (Gen 2+3) | – |
| **R6** | 2 sidebar nav: `ClientSidebar` con 7 anchor narrativi (Gen 2) vs sidebar atelier embedded (Gen 3) | Reset visivo navigando tra route |
| **R7** | Endpoint `GET /api/client/overview` (Gen 1) e `GET /api/client/welcome-summary` (Gen 3) restituiscono dati sovrapposti per due UI diverse | – |

### 3.3 · Cosa è stato costruito **2 o 3 volte**

| Cosa | Volte | Versioni |
|---|---|---|
| Welcome cliente | **3×** | `ClientOverviewPage` · `ClientCompanionPage` · `AtelierWelcomePanel` |
| Timeline | **2×** | `ProjectProgressTracker` · `AtelierTimeline` |
| Referente | **3×** | `ClientHumanCard` · `ClientCompanionPage>Conversations` · `AtelierReferenceCard` |
| Password setup post-magic-link | **2×** | `CreatePasswordPanel` · `AtelierPasswordPrompt` |
| Call me back | **2×** | `CallBookingModal` · `RecallRequestModal` |
| Sidebar | **2×** | `ClientSidebar` (Gen 2) · atelier embedded (Gen 3) |
| Voce libera del cliente | **2×** | `SharedVoiceComposer` · `MessageReferentModal` |
| Welcome post-Begin-Journey | **2×** | `JourneyWelcomePage` (pubblica, via welcome_token) · `AtelierWelcomePanel` (privata, via magic link) |

---

## §4 · VISIONE UNIFICATA · CLIENT DESIGN JOURNEY™ V1

### Principio
> **Promuovere Gen 3 (Atelier) come unica esperienza canonica.**
> Archiviare Gen 1 e Gen 2 con la filosofia FROZEN già usata per Advisor Network™ (source preservato, route disabilitate, marker `ITER172 · FROZEN`).

### Strutture canoniche V1

#### Surface 1 · **Welcome Workspace V1**
- **URL**: `/journey/:jid` (e `/client/welcome` come alias)
- **Render**: `AtelierWelcomePanel` (esistente)
- **Slot V1** (in ordine spaziale):
  | Slot | Componente | Sorgente dati |
  |---|---|---|
  | Topbar | `AtelierNotifications` + `AtelierUserMenu` | `welcome-summary` |
  | SX sidebar narrativa | `AtelierSidebar` | `welcome-summary` |
  | Hero centrale | `AtelierHero` con copy "Benvenuto nel tuo Design Journey™" | `welcome-summary` |
  | Quote | embed in `AtelierHero` | dummy editoriale |
  | Riassunto Prime indicazioni | `AtelierQuickSummary` con prop `mode="text-only"` ⚠️ **modifica G3** | `welcome-summary.atmosphere/lifestyle/etc` |
  | DX colonna · Referente | `AtelierReferenceCard` | `welcome-summary.referente` |
  | DX colonna · 3 CTA | `AtelierActionPanel` con CTA brief→`/journey/:jid/brief` ⚠️ **wiring G2** | – |
  | Timeline (bottom) | `AtelierTimeline` | `welcome-summary.next_step` + `journey/{jid}/companion` |
  | Next step (bottom) | `AtelierNextStep` | `welcome-summary.next_step` |
  | Floating | `AtelierPasswordPrompt` | tenant config |

#### Surface 2 · **Brief Guidato** ⚠️ **NEW PAGE (gap G1)**
- **URL**: `/journey/:jid/brief`
- **Componente da costruire**: `BriefGuidedPage.jsx` (single page, multi-step orizzontale)
- **Step**: ambienti · budget · tempi · priorità · vincoli · upload (foto/planimetrie/ispirazioni) · note libere
- **Backend**: usa già `journey_milestones[milestone_type='brief']` + `milestone_versions`. **No nuove migration**.
- **CTA esci**: torna a `/journey/:jid` con toast "Brief aggiornato".

#### Surface 3 · **Messages thread**
- **URL**: `/journey/:jid/messages` (oggi: `/client/messages`)
- **Componente**: riusare `ClientMessagesPage` + `MessageReferentModal` come composer
- **Backend**: già `/api/client/messages/*`

### Cosa NON costruire
- **No** nuove route oltre `/journey/:jid/brief`.
- **No** nuovi endpoint backend.
- **No** nuovi preset (axis/gallery/residence restano stub).
- **No** ridisegno componenti Atelier esistenti.
- **No** Chameleon AI / Atmospheric polish / Relationship Signals.
- **No** site-evolution / cantiere / dossier (relegati a Phase 2).

### Cosa archiviare (FROZEN, non eliminare)
1. `pages/client/ClientCompanionPage.jsx` → mantenuto sul filesystem, route `/client/journey/:jid` ridirige a `/journey/:jid`.
2. `pages/client/ClientOverviewPage.jsx` + Gen 1 components (`ClientWelcomeHero`, `ClientHumanCard`, `HowItWorksSection`, `WhatYouWillFindSection`, `ProjectProgressTracker`, `CallBookingModal`) → route `/client/overview-legacy` rimossa, source preservato.
3. `components/client/ClientWelcomePanel.jsx` + `CuratorialTeamCluster.jsx` + `ClientStubPages.jsx` → file conservati con marker `ITER172 · FROZEN orphan`.
4. `ClientSidebar` 7-anchor narrative → sostituita con `AtelierSidebar` per coerenza, file conservato.
5. `SharedVoiceComposer` + `DossierSection` + `SiteEvolutionSection` → preservati per Phase 2.

### Cosa eliminare definitivamente
- **Nulla**. Filosofia FROZEN: tutto si archivia, niente si elimina. Recuperabile.

---

## §5 · PERCORSO MINIMO DI CONSOLIDAMENTO

> Ordine consigliato. Ogni step è indipendente, testabile, reversibile.

| Step | Azione | File toccati | Backend | Tipo |
|---|---|---|---|---|
| **1** | Promuovere `AtelierWelcomePanel` su `/journey/:jid`: modificare `CanonicalClientJourney` in `JourneyCanonicalRoutes.jsx` da render `ClientCompanionPage` → render `ClientWelcomePresetPage` | 1 | – | wiring |
| **2** | Aggiungere route `/journey/:jid/brief` puntante a nuovo `BriefGuidedPage.jsx` | 1 | – | new page |
| **3** | Costruire `BriefGuidedPage.jsx` multi-step (P0 reale) | 1 nuovo | usa endpoint esistenti | new feature |
| **4** | `AtelierActionPanel` CTA primaria → wired a `/journey/:jid/brief` (oggi probabilmente generica) | 1 | – | wiring |
| **5** | `AtelierQuickSummary` aggiungere prop `mode="text-only"` con fallback senza immagini stock (G3) | 1 | – | enhancement |
| **6** | Redirect `/client/journey/:jid` → `/journey/:jid` (route alias, no duplicate UI) | App.js | – | wiring |
| **7** | Archiviare `ClientCompanionPage` con marker FROZEN | 1 (commento) | – | freeze |
| **8** | Archiviare `/client/overview-legacy` (rimuovere route) + marker FROZEN | App.js | – | freeze |
| **9** | Rimuovere dead orphan: `ClientWelcomePanel`, `CuratorialTeamCluster`, `ClientStubPages` (marker FROZEN, file conservati) | 3 | – | freeze |
| **10** | Smoke E2E: magic link → /journey/:jid → Atelier panel → click "Continua brief" → /journey/:jid/brief → submit → torna a panel | – | – | test |

**Estimate complessivo**: 1 nuova pagina + ~6 wiring + ~5 freeze marker. Zero migration DB, zero nuovi endpoint.

---

## §6 · SUCCESS CRITERIA (originali, verificati)

| # | Criterio dall'audit | Verifica |
|---|---|---|
| 1 | UX approvata originariamente | **Gen 3 / Atelier preset** (iter162, mai stata revocata) — vedi `AtelierWelcomePanel` + `presetEngine` |
| 2 | Parti già sviluppate | **~90%** della spec V1 esiste in `presets/client-profile/atelier/*` + endpoint `welcome-summary` + `RecallRequestModal` + `MessageReferentModal` |
| 3 | Parti duplicate | **7 ridondanze** identificate (§3.3) tra Gen 1 / Gen 2 / Gen 3 |
| 4 | Percorso minimo | **10 step** in §5 · ~1 settimana di lavoro · zero refactor profondo · zero nuove migrazioni |

---

## §7 · DECISIONI APERTE (richiedono OK Founder)

| # | Decisione | Opzioni |
|---|---|---|
| **D1** | Quale generazione promuovere a V1? | **(a) Gen 3 Atelier** ← raccomandazione `recommended`. (b) Mantenere Gen 2 narrativa. (c) Ricostruire da zero ← sconsigliato, distrugge 90% lavoro fatto. |
| **D2** | `/client/welcome` resta come URL pubblico oppure tutto migra a `/journey/:jid`? | **(a) Solo `/journey/:jid`** canonico (`/client/welcome` redirige). (b) Coesistono. |
| **D3** | Atmospheric Panels images: rimuovere completamente, rendere opzionali, o sostituire con illustrazioni proprietarie? | **(a) Opzionali con fallback text-only** ← raccomandazione. (b) Rimuovere. (c) Sostituire con asset proprietari (richiede design pass separato). |
| **D4** | Brief Guidato: pagina dedicata `/journey/:jid/brief` o drawer inline dentro AtelierWelcomePanel? | **(a) Pagina dedicata** ← coerente con spec utente. (b) Drawer. |

---

## §8 · ALLEGATI

- **Inventory completo file**: §1
- **Tabella confronto**: §2
- **Mappa dipendenze backend**: §1.7
- **Lista i18n keys**: search `client.atelier.*` e `client.companion.*` (cumulativi ~80 stringhe, tutte in `it-IT.json` e `en-US.json`).
- **Test_credentials**: `/app/memory/test_credentials.md` (56 righe, contiene `client@moodfordesign.com` per QA).

---

> ⚠️ Filosofia **PRIMA CONSOLIDARE, POI IMPLEMENTARE**: l'audit conferma che il V1 può essere consegnato consolidando + colmando un solo gap reale (Brief Guidato). Nessuna nuova architettura, nessuna nuova feature.
