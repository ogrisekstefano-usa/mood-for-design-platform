# WHITE LABEL IDENTITY PLAN
## Studio Identity & White-Label Sprint — Report Analitico Completo

> **Data:** Giugno 2026  
> **Sprint:** STUDIO IDENTITY & WHITE LABEL SPRINT  
> **Vincolo architetturale:** ZERO nuove tabelle DB. Riutilizzare esclusivamente l'architettura CMS esistente.  
> **Obiettivo:** Verificare se il CMS attuale può supportare un sito completo per uno studio internazionale senza nuova architettura.

---

## 1. EXECUTIVE SUMMARY

**Verdetto: ✅ SÌ — il CMS attuale può supportare un sito completo per uno studio internazionale.**

Con i 37 `section_type` già presenti nel DB e le 4 tabelle principali (`cms_pages`, `cms_sections`, `magazine_articles`, `published_design_journeys`) è possibile costruire tutte le sezioni necessarie per un sito studio internazionale completo — inclusa la pagina `/about` — **senza creare nessuna nuova tabella**.

I gap reali sono 3 e tutti risolvibili con estensioni minori all'architettura esistente (aggiunta di page_key, route frontend, un campo branding).

---

## 2. INVENTARIO CMS — ARCHITETTURA CORRENTE

### 2.1 Tabelle Database (SSoT Pubblico)

| Tabella | Ruolo | Chiavi Rilevanti |
|---------|-------|-----------------|
| `tenants` | Identity master del tenant | `branding_settings` (JSONB: nome, tagline, logo, i18n) |
| `cms_pages` | Container di pagine | `page_key`, `status`, `published_revision_id` |
| `cms_sections` | Blocchi contenuto per pagina | `section_type`, `locale_content` (JSONB), `settings` (JSONB) |
| `magazine_articles` | Articoli editoriali | `slug`, `locale_content`, `body_blocks`, `cover_url`, `category_slug`, `status` |
| `published_design_journeys` | Progetti pubblici curati | `slug`, `title`, `editorial_excerpt`, `atmosphere`, `hero_url`, `material_tags`, `location`, `year` |
| `users_profile` | Team/fondatori | `first_name`, `last_name`, `avatar_url`, `short_bio`, `role_label`, `response_time_label` |
| `cms_assets` | Media registrati | `public_url`, `alt_text`, `focal_point`, `storage_bucket` |
| `tenant_atelier_identity` | Tema visuale | `logo_url`, `palette_override`, `accent_system`, `editorial_tone` |

### 2.2 CMS Page Keys (PAGE_KEYS)

```
home | projects | start_project | professionals | navigation | ui
```

**Stato attuale per il tenant `studio`:**
| Page Key | Status | Revision Pubblicata |
|----------|--------|---------------------|
| `home` | published | ✅ SÌ |
| `navigation` | published | ✅ SÌ |
| `projects` | draft | ❌ NO |
| `start_project` | draft | ❌ NO |
| `professionals` | draft | ❌ NO |
| `ui` | draft | ❌ NO |

### 2.3 Section Types — Registro Formale (storefront_registry.py)

**Categoria: Homepage (8 tipi)**
| Section Type | Descrizione | Uso |
|-------------|-------------|-----|
| `store_hero` | Hero cinematico full-bleed | Hero principale |
| `dual_cta` | Due pathway paralleli (Cliente · Pro) | CTA biforcata |
| `value_props` | 3 colonne editorial value | Pilastri del valore |
| `projects_preview` | Griglia progetti in evidenza | Portfolio teaser |
| `newsletter` | Iscrizione editoriale | Newsletter |
| `stats_band` | Dark band con numeri chiave | Statistiche studio |
| `magazine_grid` | Griglia articoli rivista | Magazine preview |
| `brand_logos` | Logo partner/brand | Trust strip |

