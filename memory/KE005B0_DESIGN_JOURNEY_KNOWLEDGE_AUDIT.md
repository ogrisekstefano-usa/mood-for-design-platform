# KE-005B.0 · Design Journey Knowledge Audit™

> **Sprint**: KE-005B.0 · audit architetturale (READ-ONLY) gemello a KE-005A
> **Mission**: stabilire se il Design Journey è Knowledge-Native, Partially Integrated o Legacy Island — e se merita di essere unificato con la Moodboard in un singolo refactor.
> **Data**: 06 Giugno 2026 · iteration 215
> **Constraint rispettato**: zero implementazione, zero migration, zero refactor.

---

## 0 · TL;DR

# 🔴 **C) LEGACY_ISLAND** (transitivo)

Il Design Journey è una **workflow surface** (milestone tracker + status narrative + linked artifact), non un block-editor. Tuttavia, **identicamente** alla Moodboard, **non parla MAI** con il Knowledge Engine: nessuna foreign key a `brand_detected_entities`, nessun trigger su `entity_operational_usage`, nessun side-effect su `brand_entity_relations` o `knowledge_impact_events`.

L'unico "ponte" semantico esiste in `journey_milestones.linked_entity_id` — ma è un puntatore polimorfico a `moodboards.id` o `project_plans.id`, **NON** alle entità canoniche del Brand Atlas. Poiché la Moodboard a sua volta non conosce le entità (vedi KE-005A), il Design Journey è **doppiamente isolato**: anche se volesse propagare il knowledge, l'artefatto intermedio non lo trasporta.

**Conclusione operativa**: Moodboard e Design Journey **devono essere risolti insieme**. Aprire due refactor separati replicherebbe la stessa diagnosi 4 volte (Moodboard · Design Journey · Material Board · Client Presentation).

---

## 1 · ARCHITETTURA ATTUALE

### Tabelle DB (count attuale · tutte vuote in produzione)

```
design_journeys      count = 0     (cols: id, tenant_id, project_id, current_phase, lifecycle_status, …)
journey_milestones   count = 0     (cols incl. status, owner_user_id, linked_entity_type, linked_entity_id, metadata)
```

**NON ESISTONO**:
```
design_journey_steps · design_journey_items · design_journey_pages ·
design_journey_blocks · design_journey_elements · journey_threads
```

Il Design Journey è quindi un modello **molto più snello** della Moodboard: un container `design_journey` + N `milestone` con stato, owner, narrative templates e un `linked_entity_id` polimorfico.

### Backend (8 router · 1 tabella + 1 link)

| Router | Endpoint principali |
|--------|---------------------|
| `routers/design_journey.py` (548 righe) | `/projects/{id}/journey` (CRUD container) · `/journeys/{id}/timeline` · `/journeys/milestones/{mid}` (PATCH status) · `/journeys/milestones/{mid}/open` |
| `routers/journeys.py` | `/journeys/{id}/overview` · `/artifacts` · `/brief` · `/lifecycle` · `/milestones/{mid}/status` · `/milestones/parallel` · `/catalog/rooms` · `/catalog/chapters` |
| `routers/journey_step_workspace.py` | `/journey/projects/{id}/steps/{type}` (step detail) |
| `routers/account_journeys.py` · `routers/journey_assignments_admin.py` · `routers/journey_initiate.py` · `routers/journey_mail.py` · `routers/journey_pulse.py` · `routers/published_journeys.py` · `routers/journey_closure.py` | Wrapping per onboarding · invio mail · pulse · closure · published list |

### Frontend (4 file principali)

```
pages/workspace/DesignJourneyTab.jsx
pages/journey/JourneyPreparingPage.jsx
pages/site/BeginJourneyPage.jsx
components/journey/MoodboardDirectionWorkspace.jsx (69 righe)
```

### `linked_entity_id` · cosa referenza realmente?

Grep su `design_journey.py` linee 105-106 / 319-320 / 545-546:
- `linked_entity_type` ∈ `{ "moodboard", "project_plan", ... }` (set non vincolato a DB level)
- `linked_entity_id` = UUID dell'artefatto linked

