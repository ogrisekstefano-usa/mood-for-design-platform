# PUBLIC SURFACE AUDIT
*PARTNER AUTH FIX SPRINT — Giugno 2026*
*Generato da analisi statica del codice `App.js` e `api.js`*

---

## Metodologia

Analisi di:
- `frontend/src/App.js` — struttura route (ProtectedRoute vs SiteLayout vs standalone)
- `frontend/src/lib/api.js` — lista `isPublicSurface` dell'interceptor axios 401
- Componenti di ogni pagina pubblica — hook auth, chiamate API

---

## LEGENDA

| Colonna | Significato |
|---|---|
| Auth Required | `NO` = visibile anonimo; `YES` = richiede sessione |
| Wrapper | Il componente React che wrappa la route |
| API chiamate | Endpoint rilevanti al mount |
| Whitelist PRIMA | Presente in `isPublicSurface` prima del fix |
| Whitelist DOPO | Presente dopo il PARTNER AUTH FIX SPRINT |
| Anomalie | Comportamenti da monitorare |

---

## ROUTE PUBBLICHE (PUBLIC)

| Route | Componente | Auth Required | Wrapper | API principali | Whitelist PRIMA | Whitelist DOPO | Note |
|---|---|---|---|---|---|---|---|
| `/` | `HomePage` | NO | standalone | `/api/storefront/public/studio/pages/home`, `/api/branding`, `/api/profile/me` (AuthCtx) | ✅ (`p === '/'`) | ✅ | OK |
| `/about` | `AboutPage` | NO | `SiteLayout` | `/api/storefront/public/studio/pages/about`, `/api/branding` | ✅ | ✅ | OK |
| `/servizi` | `ServicesPage` | NO | `SiteLayout` | `/api/storefront/public/studio/pages/services` | ✅ | ✅ | OK |
| `/services` | `ServicesPage` | NO | `SiteLayout` | `/api/storefront/public/studio/pages/services` | ✅ | ✅ | alias di `/servizi` |
| `/projects` | `ProjectsIndexPage` | NO | `SiteLayout` | `/api/storefront/public/studio/pages/projects` | ✅ | ✅ | OK |
| `/projects/:slug` | `SiteProjectDetailPage` | NO | `SiteLayout` | `/api/storefront/public/studio/pages/projects/:slug` | ✅ | ✅ | OK |
| `/magazine` | `MagazinePage` | NO | `SiteLayout` | `/api/storefront/public/studio/pages/magazine` | ✅ | ✅ | OK |
| `/magazine/:slug` | `MagazineArticlePage` | NO | `SiteLayout` | `/api/magazine/public/:slug` | ✅ | ✅ | OK |
| `/professionals` | `ProfessionalsGatewayPage` | NO | `SiteLayout` | nessuna API diretta | ✅ | ✅ | OK |
| `/professionals/intake` | `ProfessionalIntakePage` | NO | `SiteLayout` | salvataggio localStorage, poi `navigate('/auth/login')` su submit | ❌ **MANCAVA** | ✅ **AGGIUNTO** | Il redirect su submit è **intenzionale** (flusso pro → login) |
| `/partner-application` | `PartnerApplicationPage` | NO | `SiteLayout` | `POST /api/storefront/public/studio/begin` (su submit) | ❌ **MANCAVA** | ✅ **AGGIUNTO** | **BUG PRINCIPALE — CORRETTO** |
| `/start-project` | `StartProjectWizard` | NO | `SiteLayout` | `/api/onboarding/briefing-summary`, `/api/onboarding/private/submit` | ✅ | ✅ | OK |
| `/begin-journey` | `BeginJourneyPage` | NO | `SiteLayout` | `/api/public/check-email`, `/api/public/journeys/initiate` | ✅ | ✅ | OK |
| `/consulenza` | `BeginJourneyPage` | NO | `SiteLayout` | stesso di `/begin-journey` | ✅ | ✅ | alias |
| `/begin-partnership` | `BeginPartnershipPage` | NO | `SiteLayout` | - | ✅ | ✅ | OK |
| `/journey/welcome/:token` | `JourneyWelcomePage` | NO | `SiteLayout` | - | ✅ | ✅ | magic link |
| `/onboarding/:kind` | `OnboardingPlaceholderPage` | NO | `SiteLayout` | - | ✅ | ✅ | OK |
| `/preview/:token` | `ClientPreviewPage` | NO | standalone | - | ✅ | ✅ | presentazione pubblica |
| `/presentation/:shareToken` | `PublicPresentation` | NO | standalone | - | ✅ | ✅ | OK |
| `/moodboard/share/:shareToken` | `PublicMoodboardWrapper` | NO | standalone | - | ✅ | ✅ | OK |
| `/review/:shareToken` | `ReviewMode` | NO | standalone | - | ✅ | ✅ | OK |
| `/story/:token` | `PublicProjectStoryViewer` | NO | standalone | - | ❌ **MANCAVA** | ✅ **AGGIUNTO** | fix preventivo |
| `/f/:tenantSlug/:formSlug` | `PublicFormPage` | NO | standalone | - | ✅ | ✅ | OK |
| `/form/:slug` | `LeadFormPage` | NO | standalone | - | ✅ | ✅ | OK |

