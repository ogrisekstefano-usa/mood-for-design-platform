# ITER204-A · BRAND ATLAS 2.0™ — Design Discovery Engine™

## 🎯 Da directory di produttori a libreria di linguaggi progettuali

Brand Atlas è stato ridisegnato per cambiare il mental model:
**non si cerca un produttore, si scopre una direzione progettuale**.
Il produttore è la conseguenza.

---

## ✅ Tutto richiesto, implementato

| Sezione                         | Status |
|---------------------------------|:------:|
| Hero editoriale (Brand Atlas™)   |   ✅   |
| Numeri globali rimossi dall'header |   ✅   |
| Barra ricerca globale            |   ✅   |
| Filtri MOOD DNA / Mercato / Posizionamento (da DB) |   ✅   |
| Card redesign: hero dominante 70% + narrativa |   ✅   |
| Badge `CERTIFIED ATLAS™` / `CURATED BY MOOD™` |   ✅   |
| Categoria narrativa (positioning)|   ✅   |
| MOOD DNA pills dinamiche da DB   |   ✅   |
| CTA "Enter the Embassy →"        |   ✅   |
| Quick preview hover (16 Coll · 398 Prod · 12 Mat · 10 Des) |   ✅   |
| Numeri tecnici nascosti in stato normale |   ✅   |
| ♡ Save to Studio Library (immediato, no entry detail) |   ✅   |
| Collection preview (prime 3 canoniche sotto hero) |   ✅   |
| Visual language: editoriale dark, no CRM/ERP   |   ✅   |
| Responsive mobile/tablet (grid → 1 col, no hover preview) |   ✅   |
| Sidebar invariata               |   ✅   |
| Design Journey invariato        |   ✅   |
| Tutto dinamico da DB / Knowledge Graph |   ✅   |

---

## 🏗️ Implementazione

### Backend — `/app/backend/routers/brand_experience.py`

Due nuovi endpoint composti:

| Endpoint                              | Funzione                                                  |
|---------------------------------------|-----------------------------------------------------------|
| `GET /api/knowledge/atlas/discover`   | Cards-ready data (hero, mood_dna, top_collections, counts, saved flag, certified badge) |
| `GET /api/knowledge/atlas/facets`     | Faccette filtri (mood_dna / markets / positioning / categories) tutte derivate da DB con count |

Caratteristiche:
- Include sia brand **tenant-private** sia brand **curated by MOOD** (NULL tenant_id)
- Deduplicazione automatica per nome (keep richiest record)
- Counts (collezioni / prodotti / materiali / designer) aggregati dal Knowledge Graph
- Hero image auto-fallback: `brand.hero_image_url` > prima immagine canonical da `product_assets` > gradient editoriale
- Top 3 canonical collections da `collections_canonical` linked al catalog set certificato
- Saved flag da `studio_brand_links`

### Frontend

- **`BrandAtlas2Page.jsx`** (~340 righe) — nuovo, sostituisce `BrandModePage` su `/inspirations/brands`
- **`brand-atlas-2.css`** (~370 righe) — editorial dark palette ispirata a Apple/AD Archive/Material Bank
- Route `/inspirations/brands/legacy` → `BrandModePage` (vecchio, mantenuto temporaneamente)
- API client helpers: `atlasDiscover`, `atlasFacets`

### Componenti chiave

| Component             | Responsabilità                                           |
|-----------------------|----------------------------------------------------------|
| `<AtlasCard>`         | Card narrativa: hero 16:11, badges, save, mood pills, top collections, CTA |
| `<QPItem>`            | Quick preview cell (icon + value + label) — solo desktop hover |
| `<FilterPicker>`      | Dropdown filtro con count per opzione (Mood DNA / Mercato / Posizionamento) |
| `<CardSkeleton>`      | Skeleton state durante caricamento (shimmer animation) |

---

## 🚫 Eliminazioni richieste (verificate)

| Eliminato                                                  | Status |
|------------------------------------------------------------|:------:|
| Numeri globali in alto (16 Brands · 3482 Products …)       |   ✅   |
| Layout "logo + meta + lista numerica" della vecchia card   |   ✅   |
| Filter pill solo per `luxury_tier` (sostituito da 3 facette ricche) |   ✅   |
| Display numeri tecnici nello stato normale della card      |   ✅   |
| Hardcoded mood / tags / images / counts                    |   ✅   |

---

