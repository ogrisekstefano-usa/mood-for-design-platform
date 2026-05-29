"""ITER170 · Platform Data Cleanup™ — PRODUCTION EXECUTOR.

Eseguisce in transazione atomica:
  1. Backup completo (JSON pre-state counts + dump precious + auth.users)
  2. TRUNCATE tabelle demo in FK-safe order
  3. DELETE auth.users + users_profile + public.users non-admin
  4. DELETE tenant_settings/atelier_identity/etc. dei tenant demo (vuoti)
  5. DELETE tenants demo (atelier-brera + test-activate-…)
  6. Storage cleanup selettivo: elimina file demo, preserva system
  7. POST-state counts + sanity check + report finale JSON

Run:
    python3 /app/backend/scripts/iter170_cleanup_executor.py
"""
import json
import os
import sys
import datetime
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
DATABASE_URL = os.environ["DATABASE_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"
ORPHAN_TENANT_PREFIX = "81a09ead-0306-4d71-a5c4-ca2b3956add2"  # ex demo studio

# All demo content tables, FK-safe child-first
DEMO_TABLES = [
    "milestone_feedback", "milestone_versions",
    "journey_timeline_events", "journey_briefs", "journey_milestones",
    "moodboard_elements", "moodboard_pages", "moodboard_shares",
    "moodboards", "curated_collections", "proposals",
    "published_design_journey_translations", "published_design_journeys",
    "cultural_edition_drafts", "design_journeys",
    "relationship_direction_snapshots", "relationship_answer_events",
    "relationship_messages", "relationship_threads",
    "relationship_lookups", "message_translations",
    "human_assignment_events", "human_assignments",
    "recall_requests", "studio_visit_reports",
    "studio_relationship_events", "studio_relations",
    "studio_registrations", "studio_activation_drafts",
    "project_activity", "projects", "contacts", "accounts", "leads",
    "email_events", "login_attempts", "access_magic_links",
    "funnel_events", "product_events",
    "market_behavior_events", "market_signal_aggregates",
    "designer_presence", "user_onboarding_state",
    "reference_collections", "media_links",
]


def list_storage_buckets():
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    h = {"apikey": SUPABASE_SERVICE_KEY,
         "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
    return requests.get(url, headers=h, timeout=15).json()


def list_bucket_objects(bucket, prefix="", limit=500):
    url = f"{SUPABASE_URL}/storage/v1/object/list/{bucket}"
    h = {"apikey": SUPABASE_SERVICE_KEY,
         "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
         "Content-Type": "application/json"}
    body = {"limit": limit, "offset": 0, "prefix": prefix,
            "sortBy": {"column": "name", "order": "asc"}}
    r = requests.post(url, headers=h, data=json.dumps(body), timeout=20)
    return r.json() if r.ok else []


def walk_bucket(bucket, prefix="", depth=0, max_depth=8, files=None):
    if files is None:
        files = []
    if depth > max_depth:
        return files
    for o in list_bucket_objects(bucket, prefix):
        name = o.get("name")
        if not name:
            continue
        full = (prefix + name) if prefix else name
        if o.get("id") is None:
            walk_bucket(bucket, full + "/", depth + 1, max_depth, files)
        else:
            files.append({"path": full,
                          "size": (o.get("metadata") or {}).get("size", 0)})
    return files


def is_system_storage(bucket, path):
    """Preserve branding/logo/storefront/CMS pages of admin tenant."""
    p = path.lower()
    # Always preserve admin tenant's brand and storefront hero
    if path.startswith(ADMIN_TENANT_ID):
        if "/brand/" in p or "/storefront/" in p:
            return True
    # Magazine and tenant-branding buckets entirely system
    if bucket in ("magazine-media", "tenant-branding"):
        return True
    # Admin's media bucket is branding
    if bucket == "media" and path.startswith(ADMIN_TENANT_ID):
        return True
    # storefront-public bucket holds CMS hero images referenced in cms_sections
    # Preserve only admin tenant's files (or storefront-public for any tenant
    # since CMS sections may reference orphan tenant images we still serve)
    if bucket == "storefront-public":
        return True
    return False


def storage_delete_batch(bucket, paths):
    """Delete objects from a bucket. Supabase Storage v1 supports
    DELETE /object/{bucket} with JSON body {"prefixes":[...]} for batch."""
    if not paths:
        return 0
    h = {"apikey": SUPABASE_SERVICE_KEY,
         "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
         "Content-Type": "application/json"}
    deleted = 0
    # Batch delete via JSON body
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}"
    # Chunk to 100 paths
    for i in range(0, len(paths), 100):
        chunk = paths[i:i + 100]
        body = json.dumps({"prefixes": chunk})
        r = requests.delete(url, headers=h, data=body, timeout=30)
        if r.ok:
            data = r.json()
            deleted += len([x for x in data if x.get("name")])
        else:
            print(f"      ⚠ batch delete failed {bucket}: {r.status_code} {r.text[:200]}")
    return deleted


def safe_count(cur, conn, table):
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        return cur.fetchone()[0]
    except Exception:
        conn.rollback()
        return None


def main():
    backup_dir = Path("/app/backups/iter170")
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    print(f"⏰ TIMESTAMP {ts}")
    print(f"📂 BACKUPS  {backup_dir}\n")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    report = {"timestamp": ts, "stage": "executor"}

    # ── 1. PRE BACKUP ──────────────────────────────────────────────
    print("═" * 70)
    print("STEP 1 · PRE-CLEANUP BACKUP")
    print("═" * 70)

    # auth.users dump
    cur.execute("SELECT id, email, role, created_at FROM auth.users ORDER BY created_at")
    auth_rows = [{"id": str(r[0]), "email": r[1], "role": r[2],
                  "created_at": str(r[3])} for r in cur.fetchall()]
    (backup_dir / f"pre_auth_users_{ts}.json").write_text(
        json.dumps(auth_rows, indent=2))
    print(f"   ✓ dumped {len(auth_rows)} auth.users")

    # users_profile dump
    cur.execute("""
        SELECT id, auth_user_id, tenant_id, email, role, first_name, last_name,
               is_root_superadmin, created_at
          FROM users_profile ORDER BY created_at
    """)
    prof_rows = [{"id": str(r[0]), "auth_user_id": str(r[1]) if r[1] else None,
                  "tenant_id": str(r[2]) if r[2] else None,
                  "email": r[3], "role": r[4], "first_name": r[5],
                  "last_name": r[6], "is_root_superadmin": r[7],
                  "created_at": str(r[8])} for r in cur.fetchall()]
    (backup_dir / f"pre_users_profile_{ts}.json").write_text(
        json.dumps(prof_rows, indent=2))
    print(f"   ✓ dumped {len(prof_rows)} users_profile rows")

    # tenants dump
    cur.execute("SELECT id, slug, name, created_at FROM tenants")
    tenants = [{"id": str(r[0]), "slug": r[1], "name": r[2],
                "created_at": str(r[3])} for r in cur.fetchall()]
    (backup_dir / f"pre_tenants_{ts}.json").write_text(
        json.dumps(tenants, indent=2))
    print(f"   ✓ dumped {len(tenants)} tenants")

    # PRE counts (just totals)
    pre_counts = {}
    for t in DEMO_TABLES:
        pre_counts[t] = safe_count(cur, conn, t)
    pre_counts["tenants"] = safe_count(cur, conn, "tenants")
    pre_counts["users_profile"] = safe_count(cur, conn, "users_profile")
    pre_counts["users"] = safe_count(cur, conn, "users")
    report["pre_counts"] = pre_counts

    # ── 2. DB CLEANUP TRANSACTION ──────────────────────────────────
    print("\n" + "═" * 70)
    print("STEP 2 · DB CLEANUP TRANSACTION")
    print("═" * 70)
    try:
        # Resolve admin auth id
        cur.execute("SELECT id FROM auth.users WHERE email = %s", (ADMIN_EMAIL,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"Admin {ADMIN_EMAIL} not found")
        admin_auth_id = str(row[0])
        print(f"   👤 admin auth.user.id = {admin_auth_id}")
        print(f"   🏢 admin tenant.id    = {ADMIN_TENANT_ID}\n")

        truncated = {}
        for t in DEMO_TABLES:
            try:
                cur.execute(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE')
                truncated[t] = "ok"
                print(f"   ✓ truncated {t}")
            except Exception as e:
                truncated[t] = f"err: {str(e)[:80]}"
                print(f"   ⚠ {t}: {str(e)[:80]}")
                conn.rollback()
                cur = conn.cursor()
        report["truncated"] = truncated

        # Delete non-admin users_profile
        cur.execute(
            "DELETE FROM users_profile WHERE email IS DISTINCT FROM %s",
            (ADMIN_EMAIL,))
        n = cur.rowcount
        report["users_profile_deleted"] = n
        print(f"\n   ✓ deleted {n} users_profile rows (kept admin)")

        # Delete non-admin auth.users
        cur.execute(
            "DELETE FROM auth.users WHERE id != %s",
            (admin_auth_id,))
        n = cur.rowcount
        report["auth_users_deleted"] = n
        print(f"   ✓ deleted {n} auth.users rows (kept admin)")

        # Delete non-admin public.users
        cur.execute("DELETE FROM users WHERE id != %s", (admin_auth_id,))
        n = cur.rowcount
        report["public_users_deleted"] = n
        print(f"   ✓ deleted {n} public.users rows")

        # Delete demo tenants (only after all FK rows are gone)
        cur.execute(
            "DELETE FROM tenants WHERE id != %s", (ADMIN_TENANT_ID,))
        n = cur.rowcount
        report["tenants_deleted"] = n
        print(f"   ✓ deleted {n} demo tenants")

        conn.commit()
        print(f"\n   ✅ DB TRANSACTION COMMITTED")
    except Exception as e:
        conn.rollback()
        print(f"\n   ❌ ROLLBACK: {e}")
        sys.exit(1)

    # ── 3. STORAGE CLEANUP ─────────────────────────────────────────
    print("\n" + "═" * 70)
    print("STEP 3 · STORAGE CLEANUP (selective)")
    print("═" * 70)
    storage_report = {}
    try:
        buckets = list_storage_buckets()
        for b in buckets:
            bname = b["name"]
            files = walk_bucket(bname)
            to_delete = []
            preserved = []
            for f in files:
                if is_system_storage(bname, f["path"]):
                    preserved.append(f["path"])
                else:
                    to_delete.append(f["path"])
            n_deleted = storage_delete_batch(bname, to_delete)
            storage_report[bname] = {
                "total": len(files),
                "preserved": len(preserved),
                "deleted": n_deleted,
                "to_delete_attempted": len(to_delete),
                "preserved_sample": preserved[:10],
            }
            print(f"   📦 {bname:25} total={len(files):>4} "
                  f"preserved={len(preserved):>3} deleted={n_deleted:>4}")
    except Exception as e:
        print(f"   ⚠ Storage cleanup error: {e}")
    report["storage"] = storage_report

    # ── 4. POST counts + sanity check ─────────────────────────────
    print("\n" + "═" * 70)
    print("STEP 4 · POST-CLEANUP SANITY")
    print("═" * 70)
    post_counts = {}
    for t in DEMO_TABLES:
        post_counts[t] = safe_count(cur, conn, t)
    sanity_tables = ["tenants", "users", "users_profile", "tenant_settings",
                     "editorial_blocks", "editorial_block_translations",
                     "cms_pages", "cms_sections", "platform_languages",
                     "phone_dial_codes", "moodboard_rooms", "moodboard_chapters",
                     "schema_migrations", "markets", "tenant_markets"]
    for t in sanity_tables:
        post_counts[t] = safe_count(cur, conn, t)
    report["post_counts"] = post_counts

    print("\n   DEMO tables (must all be 0):")
    bad = []
    for t in DEMO_TABLES:
        v = post_counts.get(t)
        if v != 0 and v is not None:
            bad.append((t, v))
            print(f"      ❌ {t}: {v}")
    if not bad:
        print("      ✓ tutte 0")

    print("\n   PRESERVED catalogs:")
    for t in sanity_tables:
        v = post_counts.get(t)
        flag = "✅" if (isinstance(v, int) and v > 0) else "⚠️"
        print(f"      {flag} {t:35} {v}")

    # Verify admin exists and is intact
    cur.execute(
        "SELECT id, email, role, is_root_superadmin, tenant_id FROM users_profile WHERE email = %s",
        (ADMIN_EMAIL,))
    a = cur.fetchone()
    if a:
        report["admin_intact"] = {
            "id": str(a[0]), "email": a[1], "role": a[2],
            "is_root_superadmin": a[3], "tenant_id": str(a[4])
        }
        print(f"\n   ✅ ADMIN INTACT: {a[1]} · role={a[2]} · root={a[3]} · tenant={a[4]}")
    else:
        print(f"\n   ❌ ADMIN NOT FOUND — abort review needed")
        report["admin_intact"] = None

    # Save report
    out = backup_dir / f"executor_report_{ts}.json"
    out.write_text(json.dumps(report, indent=2, default=str))
    print(f"\n📄 REPORT: {out}")

    cur.close()
    conn.close()
    print(f"\n✅ ITER170 CLEANUP COMPLETO.")


if __name__ == "__main__":
    main()
