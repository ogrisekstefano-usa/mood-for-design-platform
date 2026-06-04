# MOOD for DESIGN™ — Brand Registry Enhancement · Implementation Report

> **Sprint:** Brand Registry Enhancement™ · Knowledge Graph foundation
> **Status:** ✅ COMPLETED
> **Date:** 04 Jun 2026
> **Author:** Main Agent (E1)

## 1 · Scope approvato

Trasformazione del modal "Nuovo Produttore" in una struttura dati
foundation per:
- ricerca globale, AI semantic search, recommendation engine
- filtri Inspiration Packages, Studio/Material/Product Library
- futuro Specification Engine™

Implementati: (a) multi-select Categorie pill-style con catalogo DB-driven
multilingue, (b) Tag system riusabile con autocomplete + suggested chips +
crea-on-Enter, (c) data model definitivo con array JSONB + tag_registry
many-to-one.

## 2 · Migration

**File:** `/app/supabase/migrations/127_brand_registry_enhancement.sql`
**Applicata su:** Supabase PG production
**Tabelle/colonne:**

| Cambio | Dettaglio |
|---|---|
| `brand_categories_catalog` (NEW) | Catalogo DB-driven: key, label_it, label_en, description_it/en, icon-N/A, active, is_suggested, sort_order, created_at, updated_at. Seedate 18 categorie canoniche con 9 marcate `is_suggested=true`. |
| `brands.categories JSONB[]` | Array di category keys (multi-select). Backfill: brand.category (legacy) → categories[0]. |
| `brands.tag_slugs JSONB[]` | Array di slug di `tag_registry` (no duplicati). |
| `tag_registry.is_suggested BOOLEAN` | Chip "Tag suggeriti" UI driver. Seedati 13 tag iniziali (made-in-italy, lusso, design-contemporaneo, ecc.). |
| Indici GIN | `brands_categories_gin`, `brands_tag_slugs_gin`, `tag_registry_type_suggested_idx` per ricerca/filtri futuri. |

## 3 · Backend

**File:** `/app/backend/routers/brands_registry.py`

Resolver puri (deterministi · drop-silent su key invalide · dedup):
- `_resolve_brand_categories(c, candidates)` → lista validata sul catalogo
- `_resolve_brand_tags(c, tenant_id, profile_id, labels)` → slugify + upsert tenant-scoped + lista deduplicata

API (tutti `Depends(get_tenant_context)`):
- GET `/api/inspirations/registry/brand-categories?active_only&suggested_only`
- PUT `/api/inspirations/registry/brand-categories/{key}` **(super_admin)**
- DELETE `/api/inspirations/registry/brand-categories/{key}` **(super_admin · soft deactivate)**
- GET `/api/inspirations/registry/tags?type=brand&q=&suggested_only=&limit=`
- POST `/api/inspirations/registry/tags` (idempotent on (tenant_id, type, slug))

`BrandCreate` / `BrandUpdate` accettano `categories: List[str]` e `tags: List[str]`
(label libere → slugificate server-side).

## 4 · Frontend componenti riusabili

Tutti i colori da `var(--bp-*)` + `color-mix` — **0 valori hardcoded**.

### `MultiCategoryPicker.jsx` (`/app/frontend/src/components/registry/`)
- selected chips con × remove
- "+ Aggiungi categoria" → popover con search + lista filtrata
- striscia "Categorie suggerite" (visibile quando `categories=[]`)
- testid namespace: `brand-form-categories-{chip|add|popover|search|option|suggest}-{key}`

### `TagInput.jsx` (`/app/frontend/src/components/registry/`)
- input con Enter/Backspace handling
- autocomplete live (debounced 180ms) → `tag-input__autocomplete`
- chip "Crea ..." per tag non esistente
- striscia "Tag suggeriti" (chip cliccabili da `tag_registry.is_suggested`)
- dedup client+server (slugify)
- testid namespace: `brand-form-tags-{entry|chip|chip-remove|autocomplete|suggest|create-new|suggested}`

### `BrandFormModal.jsx` (riscritto)
- usa i due componenti sopra
- backdrop chiude su `onClick` (non onMouseDown) per gestire popover annidati
- form ha `onClick=stopPropagation` defensive

## 5 · Pattern Anti-bug fissato

Pre-fix: il document-level mousedown handler chiudeva il popover PRIMA del click sull'option, ri-renderizzando il componente.

Fix definitivo (pattern riusabile per altri popover/autocomplete nel progetto):
1. **Commit option su `onMouseDown`** (non `onClick`)
2. `e.stopPropagation()` a cascata (option → popover wrapper → picker root)
3. Backdrop modal usa **`onClick`** (non `onMouseDown`) per chiusura su target===currentTarget
4. Form interno ha `onClick=stopPropagation`

## 6 · Test report

| Suite | Risultato |
|---|---|
| Backend pytest (`test_brand_registry_enhancement.py`) | **12 / 12** PASS — iteration_208.json |
| Frontend Playwright (acceptance flow completo) | **14 / 14** PASS — iteration_209.json |

Tutti i criteri di accettazione verificati:
- Multi-selezione Categorie, popover, suggested chips, × remove
- TagInput autocomplete + Enter commit + custom create + Backspace
- Submit con payload `{categories:[...], tags:[...]}` → 201 → DB ok
- RBAC super_admin su catalog CRUD
- Validazione `unknown_xyz` droppata silenziosamente
- Dedup case-insensitive su tag e su categorie
- Backward-compat: `category` legacy → `categories[0]`

## 7 · Files toccati

**Creati**
- `/app/supabase/migrations/127_brand_registry_enhancement.sql`
- `/app/frontend/src/components/registry/MultiCategoryPicker.jsx`
- `/app/frontend/src/components/registry/multi-category-picker.css`
- `/app/frontend/src/components/registry/TagInput.jsx`
- `/app/frontend/src/components/registry/tag-input.css`
- `/app/backend/tests/test_brand_registry_enhancement.py`
- `/app/memory/BRAND_REGISTRY_ENHANCEMENT_REPORT.md`

**Modificati**
- `/app/backend/routers/brands_registry.py` (resolver + nuovi endpoint + BrandCreate/Update)
- `/app/frontend/src/pages/inspirations/BrandFormModal.jsx` (riscritto · usa nuovi componenti)

## 8 · Knowledge Graph readiness

| Use case futuro | Pronto |
|---|---|
| Ricerca globale | ✓ `brands.categories @> ['key']` + `brands.tag_slugs @> ['slug']` con GIN |
| AI semantic search | ✓ tag_registry.synonyms già struturato per espansione |
| Filtri Inspiration Packages | ✓ multi-select via array intersection |
| Recommendation engine (designer ↔ brand) | ✓ tag_slugs come feature vector |
| Specification Engine™ | ✓ categories normalizzate via catalog |

---

**Maintainer:** MOOD Brand Atlas™ — 04 Jun 2026
