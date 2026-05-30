# Blueprint Tenant — Mini-Audit (May 30, 2026)

Audit puramente di scoperta. Nessuna modifica al codice. Obiettivo: stabilire effort vs valore per scegliere il primo modulo da rendere production-ready, in linea con il criterio strategico utente:

> "La priorità non è la feature più spettacolare ma quella che rende Blueprint utilizzabile da uno showroom o studio reale nel minor tempo possibile."

---

## 📐 Legenda completamento (%)

- **DB schema**: tabelle esistono con colonne ragionevoli
- **DB dati**: ci sono righe reali (≥ 1)
- **Backend API**: endpoint REST esposti su un router
- **Backend service**: logica di servizio dedicata
- **Frontend route**: route React montata
- **Frontend UI**: componenti utilizzabili nel Blueprint workspace

Score: ogni voce = 17%. Max = 100%.

---

## 📊 Matrice per modulo

### 1️⃣ Media Library

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `media_library` (33 col), `media_collections` (12 col), `media_asset_variants` (19 col), `media_filter_presets` (12 col) |
| DB dati | ✅ | 81 asset reali in `media_library` (tenant studio) |
| Backend API | ✅ | `POST /api/admin/media/upload`, `GET /assets`, `PATCH /assets/{id}`, `DELETE`, `POST hotspots` |
| Backend service | ✅ | `services/media_library.py` (252 righe) |
| Frontend route | ✅ | `/blueprint/media` montata in `BlueprintApp.jsx` |
| Frontend UI | ✅ | `admin/pages/MediaLibrary.jsx` (280 righe, list + register + orphans toggle + delete + alt-text edit) |
| **Completamento** | **🟢 ~95%** | Manca: bulk upload UI con drag-drop multiplo, tagging avanzato, ricerca per uso |
| Dipendenze | Nessuna | usato da CMS Pages/Blocks già pronto |
| Effort per produzione | **Basso** (~1-2 giorni) | rifinitura UI + accept tags + filtri |
| Valore business | **Alto** | Ogni studio reale ha foto da gestire dal giorno 1 |

### 2️⃣ Leads

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `leads` (48 col!), `lead_assignments` (8 col), `lead_intake_questions` (col?) |
| DB dati | ✅ | 9 lead reali su tenant studio (probabilmente seed test) |
| Backend API | ❌ | Zero router dedicato (`grep` su `routers/*.py` → nessun match) |
| Backend service | ❌ | Zero service |
| Frontend route | ❌ | Nessuna pagina `LeadsList`/`LeadsAdmin` |
| Frontend UI | ❌ | Zero componente dedicato |
| **Completamento** | **🟡 ~33%** | Solo DB pronto (ricco di colonne), tutto il backend+frontend mancante |
| Dipendenze | Studio Request funnel (per intake da `/studio`), Email (Resend già pronto), Advisor (per assignment — già pronto) |
| Effort per produzione | **Medio** (~3-5 giorni) | Router CRUD + List/Detail UI + assignment + status workflow |
| Valore business | **MOLTO ALTO** | Senza leads, lo studio non monetizza. È **la prima cosa** che uno showroom guarda al mattino |

### 3️⃣ CRM (Contacts + Accounts + Projects)

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `contacts` (17 col), `accounts` (34 col), `projects` (17 col), `portfolio_projects` (19 col), `account_team_members` (9 col) |
| DB dati | ✅ | 9 contacts, 9 accounts, 9 projects (tutti tenant studio — verosimilmente seed) |
| Backend API | ❌ | Nessun router CRM (grep "crm\|account\|contact" → solo `/api/contact` su `corporate.py:121` che è il form pubblico) |
| Backend service | ❌ | Zero service |
| Frontend route | ❌ | Nessuna pagina CRM |
| Frontend UI | ❌ | Zero componente |
| **Completamento** | **🟡 ~33%** | Schema ricco ma vuoto a livello applicativo |
| Dipendenze | Leads (lead → contact promotion), Media (project gallery), Team (project assignment) |
| Effort per produzione | **Alto** (~7-10 giorni) | 3 entità CRUD + 2 relazioni N-M + projects timeline + portfolio publishing |
| Valore business | **Alto** ma **secondo** rispetto a Leads | Studio reale prima vuole *acquisire* (Leads), poi *gestire* (CRM) |

