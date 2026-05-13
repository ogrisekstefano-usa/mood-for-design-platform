# MOOD for DESIGN™ — Database Migrations

## Workflow

This directory contains all schema migrations for the Supabase Postgres instance.
**Every** schema change MUST go through a migration file. No manual changes in Supabase Studio.

## Structure

```
supabase/
├── README.md                    (this file)
├── migrations/
│   ├── 001_baseline_2026_05_13.sql     (initial 22 tables, RLS off, enums)
│   ├── 002_moodboard_schema_cleanup.sql (use position_json/style_json + indexes)
│   ├── 003_workspace_dedicated_tables.sql (project_notes, project_activity, moodboard_shares)
│   └── …
└── apply.py                     (runner — applies pending migrations sequentially)
```

## Apply pending migrations

```bash
cd /app/backend && python3 ../supabase/apply.py
```

The runner is **idempotent**: each migration writes its name into `schema_migrations` table after success.
Failed migrations roll back the transaction.

## Naming convention

`NNN_short_description.sql` where NNN is zero-padded sequence. Description in snake_case.

## Migration anatomy

```sql
-- ===== {NUMBER}: {TITLE} =====
-- Purpose: …
-- Reversible: yes/no
-- Author: agent / date

BEGIN;

-- forward changes here

COMMIT;
```

## RLS readiness

The codebase enforces multi-tenancy server-side via `core/tenant_context.py`. RLS is currently
disabled but every table has `tenant_id`. To enable RLS in the future, add policies like:

```sql
ALTER TABLE moodboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON moodboards
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

## Baseline (001)

The baseline is **NOT executable**: the schema already exists in Supabase. It is a documentation
artifact that describes the existing schema as of 13 May 2026. Future migrations start from 002.
