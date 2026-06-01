# Changelog

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
