#!/usr/bin/env python3
"""Applier for migration 118 · Design Knowledge Graph™ Phase 1."""
from __future__ import annotations
import os, sys, pathlib, psycopg2
from dotenv import load_dotenv

ROOT = pathlib.Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
MIG = ROOT / "supabase" / "migrations" / "118_iter193_design_knowledge_graph.sql"
DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL missing", file=sys.stderr); sys.exit(2)

def main():
    sql = MIG.read_text(encoding="utf-8")
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema='public'
                  AND table_name IN ('spaces_canonical','features_canonical','styles_canonical',
                                     'markets_canonical','product_spaces','product_features',
                                     'product_styles','product_markets','material_styles',
                                     'material_spaces','story_markets','brand_styles','brand_markets',
                                     'knowledge_graph_edges')
                ORDER BY table_name
            """)
            tables = [r[0] for r in cur.fetchall()]
            # Counts of seeded rows
            counts = {}
            for t in ("spaces_canonical","features_canonical","styles_canonical","markets_canonical"):
                cur.execute(f"SELECT COUNT(*) FROM {t}")
                counts[t] = cur.fetchone()[0]
            cur.execute("""
                CREATE TABLE IF NOT EXISTS public.schema_migrations (
                    version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now()
                );
                INSERT INTO public.schema_migrations(version)
                VALUES ('118_iter193_design_knowledge_graph.sql')
                ON CONFLICT (version) DO NOTHING;
            """)
        conn.commit()
        print(f"✅ Migration 118 applied. Tables: {tables}")
        print(f"   Seeded vocab: {counts}")
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}", file=sys.stderr); sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
