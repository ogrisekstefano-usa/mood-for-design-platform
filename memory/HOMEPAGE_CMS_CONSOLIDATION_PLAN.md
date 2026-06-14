# HOMEPAGE CMS CONSOLIDATION PLAN
## MOOD for DESIGN — Piano di Implementazione Homepage CMS-Driven
**Data:** Giugno 2026  
**Stato:** PIANO (Non implementare fino ad approvazione utente)  
**Prerequisito:** Review e approvazione del `UX_UI_CONVERSION_MASTER_REPORT.md`

---

## CONTESTO

La homepage pubblica è la **landing white-label dello studio** che utilizza MOOD.  
L'obiettivo è generare contatti qualificati da clienti privati, architetti, interior designer, developer, contractor e professionisti.

**Posizionamento target:**
- Luxury Interior Design ✅
- Editorial Experience ✅
- Italian Design Culture ✅
- Premium Studio ✅

**NON deve comunicare:**
- Software / CRM / SaaS ❌
- Moodboard Tool ❌

---

## FASE 0 — PREREQUISITI TECNICI (P0, prima di tutto)

Questi fix devono essere eseguiti **prima** di qualsiasi lavoro CMS o homepage.  
Sono bloccanti. Senza questi, nessun contenuto CMS sarà visibile.

### Fix 0.1 — Tenant Slug Detection
**File**: `/app/frontend/src/pages/site/HomePage.jsx` (riga 784-792)  
**Problema**: Il preview URL `i18n-recovery-1.preview.emergentagent.com` genera slug `i18n-recovery-1` invece di `studio`.  
**Fix**: Aggiungere pattern di riconoscimento per domini `.preview.emergentagent.com`

```javascript
// CORRENTE (riga 789-791):
if (first.startsWith('content-hub-pro-')) return 'studio';
if (PLATFORM.some((h) => first === h || first.startsWith(h))) return 'studio';

// CORRETTO:
if (first.startsWith('content-hub-pro-')) return 'studio';
if (host.includes('.preview.emergentagent.com')) return 'studio';  // ADD
if (PLATFORM.some((h) => first === h || first.startsWith(h))) return 'studio';
```

**Impatto DB**: Nessuno  
**Impatto Frontend**: 1 riga  
**Impatto Blueprint**: Nessuno  
**Risultato**: Homepage carica immediatamente le 21 sezioni CMS già configurate

### Fix 0.2 — Debug Bar Visibilità Pubblica
**File**: Da identificare (componente `EditorialBridge` o `LocalizationOverlay`)  
**Problema**: "EDITORIAL · DEBUG runtime 3 · missing 0" visibile su ogni pagina pubblica  
**Fix**: Condizionare la visibilità a `process.env.NODE_ENV === 'development'` o rimuovere dal bundle di produzione  
**Impatto DB**: Nessuno

### Fix 0.3 — Hero Image in Bucket Pubblico
**Problema**: L'immagine hero è in `tenant-assets` (bucket privato) con URL firmata che scade  
**Azione**: Riacquisire l'upload verso il bucket `storefront-public` già esistente  
**Impatto DB**: Update del campo `locale_content.it.image` nella sezione `hero_editorial`

---

## FASE 1 — AUDIT MODULI ESISTENTI

### 1.1 Moduli CMS Esistenti (da riutilizzare)

| Modulo | Tabella/Router | Utilizzabile Per |
|---|---|---|
| CMS Pages | `cms_pages` | Struttura di ogni pagina pubblica |
| CMS Sections | `cms_sections` | Ogni sezione della homepage |
| Editorial Articles | `editorial_articles` | Section 6 — Magazine |
| Published Design Journeys | `published_design_journeys` | Section 4 — Projects |
| Categories | `design_journey_categories` | Filtri progetti |
| Tags | `design_journey_tags` | Filtri e selezione featured |
| Brands | `brands` | Partner logos (Section 3 o trust strip) |
| Materials | `materials` | Materials carousel |
| Inspirations | `inspirations` | Digital Discovery Experience |
| Storefront Section Registry | `storefront_registry.py` | Registro tipi sezione Blueprint |

