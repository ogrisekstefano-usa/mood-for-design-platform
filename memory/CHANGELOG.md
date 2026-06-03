# Changelog

## ITER188 · Journey Mail™ Live Validation — 2026-06-02

**Stato:** 🟡 CONDITIONAL GO · Validation-only sprint · 0 modifiche al codice applicativo

### Risultati per test (8/10 PASS · 0 FAIL · 2 deferred)
- ✅ T1 IMAP connection · T2 Read-Only Guarantee (code audit + runtime audit) · T3 message import · T5 manual linking · T6 SMTP send · T7 Sent folder APPEND · T9 error handling · T10 Design Journey integration
- ⏸️ T2.c (live inbound unread proof) · T4 (attachments) · T8 (multi-mailbox isolation) — richiedono azione Founder

### Bug trovati
- 🐞 **P1** · Bucket `mailbox-bodies` mancante in Supabase Storage → bodies email non uploadate (snippet OK, full body NO). Fix in ITER189-pre.
- 🐞 P2 · `/api/relations/leads` POST 405 (CRM, fuori scope)

### Deliverable
- `/app/memory/ITER188_JOURNEY_MAIL_LIVE_VALIDATION_REPORT.md` (18 sezioni)
- 6 script in `/app/scripts/iter188_*.py` (riusabili per regression future)
- Screenshot `/tmp/dj_comm_iter188.png` (T10 proof: Design Journey · Communications tab con 1 email collegata)

### Mailbox sotto test
- `me@moodfordesign.com` · SiteGround · `gnldm1105.siteground.biz` · 7 folder discovered · IMAP + SMTP healthy

### Next blockers per FULL GO
1. Founder invia un'email reale da `slabreality@gmail.com` (o altro) a `me@moodfordesign.com`, la lascia non letta, conferma screenshot SiteGround.
2. Founder conferma ricezione su `slabreality@gmail.com` del send Blueprint (T6 final mile).
3. ITER189-pre: hotfix bucket `mailbox-bodies` (create + reset cursors + re-sync).



## ITER187.B · Journey Mail Workspace™ — UI Phase 1 · 2026-06-02

**Stato:** ✅ Completato · Frontend solo · backend ITER187.A invariato (25/25 test passano)

### Consegnato
- **Sidebar** · nuova sezione `Communications · Mail` (migration 121 in `feature_modules_registry`)
- **Routes** registrate in `App.js` (lazy-loaded):
  - `/communications/mail/mailboxes` · MailboxesPage (card grid + drawer)
  - `/communications/mail/messages` · MessagesListPage (tabella operativa 6 colonne)
  - `/communications/mail/messages/:id` · MessageDetailPage (iframe `sandbox=""` per body, association panel)
  - `/communications/mail/compose` · ComposePage (composer minimale — textarea, NO Tiptap, per direttiva Founder A2)
- **Mailbox card metrics** (su richiesta Founder): Health · Last Successful Sync · Total Messages · Linked Emails
- **Sync polling** · intervallo 10s, max 3 poll (30s totali) — come da Founder Gate §6
- **Entity Linking™** · `MessageAssociationsPanel` + `EntityPicker` per Lead / Prospect / Customer / Design Journey (manuale, no AI, no auto-association)
- **Design Journey integration** · nuovo tab `Communications` in `ProjectDetailPage.jsx` con lista email collegate al journey (testid `tab-communications`, `dj-comm-tab-emails`, `dj-comm-empty`)
- **Empty states** · copy operativa italiana, no marketing fluff
- **XSS protection** · body email renderizzato in `<iframe sandbox="">` (strict, nessun allow-scripts)