🔴 **Critica**: `linked_entity_type='moodboard'` punta a `moodboards.id`, **non** a `brand_detected_entities.id`. Anche tracciando `linked_entity_*` non si sale al Brand Atlas perché la moodboard stessa non conosce le entità (KE-005A).

---

## 2 · SOURCE OF TRUTH MATRIX

| Entità | Fonte ATTUALE | Fonte CORRETTA (KE) | Gap |
|--------|---------------|---------------------|-----|
| **Milestone artifacts** | `linked_entity_type/id` → `moodboards` or `project_plans` (locale) | Stesso, MA via moodboard/plan che a loro volta linkano entità canoniche | 🔴 HIGH (transitivo) |
| **Stato milestone** | `journey_milestones.status` enum locale | OK, è specifico del workflow | 🟢 LOW |
| **Owner user** | `journey_milestones.owner_user_id` → users | OK | 🟢 LOW |
| **Catalog rooms / chapters** | `/journeys/catalog/rooms` · `/chapters` (configurazione editoriale) | Indipendenti dal KE | 🟢 LOW |
| **Brief content** | `/journeys/{id}/brief` ritorna fields da `design_journeys` table | OK locale, ma il brief potrebbe mostrare entità certificate per il brand | 🟡 MEDIUM |
| **Artifacts list** | `/journeys/{id}/artifacts` aggrega linked artifacts | OK strutturalmente, ma il dato sotto è snapshot inline | 🟡 MEDIUM (transitivo via moodboard) |

**Score Source of Truth**: 2/6 categorie con drift HIGH/MEDIUM. Migliore della Moodboard (5/8 sbagliate) **ma solo perché il Design Journey ha meno dati**, non perché è più integrato.

---

## 3 · DUPLICATION AUDIT

| Duplicazione | Dove | Rischio |
|--------------|------|---------|
| Status narrative templates inline (`STATUS_NARRATIVE`) | `design_journey.py` L116-123 | 🟢 LOW (editoriale, OK) |
| `metadata` JSON arbitrario per milestone | `journey_milestones.metadata` | 🟡 MEDIUM (snapshot del moodboard linked) |
| Catalogo rooms/chapters duplicato | `/api/journeys/catalog/rooms` + frontend constants | 🟡 MEDIUM (sync manuale) |
| `published_journeys` come secondo concetto parallelo | `routers/published_journeys.py` | 🟢 LOW (è template gallery, OK) |

Molto meno duplicazione della Moodboard — il Design Journey è uno **stato leggero**, non un editor.

---

## 4 · ENTITY FLOW AUDIT

### 4.1 · Inserimento "+ Artefatto" su una milestone

```
User clicks "Allega moodboard a milestone Moodboard"
  → MoodboardDirectionWorkspace.jsx
  → PATCH /api/journeys/milestones/{mid}
     { linked_entity_type: "moodboard", linked_entity_id: <moodboard_uuid> }
  → journey_milestones UPDATE { linked_entity_id }
  → activity_log push
```

### 4.2 · Risposte alle 7 domande critiche

| Domanda | Risposta | Evidenza |
|---------|----------|----------|
| Il Design Journey usa `entity_id` (in senso KE)? | ❌ **NO** | `linked_entity_id` punta a moodboard/plan, NON a `brand_detected_entities` |
| Copia i dati? | ⚠️ **Indirettamente** | Lui no, MA il moodboard linked sì (vedi KE-005A) |
| Le modifiche del Brand Atlas si propagano? | ❌ **NO** | Stessa catena rotta della Moodboard |
| Le correzioni certificate (Walnut → Noce Canaletto) arrivano? | ❌ **NO** | Il Design Journey non sa quali materiali contiene la moodboard linked |
| `Future Uses` viene aggiornato? | ❌ **NO** | Zero scritture in `entity_operational_usage` dal Design Journey |
| `Connected Assets` viene aggiornato? | ❌ **NO** | Zero scritture in `brand_entity_relations` con `relation_type` "journey" |
| `Knowledge Impact` viene aggiornato? | ❌ **NO** | Zero scritture in `knowledge_impact_events` |

**0/7 propagazioni**, identico alla Moodboard.

---

## 5 · UNIFIED ENTITY PICKER ANALYSIS

Il Design Journey **non ha un entity picker**. Ha un "artifact picker" (selezione moodboard / project_plan) che è un selettore di OGGETTI INTERNI MOOD, non di entità canoniche.

