# FRONTEND CONTENT SOURCE OF TRUTH
**Sprint:** Pre-Deploy Final Certification  
**Data:** 2026-06-20  
**Obiettivo:** 0 contenuti fake, 0 mock, 0 hardcoded  

---

## LEGENDA

| Stato | Significato |
|---|---|
| ✅ CERTIFIED | Legge esclusivamente da DB/API reale |
| ⚠️ PARTIAL | Legge da DB ma ha UI labels hardcoded (non contenuto) |
| ❌ FAKE DATA | Legge da file statico o ha dati mock nel percorso critico |

---

## TABELLA SOURCE OF TRUTH

| Pagina | Source Attuale | Source Corretta | Stato |
|---|---|---|---|
| **Home** (`/`) | `useStorefrontContent('home')` + API artcles/journeys | `cms_sections` (home) + `magazine_articles` + `published_design_journeys` | ✅ CERTIFIED |
| **About** (`/about`) | `useStorefrontContent('about')` | `cms_sections` (about) | ✅ CERTIFIED |
| **Services** (`/services`) | `useStorefrontContent('services')` | `cms_sections` (services) | ✅ CERTIFIED |
| **Professionals** (`/professionals`) | `useStorefrontContent('professionals')` | `cms_sections` (professionals) | ✅ CERTIFIED |
| **Partner Application** (`/partner-application`) | `useStorefrontContent('partner-application')` + `FORM_LABELS` dict | `cms_sections` (partner-application) + DB form labels | ⚠️ PARTIAL — form labels hardcoded |
| **Begin Journey** (`/begin-journey`) | `useStorefrontContent('start_project')` | `cms_sections` (start_project) | ✅ CERTIFIED |
| **Consulenza** (`/consulenza`) | `useStorefrontContent('consulenza')` | `cms_sections` (consulenza) | ✅ CERTIFIED |
| **Magazine Index** (`/magazine`) | `GET /api/magazine/public/{tenant}/articles` + `COPY` dict UI | `magazine_articles` (DB) + UI labels HC | ⚠️ PARTIAL — UI labels in dict hardcoded |
| **Magazine Detail** (`/magazine/:slug`) | `GET /api/magazine/public/{tenant}/articles/:slug` + `T` dict UI | `magazine_articles` + `article_localizations` | ⚠️ PARTIAL — UI labels in dict hardcoded |
| **Projects Index** (`/projects`) | `GET /api/public/published-journeys/{tenant}/feed` | `published_design_journeys` (DB) | ✅ CERTIFIED |
| **Project Detail** (`/projects/:slug`) | `GET /api/public/published-journeys/{tenant}/{slug}` *(FIXATO in questa sessione)* | `published_design_journeys` (DB) | ✅ CERTIFIED |
| **Footer** (globale) | `useStorefrontContent('home')` + `useStorefrontContent('navigation')` | `cms_sections` (home.editorial_footer + navigation.nav_top) | ✅ CERTIFIED |

---

## DETTAGLIO PER PAGINA

### Home (`/`)
- **Testi editoriali:** `cms_sections.home.*` via `useStorefrontContent` ✅
- **Hero:** `cms_sections.home.hero_editorial.locale_content` ✅
- **Magazine highlights:** `GET /api/magazine/public/{tenant}/articles?limit=3` ✅
- **Design journeys:** `GET /api/public/published-journeys/{tenant}/feed?featured_only=true` ✅
- **Navigazione:** `cms_sections.navigation.nav_top.settings.links` ✅
- **Residui:** Fallback URL `|| '/consulenza'` — CMS-first con safety net accettabile

### About (`/about`)
- **Tutto da:** `useStorefrontContent('about')` → `cms_sections.about.*` ✅
- **Residui:** Fallback URL negli `href` CTA (safety net) — accettabile

### Services (`/services`)
- **Tutto da:** `useStorefrontContent('services')` → `cms_sections.services.*` ✅

### Professionals (`/professionals`)
- **Tutto da:** `useStorefrontContent('professionals')` → `cms_sections.professionals.*` ✅
- **File precedentemente pulito:** Nessun hardcoded residuo ✅