### File nuovi
- `/app/frontend/src/lib/journeyMailApi.js` (13 endpoint wrapper)
- `/app/frontend/src/pages/communications/mail/MailWorkspaceLayout.jsx`
- `/app/frontend/src/pages/communications/mail/MailboxesPage.jsx`
- `/app/frontend/src/pages/communications/mail/MailboxCard.jsx`
- `/app/frontend/src/pages/communications/mail/MailboxStatusBadge.jsx`
- `/app/frontend/src/pages/communications/mail/MailboxFormDrawer.jsx`
- `/app/frontend/src/pages/communications/mail/MessagesListPage.jsx`
- `/app/frontend/src/pages/communications/mail/MessageDetailPage.jsx`
- `/app/frontend/src/pages/communications/mail/MessageAssociationsPanel.jsx`
- `/app/frontend/src/pages/communications/mail/EntityPicker.jsx`
- `/app/frontend/src/pages/communications/mail/ComposePage.jsx`
- `/app/frontend/src/pages/communications/mail/communications-mail.css`
- `/app/supabase/migrations/121_iter187b_journey_mail_module.sql` (applicata)
- `/app/scripts/apply_migration_121.py`

### File modificati
- `/app/frontend/src/App.js` — registrate le 5 route `/communications/mail/*`
- `/app/frontend/src/pages/workspace/ProjectDetailPage.jsx` — aggiunto tab Communications + componente `CommunicationsEmailsTab`
- `/app/frontend/src/routes/JourneyCanonicalRoutes.jsx` — fix pre-esistente: `ProjectToJourneyRedirect` ora rende `ProjectDetailPage` direttamente quando `?_legacy=1` (prima: redirect loop)

### Bug fixati
- 🐛 **"Link Mail in sidebar non funziona"** · Causa: route non registrate in `App.js`. FIX: lazy import + 5 route registrate sotto `DashboardLayout`. Sidebar nav-mail già presente via migration 121.
- 🐛 (pre-esistente) Redirect loop su `/workspace/projects/:id?_legacy=1` quando un progetto non ha journey collegato — risolto.

### Testing
- Frontend E2E via `testing_agent_v3_fork` (iteration_196) · 82% prima della seconda iterazione di fix → fix applicati: aggiunti data-testid mancanti su tutti i field IMAP/SMTP del drawer, esposto `dj-comm-tab-emails` anche nello stato empty.
- Lint ESLint pulito su tutti i nuovi file e file modificati.
- Backend non re-testato (nessuna modifica).

### Founder Lock rispettati
- ✅ NO AI summary / NO AI reply / NO AI auto-classification / NO AI auto-association
- ✅ NO Gmail/Outlook aesthetic — operational tokens Blueprint
- ✅ NO Tiptap/proposal-editor reuse nel Compose (textarea minimale)
- ✅ NO OAuth in Phase 1
- ✅ Italian operational copy in tutti gli empty states
- ✅ `<iframe sandbox="">` strict (no allow-scripts) per protezione XSS



## ITER182 · MOOD Language Lock™ — 2026-06-01

**Stato:** ✅ Completato (documentazione governance) · **0 modifiche codice/db/API** come richiesto dal Founder Directive

### Consegnato
- **`/app/memory/MOOD_LANGUAGE_CANON.md`** (15 sezioni) — Documento governance ufficiale per UI, UX writing, dashboard, CRM, Design Journey, Libraries, Editorial, Onboarding, modali, traduzioni, AI agents. Contiene:
  - Principio costituzionale (Brand ≠ Interfaccia)
  - Quality test (regola dei 2 secondi)
  - Livello 1 (Brand language: MOOD for DESIGN™, Design Journey™, Blueprint™, Material View™, Brand Atlas™, ecc.)
  - Livello 2 (UI language: chiaro, immediato, concreto, internazionale)
  - Vocabolario approvato (CRM, Progetto, Workspace, Library, Editorial, Team, KPI)
  - Lista nera ufficiale con severity (critical/high/medium) + replacement
  - CRM/Dashboard/Sidebar/Modal/Translation governance
  - AI Agents prompt governance
  - Enforcement (copy_lint.py + PR review + onboarding)
- **`/app/memory/MOOD_LANGUAGE_AUDIT.md`** (13 sezioni) — Audit repository completo. Contiene:
  - Tabella violazioni per termine × area (pages/components/i18n/backend/scripts)
  - Violazioni per locale (7 locale: en-US, en-GB, it-IT, es-ES, de-DE, fr-FR, ar; mancanti: es-MX, pt-BR)
  - Top 25 file hot-spot
  - Sample stringhe IT-IT con replacement
  - 3 categorie di violazioni (critical/high/medium)
  - Roadmap sostituzione (ITER183-186)
  - Impatto stimato per area (effort ~10-12 giorni-developer)

