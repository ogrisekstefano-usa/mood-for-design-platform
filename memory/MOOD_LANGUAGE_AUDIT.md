# MOOD LANGUAGE AUDIT™

**Sprint:** ITER182 · MOOD Language Lock™  
**Tipo:** Documentazione · zero modifiche codice/db/API.  
**Data audit:** 2026-06-01  
**Scope audit:**
- `/app/frontend/src/pages/**`
- `/app/frontend/src/components/**`
- `/app/frontend/src/blueprint/**`
- `/app/frontend/src/i18n/strings/*.json` (7 locales)
- `/app/backend/routers/**`
- `/app/scripts/**`

**Output companion:** `/app/memory/MOOD_LANGUAGE_CANON.md` (governance).

---

## 1 · Sommario esecutivo

L'audit ha individuato **violazioni distribuite su 6 superfici principali** (Inspirations, Moodboard, Studio Pulse, CRM legacy, Cultural Editions, i18n master). Le violazioni si concentrano principalmente nei moduli "editoriali" legacy (`Inspirations`, `MoodPanel`, `StudioPulsePage`, `CulturalEditionReview`) che precedono il rebrand operativo del 2026.

**Stato superfici critiche (dashboard / topbar / sidebar / leads / journey)**: ✅ **già bonificate negli sprint ITER181.A → ITER181.C**.

**Stato superfici operative secondarie** (Library, Inspirations, Moodboards, CRM list, Backend models): ❌ **da consolidare in ITER183 (App-wide Naming Lock)**.

---

## 2 · Tabella sintetica violazioni per termine

Conteggio occorrenze (case-insensitive) per macro-area:

| Termine | Pages | Components | i18n total | Backend routers | Scripts |
|---|---:|---:|---:|---:|---:|
| atmosfera / atmosfere | 37 | 9 | 116 | 30 | 14 |
| segnale / segnali | 6 | 1 | 16 | 11 | 0 |
| relazione / relazioni | 28 | 9 | 120 | 18 | 4 |
| curatoriale / curatorial | 43 | 16 | 112 | 32 | 11 |
| temperamento | 0 | 0 | 0 | 0 | 1 |
| ecosistema | 2 | 0 | 0 | 0 | 2 |
| studio pulse / journey pulse | 9 | 2 | 40 | 4 | 4 |
| cultivation | 3 | 0 | 0 | 0 | 0 |
| warm editorial | 0 | 1 | 0 | 2 | 0 |
| nordic silence / midnight mood / mediterranean light / architectural dawn | 0 | 0 | 2 | 6 | 0 |
| nuova relazione | 2 | 4 | 9 | 2 | 1 |
| active studio | 3 | 0 | 0 | 0 | 0 |
| signal listening | 0 | 0 | 0 | 0 | 0 |

Totale stimato hits ad alta visibilità: **~270 stringhe utente-facing** + **~100 stringhe i18n con visibilità diretta**.

---

## 3 · Violazioni per locale (i18n)

| Locale | atmosphere/atmosfera | curatorial | studio pulse / journey pulse | relationship / nuova relazione | signal/segnal |
|---|---:|---:|---:|---:|---:|
| **en-US (MASTER)** | 34 | 15 | 7 | 6 | 5 |
| en-GB | 33 | 23 | 7 | 5 | 3 |
| **it-IT** | 34 | 7 | 0 | 5 | 4 |
| es-ES | 18 | 10 | 6 | 0 | 2 |
| de-DE | 18 | 7 | 7 | 0 | 3 |
| fr-FR | 18 | 13 | 6 | 0 | 2 |
| ar | 18 | 7 | 7 | 0 | 2 |

**Osservazione critica:** EN-US (master) contiene ancora **67 stringhe** con termini banditi. Poiché EN-US è la lingua sorgente, bonificarla **risolve a cascata** anche gli altri locale durante la prossima sync.

**Locales mancanti:** `es-MX`, `pt-BR` (richiesti dal Founder Directive) → non ancora creati.

---

## 4 · File hot-spot (top 25 per occorrenze)

Ordinati per # occorrenze critical (escluso i18n):

