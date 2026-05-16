-- ───────────────────────────────────────────────────────────────────────
-- Phase Y.1 EXT — Magazine taxonomy + discovery layer
-- Extends magazine_articles with editorial taxonomy that powers:
--   · multi-vertical discovery filtering
--   · related articles
--   · future AI recommendations & lead scoring
-- All new columns are NULLABLE / soft so legacy rows stay valid.
-- ───────────────────────────────────────────────────────────────────────

ALTER TABLE magazine_articles
  ADD COLUMN IF NOT EXISTS subcategory          TEXT,
  ADD COLUMN IF NOT EXISTS editorial_tone       TEXT,
  ADD COLUMN IF NOT EXISTS project_vertical     TEXT,
  ADD COLUMN IF NOT EXISTS locale_market        TEXT,
  ADD COLUMN IF NOT EXISTS featured_materials   TEXT[]
    NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS atmosphere_keywords  TEXT[]
    NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_magazine_articles_vertical
  ON magazine_articles(project_vertical, status);
CREATE INDEX IF NOT EXISTS idx_magazine_articles_category_slug
  ON magazine_articles(category_slug, status);
CREATE INDEX IF NOT EXISTS idx_magazine_articles_tags_gin
  ON magazine_articles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_magazine_articles_materials_gin
  ON magazine_articles USING GIN (featured_materials);
CREATE INDEX IF NOT EXISTS idx_magazine_articles_atmospheres_gin
  ON magazine_articles USING GIN (atmosphere_keywords);