### Findings principali
- **EN-US master**: 67 stringhe con termini banditi → bonifica EN-US risolve a cascata gli altri locale
- **Hot-spots backend**: `studio_pulse.py` (22), `client_relations.py` (16), `inspirations_archive.py` (23), `brands_registry.py` (23)
- **Hot-spots frontend**: `CuratorialInspirationsModal.jsx` (28), `StudioPulsePage.jsx` (15), `RelationshipMemoryChapter.jsx` (14), `MoodPanel.jsx` (14)
- **Locales mancanti**: `es-MX`, `pt-BR` da creare prima del rollout LATAM/BR
- **Dashboard surface**: ✅ già bonificata da ITER181.A→C
- **Libraries/Inspirations**: 🔴 area con maggiore concentrazione di violazioni (~25 file)

### Vincolo rispettato
**AUDIT + GOVERNANCE ONLY.** Zero modifiche a codice/database/API. Solo 2 file documentazione in `/app/memory/`.

---

## ITER181.C · Dashboard Governance Fix™ — 2026-06-01

**Stato:** ✅ Completato (8/9 problemi del brief utente · Problem 5 "Lead Wizard 5-step" documentato come P1 follow-up) · 13/15 testing agent criteri PASS · 0 ui_bug critici · le 2 medium concerns sono state risolte (modal apre correttamente con eyebrow "CRM · NUOVO LEAD"; i18n sidebar verificato).

### Consegnato (UX governance, **zero backend**, **zero nuove API**)
- **P1** "Studio Pulse" → **"Blueprint Dashboard"** (audit i18n it-IT.json: `nav.studio_pulse`, editorial admin eyebrow/sub, CTA "Apri Blueprint Dashboard").
- **P2** Pagina Leads · nuovo copy operativo ("Contatti da qualificare. I Lead rappresentano persone o aziende…"). Rimossi "segnali" + "atmosfere" + "Ascolta prima di rispondere".
- **P3** Rimossi i 5 filter chips fake (warm_editorial, nordic_silence, midnight_mood, mediterranean_light, architectural_dawn) — `ATMOSPHERES = []`.
- **P4** Pagina Leads · aggiunta CTA primaria **"+ Nuovo Lead"** nel toolbar; click apre `NewRelationshipModal` con `{choice:'lead'}`.
- **P5** Lead Wizard 5-step: **documentato come P1 follow-up** in `DASHBOARD_INFORMATION_ARCHITECTURE_FIX.md`.
- **P6** Sidebar simplification: `nav.journey_index = "Design Journey"`, `nav.begin_journey = "+ Nuovo Design Journey"`. ActiveJourneyRail empty state senza CTA "Apri Nuova Relazione".
- **P7** "Nuova Relazione" → entità reali: **Topbar smart CTA** ora "+ Nuovo Lead" (prospects=0) o "+ Nuovo Design Journey" (prospects>0). Modal eyebrow "CRM · NUOVO LEAD".
- **P8** Quick Actions Scenario A reorder: [Nuovo Lead, Nuovo Design Journey, Media Library, Material View, Calendario Editoriale]; rimosso Blueprint Chameleon (in checklist) e Team (in checklist).
- **P9** Post-setup state: `WorkspaceActionHub` ritorna `null` quando `data.activated === true`. Nuovo `<StandaloneQuickActions />` renderizza sezione standalone full-width 5-up SOLO dopo il completamento del setup. La dashboard non lascia "buchi" — si densifica.

### Deliverables prodotti
- `/app/memory/DASHBOARD_NAMING_AUDIT.md`
- `/app/memory/DASHBOARD_COPY_AUDIT.md`
- `/app/memory/DASHBOARD_INFORMATION_ARCHITECTURE_FIX.md`