### 4️⃣ Design Journey™

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `design_journeys` (13 col), `journey_milestones` (23 col), `journey_timeline_events` (10 col), `journey_briefs` (13 col), `journey_health_signals` (col?), `published_design_journey_translations`, `published_design_journeys` |
| DB dati | ✅ | 9 journeys, 90 milestones, 18 timeline events, 9 briefs (densità importante, seed strutturato) |
| Backend API | ❌ | Zero router dedicato (corporate.py ha SOLO `DesignJourney.jsx` sezione pubblica) |
| Backend service | ❌ | Solo riferimenti collaterali in `access_continuity`, `studio_relations` |
| Frontend route | ❌ | Esiste `corporate/sections/DesignJourney.jsx` — è la **section editoriale** del sito pubblico, NON la editing experience |
| Frontend UI | ❌ | Nessun editor admin |
| **Completamento** | **🟡 ~33%** | Schema profondo (è il "killer feature" MOOD), backend e UI editor mancanti |
| Dipendenze | Projects/Accounts (CRM), Moodboards (riferimenti visivi), Team (chi cura il journey), Material Intelligence (palette) |
| Effort per produzione | **MOLTO ALTO** (~15-25 giorni) | Editor multi-step + timeline + milestone management + published preview + i18n + condivisione client |
| Valore business | **Strategico** | È IL prodotto narrativo che differenzia MOOD. Ma uno showroom small non lo userebbe dal giorno 1 |

### 5️⃣ Material Intelligence™

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `material_assets` (9 col), `material_registry` (22 col), `brands` (24 col), `supplier_catalogs` (26 col), `relationship_material_affinities` |
| DB dati | 🟡 | 0 material_assets, 0 material_registry, **20 brands** (15 senza tenant = global, 5 studio), **5 supplier_catalogs** (studio) |
| Backend API | ❌ | Zero router (solo riferimenti in `ai_editorial.py` per generazione AI) |
| Backend service | ❌ | Zero service dedicato |
| Frontend route | ❌ | Solo riferimenti come `MaterialLibrary` nelle pagine pubbliche corporate, NON editor |
| Frontend UI | ❌ | Zero editor |
| **Completamento** | **🟡 ~25%** | Schema definito + 25 record reali ma totalmente non operativo |
| Dipendenze | Media Library (foto dei materiali), Moodboards (consumer), Brands (lookup table) |
| Effort per produzione | **Alto** (~7-12 giorni) | Catalog editor + ricerca tassonomica + AI tagging + filtri tecnici |
| Valore business | **Alto per showroom**, **Medio per studio architetto** | Showroom = inventario; architetto = use case più sporadico |

### 6️⃣ Moodboards

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `moodboards` (25 col), `moodboard_pages` (15), `moodboard_elements` (19), `moodboard_chapters`, `moodboard_comments`, `moodboard_rooms`, `moodboard_shares`, `moodboard_templates`, `moodboard_versions`, `moodboard_candidates` — schema **ricchissimo** |
| DB dati | 🟡 | 0 moodboards reali, **11 templates** (1 studio + 10 global) |
| Backend API | ❌ | Zero router |
| Backend service | ❌ | Solo riferimenti in `studio_activation.py` |
| Frontend route | ❌ | Nessuna pagina admin |
| Frontend UI | ❌ | Zero editor |
| **Completamento** | **🟡 ~22%** | Schema da prodotto enterprise, ma 0 codice operativo |
| Dipendenze | Media Library (asset di mood), Material Intelligence (texture/palette), Projects (output a chi serve) |
| Effort per produzione | **MOLTO ALTO** (~20-30 giorni) | Canvas drag-drop + multi-pagina + collaboration + share + versioning + AI suggestions. È **un prodotto a sé** |
| Valore business | **Alto come differenziatore**, **Basso come MVP** | Uno showroom reale lo userebbe ma non è quello su cui muore |

### 7️⃣ Workflow / Tasks

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `tasks` (11 col), `project_activity` (9), `collab_activity` (12), `collab_comments`, `collab_versions` |
| DB dati | ❌ | 0 task, 0 activity, 0 collab |
| Backend API | ❌ | Zero |
| Backend service | ❌ | Zero |
| Frontend route | ❌ | Zero |
| Frontend UI | ❌ | Zero |
| **Completamento** | **🟡 ~17%** | Solo schema |
| Dipendenze | CRM (projects), Team (assignees) |
| Effort per produzione | **Medio** (~5-8 giorni) | Kanban + lista + assegnazione + notifiche |
| Valore business | **Medio** | Non blocca le operazioni quotidiane di uno showroom; più utile per studio architetto multi-progetto |

### 8️⃣ Team

| Aspetto | Stato | Evidenza |
|---|---|---|
| DB schema | ✅ | `users` (10 col, ha già `role`), `tenant_memberships` (14 col), `studio_team_members` (14 col), `account_team_members` (9 col) |
| DB dati | 🟡 | 9 users (incluso admin + advisors + founder), 0 tenant_memberships, 0 studio_team_members |
| Backend API | 🟡 | `POST /api/admin/advisors` (parziale: gestisce solo advisor), nessun endpoint generico per team tenant |
| Backend service | 🟡 | Parte di `admin_relations.py` per advisor |
| Frontend route | 🟡 | `/command-center/advisors` esiste (ma è MOOD core, non tenant Blueprint) |
| Frontend UI | 🟡 | `AdvisorsAdmin.jsx` (276 righe) ma scope advisor MOOD, non team tenant |
| **Completamento** | **🟡 ~50%** | Pattern auth ibrido già esiste, va replicato per team tenant |
| Dipendenze | Auth (✅ già pronto), Roles, Permissions |
| Effort per produzione | **Basso-Medio** (~2-4 giorni) | Riuso del pattern `AdvisorsAdmin` su scope tenant: form crea team member → magic-link → set-password |
| Valore business | **Medio** | Studio piccolo non ha team. Studio strutturato sì |

