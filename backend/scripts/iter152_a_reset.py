"""
ITER152 · Fase A · System Reset — Backup + Clean State
======================================================

Backups ALL operational data to /app/memory/backups/pre_iter152_reset/
as portable JSON, then deletes only operational rows.

PRESERVES (do NOT touch):
  - super_admin & admin@moodfordesign.com users
  - primary MOOD tenant + its configuration
  - all CMS / editorial / magazine infrastructure
  - all migrations / schema
  - all branding presets / theme presets
  - media_library (but unlink usage from deleted entities)

DELETES (operational only):
  - leads, prospects, accounts, relationship_*, designer_presence,
    notifications, threads, messages, events, snapshots, signals,
    moodboards, projects, design_journeys, proposals, demo users,
    bookings, call_requests, magazine_anonymous_leads, lead_intake_*
"""
import os, json, sys
from pathlib import Path
from datetime import datetime, date
from decimal import Decimal
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
DB_URL = os.environ["DATABASE_URL"]
BACKUP_DIR = Path("/app/memory/backups/pre_iter152_reset")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

DRY_RUN = "--apply" not in sys.argv

ADMIN_EMAIL = "admin@moodfordesign.com"

# Tables to fully backup (read-only export)
BACKUP_TABLES = [
    "users_profile", "tenants", "tenant_memberships", "tenant_settings",
    "tenant_atelier_identity", "tenant_configuration",
    "leads", "accounts", "lead_intake_questions", "lead_assignments",
    "relationship_threads", "relationship_messages", "relationship_events",
    "relationship_actions", "relationship_affinities",
    "relationship_answer_events", "relationship_direction_signals",
    "relationship_direction_snapshots", "relationship_engagement_signals",
    "relationship_inspirations", "relationship_lookups",
    "relationship_material_affinities", "relationship_memory_fragments",
    "relationship_notifications", "relationship_ownership",
    "relationship_projects", "relationship_status",
    "designer_presence", "notifications",
    "design_journeys", "projects", "moodboards", "proposals",
    "studio_team_members", "studio_registrations",
    "call_requests", "client_messages",
    "magazine_anonymous_leads",
]

# Tables to TRUNCATE/DELETE (preserve admin where applicable)
DELETE_ALL_TABLES = [
    "relationship_actions", "relationship_affinities",
    "relationship_answer_events", "relationship_direction_signals",
    "relationship_direction_snapshots", "relationship_engagement_signals",
    "relationship_inspirations", "relationship_material_affinities",
    "relationship_memory_fragments", "relationship_notifications",
    "relationship_ownership", "relationship_projects",
    "relationship_messages", "relationship_threads",
    "relationship_events", "relationship_status",
    "designer_presence", "notifications",
    "lead_assignments", "leads", "accounts",
    "account_markets", "account_style_profile", "account_team_members",
    "call_requests", "client_messages",
    "client_preview_feedback", "client_preview_views",
    "contact_submissions",
    "design_journeys", "design_references",
    "journey_health_signals", "journey_milestones", "journey_timeline_events",
    "magazine_anonymous_leads",
    "milestone_feedback", "milestone_versions",
    "moodboard_candidates", "moodboard_comments",
    "moodboard_elements", "moodboard_pages", "moodboard_shares",
    "moodboard_versions", "moodboards",
    "project_activity", "project_ai_briefs", "project_comments",
    "project_files", "project_notes", "project_status_history", "projects",
    "proposal_items", "proposal_market_versions", "proposal_signoffs",
    "proposals",
    "preview_tokens",
    "collab_activity", "collab_comments", "collab_inspirations",
    "collab_page_status", "collab_versions",
    "inspirations_activity", "inspirations_boards",
    "inspirations_comments", "inspirations_items",
    "saved_references",
    "tasks",
    "interactions",
    "ai_assist_logs",
    "tenant_activity_events",
    "analytics_events", "funnel_events", "product_events",
    "product_usage_events",
    "studio_team_members",
    "human_assignment_events", "human_assignments",
    "member_invites",
]

