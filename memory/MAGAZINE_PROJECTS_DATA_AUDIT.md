# MAGAZINE & PROJECTS DATA AUDIT
**Sprint:** Magazine & Projects CMS Completion  
**Data:** 2026-06-20  
**Autore:** Audit automatico — lettura-only, zero implementazione  

---

## METODOLOGIA

Ispezione diretta di:
- Schema SQL delle tabelle (`information_schema.columns`)
- Conteggio record reali per stato
- Endpoint backend (`/app/backend/routers/magazine.py`, `published_journeys.py`)
- Frontend pubblico (`MagazinePage.jsx`, `MagazineArticlePage.jsx`, `ProjectsIndexPage.jsx`, `ProjectDetailPage.jsx`)
- Blueprint admin (`MagazineAdminPage.jsx`, `MagazineEditorPage.jsx`, `ProjectsStudioPage.jsx`)

---

## PARTE 1 — MAGAZINE

### 1.1 Tabelle Coinvolte

#### `magazine_articles` — SOURCE OF TRUTH PRINCIPALE
| Campo | Tipo | Nullable | Stato |
|---|---|---|---|
| id | uuid | NO | ✅ Usato |
| tenant_id | uuid | NO | ✅ Usato |
| slug | text | NO | ✅ Usato |
| status | text | NO | ✅ Usato (`published`, `draft`) |
| cover_url | text | YES | ✅ Usato |
| hero_url | text | YES | ✅ Usato |
| scope | text | NO | ✅ Usato |
| locale_content | jsonb | NO | ✅ SOURCE OF TRUTH testi per locale |
| body_blocks | jsonb | NO | ✅ SOURCE OF TRUTH blocchi editoriali |
| category_slug | text | YES | ✅ Usato |
| tags | ARRAY | NO | ✅ Usato |
| default_locale | text | NO | ✅ Usato |
| reading_minutes | integer | YES | ✅ Calcolato auto |
| published_at | timestamp | YES | ✅ Usato |
| published_by | uuid | YES | ⚠️ Non mostrato in editor |
| created_by | uuid | YES | ⚠️ Non mostrato in editor |
| view_count | integer | NO | ✅ Usato (contatore) |
| save_count | integer | NO | ✅ Usato |
| subcategory | text | YES | ⚪ Inutilizzato in editor |
| editorial_tone | text | YES | ⚪ Inutilizzato in editor |
| project_vertical | text | YES | ⚪ Inutilizzato in editor |
| locale_market | text | YES | ⚪ Inutilizzato in editor |
| featured_materials | ARRAY | NO | ⚠️ Non editabile in editor |
| atmosphere_keywords | ARRAY | NO | ⚠️ Non editabile in editor |

> **GAP CRITICO:** NON ha campi `seo_title`, `seo_description`, `og_image_url`, `youtube_url`, `author_display_name`. Questi dati esistono in tabelle separate (vedi sotto) ma NON sono cablati nell'editor.

**Dati attuali:**
- 12 articoli pubblicati (status = `published`)
- Mix di locale: alcuni `it`+`en`, alcuni solo `it`, alcuni solo `en`
- 0 articoli con `en-GB`, `fr-FR`, `de-DE`, `es-ES`

---

#### `article_localizations` — ESISTE, NON CABLATA
| Campo | Tipo | Note |
|---|---|---|
| id | uuid | — |
| article_id | uuid | FK → magazine_articles |
| locale_code | text | BCP-47 (es: `it-IT`, `en-US`) |
| slug | text | Slug localizzato |
| title | text | Titolo per questa locale |
| excerpt | text | Excerpt |
| seo_title | text | **SEO title per locale** |
| seo_description | text | **SEO description per locale** |
| canonical_url | text | URL canonico |
| og_image_asset_id | uuid | **OG Image per locale** |
| intro | text | Intro editoriale |
| storytelling_summary | text | Summary AI |
| cta_copy | text | Copy del CTA |
| approved_by | uuid | — |

