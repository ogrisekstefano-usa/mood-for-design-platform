"""ITER143C · ROOT SUPERADMIN™ provisioning.

Idempotent script that:
  1. Ensures `admin@moodfordesign.com` exists in Supabase auth + users_profile.
  2. Sets `is_root_superadmin = TRUE` on that profile (DB unique constraint
     guarantees there can only ever be ONE active root).
  3. Demotes any other profile that may have the flag (safety).

Password policy
───────────────
We NEVER hardcode the initial password in source. Two modes:

  • If `ROOT_SUPERADMIN_INITIAL_PASSWORD` env var is set → use it.
  • Else → generate a strong random password, PRINT IT ONCE, and the
    operator must persist it via the password-reset flow within the
    next session. The script logs the value to stdout, never to a file.

Usage:
    ROOT_SUPERADMIN_INITIAL_PASSWORD='YourS3cret!' \\
      python3 /app/backend/scripts/provision_root_superadmin.py

    # OR (one-shot, prints generated password):
    python3 /app/backend/scripts/provision_root_superadmin.py
"""
from __future__ import annotations

import os
import secrets
import string
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import db, db_available, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


ROOT_EMAIL = 'admin@moodfordesign.com'


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_password() -> str:
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    return ''.join(secrets.choice(alphabet) for _ in range(24))


def _create_auth_user(email: str, password: str):
    """Create auth.users via Supabase admin client."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        raise RuntimeError("Supabase URL or service role key not configured")
    from supabase import create_client
    c = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    resp = c.auth.admin.create_user({
        'email': email,
        'password': password,
        'email_confirm': True,
        'user_metadata': {'role': 'super_admin', 'platform_root': True},
    })
    return getattr(resp, 'user', None) or resp


def _find_auth_user_id(email: str):
    """Find auth.users.id for the given email via the admin client."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return None
    from supabase import create_client
    c = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    # supabase-py 2.x: admin.list_users() returns a page of users
    try:
        page = c.auth.admin.list_users()
        users = getattr(page, 'users', None) or page or []
        for u in users:
            if (getattr(u, 'email', None) or '').lower() == email.lower():
                return getattr(u, 'id', None)
    except Exception as e:
        print(f"  ! auth list failed: {e}")
    return None


def provision() -> dict:
    if not db_available():
        raise RuntimeError("Supabase admin client not available")
    c = db()
    # 1. Look up the existing profile.
    prof_rows = (c.table('users_profile')
                 .select('id, auth_user_id, email, role, is_root_superadmin, tenant_id')
                 .ilike('email', ROOT_EMAIL).limit(1).execute().data or [])
    profile = prof_rows[0] if prof_rows else None

    auth_user_id = None
    initial_password = None

    if profile:
        auth_user_id = profile['auth_user_id']
        print(f"✓ users_profile row exists for {ROOT_EMAIL} (id={profile['id']})")
    else:
        # 2a. Try to find an existing auth.users entry first.
        auth_user_id = _find_auth_user_id(ROOT_EMAIL)
        if auth_user_id:
            print(f"✓ Existing auth.users record found for {ROOT_EMAIL}")
        else:
            # 2b. Create a brand-new auth user.
            initial_password = os.environ.get('ROOT_SUPERADMIN_INITIAL_PASSWORD') or _gen_password()
            user = _create_auth_user(ROOT_EMAIL, initial_password)
            auth_user_id = getattr(user, 'id', None) or (user.get('id') if isinstance(user, dict) else None)
            if not auth_user_id:
                raise RuntimeError("Failed to extract auth user id from Supabase response")
            print(f"✓ Created auth.users for {ROOT_EMAIL}")

        # Find the canonical Golden Demo Tenant™ (slug='studio' after
        # ITER143D rename — previously 'mood-demo').
        tenant_row = (c.table('tenants').select('id, slug')
                      .eq('slug', 'studio').limit(1).execute().data or [])
        if not tenant_row:
            tenant_row = (c.table('tenants').select('id, slug')
                          .limit(1).execute().data or [])
        if not tenant_row:
            raise RuntimeError("No tenant row available to anchor root profile")
        tenant_id = tenant_row[0]['id']
        # Create profile.
        profile_id = str(uuid.uuid4())
        c.table('users_profile').insert({
            'id': profile_id,
            'auth_user_id': auth_user_id,
            'tenant_id': tenant_id,
            'email': ROOT_EMAIL,
            'first_name': 'MOOD',
            'last_name': 'Root',
            'role': 'super_admin',
            'status': 'active',
            'is_root_superadmin': False,  # flipped in the freeze step
            'created_at': _now(),
            'updated_at': _now(),
        }).execute()
        profile = {'id': profile_id, 'auth_user_id': auth_user_id,
                   'email': ROOT_EMAIL, 'role': 'super_admin',
                   'tenant_id': tenant_id, 'is_root_superadmin': False}
        print(f"✓ Created users_profile row id={profile_id}")

    # 3. Demote any other rows that might have the flag (safety / partial idx).
    others = (c.table('users_profile')
              .select('id, email')
              .eq('is_root_superadmin', True)
              .neq('id', profile['id']).execute().data or [])
    for o in others:
        c.table('users_profile').update({
            'is_root_superadmin': False, 'updated_at': _now(),
        }).eq('id', o['id']).execute()
        print(f"  ! demoted previous root: {o.get('email')} (id={o['id']})")

    # 4. Promote canonical row.
    if not profile.get('is_root_superadmin'):
        c.table('users_profile').update({
            'is_root_superadmin': True,
            'role': 'super_admin',
            'updated_at': _now(),
        }).eq('id', profile['id']).execute()
        print(f"✓ Promoted {ROOT_EMAIL} → is_root_superadmin=TRUE")
    else:
        print(f"✓ Already root_superadmin")

    return {
        'profile_id':       profile['id'],
        'auth_user_id':     auth_user_id,
        'email':            ROOT_EMAIL,
        'initial_password': initial_password,  # only set on fresh create
    }


def main() -> int:
    print(f"🔒 ITER143C · provisioning ROOT SUPERADMIN ({ROOT_EMAIL})")
    out = provision()
    print()
    print("── Summary ─────────────────────────────────")
    print(f"  email      : {out['email']}")
    print(f"  profile_id : {out['profile_id']}")
    if out['initial_password']:
        print(f"  password   : {out['initial_password']}")
        print()
        print("  ⚠️  Save this password NOW. It is shown ONCE.")
        print("      Then change it via /auth/forgot-password.")
    else:
        print(f"  password   : (not changed; existing credential preserved)")
    return 0


if __name__ == '__main__':
    sys.exit(main())
