# Changelog

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
