# I18N-CLOSURE-SPRINT — DELIVERABLE 1: ENGINE MAP
> Prodotto: 10 Jun 2026 · Agente: E1-Fork · Sprint: I18N-CLOSURE-SPRINT

---

## 1. Mappa Completa dei Motori i18n

| ID  | Nome                        | Entry Point                              | Firma esposta       | Files che lo usano | Source of Truth          |
|-----|-----------------------------|------------------------------------------|---------------------|--------------------|--------------------------|
| E1  | `useT` (i18n/useT)          | `src/i18n/useT.jsx`                      | `t(key, vars, fb)`  | **84**             | `it-IT.json` / `en-US.json` via `engine.js` + `LocaleRuntimeContext` |
| E2  | `useT` (BlueprintContext)   | `src/contexts/BlueprintContext.jsx`      | `t(key, vars, fb)`  | **17**             | Re-export di E3 — stessa firma visiva di E1, semantica BlueprintContext |
| E3  | `useBlueprint().t`          | `src/contexts/BlueprintContext.jsx`      | `t(key, vars, fb)`  | **72**             | `BlueprintContext` — legge bundle backend + JSON locale |
| E4  | `EditorialOverridesProvider`| `src/i18n/EditorialOverridesProvider.jsx`| Override selettivo  | **3**              | CMS backend (`/api/locale-runtime/resolve`) — override CMS su chiavi specifiche |
| E5  | `EditorialBundleProvider`   | `src/site/editorial/EditorialBundleProvider.jsx` | Bundle pagina | **6**        | Backend editorial bundle (pagine site pubbliche) |
| E6  | `LocaleRuntimeContext`      | `src/contexts/LocaleRuntimeContext.jsx`  | `localeCode`, `t`   | **13**             | `/api/locale-runtime/resolve` — risolve locale da DB tenant |

---

## 2. Source of Truth Dettaglio

```
LocaleRuntimeContext  ──► /api/locale-runtime/resolve
       │
       ├──► E1 (useT/i18n/useT.jsx)    ──► it-IT.json / en-US.json  [file locali]
       │         │
       │         └──► EditorialOverridesProvider (E4)  ──► CMS override su chiavi selezionate
       │
       └──► E3 (useBlueprint().t)       ──► BlueprintContext bundle  [JSON + backend]
                 │
                 └──► E2 (useT/BlueprintContext) = re-export di E3

E5 (EditorialBundleProvider) ──► backend editorial bundle (pagine site pubbliche SOLO)
```

---

## 3. Dipendenze e Relazioni tra Motori

```
E6 (LocaleRuntimeContext)
  ↑ consuma
  ├─ E1  — usa useLocaleRuntime() per derivare il locale corrente
  ├─ E4  — usa useLocaleRuntime() per override locale-aware (fix P0-C ✅)
  └─ engine.js — importa LocaleRuntimeContext per locale selection

E3 (BlueprintContext)
  ↑ riusato da
  └─ E2  — `useT` da BlueprintContext è re-export di E3.t

E1 ≠ E3  — stessa firma `t(key,vars,fallback)` ma:
  - E1: ignora il 3° argomento su chiavi già presenti nel JSON
  - E3: usa il 3° argomento come fallback se la chiave non è nel bundle CMS
  - E1: legge JSON locale statico (it-IT.json / en-US.json)
  - E3: legge bundle iniettato da BlueprintContext (mix JSON + override CMS)
```

---

## 4. File Coinvolti per Motore

### E1 — `useT` da `i18n/useT.jsx` (84 file)
Top namespace coperti: `clientRelations`, `members`, `journey.tab`, `crm`, `moodboards`, `inspirations`, `settings`, `media`, `admin`, `editorial`, `dashboard`, `library`, `insights`, `onboarding`, `site`, `storefront`, `workspace`, `projects`, `ai`, `cultural`, `advisor`

Campione file chiave:
- `AccountsPage.jsx`, `LeadsPage.jsx`, `ProspectsPage.jsx`, `LeadDetailPage.jsx`
- `AccountDetailDrawer.jsx`, `CrmAccountsPage.jsx`, `MembersPage.jsx`
- `DesignJourneyTab.jsx`, `ProjectDetailPage.jsx`
- `DashboardPage.jsx`, `InsightsPage.jsx`

### E3 — `useBlueprint().t` (72 file)
Top namespace coperti: `nav`, `common`, `dashboard`, `moodboards`, `settings`, `auth`, `client`, `create`, `atelier`

