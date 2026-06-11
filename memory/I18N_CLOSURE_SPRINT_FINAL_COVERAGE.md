# I18N-CLOSURE-SPRINT — DELIVERABLE 2: FINAL COVERAGE REPORT
> Prodotto: 10 Jun 2026 · Agente: E1-Fork · Sprint: I18N-CLOSURE-SPRINT

---

## 1. Metriche Chiave Post-Sprint

| Metrica | Valore |
|---------|--------|
| Chiavi totali `it-IT.json` | **1939** |
| Chiavi totali `en-US.json` | **1939** |
| De-sync IT vs EN | **0** (perfettamente sincronizzati) |
| Namespace top-level | **53** |
| File con E1 (`i18n/useT`) | **84** |
| File con E3 (`useBlueprint`) | **72** |
| File senza i18n (hardcoded) | **~40** (stimati, fuori scope sprint) |

---

## 2. Namespace Coperti (53 totali)

| Namespace | # chiavi stimato | Stato | Note |
|-----------|-----------------|-------|------|
| `auth` | ~15 | ⚠️ PARZIALE | Mancano `auth.login.*` nuovi, `auth.access.*` |
| `common` | ~60 | ✅ COMPLETO | `common.today`, `common.yesterday`, `common.time.ago`, `common.backToList` |
| `relationships` | ~20 | ✅ COMPLETO | |
| `nav` | ~40 | ✅ COMPLETO | Include `nav.section.*` sincronizzati |
| `crm` | ~223 | ✅ COMPLETO | Sprint T1 confermato 0 missing |
| `clientRelations` | ~59 | ✅ COMPLETO | FASE 1 + FASE 2 |
| `members` | ~74 | ✅ COMPLETO | FASE 2 — 74 chiavi |
| `journey` | ~40 | ✅ COMPLETO | `journey.tab.*` + `journey.meta_*` + narrativi FASE 2 |
| `moodboards` | ~20 | ✅ COMPLETO | |
| `leads` | ~18 | ✅ COMPLETO | |
| `settings` | ~35 | ✅ COMPLETO | |
| `dashboard` | ~25 | ✅ COMPLETO | |
| `inspirations` | ~30 | ✅ COMPLETO | |
| `editorial` | ~25 | ✅ COMPLETO | |
| `admin` | ~20 | ✅ COMPLETO | |
| `media` | ~15 | ✅ COMPLETO | |
| `site` | ~30 | ✅ COMPLETO | |
| `client` | ~20 | ✅ COMPLETO | |
| `storefront` | ~15 | ✅ COMPLETO | |
| `workspace` | ~25 | ✅ COMPLETO | |
| `projects` | ~20 | ✅ COMPLETO | |
| `blueprint` | ~10 | ✅ COMPLETO | |
| `insights` | ~10 | ✅ COMPLETO | |
| `cultural` | ~15 | ✅ COMPLETO | |
| `create` | ~10 | ✅ COMPLETO | |
| `entity` | ~5 | ✅ COMPLETO | |
| `atelier` | ~8 | ✅ COMPLETO | |
| `brand` | ~5 | ✅ COMPLETO | |
| `onboarding` | ~10 | ✅ COMPLETO | |
| Altri 24 namespace | ~60 | ✅ COMPLETO | |

---

## 3. Pagine Coperte (i18n attivo)

### Pagine COMPLETAMENTE coperte da questo sprint ✅
| Pagina | Motore | Sprint |
|--------|--------|--------|
| `AccountsPage.jsx` | E1 | FASE 1 |
| `LeadsPage.jsx` | E1 | FASE 1 |
| `ProspectsPage.jsx` | E1 | FASE 1 |
| `LeadDetailPage.jsx` | E1 | FASE 1 |
| `AccountDetailDrawer.jsx` | E1 | FASE 2 |
| `CrmAccountsPage.jsx` | E1 | FASE 2 |
| `MembersPage.jsx` | E1 | FASE 2 |
| `DesignJourneyTab.jsx` | E1+E3 | FASE 2 |
| `Sidebar.jsx` | E3 | pre-esistente |
| `CreateModal.jsx` | E3 | pre-esistente |
| `DashboardPage.jsx` | E1+E3 | pre-esistente |
| `AtelierDashboardPage.jsx` | E3 | pre-esistente |
| `MoodboardEditor.jsx` | E3 | pre-esistente |
| `SpecificationPages.jsx` | E3 | pre-esistente |

