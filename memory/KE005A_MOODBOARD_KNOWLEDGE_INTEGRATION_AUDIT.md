# KE-005A · Moodboard Knowledge Integration Audit™

> **Sprint**: KE-005A · audit architetturale (READ-ONLY)
> **Mission**: stabilire se la Moodboard esistente è il **primo consumatore reale** del Knowledge Engine costruito in KE-001…KE-004 oppure un'isola legacy.
> **Data**: 06 Giugno 2026 · iteration 214
> **Constraint rispettato**: zero implementazione, zero refactor, solo analisi.

---

## 0 · TL;DR

# 🔴 **C) LEGACY_ISLAND**

La Moodboard è un **block-based editor grafico autonomo** che vive accanto al Knowledge Engine ma **NON lo consuma**. Non esiste alcuna foreign key, alcun endpoint, alcun side-effect che colleghi un `moodboard_elements` row al `brand_detected_entities`, ai `products`, ai `brand_entity_relations` o ai `knowledge_impact_events`. È un secondo modello dati parallelo, con cromia e UX premium ma semanticamente scollegato dall'ecosistema MOOD.

Le 8 fasi dell'audit confermano: **0/4 propagazioni Brand Atlas → Moodboard**, **0/3 hook al Knowledge Engine**, **0/1 SSoT condivisa**.

---

## 1 · ARCHITETTURA ATTUALE

### Backend (3 router · 2 tabelle · zero hook KE)

| Router | Path prefix | Endpoint principali | Note |
|--------|-------------|---------------------|------|
| `routers/moodboards.py` (183 righe) | `/api/moodboards` | CRUD container (list · create · get · update · delete · archive · restore) | Crea anche una page di default · usa ALE translation |
| `routers/moodboards_v1.py` (848 righe) | `/api/moodboards` | Pages (CRUD · skeletons · reorder · duplicate) · Blocks/Elements (CRUD · batch · duplicate) · Approval · Share · Public viewer | Usa ESCLUSIVAMENTE `moodboard_pages` + `moodboard_elements` |
| `services/editorial_translation_layer.py` | — | ALE on-read per title/description | Localizzazione, non integrazione KE |

### Tabelle DB (count attuale)

```
moodboards            count = 0    (la sezione è praticamente non usata)
moodboard_pages       count = 0
moodboard_elements    EXISTS (schema ricostruito dal codice)
moodboard_versions    count = 0    (versioning attivabile ma non popolato)
```

Schema `moodboard_elements` (dedotto da `moodboards_v1.py` L566-580):
```
id, tenant_id, moodboard_id, page_id, type, sort_order,
content (json string), position_json, style_json, metadata_json,
title, image_url, video_url, locked, hidden, opacity, rotation,
created_at, updated_at
```

🔴 **Manca completamente**: `entity_id`, `canonical_ref_id`, `product_id`, `material_id`, `designer_id`, `brand_id`. Il `metadata_json` POTREBBE ospitare quei link, ma il codice non li scrive mai.

### Frontend (8 file · 4157 righe totali)

```
pages/moodboards/MoodboardEditor.jsx               2245 ← editor monolite
pages/moodboards/MoodboardsPage.jsx                 389
components/layout/CreateMoodboardModal.jsx          233
components/journey/MoodboardDirectionWorkspace.jsx   69
pages/inspirations/MoodboardPickerModal.jsx         191
blueprint/moodboard/ (28 file)                    ~3000  ← LibraryPanel, EditorPanel, BlockRegistry, PageInspector, blocks/, etc.
```

Tutti i fetch fanno capo a `api.get('/api/moodboards/…')` / `api.get('/api/inspirations/archive')` / `api.get('/api/storage/signed-download')`. **Zero chiamate a `/api/knowledge/…`** in tutto il sub-tree moodboard.

---

## 2 · SOURCE OF TRUTH MATRIX

Per ogni categoria · "fonte attuale" (dove la Moodboard pesca oggi) vs "fonte corretta" (dove dovrebbe pescare per essere Knowledge-Native).