> **Stato:** 0 record nel DB. La tabella esiste ma non è mai stata usata. Il `MagazineEditorPage` non ha mai scritto su questa tabella.

---

#### `article_hotspots` — ESISTE, VUOTA
| Campo | Tipo | Note |
|---|---|---|
| article_id | uuid | FK → magazine_articles |
| block_id | text | ID del blocco nell'articolo |
| x_pct, y_pct | numeric | Posizione pin |
| reference_type | text | material, fabric, lighting, etc. |
| locale_content | jsonb | Label/description per locale |
| linked_material_id | uuid | Link a material Brand Atlas |
| linked_asset_id | uuid | Link a media_library |
| linked_article_id | uuid | Link ad altro articolo |
| linked_project_id | uuid | Link a progetto |
| linked_collection_id | uuid | Link a collection |
| cta_action | text | save_to_project, discuss_with_advisor, etc. |

> **Stato:** 0 record nel DB. Il `HotspotCanvas` nell'editor esiste e può creare hotspot via API, ma non sono mai stati creati hotspot reali.

> **Struttura hotspot in `hotspot_locale_variants`:** Tabella separata per traduzioni hotspot con AI (title, narrative, cta_copy, emotional_framing). 0 record.

---

#### `journal_articles` / `journal_article_blocks` / `journal_categories` / `journal_tags` — SISTEMA PARALLELO
> Sistema editoriale alternativo e più avanzato (`editorial_masters` → `journal_articles` → `journal_article_blocks`). 
> NON è usato dalla `MagazinePage` pubblica. È usato dal flusso `EditorialStudioPage` / `ArticleEditorPanel`.
> **Non il source of truth per il Magazine pubblico.** Da documentare separatamente.

---

#### `magazine_posts` / `magazine_paragraphs` — LEGACY
> Tabelle legacy, schema semplice (text title, content, language). Non usate dal sistema attuale. Candidati alla deprecazione.

---

### 1.2 Architettura API Magazine

**Endpoint pubblici esistenti:**
- `GET /api/magazine/public/{tenant}/articles` — lista con filtri (categoria, tag, reading_min/max)
- `GET /api/magazine/public/{tenant}/articles/{slug}` — dettaglio + hotspot
- `GET /api/magazine/public/{tenant}/taxonomy` — categorie, tag, filtri disponibili
- `GET /api/magazine/public/{tenant}/articles/{slug}/related` — articoli correlati
- `GET /api/magazine/public/{tenant}/editorial/{slug}` — variant culturale (Phase E-2)
- `POST /api/magazine/public/{tenant}/save-reference` — salva hotspot lead anonimo

**Endpoint admin esistenti:**
- `GET/POST /api/magazine/admin/articles` — lista e creazione
- `PATCH /api/magazine/admin/articles/{id}` — aggiornamento
- `DELETE /api/magazine/admin/articles/{id}` — eliminazione
- `POST /api/magazine/admin/articles/{id}/publish` — pubblicazione
- `POST /api/magazine/admin/articles/{id}/hotspots` — creazione hotspot
- `PATCH /api/magazine/admin/hotspots/{id}` — aggiornamento hotspot
- `DELETE /api/magazine/admin/hotspots/{id}` — eliminazione hotspot

> **GAP:** Nessun endpoint per `seo_title`, `seo_description`, `og_image`, `youtube_url`, `author_display_name`. Il `ArticlePatchBody` nel backend non espone questi campi.

---

### 1.3 Gap Magazine — Classificazione

