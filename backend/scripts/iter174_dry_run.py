"""ITER174 · CLEAN RESET CONTROLLED™ — DRY RUN ONLY (ZERO WRITES)

This script is strictly READ-ONLY. It produces a comprehensive snapshot of
all data that WOULD be candidate for cleanup vs. what WOULD be preserved.

NESSUNA scrittura. NESSUN UPDATE. NESSUN DELETE. NESSUN ARCHIVE.

Outputs:
  - JSON snapshot → /app/backups/iter174/dry_run_<ts>.json
  - Markdown report → /app/memory/ITER174_DRY_RUN_REPORT.md (written by caller)

Schema-validated against live DB (see /app/memory/ITER174_DRY_RUN_REPORT.md
for human-readable narrative).
"""
import json
import os
import datetime
from collections import defaultdict
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
DATABASE_URL = os.environ["DATABASE_URL"]

OPERATIONAL_TENANT_ID = "848354b9-a43e-4147-bdad-116fb93bd585"  # studio · MOOD for DESIGN
MARGRAF_TENANT_ID = "0618756f-ac41-40b0-ac10-76f882846efe"      # margraf-usa (active, vuoto)
ADMIN_EMAIL = "admin@moodfordesign.com"

# Tenant containers that are already archived (no live data)
ARCHIVED_TENANT_IDS = {
    "ffc845f0-c049-45ae-ba80-0d217aeb39c2",  # atelier-p0-final
    "f0e30282-2b15-407f-8787-c122ed97c0bc",  # studio-verifica-e2e
    "4dcfe2aa-f6aa-4a8a-992d-31c7f798c680",  # studio-tenant-lifecycle
    "62fddb8f-7b20-4b79-a252-7239e0ee809e",  # atelier-lifecycle
}

# Tables that are PURE operational/transactional client data (per-tenant)
# → all currently scoped to operational tenant, all are TEST data
DEMO_DATA_TABLES = [
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
]

# Structural/CMS/catalog tables — MUST be preserved
PRESERVE_TABLES = [
    # Tenant structural
    "tenants", "tenant_settings", "tenant_configuration",
    "tenant_atelier_identity", "tenant_email_settings",
    "tenant_markets", "tenant_modules", "tenant_onboarding",
    "tenant_domains", "tenant_dnt_registry",
    "tenant_subdomain_lookup",
    # CMS
    "cms_pages", "cms_sections", "cms_page_revisions",
    # Editorial source-of-truth
    "editorial_blocks", "editorial_block_translations",
    "editorial_translations", "editorial_masters",
    "editorial_phrases", "editorial_surfaces", "editorial_variants",
    # Atelier dashboard (CMS content)
    "atelier_dashboard_config", "atelier_dashboard_media",
    "atelier_dashboard_quotes", "atelier_presets_registry",
    "atmospheric_panels",
    # Templates / theme
    "template_blocks", "template_pages", "theme_presets",
    # Catalogs (i18n)
    "moodboard_rooms", "moodboard_chapters", "moodboard_templates",
    "moodboard_candidates",  # if 0
    "lead_intake_questions",
    "relationship_questions", "relationship_question_groups",
    "relationship_question_options", "relationship_catalog_v1",
    "relationship_intelligence_v",
    # Markets / locale
    "markets", "market_submarkets",
    "market_cultural_profiles", "market_narrative_profiles",
    "market_positioning_profiles",
    "platform_languages", "phone_dial_codes",
    "locale_profiles", "cultural_descriptors",
    # Brands / suppliers / materials
    "brands", "brand_collections",
    "supplier_catalogs",
    # Registries / governance
    "feature_modules_registry", "platform_feature_defaults",
    "tag_registry", "media_filter_presets",
    "schema_migrations", "guided_tour_config",
    "studio_translation_preferences",
    # Users (only admin preserved at row level)
    "users", "users_profile",
    # Media library (mixed — handled per-row)
    "media_library",
]


