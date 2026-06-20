# FRONTEND HARDCODED AUDIT
**Sprint:** Magazine & Projects CMS Completion  
**Data:** 2026-06-20  
**Scope:** MagazinePage, MagazineArticlePage, ProjectsIndexPage, ProjectDetailPage  

---

## METODOLOGIA

Per ogni file frontend pubblico si inventaria ogni istanza di:
1. Testo hardcoded (stringhe letterali in JSX)
2. Immagini hardcoded (URL statici)
3. CTA hardcoded (label o URL fissi)
4. Locale hardcoded (`locale === 'x'`, `startsWith`, `slice`, fallback dict)
5. Fallback hardcoded post-lookup CMS

---

## FILE 1 — `MagazinePage.jsx` (243 righe)

### TESTO HARDCODED

| Tipo | Riga | Contenuto | Lingua | Metodo attuale |
|---|---|---|---|---|
| UI Label | 20-38 | `COPY.it.eyebrow = 'MAGAZINE'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.title = 'Riferimenti progettuali curati'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.body = 'Atmosfere, materiali e palette selezionate…'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.readMin = 'min di lettura'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.empty = 'Stiamo curando i prossimi articoli.'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.f_all = 'Tutto'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.f_categories = 'Verticali'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.f_reading = 'Tempo di lettura'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.clear = 'Reset'` | IT | Dict statico |
| UI Label | 20-38 | `COPY.it.results = 'risultati'` | IT | Dict statico |
| UI Label | 26-31 | `COPY.en.*` | EN | Dict statico |
| UI Label | 32-37 | `COPY.fr.*` | FR | Dict statico |
| Categoria | 25 | `cat_label.residential = 'Residenza'` ecc. | IT | Dict statico |
| Header CTA | 111 | `'START PROJECT'` | EN (solo inglese!) | Hardcoded |
| Filtro TAGS | 163 | `'TAGS'` | — | Hardcoded |
| Loading | 184 | `'Loading…'` | EN | Hardcoded |

### IMMAGINI HARDCODED

| Tipo | Riga | Contenuto |
|---|---|---|
| Logo | 109 | `navigationContent.brand.logoSrc` — da `site/content/navigation.js` |

> `navigationContent` è un file statico, non CMS. Il logo non è editabile dal tenant senza modificare il codice.

### CTA HARDCODED

| Tipo | Riga | Label | URL | Note |
|---|---|---|---|---|
| Header CTA | 111 | `'START PROJECT'` | `/start-project` | Label EN hardcoded |

### LOCALE HARDCODED

| Tipo | Riga | Pattern | Problema |
|---|---|---|---|
| Dict lookup | 49 | `const c = COPY[locale] \|\| COPY.it` | Usa `locale` come chiave breve (`it`, `en`, `fr`). BCP-47 come `it-IT` non trova match. |
| Fallback | 200-202 | `a.locale_content?.[locale]?.kicker \|\| a.locale_content?.it?.kicker` | Non usa `resolveLocaleBag` — hardcoded fallback su `it` |
| Filtro | 103 | `catLabel()` — `c.cat_label[slug]` | Etichette categoria hardcoded nel COPY dict |

### RIEPILOGO MagazinePage

| Categoria | Count | Status |
|---|---|---|
| Testi UI hardcoded | 16 | DA MIGRARE SU CMS |
| Immagini hardcoded | 1 (logo) | DA CMS branding |
| CTA label hardcoded | 1 | DA CMS |
| Pattern locale legacy | 2 | DA FIX |

---

## FILE 2 — `MagazineArticlePage.jsx` (597 righe)

### TESTO HARDCODED

| Tipo | Riga | Contenuto | Note |
|---|---|---|---|
| UI Dict `T.it` | 23 | 20+ label IT (back, references, share, loading, notFound, readMin, saveCta, sendCta…) | Dict statico |
| UI Dict `T.en` | 24 | 20+ label EN | Dict statico |
| `TYPE_LABEL` | 38-42 | `material: 'Material'`, `fabric: 'Fabric'`, ecc. | EN-only, non traducibile |
| Logo | 489 | `navigationContent.brand.logoSrc` | Da CMS branding |
| Back label | 491 | `t.back = 'Magazine'` | Da T dict |
| Soft lead form | 180 | `'DESIGN REFERENCES'` | Hardcoded EN |
| Perspective badge | 515 | `'{localeServed} Perspective'` | EN hardcoded |
| Footer refs | 542 | `'{n} curated'` | EN hardcoded |

### LOCALE HARDCODED