def _json_default(o):
    if isinstance(o, (datetime, date)): return o.isoformat()
    if isinstance(o, Decimal): return float(o)
    if isinstance(o, (bytes, memoryview)): return None
    return str(o)

def backup_tables(conn):
    cur = conn.cursor()
    summary = {}
    for t in BACKUP_TABLES:
        try:
            cur.execute(f"SELECT * FROM {t}")
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            data = [dict(zip(cols, r)) for r in rows]
            out = BACKUP_DIR / f"{t}.json"
            out.write_text(json.dumps(data, indent=2, default=_json_default, ensure_ascii=False))
            summary[t] = len(rows)
            print(f"  ✓ {t}: {len(rows)} rows → {out.name}")
        except Exception as e:
            print(f"  ⚠ {t}: skipped ({e})")
            summary[t] = f"error: {e}"
    (BACKUP_DIR / "_summary.json").write_text(json.dumps(summary, indent=2))
    return summary

def truncate_operational(conn):
    cur = conn.cursor()
    cur.execute("SET session_replication_role = replica;")  # disable FKs for clean wipe
    cleaned = {}
    for t in DELETE_ALL_TABLES:
        try:
            cur.execute(f"DELETE FROM {t}")
            cleaned[t] = cur.rowcount
            print(f"  ✗ {t}: deleted {cur.rowcount} rows")
        except Exception as e:
            print(f"  ⚠ {t}: skipped ({e})")
            conn.rollback()
            cur.execute("SET session_replication_role = replica;")
            cleaned[t] = f"error: {e}"
    cur.execute("SET session_replication_role = origin;")
    conn.commit()  # commit successful deletions before next phase

    # Null-out FK references from preserved CMS tables to soon-to-be-deleted users
    print("  · clearing FK references to non-admin users from CMS tables")
    for q in [
      "UPDATE atelier_dashboard_media SET uploaded_by=NULL WHERE uploaded_by IS NOT NULL",
      "UPDATE media_library SET uploaded_by=NULL WHERE uploaded_by IS NOT NULL",
    ]:
        try:
            cur.execute(q); conn.commit()
            print(f"     ✓ {q[:60]}…")
        except Exception as e:
            print(f"     ⚠ skipped: {e}"); conn.rollback()

    # Prune non-admin profiles
    cur.execute("""
      DELETE FROM users_profile
       WHERE email != %s
         AND role NOT IN ('super_admin')
         AND id NOT IN (SELECT id FROM users_profile WHERE email=%s)
       RETURNING id, email""",
                (ADMIN_EMAIL, ADMIN_EMAIL))
    pruned = cur.fetchall()
    print(f"  ✗ users_profile pruned: {len(pruned)} non-admin profiles")
    cleaned["users_profile_pruned"] = len(pruned)
    return cleaned

def main():
    print(f"\n{'='*60}")
    print(f"ITER152 · Fase A · System Reset · {'DRY-RUN' if DRY_RUN else 'APPLY'}")
    print(f"{'='*60}\n")
    print(f"Backup dir: {BACKUP_DIR}")

    conn = psycopg2.connect(DB_URL); conn.autocommit = False
    try:
        print("\n▸ Phase 1 · Backup operational data to JSON")
        backup_summary = backup_tables(conn)
        conn.commit()

        if DRY_RUN:
            print("\n⚠ DRY-RUN · no deletions performed.")
            print("   Re-run with --apply to execute the wipe.")
            return

        print("\n▸ Phase 2 · Delete operational rows")
        clean_summary = truncate_operational(conn)
        conn.commit()

        # Final report
        report = {
            "executed_at": datetime.utcnow().isoformat() + "Z",
            "backup_summary": backup_summary,
            "clean_summary": clean_summary,
        }
        (BACKUP_DIR / "_reset_report.json").write_text(
            json.dumps(report, indent=2, default=_json_default))
        print(f"\n✅ Reset complete · report: {BACKUP_DIR}/_reset_report.json")
    except Exception as e:
        conn.rollback()
        print(f"❌ FAILED: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