### File modificati principali
- `/app/frontend/src/components/activation/WorkspaceActionHub.jsx` (catalogue + priority function + HubReady rimosso + StandaloneQuickActions exportata)
- `/app/frontend/src/pages/dashboard/AtelierDashboardPage.jsx` (mount `<StandaloneQuickActions />`)
- `/app/frontend/src/components/layout/Topbar.jsx` (label "Nuovo Lead" + choice:'lead')
- `/app/frontend/src/components/relations/NewRelationshipModal.jsx` (eyebrow "CRM · Nuovo Lead")
- `/app/frontend/src/pages/relations/LeadsPage.jsx` (nuovo lede + CTA "+ Nuovo Lead" + rimossi filter chips fake)
- `/app/frontend/src/components/layout/ActiveJourneyRail.jsx` (rimosso CTA "Apri Nuova Relazione")
- `/app/frontend/src/i18n/strings/it-IT.json` (nav.studio_pulse, nav.journey_index, nav.begin_journey, nav.your_journeys, nav.new_lead aggiornati/aggiunti; editorial_copy.atelier_dashboard.eyebrow → "Blueprint Dashboard · Ritmo Progettuale")

### Test report
- `/app/test_reports/iteration_169.json`

---

## ITER181.A.3 · Workspace Action Hub UX Refactor — 2026-06-01

**Stato:** ✅ Completato · Tutti criteri PASS · 0 ui_bug · 0 regressioni

### Consegnato (UX/business-logic, **zero backend**)
- **"Nuova Relazione" → "Nuovo Contatto"** su tutte le superfici user-facing: Topbar primary CTA, Quick Actions, NewRelationshipModal eyebrow, i18n key `nav.new_contact`.
- **Team rimosso** dalle Quick Actions (è configurazione, non attività operativa quotidiana).
- **Quick Actions DINAMICHE** basate su `business_counts` con 4 scenari A/B/C/D — la prima card è sempre il next-best-step del funnel CRM.
- **Ready mode rebrand**: "Setup Workspace" → **"Workspace Operativo"** quando `activated === true`. Il blocco non sparisce, diventa centro operativo permanente.
- **Catalogue di 10 azioni** operative: newContact, qualifyProspect, newJourney, openJourney, mediaLibrary, materials, materialView, moodboard, editorialCalendar, blueprintChameleon.
- **Route audit**: tutte le 10 azioni risolvono a pagine esistenti (verificate in App.js); 0 placeholders, 0 link errati, 0 404.

### Report
- `/app/memory/WORKSPACE_ACTION_HUB_UX_REFACTOR_REPORT.md`
- `/app/test_reports/iteration_168.json`

---

## ITER181.A.2 · Workspace Action Hub™ — 2026-06-01

**Stato:** ✅ Completato · 14/14 acceptance criteria PASS · 0 ui_bug · 0 regressioni

### Consegnato (**solo layout/architettura**, zero backend, zero API)
- **Nuovo componente** `WorkspaceActionHub.jsx` con 3 modi:
  - `setup` (auto-detect quando `data.activated === false`): HEADER (eyebrow "Setup Workspace" + progress bar + counter "N/total completati") + BODY 70/30 (Checklist | Azioni rapide).
  - `ready` (auto-detect quando `data.activated === true`): HEADER "Workspace Ready" + BODY 5-up Quick Actions full-width.
  - `contextual` (predisposizione P2 per Next-Best-Action engine): restituisce `null`.
- **Unificate** Activation Foundation + Quick Actions in un singolo contenitore. Eliminata la sezione "Azioni Consigliate" separata e l'eyebrow `Quick Actions` stand-alone.
- **5 Quick Actions** permanenti (sempre disponibili anche dopo setup completo): Nuova Relazione · Nuovo Design Journey · Media Library · Calendario Editoriale · Team.
- **Nuovo ordine dashboard**: Hero → WorkspaceActionHub → Design Journey attive → Attività recenti / Prossime scadenze → Attività relazionali. Eliminato il rail Quick Actions in coda.
- **Zero buco dopo completamento**: il blocco non sparisce, si trasforma in "Workspace Ready" mode.

### File rimossi (sostituiti dal Hub)
- `/app/frontend/src/components/activation/ActivationMeter.jsx` (deleted)
- `/app/frontend/src/components/activation/RecommendedActions.jsx` (deleted)

### CSS
- `.atd-hub*` namespace nuovo in `atelier-dashboard.css`: container, header (setup + ready), body 70/30 e full-width rail, item rows, action rows/cards. Media queries 1180 (tablet collapse) e 760 (mobile stack).