| Rank | File | Hits | Severity | Note |
|---:|---|---:|---|---|
| 1 | `/app/frontend/src/blueprint/moodboard/CuratorialInspirationsModal.jsx` | 28 | 🟠 high | Nome stesso bandito; UI editoriale legacy |
| 2 | `/app/backend/routers/brands_registry.py` | 23 | 🟠 high | Strings di payload riturnate dalla API |
| 3 | `/app/backend/routers/inspirations_archive.py` | 23 | 🟠 high | Idem |
| 4 | `/app/backend/routers/studio_pulse.py` | 22 | 🔴 critical | Endpoint da rinominare (es. `/api/blueprint-dashboard/*`) |
| 5 | `/app/backend/routers/usage_memory.py` | 16 | 🟠 high | "Memory" come entità CRM |
| 6 | `/app/backend/routers/cultural_editions.py` | 16 | 🟠 high | Domain editoriale, parzialmente brand-language ammesso |
| 7 | `/app/backend/routers/client_relations.py` | 16 | 🔴 critical | Riturna "relazione" in payload |
| 8 | `/app/frontend/src/pages/studio/StudioPulsePage.jsx` | 15 | 🔴 critical | Pagina top-level con naming bandito |
| 9 | `/app/backend/routers/magazine.py` | 15 | 🟡 medium | Marketing site, registro editoriale ammesso |
| 10 | `/app/backend/routers/journey_initiate.py` | 15 | 🟠 high | API CRM core |
| 11 | `/app/frontend/src/pages/relations/RelationshipMemoryChapter.jsx` | 14 | 🔴 critical | Nome stesso bandito (Memory + Chapter) |
| 12 | `/app/frontend/src/pages/inspirations/BrandDetailPage.jsx` | 14 | 🟠 high | Library secondaria |
| 13 | `/app/frontend/src/blueprint/moodboard/MoodPanel.jsx` | 14 | 🟠 high | Module editoriale |
| 14 | `/app/frontend/src/pages/inspirations/InspirationDetailDrawer.jsx` | 11 | 🟠 high | Library |
| 15 | `/app/backend/routers/atelier_media.py` | 11 | 🟡 medium | Backend, "atelier" non in lista nera ma da consolidare |
| 16 | `/app/frontend/src/pages/site/ProjectDetailPage.jsx` | 10 | 🟡 medium | Marketing site, registro editoriale ammesso |
| 17 | `/app/frontend/src/pages/moodboards/MoodboardEditor.jsx` | 10 | 🟠 high | Module editoriale |
| 18 | `/app/backend/routers/reference_intelligence.py` | 10 | 🟠 high | Backend |
| 19 | `/app/frontend/src/pages/workspace/ReferencesPage.jsx` | 9 | 🟠 high | Operational page |
| 20 | `/app/frontend/src/pages/inspirations/ProductGalleryPage.jsx` | 9 | 🟠 high | Library |
| 21 | `/app/frontend/src/pages/inspirations/InspirationsPage.jsx` | 9 | 🟠 high | Library |
| 22 | `/app/frontend/src/components/journey/MilestoneDialogue.jsx` | 9 | 🔴 critical | Journey workflow |
| 23 | `/app/frontend/src/pages/dashboard/JourneyPulsePage.jsx` | 9 | 🔴 critical | Nome bandito + journey |
| 24 | `/app/frontend/src/pages/storefront/ClientProfileAdminPage.jsx` | 8 | 🟡 medium | Admin |
| 25 | `/app/frontend/src/pages/cultural/CulturalEditionReviewPage.jsx` | 8 | 🟡 medium | Cultural module |

---

## 5 · Sample stringhe IT-IT i18n con violazioni

Esempi raccolti dall'audit (campionatura):

```
"Nuova relazione"                                  → "Nuovo Lead"
"Apri una nuova relazione"                         → "+ Nuovo Lead"
"Materia e atmosfera"                              → "Materiali e stile"
"Curatorial Atlas"                                 → "Brand Atlas™"
"Cerca per atmosfera, materia, brand…"             → "Cerca per stile, materiali, brand…"
"Atmosfera"                                        → "Stile"
"L'archivio dello studio. Ogni riferimento è letto attraverso la lente culturale dei mercati internazionali: atmosfera, materia, affinità editoriale."
                                                   → "Archivio dello studio. Ogni riferimento è classificato per stile, materiali e affinità di brand."
"atmosfera_in_lettura_curatoriale" (key)           → "style_review" (key)
"Atmosfera in analisi"                             → "Analisi in corso"
"archivio_curatoriale_dello_studio" (key)          → "studio_archive" (key)
```

---

## 6 · Categorie di violazioni (raggruppamento)

### 6.1 · 🔴 Critical — superfici visibili al founder/operatore quotidiano

| File | Termine | Posizione | Replacement |
|---|---|---|---|
| `/app/frontend/src/pages/studio/StudioPulsePage.jsx` | "Studio Pulse" | header + 14 occorrenze | "Blueprint Dashboard" |
| `/app/frontend/src/pages/dashboard/JourneyPulsePage.jsx` | "Journey Pulse" | header + 9 occorrenze | "Design Journey Overview" |
| `/app/frontend/src/pages/relations/RelationshipMemoryChapter.jsx` | "Memory Chapter", "relationship memory" | nome file + 14 occorrenze | "Activity Log" / "Interaction Log" |
| `/app/frontend/src/components/journey/MilestoneDialogue.jsx` | "atmosfera", "curatorial" | 9 occorrenze | "stile" / (rimuovere) |
| `/app/frontend/src/i18n/strings/en-US.json` | 67 stringhe con termini banditi | varie keys | vedi §5 + canon §5 |
| `/app/backend/routers/client_relations.py` | "relazione" in payload labels | 16 occorrenze | "lead/prospect/account" |
| `/app/backend/routers/studio_pulse.py` | URL path `/studio-pulse/*` | router prefix | `/blueprint-dashboard/*` |

