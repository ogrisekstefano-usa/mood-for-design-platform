# IMPLEMENTATION PLAN — MAGAZINE & PROJECTS CMS COMPLETION
**Sprint:** Magazine & Projects CMS Completion  
**Data:** 2026-06-20  
**Stato:** PROPOSTA — in attesa di approvazione  

---

## PREMESSA

Questo piano è il risultato dell'audit in 4 report:
- `MAGAZINE_PROJECTS_DATA_AUDIT.md`
- `FRONTEND_HARDCODED_AUDIT.md`
- `BLUEPRINT_EDITOR_GAP_REPORT.md`
- `MULTILINGUAL_CONTENT_AUDIT.md`

**Principio guida:** NON creare nuove tabelle se esiste già struttura compatibile.  
**Sequenza:** Fix P0 → Test → P1 → Test → P2 → Reports finali.

---

## DECISIONE ARCHITETTURALE OBBLIGATORIA (pre-implementazione)

### Il Problema

Il sistema ha **due percorsi paralleli non sincronizzati** per i Projects:

**Percorso A — `published_design_journeys`:**
- Usato da `ProjectsIndexPage.jsx` (frontend pubblico, lista)
- 6 progetti reali nel DB
- Gestito solo via script, nessuna UI Blueprint

**Percorso B — `portfolio_projects` + `portfolio_project_variants`:**
- Usato da `ProjectsStudioPage.jsx` (Blueprint admin)
- Usato da `ProjectDetailPage.jsx` (frontend pubblico, dettaglio)
- 0 record nel DB
- Ha varianti per mercato + AI compose

### Opzioni

**Opzione 1 — Unificare su `published_design_journeys`** (RACCOMANDATA)
- `ProjectDetailPage` viene cablato su `published_design_journeys`
- Si crea endpoint admin per `published_design_journeys`
- `ProjectsStudioPage` viene aggiornato per gestire anche `published_design_journeys`
- Vantaggio: singolo source of truth, meno complessità
- Svantaggio: perdi le variant per mercato (ma puoi usare `published_design_journey_translations`)

**Opzione 2 — Bridge da `portfolio_projects` a `published_design_journeys`**
- Quando si pubblica un variant in `ProjectsStudioPage`, viene automaticamente creato/aggiornato un record in `published_design_journeys`
- Vantaggio: mantieni l'architettura AI compose per mercato
- Svantaggio: due tabelle da mantenere sincronizzate

**Opzione 3 — Migrare i 6 progetti da `published_design_journeys` a `portfolio_projects`**
- Crea master + variants per i 6 progetti
- Il frontend continua a leggere da `portfolio_projects` (ma poi bisogna popolarla)
- Svantaggio: lavoro di migrazione dati, duplicazione

> **Raccomandazione:** Opzione 1. Il `published_design_journeys` è già il source of truth per la lista pubblica (ITER157.B). È più semplice cablare il dettaglio sulla stessa tabella e aggiungere UI admin per gestirla.

---

## FASE 0 — DECISIONI PRELIMINARI (richiede approvazione utente)

- [ ] Conferma Opzione architetturale per Projects (1, 2 o 3)
- [ ] Conferma: le UI labels (`DETAIL_LABELS`, `EDITORIAL_LOADING`) vanno su CMS sections o restano come dict statici ottimizzati?
- [ ] Conferma: il campo `youtube_url` va come blocco `body_blocks` o come campo separato in `magazine_articles`?

---

## FASE 1 — P0: FIX ARCHITETTURALI (nessuna nuova tabella)

### 1.1 — ProjectDetailPage: Cablare su `published_design_journeys`

**File:** `ProjectDetailPage.jsx`  
**Backend:** Aggiungere `GET /api/public/published-journeys/{tenant}/{slug}` (endpoint dettaglio per slug)  
**Dettaglio:**
- L'endpoint legge da `published_design_journeys` per `slug` + `locale`
- Se ha `published_design_journey_translations` per il locale richiesto, le usa
- Restituisce shape uniforme: `{ title, editorial_excerpt, atmosphere, project_type, location, year, hero_url, gallery, seo_title, seo_description, ... }`
- Il `ProjectDetailPage` smette di cercare in `portfolio_projects`
- Rimuovere `findProjectBySlug()` e fallback a `site/content/projects.js`

**Test:** Aprire `/projects/residenza-in-campagna` — deve mostrare dati reali DB

### 1.2 — MagazineEditorPage: Locale BCP-47

**File:** `MagazineEditorPage.jsx`  
**Dettaglio:**
- Aggiornare `LOCALES` array da `[{id: 'it'}, {id: 'en'}, ...]` a `[{id: 'it-IT'}, {id: 'en-US'}, {id: 'en-GB'}, {id: 'fr-FR'}, {id: 'de-DE'}, {id: 'es-ES'}]`
- Il locale switcher mostra tutti e 6 i locale
- Quando si crea un articolo, `locale_content` viene scritto come `{it-IT: {...}}` invece di `{it: {...}}`
- NOTA: articoli esistenti hanno chiave `it`/`en` — `resolveLocaleBag` gestisce il fallback