### Report
- `/app/test_reports/iteration_167.json`

---

## ITER181.A.1 · Dashboard Layout Optimization — 2026-06-01

**Stato:** ✅ Completato · 14/14 acceptance criteria PASS · 0 ui_bug · 0 regressioni

### Consegnato (solo layout, **zero backend**, **zero API**)
- **Activation Foundation** → singola card full-width: HEADER (eyebrow "Setup Workspace" + progress bar orizzontale + "N/total completati") + BODY (checklist con CTA inline). Rimossa la colonna sinistra "Avanzamento".
- **Quick Actions rail** (ex Recommended Actions): 5 card compatte in 1 riga, altezza 64px (target ≤140), icona + titolo + 1 riga descrizione + arrow inline. Non dominano più la dashboard.
- **Nuovo ordine sezioni**: Hero → Activation → Design Journey attive → Attività recenti / Prossime scadenze (2-col) → Attività relazionali → Quick Actions. Journey ora prima delle azioni suggerite.
- **Density tighter**: ridotti i padding verticali delle sezioni (`atd-projects` 64→36px top, `atd-desk` 56→32px, `atd-live-relationships` 56→32px, `atd-panel` min-height 320→200px).
- **Rinominato** "Timeline relazioni" → "Attività relazionali" · eyebrow → "CRM · Live".
- **Empty state Timeline aggiornato**: "Nessuna attività registrata. Le attività di Lead, Prospect, Clienti e Design Journey appariranno qui."
- **Responsive**: desktop 5-up, tablet 3-up, mobile 1-col; checklist + CTA stack su mobile (`flex-wrap`); zero overflow.

### Report
- `/app/test_reports/iteration_166.json`

---

## ITER181.C · Dashboard Visual Consolidation™ — 2026-06-01

**Stato:** ✅ Completato · 12/12 acceptance criteria PASS · 0 ui_bug residui · 0 regressioni

### Consegnato
- **Design System Lock**: tutti i nuovi componenti ITER180/181 ereditano `--bp-surface-1` (dark Nordic), `--bp-border`, `--bp-radius-lg`, `--atelier-cyan`, `--atelier-sans/serif` — zero inline-style residui.
- **CSS section dedicato** in `atelier-dashboard.css` (+220 righe): `.atd-section`, `.atd-section__eyebrow`, `.atd-activation__*`, `.atd-recommended__*`, `.atd-banner__*`, `.atd-desk--2col`.
- **Componenti riscritti**: `ActivationMeter` + `WorkspaceActivationChecklist`, `RecommendedActions`, `PersistentAlertBanner` — solo classi semantiche.
- **Empty states v3** concisi: "Nessuna Design Journey attiva.", "Nessuna attività registrata.", "Nessuna scadenza in arrivo." (al posto delle versioni narrative).
- **Sezione titolo**: "Journey attive" → "Design Journey attive" (h2 serif italic).
- **Eyebrow uniformi**: tutte le sezioni sotto l'Hero usano cyan uppercase 10.5px (Setup workspace, Azioni consigliate).

### Report
- `/app/memory/DASHBOARD_VISUAL_CONSOLIDATION_REPORT.md`
- `/app/test_reports/iteration_165.json`

---

## ITER181.A · Dashboard Refocus™ Founder Experience — 2026-06-01

**Stato:** ✅ Completato · 8/8 backend pytest PASS · Frontend 100% PASS · 0 ui_bugs

### Consegnato
- **Phase 1** Rimosso `FirstMovesCards` e sezione "Le prime mosse" (5 card legacy)
- **Phase 2** Activation Foundation ridotto a 5 step di solo setup workspace (identity, blueprint, team, market, workspace); rimossi i criteri operativi (lead/prospect/journey)
- **Phase 3** Nuovo blocco `RecommendedActions` con 5 card operative (Lead/Prospect/Journey/Materiali/Calendario editoriale) che NON influenzano la %
- **Phase 4** Topbar Smart CTA dinamica: `prospects=0` → "Nuova Relazione"; `prospects>0` → "Nuovo Design Journey™"
- **Phase 5** Hero KPI sostituiti: Lead / Prospect / Clienti / Journey attive (rimossi Active Journeys / Dossier / Voices / Deliveries)
- **Phase 6** Empty states educativi · rimossa Inspiration column · RelationshipLiveTimeline copy aggiornata
- Backend: nuovo `business_counts` (leads/prospects/customers/active_journeys) in `/api/tenant-onboarding/activation-foundation`