### 6.2 · 🟠 High — superfici secondarie operative

| File / area | Issues principali |
|---|---|
| `Inspirations/*` (15+ files) | "atmosfera", "curatoriale", "curatorial atlas" pervasivi |
| `Moodboard/*` (5 files) | "curatorial moodboard", "atmosfera" in copy modal |
| `backend/routers/brands_registry.py` | label "atmosphere" usata come dimensione di tassonomia |
| `backend/routers/inspirations_archive.py` | filtro `atmosphere` come parametro API |
| `frontend/pages/workspace/ReferencesPage.jsx` | "atmosfera/curatoriale" 9× in 1 pagina |

### 6.3 · 🟡 Medium — marketing / blog / admin (registro editoriale ammesso)

| File / area | Note |
|---|---|
| `/pages/site/MagazinePage.jsx`, `MagazineArticlePage.jsx` | Marketing public site: registro editoriale ammesso per articoli, MA naming prodotto deve rispettare canon |
| `/pages/site/ProjectDetailPage.jsx` | Public project showcase, atmosfera/curatorial ammessi se riferiti a stile (non a UI workflow) |
| `/pages/admin/PlatformCapabilitiesPage.jsx` | Admin only, basso impatto |
| `/backend/routers/magazine.py`, `cultural_editions.py` | Backend di moduli editoriali, registro ammesso |

---

## 7 · Roadmap di sostituzione (proposta P1-P3)

### ITER183 · App-wide Naming Lock (P1 · 1 sprint)
**Scope:**
- Bonificare EN-US master (67 stringhe critical/high)
- Bonificare IT-IT (~50 stringhe critical/high)
- Cascata su altri locale (de-DE, es-ES, fr-FR, en-GB, ar)
- Rinominare component `RelationshipMemoryChapter` → `ActivityLog` (alias + back-compat sui data-testid)
- Rinominare label visibili `StudioPulsePage` e `JourneyPulsePage` (header + breadcrumb + i18n)
- Rimuovere "Curatorial" da Inspirations UI (mantenere come internal taxonomy key se necessario)

**Impatto stimato:**
- Dashboard: ✅ già bonificato (ITER181.A→C)
- CRM: ~12 file frontend + 3 backend routers (label payload)
- Design Journey: 5 file frontend + 2 backend routers
- Libraries (Inspirations, Moodboard, Materials): ~25 file (più grosso impatto)
- Editorial: ~8 file
- Onboarding: ✅ già bonificato (Activation Foundation 5-step)
- Traduzioni: 7 locale × ~67 stringhe = ~470 cambi i18n (cascata da EN-US master)

### ITER184 · Marketing & Public Site Audit (P2 · 1 sprint)
- Decisione caso-per-caso sul marketing site (`/pages/site/*`, `/pages/magazine/*`): registro editoriale ammesso ma naming prodotto deve rispettare canon Livello 1.
- Audit Cultural Editions™: distinguere "Cultural Editions" brand name (ammesso) da "curatorial" generico (vietato).

### ITER185 · Backend API Path Cleanup (P3 · 1 sprint)
- Rinominare `/api/studio-pulse/*` → `/api/blueprint-dashboard/*` con dual-routing per backward compat.
- Rinominare `/api/journey-pulse/*` → `/api/design-journey/*`.
- Audit `client_relations.py` payload field labels.

### ITER186 · LATAM/BR locale rollout (P3 · 1 sprint)
- Creare `es-MX.json` e `pt-BR.json` partendo da EN-US bonificato.
- Validare terminologia CRM con copywriter native.

---

## 8 · Impatto stimato per area (summary)