**Categoria: Team Identity (1 tipo)**
| Section Type | Descrizione | Uso |
|-------------|-------------|-----|
| `team_identity_card` | Profilo team leaders — wired a `users_profile` | Chi siamo / fondatore |

**Categoria: Projects Archive (3 tipi)**
| Section Type | Descrizione | Uso |
|-------------|-------------|-----|
| `projects_hero` | Hero archivio progetti | Intro /projects |
| `projects_filters` | Filtri per tipologia | Filtro progetti |
| `projects_collection` | Lista completa progetti | Griglia progetti |

**Categoria: Professionals (3 tipi)**
| Section Type | Descrizione | Uso |
|-------------|-------------|-----|
| `pro_hero` | Gateway per A&D | Hero /professionals |
| `pro_benefits` | Benefici partnership | Lista vantaggi |
| `pro_intake_step` | Step intake professionisti | Wizard A&D |

**Categoria: Chrome (3 tipi)**
| Section Type | Descrizione | Uso |
|-------------|-------------|-----|
| `nav_top` | Header logo + link + CTA | Navigazione |
| `footer_columns` | Footer multi-colonna | Footer |
| `shared_ui_labels` | Label condivise UI | Stringhe UI |

**Categoria: Generic Blocks (4 tipi — riutilizzabili in qualsiasi pagina)**
| Section Type | Descrizione |
|-------------|-------------|
| `block_heading` | Titolo editoriale autonomo |
| `block_text` | Paragrafo editoriale |
| `block_image` | Immagine con caption e ratio |
| `block_video_youtube` | Embed YouTube responsive |

### 2.4 Section Types — Legacy (presenti nel DB, non nel registro formale)

Questi tipi esistono nel DB per il tenant `studio` (home page) ma **non sono più nel registro formale**. Continuano a funzionare in lettura pubblica ma non possono essere creati tramite API admin attuale:

| Section Type | Contenuto Attuale | Equivalente Formale |
|-------------|------------------|---------------------|
| `hero_editorial` | Hero principale con immagine, titolo, CTA | `store_hero` |
| `atmosphere_statement` | Manifesto studio + citazione | `block_text` + `block_heading` |
| `design_journey` | Steps "Come lavoriamo" | `value_props` |
| `cinematic_quote` | Final CTA + dual pathway | `dual_cta` |
| `editorial_footer` | Footer cols + logo + social | `footer_columns` |
| `professionals_cta` | CTA per architetti | `pro_hero` |
| `trust_marquee` | Brand names marquee | `brand_logos` |
| `editorial_grid` | Magazine 3-card grid | `magazine_grid` |
| `materials_carousel` | Carousel materiali | — (nessun equivalente formale) |
| `featured_design_journeys` | Griglia progetti + auto-feed | `projects_preview` |
| `magazine_highlights` | Articoli highlight | `magazine_grid` |
| `platform_pillars` | Pilastri valore | `value_props` |
| `editorial_triptych` | 3 immagini editoriali | `block_image` ×3 |
| `flexible_layout` | Layout libero | `block_*` |
| `curated_brands` | Selezione brand curata | `brand_logos` |

---

## 3. WHITE-LABEL COMPLETENESS AUDIT

### 3.1 Contenuti COMPLETAMENTE CMS-Driven ✅

| Elemento | Sorgente DB |
|----------|-------------|
| Hero image, titolo, CTA | `cms_sections.hero_editorial.locale_content` |
| Magazine articles | `magazine_articles` (6 articoli pubblicati: 3 IT + 3 EN) |
| Design journeys (progetti) | `published_design_journeys` (3 pubblicati: Como, Milano, Positano) |
| Navigation links | `cms_sections.nav_top.settings.links` |
| Footer columns | `cms_sections.editorial_footer.locale_content.it.cols` |
| Studio manifesto | `cms_sections.atmosphere_statement.locale_content` |
| Come lavoriamo (steps) | `cms_sections.design_journey.settings.steps` |
| Final CTA copy | `cms_sections.cinematic_quote.locale_content` |
| Professionals CTA | `cms_sections.professionals_cta.locale_content` |
| Trust/partner names | `cms_sections.trust_marquee.settings.brands` |
| Materials carousel | `cms_sections.materials_carousel.settings.swatches` |
| Team leaders | `users_profile` (via `/api/storefront/public/{slug}/team-leaders`) |