### Bug risolti
- `nav.new_relationship` in `it-IT.json` era erroneamente "Nuovo Design Journey™" → ora "Nuova Relazione"
- Banned phrase "Memoria in evoluzione" in `RelationshipLiveTimeline` → "Timeline relazioni"

### Report
- `/app/memory/DASHBOARD_REFOCUS_IMPLEMENTATION_REPORT.md`
- `/app/test_reports/iteration_163.json`, `/app/test_reports/iteration_164.json`

---

## ITER180 · Activation Foundation™ Implementation — 2026-05-31

**Stato:** ✅ Completato · 10/10 backend tests PASS · Frontend smoke PASS

### Consegnato
- **AF1 PersistentAlertBanner™** — banner sticky con next-action critico + dismiss 24h (`/app/frontend/src/components/activation/PersistentAlertBanner.jsx`)
- **AF2 ActivationMeter™** — widget N/6 step con progress bar e badge Workspace Activated™
- **AF3 WorkspaceActivationChecklist™** — lista 6 step con CTA inline per ogni pending
- **AF4 Smart CTA Routing™** — hook `useSmartCtaRouter` (`modal:new-relationship` vs path navigate)
- **STEP 0 Identità Operativa** — pagina `/settings/identity` con form 4 campi (nome, mercato, lingua, timezone) + endpoint `POST /api/tenant-onboarding/identity`
- Backend endpoint `GET /api/tenant-onboarding/activation-foundation` con `_activation_state` signal-driven (no flag hardcoded)
- Test suite pytest `/app/backend/tests/test_iter180_activation_foundation.py` (10 test PASS)

### Bug risolti
- P0: SyntaxError in `AtelierDashboardPage.jsx` (ActivationFoundationCard iniettata dentro il main component)
- localStorage auth key sbagliato (`token` → wrapper `api` con `mfd_session`)
- Backend catalogue: rimosso "atmosfera" (C3 violation)

### Report
- `/app/memory/ACTIVATION_FOUNDATION_IMPLEMENTATION_REPORT.md`
- `/app/test_reports/iteration_162.json`

---

## ITER204 · Studio Library Bridge™ + UI Refactor — 2026-06-03

**Stato:** ✅ Completato · Backend 15/15 PASS · Frontend 100% testids · 0 regressioni i18n

### Consegnato

**1. UI Refactor (Navbar + Sidebar + Global Create Modal)**
- Topbar pulita: rimossi `WorkspaceChip` ("85 MOOD for DESIGN") e `PrimaryCta` ("Nuovo Lead" / "Nuovo Design Journey™")
- Sidebar: rimosso "+ Nuovo Lead", sostituito con **"+ Crea"** (data-testid: `sidebar-create-trigger`)
- Brand mark in sidebar usa il monogramma dinamico da `tenant.theme.monogram` (no più "M" hardcoded)
- **Global Create Modal** (`CreateModal.jsx`) montato a livello root in `DashboardLayout.jsx`. Config-driven, 6 card (Design Journey, Lead, Moodboard, Brand, Ispirazione, Materiale). 100% theme tokens, 100% `t()` i18n.

**2. Create Moodboard™ Modal (2 percorsi)**
- Nuovo `CreateMoodboardModal.jsx` con due path: **From Studio Library™** (Consigliato) · **Start Blank Canvas**
- Vincolo Design Journey enforced: senza Journey attivo mostra notice + CTA "Scegli un Journey →"
- Mostra il count dinamico di item nella Studio Library

**3. ITER204 · Studio Library Bridge™ (Backend)**
- Migrazione `125_iter204_studio_library_bridge.sql`:
  - Tabella `studio_library_items` (polimorfica: brand/collection/product/material/designer)
  - `source_type` nullable (academy/editorial/case_study/market_insight/brand_atlas/manual/import)
  - UNIQUE (tenant_id, entity_type, entity_id) → idempotenza
  - Backfill automatico da `studio_brand_links`
  - Nav module `studio_library` registrato in `feature_modules_registry`