| Entità | Fonte ATTUALE | Fonte CORRETTA (KE) | Gap |
|--------|---------------|---------------------|-----|
| **Prodotti** | `block.content` JSON inline · campo `product` definito in `LibraryPanel.CONTENT_CATALOG` ma SENZA backend fetch · nessun product picker | `products` table (398 rows ARBI · 333 RIVA1920) via `/api/knowledge/catalog-sets/{id}/products` (endpoint non esiste ancora) o `brand_detected_entities` con `entity_type='product'` | 🔴 HIGH |
| **Materiali** | `block.content` JSON inline · stesso pattern del prodotto | `brand_detected_entities` con `entity_type IN ('material','finish')` · 12 materiali su ARBI | 🔴 HIGH |
| **Designer** | Non esiste un picker designer · al massimo testo libero | `brand_detected_entities` con `entity_type='designer'` · 26 designer su RIVA1920 | 🔴 HIGH |
| **Brand** | Non referenziato · la moodboard si lega a `project_id` (opzionale) ma non a `brand_id` | `brands` table · 5 brand attivi | 🟡 MEDIUM (può vivere senza, ma utile per filtraggio) |
| **Collezioni** | Non referenziato | `brand_detected_entities` con `entity_type='collection'` · 12 su ARBI | 🔴 HIGH |
| **Immagini** | DUE fonti parallele: (a) upload via `/api/storage/signed-download` (image_url raw) (b) curated inspirations via `/api/inspirations/archive` | `brand_catalog_pages.asset_refs` + (futuro) `brand_detected_entities` `entity_type='image'` · supporto KPI già pronto da KE-002.1 | 🔴 HIGH |
| **Palette** | `block.type='palette'` con `content.colors[]` inline | Nessuna SSoT esiste · estraibile dai `brand_palettes` se popolata (vuota oggi) | 🟢 LOW |
| **Moodboard Items / Layout** | `moodboard_elements` con position_json / style_json | OK · è un livello "viewport" giusto restare locale | 🟢 LOW |

**Score Source of Truth**: 5/8 categorie pescano da fonti SBAGLIATE → 62.5% di drift.

---

## 3 · DUPLICATION AUDIT

| Duplicazione | Dove | Rischio |
|--------------|------|---------|
| `block.content.src` (image_url raw) vs `brand_catalog_pages.asset_refs` (storage_key canonica) | `moodboard_elements.image_url` + `metadata_json` snapshot | 🔴 HIGH · stessa immagine può comparire come URL diverso in 10 moodboard senza alcun back-reference all'asset canonico |
| `block.content` per product/material con label/descrizione INLINE | nessun `entity_id` di copertura | 🔴 HIGH · se si rinomina "Walnut → Noce Canaletto" in Brand Atlas, le moodboard mantengono "Walnut" per sempre (snapshot copia) |
| `content` salvato come **stringa JSON serializzata** (`json.dumps(content)`) | `moodboards_v1.py` L573 | 🟡 MEDIUM · doppia serializzazione (JSON dentro JSON-string in colonna) · non query-friendly |
| Curated inspirations duplicate path | `/api/inspirations/archive` parallelo a Brand Atlas | 🟡 MEDIUM · 2 sistemi di image discovery che non si parlano |
| `_push_activity('moodboard.block_added', ...)` | `moodboards_v1.py` L583 | 🟢 LOW · usa `activity_log` ma è un log di telemetria, NON il ledger KE |
| `usage-events` su `inspirations_registry` | `MoodboardEditor.jsx` L405 | 🟡 MEDIUM · esiste un secondo ledger di usage (curated inspirations) parallelo a `entity_operational_usage` |

**Tassonomia delle copie**: ogni "Product block" in moodboard è una **snapshot fotografica** di nome/immagine/descrizione presa quando l'utente l'ha trascinato. Zero binding canonico.

---

## 4 · ENTITY FLOW AUDIT

Cosa succede quando l'utente inserisce in moodboard:

### 4.1 · Inserimento "+ Prodotto"

```
LibraryPanel.tile('product').onClick
  → handleAddBlock('product')
  → POST /api/moodboards/{id}/blocks { type: 'product', content: {…UI text…} }
  → moodboard_elements INSERT { type='product', content=json('{"name":"…", "description":"…"}'), entity_id=NULL }
  → moodboards.updated_at = now()
  → _push_activity('moodboard.block_added', {block_type:'product'})
```

**Domande** (risposte basate su grep sul source):

