# EDITORIAL ONBOARDING — SPECIFICATION
## Placeholder Educational Mode™

> **Status:** 🔒 ARCHITECTURE SPEC · 31 May 2026 · zero modifica codice/DB
> **Vincolo Founder:** Tenant nuovo = Editorial Calendar vuoto + Magazine vuoto. MA fornire esempi educational marcati `DEMO`, `READ_ONLY`, `DELETEABLE`.

---

## §0 · Filosofia

Un Founder che apre per la prima volta il modulo Editoriale **non sa cosa pubblicare, come strutturarlo, quale ritmo adottare**.

Strategy: invece di mostrare lui una **schermata vuota** ("Crea il primo articolo"), mostrarlo **3 esempi educational**:

1. **Editorial Master** → un articolo completo (struttura, foto hero, paragrafi, tag, market).
2. **Market Edition** → un mese di calendario editoriale già pianificato (4-5 pubblicazioni).
3. **Publishing Flow** → un workflow visualizzato (Draft → Review → Scheduled → Published).

Tutti **marcati con badge "DEMO"**. Tutti **READ_ONLY**. Tutti **DELETEABLE** in 1 click (dopo che l'utente ha imparato).

Non sono contenuti reali del tenant. Sono **istruzioni viventi**.

---

## §1 · Stato attuale

### 1.1 · Cosa esiste oggi

| Surface | Stato | File |
|---|---|---|
| `MagazinePage` (storefront site) | esiste, legge da `magazine_articles` (oggi 0 righe) | `pages/site/MagazinePage.jsx` |
| `MagazineAdminPage` (admin) | esiste, lista articoli editabili | `pages/settings/MagazineAdminPage.jsx` |
| `MagazineEditorPage` (article editor) | esiste, editor WYSIWYG | `pages/settings/MagazineEditorPage.jsx` |
| `EditorialCopyCmsPage` | esiste, gestione editorial_blocks | `pages/admin/EditorialCopyCmsPage.jsx` |
| `editorial_calendar` router | esiste backend | `routers/editorial_calendar.py` |
| `journal_articles`, `journal_*` tables | esistono · 0 righe | DB |
| `magazine_*` tables | esistono · 0 righe | DB |

### 1.2 · Cosa NON esiste

- 🔴 Nessun concept di "demo content"
- 🔴 Nessun flag `is_demo` su `magazine_articles` (verificare schema)
- 🔴 Nessun seed di esempio educational
- 🔴 Nessun toggle "mostra esempi" / "nascondi esempi"
- 🔴 Pagina Editorial Calendar non esiste in frontend

---

## §2 · Schema DB target

### 2.1 · Estensione `magazine_articles` / `journal_articles`

```sql
-- Aggiungere colonna a entrambe le tabelle articolo:
ALTER TABLE magazine_articles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demo_category TEXT;  -- 'editorial_master', 'market_edition', 'publishing_flow'

ALTER TABLE journal_articles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demo_category TEXT;
```

### 2.2 · Tabella seed `editorial_demo_catalog`

```sql
editorial_demo_catalog
──────────────────────────────────────────────
id              uuid PK
slug            text UNIQUE  -- 'editorial-master-cinematic-living',
                              -- 'market-edition-tokyo-october',
                              -- 'publishing-flow-canonical'
demo_category   text NOT NULL CHECK (∈ 'editorial_master' | 'market_edition' | 'publishing_flow')
title_default   text NOT NULL  -- 'Cinematic Living: Architecting Stillness'
locale          text DEFAULT 'it'
seed_payload    jsonb NOT NULL  -- complete article payload + media URLs
sort_order      int DEFAULT 0
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT NOW()
```

**Catalog source-of-truth platform-wide.** Quando un tenant è nuovo, il backend (su demand o auto-seed) inserisce 1+ articoli demo dal catalogo in `magazine_articles WHERE is_demo=true`.

---

## §3 · Demo content proposto (3 esempi minimi)

### 3.1 · DEMO 1 · Editorial Master

**Title:** "Cinematic Living: Architecting Stillness"
**Category:** Architettura · Living Design
**Locale:** IT (con traduzioni EN, FR, DE)
**Struttura:**
- Hero image (placeholder via media library default)
- Lead paragraph
- 3 sezioni body con immagine + testo
- Quote pullout
- Materials box (3 brand + 2 finishes)
- Author + date

**Markers UI:**
```
[DEMO · EDITORIAL MASTER]
↳ Questa è una struttura di esempio. Puoi:
   · Esplorare le sezioni
   · Vedere come usare i materials
   · Eliminarlo quando vuoi
```

### 3.2 · DEMO 2 · Market Edition

**Title:** "Tokyo · October Edition"
**Tipo:** Calendar entry (1 mese)
**Pubblicazioni programmate:**
- Settimana 1: "Wabi-sabi as Methodology"
- Settimana 2: "Joinery Patterns: Visible Craft"
- Settimana 3: "Light & Shadow: Ma in Living Spaces"
- Settimana 4: "Material Library: Hinoki & Stone"

Mostra come un mese editoriale può essere pianificato in advance per un mercato specifico.

**Markers UI:** Calendar view shows 4 demo entries with "[DEMO]" badge, color-coded gradient (mauve/sand).

### 3.3 · DEMO 3 · Publishing Flow

**Tipo:** Visual workflow (no actual articles, just stage examples)
**Stages:**
1. **Draft** → "[DEMO] Article being written"
2. **Review** → "[DEMO] Article in editorial review"
3. **Scheduled** → "[DEMO] Article ready for Oct 28"
4. **Published** → "[DEMO] Article live"

Mostra la pipeline canonica.

---

## §4 · Endpoint backend

| Verb | Path | Scope | Note |
|---|---|---|---|
| `GET` | `/api/editorial/demo/catalog` | studio | lista delle demo disponibili (3 baseline) |
| `POST` | `/api/editorial/demo/seed/{tenant_id}` | studio admin | seed 3 demos nel tenant corrente (idempotente: skip se già seeded) |
| `DELETE` | `/api/editorial/demo/{article_id}` | studio admin | elimina singola demo |
| `DELETE` | `/api/editorial/demo/all` | studio admin | elimina tutte le demo del tenant |
| `GET` | `/api/editorial/articles?include_demos=false` | studio | lista articoli (default exclude demos) |

---

## §5 · Frontend UI

### 5.1 · MagazineAdminPage

Quando l'utente apre `/settings/magazine`:
- Se `articles.where(is_demo=false).count == 0` AND `articles.where(is_demo=true).count == 0`:
  - Show empty state hero: "Inizia il tuo Magazine"
  - 2 CTA: **"Crea il primo articolo"** + **"Mostrami degli esempi"** (seed demos)
- Se demos esistono (count >= 1):
  - Lista articoli con badge "DEMO" su quelli demo
  - Bottone "Rimuovi tutti gli esempi" in alto

### 5.2 · Demo card visual treatment

```
┌─────────────────────────────────────┐
│ [DEMO] Cinematic Living              │
│ ↳ Esempio educational                │
│                                      │
│  hero image (low-opacity overlay)    │
│                                      │
│  Author · 12 Oct 2026                │
│  Tags: architettura, living          │
│                                      │
│  [👁 Esplora] [🗑 Rimuovi esempio]   │
└─────────────────────────────────────┘
```

- Subtle dashed border (#bcb6a8)
- Badge "DEMO" top-right corner
- Lock icon on edit button (read-only)
- Tooltip on lock: "Gli esempi non sono modificabili. Crea il tuo articolo per personalizzarlo."

### 5.3 · Editorial Calendar view (NEW PAGE)

`/settings/editorial-calendar` (nuova route):
- Month grid 4 settimane
- Demo entries fill October 2026 (esempio temporale fisso)
- "Crea entry" button → real entry
- Toggle "Mostra esempi" / "Nascondi esempi" persistente in tenant prefs

### 5.4 · Publishing Flow visual

Sezione in MagazineAdminPage o in dashboard:
- Pipeline 4 stages (Draft · Review · Scheduled · Published)
- Demo cards in ciascuno
- Tooltip educativo su hover di ogni stage

---

## §6 · Integration con Studio Activation Journey™

| Activation step | Editorial relation |
|---|---|
| Step 7 · Configura calendario editoriale | `editorial_calendar_configured` → true quando l'utente apre calendar AND aggiunge 1 entry real (no demo) |
| Step 8 · Pubblica primo contenuto | `first_content_published` → true quando articolo `is_demo=false AND status='published'` >= 1 |

**Importante:** demos NON contano per i conteggi attivazione. Solo contenuti reali.

---

## §7 · Lifecycle demo

```
Tenant CREATED
  ↓
First visit /settings/magazine
  ↓
Empty state hero shown
  ↓
User clicks "Mostrami degli esempi"
  ↓
POST /api/editorial/demo/seed/{tenant_id}
  ↓
3 demos inserted (is_demo=true)
  ↓
User explores demos (read-only)
  ↓
User creates first REAL article (is_demo=false)
  ↓
Banner: "Pronto a fare spazio? Rimuovi gli esempi"
  ↓
User clicks "Rimuovi tutti gli esempi"
  ↓
DELETE /api/editorial/demo/all
  ↓
Clean editorial state
```

---

## §8 · Edge cases

| Case | Behaviour |
|---|---|
| User seeds, modifies, exits → reopens | Same demos persist; cannot have been modified (read-only enforced) |
| User deletes all demos → wants them back | Show CTA "Riporta esempi" → re-seed |
| Multi-locale: user changes default locale to FR | Demos shown in user's locale if translation exists, else fallback IT |
| User publishes a demo as real | Forbidden — convert flow: "Per pubblicare questo articolo, prima clonalo come bozza tua" |
| Tenant deletes/archives | `cleanup` ITER174 catches demos (is_demo=true) as deleteable |

---

## §9 · Roadmap implementativa

| Pri | Item | Effort |
|---|---|---|
| 🔴 P0 | Migration `is_demo + demo_category` su `magazine_articles + journal_articles` | 0.3g |
| 🔴 P0 | Migration `editorial_demo_catalog` table + 3 seed rows | 0.5g |
| 🔴 P0 | Endpoint `/api/editorial/demo/*` | 1g |
| 🔴 P0 | UI badge DEMO + tooltip + lock + delete buttons | 1g |
| 🟠 P1 | Empty state hero in MagazineAdminPage | 0.5g |
| 🟠 P1 | Editorial Calendar page nuova | 1.5g |
| 🟡 P2 | Publishing Flow visual section | 1g |
| 🟢 P3 | i18n demos in 4+ lingue | 1g |

**Totale Phase 1 minima:** ~5 giorni.

---

## §10 · Vincoli canon

| # | Vincolo |
|---|---|
| 1 | Ogni demo deve avere badge "DEMO" visibile |
| 2 | Ogni demo è READ_ONLY (no edit) |
| 3 | Ogni demo è DELETEABLE (individuale o bulk) |
| 4 | Demos non contano per metriche tenant (analytics, attivazione) |
| 5 | Demos non vengono mai pubblicate nello storefront pubblico (status='demo' separato da 'published') |
| 6 | Catalog demos è platform-level (non per-tenant) |
| 7 | Mai vendere demos come "template comprabili" (non è un marketplace) |
| 8 | Demos esistono SOLO per educare, non per riempire |
| 9 | Mai più di 3 demos default seedate (NORDIC: less is more) |
| 10 | Linguaggio onboarding: didattico ma raffinato (Blueprint tone of voice) |