### 1.2 Blueprint Admin Routes Esistenti

| Route | Funzione |
|---|---|
| `/api/storefront/admin/{tenant}/pages` | Lista pagine CMS |
| `/api/storefront/admin/{tenant}/pages/{page_key}` | CRUD pagina |
| `/api/storefront/admin/{tenant}/pages/{page_key}/sections` | CRUD sezioni |
| `/api/storefront/admin/{tenant}/pages/{page_key}/sections/reorder` | Riordino sezioni |
| `/api/storefront/admin/{tenant}/pages/{page_key}/publish` | Pubblicazione |
| `/api/storefront/public/{tenant}/pages/{page_key}` | Lettura pubblica |

**Conclusione**: L'infrastruttura CMS è **già completa**. Non serve creare nuove API.

### 1.3 Stato Attuale Homepage CMS (21 sezioni già presenti)

```
cms_pages.home (tenant: studio) → status: None (non ancora pubblicata)
Sezioni esistenti:
  hero_editorial          ✅ Locale content IT/EN configurato
  design_journey          ⚠️  Struttura presente, steps vuoti
  editorial_grid          ✅ Locale content IT/EN configurato
  trust_marquee           ✅ Locale content IT/EN configurato
  featured_design_journeys ✅ Locale content IT/EN configurato
  materials_carousel       ✅ Locale content IT/EN configurato
  cinematic_quote          ✅ Locale content IT/EN configurato
  editorial_footer         ✅ Locale content IT/EN configurato
  atmosphere_statement     ✅ Locale content IT/EN configurato
  magazine_highlights      ✅ Locale content IT/EN configurato
  professionals_cta        ✅ Locale content IT/EN configurato
  footer                   ⚠️  Locale content vuoto
  navigation               ⚠️  Locale content vuoto
  curated_brands           ⚠️  Locale content vuoto
  platform_pillars         ⚠️  Locale content vuoto
  editorial_triptych       ⚠️  Locale content vuoto
  final_cta_immersive      ⚠️  Locale content vuoto
  flexible_layout (x2)     ⚠️  Locale content vuoto
  block_heading            ⚠️  Solo _default
  block_text               ⚠️  Solo _default
```

---

## FASE 2 — MAPPA SEZIONI HOMEPAGE TARGET

### Struttura Target (ispirata al riferimento Studio Rinaldi)

```
┌─────────────────────────────────────────────────────────┐
│  SECTION 1 — HERO                                       │
│  hero_editorial (ESISTE — Fix 0.1 sblocca)              │
├─────────────────────────────────────────────────────────┤
│  SECTION 2 — HOW WE WORK                                │
│  design_journey (ESISTE — da popolare con steps)        │
├─────────────────────────────────────────────────────────┤
│  SECTION 3 — STUDIO INTRODUCTION                        │
│  atmosphere_statement (ESISTE) + NUOVA studio_intro     │
├─────────────────────────────────────────────────────────┤
│  SECTION 4 — PROJECTS                                   │
│  featured_design_journeys (ESISTE — 0 content)         │
├─────────────────────────────────────────────────────────┤
│  SECTION 5 — DIGITAL DISCOVERY EXPERIENCE               │
│  NUOVA: digital_discovery (da aggiungere al registry)   │
├─────────────────────────────────────────────────────────┤
│  SECTION 6 — MAGAZINE                                   │
│  editorial_grid (ESISTE) → da unificare con             │
│  magazine_highlights (DUPLICATO — da rimuovere)         │
├─────────────────────────────────────────────────────────┤
│  SECTION 7 — FINAL CTA                                  │
│  cinematic_quote (ESISTE — mancano phone/email)         │
└─────────────────────────────────────────────────────────┘
```