| Area | Stato attuale | Effort cleanup | Priorità |
|---|---|---|---|
| **Dashboard** | ✅ già bonificato | — | Done in ITER181 |
| **CRM (Leads/Prospects/Accounts)** | 🟢 dashboard surface OK; pagine secondarie ~12 file | ~1 giorno | P1 |
| **Design Journey** | 🟡 alcuni naming legacy (JourneyPulsePage, MilestoneDialogue) | ~1 giorno | P1 |
| **Libraries** (Inspirations, Moodboard, Materials) | 🔴 pervasivo "atmosfera/curatorial" | ~3-4 giorni | P1 |
| **Editorial** (Calendar, Cultural Editions) | 🟡 "curatorial" generico | ~1 giorno | P2 |
| **Onboarding** (Activation Foundation) | ✅ già bonificato | — | Done in ITER180 |
| **Traduzioni** | 🔴 EN-US master da bonificare; cascata su 6 locale | ~2 giorni | P1 (blocking) |
| **Backend API paths** | 🟡 `/studio-pulse/*`, `/journey-pulse/*` | ~1 giorno | P3 |
| **Marketing site** | 🟡 registro editoriale ammesso, naming prodotto da rispettare | ~1 giorno | P2 |
| **AI Agents prompts** | 🔵 da aggiungere clausola "MOOD_LANGUAGE_CANON" | ~2h | P1 (ongoing) |

**Totale effort cleanup stimato:** **~10-12 giorni-developer** distribuiti su 3 sprint (ITER183, 184, 185).

---

## 9 · Termini approvati · lista canonica (estratto da Canon §4)

**CRM:** Lead · Prospect · Cliente · Contatto · Azienda · Architetto · Studio Partner  
**Progetto:** Design Journey · Journey · Progetto · Milestone · Deliverable · Discovery · Proposal  
**Workspace:** Workspace · Studio · Setup · Identità operativa · Mercato operativo  
**Library:** Media Library · Material View · Materiali · Moodboard · Brand Atlas · Inspirations  
**Editorial:** Editorial Calendar · Calendario Editoriale · Cultural Editions · Design Stories  
**Operations:** Attività · Workflow · Discovery Interview · Qualifica · Promozione · Conversione · Activation Foundation · Workspace Activated™  
**Team:** Team · Membro · Designer · Project Manager · Sales · Advisor  
**Dashboard KPI:** Lead · Prospect · Clienti · Design Journey Attive

---

## 10 · Termini vietati · lista nera ufficiale

🔴 **Critical** (rimozione immediata):
- atmosfera / atmosphere / atmosfere
- segnale / signal / segnali
- nuova relazione / new relationship
- Studio Pulse · Journey Pulse · Signal Listening
- relazione / relazioni (come CRM entity)

🟠 **High** (rimozione in ITER183-184):
- curatoriale / curatorial
- temperamento
- ecosistema
- cultivation
- viaggio / capitolo (al di fuori di "Design Journey™")
- Memory (come entità CRM)
- Active Studio
- Listening Queue
- Studio Narrative / Narrative Layer
- Warm Editorial · Nordic Silence · Mediterranean Light · Architectural Dawn · Midnight Mood
- Connessione / Presenza / Memoria viva / Interazione organica (CRM)

🟡 **Medium** (review case-by-case, ammessi solo in marketing/editorial):
- ritmo
- Editorial Mood
- Creative Flow

---

## 11 · Output deliverables

1. ✅ **MOOD_LANGUAGE_CANON.md** — `/app/memory/MOOD_LANGUAGE_CANON.md` (governance ufficiale)
2. ✅ **MOOD_LANGUAGE_AUDIT.md** — questo documento (audit repository)
3. ✅ Lista termini approvati — Canon §4 + Audit §9
4. ✅ Lista termini vietati — Canon §5 + Audit §10
5. ✅ Roadmap di sostituzione — Audit §7
6. ✅ Impatto stimato per area — Audit §8

---

## 12 · Vincolo rispettato

**AUDIT + GOVERNANCE ONLY.**  
Nessuna modifica a codice, database, API in ITER182. I 2 file di deliverable in `/app/memory/` sono l'unico output prodotto.  
Le sostituzioni reali avverranno in **ITER183 · App-wide Naming Lock** (P1, sprint successivo).

---

## 13 · Quality test applicato

> *"Un manager americano, un architetto, un interior designer o il titolare di uno showroom capirebbe immediatamente questo termine?"*

Esempi pre/post canon:

| Termine (pre) | Test 2-sec | Termine (post) | Test 2-sec |
|---|---|---|---|
| "Atmosfere prevalenti" | ❌ confuso | "Stili principali" | ✅ chiaro |
| "Apri Nuova Relazione" | ❌ ambiguo | "+ Nuovo Lead" | ✅ inequivocabile |
| "Studio Pulse" | ❌ misterioso | "Blueprint Dashboard" | ✅ operativo |
| "Curatorial Atlas" | ❌ astratto | "Brand Atlas™" | ✅ chiaro (nome prodotto) |
| "Nessun segnale, per ora" | ❌ poetico | "Nessun Lead registrato." | ✅ informativo |
| "Memory Chapter" | ❌ narrativo | "Activity Log" | ✅ operativo |

---

**Audit completo. MOOD ha ora un canone linguistico ufficiale e una roadmap di sostituzione per allinearsi al posizionamento di piattaforma internazionale per studi di progettazione.**
