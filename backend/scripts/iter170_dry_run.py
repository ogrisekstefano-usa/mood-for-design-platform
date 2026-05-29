"""ITER170 · Platform Data Cleanup™ — DRY RUN REPORT v2 (zero destructive).

Generates a complete, deeply-recursive read-only audit:
  1. Pre-state counts of EVERY table in DEMO_TABLES + PRESERVE_TABLES
  2. List of auth.users + users_profile that would be deleted (vs preserved)
  3. Admin preservation confirmation (admin@moodfordesign.com)
  4. Catalog sanity check (CMS / locales / dial codes / rooms / chapters)
  5. Supabase Storage manifest (deep recursion, per-bucket + per-tenant +
     classified system vs demo)

Outputs:
  - JSON  → /app/backups/iter170/dry_run_<ts>.json
  - HUMAN → stdout
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
    "email_events", "login_attempts",
    "funnel_events", "product_events",
    "market_behavior_events", "market_signal_aggregates",
    "designer_presence", "user_onboarding_state",
    "reference_collections", "media_links",
]

PRESERVE_TABLES = [
    "tenants", "tenant_settings", "tenant_configuration",
    "tenant_atelier_identity", "tenant_dnt_registry", "tenant_domains",
    "tenant_email_settings", "tenant_markets", "tenant_onboarding",
    "studio_translation_preferences",
    "markets", "market_submarkets", "market_cultural_profiles",
    "market_narrative_profiles", "market_positioning_profiles",
    "platform_languages", "phone_dial_codes",
    "moodboard_rooms", "moodboard_chapters", "moodboard_templates",
    "editorial_blocks", "editorial_block_translations",
    "editorial_translations", "editorial_masters", "editorial_phrases",
    "editorial_surfaces", "editorial_variants",
    "cms_pages", "cms_sections", "cms_page_revisions",
    "template_blocks", "template_pages", "theme_presets", "tag_registry",
    "feature_modules_registry", "platform_feature_defaults",
    "locale_profiles", "cultural_descriptors",
    "reference_locale_interpretations",
    "lead_intake_questions", "relationship_questions",
    "relationship_question_groups", "relationship_question_options",
    "guided_tour_config", "media_filter_presets",
    "media_library", "supplier_catalogs",
    "schema_migrations",
    "users", "users_profile",
]


def safe_count(cur, conn, table):
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        return cur.fetchone()[0]
    except Exception as e:
        conn.rollback()
        return f"N/A ({str(e).strip().splitlines()[0][:60]})"


def list_storage_buckets():
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    h = {"apikey": SUPABASE_SERVICE_KEY,
         "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
    r = requests.get(url, headers=h, timeout=15)
    r.raise_for_status()
    return r.json()


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
    """Recursive deep walk returning a flat list of file objects."""
    if files is None:
        files = []
    if depth > max_depth:
        return files
    objs = list_bucket_objects(bucket, prefix)
    for o in objs:
        name = o.get("name")
        if not name:
            continue
        full = (prefix + name) if prefix else name
        if o.get("id") is None:
            walk_bucket(bucket, full + "/", depth + 1, max_depth, files)
        else:
            files.append({
                "path": full,
                "size": (o.get("metadata") or {}).get("size", 0),
                "updated_at": o.get("updated_at"),
            })
    return files


def classify_storage_path(bucket, path):
    """Returns ('system'|'demo', sub-classification)."""
    p = path.lower()
    if "/brand/" in p or "/logo/" in p or "/favicon" in p:
        return "system", "branding"
    if bucket == "magazine-media":
        return "system", "magazine"
    if bucket == "tenant-branding":
        return "system", "branding"
    if "/storefront/" in p and ("/hero" in p or "/logo" in p or "/brand" in p):
        return "system", "storefront"
    if "/storefront/" in p:
        return "system", "storefront"  # storefront uploaded by admin (CMS)
    if "/catalogs/" in p:
        return "demo", "supplier_catalog"  # suppliers will need re-upload
    if "/journal/" in p:
        return "demo", "journal"
    if "/moodboards/" in p:
        return "demo", "moodboard"
    if "/atelier-media/" in p or bucket == "atelier-media" or "atelier-media" in p:
        return "demo", "atelier"
    if "/crm-voice-notes/" in p:
        return "demo", "voice_note"
    if "/avatars/" in p or bucket == "avatars":
        return "demo", "avatar"
    return "demo", "other"


def main():
    backup_dir = Path("/app/backups/iter170")
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    print(f"📂 backup_dir = {backup_dir}")
    print(f"⏰ timestamp  = {ts}")
    print(f"🛡️  DRY RUN — no rows will be modified.\n")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    report = {"timestamp": ts, "mode": "dry_run",
              "admin_email_preserved": ADMIN_EMAIL}

    # 0 · Tenants
    cur.execute("SELECT id, slug, name FROM tenants ORDER BY created_at")
    tenants = [{"id": str(r[0]), "slug": r[1], "name": r[2]} for r in cur.fetchall()]
    report["tenants"] = tenants
    print("0.  TENANTS (preserved):")
    for t in tenants:
        print(f"   • {t['slug']:40} {t['name']}")
        print(f"     id = {t['id']}")
    print()

    # 1 · DEMO tables
    print("═" * 78)
    print("1.  TABELLE CHE VERREBBERO SVUOTATE (TRUNCATE CASCADE)")
    print("═" * 78)
    demo_counts = {}
    total_to_delete = 0
    for t in DEMO_TABLES:
        c = safe_count(cur, conn, t)
        demo_counts[t] = c
        if isinstance(c, int):
            total_to_delete += c
            flag = "🟥" if c > 0 else "  "
        else:
            flag = "❔"
        print(f"   {flag} {t:48} {c}")
    report["demo_tables_to_truncate"] = demo_counts
    report["demo_rows_total_to_delete"] = total_to_delete
    print(f"\n   ➜ TOTALE righe da eliminare: {total_to_delete}\n")

    # 2 · Preserve tables
    print("═" * 78)
    print("2.  TABELLE PRESERVATE (NON toccate)")
    print("═" * 78)
    preserve_counts = {}
    for t in PRESERVE_TABLES:
        c = safe_count(cur, conn, t)
        preserve_counts[t] = c
        flag = "🟩" if isinstance(c, int) and c > 0 else "⬜"
        print(f"   {flag} {t:48} {c}")
    report["preserve_tables"] = preserve_counts

    # 3 · auth.users + users_profile
    print("\n" + "═" * 78)
    print("3.  UTENTI")
    print("═" * 78)
    cur.execute(
        "SELECT id, email, role, created_at FROM auth.users ORDER BY created_at"
    )
    auth_rows = cur.fetchall()
    auth_users = [{"id": str(r[0]), "email": r[1],
                   "role": r[2], "created_at": str(r[3])}
                  for r in auth_rows]
    keep_auth = [u for u in auth_users if u["email"] == ADMIN_EMAIL]
    del_auth = [u for u in auth_users if u["email"] != ADMIN_EMAIL]
    report.update({
        "auth_users_total": len(auth_users),
        "auth_users_keep": keep_auth,
        "auth_users_delete_count": len(del_auth),
        "auth_users_delete_sample": del_auth[:20],
    })
    print(f"   auth.users TOTALE          : {len(auth_users)}")
    print(f"   auth.users DA PRESERVARE   : {len(keep_auth)}")
    print(f"   auth.users DA ELIMINARE    : {len(del_auth)}")
    print(f"\n   ✅ PRESERVATI ({len(keep_auth)}):")
    for u in keep_auth:
        print(f"      ✔ {u['email']:42} role={u['role']:14} id={u['id']}")
    # Breakdown delete by domain prefix
    domains = {}
    for u in del_auth:
        dom = (u["email"] or "<none>").split("@")[-1]
        domains[dom] = domains.get(dom, 0) + 1
    print(f"\n   🟥 ELIMINATI {len(del_auth)} — breakdown per dominio:")
    for d, c in sorted(domains.items(), key=lambda x: -x[1]):
        print(f"      {d:35} {c:>4} users")

    # Highlight non-test real emails (not @example.com / @moodfordesign.com)
    suspicious = [u for u in del_auth
                  if u["email"]
                  and not u["email"].endswith("@example.com")
                  and not u["email"].endswith("@moodfordesign.com")]
    print(f"\n   ⚠ REAL-LOOKING EMAILS che verrebbero cancellate ({len(suspicious)}):")
    for u in suspicious:
        print(f"      ⚠ {u['email']:50} id={u['id'][:8]}…")
    report["auth_users_real_emails_to_delete"] = suspicious

    # users_profile
    cur.execute("""
        SELECT id, email, role, first_name, last_name, tenant_id, is_root_superadmin
          FROM users_profile ORDER BY created_at
    """)
    prof_rows = cur.fetchall()
    profs = [{"id": str(r[0]), "email": r[1], "role": r[2],
              "first_name": r[3], "last_name": r[4],
              "tenant_id": str(r[5]) if r[5] else None,
              "is_root_superadmin": r[6]} for r in prof_rows]
    keep_p = [p for p in profs if p["email"] == ADMIN_EMAIL]
    del_p = [p for p in profs if p["email"] != ADMIN_EMAIL]
    report.update({
        "users_profile_total": len(profs),
        "users_profile_keep": keep_p,
        "users_profile_delete_count": len(del_p),
    })
    print(f"\n   users_profile TOTALE       : {len(profs)}")
    print(f"   users_profile DA PRESERVARE: {len(keep_p)}")
    print(f"   users_profile DA ELIMINARE : {len(del_p)}")
    for p in keep_p:
        print(f"      ✔ {p['email']:42} role={p['role']:14} "
              f"root={p['is_root_superadmin']} tenant={(p['tenant_id'] or '?')[:8]}…")

    # 4 · Catalog Sanity
    print("\n" + "═" * 78)
    print("4.  CATALOG SANITY (must remain intact)")
    print("═" * 78)
    catalogs = [
        ("platform_languages",    "mercati linguistici operativi"),
        ("phone_dial_codes",      "196 paesi ISO 3166"),
        ("moodboard_rooms",       "catalogo stanze i18n"),
        ("moodboard_chapters",    "catalogo capitoli i18n"),
        ("editorial_blocks",      "CMS source-of-truth"),
        ("editorial_translations","traduzioni ALE"),
        ("cms_pages",             "pagine pubbliche"),
        ("cms_sections",          "sezioni storefront"),
        ("markets",               "mercati globali"),
        ("tenants",               "studio container"),
        ("tenant_settings",       "branding + theme"),
        ("schema_migrations",     "migration history"),
    ]
    for tbl, desc in catalogs:
        c = preserve_counts.get(tbl, "N/A")
        flag = "✅" if isinstance(c, int) and c > 0 else "⚠️"
        print(f"   {flag} {tbl:30} {str(c):>8}   {desc}")

    # 5 · Storage manifest (DEEP)
    print("\n" + "═" * 78)
    print("5.  SUPABASE STORAGE MANIFEST (deep recursion)")
    print("═" * 78)
    storage = {}
    grand_total_files = 0
    grand_total_bytes = 0
    grand_system_files = 0
    grand_demo_files = 0
    try:
        buckets = list_storage_buckets()
        for b in buckets:
            bname = b["name"]
            files = walk_bucket(bname)
            bucket_summary = {
                "total_files": len(files),
                "total_bytes": sum(f["size"] or 0 for f in files),
                "by_class": {"system": [], "demo": []},
                "by_category": {},
                "by_tenant": {},
            }
            for f in files:
                klass, cat = classify_storage_path(bname, f["path"])
                bucket_summary["by_class"][klass].append({
                    "path": f["path"], "size": f["size"], "category": cat})
                bucket_summary["by_category"][cat] = (
                    bucket_summary["by_category"].get(cat, 0) + 1)
                # extract tenant uuid prefix if first segment is uuid
                seg = f["path"].split("/")[0]
                if len(seg) == 36 and "-" in seg:
                    bucket_summary["by_tenant"][seg] = (
                        bucket_summary["by_tenant"].get(seg, 0) + 1)
            storage[bname] = {
                "total_files": bucket_summary["total_files"],
                "total_bytes": bucket_summary["total_bytes"],
                "system_count": len(bucket_summary["by_class"]["system"]),
                "demo_count": len(bucket_summary["by_class"]["demo"]),
                "by_category": bucket_summary["by_category"],
                "by_tenant": bucket_summary["by_tenant"],
                # Cap detail dumps
                "system_files_sample": bucket_summary["by_class"]["system"][:30],
                "demo_files_sample": bucket_summary["by_class"]["demo"][:30],
            }
            grand_total_files += bucket_summary["total_files"]
            grand_total_bytes += bucket_summary["total_bytes"]
            grand_system_files += len(bucket_summary["by_class"]["system"])
            grand_demo_files += len(bucket_summary["by_class"]["demo"])
            mb = bucket_summary["total_bytes"] / (1024 * 1024)
            print(f"\n   📦 {bname}")
            print(f"      total : {bucket_summary['total_files']:>4} files / {mb:>8.2f} MB")
            print(f"      system: {storage[bname]['system_count']:>4} files")
            print(f"      demo  : {storage[bname]['demo_count']:>4} files")
            for cat, n in sorted(storage[bname]["by_category"].items(),
                                  key=lambda x: -x[1]):
                print(f"         · {cat:20} {n:>4}")
            if storage[bname]["by_tenant"]:
                print(f"      per-tenant:")
                for tid, n in storage[bname]["by_tenant"].items():
                    print(f"         · {tid} → {n} files")
    except Exception as e:
        print(f"   ⚠ Storage non leggibile: {e}")
    report["storage"] = storage
    report["storage_grand_total_files"] = grand_total_files
    report["storage_grand_total_mb"] = round(grand_total_bytes / (1024 * 1024), 2)
    report["storage_system_files"] = grand_system_files
    report["storage_demo_files"] = grand_demo_files

    print("\n   ───── TOTALI STORAGE ─────")
    print(f"   files          : {grand_total_files}")
    print(f"   total size     : {grand_total_bytes / (1024*1024):.2f} MB")
    print(f"   system files   : {grand_system_files}")
    print(f"   demo files     : {grand_demo_files}")

    # Save JSON
    out = backup_dir / f"dry_run_{ts}.json"
    out.write_text(json.dumps(report, indent=2, default=str))
    print(f"\n✅ DRY-RUN COMPLETO. JSON: {out}")
    print(f"   Nessun dato modificato.\n")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