**Effort per Brand-Atlas-Powered Picker**: stessa stima della Moodboard (LOW per il picker + MEDIUM per i side-effect). Se costruito come componente condiviso, copre ENTRAMBE le surface.

---

## 6 · CONNECTED ASSETS · GAP ANALYSIS

| Verifica | Risultato |
|----------|-----------|
| Esiste `brand_entity_relations.relation_type='used_in_journey'`? | ❌ NO (0 su 682 righe contengono substring "journey") |
| Esiste tabella `entity_journey_link`? | ❌ NO |
| L'endpoint Connected Assets ritorna mai un `nodes.journey[]` non vuoto? | ⚠️ La legend prevede "Journey 0" ma è sempre 0 |
| Esiste `brand_detected_entities.usage_count.journey`? | ❌ NO |

**Identico alla Moodboard.** L'endpoint KE-004 era già pronto per gestirlo (la legend Connected Assets contiene "Journey") ma nessuno scrive le righe.

---

## 7 · FUTURE USES · GAP ANALYSIS

❌ **Nessun side-effect** dal Design Journey verso `entity_operational_usage`. Idem KE-005A.

---

## 8 · KNOWLEDGE IMPACT · GAP ANALYSIS

❌ **Nessuna scrittura** in `knowledge_impact_events` dal flow journey. Stesso pattern.

---

## 9 · CLASSIFICAZIONE FINALE

# 🔴 **C) LEGACY_ISLAND** (transitivo)

### Motivazioni

1. **Zero foreign key** verso `brand_detected_entities` / `products` / `brand_entity_relations` / `knowledge_impact_events`.
2. **Zero hook** dal flow journey verso i ledger KE.
3. **Bridge polimorfico spezzato**: `linked_entity_id` punta a moodboards/plans che a loro volta non hanno entity_id.
4. **Connected Assets / Future Uses / Impact mai aggiornati** quando una milestone avanza, viene presentata o chiusa.
5. **Catalog rooms/chapters** disgiunte dal Brand Atlas (catalogo editoriale separato).

### Cosa NON è il Design Journey oggi

❌ Non vede mai le entità certificate
❌ Non comunica al Brand Atlas le decisioni progettuali
❌ Non sa quali materiali / designer / prodotti sono coinvolti in una milestone (nemmeno via moodboard linked)

### Cosa È

✅ Un orchestratore di milestone con narrative templates (UX premium)
✅ Una surface molto più semplice della Moodboard da rendere Knowledge-Native (meno righe da toccare)
✅ Il punto NATURALE in cui aggregare il knowledge ricavato dagli artifact linked

---

## 10 · MOODBOARD vs DESIGN JOURNEY · DIAGNOSI A CONFRONTO

| Dimensione | Moodboard (KE-005A) | Design Journey (KE-005B.0) |
|-----------|----------------------|------------------------------|
| Tabella principale | `moodboard_elements` (rich block content) | `journey_milestones` (status + linked artifact id) |
| Volume codice | 4157 righe FE + 1031 righe BE | ~600 righe BE · ~500 righe FE |
| Foreign key al KE | ❌ ZERO | ❌ ZERO |
| Hook ai 4 ledger KE | ❌ ZERO | ❌ ZERO |
| Drift di SSoT | 5/8 categorie | 2/6 categorie |
| Picker entity-aware | ❌ NO | ❌ NO |
| Effort refactor | MEDIO (1-2 sprint) | BASSO (½-1 sprint) |
| Surfaces che ereditano il refactor | Material Board · Home Staging | Client Presentation · Project Closure |

### Verdetto

**Le due surface condividono il 100% dei gap.** Aprire due refactor separati sarebbe duplicazione architetturale. La soluzione corretta è un **unico sprint convergente**.

---

## 11 · PROPOSTA UNIFICATA · KE-005B · KNOWLEDGE-NATIVE SURFACES™

### Architettura proposta (in 3 layer)

