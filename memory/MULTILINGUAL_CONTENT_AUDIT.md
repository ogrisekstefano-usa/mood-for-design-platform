# MULTILINGUAL CONTENT AUDIT — MAGAZINE & PROJECTS
**Sprint:** Magazine & Projects CMS Completion  
**Data:** 2026-06-20  
**Scope:** Copertura multilingual per Magazine e Projects  

---

## METODOLOGIA

1. Inventario dei locale attivi nel DB (`locale_profiles`)
2. Analisi delle chiavi `locale_content` in `magazine_articles`
3. Analisi delle traduzioni in `published_design_journey_translations`
4. Identificazione gap tra locale supportati e contenuto disponibile
5. Verifica che il frontend usi correttamente le chiavi BCP-47

---

## LOCALE ATTIVI NEL DATABASE

| Codice DB | BCP-47 | Lingua | Mercato | Status |
|---|---|---|---|---|
| `IT_IT` | `it-IT` | Italiano | IT | Attivo |
| `EN_US` | `en-US` | English | US | Attivo |
| `EN_GB` | `en-GB` | English | GB | Attivo |
| `EN_AE` | `en-AE` | English | AE | Attivo |
| `FR_FR` | `fr-FR` | Français | FR | Attivo |
| `DE_DE` | `de-DE` | Deutsch | DE | Attivo |
| `ES_ES` | `es-ES` | Español | ES | Attivo |

---

## PARTE 1 — COPERTURA MULTILINGUAL MAGAZINE

### 1.1 Locale keys in `magazine_articles.locale_content`

**Chiavi usate attualmente:**

| Chiave | Tipo | Articoli con questa chiave | Problema |
|---|---|---|---|
| `it` | Codice breve | 10/12 | NON è BCP-47 — `resolveLocaleBag` cerca `it-IT` |
| `en` | Codice breve | 8/12 | NON è BCP-47 — `resolveLocaleBag` cerca `en-US` |
| `fr`, `de`, `es` | Codice breve | 0/12 | Non presenti nel DB |

> **GAP CRITICO:** Tutte le chiavi esistenti sono codici brevi (`it`, `en`). Il nuovo `resolveLocaleBag` cerca prima `it-IT`, poi fa fallback su `it`. Il fallback funziona, ma la distinzione `en-US` vs `en-GB` è impossibile se il contenuto è solo `en`.

### 1.2 Copertura per Articolo

| Slug | `it` | `en` | `fr` | `de` | `es` | `en-GB` | `en-US` |
|---|---|---|---|---|---|---|---|
| arredare-il-silenzio | ✅ | ✅ | — | — | — | — | — |
| cucina-come-spazio-di-design | ✅ | — | — | — | — | — | — |
| cucina-manifesto-del-living | ✅ | ✅ | — | — | — | — | — |
| designing-for-privacy | ✅ | ✅ | — | — | — | — | — |
| designing-with-natural-light | — | ✅ | — | — | — | — | — |
| hospitality-design-2025 | ✅ | ✅ | — | — | — | — | — |
| luce-naturale-benessere | ✅ | — | — | — | — | — | — |
| marmo-luce-architettura | ✅ | ✅ | — | — | — | — | — |
| neutro-come-scelta-radicale | ✅ | ✅ | — | — | — | — | — |
| tendenze-2025-materiali | ✅ | — | — | — | — | — | — |
| the-kitchen-as-design | — | ✅ | — | — | — | — | — |
| 2025-material-trends | — | ✅ | — | — | — | — | — |

**Riepilogo Magazine:**
- Articoli con solo `it`: 3/12 (25%)
- Articoli con solo `en`: 3/12 (25%)
- Articoli con `it` + `en`: 6/12 (50%)
- Articoli con `fr`, `de`, `es`: 0/12 (0%)
- Articoli con BCP-47 (`it-IT`, `en-US`, `en-GB`): 0/12 (0%)

### 1.3 Gap Magazine Multilingual

