# Changelog

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
