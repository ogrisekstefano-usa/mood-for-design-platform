# MEDIA SYSTEM UNIFICATO™ · AUDIT & SPRINT PLAN
**ITER148 · Phase 2 · 24 Mag 2026**

This document is the technical blueprint for the multi-sprint
convergence of every media flow in MOOD for DESIGN™ onto a single
source of truth: **Media Library™**.

---

## 1 · CURRENT SYSTEM AUDIT

### 1.1 Storage layer (no change needed)
- Master assets live in `public.media_library`.
- File bytes live in Supabase Storage under `tenant-assets/…`.
- Upload endpoint: `POST /api/media` (in `routers/media.py`).

This layer is correct and stays untouched. The "no image duplication"
rule already holds at storage level.

### 1.2 Duplicated / inconsistent media flows · DEPRECATION LIST

| Component                                         | Behaviour                                | Action                              |
|---------------------------------------------------|------------------------------------------|-------------------------------------|
| `pages/settings/AssetPickerModal.jsx`             | Settings-only picker · own grid + upload | **Replace** with UnifiedMediaPicker |
| `pages/workspace/MoodboardAssetPicker.jsx`        | Moodboard tile picker                    | **Replace** with UnifiedMediaPicker |
| `blueprint/composer/InlineImagePicker.jsx`        | Inline magazine picker                   | **Replace** with UnifiedMediaPicker |
| Multiple ad-hoc `<input type=file>` in onboarding | One-shot upload then orphan asset        | **Route through** `/api/media`      |
| `components/avatar/AvatarUploadModal.jsx`         | Hits `/api/profile/me/avatar` directly   | **Keep** (avatar = personal scope)  |

### 1.3 Existing endpoints (kept)
- `POST   /api/media`          · upload master asset
- `GET    /api/media`          · list archive (paginated)
- `GET    /api/media/{id}`     · master metadata
- `DELETE /api/media/{id}`     · soft delete

### 1.4 New endpoints (this sprint · ALL DELIVERED)
- `GET    /api/media-system/filter-presets`
- `GET    /api/media-system/assets/{id}/variants`
- `POST   /api/media-system/assets/{id}/variants`
- `PATCH  /api/media-system/variants/{id}`
- `DELETE /api/media-system/variants/{id}`
- `GET    /api/media-system/assets/{id}/usage`
- `POST   /api/media-system/assets/{id}/usage`
- `DELETE /api/media-system/usage/{id}`

---

## 2 · ARCHITECTURE (DELIVERED)

```
┌─────────────────────────────────────────────────────────────────┐
│  MASTER ASSET            (immutable bytes + metadata)           │
│  public.media_library                                           │
└────────┬───────────────────────────────────────┬────────────────┘
         │                                       │
         │ many                                  │ many
         ▼                                       ▼
┌─────────────────────────┐         ┌──────────────────────────────┐
│  VARIANT                │         │  USAGE  (Used-In™ map)       │
│  public.media_asset_    │ ← opt → │  public.media_asset_usage    │
│  variants               │         │  (entity_type, entity_id,    │
│  (crop · focal · zoom · │         │   usage_role, variant_id)    │
│   filter_preset)        │         └──────────────────────────────┘
└─────────────────────────┘
         │
         │ references
         ▼
┌─────────────────────────┐
│  FILTER PRESET REGISTRY │
│  public.media_filter_   │
│  presets (DB-driven · 8 │
│  global seeded · tenant │
│  overrides allowed)     │
└─────────────────────────┘
```

**8 global filter presets seeded:** `none`, `editorial_matte`,
`warm_ivory`, `cyan_atelier`, `black_white`, `sepia`, `desaturated`,
`cinematic_shadow`. Each ships a real CSS `filter` string + optional
overlay colour/alpha so the client can preview without server-side
rendering.

**Cross-tenant isolation** enforced at application layer (consistent
with `media_library`).

---

## 3 · COMPONENT FRONTLINE (DELIVERED IN THIS SPRINT)

### 3.1 `UnifiedMediaPickerModal` MVP
**Path:** `/app/frontend/src/components/media/UnifiedMediaPickerModal.jsx`

Reads the live `media_library` archive via `useMediaLibrary` hook,
renders each asset with:
- Master thumbnail (lazy-loaded · CSS filter live-preview)
- Variant count (placeholder · wired in next sprint)
- Per-tile Used-In™ panel (lazy-loaded on click)
- Atelier palette · `#050816` / `#0B1020` / `#00C9B3` / ivory only

No upload UI inside the picker (per "no duplication" rule) — the
upload happens at the Media Library page level, and this picker only
picks from what's already there.

### 3.2 `useMediaLibrary` hook
**Path:** `/app/frontend/src/hooks/useMediaLibrary.js`

The ONLY way to list media inside the app going forward. Any new
component that needs to show a list of assets must consume this hook.

---

## 4 · REMAINING SPRINTS

### Sprint 1 — Variants UI (P0 · ~3 days)
- Crop editor (non-destructive · react-image-crop or custom)
- Focal point picker (click-to-set on master)
- Filter preview live render
- "Create variant" workflow inside UnifiedMediaPickerModal

### Sprint 2 — Migrate duplicates (P0 · ~2-3 days)
- Replace each component in the deprecation list above with
  `<UnifiedMediaPickerModal>`
- Backfill `media_asset_usage` rows via one-off script for
  current homepage/moodboard/magazine attachments

### Sprint 3 — Filter Engine governance (P1 · ~2 days)
- Tenant-level filter overrides UI (Blueprint Command Center)
- Per-tenant additional filter presets
- "Apply filter to all variants of asset" bulk action

### Sprint 4 — Performance & Used-In intelligence (P1 · ~2 days)
- Signed URL batching for grids of 60+ assets
- Used-In™ aggregate dashboard page (`/admin/media-graph`)
- "Orphan asset" detector (assets with zero usage rows)

---

## 5 · HARD RULES (carried over into every sprint)

1. **No image duplication.** Master bytes stay in `media_library`.
   Every "variant" is metadata only.
2. **No bespoke pickers.** Every new feature requiring media uses
   `UnifiedMediaPickerModal`. Any PR introducing a new picker is
   rejected.
3. **DB-driven filter registry.** Hard-coded filter strings outside
   `media_filter_presets` are forbidden.
4. **Atelier palette only.** `#050816` · `#0B1020` · `#00C9B3` · ivory.
   No purple gradients · no glassmorphism cheap.
5. **Tenant scoping.** Every variant + usage row carries `tenant_id`
   and the application layer enforces isolation.

---

## 6 · OUT OF SCOPE (this sprint)

- Non-destructive crop editor UI (deferred to Sprint 1 above)
- Migration of the legacy AssetPickerModal callers (Sprint 2 above)
- Image rendering pipeline (server-side variants) — currently CSS-only
- Versioning / asset history (separate future epic)
