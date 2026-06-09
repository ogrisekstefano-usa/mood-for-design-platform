# MOODBOARD V2™ · Design Intelligence Workspace™ Vision

> Reference document · saved 08 Feb 2026.
> Sprint anchor: STORE-012B / Working Moodboard V2.1 — release 1 of 4.

## Strategic positioning
MOOD is no longer a moodboard tool. It becomes the **operational center of the Design Journey** — a Phygital Design Intelligence Workspace where digital inspiration, physical materials, client collaboration, design decisions and product specification live in a single environment.

Direct competitors NOT to copy: Programa · Morpholio · Milanote · Canva · Material Bank.

## 12 Foundational Pillars
1. **Project Brain™** (formerly AI Context Bar) — operational brain. Always-visible context. Never a chatbot. Includes "Recommended Next Action™".
2. **Live Design Intelligence™** — analyses choices in real time and suggests related materials/products/brands/alternatives.
3. **Dynamic Material Objects™** — materials carry id/brand/finish/variants/certifications/availability/usage history.
4. **Smart Hotspots™** — universal operational object: Material · Product · Media · Note · Decision · Client Question · Internal Link · External Link · NFC Asset · Sample Request · Specification Item.
5. **Client Reaction Layer™** — feedback per element (not per board): Like · Explore Further · Not Interested · Comment.
6. **Variant Engine™** — Variant A/B/C within a single moodboard, version history intact.
7. **Showroom Presentation Mode™** — narrative storytelling: Vision → Atmosphere → Materials → Products → Highlights → Next Steps.
8. **Material Board Sync™** — approved materials flow into Material Board / Specification / Project Story.
9. **NFC Layer™** — scan → material entity → moodboard → material board → spec, end-to-end.
10. **Phygital Sample Library™** — wishlist · sample requests · showroom collections.
11. **Spatial Moodboard™** — images + materials + products + videos + PDFs + 3D + room scenes.
12. **Marketplace Intelligence™** — availability · inventory · sample availability · distributor.

## Roadmap
- **V2.1** (this sprint · STORE-012B) — Project Brain · Smart Hotspots (4 of 11) · Showroom Presentation Mode · Client Proposal View · Approval Layer per element · Working Moodboard generation from Concept Direction.
- **V2.2** — Variant Engine · Live Design Intelligence · Material Board Sync · Smart Hotspots completion.
- **V2.3** — NFC Layer · Sample Library · Wishlist Engine.
- **V2.4** — Spatial Moodboards · AI Design Copilot · Marketplace Intelligence.

## Architecture invariants
- **Working Moodboard = NEW derived row** from Concept Board (preserves traceability forever).
- Presentation = rendering state on the same route (`?mode=presentation`), single source of truth.
- Client view = dedicated read-only route `/client/journey/:jid/moodboards/:mbId`.
- Knowledge-native everywhere: every element exposes `entity_id` + `material_id` + `brand_id` from day one. No future migrations.
- Approval status lives at **element level**, never board level: `suggested / discussed / approved / rejected`.
- Zero new tables — reuse moodboards / moodboard_pages / moodboard_elements / brand_detected_entities / products / media_library.

## Success metric
A showroom designer completes Discovery → Concepts → Feedback → **Working Moodboard** → Presentation → Material selection without rebuilding any information.

## Final principle
*The Moodboard is no longer a board. It is the operational heart of the project. Discovery creates intelligence. Concepts create direction. Moodboard creates decisions. Specifications create execution. MOOD connects everything.*
