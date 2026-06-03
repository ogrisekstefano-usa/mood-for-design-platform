-- ITER202 · BRAND EXPERIENCE LAYER™ — schema additions
-- =============================================================
-- 1. Extend `brands` with Digital Brand Embassy fields.
-- 2. Add `studio_brand_links` for Add to Studio Library™.
-- =============================================================

ALTER TABLE brands
    ADD COLUMN IF NOT EXISTS hero_image_url     TEXT,
    ADD COLUMN IF NOT EXISTS hero_title         TEXT,
    ADD COLUMN IF NOT EXISTS hero_subtitle      TEXT,
    ADD COLUMN IF NOT EXISTS hero_description   TEXT,
    ADD COLUMN IF NOT EXISTS story_title        TEXT,
    ADD COLUMN IF NOT EXISTS story_body         TEXT,
    ADD COLUMN IF NOT EXISTS mood_dna           JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS atlas_certified_at TIMESTAMPTZ;

COMMENT ON COLUMN brands.hero_image_url   IS 'ITER202 · Brand Embassy hero (auto-derived from catalog, override via admin)';
COMMENT ON COLUMN brands.hero_title       IS 'ITER202 · big editorial title (defaults to brand.name)';
COMMENT ON COLUMN brands.hero_subtitle    IS 'ITER202 · positioning line (e.g. "Italian Bathroom Architecture™")';
COMMENT ON COLUMN brands.hero_description IS 'ITER202 · 1–2 sentence editorial lead';
COMMENT ON COLUMN brands.story_title      IS 'ITER202 · narrative section title';
COMMENT ON COLUMN brands.story_body       IS 'ITER202 · narrative section body';
COMMENT ON COLUMN brands.mood_dna         IS 'ITER202 · LLM-generated 3–5 style keywords (premium tags)';
COMMENT ON COLUMN brands.atlas_certified_at IS 'ITER202 · timestamp when Brand Atlas Certification gate was first passed';

-- Studio Library link (minimal MVP — granular asset linking is backlog)
CREATE TABLE IF NOT EXISTS studio_brand_links (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    brand_id     UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    linked_by    UUID,
    linked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    note         TEXT,
    UNIQUE (tenant_id, brand_id)
);
CREATE INDEX IF NOT EXISTS idx_studio_brand_links_tenant ON studio_brand_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_studio_brand_links_brand  ON studio_brand_links(brand_id);
