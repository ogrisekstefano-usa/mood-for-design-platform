"""Apply migration 063 — Sprint G.1 · Semantic Architecture Lock.

Idempotent. Safe to re-run. Logs schema state before/after.
"""
import os, sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("DATABASE_URL not set"); sys.exit(1)

MIG = (Path(__file__).resolve().parent.parent.parent /
       'supabase' / 'migrations' / '063_journey_root_entity.sql')


def col_exists(cur, table, col):
    cur.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=%s AND column_name=%s",
        (table, col),
    )
    return cur.fetchone() is not None


def main() -> int:
    print(f"Applying {MIG.name} (Sprint G.1 · Semantic Architecture Lock) …")
    conn = psycopg2.connect(DB_URL); conn.autocommit = True
    cur = conn.cursor()

    # Snapshot row counts before — proves zero data loss.
    snapshot = {}
    for t in ('design_journeys','journey_milestones','journey_timeline_events',
              'moodboards','proposals','curated_collections',
              'milestone_versions','milestone_feedback','accounts','contacts'):
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        snapshot[t] = cur.fetchone()[0]
    print(f"  pre-counts: {snapshot}")

    cur.execute(MIG.read_text())

    # Verify additive schema.
    checks = [
        ('design_journeys','account_id'),
        ('design_journeys','lifecycle_state'),
        ('moodboards','journey_id'),
        ('moodboards','milestone_id'),
        ('proposals','journey_id'),
        ('proposals','milestone_id'),
        ('curated_collections','journey_id'),
        ('curated_collections','milestone_id'),
        ('journey_timeline_events','event_canon'),
    ]
    for tbl, col in checks:
        ok = col_exists(cur, tbl, col)
        print(f"  {tbl}.{col} → {'OK' if ok else 'MISSING'}")

    cur.execute("SELECT to_regclass('public.journey_health_signals')")
    print(f"  journey_health_signals → {cur.fetchone()[0]}")
    cur.execute("SELECT to_regclass('public.journey_artifacts')")
    print(f"  VIEW journey_artifacts → {cur.fetchone()[0]}")

    # Snapshot row counts after — should match.
    for t in snapshot:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        post = cur.fetchone()[0]
        flag = '✅' if post == snapshot[t] else '⚠️'
        print(f"  {flag} {t}: pre={snapshot[t]} post={post}")

    # Backfill metrics.
    cur.execute("""SELECT
        COUNT(*) FILTER (WHERE account_id IS NOT NULL)*1.0/NULLIF(COUNT(*),0),
        COUNT(*) FILTER (WHERE lifecycle_state IS NOT NULL)*1.0/NULLIF(COUNT(*),0)
        FROM design_journeys""")
    acc_rate, life_rate = cur.fetchone()
    print(f"  journey backfill: account_id={acc_rate:.2%} lifecycle_state={life_rate:.2%}")

    cur.execute("""SELECT
        COUNT(*) FILTER (WHERE journey_id IS NOT NULL)*1.0/NULLIF(COUNT(*),0)
        FROM moodboards WHERE deleted_at IS NULL""")
    mb_rate = cur.fetchone()[0]
    print(f"  moodboards backfill: journey_id={mb_rate:.2%}")

    cur.execute("""SELECT
        COUNT(*) FILTER (WHERE event_canon IS NOT NULL)*1.0/NULLIF(COUNT(*),0)
        FROM journey_timeline_events""")
    ev_rate = cur.fetchone()[0]
    print(f"  events backfill: event_canon={ev_rate:.2%}")

    cur.close(); conn.close()
    print("✅ Migration 063 applied cleanly.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
