-- ============================================================
-- 036_faq_collections.sql — CMS-driven FAQ system
--
-- Two new collections, both tenant-scoped, fully multilingual via
-- jsonb `locale_content` (same shape as cms_sections.locale_content).
--
-- No content is ever stored hardcoded — the React frontend only
-- renders what these tables return. Categories and items are
-- managed from the Blueprint admin (Pages → FAQ section).
--
-- The hero/finalCta/SEO of the public /faq page lives in
-- cms_sections with section_type = 'faq_page' (NEW section type).
-- ============================================================

CREATE TABLE IF NOT EXISTS faq_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    slug            text NOT NULL,
    sort_order      integer NOT NULL DEFAULT 0,
    visible         boolean NOT NULL DEFAULT true,
    locale_content  jsonb   NOT NULL DEFAULT '{}'::jsonb,  -- { "it-IT": {title, description}, "en-US": {...} }
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS faq_categories_tenant_visible_sort_idx
    ON faq_categories (tenant_id, visible, sort_order);

CREATE TABLE IF NOT EXISTS faq_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id     uuid NOT NULL REFERENCES faq_categories(id) ON DELETE CASCADE,
    sort_order      integer NOT NULL DEFAULT 0,
    visible         boolean NOT NULL DEFAULT true,
    locale_content  jsonb   NOT NULL DEFAULT '{}'::jsonb,  -- { "it-IT": {question, answer}, ... }
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS faq_items_tenant_cat_idx
    ON faq_items (tenant_id, category_id, visible, sort_order);

-- Touch trigger
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_faq_categories_touch ON faq_categories;
CREATE TRIGGER trg_faq_categories_touch
  BEFORE UPDATE ON faq_categories
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_faq_items_touch ON faq_items;
CREATE TRIGGER trg_faq_items_touch
  BEFORE UPDATE ON faq_items
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
