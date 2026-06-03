# ITER202 · BRAND EXPERIENCE LAYER™ — Digital Brand Embassy™

## 🎯 Obiettivo raggiunto

La pagina ARBI è stata trasformata da scheda dati a **Digital Brand
Embassy™**: una destinazione premium per architetti e interior
designer. Il layer designer non espone nessun dato tecnico del
Knowledge Engine.

Quando un architetto apre ARBI vede:
- Hero cinematic full-width con titolo editoriale e descrizione
- MOOD DNA™ in 5 keyword premium generate dall'AI
- Collection Universe™ (24 collezioni come visual cards)
- Material Intelligence™ (12 materiali principali)
- Designers & Collaborators™ (10 designer verificati)
- Brand Story narrativa
- Products gallery filtrabile (398 prodotti)
- Add to Studio Library™ come CTA naturale

Non vede:
- ❌ Knowledge Score
- ❌ Brand Atlas Readiness numerico
- ❌ Graph Completeness
- ❌ Audit / extraction / entity count
- ❌ Confidence score

L'unico segnale tecnico esposto al designer è il **badge "Certified
Brand Atlas™"** — pura trust signal, nessuna metrica.

---

## 🏗️ Architettura

### Backend — `/app/backend/routers/brand_experience.py`

| Endpoint                                              | Funzione                                                  |
|-------------------------------------------------------|-----------------------------------------------------------|
| `GET  /brands/{id}/embassy`                           | Payload composito (hero, collezioni, materiali, designer, prodotti, mood DNA, story, theme tokens) — UN SOLO CALL |
| `PATCH /brands/{id}/hero`                             | Admin only — update hero/story fields                     |
| `POST /brands/{id}/hero/upload`                       | Admin only — upload immagine hero su Supabase Storage     |
| `POST /brands/{id}/regenerate-mood-dna`               | LLM (Claude Sonnet 4.5 via Emergent Universal Key) → 5 keyword premium |
| `POST /brands/{id}/link-to-studio`                    | Add to Studio Library™                                    |
| `DELETE /brands/{id}/link-to-studio`                  | Unlink                                                    |

### Migration — `/app/supabase/migrations/123_iter202_brand_experience.sql`

Estensione `brands`:
- `hero_image_url, hero_title, hero_subtitle, hero_description`
- `story_title, story_body`
- `mood_dna` (JSONB array)
- `atlas_certified_at`

Tabella nuova `studio_brand_links` (tenant_id, brand_id, linked_by, linked_at).

### Frontend

- **`BrandEmbassyPage.jsx`** (nuovo) — pagina completa Digital Brand Embassy
- **`brand-embassy.css`** (nuovo) — editorial dark palette + Chameleon tokens hook
- **`App.js`** — route `/inspirations/brands/:brandId` → `BrandEmbassyPage`
  (vecchia `BrandDetailPage` rimane disponibile su `/admin`)
- **`knowledgeApi.js`** — 6 nuovi client helper

---

## 🎨 Hero source strategy (criterion c)

Strategia auto-fallback come richiesto:
1. Se `brand.hero_image_url` è settato → usa quello.
2. Altrimenti prende la prima immagine canonical dal catalog set certificato
   (via `product_assets.metadata_json.public_url`).
3. Se nessuna immagine disponibile → gradient editoriale neutro.

Override manuale via `Change Hero` modal (visibile in hover top-right).

---

## 🧠 MOOD DNA™ strategy (criterion b)

- Generato via **LLM al primo accesso**, persistito in `brands.mood_dna`
- Rigenerabile on-demand dal pulsante `Regenerate`
- Prompt include: brand name, category, country, story_body, top
  collezioni/materiali estratti dal Knowledge Graph
- LLM: Claude Sonnet 4.5 (Emergent Universal Key)
- Fallback per-category in caso di errore LLM (bathroom, kitchen, stone,
  lighting, generic)