---

## ROUTE AUTH (SEMI-PUBLIC — Accesso / Login / Callback)

| Route | Componente | Note |
|---|---|---|
| `/auth/login` | `LoginPage` | Dentro `PublicRoute` → redirect a dashboard se già loggato |
| `/auth/signup` | `SignupPage` | Dentro `PublicRoute` |
| `/auth/forgot-password` | `ForgotPasswordPage` | Pubblica |
| `/auth/callback` | `AuthCallbackPage` | Pubblica — OAuth callback |
| `/auth/client/callback` | `AuthClientCallback` | Pubblica — magic link |
| `/auth/client/access` | `AuthClientCallback` | Pubblica |
| `/auth/reset-password` | `ResetPasswordPage` | Pubblica |
| `/auth/recovery` | `AuthRecoveryPage` | Pubblica |
| `/access` | `AccessEntryPage` | Pubblica — unified entry |
| `/journey/access` | `AccessEntryPage` | Pubblica — alias |
| `/journey/preparing` | `JourneyPreparingPage` | Pubblica — cinematic |

---

## ROUTE PROTETTE (PROTECTED)

| Route | Wrapper | Ruolo richiesto |
|---|---|---|
| `/dashboard`, `/journeys`, `/studio/*` | `ProtectedRoute + StudioRoute + DashboardLayout` | Qualsiasi autenticato (non client) |
| `/blueprint/*` | `ProtectedRoute + StudioAdminRoute` | `tenant_admin` o `super_admin` |
| `/crm/*`, `/relations/*` | `ProtectedRoute + DashboardLayout` | Autenticato |
| `/settings/*` | `ProtectedRoute + StudioAdminRoute` | `tenant_admin` o `super_admin` |
| `/client/*` | `ClientRoute` | `role=client` (o admin per QA) |
| `/journey/:journeyId` | `ClientRoute` | `role=client` |
| `/admin/*` | `RootSuperAdminRoute + AdminShell` | `is_root_superadmin` |

---

## ROUTE LOCALE-PREFISSATE (PUBBLICHE)

| Pattern | Note |
|---|---|
| `/it-IT/*`, `/en-US/*`, `/en-GB/*`, `/es-ES/*`, `/fr-FR/*`, `/de-DE/*` | Stesse route pubbliche con `LocaleRoute` |
| `/it/*`, `/en/*`, `/es/*`, `/fr/*`, `/de/*`, `/gb/*` | Short redirect a canonical BCP-47 |
| Regex `^\/[a-z]{2}-[A-Z]{2}(\/|$)` | Coperte dalla regex nella whitelist |

---

## ROUTE TENANT PUBBLICHE

| Route | Componente | Note |
|---|---|---|
| `/:tenantSlug` | `PublicTenantPage` | Pagine tenant runtime — pubbliche |
| `/:tenantSlug/:pageSlug` | `PublicTenantPage` | Pubbliche |

> **NOTA**: Queste rotte usano wildcard e non sono nella whitelist esplicita. Il rischio di 401-redirect è basso perché usano `axios` direttamente (non `api.js`) tramite `useStorefrontContent`, che chiama `/api/storefront/public/...` (endpoint genuinamente pubblico, non torna 401).

---

## RIEPILOGO MODIFICHE ALLA WHITELIST

| Route | Stato Pre-Fix | Stato Post-Fix | Impatto |
|---|---|---|---|
| `/partner-application` | ❌ MANCANTE → redirect a `/auth/login` | ✅ AGGIUNTA | **Bug principale risolto** |
| `/professionals/intake` | ❌ MANCANTE (solo `/professionals` era presente) | ✅ AGGIUNTA (via `p.startsWith('/professionals/')`) | Fix preventivo |
| `/story/` (PublicProjectStoryViewer) | ❌ MANCANTE | ✅ AGGIUNTA (via `p.startsWith('/story/')`) | Fix preventivo |

---

*Documento creato: Giugno 2026 — PARTNER AUTH FIX SPRINT*