| Locale Attivo | Copertura Attuale | Tipo Gap |
|---|---|---|
| `it-IT` / `it` | 75% (9/12) | Chiave breve — funziona via fallback |
| `en-US` / `en` | 75% (9/12) | Chiave breve — no distinzione US/GB |
| `en-GB` | 0% | NON SUPPORTATO |
| `fr-FR` / `fr` | 0% | NON SUPPORTATO |
| `de-DE` / `de` | 0% | NON SUPPORTATO |
| `es-ES` / `es` | 0% | NON SUPPORTATO |

### 1.4 UI Labels Magazine (MagazinePage + MagazineArticlePage)

| Label | Locale Coperto | Metodo | Status |
|---|---|---|---|
| Tutti i testi di interfaccia | `it`, `en`, `fr` | `COPY`/`T` dict hardcoded | **NON CMS** |
| Etichette categorie | `it`, `en` | `cat_label` dict hardcoded | **NON CMS** |
| Tipo hotspot (`TYPE_LABEL`) | `en` (solo) | Dict hardcoded | **NON MULTILINGUA** |
| CTA hotspot | `it`, `en` | `ctaCopy()` da dict | **NON CMS** |

---

## PARTE 2 — COPERTURA MULTILINGUAL PROJECTS

### 2.1 `published_design_journeys` — Copertura per Progetto

| Slug | Canonical | `en-US` (trans) | `en-GB` | `fr-FR` | `de-DE` | `es-ES` |
|---|---|---|---|---|---|---|
| boutique-suite-costiera | `it-IT` | — | — | — | — | — |
| penthouse-milano-porta-nuova | `it-IT` | — | — | — | — | — |
| residenza-in-campagna | `it-IT` | ✅ | — | — | — | — |
| spazio-di-lavoro-creativo | `it-IT` | ✅ | — | — | — | — |
| suite-boutique-waterfront | `it-IT` | ✅ | — | — | — | — |
| villa-lago-di-como | `it-IT` | — | — | — | — | — |

**Riepilogo Projects:**
- Progetti con solo `it-IT`: 3/6 (50%)
- Progetti con `it-IT` + `en-US`: 3/6 (50%)
- Progetti con `en-GB`, `fr-FR`, `de-DE`, `es-ES`: 0/6 (0%)

### 2.2 Campi Tradotti in `published_design_journey_translations`

| Campo | Tradotto | Note |
|---|---|---|
| `title` | ✅ | Presente nelle 3 traduzioni `en-US` |
| `editorial_excerpt` | ✅ | Presente |
| `atmosphere` | ✅ | Presente |
| `location` | ✅ | Presente |
| `seo_title` | ⚠️ | Presente nella tabella, ma spesso NULL |
| `seo_description` | ⚠️ | Presente nella tabella, ma spesso NULL |

### 2.3 UI Labels Projects (ProjectsIndexPage + ProjectDetailPage)

| Label | Locale Coperto | Metodo | Status |
|---|---|---|---|
| Loading editorial | `it-IT`, `en-US`, `en-GB`, `fr-FR`, `de-DE`, `es-ES` | `EDITORIAL_LOADING` dict HC | **NON CMS** |
| Empty state | `it-IT`, `en-US`, `en-GB`, `fr-FR`, `de-DE`, `es-ES` | `EDITORIAL_EMPTY` dict HC | **NON CMS** |
| DETAIL_LABELS (7 key × 6 locale) | 6 locale | `DETAIL_LABELS` dict HC | **NON CMS** |
| Categorie filtro | `it`, `en` | `projectCategories` HC | **NON CMS** |
| `uiContent.archive` / `uiContent.detail` | Varie | File JS statico | **NON CMS** |

---

## PARTE 3 — ANALISI `resolveLocaleBag` SU CONTENUTO ESISTENTE

Il nuovo `resolveLocaleBag(bag, fullLocale)` segue questa logica di fallback:
1. Cerca `bag[fullLocale]` (es: `bag['it-IT']`)
2. Cerca `bag[langCode(fullLocale)]` (es: `bag['it']`)
3. Cerca `bag['_default']`
4. Restituisce il primo valore non-null