| Gap | Classificazione | Priorità |
|---|---|---|
| `COPY`/`T` dict hardcoded in MagazinePage + MagazineArticlePage | **Hardcoded da rimuovere** | P0 |
| LOCALES editor usa codici brevi (`it`, `en`) non BCP-47 | **Esistente non cablato** | P0 |
| Fallback locale `\|\| locale_content?.it` non usa `resolveLocaleBag` | **Hardcoded da rimuovere** | P0 |
| `article_localizations` esiste ma non è mai usata | **Esistente non cablato** | P1 |
| SEO fields (`seo_title`, `seo_description`, `og_image`) non editabili | **Gap reale** | P1 |
| YouTube/video — nessun campo nel DB, nessun blocco nell'editor | **Gap reale** | P1 |
| `author_display_name` — non ha campo diretto in `magazine_articles` | **Gap reale** | P2 |
| Hotspot — struttura esiste, DB vuoto, editor funzionante | **Esistente non cablato** | P2 |
| Blocco `heading` — non supportato nell'editor | **Gap reale** | P2 |
| Blocco `divider` — non supportato nell'editor | **Feature da rimandare** | P3 |
| Gestione `gallery` multi-image nel body editor | **Esistente parzialmente** | P2 |

---

## PARTE 2 — PROJECTS

### 2.1 Tabelle Coinvolte

#### `published_design_journeys` — SOURCE OF TRUTH per frontend pubblico (ITER157.B)
| Campo | Tipo | Note |
|---|---|---|
| id | uuid | — |
| tenant_id | uuid | — |
| design_journey_id | uuid | FK opzionale → design_journeys |
| portfolio_project_id | uuid | FK opzionale → portfolio_projects |
| slug | text | URL pubblico |
| canonical_locale | text | BCP-47 lingua principale |
| title | text | Titolo nella canonical_locale |
| editorial_excerpt | text | Excerpt |
| atmosphere | text | Atmosfera editoriale |
| project_type | text | residential, hospitality, etc. |
| location | text | Località |
| year | integer | Anno |
| hero_asset_id | uuid | FK → media_library |
| hero_url | text | URL hero |
| gallery_asset_ids | ARRAY | Array UUID → media_library |
| material_tags | jsonb | Array tag materiali |
| seo_title | text | ✅ Esiste |
| seo_description | text | ✅ Esiste |
| visibility_status | text | published, draft, archived |
| featured_order | integer | Ordine homepage |
| homepage_featured | boolean | Featured in homepage |
| editorial_article_id | uuid | Link a magazine_articles |
| magazine_feature_id | uuid | Link a magazine feature |
| published_at | timestamp | — |

**Dati attuali:**
- 6 progetti pubblicati (canonical_locale = `it-IT`)
- 0 progetti in draft/archived

---

#### `published_design_journey_translations` — TRADUZIONI PROGETTI
| Campo | Tipo | Note |
|---|---|---|
| published_journey_id | uuid | FK → published_design_journeys |
| locale | text | BCP-47 |
| title | text | Titolo tradotto |
| editorial_excerpt | text | Excerpt tradotto |
| atmosphere | text | Atmosfera tradotta |
| location | text | Località tradotta |
| seo_title | text | SEO tradotto |
| seo_description | text | SEO tradotto |
| status | text | draft, approved |
| generated_by | text | human, ai |

**Dati attuali:**
- 3/6 progetti hanno traduzione `en-US`
- 0/6 hanno `en-GB`, `fr-FR`, `de-DE`, `es-ES`

---

#### `portfolio_projects` + `portfolio_project_variants` — SISTEMA ALTERNATIVO
> Usato da `ProjectsStudioPage.jsx` (Blueprint admin) e da `ProjectDetailPage.jsx` (frontend pubblico).  
> 0 record nel DB (tabella vuota).  
> **DISALLINEAMENTO CRITICO:** Il frontend pubblico `ProjectDetailPage` legge da `portfolio_projects`, ma i dati sono in `published_design_journeys`.

---

#### `hotspot_locale_variants` — HOTSPOT PER PROGETTI (esiste, vuota)
> Tabella per hotspot progetti con AI locale variants (title, narrative, cta_copy, atmosphere).
> 0 record. Struttura non cablata nel Blueprint Projects Studio.

---

### 2.2 Architettura API Projects