**Test:** Aprire editor articolo → selezionare `it-IT` → modificare testo → salvare → verificare che `locale_content.it-IT` sia scritto nel DB

### 1.3 — MagazinePage: Sostituire COPY dict con CMS

**File:** `MagazinePage.jsx`  
**CMS Source:** `useStorefrontContent(tenantSlug, 'magazine_index')` — aggiungere sezione al DB  
**Dettaglio:**
- Creare sezione `magazine_index` nel CMS per il tenant con i testi del `COPY` dict
- `MagazinePage` legge da `useStorefrontContent` → `resolveLocaleBag`
- Rimuovere `COPY` dict e `const c = COPY[locale] || COPY.it`
- Il logo viene letto da `branding_settings` invece di `navigationContent.brand.logoSrc`

**Blocchi necessari in CMS section `magazine_index`:**
```json
{
  "it-IT": {
    "eyebrow": "MAGAZINE",
    "title": "Riferimenti progettuali curati",
    "body": "Atmosfere, materiali e palette selezionate...",
    "readMin": "min di lettura",
    "empty": "Stiamo curando i prossimi articoli.",
    "f_all": "Tutto", "f_categories": "Verticali",
    "f_under3": "< 3 min", "f_36": "3–6 min", "f_6plus": "6+ min",
    "clear": "Reset", "results": "risultati",
    "startProject": "INIZIA PROGETTO"
  },
  "en-US": { ... },
  "en-GB": { ... }
}
```

### 1.4 — MagazineArticlePage: Sostituire T dict + resolveLocaleBag

**File:** `MagazineArticlePage.jsx`  
**CMS Source:** `useStorefrontContent(tenantSlug, 'magazine_article')`  
**Dettaglio:**
- Sostituire `T` dict con CMS lookup
- Sostituire tutti i `locale_content?.[locale] || locale_content?.it` con `resolveLocaleBag(locale_content, locale)`
- `TYPE_LABEL` hardcoded → da CMS section o dict BCP-47 minimo

### 1.5 — ProjectsIndexPage: Sostituire testi HC

**File:** `ProjectsIndexPage.jsx`  
**CMS Source:** `useStorefrontContent(tenantSlug, 'projects_index')`  
**Dettaglio:**
- Sostituire `EDITORIAL_LOADING`, `EDITORIAL_EMPTY` con CMS lookup
- Aggiungere API per leggere categorie progetto da DB invece di file statico
- `projectCategories` → `GET /api/public/published-journeys/{tenant}/categories`

### 1.6 — ProjectDetailPage: Sostituire testi HC

**File:** `ProjectDetailPage.jsx`  
**CMS Source:** `useStorefrontContent(tenantSlug, 'projects_detail')`  
**Dettaglio:**
- Sostituire `DETAIL_LABELS` con CMS lookup
- Sostituire `EDITORIAL_LOADING` con CMS lookup
- Sostituire `uiContent.detail` con CMS lookup

---

## FASE 2 — P1: EDITOR COMPLETAMENTO (usare strutture esistenti)

### 2.1 — SEO fields nell'editor Magazine

**Struttura esistente:** `article_localizations` (tabella già presente, 0 record)  
**Backend:** Aggiungere endpoint `PATCH /api/magazine/admin/articles/{id}/localizations`  
**Frontend:** Aggiungere sezione "SEO & Sharing" in `MagazineEditorPage`:
- `seo_title` (input testo, per locale)
- `seo_description` (textarea, per locale)
- `og_image` (picker media → scrive su `og_image_asset_id`)

### 2.2 — YouTube blocco