| Domanda | Risposta | Evidenza |
|---------|----------|----------|
| La moodboard usa `entity_id`? | ❌ **NO** | `grep entity_id` su moodboards*.py → zero match (eccetto `entity_type='moodboard'` per collab) |
| Copia i dati? | ✅ **SÌ** | `content` è un JSON inline arbitrario · nessun ref a tabelle KE |
| Le modifiche del Brand Atlas si propagano? | ❌ **NO** | Nessun trigger SQL · nessun job di sync · nessuna lettura join · l'elemento moodboard è statico |
| Le correzioni certificate (Walnut→Noce Canaletto) arrivano? | ❌ **NO** | Stessa ragione · una decisione `knowledge_impact_events` non aggiorna alcun `moodboard_elements.content` |
| `Future Uses` viene aggiornato? | ❌ **NO** | Zero scritture in `entity_operational_usage` o `entity_future_uses_v` da moodboard create/save |
| `Connected Assets` viene aggiornato? | ❌ **NO** | Zero scritture in `brand_entity_relations` con `relation_type='used_in_moodboard'` o simili |
| `Knowledge Impact` viene aggiornato? | ❌ **NO** | Zero scritture in `knowledge_impact_events` dal flusso moodboard |

### 4.2 · Conclusione del flow audit

**0/7 propagazioni** funzionano. La Moodboard è write-only verso `moodboard_elements` e read-only da `/api/inspirations/archive`. Il Brand Atlas viene **scavalcato in entrambe le direzioni**.

---

## 5 · UNIFIED ENTITY PICKER ANALYSIS

### 5.1 · Stato attuale del picker

`LibraryPanel.jsx` mostra una **palette di BLOCK TYPES**, NON un picker di entità:

```js
CONTENT_CATALOG = [
  { key: 'image',    disabled: false },   // ⇢ apre IPC inspirations
  { key: 'product',  disabled: false },   // ⇢ crea block vuoto, l'utente digita
  { key: 'material', disabled: false },   // ⇢ idem
  { key: 'text',     disabled: false },
  ...
];
```

Click su "+ Prodotto" → crea block con `content={}` vuoto · zero ricerca cross-Brand · zero typeahead · zero canonical-id lookup.

### 5.2 · Cosa manca per arrivare a `Brand Atlas Powered Picker™`

| Componente mancante | Effort indicativo |
|---------------------|-------------------|
| Modale picker generica `<EntityPicker entityType={...} brandId={...} />` con typeahead su `brand_detected_entities` | 🟢 LOW · 1 componente, ~150 righe |
| Endpoint backend `/api/knowledge/entities/search?type=&q=&brand=&limit=` | 🟢 LOW · ~30 righe (filtro su tabella esistente) |
| Schema-level: aggiungere `entity_id` (FK nullable) + `canonical_ref_id` a `moodboard_elements` | 🟡 MEDIUM · 1 migration + index |
| Render dinamico in `MoodboardEditor` che pesca `display_name` / `image_url` / `confidence` dal canonical · fallback su `content` inline per legacy blocks | 🟡 MEDIUM · ~80 righe in `BlockRegistry.js` |
| Sync-on-rename: trigger DB OR endpoint scheduled job che aggiorna `metadata_json.snapshot` dei block quando l'entità canonica cambia | 🟡 MEDIUM · 1 service · ~120 righe |

**Effort totale stimato per Picker Knowledge-Native**: 1 sprint medio (KE-006).

---

## 6 · CONNECTED ASSETS · GAP ANALYSIS

**Domanda**: oggi esiste il collegamento `Entità → Moodboard` nel grafo Connected Assets?

**Risposta**: ❌ **NO**.

| Verifica | Risultato |
|----------|-----------|
| Esiste `brand_entity_relations.relation_type='used_in_moodboard'`? | ❌ Nessuna riga in 682 relations · nessun `relation_type` con substring "moodboard" |
| Esiste tabella `entity_moodboard_link` o simile? | ❌ Non esiste |
| L'endpoint `/connected-assets/{entity_id}` ritorna mai un `nodes.moodboard[]` non vuoto? | ⚠️ Lo schema lo prevede (legend mostra "Moodboard 0" su ARBI) ma è sempre 0 perché nessuna riga lo popola |
| Esiste `brand_detected_entities.usage_count.moodboard`? | ❌ Non esiste |

**Effort per chiudere il gap**:
- Migration: aggiungere `relation_type='used_in_moodboard'` come valore valido + view di aggregazione · 🟢 LOW
- Side-effect: dopo `POST /moodboards/{id}/blocks` con block.entity_id≠null, insert in `brand_entity_relations` con `source=entity_id`, `target=moodboard_id`, `relation_type='used_in_moodboard'` · 🟢 LOW
- Cleanup: idem su `delete_block` · 🟢 LOW

---

## 7 · FUTURE USES · GAP ANALYSIS