**Endpoint pubblici esistenti:**
- `GET /api/public/published-journeys/{tenant}/feed` — lista con locale, featured_only, limit
- `GET /api/portfolio/public/{tenant}/projects` — lista da `portfolio_projects` (VUOTA)
- `GET /api/portfolio/public/{tenant}/{slug}` — dettaglio da `portfolio_projects` (VUOTA)

**Endpoint admin esistenti:**
- `GET/POST /api/portfolio/admin/projects` — CRUD su `portfolio_projects`
- `POST /api/portfolio/admin/projects/{id}/compose` — compose variant AI
- `POST /api/portfolio/admin/variants/{vid}/publish` — pubblica variante

> **GAP CRITICO:** Non esiste endpoint admin per gestire `published_design_journeys` direttamente.  
> Il Blueprint (`ProjectsStudioPage`) scrive su `portfolio_projects`, ma il frontend pubblico legge da `published_design_journeys`.  
> **Questi due sistemi non sono sincronizzati.**

---

### 2.3 Gap Projects — Classificazione

| Gap | Classificazione | Priorità |
|---|---|---|
| `DETAIL_LABELS`, `EDITORIAL_LOADING`, `EDITORIAL_EMPTY` dict hardcoded | **Hardcoded da rimuovere** | P0 |
| `ProjectDetailPage` legge da `portfolio_projects` (vuota) invece di `published_design_journeys` | **Esistente non cablato** | P0 |
| `ProjectsStudioPage` scrive su `portfolio_projects`, non su `published_design_journeys` | **Disallineamento architetturale** | P0 |
| Traduzioni progetti: solo 3/6 hanno `en-US`, nessuna altre lingue | **Gap contenuto** | P1 |
| `published_design_journeys` non ha endpoint admin per Blueprint | **Gap reale** | P1 |
| `gallery_asset_ids` in `published_design_journeys` è array di UUID, non URL diretti | **Gap reale** | P1 |
| `uiContent.archive` / `uiContent.detail` — hardcoded da `site/content/ui.js` | **Hardcoded da rimuovere** | P1 |
| `projectCategories` hardcoded da `site/content/projects.js` | **Hardcoded da rimuovere** | P1 |
| Hotspot progetti — `article_hotspots.linked_project_id` esiste, `hotspot_locale_variants` esiste ma vuota | **Esistente non cablato** | P2 |
| Client, designer, brand coinvolti — non modellati in `published_design_journeys` | **Feature da rimandare** | P3 |

---

## RIEPILOGO LEGEND

| Classificazione | Significato |
|---|---|
| **Già esistente e riutilizzabile** | Codice/struttura funzionante, da collegare |
| **Esistente non cablato** | Tabella/componente esiste ma non è usato nel flusso CMS |
| **Hardcoded da rimuovere** | Testo/logica hardcoded nel frontend da CMS-ificare |
| **Gap reale** | Feature/campo necessario, da implementare |
| **Feature da rimandare** | Desiderabile ma fuori scope corrente |

---

## SOURCE OF TRUTH DEFINITIVO

| Surface | Source of Truth attuale | Source of Truth target |
|---|---|---|
| Magazine (lista pubblica) | `magazine_articles.locale_content` | STESSO — ma con `resolveLocaleBag` |
| Magazine (articolo) | `magazine_articles.body_blocks` | STESSO — ma con blocchi BCP-47 |
| Magazine (SEO per locale) | NESSUNO (hardcoded) | `article_localizations` |
| Magazine (UI labels) | `COPY`/`T` dict hardcoded | `cms_sections` (magazine_index, magazine_article) |
| Projects (lista pubblica) | `published_design_journeys` | STESSO — diretto |
| Projects (dettaglio pubblico) | `portfolio_projects` (VUOTA) | `published_design_journeys` — da cablare |
| Projects (traduzioni) | `published_design_journey_translations` | STESSO — da completare |
| Projects (Blueprint admin) | `portfolio_projects` | Da decidere (vedi P0 gap) |
| Projects (UI labels) | `DETAIL_LABELS` hardcoded | `cms_sections` (projects_index, projects_detail) |