**Impatto sul contenuto esistente:**

| Locale richiesto | Chiave nel DB | Trovato via | Risultato |
|---|---|---|---|
| `it-IT` | `it` | fallback langCode | ✅ Trovato |
| `en-US` | `en` | fallback langCode | ✅ Trovato |
| `en-GB` | `en` | fallback langCode | ✅ Trovato (ma nessuna distinzione US/GB) |
| `fr-FR` | nessuna | nessuna | ❌ Non trovato → empty |
| `de-DE` | nessuna | nessuna | ❌ Non trovato → empty |
| `es-ES` | nessuna | nessuna | ❌ Non trovato → empty |

> **Conclusione:** Con il `resolveLocaleBag` attuale, gli articoli mostrano contenuto per `it-IT` e `en-*` (via fallback langCode). Per `fr-FR`, `de-DE`, `es-ES` il contenuto è vuoto. EN-US e EN-GB non sono distinguibili.

---

## PARTE 4 — PIANO DI STANDARDIZZAZIONE CHIAVI

Per rispettare la regola BCP-47 e supportare la distinzione `en-US` / `en-GB`, le chiavi nel DB devono essere standardizzate.

### Migrazioni necessarie

| Tabella | Chiave attuale | Chiave target | Migrazione |
|---|---|---|---|
| `magazine_articles.locale_content` | `it` | `it-IT` | Renaming JSON keys |
| `magazine_articles.locale_content` | `en` | `en-US` | Renaming JSON keys |
| `article_hotspots.locale_content` | `it`, `en` | `it-IT`, `en-US` | Renaming JSON keys |
| `journal_article_blocks.locale_content` | varie | BCP-47 | Audit separato |

> **Nota:** La migrazione può essere eseguita con `UPDATE ... SET locale_content = locale_content - 'it' || jsonb_build_object('it-IT', locale_content->'it')` senza downtime.

> **Rischio:** Qualsiasi frontend che usa direttamente `locale_content['it']` smetterà di funzionare. Bisogna aggiornare PRIMA tutto il frontend per usare `resolveLocaleBag`, POI eseguire la migrazione DB.

---

## RIEPILOGO GAP MULTILINGUAL

| Superficie | Copertura `it-IT` | Copertura `en-US` | Copertura `en-GB` | `fr-FR` | `de-DE` | `es-ES` |
|---|---|---|---|---|---|---|
| Magazine (contenuto articoli) | 75% | 75% | 0% (via fallback en) | 0% | 0% | 0% |
| Magazine (UI labels) | HC | HC | HC | HC parziale | 0% | 0% |
| Projects (contenuto) | 100% | 50% | 0% | 0% | 0% | 0% |
| Projects (UI labels) | HC | HC | HC | HC | HC | HC |

> **HC = Hardcoded** — non proveniente dal CMS

---

## AZIONI RACCOMANDATE

| Priorità | Azione |
|---|---|
| P0 | Aggiornare `LOCALES` in `MagazineEditorPage` da `it/en/fr/de/es` a `it-IT/en-US/en-GB/fr-FR/de-DE/es-ES` |
| P0 | Sostituire `COPY`/`T` dict e `DETAIL_LABELS`/`EDITORIAL_LOADING` con CMS sections |
| P0 | Aggiornare tutti i `locale_content?.[locale]` con `resolveLocaleBag()` |
| P1 | Migrare chiavi `it` → `it-IT`, `en` → `en-US` in `magazine_articles.locale_content` |
| P1 | Completare traduzioni `en-GB` per i 12 articoli magazine |
| P1 | Completare traduzioni `en-GB` per i 6 progetti |
| P2 | Aggiungere contenuto `fr-FR` per almeno 5 articoli chiave |
| P2 | Aggiungere profilo `ES_MX` al DB `locale_profiles` |