**Domanda**: quando l'utente crea una moodboard che usa l'entità "Noce Canaletto", il counter `Future Uses.moodboard` per quella entità si incrementa automaticamente?

**Risposta**: ❌ **NO**.

| Verifica | Risultato |
|----------|-----------|
| Esiste insert in `entity_operational_usage` dal moodboard router? | ❌ Zero match |
| Lo schema `entity_operational_usage` esiste? | ✅ SÌ (migration 129 · KE-003 V3.1) · `count=0` su DB |
| L'endpoint `/future-uses/{entity_id}` ritorna mai `used_in.moodboard > 0`? | ❌ No · sempre 0 |
| Esiste un job scheduled che ricostruisce il counter? | ❌ No |

**Effort**: ~30 righe Python per il side-effect (analogo a quello di Connected Assets) · 🟢 LOW.

---

## 8 · KNOWLEDGE IMPACT · GAP ANALYSIS

**Domanda**: l'uso di un'entità certificata in una moodboard genera un evento nel ledger `knowledge_impact_events`?

**Risposta**: ❌ **NO**.

`knowledge_impact_events` è popolato solo da `POST /apply-correction` (cioè dalle certificazioni in Review Workspace V3.1, vedi KE-003). Il flow moodboard non scrive nulla nel ledger.

**Considerazione semantica**: aggiungere un evento per OGNI inserzione moodboard rumorerebbe il ledger. Approccio migliore:
- Lasciare `knowledge_impact_events` per le CORREZIONI semantiche
- Introdurre un secondo ledger leggero `entity_usage_events` (o usare `entity_operational_usage` esistente) per il "consumo" operativo

**Effort**: 🟡 MEDIUM se si vuole introdurre il ledger dedicato · 🟢 LOW se si usa `entity_operational_usage` (già esistente).

---

## 9 · DESIGN JOURNEY READINESS

Quanto del codice moodboard è **riutilizzabile** per le surface adiacenti (Design Journey · Material Board · Client Presentation · Home Staging)?

| Componente | Riutilizzabilità | Motivazione |
|-----------|------------------|-------------|
| `moodboard_pages` schema (multi-page container) | 🟢 HIGH | Generico · può ospitare anche Design Journey pages |
| `moodboard_elements` block system | 🟡 MEDIUM | Solo se diventa entity-native (oggi è troppo rigido) |
| `BlockRegistry.js` + tipi block (image · text · palette · product · material) | 🟢 HIGH | I block types sono cross-surface |
| `PagesFilmstrip` · `PagesNavigator` · `PageInspector` | 🟢 HIGH | UX pure layout · zero dipendenza moodboard |
| `LibraryPanel` content catalog | 🟡 MEDIUM | Va trasformato in `EntityLibraryPanel` knowledge-aware |
| `PresentationMode` · `share_tokens` | 🟢 HIGH | Riusabile per Client Presentation |
| `premiumTemplates.js` | 🟢 HIGH | Riusabile per Material Board / Home Staging Pack |
| **Knowledge-Engine hooks (zero attualmente)** | 🔴 N/A | Vanno costruiti UNA volta sola in un `services/knowledge_usage_hooks.py` riusabile da TUTTE le surface |

**Conclusione**: se si fa il knowledge-wiring nel layer `moodboard_elements` UNA volta, automaticamente Design Journey · Material Board · Client Presentation · Home Staging lo ereditano (refattorizzando come `composition_pages` + `composition_elements` cross-surface). **Evitando il knowledge-wiring per ogni surface separatamente si rischia di duplicare 4 volte lo stesso codice.**

---

## 10 · PRIORITÀ RACCOMANDATE

> Tre opzioni · ordinate da minimum-viable a piattaforma-grade.

### Opzione A · MVP Bridge (1 sprint corto · "Moodboard 1.5")
- ✅ Aggiungere colonna `entity_id` nullable a `moodboard_elements`
- ✅ Backend `POST /blocks` accetta `entity_id` e (se presente) snapshotta `display_name`/`image_url` dal canonical
- ✅ Side-effect: insert in `brand_entity_relations` (used_in_moodboard) + `entity_operational_usage.moodboard += 1`
- ✅ Frontend: piccolo modale `<EntityPicker>` su "+ Prodotto" / "+ Materiale" / "+ Designer"
- ❌ Niente sync-on-rename · niente unificazione cross-surface
- **Pro**: chiusura rapida del gap di base
- **Contro**: lascia 4 surface ancora da wirare separatamente