```
┌─ Layer 3 · SURFACES (UI)             ─────────────────────────────────┐
│   Moodboard · Design Journey · Material Board · Client Presentation  │
└──────────────────────────────────────────────────────────────────────┘
                              ▲
┌─ Layer 2 · KNOWLEDGE HOOKS (shared) ─────────────────────────────────┐
│   services/knowledge_usage_hooks.py                                   │
│     on_entity_attached(surface_type, surface_id, entity_id, …)        │
│       → INSERT entity_operational_usage                               │
│       → INSERT brand_entity_relations(used_in_<surface_type>)         │
│       → optionally bump entity_usage_events ledger                    │
│     on_entity_detached(...)  →  reverse                               │
│     on_entity_rename_propagate(entity_id) → sync metadata_json        │
└──────────────────────────────────────────────────────────────────────┘
                              ▲
┌─ Layer 1 · CANONICAL SCHEMA (shared) ────────────────────────────────┐
│   ALTER moodboard_elements    ADD COLUMN entity_id UUID NULL          │
│   ALTER journey_milestones    ADD COLUMN entity_refs JSONB DEFAULT '[]'│
│   (future) material_board / presentation usano analoghe colonne)     │
└──────────────────────────────────────────────────────────────────────┘
```

### Sprint breakdown (KE-005B = KE-005B.1 + KE-005B.2)

**KE-005B.1 · Foundation (½ sprint)**
- Migration: aggiungere `entity_id` a `moodboard_elements`, `entity_refs JSONB` a `journey_milestones`
- Backend: nuovo service `services/knowledge_usage_hooks.py` (3 funzioni: attach, detach, propagate)
- Backend: nuovo endpoint `/api/knowledge/entities/search?type=&q=&brand=&limit=` (typeahead)
- Side-effect: dopo `POST /moodboards/{id}/blocks` se `block.entity_id`, chiama hook attach
- Side-effect: dopo `PATCH /journeys/milestones/{mid}` se aggiunto a entity_refs, chiama hook attach

**KE-005B.2 · Surfaces (1 sprint)**
- Frontend componente condiviso `<EntityPicker entityType={...} />` (~150 righe)
- Moodboard: LibraryPanel "+ Prodotto" / "+ Materiale" / "+ Designer" apre EntityPicker
- Design Journey: milestone "presented" trigger auto-include entity_refs ricavati dal moodboard linked
- Render UX: badge "OPERATIONAL READY" + tooltip con `used_in / available_for` reali
- Empty state: "Nessuna entità certificata per questo brand · vai al Knowledge Engine"

### ROI atteso (post KE-005B.2)

- Ogni inserimento moodboard incrementa `Future Uses.moodboard` per l'entità
- Ogni milestone "presented" incrementa `Future Uses.design_journey`
- Connected Assets mostra il vero grafo (Moodboard 12 · Journey 3 · ecc.)
- Knowledge Impact diventa metrica BIDIREZIONALE (decisioni IN · utilizzi OUT)
- Material Board e Client Presentation eredidatano la stessa architettura via hook condiviso

### Out of scope (esplicito per KE-005B)

- ❌ Material Board UI · solo schema-ready
- ❌ Client Presentation UI · solo schema-ready
- ❌ Sync-on-rename batch · v1 può tollerare lieve drift; sync verrà aggiunto in KE-005C se necessario

---

## 12 · RACCOMANDAZIONE FINALE

✅ **Procedere con KE-005B (sprint unificato)** invece di due refactor separati.

Il vantaggio è triplo:
1. **Architetturale**: una sola service-layer `knowledge_usage_hooks.py` da mantenere
2. **Economico**: 1.5 sprint vs 2.5 sprint separati (sinergia su EntityPicker + migration)
3. **Strategico**: in 1.5 sprint la piattaforma passa da 0/4 surface Knowledge-Native a 2/4, con foundation pronta per 4/4

Quando partirà KE-005B raccomando di iniziare da **KE-005B.1 Foundation** (½ sprint, infrastructure-only, niente UI). Poi KE-005B.2 Surfaces in un sprint UX-focused.

---

> **Firma report**: Main Agent · iteration 215 · 06 Jun 2026 15:05 UTC
> **Modalità**: READ-ONLY · zero modifiche al codice
> **Audit di pari livello**: `/app/memory/KE005A_MOODBOARD_KNOWLEDGE_INTEGRATION_AUDIT.md`
> **Test credentials**: `admin@moodfordesign.com` / `Blueprint2024!`