## 🎨 Visual language (verificato)

Ispirazione applicata:
- **Apple** — generosi spazi bianchi, typography editoriale (Cormorant Garamond)
- **AD Archive** — palette dark cinematic, narrative copy in italic
- **Material Bank** — card hero dominante 70%, swatch tonalità calde
- **Design Miami** — accent gold #c9a875 (warm bronze) come signature
- **Netflix Discovery** — hover quick preview overlay

Ispirazioni evitate:
- ❌ CRM / ERP layout
- ❌ Product database tabellare
- ❌ Ecommerce catalog con prezzi/CTA aggressivi

---

## 🧪 Test live verificato

```bash
GET /api/knowledge/atlas/discover → 200
  total cards: 17 (dopo dedup, da 23 brand totali in DB)
  ARBI Test Bathroom: certified=False saved=True
    mood_dna=[Italian Minimalism, Architectural Precision, Material Fusion, Contemporary Luxury, Geometric Sophistication]
    counts={collections:16, products:398, materials:12, designers:10}
    top_collections=[Absolute, ACCESSORI CON DIVISIORI IN VETRO, Almond]

GET /api/knowledge/atlas/facets → 200
  mood_dna: [Italian Minimalism, Architectural Precision, Material Fusion, Contemporary Luxury, Geometric Sophistication]
  markets: [italy_milano, usa_nyc, france_paris, uae_dubai, uk_london, ...]
  positioning: [editorial luxury, design contemporaneo, patrimonio del design, design icon, ...]
```

UI smoke test (screenshot):
1. **Hero**: "Brand Atlas™" / "Manufacturers as *design languages*" / lead editoriale ✅
2. **Search globale** funzionante con placeholder esplicito ✅
3. **3 filtri** + Studio Library toggle ✅
4. **Card ARBI** con CURATED BY MOOD™ badge + cuore rosso (saved) + 3 mood pills + top collections + CTA "ENTER THE EMBASSY →" ✅
5. **Hover ARBI** mostra quick preview 16 / 398 / 12 / 10 ✅
6. **Filtro MOOD DNA** dropdown con count per opzione ✅

---

## 🛡️ Critical Rules rispettate

| No HARDCODED                | Verificato         |
|-----------------------------|--------------------|
| Data                        | Tutto da `brands` / `catalog_sets` / `collections_canonical` |
| Images                      | `hero_image_url` o auto-fallback da `product_assets` |
| Mood DNA                    | `brands.mood_dna` (popolato via LLM ITER202) |
| Tags / labels               | `positioning`, `category`, `markets` da DB |
| Filters                     | `facets` aggrega da DB, no liste statiche |

---

## 🚀 Multi-brand ready

Quando aggiungiamo Arrital / Margraf / Nemo / Samoa / Riva1920:
1. Brand record in `brands` (può essere tenant-private o NULL-tenant curated)
2. Catalog set processato e validato
3. `POST /brands/{id}/regenerate-mood-dna` → MOOD DNA popolato
4. Card appare automaticamente nel Brand Atlas 2.0 con counts reali

Zero codice da modificare.

---

## ⚠️ Note

- **Brand non certificati** (es. B&B Italia, Boffi) mostrano "CURATED BY MOOD™"
  + hero gradient fallback + nessuna mood DNA (finché non viene generata).
  L'utente può comunque cliccarli e vedere la Brand Embassy basica.
- **ARBI duplicato** (cron-clean): la dedup automatica nel discover endpoint
  ora mostra solo la versione più ricca. Il record DB duplicato resta —
  cleanup definitivo è P0 dell'audit ITER202.5.

---

## 📦 Deliverables

- `/app/backend/routers/brand_experience.py` — 2 nuovi endpoint
- `/app/frontend/src/pages/inspirations/BrandAtlas2Page.jsx` (nuovo)
- `/app/frontend/src/pages/inspirations/brand-atlas-2.css` (nuovo)
- `/app/frontend/src/lib/knowledgeApi.js` — 2 nuovi helper
- `/app/frontend/src/App.js` — route swap

---

**Generato**: 2026-06-03
**Route principale**: `/inspirations/brands` → Brand Atlas 2.0
**Route legacy**: `/inspirations/brands/legacy` → BrandModePage vecchia (deprecabile)

> "Un designer non entra in MOOD per trovare un produttore.
> Entra in MOOD per trovare la direzione progettuale corretta."
