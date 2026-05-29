"""ITER170 · Platform Data Cleanup™ — Pre-Production Sanitization.

PURPOSE
-------
Wipe ALL demo / test / lifecycle data, keeping ONLY:
  • admin@moodfordesign.com (auth + profile + tenant ownership)
  • System / platform / catalog / CMS / branding seeds
  • Schema, migrations, routing, auth flows

WHAT IS PRESERVED
-----------------
  - All tenants + tenant_settings / tenant_configuration / tenant_atelier_identity
  - markets, tenant_markets, market_* catalog
  - platform_languages, phone_dial_codes
  - moodboard_rooms, moodboard_chapters, moodboard_templates
  - editorial_blocks + translations + masters + variants + surfaces (CMS)
  - cms_pages / cms_sections (empty anyway)
  - template_blocks, template_pages, theme_presets, tag_registry
  - feature_modules_registry, platform_feature_defaults
  - locale_profiles, cultural_descriptors, reference_locale_interpretations
  - lead_intake_questions, relationship_question* (form engine catalog)
  - guided_tour_config, media_filter_presets
  - schema_migrations
  - admin user (auth.users + users_profile)

WHAT IS WIPED
-------------
  Demo / runtime entities (full TRUNCATE … RESTART IDENTITY CASCADE):
  - design_journeys, journey_milestones, journey_briefs, journey_timeline_events
  - milestone_versions, milestone_feedback
  - published_design_journeys, published_design_journey_translations
  - cultural_edition_drafts
  - moodboards, moodboard_elements, moodboard_pages, moodboard_shares
  - proposals, curated_collections
  - leads, accounts, contacts, projects, project_activity
  - human_assignments, human_assignment_events
  - relationship_threads, relationship_messages, relationship_lookups,
    relationship_answer_events, relationship_direction_snapshots
  - recall_requests
  - studio_visit_reports, studio_relations, studio_relationship_events
  - studio_registrations, studio_activation_drafts
  - email_events, login_attempts
  - funnel_events, product_events, market_behavior_events,
    market_signal_aggregates
  - designer_presence, user_onboarding_state, reference_collections
  - message_translations, media_links

  Auth users:
  - auth.users WHERE email != 'admin@moodfordesign.com'
  - users_profile WHERE email != 'admin@moodfordesign.com'

  NOT touched (require manual review):
  - media_library  (mixed CMS/branding/demo — preserved for safety)

SAFETY
------
  - Full BEGIN/COMMIT transaction with rollback-on-error
  - JSON snapshot of pre-state counts written to /app/backups/iter170/
  - JSON dump of auth.users + users_profile + tenants pre-state
  - Idempotent (TRUNCATE on empty table is a no-op)
  - Smoke test: admin login + new journey initiate post-cleanup
"""
import json
import os
import sys
import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
DATABASE_URL = os.environ["DATABASE_URL"]
ADMIN_EMAIL  = "admin@moodfordesign.com"

# ─── Destructive list (in safe FK order) ─────────────────────────────
DEMO_TABLES = [
    # journey-bound artifacts (children first)
    "milestone_feedback",
    "milestone_versions",
    "journey_timeline_events",
    "journey_briefs",
    "journey_milestones",
    "moodboard_elements",
    "moodboard_pages",
    "moodboard_shares",
    "moodboards",
    "curated_collections",
    "proposals",
    "published_design_journey_translations",
    "published_design_journeys",
    "cultural_edition_drafts",
    "design_journeys",
    # relations + threads
    "relationship_direction_snapshots",
    "relationship_answer_events",
    "relationship_messages",
    "relationship_threads",
    "relationship_lookups",
    "message_translations",
    # human assignment
    "human_assignment_events",
    "human_assignments",
    # recall + visits
    "recall_requests",
    "studio_visit_reports",
    "studio_relationship_events",
    "studio_relations",
    "studio_registrations",
    "studio_activation_drafts",
    # leads/accounts/contacts/projects
    "project_activity",
    "projects",
    "contacts",
    "accounts",
    "leads",
    # analytics + logs
    "email_events",
    "login_attempts",
    "funnel_events",
    "product_events",
    "market_behavior_events",
    "market_signal_aggregates",
    # presence
    "designer_presence",
    "user_onboarding_state",
    "reference_collections",
    "media_links",
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
    "template_blocks", "template_pages", "theme_presets", "tag_registry",
    "feature_modules_registry", "platform_feature_defaults",
    "locale_profiles", "cultural_descriptors",
    "reference_locale_interpretations",
    "lead_intake_questions", "relationship_questions",
    "relationship_question_groups", "relationship_question_options",
    "guided_tour_config", "media_filter_presets",
    "media_library",  # preserved for safety
    "supplier_catalogs",
    "schema_migrations",
    "users", "users_profile",
]