| Tipo | Riga | Pattern | Problema |
|---|---|---|---|
| Dict lookup | 378 | `const t = T[locale] \|\| T.it` | Usa `locale` come chiave breve. BCP-47 non trova match. |
| Dict lookup | 141 | `const t = T[locale] \|\| T.it` (SoftLeadModal) | Idem |
| Content lookup | 470 | `a.locale_content?.[locale] \|\| a.locale_content?.it` | Non usa `resolveLocaleBag` |
| Block lookup | 234 | `b.locale_content[locale] \|\| b.locale_content.it` | Non usa `resolveLocaleBag` |
| Related card | 552 | `r.locale_content?.[locale] \|\| r.locale_content?.it` | Non usa `resolveLocaleBag` |
| ctaCopy fn | 27-36 | `T[locale] \|\| T.it` | Idem |

### CTA HARDCODED

| Tipo | Riga | Label | URL | Note |
|---|---|---|---|---|
| CTA blocco | 357 | `b.label` (da DB) | `/start-project` | URL hardcoded |
| CTA finale | n/a | n/a | n/a | — |

### RIEPILOGO MagazineArticlePage

| Categoria | Count | Status |
|---|---|---|
| Testi UI hardcoded | 25+ | DA MIGRARE SU CMS |
| Immagini hardcoded | 1 (logo) | DA CMS branding |
| CTA URL hardcoded | 1 | DA CMS |
| Pattern locale legacy | 6 | DA FIX con `resolveLocaleBag` |

---

## FILE 3 — `ProjectsIndexPage.jsx` (284 righe)

### TESTO HARDCODED

| Tipo | Riga | Contenuto | Note |
|---|---|---|---|
| Loading dict | 48-55 | `EDITORIAL_LOADING.{'it-IT': '...', 'en-US': '...', 'fr-FR': '...', ...}` | 6 locale hardcoded |
| Empty dict | 57-64 | `EDITORIAL_EMPTY.{'it-IT': '...', 'en-US': '...', ...}` | 6 locale hardcoded |
| Page title | 112 | `'Design Journeys™ — MOOD for DESIGN™'` | EN hardcoded |

### DATI HARDCODED

| Tipo | Riga | Contenuto | Note |
|---|---|---|---|
| Categorie filtro | 22 | `import { projectCategories } from '../../site/content/projects'` | 7 categorie hardcoded in JS |
| UI labels (archive) | 23 | `import { uiContent } from '../../site/content/ui'` | 15+ label hardcoded in JS |
| CTA label | 199 | `positioningCtas.primary` | Da market positioning, non CMS |

### LOCALE HARDCODED

| Tipo | Riga | Pattern | Problema |
|---|---|---|---|
| Dict lookup | 120-121 | `EDITORIAL_LOADING[locale] \|\| EDITORIAL_LOADING['en-US']` | BCP-47 OK se la chiave esiste, ma se `en-GB` non trova → fallback `en-US` |
| toBcp47Storefront | 82 | `toBcp47Storefront(locale)` | Funzione di conversione potenzialmente legacy |

### CTA HARDCODED

| Tipo | Riga | Label | URL | Note |
|---|---|---|---|---|
| Final CTA | 198 | `positioningCtas.primary` | `/onboarding/private` | URL hardcoded |
| Final CTA | 201 | `positioningCtas.secondary` | `/onboarding/pro` | URL hardcoded |

### RIEPILOGO ProjectsIndexPage

| Categoria | Count | Status |
|---|---|---|
| Testi UI hardcoded | 12+ | DA MIGRARE SU CMS |
| Categorie hardcoded | 7 | DA MIGRARE SU CMS |
| CTA URL hardcoded | 2 | DA CMS settings |
| Pattern locale | 2 | Accettabili se DB ha le chiavi |

---

## FILE 4 — `ProjectDetailPage.jsx` (644 righe)

### TESTO HARDCODED — CRITICO

| Tipo | Riga | Contenuto | Note |
|---|---|---|---|
| Loading dict | 31-38 | `EDITORIAL_LOADING` per 6 locale | Hardcoded |
| UI Labels dict | 41-48 | `DETAIL_LABELS` per 6 locale × 9 label | **192 stringhe hardcoded** |
| UI labels (detail) | 24 | `import { uiContent } from '../../site/content/ui'` | Hardcoded |
| `labelsFor()` fn | 48 | Fallback `DETAIL_LABELS['en-US']` | Hardcoded |

**`DETAIL_LABELS` dettaglio:**

