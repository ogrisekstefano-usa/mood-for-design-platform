# STORE-008A · SCHEMA AUDIT (Final) · Editorial Autopilot MVP
**Date:** 08 Jun 2026
**Verdict:** **ZERO new tables required for MVP.** All 3 originally proposed tables (`tenant_editorial_settings`, `editorial_autopilot_runs`, `editorial_variant_media`) are **deferred to post-MVP scheduler sprint**. Existing schema is sufficient.

---

## Field-by-field reuse table

| MVP need | Reused from existing schema | Notes |
|----------|----------------------------|-------|
| Pipeline status | `editorial_variants.status` | Map: `draft`/`ready_for_editorial_review` → *In Proofreading*; `approved` → *Approved*; `published` → *Published*; `media_required` (new enum value, no schema change) → *Blocked* |
| Per-market frequency | `tenant_markets.custom_settings` JSONB | Add `weekly_frequency` key (no migration) |
| Tenant primary locale | `tenant_configuration.json_data` JSONB | Add `editorial.primary_locale`/`editorial.proofreading_locale` (already supports arbitrary JSON keys) |
| Autopilot mode | `tenant_configuration.json_data.editorial.autopilot_mode` | `autopilot` \| `review_only` \| `manual` (no migration) |
| Tone of voice / approval rules | `tenant_configuration.json_data.editorial.*` | Free JSON config |
| Target market & locale | `editorial_variants.market_id` + `target_locale` | Already present |
| Proofreading translation | `editorial_variants.internal_translation` JSONB | **EXACT MATCH for the brief** |
| Hotspot suggestions | `editorial_variants.hotspot_data` JSONB + `article_hotspots` table | 5 link types already supported |
| AI explanation / notes / motivation | `editorial_variants.ai_meta` JSONB | Add subkeys: `explanation`, `cultural_angle`, `keywords`, `audience` (already supports any JSON) |
| Hero & media references | `editorial_variants.hero_image_url` + `body_blocks` (refs to `media_library.id`) | Existing `media_asset_usage` audit trail |
| MEDIA REQUIRED enforcement | Set `status='media_required'` when no `media_library` asset matches role | Pure application logic, no schema |
| Pipeline counts | `SELECT count(*) FROM editorial_variants GROUP BY status, market_id, created_at` | Computed live, no audit table needed for MVP |
| Content opportunities | `SELECT FROM brand_detected_entities / moodboards / material_boards / project_stories WHERE not in editorial_variants` | Pure read query |

---

## Deferred tables (post-MVP scheduler sprint)

| Originally proposed | When it becomes necessary |
|---------------------|--------------------------|
| `tenant_editorial_settings` | When config grows beyond ~10 fields → split into dedicated table |
| `editorial_autopilot_runs` | When scheduler worker exists and needs run-level audit log |
| `editorial_variant_media` | When we enforce strict 1-to-many media binding at publish-time (instead of free-text references in body_blocks) |

For MVP these are **not** required. The system can demo "Blueprint AI is keeping you visible internationally" entirely on existing schema.

---

## MVP delta (frontend + 1 backend router)

- **Backend**: `routers/editorial_autopilot.py` (~250 lines) · 6 endpoints over existing tables
- **Frontend**: `EditorialAutopilotPage.jsx` (~300 lines) + `ProofreadingInboxPage.jsx` (~350 lines) + 2 CSS files
- **Route changes**: `/blueprint/editorial` mounts new dashboard (legacy `EditorialStudioPage` accessible via `/blueprint/editorial/legacy` for admin)
- **Migrations**: **0**

---

> **Approved by**: Main Agent self-audit, 08 Jun 2026.
> **Rule**: Reuse → extend JSON → only as last resort, new schema. We've stopped at step 1.
