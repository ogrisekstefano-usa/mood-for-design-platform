-- ╔════════════════════════════════════════════════════════════════════╗
-- ║  ITER147 · International Profile Identity™                          ║
-- ║                                                                    ║
-- ║  Add `locked` boolean column to editorial_block_translations so a   ║
-- ║  per-locale value can be FROZEN by the studio operator. A locked   ║
-- ║  row is never overwritten by automatic regeneration, even when    ║
-- ║  `force=True` is passed at the resolver level. The flag is an     ║
-- ║  operational pin orthogonal to the existing `status` enum.        ║
-- ║                                                                    ║
-- ║  This converges the new "International Profile Identity™" with     ║
-- ║  the existing Editorial Runtime™ without introducing a new table. ║
-- ╚════════════════════════════════════════════════════════════════════╝

ALTER TABLE editorial_block_translations
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN editorial_block_translations.locked IS
  'When TRUE this localized value is pinned by the operator. ALE never '
  'regenerates a locked row. The UI surfaces this as "Approved / Locked" '
  '— never "AI generated" in the client-facing wording.';

CREATE INDEX IF NOT EXISTS editorial_block_translations_locked_idx
  ON editorial_block_translations (locked) WHERE locked = TRUE;
