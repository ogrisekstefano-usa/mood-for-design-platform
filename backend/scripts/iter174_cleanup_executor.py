"""ITER174 · CLEAN RESET CONTROLLED™ — EXECUTOR

Performs the actual cleanup in a single DB transaction.
Storage objects are deleted AFTER the DB transaction commits.

Auth users (auth.users) are deleted via Supabase admin API after DB commit.

PRESERVE rules:
  - Tenant ID 848354b9-… (slug=studio, MOOD for DESIGN) — operational
  - Auth user admin@moodfordesign.com (id + profile)
  - All CMS / editorial / catalog tables
  - Storage objects classified PRESERVE in dry-run

Order:
  1. Snapshot counts (sanity)
  2. SQL transaction:
     a. Delete dependent operational rows in FK-safe order
     b. Delete non-admin users_profile rows
     c. Delete public.users orphans
     d. Delete media_library candidate rows
     e. Archive non-operational tenants (status='archived')
  3. Storage object deletion (post-commit, via storage.objects)
  4. Supabase Auth deletion (post-commit, via admin REST)
  5. Final snapshot counts + verification
"""
import json
import os
import datetime
import sys
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
DATABASE_URL = os.environ["DATABASE_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

OPERATIONAL_TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"
ADMIN_EMAIL = "admin@moodfordesign.com"

# Tables to wipe (in FK-safe order)
OPERATIONAL_WIPES_ORDERED = [
    # Leaf-most events first
    "relationship_answer_events",
    "relationship_messages",
    "relationship_threads",
    "human_assignment_events",
    "human_assignments",
    "studio_relationship_events",
    "studio_relations",
    "journey_timeline_events",
    "milestone_versions",
    "journey_milestones",
    "journey_briefs",
    "design_journeys",
    "projects",
    "contacts",
    "accounts",
    "leads",
    "access_magic_links",
    "login_attempts",
    "email_events",
    "funnel_events",
    "ai_assist_logs",
    "audit_logs",
    "configuration_change_events",
    "user_onboarding_state",
    "studio_activation_drafts",
    "studio_requests",
]

# Media library candidate row classification (matches dry-run)
MEDIA_CANDIDATE_CATEGORIES = {
    "inspiration", "moodboard", "test",
}
MEDIA_CANDIDATE_NULL_OK = True  # category IS NULL → candidate

# Storage objects (matches dry-run candidate + orphan classification)
def is_storage_candidate(bucket, path):
    p = (path or "").lower()
    if bucket == "storefront-public":
        seg = path.split("/")[0]
        # All storefront-public belong to tenant 81a09ead… (deleted from tenants)
        if seg != OPERATIONAL_TENANT_ID:
            return True
    if bucket == "tenant-assets":
        if "/brand/" in p or "/storefront/" in p:
            return False  # preserve
        return True  # atelier-media/* → candidate
    return False


def log(msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def fetch_admin_id(cur):
    cur.execute("SELECT id FROM auth.users WHERE email = %s", (ADMIN_EMAIL,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"Admin user {ADMIN_EMAIL} not found — refusing to continue")
    return str(row[0])


def fetch_admin_profile_id(cur):
    cur.execute("SELECT id FROM users_profile WHERE email = %s", (ADMIN_EMAIL,))
    row = cur.fetchone()
    if not row:
        raise RuntimeError(f"Admin profile {ADMIN_EMAIL} not found — refusing to continue")
    return str(row[0])


def delete_auth_users_via_admin_api(user_ids):
    """Delete users from auth.users via Supabase admin REST API (cascade-safe)."""
    h = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    results = []
    for uid in user_ids:
        url = f"{SUPABASE_URL}/auth/v1/admin/users/{uid}"
        r = requests.delete(url, headers=h, timeout=20)
        results.append({
            "user_id": uid,
            "status_code": r.status_code,
            "ok": r.ok,
            "error": None if r.ok else (r.text[:200] if r.text else None),
        })
    return results


def delete_storage_objects(objects):
    """Delete storage objects via storage REST API."""
    h = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    # Group by bucket
    by_bucket = {}
    for obj in objects:
        by_bucket.setdefault(obj["bucket"], []).append(obj["path"])

    results = []
    for bucket, paths in by_bucket.items():
        url = f"{SUPABASE_URL}/storage/v1/object/{bucket}"
        r = requests.delete(
            url, headers=h, json={"prefixes": paths}, timeout=30
        )
        results.append({
            "bucket": bucket,
            "files_requested": len(paths),
            "status_code": r.status_code,
            "ok": r.ok,
            "response": r.json() if r.ok else r.text[:300],
        })
    return results


def main():
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_dir = Path(f"/app/backups/iter174/cleanup_{ts}")
    report_dir.mkdir(parents=True, exist_ok=True)

    log("ITER174 · CLEAN RESET — START")
    log(f"Report dir: {report_dir}")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    audit = {
        "iteration": "ITER174",
        "timestamp_utc": ts,
        "operational_tenant_preserve": OPERATIONAL_TENANT_ID,
        "admin_email_preserve": ADMIN_EMAIL,
        "phases": [],
    }

    # ── Phase 0: Snapshot counts BEFORE ────────────────────────────
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' ORDER BY table_name"
    )
    all_tables = [r[0] for r in cur.fetchall()]
    counts_before = {}
    for t in all_tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            n = cur.fetchone()[0]
            if n > 0:
                counts_before[t] = n
        except Exception:
            conn.rollback()
    cur.execute("SELECT COUNT(*) FROM auth.users")
    counts_before["auth.users"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM storage.objects")
    counts_before["storage.objects"] = cur.fetchone()[0]
    audit["counts_before"] = counts_before
    (report_dir / "counts_before.json").write_text(
        json.dumps(counts_before, indent=2)
    )
    log(f"counts_before: {len(counts_before)} non-empty tables")

    # ── Phase 1: Identify admin to PRESERVE ────────────────────────
    admin_auth_id = fetch_admin_id(cur)
    admin_profile_id = fetch_admin_profile_id(cur)
    log(f"PRESERVE admin auth_user_id={admin_auth_id}")
    log(f"PRESERVE admin profile_id={admin_profile_id}")

    # Identify auth users to delete
    cur.execute(
        "SELECT id, email FROM auth.users WHERE id != %s ORDER BY created_at",
        (admin_auth_id,),
    )
    auth_to_delete = [(str(r[0]), r[1]) for r in cur.fetchall()]
    audit["auth_users_to_delete"] = auth_to_delete
    log(f"auth users to delete: {len(auth_to_delete)}")

    # Identify storage candidates (matches dry-run logic)
    cur.execute("""
        SELECT bucket_id, name, (metadata->>'size')::bigint
          FROM storage.objects ORDER BY bucket_id, name
    """)
    storage_candidates = []
    storage_preserve = []
    for bucket, name, size in cur.fetchall():
        item = {"bucket": bucket, "path": name, "size": size or 0}
        if is_storage_candidate(bucket, name):
            storage_candidates.append(item)
        else:
            storage_preserve.append(item)
    audit["storage_to_delete"] = storage_candidates
    audit["storage_to_preserve_count"] = len(storage_preserve)
    log(f"storage candidates (DB + REST): {len(storage_candidates)} files; preserve: {len(storage_preserve)}")

    # ── Phase 2: SQL TRANSACTION (atomic DB cleanup) ───────────────
    log("BEGIN transaction")
    try:
        # 2a · Wipe operational tables
        op_deletes = {}
        for t in OPERATIONAL_WIPES_ORDERED:
            try:
                cur.execute(f'DELETE FROM "{t}"')
                op_deletes[t] = cur.rowcount
                log(f"  DELETE {t}: -{cur.rowcount}")
            except Exception as e:
                conn.rollback()
                log(f"  ❌ DELETE {t} FAILED: {e}")
                raise
        audit["operational_deletes"] = op_deletes

        # 2b · Delete users_profile rows (preserve admin only)
        cur.execute(
            "DELETE FROM users_profile WHERE id != %s",
            (admin_profile_id,),
        )
        audit["users_profile_deleted"] = cur.rowcount
        log(f"  DELETE users_profile (except admin): -{cur.rowcount}")

        # 2c · Delete public.users rows (preserve admin auth_user_id only)
        # public.users mirrors auth.users — keep only admin
        try:
            cur.execute(
                "DELETE FROM users WHERE id != %s",
                (admin_auth_id,),
            )
            audit["public_users_deleted"] = cur.rowcount
            log(f"  DELETE public.users (except admin): -{cur.rowcount}")
        except Exception as e:
            conn.rollback()
            log(f"  ⚠ public.users delete failed (continuing): {e}")
            # public.users may not exist or may have triggers; not critical
            audit["public_users_deleted"] = f"ERR: {str(e)[:80]}"

        # 2d · Delete media_library candidate rows
        cur.execute("""
            DELETE FROM media_library
             WHERE (category IS NULL
                    OR LOWER(category) = ANY(%s))
        """, ([c.lower() for c in MEDIA_CANDIDATE_CATEGORIES],))
        audit["media_library_deleted"] = cur.rowcount
        log(f"  DELETE media_library (candidate rows): -{cur.rowcount}")

        # 2e · Archive non-operational tenants (currently active only)
        cur.execute(
            "UPDATE tenants SET status='archived', updated_at=NOW() "
            "WHERE id != %s AND status='active'",
            (OPERATIONAL_TENANT_ID,),
        )
        audit["tenants_archived"] = cur.rowcount
        log(f"  ARCHIVE tenants (active → archived, except operational): -{cur.rowcount}")

        # 2f · Clean test/pending tenant_domains for operational tenant
        cur.execute(
            "DELETE FROM tenant_domains "
            "WHERE tenant_id = %s "
            "AND (hostname LIKE 'test-%%' OR verification_status='pending')",
            (OPERATIONAL_TENANT_ID,),
        )
        audit["tenant_domains_test_deleted"] = cur.rowcount
        log(f"  DELETE test tenant_domains: -{cur.rowcount}")

        # Commit transaction
        conn.commit()
        log("COMMIT ✅")
        audit["db_transaction_status"] = "committed"

    except Exception as e:
        conn.rollback()
        log(f"ROLLBACK ❌ — {e}")
        audit["db_transaction_status"] = f"rolled_back: {e}"
        (report_dir / "audit.json").write_text(json.dumps(audit, indent=2, default=str))
        cur.close()
        conn.close()
        sys.exit(2)

    # ── Phase 3: Storage object deletion (post-commit) ─────────────
    log(f"Deleting {len(storage_candidates)} storage objects…")
    storage_results = delete_storage_objects(storage_candidates)
    audit["storage_deletion_results"] = storage_results
    for r in storage_results:
        log(f"  storage[{r['bucket']}]: {r['files_requested']} files → "
            f"HTTP {r['status_code']} ({'OK' if r['ok'] else 'FAIL'})")

    # ── Phase 4: Auth user deletion (post-commit) ──────────────────
    log(f"Deleting {len(auth_to_delete)} auth users via Supabase admin API…")
    auth_results = delete_auth_users_via_admin_api([uid for uid, _ in auth_to_delete])
    audit["auth_deletion_results"] = auth_results
    auth_ok = sum(1 for r in auth_results if r["ok"])
    log(f"  auth deletion: {auth_ok}/{len(auth_results)} ok")

    # ── Phase 5: Snapshot counts AFTER ─────────────────────────────
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' ORDER BY table_name"
    )
    all_tables = [r[0] for r in cur.fetchall()]
    counts_after = {}
    for t in all_tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            n = cur.fetchone()[0]
            if n > 0:
                counts_after[t] = n
        except Exception:
            conn.rollback()
    cur.execute("SELECT COUNT(*) FROM auth.users")
    counts_after["auth.users"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM storage.objects")
    counts_after["storage.objects"] = cur.fetchone()[0]
    audit["counts_after"] = counts_after
    (report_dir / "counts_after.json").write_text(
        json.dumps(counts_after, indent=2)
    )

    # ── Phase 6: Final integrity check ─────────────────────────────
    checks = {}
    cur.execute(
        "SELECT id, slug, name, status FROM tenants WHERE id = %s",
        (OPERATIONAL_TENANT_ID,),
    )
    op = cur.fetchone()
    checks["operational_tenant_preserved"] = bool(op and op[3] == "active")
    checks["operational_tenant_detail"] = {
        "id": str(op[0]) if op else None,
        "slug": op[1] if op else None,
        "name": op[2] if op else None,
        "status": op[3] if op else None,
    } if op else None

    cur.execute("SELECT id, email FROM auth.users WHERE email = %s", (ADMIN_EMAIL,))
    a = cur.fetchone()
    checks["admin_auth_preserved"] = a is not None

    cur.execute("SELECT id, email, role, is_root_superadmin, tenant_id FROM users_profile WHERE email = %s", (ADMIN_EMAIL,))
    p = cur.fetchone()
    checks["admin_profile_preserved"] = p is not None
    checks["admin_profile_detail"] = {
        "id": str(p[0]) if p else None,
        "email": p[1] if p else None,
        "role": p[2] if p else None,
        "is_root_superadmin": p[3] if p else None,
        "tenant_id": str(p[4]) if p else None,
    } if p else None

    # Counts that MUST be zero
    zero_check = ["leads", "accounts", "contacts", "projects",
                  "design_journeys", "relationship_threads",
                  "relationship_messages"]
    for t in zero_check:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        checks[f"{t}_count"] = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM auth.users")
    checks["auth_users_count"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users_profile")
    checks["users_profile_count"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tenants WHERE status='active'")
    checks["active_tenants_count"] = cur.fetchone()[0]

    # CMS sanity (must be preserved)
    cur.execute("SELECT COUNT(*) FROM cms_pages")
    checks["cms_pages_count"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM cms_sections")
    checks["cms_sections_count"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM editorial_blocks")
    checks["editorial_blocks_count"] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tenant_settings WHERE tenant_id = %s",
                (OPERATIONAL_TENANT_ID,))
    checks["operational_tenant_settings_count"] = cur.fetchone()[0]

    audit["final_checks"] = checks
    log(f"final_checks: {json.dumps(checks, indent=2, default=str)}")

    (report_dir / "audit.json").write_text(json.dumps(audit, indent=2, default=str))

    cur.close()
    conn.close()
    log(f"DONE → {report_dir}")
    return report_dir


if __name__ == "__main__":
    main()