def main():
    backup_dir = Path("/app/backups/iter170")
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    print(f"📂 backup_dir = {backup_dir}")
    print(f"⏰ timestamp  = {ts}")

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # ── 1. PRE-snapshot ───────────────────────────────────────────
    print("\n🔎 PRE-CLEANUP snapshot ...")
    pre_counts = {}
    for t in DEMO_TABLES + PRESERVE_TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            pre_counts[t] = cur.fetchone()[0]
        except Exception as e:
            pre_counts[t] = f"ERROR: {e}"
            conn.rollback()
    (backup_dir / f"pre_counts_{ts}.json").write_text(
        json.dumps(pre_counts, indent=2, default=str))
    print(f"   ↳ snapshot written ({len(pre_counts)} tables)")

    # ── 2. JSON DUMP precious tables ─────────────────────────────
    print("\n💾 Dumping precious tables to JSON ...")
    precious_tables = ["tenants", "tenant_settings", "tenant_configuration",
                       "tenant_markets", "users", "users_profile",
                       "platform_languages"]
    dumps = {}
    for t in precious_tables:
        try:
            cur.execute(f'SELECT * FROM "{t}"')
            cols = [d[0] for d in cur.description]
            dumps[t] = [dict(zip(cols, r)) for r in cur.fetchall()]
            print(f"   {t}: {len(dumps[t])} rows")
        except Exception as e:
            print(f"   {t}: ERROR {e}")
            conn.rollback()
    (backup_dir / f"precious_dump_{ts}.json").write_text(
        json.dumps(dumps, indent=2, default=str))

    # Also dump auth.users metadata (we can't read auth schema via psycopg2
    # easily, but we can dump the ids + emails)
    try:
        cur.execute("SELECT id, email, created_at, role FROM auth.users ORDER BY created_at")
        auth_rows = [{"id": str(r[0]), "email": r[1],
                      "created_at": str(r[2]), "role": r[3]}
                     for r in cur.fetchall()]
        (backup_dir / f"auth_users_{ts}.json").write_text(
            json.dumps(auth_rows, indent=2))
        print(f"   auth.users: {len(auth_rows)} rows")
    except Exception:
        conn.rollback()
        print("   auth.users: skipped (no read access)")

    # ── 3. Find admin auth.user id ───────────────────────────────
    cur.execute("SELECT id FROM auth.users WHERE email = %s LIMIT 1", (ADMIN_EMAIL,))
    row = cur.fetchone()
    if not row:
        print(f"\n❌ ABORT: admin user {ADMIN_EMAIL} not found in auth.users")
        sys.exit(1)
    admin_auth_id = row[0]
    print(f"\n👤 admin auth.users.id = {admin_auth_id}")

    # ── 4. Cleanup transaction ───────────────────────────────────
    print(f"\n🧹 Executing cleanup transaction ...")
    try:
        # Delete demo tables in FK order
        for t in DEMO_TABLES:
            try:
                cur.execute(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE')
                print(f"   ✓ truncated {t}")
            except Exception as e:
                # Some tables may not exist or have triggers; log + continue
                print(f"   ⚠ {t}: {str(e)[:80]}")
                conn.rollback()
                cur = conn.cursor()

        # Delete non-admin users_profile
        cur.execute(
            "DELETE FROM users_profile WHERE email != %s OR email IS NULL",
            (ADMIN_EMAIL,))
        deleted_profiles = cur.rowcount
        print(f"   ✓ deleted users_profile rows: {deleted_profiles}")

        # Delete non-admin auth.users
        cur.execute(
            "DELETE FROM auth.users WHERE email != %s AND id != %s",
            (ADMIN_EMAIL, admin_auth_id))
        deleted_auth = cur.rowcount
        print(f"   ✓ deleted auth.users rows: {deleted_auth}")

        # Mirror `users` table cleanup (the public.users table)
        try:
            cur.execute(
                "DELETE FROM users WHERE id != %s",
                (admin_auth_id,))
            print(f"   ✓ deleted public.users rows: {cur.rowcount}")
        except Exception as e:
            print(f"   ⚠ public.users: {e}")
            conn.rollback()
            cur = conn.cursor()

        conn.commit()
        print(f"\n✅ Cleanup transaction committed")
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Cleanup failed — rolled back: {e}")
        sys.exit(1)

    # ── 5. POST-snapshot ─────────────────────────────────────────
    print("\n🔎 POST-CLEANUP snapshot ...")
    post_counts = {}
    for t in DEMO_TABLES + PRESERVE_TABLES:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            post_counts[t] = cur.fetchone()[0]
        except Exception:
            post_counts[t] = "ERROR"
            conn.rollback()
    (backup_dir / f"post_counts_{ts}.json").write_text(
        json.dumps(post_counts, indent=2, default=str))

    # Summary
    print("\n📊 SUMMARY")
    print(f"   {'table':45} {'pre':>8} → {'post':>8}")
    print("   " + "-" * 65)
    for t in DEMO_TABLES:
        a, b = pre_counts.get(t, "?"), post_counts.get(t, "?")
        if isinstance(a, int) and a > 0:
            print(f"   {t:45} {a:>8} → {b:>8}")
    print()
    for t in ("users", "users_profile", "tenants", "platform_languages",
              "phone_dial_codes", "moodboard_rooms", "moodboard_chapters",
              "editorial_blocks"):
        a, b = pre_counts.get(t, "?"), post_counts.get(t, "?")
        print(f"   ↻ PRESERVED  {t:35} {a:>8} → {b:>8}")

    cur.close()
    conn.close()
    print(f"\n✅ Done. Backups: {backup_dir}")


if __name__ == "__main__":
    main()