- Router `studio_library.py`: GET `/stats`, GET `/`, GET `/resolved`, POST `/`, POST `/toggle`, DELETE `/{item_id}`, DELETE `/by-entity`
- Sync bidirezionale con `studio_brand_links` legacy

**4. ITER204 · Studio Library Bridge™ (Frontend)**
- `/app/frontend/src/pages/inspirations/StudioLibraryPage.jsx` (+ CSS): pagina editoriale con header curatoriale, counter, filtri per tipo, search, grid card, empty state, rimozione
- `SaveToLibraryButton.jsx` riusabile (compact/full mode)
- API client `studioLibraryApi.js`
- Route `/studio-library` registrata in `App.js`

**5. i18n (it-IT + en-US)**
- Aggiunti namespace `studio_library.*` (eyebrow, subtitle, total, types, source, empty, remove, save, missing)
- Aggiunti namespace `create.*` (cta, modal, designJourney, lead, moodboard.modal/from_library/blank/recommended, brand, inspiration, material)
- `nav.studio_library` aggiunto a entrambi i locale

### Bug risolti (dal testing agent)
- **DELETE /api/studio-library/by-entity returned 500** — FastAPI route-ordering bug: `@router.delete("/{item_id}")` veniva dichiarato PRIMA di `/by-entity` e catturava la stringa come UUID. Fix: route statiche dichiarate prima di quelle dinamiche.

### API endpoints (nuovi)
- `GET /api/studio-library/stats` → counts per entity_type
- `GET /api/studio-library/` → lista item (filtro `?entity_type=`)
- `GET /api/studio-library/resolved` → lista con entità hydrate
- `POST /api/studio-library/` → save (idempotente)
- `POST /api/studio-library/toggle` → toggle save/unsave
- `DELETE /api/studio-library/{item_id}` → rimuovi per id
- `DELETE /api/studio-library/by-entity` → rimuovi per (entity_type, entity_id)

### File chiave
- Backend: `/app/backend/routers/studio_library.py`, `/app/backend/routers/brand_experience.py` (sync), `/app/supabase/migrations/125_iter204_studio_library_bridge.sql`, `/app/backend/scripts/apply_migration_125.py`
- Frontend: `CreateModal.jsx`, `CreateMoodboardModal.jsx`, `DashboardLayout.jsx`, `StudioLibraryPage.jsx`, `SaveToLibraryButton.jsx`, `studioLibraryApi.js`, `App.js`, `i18n/strings/it-IT.json` + `en-US.json`
- Test: `/app/backend/tests/test_iter204_studio_library.py` (15 PASS)
- Report: `/app/test_reports/iteration_204.json`

### Note backlog (non bloccanti)
- Pre-existing React warning "setState during render" su mount Dashboard (non introdotto da ITER204)
- "missing 8" badge editoriale residuo per chiavi i18n di altri namespace fuori scope
- Pulsanti "Salva in Studio Library" da inserire nelle card di Collection/Product/Material/Designer dentro `BrandEmbassyPage` (component `SaveToLibraryButton` già pronto)


---

## ITER204-B · Entity Navigation Layer™ — 2026-06-03

**Stato:** ✅ Completato · Backend 27/27 PASS · Frontend 100% retest (3/3 cold navigations) · 0 regressioni

### Problema risolto
Le card di Collection/Product/Material/Designer in Brand Embassy erano vetrine statiche con count "20 prodotti" hardcoded (limite di paginazione). Cliccando non succedeva nulla. Il Knowledge Graph era estratto ma non navigabile.

### Consegnato

**1. Backend — 4 composite endpoints (`/api/knowledge/`)**
- `GET /brands/{brand_id}/collections/{collection_id}` → hero, count REALI (products/materials/designers), grid prodotti, materiali aggregati, designer, related_collections, `saved` flag, `states` per empty
- `GET /brands/{brand_id}/products/{product_id}` → hero, full gallery, category, materials, designers, related_products
- `GET /materials/{material_id}` → accetta UUID (canonical/detected) E nome (case-insensitive). 404 quando nulla matcha
- `GET /designers/{designer_id}` → accetta UUID (canonical/detected). Bio + brands + collections + products
- `brand_experience.py/embassy` → ora restituisce `product_count` REALE (bulk count query), non più capped a 20