def main():
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = Path("/app/backups/iter174")
    backup_dir.mkdir(parents=True, exist_ok=True)

    report = {
        "iteration": "ITER174",
        "mode": "DRY_RUN_ONLY",
        "writes_performed": False,
        "timestamp_utc": ts,
        "operational_tenant_id": OPERATIONAL_TENANT_ID,
        "admin_email_preserved": ADMIN_EMAIL,
    }

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # ── 1 · TENANTS ────────────────────────────────────────────────────
    cur.execute("""
        SELECT id, slug, name, status, active_plan, is_demo, created_at
          FROM tenants ORDER BY created_at
    """)
    tenants = []
    for r in cur.fetchall():
        tid = str(r[0])
        # users count
        cur.execute("SELECT COUNT(*) FROM users_profile WHERE tenant_id=%s", (tid,))
        u = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM design_journeys WHERE tenant_id=%s", (tid,))
        j = cur.fetchone()[0]
        tenants.append({
            "id": tid, "slug": r[1], "name": r[2], "status": r[3],
            "active_plan": r[4], "is_demo": r[5],
            "created_at": str(r[6]),
            "users_count": u, "journeys_count": j,
            "classification": (
                "PRESERVE (operational)" if tid == OPERATIONAL_TENANT_ID
                else "DECISION REQUIRED (active, empty)" if r[3] == "active"
                else "ALREADY ARCHIVED (no live data)"
            ),
        })
    report["tenants"] = tenants

    # ── 2 · AUTH.USERS + USERS_PROFILE ────────────────────────────────
    cur.execute("""
        SELECT id, email, created_at, last_sign_in_at
          FROM auth.users ORDER BY created_at
    """)
    auth_rows = cur.fetchall()
    auth_users = []
    for r in auth_rows:
        email = r[1] or ""
        auth_users.append({
            "id": str(r[0]),
            "email": email,
            "created_at": str(r[2]),
            "last_sign_in_at": str(r[3]) if r[3] else None,
            "classification": (
                "PRESERVE (admin root)" if email == ADMIN_EMAIL
                else "DELETE (synthetic test)" if (
                    email.endswith("@example.com")
                    or email.endswith("@test.example")
                )
                else "DECISION REQUIRED (real-looking)"
            ),
        })
    report["auth_users"] = auth_users
    report["auth_users_total"] = len(auth_users)
    report["auth_users_preserve"] = [u for u in auth_users
                                     if u["classification"].startswith("PRESERVE")]
    report["auth_users_delete_synthetic"] = [u for u in auth_users
                                             if u["classification"].startswith("DELETE")]
    report["auth_users_decision_required"] = [u for u in auth_users
                                              if u["classification"].startswith("DECISION")]

    cur.execute("""
        SELECT id, auth_user_id, email, role, tenant_id, is_root_superadmin,
               first_name, last_name, created_at
          FROM users_profile ORDER BY created_at
    """)
    profiles = []
    for r in cur.fetchall():
        profiles.append({
            "id": str(r[0]),
            "auth_user_id": str(r[1]) if r[1] else None,
            "email": r[2],
            "role": r[3],
            "tenant_id": str(r[4]) if r[4] else None,
            "is_root_superadmin": r[5],
            "first_name": r[6],
            "last_name": r[7],
            "created_at": str(r[8]),
        })
    report["users_profile"] = profiles
    report["users_profile_total"] = len(profiles)

    # ── 3 · DEMO/OPERATIONAL DATA TABLES ──────────────────────────────
    demo_counts = {}
    for t in DEMO_DATA_TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            n = cur.fetchone()[0]
            demo_counts[t] = n
        except Exception as e:
            conn.rollback()
            demo_counts[t] = f"N/A ({str(e)[:60]})"
    report["demo_data_table_counts"] = demo_counts
    report["demo_data_total_rows"] = sum(v for v in demo_counts.values() if isinstance(v, int))

    # ── 4 · PRESERVE TABLES ───────────────────────────────────────────
    preserve_counts = {}
    for t in PRESERVE_TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            preserve_counts[t] = cur.fetchone()[0]
        except Exception as e:
            conn.rollback()
            preserve_counts[t] = f"N/A ({str(e)[:60]})"
    report["preserve_table_counts"] = preserve_counts

    # ── 5 · LEADS DETAIL ──────────────────────────────────────────────
    cur.execute("""
        SELECT id, first_name, email, source, status, tenant_id, created_at
          FROM leads ORDER BY created_at
    """)
    leads_detail = []
    for r in cur.fetchall():
        leads_detail.append({
            "id": str(r[0]),
            "name": r[1],
            "email": r[2],
            "source": r[3],
            "status": r[4],
            "tenant_id": str(r[5]) if r[5] else None,
            "created_at": str(r[6]),
        })
    report["leads_detail"] = leads_detail

    # ── 6 · ACCOUNTS DETAIL ───────────────────────────────────────────
    cur.execute("""
        SELECT id, account_name, account_type, lifecycle_stage, email,
               tenant_id, created_at
          FROM accounts ORDER BY created_at
    """)
    accounts_detail = []
    for r in cur.fetchall():
        accounts_detail.append({
            "id": str(r[0]),
            "account_name": r[1],
            "account_type": r[2],
            "lifecycle_stage": r[3],
            "email": r[4],
            "tenant_id": str(r[5]) if r[5] else None,
            "created_at": str(r[6]),
        })
    report["accounts_detail"] = accounts_detail

    # ── 7 · DESIGN JOURNEYS DETAIL ────────────────────────────────────
    cur.execute("""
        SELECT id, account_id, lifecycle_state, created_by, tenant_id, created_at
          FROM design_journeys ORDER BY created_at
    """)
    journeys_detail = []
    for r in cur.fetchall():
        journeys_detail.append({
            "id": str(r[0]),
            "account_id": str(r[1]) if r[1] else None,
            "lifecycle_state": r[2],
            "created_by": str(r[3]) if r[3] else None,
            "tenant_id": str(r[4]) if r[4] else None,
            "created_at": str(r[5]),
        })
    report["design_journeys_detail"] = journeys_detail

    # ── 8 · MAGIC LINKS BREAKDOWN ─────────────────────────────────────
    cur.execute("""
        SELECT email_attempt, COUNT(*),
               COUNT(consumed_at) AS consumed,
               COUNT(*) FILTER (WHERE consumed_at IS NULL) AS pending
          FROM access_magic_links
         GROUP BY email_attempt ORDER BY 2 DESC
    """)
    report["magic_links_by_email"] = [
        {"email": r[0], "total": r[1], "consumed": r[2], "pending": r[3]}
        for r in cur.fetchall()
    ]

    # ── 9 · STUDIO_REQUESTS ───────────────────────────────────────────
    cur.execute("""
        SELECT id, studio_name, contact_email, status, created_at
          FROM studio_requests ORDER BY created_at
    """)
    report["studio_requests_detail"] = [
        {"id": str(r[0]), "studio_name": r[1], "contact_email": r[2],
         "status": r[3], "created_at": str(r[4])}
        for r in cur.fetchall()
    ]

    # ── 10 · MEDIA LIBRARY CLASSIFICATION ─────────────────────────────
    cur.execute("""
        SELECT id, bucket, storage_path, category, file_size,
               uploaded_by, is_inspiration, archived_at, tenant_id, created_at
          FROM media_library ORDER BY created_at
    """)
    ml_rows = cur.fetchall()
    ml_preserve = []
    ml_candidate = []
    ml_by_category = defaultdict(int)
    ml_by_bucket = defaultdict(int)
    for r in ml_rows:
        item = {
            "id": str(r[0]),
            "bucket": r[1],
            "path": r[2],
            "category": r[3],
            "size": int(r[4]) if r[4] else None,
            "uploaded_by": str(r[5]) if r[5] else None,
            "is_inspiration": r[6],
            "archived": r[7] is not None,
            "tenant_id": str(r[8]) if r[8] else None,
            "created_at": str(r[9]),
        }
        path = (r[2] or "").lower()
        cat = (r[3] or "").lower()
        bucket = (r[1] or "").lower()
        # Classification heuristics
        is_cms_site = (
            "/site/" in path or "/storefront/" in path
            or "/brand" in path or "/logo" in path
            or bucket in ("cms-assets", "tenant-branding", "storefront-public")
            or cat in ("site", "site.home", "site.projects", "site.magazine",
                       "branding", "branding_asset", "cms_section")
        )
        if is_cms_site:
            item["classification"] = "PRESERVE (CMS/branding)"
            ml_preserve.append(item)
        else:
            item["classification"] = "CANDIDATE CLEANUP"
            ml_candidate.append(item)
        ml_by_category[r[3] or "<none>"] += 1
        ml_by_bucket[r[1] or "<none>"] += 1
    report["media_library_total"] = len(ml_rows)
    report["media_library_preserve_count"] = len(ml_preserve)
    report["media_library_candidate_count"] = len(ml_candidate)
    report["media_library_by_category"] = dict(ml_by_category)
    report["media_library_by_bucket"] = dict(ml_by_bucket)
    report["media_library_candidate_sample"] = ml_candidate[:20]
    report["media_library_preserve_sample"] = ml_preserve[:5]

    # ── 11 · STORAGE OBJECTS (deep, via storage.objects) ──────────────
    cur.execute("""
        SELECT bucket_id, name, (metadata->>'size')::bigint AS sz, created_at
          FROM storage.objects ORDER BY bucket_id, name
    """)
    storage_rows = cur.fetchall()
    storage_by_bucket = defaultdict(list)
    for r in storage_rows:
        storage_by_bucket[r[0]].append({
            "path": r[1], "size": r[2] or 0,
            "created_at": str(r[3]) if r[3] else None,
        })

    storage_report = {}
    storage_preserve_files = 0
    storage_preserve_bytes = 0
    storage_candidate_files = 0
    storage_candidate_bytes = 0
    storage_orphan_files = 0
    storage_orphan_bytes = 0
    known_tenants = {OPERATIONAL_TENANT_ID, MARGRAF_TENANT_ID} | ARCHIVED_TENANT_IDS

    for bucket, files in storage_by_bucket.items():
        preserve = []
        candidate = []
        orphan = []
        for f in files:
            p = f["path"].lower()
            # Detect tenant prefix
            seg = f["path"].split("/")[0]
            is_orphan = (len(seg) == 36 and "-" in seg and seg not in known_tenants)
            # Classification per bucket
            if bucket in ("cms-assets", "tenant-branding"):
                if is_orphan:
                    orphan.append(f)
                    storage_orphan_files += 1
                    storage_orphan_bytes += f["size"]
                else:
                    preserve.append(f)
                    storage_preserve_files += 1
                    storage_preserve_bytes += f["size"]
            elif bucket == "storefront-public":
                # All storefront-public belong to orphan tenant 81a09ead...
                if is_orphan:
                    orphan.append(f)
                    storage_orphan_files += 1
                    storage_orphan_bytes += f["size"]
                else:
                    preserve.append(f)
                    storage_preserve_files += 1
                    storage_preserve_bytes += f["size"]
            elif bucket == "tenant-assets":
                # brand/logo → preserve; atelier-media/* → demo
                if "/brand/" in p or "/storefront/" in p:
                    preserve.append(f)
                    storage_preserve_files += 1
                    storage_preserve_bytes += f["size"]
                else:
                    candidate.append(f)
                    storage_candidate_files += 1
                    storage_candidate_bytes += f["size"]
            elif bucket == "media":
                # /brand/ favicons & logo → preserve
                if "/brand/" in p:
                    preserve.append(f)
                    storage_preserve_files += 1
                    storage_preserve_bytes += f["size"]
                else:
                    candidate.append(f)
                    storage_candidate_files += 1
                    storage_candidate_bytes += f["size"]
            else:
                candidate.append(f)
                storage_candidate_files += 1
                storage_candidate_bytes += f["size"]

        storage_report[bucket] = {
            "total_files": len(files),
            "total_bytes": sum(x["size"] for x in files),
            "preserve_files": len(preserve),
            "preserve_bytes": sum(x["size"] for x in preserve),
            "candidate_files": len(candidate),
            "candidate_bytes": sum(x["size"] for x in candidate),
            "orphan_files": len(orphan),
            "orphan_bytes": sum(x["size"] for x in orphan),
            "preserve_sample": preserve[:5],
            "candidate_sample": candidate[:5],
            "orphan_sample": orphan[:5],
        }
    report["storage_buckets"] = storage_report
    report["storage_totals"] = {
        "preserve_files": storage_preserve_files,
        "preserve_bytes": storage_preserve_bytes,
        "preserve_mb": round(storage_preserve_bytes / (1024 * 1024), 2),
        "candidate_files": storage_candidate_files,
        "candidate_bytes": storage_candidate_bytes,
        "candidate_mb": round(storage_candidate_bytes / (1024 * 1024), 2),
        "orphan_files": storage_orphan_files,
        "orphan_bytes": storage_orphan_bytes,
        "orphan_mb": round(storage_orphan_bytes / (1024 * 1024), 2),
    }

    # ── 12 · ALL NON-EMPTY TABLES SNAPSHOT ────────────────────────────
    cur.execute("""
        SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' ORDER BY table_name
    """)
    all_tables = [r[0] for r in cur.fetchall()]
    all_counts = {}
    for t in all_tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            n = cur.fetchone()[0]
            if n > 0:
                all_counts[t] = n
        except Exception:
            conn.rollback()
    report["all_public_tables_with_rows"] = all_counts
    report["all_public_tables_with_rows_count"] = len(all_counts)

    # Save snapshot
    out = backup_dir / f"dry_run_{ts}.json"
    out.write_text(json.dumps(report, indent=2, default=str))
    print(f"[DRY-RUN] snapshot saved → {out}")
    print(f"[DRY-RUN] writes performed: NONE")

    cur.close()
    conn.close()
    return report, str(out)


if __name__ == "__main__":
    main()