---

## FASE 3 — ANALISI DETTAGLIATA PER SEZIONE

### Section 1 — HERO

**Sezione CMS esistente**: `hero_editorial`  
**Status**: ✅ CONTENUTO PRESENTE — bloccato da Fix 0.1  
**Campi attuali** (già configurati):
```json
{
  "title": "Il tuo spazio.\nIl tuo Design Journey™.",
  "sub": "Inizia un'esperienza di design personale con studi italiani di alta gamma.",
  "image": "https://...supabase.co/sign/tenant-assets/...",
  "eyebrow": "...",
  "cta_primary": "...",
  "cta_secondary": "..."
}
```

**Azioni necessarie**:
- [ ] Fix 0.1 (tenant slug) — sblocca questa sezione
- [ ] Fix 0.3 (bucket pubblico) — sostituire URL firmata con URL pubblica
- [ ] Supporto video/slideshow: aggiungere campo `video_url` e `media_type` (enum: image/video/slideshow)
- [ ] Aggiornare titolo: rimuovere "Design Journey™" → titolo da CMS dello studio
- [ ] Supportare overlay opacity da Blueprint

**Campi da aggiungere al settings**:
```json
{
  "media_type": "image | video | slideshow",
  "video_url": "",
  "slides": [],
  "overlay_opacity": 0.4,
  "text_alignment": "left | center"
}
```

**Impatto DB**: Nessuna nuova tabella — aggiunta campi in `settings` JSONB  
**Impatto Frontend**: Aggiornare `Hero` component per gestire video/slideshow  
**Impatto Blueprint**: Editor Hero arricchito con controllo media type

---

### Section 2 — HOW WE WORK

**Sezione CMS esistente**: `design_journey`  
**Status**: ⚠️ Struttura presente, steps vuoti  
**Problema**: Frontend `HowItWorks` component controlla `copy.howitworks.steps.length`. Se vuoto → EmptyEditorialSlot.

**Campi attuali settings** (già nel registry):
```json
{
  "steps": [],
  "links": [],
  "media": {}
}
```

**Azioni necessarie**:
- [ ] Popolare `settings.steps` con i 4 passi (Ascolto, Progetto, Selezione, Realizzazione)
- [ ] Aggiungere campo `step_icon` per ogni passo
- [ ] Aggiungere supporto per numero step variabile (già presente via array)
- [ ] Blueprint UI: form per aggiungere/rimuovere step

**Struttura step target**:
```json
{
  "step_number": "01",
  "step_title": {"it": "Ascolto", "en": "Listen"},
  "step_description": {"it": "Conosciamo le tue esigenze...", "en": "..."},
  "step_icon": "ear"
}
```

**Impatto DB**: Nessuno — modifica JSONB `settings`  
**Impatto Frontend**: Nessuno — componente già gestisce `steps` array  
**Impatto Blueprint**: Aggiungere form "aggiungi passo" nell'editor `design_journey`

---

### Section 3 — STUDIO INTRODUCTION

**Sezione CMS esistente**: `atmosphere_statement` (parziale)  
**Status**: ⚠️ Esiste ma non copre tutti i campi necessari  
**Campi necessari** (da spec utente):
- `title` ✅ (in `atmosphere_statement`)
- `subtitle` ⚠️ (forse presente)
- `body` ✅ (in `atmosphere_statement`)
- `image` — manca supporto foto team
- `video` — non presente
- `cta` — non presente

**Raccomandazione**: NON creare nuova sezione. Estendere `atmosphere_statement` con:
```json
{
  "team_image_url": "",
  "team_video_url": "",
  "cta_label": {"it": "Scopri di più su di noi", "en": "Learn more about us"},
  "cta_href": "/about"
}
```

**Alternativa** (se `atmosphere_statement` è già usata per altro scopo): creare tipo `studio_introduction` nel registry storefront.