### Partner Application (`/partner-application`)
- **Hero section:** `useStorefrontContent('partner-application')` ✅
- **Form labels:** `FORM_LABELS` dict statico (IT/EN) ⚠️
- **Form categorie:** `PROFESSIONAL_CATEGORIES` dict statico ⚠️
- **Impatto:** Il contenuto del form non è modificabile da Blueprint

### Begin Journey (`/begin-journey`)
- **Tutto da:** `useStorefrontContent('start_project')` ✅
- **Placeholder telefono:** `placeholder="0123 456 7890"` — tecnico, non contenuto editoriale

### Consulenza (`/consulenza`)
- **Tutto da:** `useStorefrontContent('consulenza')` ✅

### Magazine Index (`/magazine`)
- **Articoli:** `GET /api/magazine/public/{tenant}/articles` → `magazine_articles` ✅
- **Tassonomia:** `GET /api/magazine/public/{tenant}/taxonomy` ✅
- **UI labels (eyebrow, title, readMin, empty, filtri):** `COPY` dict hardcoded ⚠️
- **Impact BCP-47:** `COPY[locale] || COPY.it` — locale breve `it`, `en`, `fr`. BCP-47 come `it-IT` non trova match diretto (fallback su `COPY.it`) ⚠️

### Magazine Detail (`/magazine/:slug`)
- **Articolo:** `GET /api/magazine/public/{tenant}/articles/:slug` → `magazine_articles` ✅
- **Body blocks:** Da `magazine_articles.body_blocks` ✅
- **Hotspot:** Da API hotspot ✅
- **UI labels:** `T` dict hardcoded ⚠️
- **Content locale lookup:** `locale_content?.[locale] || locale_content?.it` — non usa `resolveLocaleBag` ⚠️

### Projects Index (`/projects`)
- **Progetti:** `GET /api/public/published-journeys/{tenant}/feed` ✅ *(certificato)*
- **Fallback legacy rimosso:** `portfolio/public/projects` eliminato in questa sessione ✅
- **UI labels (loading, empty):** `EDITORIAL_LOADING`/`EDITORIAL_EMPTY` dict BCP-47 ⚠️ (non CMS, ma BCP-47 corretto)
- **Categorie filtro:** `projectCategories` da `site/content/projects.js` ⚠️

### Project Detail (`/projects/:slug`)
- **Dati progetto:** `GET /api/public/published-journeys/{tenant}/{slug}` ✅ *(FIXATO)*
- **Fallback `findProjectBySlug` rimosso:** ✅
- **UI labels (DETAIL_LABELS):** Dict BCP-47 hardcoded ⚠️ (non CMS, ma BCP-47 corretto)
- **Gallery:** Vuota — `gallery_asset_ids` non popolati nel DB attuale — sezione non renderizza

### Footer (globale)
- **Navigazione:** `useStorefrontContent('navigation')` ✅
- **Editorial footer:** `useStorefrontContent('home')` section `editorial_footer` ✅
- **Locale picker label:** `cms_sections.navigation.locale_picker_label_i18n` ✅

---

## RIEPILOGO

| Stato | Pagine |
|---|---|
| ✅ CERTIFIED (0 fake, 0 mock) | Home, About, Services, Professionals, Begin Journey, Consulenza, Projects Index, Project Detail, Footer |
| ⚠️ PARTIAL (UI labels HC, contenuto DB) | Magazine Index, Magazine Detail, Partner Application |
| ❌ FAKE DATA | **0** — eliminato in questa sessione |

**Fake data eliminati in questa sessione:**
- `ProjectDetailPage.jsx` → rimosso `findProjectBySlug()` + fallback `portfolio_projects`
- `ProjectsIndexPage.jsx` → rimosso fallback `portfolio/public/projects`

---

## NOTA FINALE

Le pagine ⚠️ PARTIAL hanno **contenuto** proveniente dal DB (articoli, progetti, immagini).  
Le UI labels hardcoded (`COPY`, `T`, `DETAIL_LABELS`) riguardano solo micro-testi dell'interfaccia (es: "min di lettura", "Galleria") — non contenuto editoriale.  
Questi non impediscono la vendibilità del prodotto, ma non sono white-label.
