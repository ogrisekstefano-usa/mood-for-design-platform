# MOOD for DESIGN™ — Roadmap

> Updated 2026-06-03 (post ITER204-B).
> See `CHANGELOG.md` for historical detail. `PRD.md` for product requirements.

---

## ✅ Just shipped

### ITER204-B · Entity Navigation Layer™ (2026-06-03)
- 4 detail pages: Collection · Product · Material · Designer
- Brand Embassy cards 100% cliccabili
- Real counts (no più "20 prodotti" finto)
- Studio Library resolve idrata da brand_detected_entities

### ITER204 · Studio Library Bridge™ (2026-06-03)
- UI Refactor (Topbar/Sidebar + global "+ Crea")
- Global Create Modal + Create Moodboard Modal
- studio_library_items polimorfica + endpoints
- Studio Library editorial page

---

## 🔴 P0 — Next sprint

### A. Moodboard Bridge™ (chiude il ciclo Discover → Collect → Create)
- [ ] Picker laterale "From Studio Library™" nel Moodboard Editor (route `?source=library` esiste, manca pannello)
- [ ] Drag-and-drop entità → canvas con block factory per ogni entity_type
- [ ] Auto-tag block con `metadata.source_library_id`
- [ ] "Add to Moodboard" CTA dalle detail pages

### B. Add to Project™
- [ ] Da Collection/Product/Material/Designer detail → "Add to Active Design Journey"
- [ ] Mostrare badge "in N Journey attivi" sulle entity detail pages

### C. Theme Engine / i18n full audit
- [ ] Audit `auth.login.*` + `nav.crm_*` + `nav.editorial_copy_cms` keys mancanti
- [ ] Fix React warning `LocalizationOverlay` (setState in render)
- [ ] Audit modali / dropdown legacy con `#fff` hardcoded

---

## 🟠 P1
- [ ] **Persistent Entity Resolution Jobs** — Background worker parity
- [ ] **Refactor App.js** (~900 righe) → split per surface
- [ ] **Refactor ProjectDetailPage.jsx** (~2000 righe)
- [ ] **Phase 2 Mail** — Gmail/Outlook OAuth
- [ ] **Materials full-text index** (materials_text GIN) per scale > 10k products

---

## 🟢 P2
- [ ] Academy Builder
- [ ] Magazine Builder
- [ ] Marketboard Generator
- [ ] Studio Library source_type=academy/editorial/case_study/market_insight workflows
- [ ] Multi-user collaborative Studio Library (notes, votes, "starred by")
- [ ] Atelier Reference Sheet™ — export PDF della Studio Library del tenant

---

## 🔵 Future / Vision
- AI-curated Library recommendations (mood_dna + history)
- Cross-tenant "Sister Studios Library" sharing
- Public preview link per item Studio Library