**2. Frontend — 4 detail pages editoriali dark**
- `CollectionDetailPage` `/inspirations/brands/:brandId/collections/:collectionId`
- `ProductDetailPage`    `/inspirations/brands/:brandId/products/:productId`
- `MaterialDetailPage`   `/inspirations/materials/:materialId`
- `DesignerDetailPage`   `/inspirations/designers/:designerId`
- CSS condiviso `entity-detail.css` — 100% theme tokens, no white, no CRUD feeling
- Retry logic (3 attempts, 600ms backoff): solo HTTP 404 → not_found, tutti gli altri errori retry

**3. Clickability pass (BrandEmbassyPage)**
- Collection cards `embassy-coll-*` → click → `/inspirations/brands/.../collections/...`
- Product cards `embassy-product-*` → click → `/inspirations/brands/.../products/...`
- Material cards `embassy-mat-*` → click → `/inspirations/materials/{id}`
- Designer cards `embassy-designer-*` → click → `/inspirations/designers/{id}`

**4. Studio Library Bridge™ enhanced**
- `/api/studio-library/resolved` ora idrata designer/material da `brand_detected_entities` in fallback (non solo da `*_canonical`). Più "Voce rimossa" per designer salvati da Brand Atlas.
- Supporto save di material per nome (es. entity_id="wood")

**5. i18n (it-IT + en-US)**
- Nuovi namespace: `entity.collection.*`, `entity.product.*`, `entity.material.*`, `entity.designer.*`, `common.loading`
- 0 ⟦missing⟧ token sulle detail pages

**6. SaveToLibraryButton** integrato su ogni detail page (collection/product/material/designer)

### Acceptance criteria (12/12)
1. ✅ Collection cards cliccabili
2. ✅ Collection Detail page esistente
3. ✅ Product cards cliccabili
4. ✅ Product Detail page esistente
5. ✅ Material cards cliccabili
6. ✅ Material Detail page esistente
7. ✅ Designer cards cliccabili
8. ✅ Designer Detail page esistente
9. ✅ No fake counts (Essentials: 123 reali, non 20)
10. ✅ Empty states chiari ("Prodotti in indicizzazione", "Materiali da collegare", ...)
11. ✅ Save-to-Studio-Library hooks presenti
12. ✅ Graph navigabile Brand → Collection → Product → Material → Designer

### Test scenario ARBI (verificato)
1. ✅ Open Brand Atlas
2. ✅ Enter ARBI Embassy
3. ✅ Click "Essentials" collection → CollectionDetailPage carica con 123 prodotti, mood DNA, materiali
4. ✅ Click prodotto → ProductDetailPage carica con hero, gallery, breadcrumb
5. ✅ Click materiale → MaterialDetailPage carica con brands/collections/products
6. ✅ Click designer → DesignerDetailPage carica con counts e griglie
7. ✅ Save Collection/Product/Material/Designer → appaiono in /studio-library

### File chiave
- Backend: `/app/backend/routers/entity_navigation.py` (nuovo), `/app/backend/routers/brand_experience.py` (bulk count), `/app/backend/routers/studio_library.py` (resolved hydration)
- Frontend: `CollectionDetailPage`, `ProductDetailPage`, `MaterialDetailPage`, `DesignerDetailPage`, `entity-detail.css`, `entityNavigationApi.js`, `BrandEmbassyPage.jsx` (clickability), `App.js` (4 routes)
- i18n: `it-IT.json`, `en-US.json` (entity.* namespaces)
- Test: `/app/backend/tests/test_iter205_entity_navigation.py` (12 PASS) + `/app/backend/tests/test_iter204_studio_library.py` (15 PASS) — 27 totali
- Report: `/app/test_reports/iteration_205.json`, `/app/test_reports/iteration_206.json`

### Note (non bloccanti)
- React warning `LocalizationOverlay` su mount: pre-esistente, fuori scope
- Auth.login.* e nav.* i18n keys mancanti: pre-esistente, fuori scope