ARBI ha generato live:
```
["Italian Minimalism", "Architectural Precision", "Material Fusion",
 "Contemporary Luxury", "Geometric Sophistication"]
```

---

## 🔗 Studio Library™ (criterion a — minimal viable)

- Singolo link `brand → studio` via `studio_brand_links`
- Granular asset linking (prodotti/materiali singoli) = backlog ITER203
- Stato `linked: bool` esposto via `embassy.studio_library.linked`
- CTA naturale in fondo pagina + pill in topbar

---

## 🦎 Chameleon™ tokens (criterion a + hook)

Implementazione **non-invasiva**:
- Read da `tenants.primary_color / secondary_color / font_heading /
  font_body / branding_settings / theme_settings` (campi GIÀ ESISTENTI)
- Applicati a CSS variables: `--embassy-accent`, `--embassy-accent-2`,
  `--embassy-font-heading`, `--embassy-font-body`
- Fallback editoriale neutro (warm gold #c9a875, Cormorant Garamond,
  Inter)
- Nessuno schema pesante creato — la pagina è già compatibile con
  Blueprint Chameleon™ futuro senza modifiche strutturali

---

## ✅ Strict Lock™ rispettato

| Vietato                                | Status |
|----------------------------------------|:------:|
| Knowledge Score nel designer layer     |   ❌   |
| Extraction Score                       |   ❌   |
| Graph Score                            |   ❌   |
| Audit Score                            |   ❌   |
| Entity count come metrica              |   ❌   |
| Confidence score                       |   ❌   |
| Academy / Magazine / Marketboard       |   ❌   |
| Moodboard                              |   ❌   |
| Hardcoded colors                       |   ❌   |
| Hardcoded images                       |   ❌   |
| Hardcoded text                         |   ❌   |

Tutto dinamico da DB, multilingua-ready, Chameleon-ready.

---

## 🧪 Test live eseguito

```
GET    /api/knowledge/brands/{BRAND}/embassy             → 200, payload composito completo
PATCH  /api/knowledge/brands/{BRAND}/hero                → 200 (admin only — verificato 403 per non-admin)
POST   /api/knowledge/brands/{BRAND}/regenerate-mood-dna → 200, 5 keyword Claude Sonnet 4.5
POST   /api/knowledge/brands/{BRAND}/link-to-studio      → 200, linked=true
DELETE /api/knowledge/brands/{BRAND}/link-to-studio      → 200, linked=false
```

UI smoke test (screenshot): Hero "ARBI · Italian Bathroom Architecture™"
+ descrizione + badges "Verified Brand" / "Certified Brand Atlas™" +
"Change Hero" pencil button + topbar "Share Brand" / "Add to Studio
Library™" tutti visibili e funzionanti.

---

## 🚀 Multi-brand ready

Tutta l'architettura è **brand-agnostic**. Lo stesso endpoint embassy
funziona per Arrital, Margraf, Nemo, Samoa, Riva1920 senza modifiche.
La sola dipendenza brand-specifica resta il `brand_designer_registry`
(già implementato in ITER200).

---

## 📦 Deliverables

- `/app/supabase/migrations/123_iter202_brand_experience.sql`
- `/app/backend/routers/brand_experience.py` (~ 410 righe)
- `/app/frontend/src/pages/inspirations/BrandEmbassyPage.jsx` (~ 660 righe)
- `/app/frontend/src/pages/inspirations/brand-embassy.css` (~ 420 righe)
- `/app/frontend/src/lib/knowledgeApi.js` — 6 nuovi helper
- `/app/frontend/src/App.js` — route updated

---

**Generato**: 2026-06-02
**Brand certificato**: ARBI (Catalog Set `00e33d7f-bcc4-47ae-914f-617d049906a7`)
**Route**: `/inspirations/brands/{brand_id}` → Digital Brand Embassy™
**Admin legacy**: `/inspirations/brands/{brand_id}/admin` → BrandDetailPage