**CRITICAL RULE**: Verificare prima se `atmosphere_statement` è usata altrove per evitare conflitti.

**Impatto DB**: Nessuno — modifica JSONB  
**Impatto Frontend**: Aggiungere componente `StudioIntro` (o estendere `AtmosphereStatement`)  
**Impatto Blueprint**: Aggiungere editor con upload foto team

---

### Section 4 — PROJECTS

**Sezione CMS esistente**: `featured_design_journeys`  
**Modulo dati**: `published_design_journeys` (tabella esistente)  
**Status**: ✅ Struttura CMS presente — 0 contenuti pubblicati  

**Azione principale**: Pubblicare progetti tramite Blueprint (nessun codice necessario)  
- Aprire Blueprint → Design Journeys → selezionare journeys → pubblicare
- La sezione homepage mostra automaticamente i featured journeys

**Configurazione da Blueprint** (campi già in `featured_design_journeys.settings`):
```json
{
  "source": "featured_flag | category | tag | manual",
  "category_filter": null,
  "tag_filter": null,
  "max_items": 3,
  "card_layout": "grid | carousel"
}
```

**Campi per ogni project card** (già nel modulo `published_design_journeys`):
- `hero_url` → immagine cover ✅
- `title` → titolo ✅
- `location` → località ✅
- `atmosphere` → categoria/atmosfera ✅
- `slug` → URL dettaglio ✅

**Non è necessario nessun nuovo codice** — solo pubblicare contenuto.

**Impatto DB**: Nessuno  
**Impatto Frontend**: Nessuno  
**Impatto Blueprint**: Workflow pubblicazione journeys già presente

---

### Section 5 — DIGITAL DISCOVERY EXPERIENCE

**Sezione CMS esistente**: NON ESISTE come tipo distinto  
**Sezione più vicina**: Frammenti in `editorial_triptych`, `cinematic_quote`  
**Moduli esistenti riutilizzabili**: `inspirations`, `discover_brief` flow

**Descrizione**: La sezione spiega il processo digitale:
1. Ispirazioni (raccogli immagini e idee)
2. Preferenze (indica stili, materiali, obiettivi)
3. Il tuo brief (raccontaci esigenze e obiettivi)
4. Il tuo progetto (ricevi una proposta su misura)

**Raccomandazione**: Creare nuovo tipo `digital_discovery_experience` nel `storefront_registry.py`

```python
{
    "type": "digital_discovery_experience",
    "category": "homepage",
    "label": "Digital Discovery Experience",
    "description": "Sezione che spiega il processo digitale: ispirazioni → preferenze → brief → progetto.",
    "icon": "Sparkles",
    "reusable_in": ["home"],
    "schema": {
        "eyebrow":          {"type": "string", "i18n": True, "max": 80},
        "title":            {"type": "richtext", "i18n": True, "max": 300},
        "body":             {"type": "richtext", "i18n": True, "max": 600},
        "cta_label":        {"type": "string", "i18n": True},
        "cta_href":         {"type": "string"},
        "steps": {
            "type": "array",
            "item": {
                "icon":        {"type": "string"},
                "title":       {"type": "string", "i18n": True},
                "description": {"type": "richtext", "i18n": True},
            }
        }
    },
    "defaults": {
        "cta_href": "/begin-journey",
        "steps": []
    }
}
```

**Impatto DB**: Nessuna nuova tabella — nuovo tipo sezione in `storefront_registry.py`  
**Impatto Frontend**: Nuovo componente `DigitalDiscovery` in `HomePage.jsx`  
**Impatto Blueprint**: Nuovo editor per tipo `digital_discovery_experience`

---

### Section 6 — MAGAZINE

**Sezioni CMS esistenti**: `editorial_grid` + `magazine_highlights` (DOPPIONE)  
**Modulo dati**: `editorial_articles` (tabella esistente)  
**Status**: ⚠️ Struttura duplicata — da unificare  
**Contenuto**: 0 articoli pubblicati

