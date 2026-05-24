-- ITER146.A.1 · Extend lead_type enum for Professional pipeline.
-- Idempotent — ADD VALUE IF NOT EXISTS requires PG12+, Supabase OK.
ALTER TYPE lead_type ADD VALUE IF NOT EXISTS 'professional';
ALTER TYPE lead_type ADD VALUE IF NOT EXISTS 'partner_studio';