### 3.2 Contenuti Ancora HARDCODED / Platform-Branded ⚠️

| Elemento | File / Origine | Tipo Gap |
|----------|---------------|----------|
| Logo URL fallback | `brandAssets.js → MOOD_BRAND_LOGO_URL` | CRITICO: mostra logo MOOD quando non c'è override CMS |
| Logo Alt text | `brandAssets.js → MOOD_BRAND_ALT = 'MOOD for DESIGN™'` | MINORE: accessibilità |
| `tenants.branding_settings.public_brand_name` | DB | CRITICO: "MOOD for DESIGN" ancora nel DB |
| `tenants.branding_settings.tagline` | DB | MINORE: tagline attuale nel DB ma non esposta nel public |
| Logo URL firmato | `branding_settings.primary_logo_url` | TECNICO: signed URL da `tenant-assets` (expira) → Fix 0.3 |
| CSS class prefix `mfd-` | Tutti i file CSS | NON VISIBILE: non impatta UX, solo codice |

---

## 4. ANALISI GAP IDENTITÀ STUDIO

### 4.1 Identità Visiva

| Campo | Dove Vive | Stato |
|-------|-----------|-------|
| Logo primary | `branding_settings.primary_logo_url` | ⚠️ URL firmato (expira) — Fix 0.3 |
| Logo fallback | `brandAssets.js` | ⚠️ Hardcoded MOOD logo |
| Favicon | `branding_settings.favicon_url` | ✅ Configurabile |
| Nome studio | `branding_settings.public_brand_name` | ⚠️ Ancora "MOOD for DESIGN" |
| Tagline | `branding_settings.tagline` | ✅ Configurabile (non esposta frontend) |
| Palette | `tenant_atelier_identity.palette_override` | ✅ Configurabile |
| Tono editoriale | `tenant_atelier_identity.editorial_tone` | ✅ Configurabile |

### 4.2 Identità Testuale — Cosa Gestisce Già il CMS

| Elemento /about | Section Type | Già Disponibile |
|-----------------|-------------|-----------------|
| Manifesto studio | `atmosphere_statement` | ✅ — "Il design non è solo ciò che vedi. È come vivi." |
| Come lavoriamo | `design_journey` | ✅ — "Un progetto nasce dall'ascolto profondo." |
| Citazione fondatore | `atmosphere_statement._default.quote` | ✅ — campo disponibile |
| Fondatore / Team | `team_identity_card` + `users_profile` | ✅ — wired a DB |
| Servizi | `value_props` o `pro_benefits` | ✅ — tipi disponibili |
| Numeri / Territorio | `stats_band` | ✅ — tipo disponibile |
| Portfolio teaser | `projects_preview` o `featured_design_journeys` | ✅ — dati in DB |
| CTA contatto | `dual_cta` o `cinematic_quote` | ✅ — tipo disponibile |

### 4.3 Identità Testuale — Gap Reali (dati mancanti nel DB)

| Campo Necessario | Dove Andrebbe | Stato Attuale |
|-----------------|---------------|---------------|
| Studio founding year | Non c'è un campo dedicato | ⚠️ Non esiste — va in `stats_band` o `block_text` come testo |
| Territorio di operazione | Non c'è un campo dedicato | ⚠️ Non esiste — va in `stats_band` come "Italia · Europa · Medio Oriente" |
| Specializzazioni | Non c'è un campo dedicato | ⚠️ Non esiste — va in `value_props` come pilastri |
| Servizi dettagliati | Non c'è un campo dedicato | ⚠️ Non esiste — va in `value_props` o `pro_benefits` come items |
| Team bio/avatar | `users_profile.short_bio`, `avatar_url`, `role_label` | ✅ Schema esiste — ma i campi non sono riempiti per il team attuale |

