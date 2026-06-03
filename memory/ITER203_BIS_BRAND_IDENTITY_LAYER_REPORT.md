# ITER203-BIS · BRAND IDENTITY LAYER™

## 🎯 Da hero image opzionale a identità persistente

Eliminata la dipendenza dalla presenza di un'immagine. Ogni brand ha ora
un'identità progettuale persistente in DB che guida la card del Brand
Atlas — anche senza hero_image_url.

---

## 🗄️ Schema (migration 124)

`/app/supabase/migrations/124_iter203bis_brand_identity_layer.sql`

Aggiunti su `brands`:

| Campo            | Tipo  | Descrizione                                                     |
|------------------|-------|-----------------------------------------------------------------|
| `brand_language` | TEXT  | 1-line design language (es. "Sedute sculturali, lusso silenzioso") |
| `hero_strategy`  | TEXT  | Slug trattamento visivo (es. `iconic_product`, `quarry_project_texture`, `flagship_environment`, `bathroom_environment`) |

`positioning` e `mood_dna` esistevano già — ora popolati con valori reali.

---

## 🎨 16 brand identità seeded (no hardcoded UI)

| Brand            | Positioning                         | Hero Strategy             |
|------------------|-------------------------------------|---------------------------|
| ARBI             | Contemporary Bathroom Architecture  | `bathroom_environment`    |
| Artemide         | Design della Luce                   | `iconic_product`          |
| Margraf          | Pietra Naturale Italiana            | `quarry_project_texture`  |
| Boffi            | Cucina d'Autore                     | `flagship_environment`    |
| B&B Italia       | Architettura del Salotto            | `flagship_environment`    |
| Cassina          | Patrimonio del Design               | `iconic_product`          |
| Flexform         | Living Contemporaneo                | `flagship_environment`    |
| Edra             | Scultura Imbottita                  | `iconic_product`          |
| Minotti          | Disegno della Seduta                | `iconic_product`          |
| Molteni&C        | Architettura Domestica              | `flagship_environment`    |
| Rimadesio        | Living System                       | `flagship_environment`    |
| Poliform         | Sistemi di Arredo Globali           | `flagship_environment`    |
| Maxalto          | Heritage Imbottito                  | `iconic_product`          |
| Bonaldo          | Design Contemporaneo                | `iconic_product`          |
| Cattelan Italia  | Tavoli d'Autore                     | `iconic_product`          |
| Flos             | Architectural Lighting              | `iconic_product`          |

Plus `brand_language` per ognuno (1-line design language).

---

## 🏗️ Architettura

### Backend
- `/atlas/discover` ora ritorna `positioning`, `brand_language`, `hero_strategy`
- `/brands/{id}/embassy` ora ritorna gli stessi campi

### Frontend — `BrandAtlas2Page.jsx`
- **Gerarchia visiva della card riordinata**:
  1. Hero (image OR strategy treatment)
  2. Positioning (uppercase, accent color)
  3. Brand name (Cormorant Garamond editoriale)
  4. Brand language (body italic)
  5. Mood DNA pills
  6. Top collections
  7. CTA "Enter the Embassy →"

- **Senza hero_image_url**: card riceve classe CSS
  `atlas2-hero-strategy--{strategy}`. La presenza/assenza dell'immagine
  NON cambia la qualità percepita.

- **Nessun gradient placeholder generico**: rimosso il vecchio
  `FALLBACK_HERO`. Ora ogni card senza immagine mostra un **trattamento
  visivo coerente** con la sua hero_strategy.

### CSS — `brand-atlas-2.css`
6 trattamenti visivi distintivi (no foto):

| Strategy                  | Visual signature                                                                |
|---------------------------|---------------------------------------------------------------------------------|
| `bathroom_environment`    | Cool architectural light + tile grid pattern (azzurro freddo)                    |
| `iconic_product`          | Dark stage + spotlight pool (oro caldo)                                          |
| `quarry_project_texture`  | Stone vein texture + organic patches (marrone caldo)                             |
| `flagship_environment`    | Warm interior light + lateral glow (ambra)                                       |
| `editorial_portrait`      | Vignette focus center                                                            |
| `material_swatch`         | Conic gradient di tonalità calde/fredde                                          |
| `default`                 | Editorial neutro (fallback se strategy mancante o nuova)                         |

Ogni trattamento contiene:
- Iniziale del brand (data-driven, da `card.name[0]`)
- Positioning in italic editoriale (Cormorant Garamond)
- Label strategy uppercase

**Aggiungere una nuova strategy** = aggiungere un blocco CSS. Nessun JS
da toccare. Chameleon™ futuro potrà overridare via CSS variables
(`--atlas2-treatment-*`) senza modificare il codice.

---

## 🛡️ Critical Rules rispettate

| Regola                                                  | Status |
|---------------------------------------------------------|:------:|
| NO generazione massiva hero placeholder                  |   ✅   |
| NO popolamento `hero_image_url` con immagini casuali     |   ✅   |
| NO gradient placeholder generico                         |   ✅   |
| Tutto DB driven                                          |   ✅   |
| Nessun valore hardcoded nel frontend (brand names, positioning, hero_strategy assignments) |   ✅   |
| Gerarchia 1.Hero → 2.Positioning → 3.Name → 4.Mood DNA → 5.CTA |   ✅   |
| Chameleon-ready (CSS class + CSS variable overridabili)  |   ✅   |

---

## 🧪 Test live verificato

```
GET /api/knowledge/atlas/discover → 200 (22 cards)
  ARBI:    positioning="Contemporary Bathroom Architecture", hero_strategy="bathroom_environment", hero_url=YES
  Artemide:positioning="Design della Luce",                 hero_strategy="iconic_product",        hero_url=NO
  Margraf: positioning="Pietra Naturale Italiana",          hero_strategy="quarry_project_texture",hero_url=NO
  Boffi:   positioning="Cucina d'Autore",                   hero_strategy="flagship_environment",  hero_url=NO
  [...altri 12 brand certified/curated con identità popolata]
```

**Screenshot UI**: card visivamente differenziate per strategy:
- ARBI → magnolia photo
- Artemide → spotlight "A" dorato (iconic_product)
- Boffi/B&B/Flexform/Poliform/Rimadesio/Molteni&C → warm interior glow
- Margraf → marrone con vein texture
- Bonaldo/Edra/Cassina/Maxalto/Minotti/Cattelan/Flos → spotlight (iconic_product)

Tutti senza singola immagine hardcoded.

---

## 🚀 Multi-brand ready

Nuovo brand → INSERT row con positioning + brand_language + hero_strategy
(uno dei 6 esistenti o un nuovo slug + relativo CSS block).

Zero modifiche al codice JS / al component AtlasCard.

---

## 📦 Deliverables

- `/app/supabase/migrations/124_iter203bis_brand_identity_layer.sql`
  (schema + seed 16 brand)
- `/app/backend/routers/brand_experience.py` — campi nuovi in discover/embassy
- `/app/frontend/src/pages/inspirations/BrandAtlas2Page.jsx` — card refactor
- `/app/frontend/src/pages/inspirations/brand-atlas-2.css` — 6 trattamenti visivi

---

**Generato**: 2026-06-03
**Brand seeded**: 16 curated + ARBI
**Chameleon-ready**: ogni trattamento via CSS class + CSS variable