**Schema:** Non richede nuova tabella — blocco `{type: 'youtube', video_id: '...', caption: '...'}` dentro `body_blocks` JSONB  
**Backend:** Nessun cambio schema — `body_blocks` è JSONB libero  
**Frontend editor:** Aggiungere tipo blocco `youtube` in `BlockEditor`:
- Input `video_id` / `youtube_url` (con estrazione ID automatica dall'URL)
- Embed preview nell'editor
**Frontend pubblico:** Aggiungere renderer blocco `youtube` in `ArticleBody` di `MagazineArticlePage`:
- Iframe responsive lazy-loaded
- `https://www.youtube.com/embed/{video_id}?loading=lazy`

### 2.3 — Gestione tag in editor

**Frontend:** Aggiungere UI tag editor in `MagazineEditorPage`:
- Input con autocomplete dai tag esistenti (da `GET /api/magazine/public/{tenant}/taxonomy`)
- Chip removibili per tag selezionati
- Scrive su `magazine_articles.tags`

### 2.4 — Blueprint per `published_design_journeys`

**Backend:** Aggiungere router `published_journeys_admin.py`:
- `GET /api/admin/published-journeys` — lista
- `POST /api/admin/published-journeys` — crea
- `PATCH /api/admin/published-journeys/{id}` — aggiorna
- `DELETE /api/admin/published-journeys/{id}` — elimina (soft)
- `POST /api/admin/published-journeys/{id}/publish` — pubblica
- `GET/POST/PATCH /api/admin/published-journeys/{id}/translations` — gestione traduzioni

**Frontend:** Nuova pagina Blueprint `PublishedJourneysAdminPage.jsx` (simile a `MagazineAdminPage`):
- Lista progetti con status
- Editor campi: titolo, excerpt, atmosphere, location, year, project_type
- Hero image picker
- Gallery editor (riutilizzare `ProjectGalleryEditor`)
- Gestione traduzioni per locale
- SEO fields

---

## FASE 3 — P2: COMPLETAMENTO MULTILINGUA

### 3.1 — Migrazione chiavi DB

- Migrare `magazine_articles.locale_content` da `it`/`en` a `it-IT`/`en-US`
- Eseguire SOLO DOPO che tutti i frontend usano `resolveLocaleBag`

### 3.2 — Aggiungere blocco `heading` nell'editor

- Blocco `{type: 'heading', level: 2, locale_content: {}}` in body_blocks
- Renderer in `ArticleBody` e renderer editor in `BlockEditor`

### 3.3 — Author display name

- Aggiungere campo `author_display_name` a `magazine_articles` (ALTER TABLE)
- Oppure: leggerlo da `published_by → users_profile.display_name`
- Aggiungere in editor e nel frontend pubblico

### 3.4 — Blocco `gallery` nell'editor

- Aggiungere UI per gestire blocco `{type: 'gallery', items: [{url, caption, ...}]}` nel `BlockEditor`
- Attualmente i blocchi gallery esistono nel DB ma non sono editabili dall'editor

---

## FASE 4 — P3: FEATURE DA RIMANDARE (fuori scope corrente)

- Blocco `divider` (minore)
- Hotspot su articoli con linking a Brand Atlas (struttura esiste, da cablare)
- Hotspot su progetti con `hotspot_locale_variants` (AI locale variants)
- Client, designer, brand coinvolti nei progetti (non modellati)
- `ES_MX` locale profile nel DB
- Drag&drop riordinamento blocchi nell'editor

---

## TABELLA RIASSUNTIVA

| Fase | Task | Tabelle toccate | Nuovi endpoint | Nuovi componenti |
|---|---|---|---|---|
| 1.1 | ProjectDetail → published_journeys | Nessuna | 1 GET (dettaglio per slug) | 0 |
| 1.2 | Editor locale BCP-47 | Nessuna | 0 | 0 |
| 1.3 | MagazinePage → CMS | cms_sections | 0 (usa esistente) | 0 |
| 1.4 | MagazineArticlePage → CMS + resolveLocaleBag | cms_sections | 0 | 0 |
| 1.5 | ProjectsIndexPage → CMS + categories API | cms_sections | 1 GET (categories) | 0 |
| 1.6 | ProjectDetailPage → CMS | cms_sections | 0 | 0 |
| 2.1 | SEO fields editor | article_localizations | 1 PATCH | 1 (SEO section) |
| 2.2 | YouTube blocco | Nessuna (JSONB) | 0 | 1 (BlockEditor + renderer) |
| 2.3 | Tag editor | Nessuna | 0 | 1 (TagEditor) |
| 2.4 | Blueprint published_journeys | Nessuna | 6 | 1 (PublishedJourneysAdminPage) |
| 3.1 | Migrazione chiavi DB | magazine_articles | 0 | 0 |
| 3.2 | Blocco heading | Nessuna (JSONB) | 0 | 1 (HeadingBlock) |
| 3.3 | Author display | magazine_articles (alter) | 0 | 0 |

**Totale Fase 1+2:** 2 nuove tabelle toccate, 9 nuovi endpoint, 4 nuovi componenti  
**NON si creano nuove tabelle.**

---

## SEQUENZA DI TESTING

| Dopo | Cosa testare |
|---|---|
| Fase 1.1 | `/projects/residenza-in-campagna` mostra dati reali |
| Fase 1.2 | Editor magazine → locale `it-IT` → salva → DB ha chiave `it-IT` |
| Fase 1.3 + 1.4 | Magazine pubblica in `en-GB` mostra contenuto, non testo vuoto |
| Fase 1.5 + 1.6 | Projects pubblica in `fr-FR` mostra loading/empty corretto |
| Fase 2.1 | SEO fields salvati su `article_localizations` |
| Fase 2.4 | Crea progetto da Blueprint → appare in `/projects` |

---

## NOTE CRITICHE PER L'IMPLEMENTAZIONE

1. **Non toccare `journal_articles` / `journal_article_blocks`** — sistema parallelo fuori scope
2. **Non modificare `portfolio_projects`** — mantenerla come legacy fino a decisione architetturale
3. **Non creare nuove tabelle** — tutte le strutture necessarie esistono già
4. **Usare `resolveLocaleBag` ovunque** — nessun `locale_content?.[locale]` diretto
5. **Testare ogni fase** — le fasi P0 sono prerequisito per le P1