Campione file chiave:
- `Sidebar.jsx`, `Topbar.jsx`, `CreateModal.jsx`, `UserMenu.jsx`
- `LoginPage.jsx`, `AccessEntryPage.jsx`, `SignupPage.jsx`
- `AtelierDashboardPage.jsx`, `DesignJourneyTab.jsx`, `MoodboardEditor.jsx`

### E4 — `EditorialOverridesProvider` (3 file consumatori)
- `App.js` — provider radice (wrap globale)
- `engine.js` — integrazione nel motore i18n
- `EditorialOverridesProvider.jsx` — definizione

### E5 — `EditorialBundleProvider` (6 file)
- `AdminShell.jsx`, `BlueprintGovernancePages.jsx`
- `BeginJourneyPage.jsx`, `ProfessionalsGatewayPage.jsx`
- `EditorialBundleProvider.jsx`, `EditorialContent.jsx`

### E6 — `LocaleRuntimeContext` (13 file)
- `App.js`, `engine.js`, `useT.jsx`, `EditorialOverridesProvider.jsx`
- `LocaleRuntimeContext.jsx`, `CulturalPerspectivePanel.jsx`
- `DashboardPage.jsx`, `VariantApprovalInboxPage.jsx`
- `MagazineArticlePage.jsx`, `StartProjectWizard.jsx`
- `ReferencesPage.jsx`, `SiteLocaleBridge.jsx`, `LocaleRoute.jsx`

---

## 5. Rischi Architetturali

| # | Rischio | Severità | Motori coinvolti | Stato |
|---|---------|----------|------------------|-------|
| R1 | **Firma identica E1 = E2** — `useT` da `i18n/useT` e da `BlueprintContext` hanno la stessa firma ma semantica diversa (E1 ignora fallback, E3/E2 lo usa). Può causare comportamenti inattesi quando si migra un file. | ALTO | E1, E2 | APERTO |
| R2 | **Doppio source of truth** — E1 legge JSON locale statico; E3 legge bundle BlueprintContext che include override CMS. Un file che usa E3 per `nav.*` può ricevere override CMS che sovrascrivono il JSON. | ALTO | E1, E3, E4 | APERTO |
| R3 | **Coesistenza E1+E3 nello stesso file** — `DesignJourneyTab.jsx` importa sia `useT` da `i18n/useT` che `useBlueprint` da `BlueprintContext`. Il comportamento dipende da quale motore risolve per prima. | MEDIO | E1, E3 | DOCUMENTATO |
| R4 | **E2 (useT da BlueprintContext) — 17 file** che importano `useT` da `contexts/BlueprintContext` anziché da `i18n/useT`. Questi file hanno accidentalmente accesso alla semantica E3 pur sembrando E1. | MEDIO | E1, E2 | APERTO |
| R5 | **Auth pages non usano alcun motore i18n** — `AuthCallbackPage.jsx`, `AuthRecoveryPage.jsx`, `ResetPasswordPage.jsx`, `AuthClientCallback.jsx` usano stringhe hardcoded. | BASSO | — | APERTO |

---

## 6. Candidati alla Deprecazione

| Motore | Candidato | Motivo | Azione consigliata |
|--------|-----------|--------|-------------------|
| E2 | `useT` da `BlueprintContext` | Re-export di E3, crea confusione con E1. 17 file usano una firma identica a E1 ma con comportamento E3. | **Migrare i 17 file a `useT` da `i18n/useT` (E1) o esplicitamente a `useBlueprint().t` (E3)** |
| E3 | `useBlueprint().t` (parziale) | 72 file usano E3 per ragioni storiche. Molti potrebbero migrare a E1 ora che i JSON sono sincronizzati. | **Non deprecare ora** — E3 serve per override CMS su `nav.*` e bundle editorial |
| E5 | `EditorialBundleProvider` | Usato solo su 6 file pagine site/admin. Duplica funzionalità di E4. | **Valutare consolidamento in E4** nella prossima sprint i18n |

---

## 7. Stato del Motore Canonico

> **Motore canonico raccomandato**: **E1** (`useT` da `src/i18n/useT.jsx`)
> - 84 file già su E1 (maggioranza)
> - JSON perfettamente sincronizzati (1939 chiavi, 0 de-sync)
> - Locale-aware via `LocaleRuntimeContext` (E6)
> - Fix P0-C applicato: `EditorialOverridesProvider` ora locale-aware
>
> **Motore complementare legittimo**: **E3** (`useBlueprint().t`)
> - 72 file (layout, sidebar, auth, dashboard)
> - Gestisce override CMS — non rimpiazzabile da E1 senza Translation Management Layer
>
> **Unificazione E3→E1** possibile solo dopo Translation Management Layer (P2).

---

*Documento generato automaticamente dall'analisi statica del codebase — I18N-CLOSURE-SPRINT*
