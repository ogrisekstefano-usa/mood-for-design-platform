"""ITER174 · Pre-cleanup backup (full dump of all rows to be touched).

Saves complete row data (JSON) for every table that will be modified,
plus a storage manifest for objects to be deleted.

No writes to source DB. Output to /app/backups/iter174/pre_cleanup_<ts>/.
"""
import json
import os
import datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
DATABASE_URL = os.environ["DATABASE_URL"]

OPERATIONAL_TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"
ADMIN_EMAIL = "admin@moodfordesign.com"

# All tables whose rows will be DELETED entirely or partially
TABLES_TO_BACKUP = [
    # Operational data (will be wiped)
    "leads", "accounts", "contacts", "projects",
    "design_journeys", "journey_briefs", "journey_milestones",
    "journey_overview", "journey_timeline_events", "milestone_versions",
    "relationship_threads", "relationship_messages",
    "relationship_answer_events",
    "human_assignments", "human_assignment_events",
    "studio_relations", "studio_relationship_events",
    "access_magic_links", "login_attempts",
    "email_events", "funnel_events", "ai_assist_logs",
    "audit_logs", "configuration_change_events",
    "user_onboarding_state",
    "studio_activation_drafts", "studio_requests",
    # users
    "users", "users_profile",
    # Tenants (status change only)
    "tenants", "tenant_modules",
    # Media library partial
    "media_library",
    # Preserve baseline (CMS sanity)
    "cms_pages", "cms_sections",
    "tenant_settings", "tenant_atelier_identity",
    "tenant_email_settings", "tenant_markets", "tenant_onboarding",
    "tenant_configuration", "tenant_domains",
]


def main():
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = Path(f"/app/backups/iter174/pre_cleanup_{ts}")
    out_dir.mkdir(parents=True, exist_ok=True)

    conn = psycopg2.connect(DATABASE_URL)
    conn.set_session(readonly=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    manifest = {
        "iteration": "ITER174",
        "timestamp_utc": ts,
        "operational_tenant_preserve": OPERATIONAL_TENANT_ID,
        "admin_email_preserve": ADMIN_EMAIL,
        "files": {},
        "counts": {},
    }

    # Backup public tables
    for t in TABLES_TO_BACKUP:
        try:
            cur.execute(f'SELECT * FROM "{t}"')
            rows = cur.fetchall()
            data = [dict(r) for r in rows]
            fp = out_dir / f"{t}.json"
            fp.write_text(json.dumps(data, indent=2, default=str))
            manifest["files"][t] = str(fp.relative_to(out_dir.parent.parent.parent))
            manifest["counts"][t] = len(rows)
        except Exception as e:
            manifest["counts"][t] = f"ERR: {str(e)[:80]}"

    # Backup auth.users (sensitive but required for rollback)
    cur.execute("""
        SELECT id, email, created_at, last_sign_in_at, email_confirmed_at,
               raw_app_meta_data, raw_user_meta_data
          FROM auth.users
    """)
    auth_rows = [dict(r) for r in cur.fetchall()]
    (out_dir / "auth_users.json").write_text(json.dumps(auth_rows, indent=2, default=str))
    manifest["counts"]["auth.users"] = len(auth_rows)

    # Storage manifest
    cur.execute("""
        SELECT bucket_id, name, owner, metadata, created_at, updated_at
          FROM storage.objects ORDER BY bucket_id, name
    """)
    storage = [dict(r) for r in cur.fetchall()]
    (out_dir / "storage_objects.json").write_text(json.dumps(storage, indent=2, default=str))
    manifest["counts"]["storage.objects"] = len(storage)

    # Snapshot counts of all public non-empty tables (regression baseline)
    cur.execute("""
        SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' ORDER BY table_name
    """)
    all_tables = [r['table_name'] for r in cur.fetchall()]
    snapshot_counts = {}
    for t in all_tables:
        try:
            cur.execute(f'SELECT COUNT(*) AS n FROM "{t}"')
            n = cur.fetchone()['n']
            if n > 0:
                snapshot_counts[t] = n
        except Exception:
            pass
    (out_dir / "snapshot_counts_before.json").write_text(
        json.dumps(snapshot_counts, indent=2)
    )

    (out_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2, default=str))

    cur.close()
    conn.close()

    print(f"[BACKUP] dir: {out_dir}")
    print(f"[BACKUP] tables backed up: {len([k for k,v in manifest['counts'].items() if isinstance(v,int)])}")
    print(f"[BACKUP] total rows captured: {sum(v for v in manifest['counts'].values() if isinstance(v,int))}")
    print(f"[BACKUP] storage objects manifest: {manifest['counts']['storage.objects']} files")
    return out_dir


if __name__ == "__main__":
    main()
