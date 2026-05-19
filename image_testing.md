# Image Integration Testing Playbook · MOOD for DESIGN™ · Cultural Intelligence Engine™

## Image Handling Rules
- Always use **base64-encoded images** for all vision API tests (passed to LlmChat via `ImageContent(image_base64=...)`)
- Accepted formats: **JPEG, PNG, WEBP** only
- Do not use SVG, BMP, HEIC, or animated images
- Test images MUST contain real visual features (interior design photos, architectural shots)
- For unit tests:
  - Use a small (~512px wide) interior design JPEG that includes recognisable features (walls, openings, materials, indoor/outdoor cues)
  - DO NOT use solid-color or blank images — the vision model returns empty signals
- Re-detect MIME type after any transformation
- If the image is animated, extract first frame only

## How MOOD uses Vision
- `cultural_engine/vision_provider_adapter.py` downloads the image URL → resizes to ≤1280px → encodes base64 → sends to OpenAI gpt-5.1 via `LlmChat`
- Output: structured spatial signals JSON (indoor_outdoor_continuity, hospitality_orientation, etc.)
- Layer 1 NEVER returns market names — only signals
- Results cached in `media_library.cultural_reading` JSONB

## Testing endpoints
- `POST /api/inspirations/archive/{id}/cultural-reading` triggers a synchronous analysis (for testing)
- `GET /api/inspirations/archive/{id}/cultural-reading` returns the cached cultural reading
- All other endpoints in `/api/inspirations/archive/*` should pre-trigger automatic analysis on import via BackgroundTasks

## Environment variables required
- `EMERGENT_LLM_KEY` (already in /app/backend/.env)
- Provider configurable via `CULTURAL_VISION_PROVIDER` env (defaults to `openai`)
- Model configurable via `CULTURAL_VISION_MODEL` env (defaults to `gpt-5.1`)
