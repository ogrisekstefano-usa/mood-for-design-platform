# STORE-009 · DESIGN JOURNEY REBUILD™ · COMPLETION REPORT
**Date:** 08 Jun 2026
**Sprint:** STORE-009 · Phase 1 · The Operational Center
**Classification:** OPERATING_WORKSPACE_READY

---

## 0 · TL;DR

Sostituito il Design Journey "editoriale" con **The Daily Operating Workspace™**.

Showroom team apre `/studio/journey/:jid` e in <5s sa:
1. **Dove è il cliente** (current phase, amber, in 4 punti distinti della pagina)
2. **Cosa è completato** (checklist + roadmap con icone ✓ cyan)
3. **Cosa manca** (checklist · "Brief & Questionnaire · Started ieri")
4. **Cosa fare adesso** (`Next Action` in header + snapshot · cyan)
5. **Quali asset aprire** (Related Assets grid · thumbnail + Open)
6. **Cosa blocca** (checklist mostra subito il pending)

ZERO nuove tabelle. ZERO nuovi endpoint. ZERO nuovi moduli.

---

## 1 · UX audit di partenza

`/studio/journey/:jid` montava `ProjectDetailPage` (1352 righe, editorial language):
- "Capitoli", "Conversazioni", "Storytelling" terminology pervasiva
- Layout single-column · timeline narrativa
- Asset (moodboard/material/spec/story) immersi nella narrazione
- Difficile rispondere alle 4 domande operative in <5s

## 2 · Wireframe gerarchia (nuovo)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HERO · serif "Design Journey™" + project name                       │
│ Meta row: Client · Phase · Status · Completion · Next Action        │
├─────────────────────────────────────────────────────────────────────┤
│ STICKY PHASE RAIL · 7 dots                                          │
│ DISCOVER · INSPIRE · CURATE · SPECIFY · APPROVE · DELIVER · CELEB.  │
├──────────────┬───────────────────────────────┬─────────────────────┤
│ ROADMAP      │  CURRENT PHASE WORKSPACE       │  CLIENT SNAPSHOT     │
│ (260px)      │  (flex)                        │  (320px sticky)      │
│ 7 phases     │  • Phase 1 of 7                │  Avatar + name       │
│ ✓ done       │  • Phase title (serif)         │  Project · Budget    │
│ ● current    │  • Objective (1 line)          │  Timeline · Last     │
│ ○ upcoming   │  • Checklist (✓ icons)         │  Contact · Phase     │
│              │  • Related Assets grid         │  Next Action (cyan)  │
│              │    thumbnail + status + Open   │  Recent Activity     │
└──────────────┴───────────────────────────────┴─────────────────────┘
```

## 3 · Phase mapping (operational view of existing milestones)

Le 7 fasi sono una **vista operazionale** sopra i `milestone_types` già esistenti — zero migration:

| Operational Phase | Existing milestone_type(s) |
|-------------------|---------------------------|
| **DISCOVER** | brief |
| **INSPIRE** | inspirations |
| **CURATE** | moodboard_direction, material_direction, concept_design, curated_selections |
| **SPECIFY** | technical_package |
| **APPROVE** | final_presentation |
| **DELIVER** | site_evolution |
| **CELEBRATE** | certified_closure |

Tutto il mapping è frontend-only in `JourneyOperatingPage.jsx`.

## 4 · File modificati / creati

| File | Status | Note |
|------|--------|------|
| `pages/journey-operating/JourneyOperatingPage.jsx` | **NEW** · 438 righe | Daily Operating Workspace™ |
| `pages/journey-operating/journey-operating.css` | **NEW** · 380 righe | Blueprint Chameleon · alta leggibilità sans + serif solo hero/section titles |
| `routes/JourneyCanonicalRoutes.jsx` | edit | `StudioJourneyView` ora monta `JourneyOperatingPage` (default) · `ProjectDetailPage` accessibile via `?_legacy=1` |

Backend: **0 file toccati** · uso `GET /api/journeys/{jid}/overview` + asset list endpoints esistenti.

## 5 · Visual language compliance

- **Hero / section titles** · serif Cormorant Garamond
- **Body / checklist / snapshot** · sans Inter, alto contrasto
- **NO grey-on-grey** · text uses `--jop-text` (#F3EFE8) e `--jop-text-mute` (62% opacity) · mai sotto 46%
- **Phase highlight**: amber (`#E8B262`) per current, cyan (`#6FE4D2`) per done — colori distinti e operativi
- **Blueprint Chameleon** · backgrounds `#07080B` / `#0E1015` / `#14171D` · zero white