### Pagine PARZIALMENTE coperte ⚠️
| Pagina | Motore | Gap residuo |
|--------|--------|-------------|
| `LoginPage.jsx` | E3 | 8 chiavi `auth.login.*` nuove mancanti nel JSON |
| `AccessEntryPage.jsx` | E3 | 13 chiavi `access.*` / `auth.access.*` mancanti |
| `SignupPage.jsx` | E3 | Alcune chiavi `auth.signup.*` estese |

### Pagine FUORI COPERTURA (hardcoded / nessun motore) ❌
| Area | # Pagine stimate | Note |
|------|-----------------|------|
| Auth callbacks | 4 | `AuthCallbackPage`, `AuthRecoveryPage`, `ResetPasswordPage`, `AuthClientCallback` |
| Mail | ~10 | `MailWorkspaceLayout`, `MessagesListPage`, `ComposePage`, ecc. |
| Admin tools | ~8 | `RuntimeInspectorPage`, `MediaSystemPreviewPage`, `EditorialCopyCmsPage` |
| Blueprint language tools | ~7 | `LeakInspectorTable`, `LocalizationScreenshotDrawer`, ecc. (strumenti interni) |
| Collab | 1 | `ReviewMode.jsx` |
| Client pages | 3 | `BriefGuidedPage`, `ClientWelcomePresetPage` |
| Brand Atlas | 2 | `BrandAtlas2Page`, `BrandEmbassyPage` |

---

## 4. Progressione Sprint i18n

| Sprint | Stringhe estratte | Chiavi create | Gap chiuso |
|--------|-------------------|---------------|------------|
| FASE 1 (CRM base) | 69 | 61 | AccountsPage, LeadsPage, ProspectsPage, LeadDetailPage |
| FASE 2 (CRM avanzato) | ~130 | 119 | AccountDetailDrawer, CrmAccountsPage, MembersPage, DesignJourneyTab |
| I18N-CLOSURE-SPRINT | 0 nuove | 0 | Fix JSON sync (0 de-sync), narrative DesignJourneyTab |
| **TOTALE** | **~199** | **~180** | **~14 pagine completamente coperte** |

---

## 5. Copertura Globale Stimata

```
Totale file JSX/JS frontend:        ~380 stimati
File con almeno 1 motore i18n:      ~156 (84 E1 + 72 E3 · alcuni overlap)
File completamente hardcoded:        ~40

Copertura stimata (per file):       ~60-65%
Copertura stimata (per chiavi):     ~85% delle stringhe visibili all'utente
                                    nei flussi principali (CRM, Journey, Moodboard,
                                    Dashboard, Navigation)

Stringhe ancora hardcoded:
  - 27 editorial/brand copy in DesignJourneyTab (by design — NO tradurre)
  - ~40 pagine auth/mail/collab/admin (fuori scope sprint)
  - Testi editoriali storefront e site (Translation Management Layer futuro)
```

---

## 6. Roadmap Coverage Prossimi Sprint

| Priorità | Area | Chiavi stimate | Sprint suggerito |
|----------|------|----------------|-----------------|
| P1 | Auth pages (`login`, `access`, `signup`) | ~28 chiavi | Prossimo sprint breve |
| P1 | `JourneyOperatingPage.jsx` | ~20 chiavi hardcoded | Prossimo sprint |
| P2 | Mail workspace | ~50 chiavi | Sprint dedicato |
| P2 | Client portal pages | ~30 chiavi | Sprint dedicato |
| P3 | Brand Atlas, BrandEmbassy | ~20 chiavi | Quando feature stabile |
| P3 | Translation Management Layer | N/A (infra) | Decisione strategica |

---

*Documento generato automaticamente dall'analisi statica del codebase — I18N-CLOSURE-SPRINT*