---

## 🎯 Matrice Sintetica — Valore × Effort × Dipendenze

```
                          BASSO EFFORT      MEDIO EFFORT      ALTO EFFORT      MOLTO ALTO

VALORE ALTISSIMO          Media Library     Leads             —                —
(MVP-blocking)            (~95% done)       (~33% done)
                          [no deps]         [Studio+Email
                                             pronti]

VALORE ALTO               Team              Workflow          CRM              Material
                          (~50% done)       (~17% done)       (~33% done)      Intelligence™
                          [Auth ok]         [needs CRM+Team]  [needs Leads,    (~25% done)
                                                               Media, Team]    [needs Media]

VALORE STRATEGICO         —                 —                 —                Design Journey™
(differenziatore)                                                              (~33% done)
                                                                               [needs CRM,
                                                                                Moodboards,
                                                                                Material]
                                                                               Moodboards
                                                                               (~22% done)
                                                                               [needs Media,
                                                                                Material]
```

---

## 🧭 Raccomandazione strategica

Applicando il criterio **"showroom usabile nel minor tempo"**:

### Sprint 1 (sblocca utilizzabilità reale, ~1 settimana di lavoro)

1. **Media Library polish** (~1-2 gg)
   - Bulk upload drag-drop
   - Tag editing
   - Filtri per category/uso
   - È quasi pronto, vale la pena chiuderlo prima di tutto

2. **Leads — implementazione completa** (~3-5 gg)
   - Router CRUD (`/api/admin/tenant/leads/*`)
   - Frontend page `LeadsAdmin` nel Blueprint workspace
   - Stati: new / contacted / qualified / converted / lost
   - Assegnazione a team member (riuso pattern advisor)
   - Sorgente lead (Studio funnel, manuale, importato)

→ Dopo Sprint 1, uno showroom può effettivamente **lavorare** dal Blueprint: caricare foto del catalogo + ricevere e gestire richieste.

### Sprint 2 (rende l'esperienza completa, ~1-2 settimane)

3. **Team Tenant** (~2-4 gg) — riuso pattern auth ibrido
4. **CRM Contacts/Accounts** (~5-7 gg) — entità base senza projects ancora

### Sprint 3 (differenziazione)

5. **Workflow/Tasks** (~5-8 gg) — kanban semplice + assegnazioni
6. **Projects** (parte di CRM ma più ricca) (~5-7 gg)

### Sprint 4+ (premium features — solo dopo che Sprint 1-3 sono live)

7. **Material Intelligence™** (~7-12 gg)
8. **Moodboards** (~20-30 gg) — è un prodotto a sé, va pianificato in parallelo non dopo
9. **Design Journey™** editor admin (~15-25 gg) — il "killer feature" ma con dipendenze forti su 1-8

---

## ⚠️ Note importanti

1. **Schema DB già esiste per tutto**: il lavoro è prevalentemente backend (API) + frontend (UI), poco design di dati. Buona notizia: significa che decisioni architetturali importanti sono già state prese.

2. **`tenant_id` consistenza**: alcuni dati (brands, moodboard_templates) sono "globali" (`tenant_id IS NULL`). Va deciso se rimangono shared catalog o vengono clonati per tenant. **Discutere prima di Material Intelligence™ e Moodboards**.

3. **Tenant `studio` come "tenant-zero"**: tutti i 9+9+9+9 dati seed sono sul tenant `studio` (corporate MOOD). Lo studio Margraf USA appena creato è vuoto. Quando si testerà ogni nuovo modulo serve seed minimale per Margraf.

4. **Asimmetria UI**: l'attuale `BlueprintApp.jsx` ha 7 voci nav (Pagine, Blocks, Sections, Media, Footer, SEO, Publishing). I 7 moduli di FASE 1 (Design Journey, CRM, Leads, Media, Materials, Moodboards, Workflow, Team) **non sono ancora linkati** nel BlueprintApp. La prima cosa da decidere prima dello Sprint 1 è la **nuova information architecture** della sidebar Blueprint.

5. **Email pattern già pronto**: con Resend production + magic-link infrastructure validata oggi, qualsiasi nuovo modulo che richiede notifiche/inviti è plug-and-play.

---

## ✋ Decisioni richieste prima dello Sprint 1

- [ ] Confermi l'ordine **Media polish → Leads → Team → CRM**?
- [ ] Vuoi che i moduli FASE 1 vengano integrati nella **stessa sidebar Blueprint** oppure in una sezione separata (es. `/blueprint/cms/*` per editorial + `/blueprint/studio/*` per operativo)?
- [ ] `brands` e `moodboard_templates` "globali" (tenant_id NULL): **shared catalog** (visibili a tutti i tenant) o **per-tenant** (cloning al provisioning)?