### Opzione B · Knowledge-Native Refactor (2 sprint · "Moodboard 2.0")
- ✅ Opzione A + sync-on-rename (cron leggero che aggiorna `metadata_json.snapshot`)
- ✅ Brand Atlas Powered Picker™ con typeahead full-fuzzy
- ✅ Block-level "operational readiness" badge (riusa endpoint KE-004)
- ✅ Empty-state "non hai ancora certificato entità per questo brand → vai al Knowledge Engine"
- **Pro**: completa il loop user-facing
- **Contro**: investimento medio · ma high-ROI

### Opzione C · Composition Foundation (3 sprint · "MOOD Surfaces 1.0")
- ✅ Refactor `moodboard_elements` → `composition_elements` generico con surface_type discriminator
- ✅ Knowledge hooks UNA volta sola in service-layer condiviso
- ✅ Design Journey · Material Board · Client Presentation costruite SOPRA lo stesso schema, ereditando knowledge integration
- **Pro**: zero duplicazione architetturale · scala a 5+ surface
- **Contro**: investimento più alto, ma rimuove debito futuro

### Raccomandazione

**Procedere con Opzione B**.

L'opzione A è troppo tattica per un sistema che pretende di essere "primo consumatore reale del Knowledge Engine" — risolverebbe il gap quantitativo ma non quello narrativo. L'opzione C è teoricamente migliore ma rischia di rinviare di troppo la visibility del valore. L'opzione B chiude il loop user-facing in 2 sprint e lascia spazio a un eventuale lift-to-C in futuro (le hook nel service-layer sono già un terzo del lavoro di C).

---

## 11 · CLASSIFICAZIONE FINALE

# 🔴 **C) LEGACY_ISLAND**

### Motivazioni puntuali

1. **Zero foreign key** da `moodboard_elements` verso `brand_detected_entities` / `products` / `brand_entity_relations`.
2. **Zero hook** dal flusso moodboard verso i 4 ledger di KE-004 (`entity_operational_usage` · `brand_entity_relations` · `knowledge_impact_events` · Future Uses materialized view).
3. **Drift di Source of Truth**: 5/8 categorie (Prodotti · Materiali · Designer · Collezioni · Immagini) hanno fonte sbagliata o duplicata.
4. **2 ledger di usage paralleli**: `inspirations_registry/usage-events` (curated) vs `entity_operational_usage` (KE) — i moodboard scrivono nel primo, KE-004 legge dal secondo.
5. **Snapshot fotografico**: ogni `block.content` è una copia statica dei dati dell'entità · le correzioni certificate da KE-003 (Walnut → Noce Canaletto) **NON si propagano** alle moodboard esistenti.
6. **Picker non Knowledge-aware**: il `LibraryPanel.CONTENT_CATALOG` è una palette di TIPI, non di ENTITÀ.
7. **Zero readiness check**: nessuna moodboard mostra mai i badge KE-004 (`OPERATIONAL READY FOR moodboard`) perché non sa quali entità sta usando.
8. **Architettura duplicabile per le altre surface**: senza un service-layer condiviso di knowledge-hooks, ogni nuova surface (Design Journey · Material Board · Client Presentation · Home Staging) ripeterebbe lo stesso debito.

### Cosa NON è la Moodboard oggi

❌ Non è il "primo consumatore del Knowledge Engine"
❌ Non è la prova che KE-001…KE-004 generano valore downstream
❌ Non è il bridge verso il Brand Atlas
❌ Non è la dimostrazione che "un'entità certificata vive nell'ecosistema"

### Cosa È invece

✅ Un block-editor premium ben costruito (Blueprint Chameleon-coherent, multi-page, share/approve, presentation mode)
✅ Una candidata IDEALE a diventare il primo Knowledge-Native consumer · l'infrastruttura UX è solida
✅ Una base architetturale che, se wirata correttamente, può sostenere altre 4 surface

---

> **Firma report**: Main Agent · iteration 214 · 06 Jun 2026 14:55 UTC
> **Modalità**: READ-ONLY · zero modifiche al codice · zero migrazioni
> **Test credentials**: `admin@moodfordesign.com` / `Blueprint2024!`
> **Catalog set di riferimento**: ARBI test 2026 (`00e33d7f-bcc4-47ae-914f-617d049906a7`) · RIVA1920 (`a1b8cfac-4c27-4b9d-88f7-877f75f8445c`)
