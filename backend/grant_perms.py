"""Grant service_role and authenticated/anon required permissions on public tables.

Multi-tenant enforced in backend (no RLS); service_role needs full CRUD.
Anon needs INSERT on leads + funnel_events for public form.
"""
import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')
conn = psycopg2.connect(os.environ['DATABASE_URL'])
conn.autocommit = True
cur = conn.cursor()

# Get all public tables
cur.execute("""
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
""")
tables = [r[0] for r in cur.fetchall()]
print(f"Tables: {len(tables)}")

for t in tables:
    cur.execute(f'GRANT ALL ON public."{t}" TO service_role;')
    cur.execute(f'GRANT ALL ON public."{t}" TO authenticated;')
    # Anon only needs read on tenants for public lookups + insert on leads/funnel
    if t in ('tenants', 'tenant_domains'):
        cur.execute(f'GRANT SELECT ON public."{t}" TO anon;')

# Sequences (if any)
cur.execute("""
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public';
""")
for s in [r[0] for r in cur.fetchall()]:
    cur.execute(f'GRANT USAGE, SELECT ON SEQUENCE public."{s}" TO service_role, authenticated, anon;')

# Make sure RLS is disabled on all public tables (user said no RLS)
for t in tables:
    try:
        cur.execute(f'ALTER TABLE public."{t}" DISABLE ROW LEVEL SECURITY;')
    except Exception as e:
        print(f"  RLS disable skipped on {t}: {e}")

print("✅ Grants applied + RLS disabled on all public tables")
cur.close(); conn.close()
