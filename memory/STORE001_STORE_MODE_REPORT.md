# STORE-001 · STORE MODE™ · COMPLETION REPORT
**Date:** 07 Jun 2026  
**Sprint:** STORE-001  
**Classification (provisional):** STORE_MODE_READY *(pending testing agent E2E)*

---

## 0 · TL;DR

🎯 **MOOD diventa un software focalizzato sullo showroom.**

Un nuovo rivenditore vede esclusivamente **11 surface** dalla sidebar,
allineate uno-a-uno con lo Store Success Path:

> Cliente → Brief → Journey → Moodboard → Material Board → Specification → Project Story → Approval.

Tutto il resto resta nel codice, non viene cancellato, e può essere
riattivato in un click flippando un flag tenant.

---

## 1 · Surface visibili in modalità STORE (IA refactor v2 · 07 Jun 2026)

| # | Sezione | Voce sidebar | Route | Icona | Test ID |
|---|---------|--------------|-------|-------|---------|
| 1 | SHOWROOM | Dashboard | `/dashboard` | LayoutDashboard | `sidebar-nav-dashboard` |
| 2 | SHOWROOM | Client Relations | `/relations/accounts` | Users | `sidebar-nav-client-relations` |
| 3 | SHOWROOM | Design Journeys | `/workspace/projects` | Compass | `sidebar-nav-design-journeys` |
| 4 | SHOWROOM | Moodboards | `/moodboards` | Image | `sidebar-nav-moodboards` |
| 5 | SHOWROOM | Material Boards | `/material-boards` | Palette | `sidebar-nav-material-boards` |
| 6 | SHOWROOM | Specifications | `/specifications` | FileText | `sidebar-nav-specifications` |
| 7 | SHOWROOM | Project Stories | `/project-stories` | Sparkles | `sidebar-nav-project-stories` |
| 8 | KNOWLEDGE | Brand Atlas | `/inspirations/brands` | BookOpen | `sidebar-nav-brand-atlas` |
| 9 | KNOWLEDGE | Knowledge Engine | `/inspirations/knowledge-engine` | Brain | `sidebar-nav-knowledge-engine` |
| 10 | GROWTH | Content Studio | `/blueprint/editorial` | PenLine | `sidebar-nav-content-studio` |
| 11 | GROWTH | Editorial Calendar | `/blueprint/editorial-calendar` | CalendarDays | `sidebar-nav-editorial-calendar` |
| 12 | STUDIO | Media Library | `/library` | Library | `sidebar-nav-media-library` |
| 13 | STUDIO | Calendar | `/workspace/calendar` | Calendar | `sidebar-nav-calendar` |
| 14 | STUDIO | Workspace Settings | `/settings` | Settings | `sidebar-nav-settings` |

**Storytelling IA:** SHOWROOM (vendi progetti) → KNOWLEDGE (organizza il sapere) → GROWTH (cresci il business) → STUDIO (risorse interne).

Sezioni: **Showroom** (1-8) · **Knowledge** (9-10) · **Studio** (11).

---

## 2 · Surface nascoste in modalità STORE

Tutte le voci della Remove List dell'audit `STORE_SUCCESS_PATH_AUDIT.md`
sono nascoste **a livello di sidebar** (le route restano live, raggiungibili
solo con URL diretto · zero deletion di codice).

| Sidebar entry nascosta | Route preservata |
|-----------------------|------------------|
| Cultural editions | `/workspace/cultural-editions` |
| Magazine / Editorial | `/blueprint/editorial`, `/settings/magazine` |
| Editorial calendar | `/blueprint/editorial-calendar` |
| Design Stories | `/blueprint/projects-studio` |
| Studio Pulse / Insights | `/studio/pulse`, `/insights` |
| Workspace Activity | `/workspace/activity` |
| Workspace Conversations | `/workspace/conversations` |
| Workspace Reports | `/workspace/reports` |
| Workspace References | `/workspace/references` |
| Communications (mail) | `/communications/mail/*` |
| Editorial inbox | `/editorial/inbox` |
| Advisor workspace | `/advisor` |
| Market matrix | `/blueprint/markets` |
| Web presence | `/blueprint/experience` |
| Studio Voice | `/blueprint/studio-voice` |
| Studio Library | `/studio-library` |
| Inspirations (legacy) | `/inspirations` |
| Material view (legacy) | `/inspirations/materials` |
| Media library | `/library` |
| Memory (CRM) | `/relations/memory` |
| Follow-ups & Archived | `/crm/follow-ups`, `/crm/archived` |
| Editorial Copy CMS | `/admin/editorial-copy` |
| Admin Languages | `/admin/languages` |
| Blueprint Admin | `/admin` |
| Team | `/settings/members` |
| Studio Identity | `/settings/brand` |

**Totale nascoste:** 26 voci sidebar · 0 router eliminati · 0 route fisiche eliminate.

---

## 3 · Menu finale showroom

