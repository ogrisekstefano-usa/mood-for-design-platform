"""ITER141.1 · PLATFORM RESET™ + CLEAN CRM FOUNDATION

Controlled reset of demo/staging data so the platform can be experienced
as a brand-new studio.

PRESERVES (verbatim):
  • DB structure (no DROP / ALTER)
  • Atelier preset registry (atelier_dashboard_config/media/quotes for MOOD
    Demo Studio + global NULL-tenant defaults)
  • Localization registry (editorial_translations, locale_profiles,
    studio_vocabulary, studio_translation_*, tenant_dnt_registry,
    article_localizations, hotspot_locale_variants)
  • Editorial engine (editorial_masters, editorial_variants,
    editorial_revisions, editorial_composition_log, editorial_market_*,
    cultural_descriptors, cultural_edition_drafts, market_*)
  • Moodboard engine (moodboards, moodboard_*, templates, moodboard_templates)
  • Reference engine (saved_references, design_references,
    reference_collections, reference_collection_items,
    reference_locale_interpretations, curated_collections,
    brands, brand_collections, material_registry, material_assets,
    tag_registry, supplier_catalogs, media_library, media_links,
    media_collections, media_collection_items)
  • Auth + role system (users_profile, tenant_memberships — but only for
    the 3 retained users and the MOOD Demo Studio tenant)
  • Magazine/CMS content infrastructure
  • Public site portfolio (portfolio_projects, portfolio_project_variants,
    cms_pages, cms_sections, cms_assets, theme_presets, template_pages,
    template_blocks)

DELETES:
  • All accounts (CRM)
  • All contacts
  • All leads, lead_assignments
  • All projects (and their dependents)
  • All design_journeys + journey_milestones + journey_timeline_events
    + journey_artifacts + journey_health_signals + milestone_*
  • All tasks
  • All relationship_actions / affinities / inspirations / projects /
    material_affinities / engagement_signals / lookups
  • All interactions
  • All project_activity / project_notes / project_status_history /
    project_files / project_comments / project_ai_briefs
  • All proposals + proposal_*
  • All client_messages / client_preview_* / preview_tokens / collab_*
  • All notifications
  • All advisor_profiles (except retained owners) + advisor_*
  • All AI assist logs
  • All inspirations_items / inspirations_boards / inspirations_comments /
    inspirations_activity / inspiration_links
  • All non-MOOD tenants + their memberships
  • All non-retained users_profile + member_invites

Run with:
    cd /app/backend && python3 scripts/platform_reset_iter141.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

import psycopg2
import psycopg2.extras

DB_URL = os.environ['DATABASE_URL']

# Tenant + users to retain (canonical demo studio).
RETAINED_TENANT_NAMES = ('MOOD Demo Studio', 'MOOD for DESIGN', 'MOOD for DESIGN™')
RETAINED_EMAILS = (
    'demo@moodfordesign.com',
    'designer@moodfordesign.com',
    'client@moodfordesign.com',
)

# Operational tables to fully clear (TRUNCATE … CASCADE order managed by
# the dependency-resolving truncate below).
OPERATIONAL_TRUNCATE = [
    # Journey + project descendants
    'journey_timeline_events',
    'journey_artifacts',
    'journey_health_signals',
    'milestone_feedback',
    'milestone_versions',
    'journey_milestones',
    'design_journeys',
    'project_activity',
    'project_notes',
    'project_status_history',
    'project_files',
    'project_comments',
    'project_ai_briefs',
    # CRM operational
    'relationship_actions',
    'relationship_affinities',
    'relationship_inspirations',
    'relationship_projects',
    'relationship_material_affinities',
    'relationship_engagement_signals',
    'relationship_lookups',
    'interactions',
    'account_markets',
    'account_style_profile',
    'account_team_members',
    'tasks',
    # Lead funnel
    'lead_assignments',
    'leads',
    'magazine_anonymous_leads',
    'funnel_events',
    'contact_submissions',
    # Proposals
    'proposal_items',
    'proposal_signoffs',
    'proposal_market_versions',
    'proposals',
    # Client portal + collab
    'client_messages',
    'client_preview_feedback',
    'client_preview_views',
    'preview_tokens',
    'collab_comments',
    'collab_versions',
    'collab_activity',
    'collab_inspirations',
    'collab_page_status',
    'message_translations',
    # Inspirations (USER-DROPPED ones only — keep the curated registry tables)
    'inspirations_comments',
    'inspirations_activity',
    'inspirations_items',
    'inspirations_boards',
    'inspiration_links',
    # Notifications + activity feed
    'notifications',
    'analytics_events',
    'product_events',
    'product_usage_events',
    'tenant_activity_events',
    'audit_logs',
    'ai_assist_logs',
    # AI / human routing
    'human_assignment_events',
    'human_assignments',
    # Advisor demo
    'advisor_referrals',
    'advisor_activity_months',
    'advisor_commission_periods',
    'advisor_notes',
    'advisor_reports',
    # Member invites that were demo
    # (we delete after computing retained users)
]

# Tables we deliberately KEEP populated (preset registry, brand atlas,
# moodboard engine, editorial engine, etc.). Listed here for clarity —
# we never touch them.
PRESERVED = {
    # Atelier presets
    'atelier_dashboard_config', 'atelier_dashboard_media', 'atelier_dashboard_quotes',
    # Localization
    'editorial_translations', 'locale_profiles', 'studio_vocabulary',
    'studio_translation_corrections', 'studio_translation_preferences',
    'tenant_dnt_registry', 'article_localizations', 'hotspot_locale_variants',
    'message_translations',  # actually cleared above (user messages context)
    'localization_audit_runs', 'localization_overrides',
    # Editorial engine
    'editorial_masters', 'editorial_variants', 'editorial_revisions',
    'editorial_composition_log', 'editorial_market_learnings',
    'editorial_cta_clicks', 'cultural_descriptors', 'cultural_edition_drafts',
    'markets', 'market_cultural_profiles', 'market_narrative_profiles',
    'market_positioning_profiles', 'market_reference_sets',
    'market_signal_aggregates', 'market_behavior_events',
    'market_insights', 'market_submarkets',
    # Reference / Atlas engine
    'saved_references', 'design_references', 'reference_collections',
    'reference_collection_items', 'reference_locale_interpretations',
    'curated_collections', 'brands', 'brand_collections',
    'material_registry', 'material_assets', 'tag_registry',
    'supplier_catalogs', 'media_library', 'media_links',
    'media_collections', 'media_collection_items', 'media_with_usage',
    # Moodboard engine (curated studio assets stay)
    'moodboards', 'moodboard_pages', 'moodboard_elements',
    'moodboard_shares', 'moodboard_versions', 'moodboard_comments',
    'moodboard_candidates', 'moodboard_templates', 'templates',
    'template_blocks', 'template_pages',
    # Magazine / CMS
    'cms_pages', 'cms_sections', 'cms_assets', 'cms_page_revisions',
    'journal_articles', 'journal_article_blocks', 'journal_categories',
    'journal_tags', 'magazine_articles', 'magazine_paragraphs',
    'magazine_posts', 'article_category_map', 'article_tag_map',
    'article_hotspots',
    # Portfolio public
    'portfolio_projects', 'portfolio_project_variants',
    # Tenant / branding / theme
    'tenants', 'tenant_settings', 'tenant_domains', 'tenant_markets',
    'tenant_onboarding', 'tenant_memberships',  # filtered below
    'users_profile',  # filtered below
    'theme_presets', 'newsletter_subscribers',  # marketing list
    'schema_migrations', 'studio_registrations',
    # Misc
    'content_revisions', 'saved_references',
}


def truncate_safe(cur, conn, table: str):
    """TRUNCATE … RESTART IDENTITY CASCADE on a table, swallowing
    "table not found" but never silently masking dependency failures."""
    try:
        cur.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE')
        conn.commit()
        print(f'  ✓ truncated {table}')
    except psycopg2.errors.UndefinedTable:
        conn.rollback()
        print(f'  · skipped {table} (not present)')
    except Exception as e:
        conn.rollback()
        print(f'  ✗ FAILED {table} → {type(e).__name__}: {e}')


def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print('━━━ ITER141.1 · PLATFORM RESET ━━━')

    # 1. Resolve retained tenant id
    cur.execute("""
        SELECT id, name, slug FROM tenants
         WHERE name = ANY(%s)
            OR slug ILIKE '%%mood%%'
         ORDER BY created_at ASC NULLS LAST
         LIMIT 5
    """, (list(RETAINED_TENANT_NAMES),))
    candidates = cur.fetchall()
    if not candidates:
        print('✗ No MOOD tenant found — aborting reset.')
        return
    retained_tid, retained_name, retained_slug = candidates[0]
    print(f'\n→ Retained tenant: {retained_name}  [slug={retained_slug}]  [id={retained_tid}]')
    if len(candidates) > 1:
        print(f'  (other tenants matching MOOD pattern, will be deleted: {len(candidates)-1})')

    # 2. Resolve retained users
    cur.execute(
        "SELECT id, email FROM users_profile WHERE email = ANY(%s)",
        (list(RETAINED_EMAILS),),
    )
    retained_users = cur.fetchall()
    retained_user_ids = [str(r[0]) for r in retained_users]
    found_emails = {r[1] for r in retained_users}
    missing = [e for e in RETAINED_EMAILS if e not in found_emails]
    print(f'\n→ Retained users found: {len(retained_users)}/{len(RETAINED_EMAILS)}')
    for uid, em in retained_users:
        print(f'  · {em}  [id={uid}]')
    if missing:
        print(f'  ! missing emails (will be created post-reset): {missing}')

    # 3. Truncate operational tables (FK CASCADE handles inter-table refs).
    print('\n━ Truncating operational tables…')
    for t in OPERATIONAL_TRUNCATE:
        truncate_safe(cur, conn, t)

    # 4. Clean projects + accounts + contacts (CASCADE will hit the rest).
    print('\n━ Clearing core CRM entities…')
    for t in ('projects', 'accounts', 'contacts'):
        truncate_safe(cur, conn, t)

    # 5. Delete non-retained advisor profiles + memberships + users + tenants.
    print('\n━ Removing non-retained tenants/users/advisors…')
    try:
        cur.execute("DELETE FROM advisor_territories")
        cur.execute("DELETE FROM advisor_profiles")
        conn.commit()
        print('  ✓ advisor_profiles cleared')
    except Exception as e:
        conn.rollback()
        print(f'  ✗ advisor cleanup → {e}')

    try:
        cur.execute(
            "DELETE FROM member_invites WHERE tenant_id <> %s OR invited_email <> ALL(%s)",
            (str(retained_tid), list(RETAINED_EMAILS)),
        )
        conn.commit()
        print('  ✓ member_invites pruned')
    except Exception as e:
        conn.rollback()
        print(f'  · member_invites prune → {e}')

    try:
        cur.execute("""
            DELETE FROM tenant_memberships
             WHERE tenant_id <> %s OR profile_id::text <> ALL(%s::text[])
        """, (str(retained_tid), retained_user_ids if retained_user_ids else ['00000000-0000-0000-0000-000000000000']))
        conn.commit()
        print('  ✓ tenant_memberships pruned')
    except Exception as e:
        conn.rollback()
        print(f'  · tenant_memberships prune → {e}')

    try:
        cur.execute("DELETE FROM tenants WHERE id <> %s", (str(retained_tid),))
        conn.commit()
        print('  ✓ non-retained tenants deleted')
    except Exception as e:
        conn.rollback()
        print(f'  · tenants prune → {e}')

    try:
        cur.execute("""
            DELETE FROM users_profile
             WHERE id::text <> ALL(%s::text[])
        """, (retained_user_ids if retained_user_ids else ['00000000-0000-0000-0000-000000000000'],))
        conn.commit()
        print('  ✓ non-retained users_profile rows deleted')
    except Exception as e:
        conn.rollback()
        print(f'  · users prune → {e}')

    # 6. Ensure the 3 canonical users exist + are members of MOOD tenant.
    print('\n━ Ensuring 3 canonical users + memberships…')
    ROLES = {
        'demo@moodfordesign.com':     'tenant_admin',
        'designer@moodfordesign.com': 'designer',
        'client@moodfordesign.com':   'viewer',
    }
    for email, role in ROLES.items():
        cur.execute("SELECT id FROM users_profile WHERE email = %s", (email,))
        r = cur.fetchone()
        if not r:
            # Create minimal stub. Auth password is owned by Supabase Auth —
            # the platform owner is expected to create the auth user
            # separately (or to log in via demo@ and invite the others).
            cur.execute("""
                INSERT INTO users_profile (id, email, full_name, role, status)
                VALUES (gen_random_uuid(), %s, %s, %s, 'active')
                ON CONFLICT (email) DO NOTHING
                RETURNING id
            """, (email, email.split('@')[0].title(), role))
            r = cur.fetchone()
            if r:
                print(f'  + created stub user {email} [{role}]')
        else:
            cur.execute("UPDATE users_profile SET role = %s WHERE email = %s",
                        (role, email))
            print(f'  · user {email} present → role set to {role}')

        # Membership in MOOD tenant
        if r:
            uid = r[0]
            cur.execute("""
                INSERT INTO tenant_memberships (id, tenant_id, profile_id, role, status)
                VALUES (gen_random_uuid(), %s, %s, %s, 'active')
                ON CONFLICT DO NOTHING
            """, (str(retained_tid), str(uid), role))
        conn.commit()

    # 7. Verification counts
    print('\n━ Post-reset counts (expected ZERO for operational, intact for engine)…')
    VERIFY = [
        'accounts', 'contacts', 'leads', 'projects',
        'design_journeys', 'journey_milestones', 'journey_timeline_events',
        'journey_artifacts', 'tasks', 'relationship_actions',
        'project_notes', 'project_activity', 'proposals', 'notifications',
        'client_messages', 'inspirations_items', 'inspirations_boards',
        'advisor_profiles', 'tenants', 'tenant_memberships', 'users_profile',
        # Engine — should remain populated
        'editorial_masters', 'editorial_variants', 'cultural_edition_drafts',
        'moodboards', 'saved_references', 'reference_collections',
        'brands', 'material_registry', 'media_library',
        'atelier_dashboard_config', 'atelier_dashboard_quotes',
        'atelier_dashboard_media', 'editorial_translations',
        'studio_vocabulary', 'markets',
    ]
    for t in VERIFY:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}"')
            c = cur.fetchone()[0]
            print(f'  · {t:35s} : {c}')
        except Exception as e:
            print(f'  · {t:35s} : ERR {e}')
            conn.rollback()

    cur.close()
    conn.close()
    print('\n✅ Platform reset complete.')


if __name__ == '__main__':
    main()