**Problema identificato**: `editorial_grid` e `magazine_highlights` sono due sezioni di tipo diverso che svolgono la stessa funzione. Questo causa confusione in Blueprint e rendering incoerente.

**Raccomandazione**:
1. Mantenere `editorial_grid` come tipo canonico
2. Deprecare `magazine_highlights` nella homepage CMS (impostare `visible: false`)
3. Configurare `editorial_grid` per rispettare:
   - `country_targeting` (già supportato da `editorial_articles`)
   - `locale_targeting` (già supportato)
   - `publication_status` (già supportato)

**Configurazione `editorial_grid.settings`** (estendere campi esistenti):
```json
{
  "source": "manual | auto_latest | featured | category",
  "category_filter": null,
  "locale_targeting": true,
  "country_targeting": true,
  "max_items": 3,
  "manual_article_ids": []
}
```

**Azione principale**: Pubblicare 3 articoli Magazine tramite Blueprint.

**Impatto DB**: Nessuno  
**Impatto Frontend**: Aggiornare `Magazine` component per selezione article da DB + country targeting  
**Impatto Blueprint**: Configurare filtri `editorial_grid`; deprecare `magazine_highlights`

---

### Section 7 — FINAL CTA

**Sezione CMS esistente**: `cinematic_quote`  
**Status**: ✅ Locale content IT/EN configurato  
**Campi mancanti**: `phone`, `email`, `secondary_cta_label`, `secondary_cta_href`

**Aggiungere a `cinematic_quote.settings`**:
```json
{
  "phone": "+39 02 1234567",
  "email": "info@studio.com",
  "secondary_cta_label": {"it": "Oppure chiamaci", "en": "Or call us"},
  "secondary_cta_href": "tel:+390212345678"
}
```

**Impatto DB**: Nessuno — modifica JSONB settings  
**Impatto Frontend**: Aggiornare `FinalCTA` component per mostrare contatti diretti  
**Impatto Blueprint**: Aggiungere campi phone/email nell'editor `cinematic_quote`

---

## FASE 4 — BLUEPRINT HOMEPAGE BUILDER

### Requisito: Sezione "Homepage Builder" in Blueprint Admin

**Cosa deve poter fare il cliente tramite Blueprint:**
- [ ] Abilitare/disabilitare ogni sezione senza deploy
- [ ] Riordinare le sezioni (drag & drop)
- [ ] Modificare i contenuti di ogni sezione (tutti i campi i18n)
- [ ] Duplicare una sezione
- [ ] Anteprima live prima della pubblicazione

**Infrastruttura già presente**:
- `GET /api/storefront/admin/{tenant}/pages/{page_key}` → lista sezioni con ordine
- `PATCH /api/storefront/admin/{tenant}/pages/{page_key}/sections/{section_id}` → update visibilità
- `POST /api/storefront/admin/{tenant}/pages/{page_key}/sections/reorder` → riordino
- `POST /api/storefront/admin/{tenant}/pages/{page_key}/publish` → pubblicazione

**Cosa manca in Blueprint Frontend**:
- Interfaccia visuale "Homepage Builder" con lista sezioni ordinabili
- Editor per ogni tipo di sezione con campi i18n
- Toggle enabled/disabled per sezione
- Preview mobile/desktop integrata

**Non è necessario creare nuove API backend** — solo sviluppare la UI Blueprint.

---

## FASE 5 — MULTILINGUA

### Requisito: Utilizzare esclusivamente sistema i18n esistente

**Sistema i18n attuale** (confermato funzionante):
- Backend: `locale_content` JSONB in `cms_sections` con chiavi `it-IT`, `en-US`, `en-GB`, `es-ES`, `es-MX`, `fr-FR`, `de-DE`
- Frontend: `pickContent(bag, locale)` + `getOrFallback()` con fallback chain anti-leak
- Runtime: `LocaleRuntimeContext` + country targeting

