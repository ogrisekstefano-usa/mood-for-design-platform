-- ────────────────────────────────────────────────────────────────────
-- 108_tenant_markets_language_sync.sql · ITER168 Phase 2.5
--
-- Allinea i `tenant_markets` del tenant demo (`studio`) alle lingue
-- pubbliche attive nel Language Registry frontend (`languages.js`).
--
-- Lingue attive enabled+public_enabled (registry frontend / /admin/languages):
--   it, en-US, en-GB, fr, de, es, ar
--
-- Mercati corrispondenti (markets table):
--   it     → italy            (already active, default)
--   en-US  → usa_national     (already active)
--   en-GB  → uk_ireland       (already active)
--   fr     → france_fr_europe (NEW)
--   de     → dach             (was inactive · ACTIVATE)
--   es     → spain_iberian    (NEW)
--   ar     → gcc_luxury       (NEW)
--
-- Idempotent. Re-run-safe. Solo tenant 'studio'.
-- ────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_tenant_id UUID;
  v_market_id UUID;
  v_market_code TEXT;
  v_codes TEXT[] := ARRAY[
    'italy', 'usa_national', 'uk_ireland',
    'france_fr_europe', 'dach', 'spain_iberian', 'gcc_luxury'
  ];
  v_sort INT := 10;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'studio' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant studio not found · skip seed';
    RETURN;
  END IF;

  FOREACH v_market_code IN ARRAY v_codes LOOP
    SELECT id INTO v_market_id FROM markets WHERE code = v_market_code LIMIT 1;
    IF v_market_id IS NULL THEN
      RAISE NOTICE 'Market % not present in markets table · skip', v_market_code;
      CONTINUE;
    END IF;

    INSERT INTO tenant_markets (
      id, tenant_id, market_id, is_active, is_default, sort_order,
      activated_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_tenant_id, v_market_id,
      TRUE,
      v_market_code = 'italy',  -- italy as default
      v_sort,
      NOW(), NOW()
    )
    ON CONFLICT (tenant_id, market_id) DO UPDATE SET
      is_active   = TRUE,
      sort_order  = v_sort,
      updated_at  = NOW();

    v_sort := v_sort + 10;
  END LOOP;
END $$;

-- Verify
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM tenant_markets tm
    JOIN tenants t ON t.id = tm.tenant_id
    WHERE t.slug = 'studio' AND tm.is_active = TRUE;
  RAISE NOTICE '✓ tenant_markets attivi per studio: %', cnt;
END $$;