| Label Key | IT | EN-US | EN-GB | FR-FR | DE-DE | ES-ES |
|---|---|---|---|---|---|---|
| `angle` | `'Cultural angle'` | `'Cultural angle'` | `'Cultural angle'` | `'Angle culturel'` | `'Kultureller Winkel'` | `'Ángulo cultural'` |
| `atmosphere` | `'Materia · ritmo...'` | `'Material · pacing...'` | `'Material · pacing...'` | `'Matière · rythme...'` | `'Material · Rhythmus...'` | `'Materia · ritmo...'` |
| `body` | `'Lettura'` | `'Reading'` | `'Reading'` | `'Lecture'` | `'Lektüre'` | `'Lectura'` |
| `gallery` | `'Galleria'` | `'Gallery'` | `'Gallery'` | `'Galerie'` | `'Galerie'` | `'Galería'` |
| `materials` | `'Vocabolario materico'` | `'Material vocabulary'` | `'Material vocabulary'` | `'Vocabulaire matériel'` | `'Materialvokabular'` | `'Vocabulario material'` |
| `back` | `'Torna ai progetti'` | `'Back to projects'` | `'Back to projects'` | `'Retour aux projets'` | `'Zurück zu Projekten'` | `'Volver a...'` |
| `beginCta` | `'Inizia il dialogo'` | `'Begin the dialogue'` | `'Begin the dialogue'` | `'Commencer le dialogue'` | `'Den Dialog beginnen'` | `'Iniciar el diálogo'` |

### DATI HARDCODED

| Tipo | Riga | Contenuto | Note |
|---|---|---|---|
| Fallback progetto | 84, 88-89 | `findProjectBySlug(slug)` da `site/content/projects` | Dati fake legacy |
| UI detail | 24 | `uiContent.detail` | Hardcoded da file JS |
| CTA URL | 315 | `<Link to="/start-project">` | URL hardcoded nel blocco CTA |
| CTA URL | 477 | `<Link to="/onboarding/private">` | URL hardcoded |
| CTA URL | 481 | `<Link to="/projects">` | URL hardcoded |

### PROBLEMA ARCHITETTURALE CRITICO

> **`ProjectDetailPage.jsx` legge da `portfolio_projects` (0 record) invece di `published_design_journeys` (6 record).**  
> L'endpoint `GET /api/portfolio/public/{tenant}/{slug}` non trova nessun progetto → fallback a `findProjectBySlug()` → dati fake da `site/content/projects.js`.  
> **Tutti i dettagli di progetto mostrano dati fake in produzione.**

### LOCALE HARDCODED

| Tipo | Riga | Pattern | Problema |
|---|---|---|---|
| `labelsFor()` | 48, 56 | `DETAIL_LABELS[locale] \|\| DETAIL_LABELS['en-US']` | Locale BCP-47 trova match se la chiave è esatta |
| `storyBody` text | 252 | `b.text` (flat, no locale_content) | Contenuto story_body non multilingua |
| `hotspot tip` | 627-628 | `active.title`, `active.description` | Non usa `locale_content` degli hotspot |

### RIEPILOGO ProjectDetailPage

| Categoria | Count | Status |
|---|---|---|
| Testi UI hardcoded | 50+ (DETAIL_LABELS) | DA MIGRARE SU CMS |
| Dati fake legacy | 1 (findProjectBySlug) | DA RIMUOVERE |
| CTA URL hardcoded | 3 | DA CMS settings |
| Disallineamento DB | 1 (portfolio_projects vs published_journeys) | BUG ARCHITETTURALE P0 |
| Hotspot non multilingua | 1 | DA FIX |

---

## RIEPILOGO GLOBALE

| File | Testi HC | Immagini HC | CTA HC | Locale HC | Problema arch. |
|---|---|---|---|---|---|
| MagazinePage | 16+ | 1 | 1 | 2 | — |
| MagazineArticlePage | 25+ | 1 | 1 | 6 | — |
| ProjectsIndexPage | 12+ | 0 | 2 | 2 | — |
| ProjectDetailPage | 50+ | 0 | 3 | 4 | **CRITICO** |
| **TOTALE** | **103+** | **2** | **7** | **14** | **1** |

---

## PRIORITÀ DI FIX

| Priorità | Fix | File | Impatto |
|---|---|---|---|
| **P0** | Cablare `ProjectDetailPage` su `published_design_journeys` | ProjectDetailPage.jsx | Risolve dati fake in prod |
| **P0** | Sostituire `COPY`/`T` dict con CMS section `magazine_index`/`magazine_article` | MagazinePage, MagazineArticlePage | BCP-47 end-to-end |
| **P0** | Sostituire `EDITORIAL_LOADING`/`DETAIL_LABELS` con CMS section `projects_index`/`projects_detail` | ProjectsIndexPage, ProjectDetailPage | Multilingua reale |
| **P1** | Usare `resolveLocaleBag` per tutti i lookup `locale_content` | Tutti e 4 i file | Fallback BCP-47 corretto |
| **P1** | Rimuovere `findProjectBySlug` (fake data) | ProjectDetailPage | Rimuove dati fake |
| **P1** | Rimuovere `projectCategories` hardcoded, leggerle da API/CMS | ProjectsIndexPage | CMS-driven |
| **P2** | Rimuovere `navigationContent.brand.logoSrc` → CMS branding | MagazinePage, MagazineArticlePage | White-label |
| **P2** | CTA URL hardcoded → CMS settings | Tutti | White-label |