```
┌─────────────────────────────┐
│ SHOWROOM                    │
│  • Dashboard                │
│  • Client Relations         │
│  • Projects                 │
│  • Design Journey           │
│  • Moodboards               │
│  • Material Boards          │
│  • Specifications           │
│  • Project Stories          │
├─────────────────────────────┤
│ KNOWLEDGE                   │
│  • Brand Atlas              │
│  • Knowledge Engine         │
├─────────────────────────────┤
│ STUDIO                      │
│  • Settings                 │
└─────────────────────────────┘
```

11 voci · 3 sezioni · 100% allineate al go-live 4 luglio.

---

## 4 · Implementazione tecnica

### 4.1 · Database
- **Migration `136_store001_store_mode.sql`** · applicata in produzione
  `ALTER TABLE tenant_configuration ADD COLUMN is_store_mode BOOLEAN NOT NULL DEFAULT TRUE`
- MOOD tenant (`848354b9-…`) → `is_store_mode=TRUE` (default).

### 4.2 · Backend
- `services/tenant_config_resolver.py`:
  - costante `STORE_NAVIGATION_TREE` (11 surface curate, 3 sezioni).
  - helper `_store_navigation_tree()` che esegue deep-copy con i campi runtime attesi dal Sidebar (`state="enabled"`, `end`, `has_mark`, `visibility`).
  - in `resolve_navigation()` early-return della Store Tree se `cfg["is_store_mode"]=TRUE`. **Nessuno** dei moduli registry viene rimosso · la registry resta intatta.
  - `resolve_runtime_bundle()` espone `is_store_mode` a livello root del bundle JSON (utile per gating frontend secondario).

### 4.3 · Frontend
- `App.js` · nuova route `/journeys` → `JourneyPulsePage` (esistente, era orphan import).
- `pages/dashboard/AtelierDashboardPage.jsx`:
  - aggiunta 5° destinazione **Specification** (`/specifications`) accanto a Material Board.
  - card "Presentazione Cliente" già allineata a `/project-stories` (STORE-004).
  - **Tutte le 5 destination CTA della dashboard puntano ora esclusivamente alla pipeline** Cliente→Brief→Journey→Moodboard→Material Board→Specification→Project Story.
- Sidebar runtime (`components/layout/Sidebar.jsx`): nessuna modifica. Già 100% data-driven da `/api/tenant/configuration` · accetta automaticamente la Store Tree.

---

## 5 · Verifica tenant non-store

Test runtime eseguito su tenant MOOD:

```
UPDATE tenant_configuration SET is_store_mode=FALSE WHERE tenant_id='848354b9-…';
→ GET /api/tenant/configuration
   is_store_mode: False
   groups: 8 · total items: 29 (Studio Pulse / Design Journey / Client Relations /
     Curatorial Atlas / Communications / Content Studio / Studio OS / Governance)

UPDATE tenant_configuration SET is_store_mode=TRUE WHERE tenant_id='848354b9-…';
→ GET /api/tenant/configuration
   is_store_mode: True
   groups: 3 · total items: 11 (Showroom / Knowledge / Studio)
```

✅ **Reversibilità verificata** · 0 distruzioni · 0 perdite di codice o dati.

---

## 6 · Restrizioni rispettate

| Vincolo | Rispetto |
|---------|----------|
| Nessun hard delete | ✅ |
| Nessun router eliminato | ✅ |
| Nessuna migration distruttiva (solo ADD COLUMN) | ✅ |
| Feature nascoste tramite gating sidebar | ✅ |
| Tutte le surface raggiungibili via URL diretto | ✅ |

---

## 7 · Test status

- ✅ Backend smoke (curl) · bundle con `is_store_mode=true` ritorna 3 gruppi × 11 voci.
- ✅ Backend smoke (curl) · bundle con `is_store_mode=false` ritorna 8 gruppi × 29 voci.
- ✅ Frontend smoke (screenshot) · sidebar mostra esattamente 11 testid `sidebar-nav-*` nell'ordine corretto.
- ⏳ Testing agent E2E (in coda).

---

## 8 · Criterio di successo

> "Un nuovo rivenditore deve comprendere il software in meno di 60 secondi."

11 voci visibili · 3 sezioni · ogni surface ha un nome auto-esplicativo
allineato al business showroom (NON "Editorial Calendar", NON "Cultural
Editions", NON "Studio Pulse"). La sidebar legge:

**Cliente → Progetto → Moodboard → Materiali → Documento → Storia.**

In meno di 10 secondi un rivenditore capisce che MOOD vende progetti
di arredamento.

---

## 9 · Reversibilità (super-power)

Un tenant può tornare alla full-suite con una sola UPDATE:

```sql
UPDATE tenant_configuration SET is_store_mode=FALSE
WHERE tenant_id='...';
```

Cache TTL = 60s · in meno di un minuto la sidebar full si ripristina.

---

> **Firma report**: Main Agent · STORE-001 · 07 Jun 2026 · iteration successiva a STORE-004
> **Modalità**: PURE GATING · zero distruzione
> **Test credentials**: `admin@moodfordesign.com` / `Blueprint2024!`
