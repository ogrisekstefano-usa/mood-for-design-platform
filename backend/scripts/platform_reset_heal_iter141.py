"""ITER141.1 · post-reset healing — recreate the 3 canonical users_profile
rows + memberships in the MOOD Demo Showroom tenant, and finish cleanup
that the main script couldn't complete (member_invites column mismatch,
journey_artifacts view skip)."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

import psycopg2

DB_URL = os.environ['DATABASE_URL']
conn = psycopg2.connect(DB_URL)
conn.autocommit = False
cur = conn.cursor()

# 1. Resolve tenant
cur.execute("SELECT id, name, slug FROM tenants ORDER BY created_at ASC LIMIT 1")
row = cur.fetchone()
TID, TNAME, TSLUG = row
print(f'Tenant: {TNAME} [{TSLUG}] [{TID}]')

# 2. Auth users
cur.execute("SELECT id, email FROM auth.users WHERE email LIKE '%moodfordesign%'")
auth_by_email = {em: aid for aid, em in cur.fetchall()}
print(f'Auth users: {list(auth_by_email)}')

ROLES = {
    'demo@moodfordesign.com':     ('Demo', 'Studio',  'tenant_admin'),
    'designer@moodfordesign.com': ('Designer', 'Studio',  'designer'),
    'client@moodfordesign.com':   ('Client', 'Studio',  'client'),
}

# 3. Insert / update profile + membership
for email, (first, last, role) in ROLES.items():
    auth_id = auth_by_email.get(email)
    if not auth_id:
        print(f'  ! no auth.users row for {email} — skipping')
        continue
    # Manual upsert (no unique constraint on email in users_profile).
    cur.execute("SELECT id FROM users_profile WHERE email = %s", (email,))
    exist = cur.fetchone()
    if exist:
        pid = exist[0]
        cur.execute("""
            UPDATE users_profile SET
              auth_user_id = %s, tenant_id = %s,
              first_name = %s, last_name = %s, role = %s, status = 'active'
            WHERE id = %s
        """, (auth_id, str(TID), first, last, role, str(pid)))
    else:
        cur.execute("""
            INSERT INTO users_profile (auth_user_id, tenant_id, email, first_name, last_name, role, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'active')
            RETURNING id
        """, (auth_id, str(TID), email, first, last, role))
        pid = cur.fetchone()[0]
    # Membership — manual idempotent
    cur.execute("""
        SELECT id FROM tenant_memberships WHERE tenant_id = %s AND profile_id = %s
    """, (str(TID), str(pid)))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO tenant_memberships (id, tenant_id, profile_id, role, status)
            VALUES (gen_random_uuid(), %s, %s, %s, 'active')
        """, (str(TID), str(pid), role))
    print(f'  ✓ {email} → role={role} profile_id={pid}')

# 4. member_invites cleanup (correct column = 'email')
cur.execute(
    "DELETE FROM member_invites WHERE tenant_id <> %s OR email <> ALL(%s)",
    (str(TID), list(ROLES.keys())),
)
print(f'  ✓ member_invites pruned ({cur.rowcount} rows)')

# 5. Sanity check + final counts
conn.commit()
print('\n━ Final post-reset state:')
for t in [
    'tenants', 'users_profile', 'tenant_memberships', 'member_invites',
    'accounts', 'contacts', 'leads', 'projects', 'design_journeys',
    'journey_milestones', 'journey_timeline_events', 'tasks',
    'relationship_actions', 'project_notes', 'proposals', 'notifications',
    'client_messages', 'inspirations_items', 'advisor_profiles',
    # engine
    'editorial_masters', 'editorial_variants', 'cultural_edition_drafts',
    'moodboards', 'saved_references', 'brands', 'material_registry',
    'media_library', 'atelier_dashboard_config', 'atelier_dashboard_quotes',
    'atelier_dashboard_media', 'editorial_translations', 'markets',
]:
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        print(f'  · {t:35s} : {cur.fetchone()[0]}')
    except Exception as e:
        print(f'  · {t:35s} : ERR {e}')
        conn.rollback()

cur.close()
conn.close()
print('\n✅ Reset healing complete.')