**Nota importante:** I gap sopra NON richiedono nuove tabelle. Tutti i dati possono essere inseriti come contenuto testuale nelle sezioni CMS esistenti. Il CMS è già progettato per ospitare queste informazioni.

---

## 5. ARCHITETTURA PAGINA /ABOUT — ZERO NUOVE TABELLE

### 5.1 Approccio

La pagina `/about` può essere costruita aggiungendo `'about'` alla costante `PAGE_KEYS` in `storefront_registry.py` e creando le sezioni corrispondenti nel DB — **nessuna nuova tabella**, solo un nuovo `cms_pages` row con le sezioni appropriate.

### 5.2 Struttura Proposta (Section Composition)

```
/about — Pagina Studio Identity
═══════════════════════════════════════════════════════════════════
Sort  Section Type         Contenuto Proposto
────  ─────────────────    ───────────────────────────────────────
 10   store_hero           "Chi siamo" — immagine dello studio,
                            headline "Progettiamo relazioni, non solo spazi",
                            CTA "Inizia un progetto"

 20   atmosphere_statement  Manifesto — citazione fondatore,
                            testo filosofia, attributi chiave
                            (già presente con contenuto nel home.atmosphere_statement)

 30   team_identity_card    Il Team / Il Tuo Riferimento —
                            wired a users_profile.short_bio + avatar_url
                            (sezione già registrata + endpoint già funzionante)

 40   value_props           Approccio / Come Lavoriamo —
                            3 pilastri: Ascolto · Progetto · Realizzazione
                            (o: Residenziale · Ospitalità · Commerciale)

 50   stats_band            Numeri Studio — Anno fondazione, N° Progetti,
                            Paesi coperti, Anni di esperienza

 60   projects_preview      Portfolio Teaser — 3-4 progetti in evidenza
                            wired a published_design_journeys
                            (contenuto già in DB: Villa Como, Milano, Positano)

 70   dual_cta              Conclusione — "Hai un progetto?" / "Sei un professionista?"
                            CTA verso /begin-journey e /professionals
═══════════════════════════════════════════════════════════════════
```

### 5.3 Mapping Contenuto → Tabella

| Sezione /about | Tabella/Campo Sorgente | Dato Richiesto |
|----------------|------------------------|----------------|
| Hero | `cms_sections.store_hero.locale_content` | Titolo, immagine hero studio |
| Manifesto | `cms_sections.atmosphere_statement.locale_content` | Filosofia, citazione — già popolato |
| Team | `users_profile.avatar_url + short_bio + role_label` | Foto, bio, ruolo — da riempire |
| Servizi/Approccio | `cms_sections.value_props.settings.pillars` | 3 pilastri descrittivi |
| Numeri | `cms_sections.stats_band.settings.stats` | Anno, N° progetti, paesi |
| Progetti | `published_design_journeys` | Già presenti 3 progetti |
| CTA | `cms_sections.dual_cta.locale_content` | Copy CTA — adattabile da `cinematic_quote` |

### 5.4 Cosa Serve per Implementarlo

1. **Backend (5 minuti):** Aggiungere `'about'` a `PAGE_KEYS` in `storefront_registry.py`
2. **Backend (2 minuti):** Aggiungere `'about'` alla composizione default in `DEFAULT_PAGE_COMPOSITION`
3. **DB (script seed):** Creare il `cms_pages` row + 7 sezioni + pubblicare la revisione
4. **Frontend (30 min):** Creare `AboutPage.jsx` che usa `useStorefrontContent('about')` + sezione renderer (riusa `PageRenderer.jsx` esistente)
5. **Frontend (5 min):** Aggiungere route `/about` in `App.js`

---

## 6. REGISTRO GAP — CLASSIFICAZIONE DEFINITIVA

