# MOOD for DESIGN™ — Roadmap

> Updated 2026-06-03 (post ITER204).
> See `CHANGELOG.md` for historical detail. `PRD.md` for product requirements.

---

## ✅ Just shipped (ITER204 · 2026-06-03)
- UI Refactor: clean Topbar/Sidebar, global "+ Crea" button
- Global Create Modal (config-driven, 6 cards, theme tokens only, i18n)
- Create Moodboard™ Modal (From Studio Library™ · Blank Canvas paths)
- Studio Library Bridge™: unified curatorial library (brand/collection/product/material/designer)
- i18n keys for `studio_library.*` + `create.*` (it-IT + en-US)

---

## 🔴 P0 — Next sprint (active backlog)

### A. Studio Library entry points (complete the bridge)
- [ ] Drop `SaveToLibraryButton` into `BrandEmbassyPage` for each Collection / Material / Designer / Product card
- [ ] "From Studio Library" Moodboard picker UI — currently the path navigates to `/projects/:id/moodboards/new?source=library` but the picker step that lists library items + drag-to-canvas needs to be implemented inside the Moodboard Editor
- [ ] Bulk save: select multiple items in Brand Atlas filters → "Save N items to Library"

### B. Theme Engine / i18n full audit (deferred from ITER204)
- [ ] Audit modali / dropdown / card che usano `#fff` o `white` hardcoded → sostituire con `var(--bp-surface-elevated)` etc.
- [ ] Audit stringhe italiane hardcoded → wrap in `t(...)`. Focus su `MoodboardsPage`, `RelationshipsPage`, `LeadDetailPage`, `BrandEmbassyPage` non-hero sections.
- [ ] Pulire React warning "setState during render" su mount Dashboard

### C. Moodboard Editor — Library source mode
- [ ] Quando route ha `?source=library`, mostrare lateralmente lo Studio Library picker
- [ ] Drag-and-drop entity → canvas con block factory per ogni `entity_type`
- [ ] Auto-tag block con `metadata.source_library_id`

---

## 🟠 P1

- [ ] **Persistent Entity Resolution Jobs** — Background worker parity con orchestrator brand-catalog
- [ ] **Refactor App.js** — Route module si avvicina a 900 righe. Split per surface (admin, client, os)
- [ ] **Refactor ProjectDetailPage.jsx** — 2000+ righe, ridurre via sub-component
- [ ] **Phase 2 Mail** — Gmail/Outlook OAuth + invio
- [ ] **Tenant_id rename audit** — slug `studio` → invariato finché non si pianifica `FOUNDER TENANT RENAMING AUDIT™`

---

## 🟢 P2

- [ ] Academy Builder
- [ ] Magazine Builder
- [ ] Marketboard Generator
- [ ] Studio Library "source_type=academy/editorial/case_study/market_insight" usage scenarios
- [ ] Multi-user collaborative Studio Library (notes, votes, "starred by")
- [ ] Studio Library export → CSV / PDF "Atelier Reference Sheet"

---

## 🔵 Future / Vision

- AI-curated Library recommendations (basate su mood_dna del Journey + history Studio)
- Cross-tenant "Sister Studios Library" sharing
- Public preview link per item Studio Library (con permission gating)