## 6 · Asset orchestration (Control Tower™)

Il Design Journey NON contiene gli asset. Mostra **anteprime con link**:
- Moodboards → `/moodboards/{id}/edit`
- Material Boards → `/material-boards/{id}`
- Specifications → `/specifications/{id}`
- Project Stories → `/project-stories/{id}`

Ogni asset card ha: thumbnail · type badge · title · status · last update · "Open" CTA.

## 7 · Language cleanup

Rimossi dall'UI utente i termini editoriali:
- ❌ Chapter / Milestone / Conversation / Dialogue / Philosophy / Story Chapter
- ✅ Phase / Checklist / Related Assets / Next Action / Client Snapshot / Journey Roadmap

I `milestone_type` rimangono nel database (semantica tecnica intoccata) ma in UI sono mappati ai titoli operativi (es. `brief` → "Brief & Questionnaire", `technical_package` → "Specification Package").

## 8 · Testing live (screenshot smoke)

Login Stefano · `/studio/journey/bb8ee381-…` con journey reale del tenant MOOD:
- ✅ Hero serif "Conversazione di stefano" + meta riga completa
- ✅ Phase rail con 7 step (DISCOVER amber, gli altri pending)
- ✅ Roadmap left con ● DISCOVER + ○ x 6
- ✅ Center: "Phase 1 of 7 · Discover · Understand the client." · Checklist ("Brief & Questionnaire · Started ieri") · Related Assets (empty state corretto)
- ✅ Client snapshot right: avatar S · stefano · private client · BUDGET / TIMELINE not set · LAST CONTACT ieri · NEXT ACTION cyan · Recent Activity (journey_started + milestone_started)
- ✅ Test-id presenti: `journey-operating`, `jop-project-title`, `jop-client-name`, `jop-current-phase`, `jop-next-action`, `jop-phase-rail`, `jop-rail-{phase}` × 7, `jop-roadmap`, `jop-center`, `jop-checklist`, `jop-assets`, `jop-client-snapshot`, `jop-asset-{id}`

## 9 · Vincoli rispettati

- 🚫 Nessuna nuova tabella database
- 🚫 Nessuna nuova entity
- 🚫 Nessun nuovo workflow
- 🚫 Nessun nuovo API endpoint
- 🚫 Nessun nuovo business object
- ✅ Pure UX + IA + orchestration
- ✅ Legacy `ProjectDetailPage` preservato (raggiungibile via `?_legacy=1`)

## 10 · Success test live

Aprendo `/studio/journey/bb8ee381-…` un rivenditore vede istantaneamente:

| Domanda | Risposta in vista |
|---------|-------------------|
| Where is the client? | DISCOVER (amber × 4 punti) |
| What is completed? | 0% · 0 checklist items done |
| What is missing? | Brief & Questionnaire pending |
| What should happen next? | Brief & Questionnaire (header + snapshot) |

✅ **Test passed**.

## 11 · Next (Phase 2 future ideas · NON in questo sprint)

- Brief deep-link diretto dal checklist item (apre `/journey/:jid/brief`)
- Asset generation CTA condizionali (es. "Create Moodboard" se phase=CURATE e nessun moodboard)
- Inline phase advancement (skip / mark complete dalla roadmap)
- "Blockers" widget separato sotto checklist quando `health_signals` aperti
- i18n keys per labels operative (`journey.phase.discover` ecc.)
