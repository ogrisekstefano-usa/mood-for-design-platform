-- 136 · STORE-001 · STORE MODE™
-- Aggiunge il flag is_store_mode su tenant_configuration. Default TRUE
-- (la stragrande maggioranza dei tenant MOOD oggi sono showroom).
-- Nessuna distruzione · sola lettura aggiuntiva nei resolver di navigazione.

BEGIN;

ALTER TABLE tenant_configuration
  ADD COLUMN IF NOT EXISTS is_store_mode BOOLEAN NOT NULL DEFAULT TRUE;

-- Esponi la colonna anche nei tenant senza una riga di configurazione:
-- al primo accesso resolve_tenant_config crea il record con default TRUE.
COMMENT ON COLUMN tenant_configuration.is_store_mode IS
  'STORE-001 · quando TRUE la sidebar mostra solo le 11 surface dello Store Success Path.';

INSERT INTO schema_migrations (version, applied_at)
VALUES ('136_store001_store_mode', NOW()) ON CONFLICT DO NOTHING;

COMMIT;