### GAP REALI (richiedono intervento)

| # | Gap | Impatto | Soluzione SENZA nuove tabelle | Priorità |
|---|-----|---------|-------------------------------|----------|
| G1 | `'about'` non in `PAGE_KEYS` | Blocco: non si può creare la pagina dal CMS | Aggiungere a costante Python + route frontend | P1 |
| G2 | Logo MOOD hardcoded in `brandAssets.js` | Il fallback mostra MOOD quando il tenant non ha logo nel CMS | Aggiornare `MOOD_BRAND_LOGO_URL` con placeholder neutro o rimuovere il fallback | P1 |
| G3 | `public_brand_name` = "MOOD for DESIGN" nel DB | L'API `/brand` espone nome MOOD ai client | UPDATE `tenants.branding_settings` | P1 |
| G4 | Logo URL firmato (expira 1 anno) | Immagini rotte dopo scadenza token | Migrare a `storefront-public` bucket (Fix 0.3) | P2 (deferred by user) |
| G5 | `users_profile.short_bio`, `avatar_url`, `role_label` vuoti per team attuale | `team_identity_card` non mostra nessun leader | Riempire i campi per gli utenti attivi | P2 |
| G6 | `MOOD_BRAND_ALT = 'MOOD for DESIGN™'` in brandAssets.js | Alt text non white-label | Cambiare a 'Studio' o stringa neutrale | P3 |

### PSEUDO-GAP (NON richiedono nuove tabelle)

| # | Pseudo-Gap | Motivo Non-Blocco |
|---|-----------|-------------------|
| PG1 | Nessun campo "anno fondazione" dedicato | Inseribile come contenuto testuale in `stats_band` o `block_text` |
| PG2 | Nessun campo "specializzazioni" dedicato | Inseribile in `value_props.settings.pillars` |
| PG3 | Nessun campo "territorio operativo" dedicato | Inseribile come statistica in `stats_band` o come body in `block_text` |
| PG4 | Nessun campo "servizi dettagliati" dedicato | Inseribile in `value_props` o `pro_benefits` |
| PG5 | Nessuna sezione `/about` nel frontend | Risolvibile con `PageRenderer.jsx` esistente |
| PG6 | Tipi legacy (`hero_editorial`, etc.) non nel registro formale | Continuano a funzionare in lettura; per nuove pagine usare i tipi formali |

---

## 7. CONTENUTI GIÀ PRONTI VS DA CREARE

### Già nel DB — Pronti all'Uso

- ✅ **3 Design Journeys** pubblicati con foto, excerpt, atmosphere, location, material_tags
- ✅ **6 Magazine Articles** pubblicati (3 IT + 3 EN) con cover, body, category
- ✅ **Manifesto studio** in `atmosphere_statement.locale_content.it/en`
- ✅ **Come lavoriamo** in `design_journey.locale_content.it/en`
- ✅ **Navigation links** (4 links attivi nel nav_top)
- ✅ **Footer columns** (Studio · Servizi · Contatti in IT)
- ✅ **Professionals CTA** copy IT + EN
- ✅ **Final CTA** copy IT + EN

### Da Creare per Completare l'Identità

- ⚠️ **Logo studio** — caricare logo in bucket pubblico + aggiornare `nav_top.settings.logo_url`
- ⚠️ **Nome studio** — aggiornare `branding_settings.public_brand_name`
- ⚠️ **Team profiles** — riempire `users_profile.short_bio + avatar_url + role_label` per admin/designer
- ⚠️ **Statistiche studio** — anno fondazione, N° progetti, paesi (da inserire in `stats_band`)
- ⚠️ **Immagine hero /about** — foto dello studio/fondatore/spazio (da caricare in `storefront-public`)
- ⚠️ **Hero /home** — l'immagine hero è un'URL Unsplash, non permanente (rischio futuro)

---

## 8. RACCOMANDAZIONE FINALE