**Lingue supportate dal sistema**:
```
EN-US | EN-GB | IT-IT | ES-ES | ES-MX | FR-FR | DE-DE
```

**Regola**: Nessun testo hardcoded in nessun componente homepage. Ogni stringa deve avere una chiave locale nel CMS.

**Azione richiesta**: Completare i campi i18n mancanti nelle sezioni CMS già esistenti (es. `en-US` vuoto in `design_journey`).

---

## FASE 6 — PIANO DI IMPLEMENTAZIONE

### Ordine raccomandato

```
FASE 0 — PREREQUISITI (2h stima)
  ├── 0.1 Fix tenant slug (1 riga codice)
  ├── 0.2 Disabilitare debug bar in produzione (1h)
  └── 0.3 Fix hero image → bucket pubblico (1h)

FASE A — CONTENUTO (Nessun codice — solo Blueprint)
  ├── Pubblicare 3-5 progetti (Design Journeys)
  ├── Pubblicare 3 articoli Magazine
  └── Popolare steps in design_journey

FASE B — SEZIONI ESISTENTI (1-2 giorni)
  ├── Aggiungere campi phone/email a cinematic_quote
  ├── Estendere atmosphere_statement per team photo
  └── Deprecare magazine_highlights (visible: false)

FASE C — NUOVA SEZIONE (1 giorno)
  └── digital_discovery_experience (registry + componente + Blueprint editor)

FASE D — HOMEPAGE BUILDER UI (3-5 giorni)
  ├── Interfaccia drag-and-drop sezioni in Blueprint
  ├── Editor per ogni tipo di sezione
  └── Preview integrata

FASE E — MULTILINGUA COMPLETION
  └── Completare campi en-US mancanti nelle sezioni
```

---

## FASE 7 — IMPATTO TOTALE

| Area | Nuove Tabelle | Tabelle Modificate | Nuovi Tipi Sezione | Note |
|---|---|---|---|---|
| DB | 0 | 0 (JSONB only) | 0 | Tutto in JSONB settings |
| Backend Registry | 0 | 1 (`storefront_registry.py`) | 1 (`digital_discovery_experience`) | |
| Frontend | 0 nuovi file (Fase 0-B) | 2 (`HomePage.jsx`, `MagazinePage.jsx`) | 1 nuovo component | |
| Blueprint UI | 1 nuova pagina | Admin storefront editor | N editor sezioni | |
| Deploy richiesto | Solo per Fase 0 e C | CMS-driven il resto | | |

---

## APPENDICE — VERIFICA CRITICAL RULE

> "NON creare nuove tabelle se esistono già moduli equivalenti."

Verifica eseguita:

| Sezione Target | Modulo Cercato | Trovato? | Decisione |
|---|---|---|---|
| Hero | CMS Pages + Sections | ✅ `hero_editorial` | RIUTILIZZA |
| How We Work | CMS Sections | ✅ `design_journey` | RIUTILIZZA |
| Studio Introduction | CMS Sections | ⚠️ `atmosphere_statement` parziale | ESTENDI |
| Projects | `published_design_journeys` | ✅ | RIUTILIZZA |
| Digital Discovery | CMS Sections, `inspirations` | ❌ Nessuno esatto | NUOVO TIPO (no nuova tabella) |
| Magazine | `editorial_articles` + `editorial_grid` | ✅ | RIUTILIZZA + UNIFICA |
| Final CTA | `cinematic_quote` | ✅ | ESTENDI (campi phone/email) |

**Nessuna nuova tabella necessaria.** ✅

---

*Piano generato nel contesto del MOOD UX/UI & Conversion Sprint — Giugno 2026*  
*Stato: IN ATTESA DI APPROVAZIONE — NON IMPLEMENTARE*