### Strategia Raccomandata: CMS-FIRST, ZERO NEW TABLES

Il CMS attuale è **sufficiente** per costruire un sito completo per uno studio di interior design internazionale. La prova è che tutti i contenuti necessari — manifesto, team, progetti, magazine, navigazione, footer — hanno già una collocazione precisa nel DB attuale o nei tipi di sezione disponibili.

**Piano d'azione in ordine di priorità:**

```
FASE ALPHA — White-Label Blockers (P0/P1, ~2 ore)
  1. Aggiornare branding_settings.public_brand_name → nome reale studio
  2. Aggiornare MOOD_BRAND_ALT in brandAssets.js → testo neutro
  3. Aggiornare MOOD_BRAND_LOGO_URL → placeholder neutro / rimuovere fallback MOOD
  
FASE BETA — About Page (P1, ~4 ore)
  4. Aggiungere 'about' a PAGE_KEYS (storefront_registry.py)
  5. Script seed: creare cms_page + 7 sezioni + publish
  6. Frontend: AboutPage.jsx + route /about
  7. Aggiungere link /about alla navigazione (nav_top)

FASE GAMMA — Team Identity (P2, ~1 ora)  
  8. Riempire users_profile.short_bio + avatar_url + role_label per il team
  9. Abilitare team_identity_card nella home e nell'/about

FASE DELTA — Visual Polish (P2, ~2 ore)
  10. Caricare logo studio in storefront-public → aggiornare nav_top.settings.logo_url
  11. Fix 0.3: Migrare logo da signed URL a public URL (quando approvato)
```

### Impatto di Eventuali Estensioni Future

Se in futuro si volesse aggiungere funzionalità beyond CMS, l'unica tabella che avrebbe senso aggiungere è:

| Tabella Ipotetica | Contenuto | Alternativa con CMS |
|-------------------|-----------|---------------------|
| `studio_identity` | founding_year, specializations, territory, team_size | Sostituibile con `cms_sections.stats_band + value_props` — **NO nuova tabella** |
| `studio_services` | service items con immagini e prezzi | Sostituibile con `value_props.settings.pillars` — **NO nuova tabella** |
| `about_page_team` | team members con ruoli e bio | Già in `users_profile` — **NO nuova tabella** |

**Conclusione:** La proposta di aggiungere una tabella `studio_identity` separata sarebbe un'architettura prematura. Il CMS copre già tutti i casi d'uso reali.

---

## 9. STATO WHITE-LABEL — SEMAFORO

| Componente | Stato | Nota |
|-----------|-------|------|
| Homepage hero | 🟢 CMS | Gestito da `hero_editorial` |
| Manifesto studio | 🟢 CMS | Gestito da `atmosphere_statement` |
| Magazine | 🟢 CMS | Gestito da `magazine_articles` DB |
| Progetti | 🟢 CMS | Gestito da `published_design_journeys` |
| Navigazione | 🟢 CMS | Gestito da `nav_top` |
| Footer | 🟢 CMS | Gestito da `editorial_footer` |
| Materials | 🟢 CMS | Gestito da `materials_carousel` |
| Logo header | 🟡 PARZIALE | CMS override funziona; fallback MOOD ancora hardcoded |
| Brand name | 🔴 HARDCODED | `public_brand_name` = "MOOD for DESIGN" nel DB |
| Logo alt text | 🟡 PARZIALE | "Studio" in JSX ma `MOOD_BRAND_ALT` importato |
| Team identity | 🟡 VUOTO | `team_identity_card` funziona ma `users_profile` bio/avatar vuoti |
| Pagina /about | 🔴 MANCANTE | Non in `PAGE_KEYS`, no route frontend |

---

*Documento prodotto nell'ambito dello STUDIO IDENTITY & WHITE LABEL SPRINT — Giugno 2026*  
*Autore: E1 Agent | Tenant: `studio` (848354b9-a43e-4147-bdad-116fb93bd585)*
