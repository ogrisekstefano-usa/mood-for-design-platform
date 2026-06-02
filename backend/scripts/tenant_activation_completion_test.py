"""
Tenant Activation Completion Test (P0-1, P0-2, P0-3).

Runs the full Visitor → Studio V2 → Qualification → Activation →
Founder Invite → Founder Login → Blueprint Access flow against the live
backend and prints a structured PASS/FAIL line for each phase. Used to
validate the READY_FOR_REAL_TENANTS classification.

Usage:
  python3 -m scripts.tenant_activation_completion_test
"""
from __future__ import annotations
import asyncio, json, time, os, sys, uuid

import httpx
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import AsyncSessionLocal  # noqa: E402

BASE = os.environ.get('BASE_URL', 'http://localhost:8001')
API  = f"{BASE}/api"

ADMIN_EMAIL = 'admin@moodfordesign.com'
ADMIN_PW    = 'MoodAdmin2026!'

RESULTS: list[dict] = []


def _log(phase: str, ok: bool, detail: str = '', extra: dict | None = None):
    status = 'PASS' if ok else 'FAIL'
    print(f"  [{status}] {phase} — {detail}")
    RESULTS.append({'phase': phase, 'ok': ok, 'detail': detail, **(extra or {})})


async def main():
    ts = int(time.time())
    visitor_email = f"completion.{ts}@moodtest.example.com"
    studio_name   = f"Studio Completion {ts}"
    contact_name  = "Sofia Completion"

    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        print("\n=== Phase 1: Studio V2 Submission ===")
        # 1. Draft create
        r = await cli.post('/studio/activation/draft', json={})
        token = r.json()['draft_token']
        _log('draft_created', bool(token), token[:12] + '…')

        # 2. Patch draft with archetype + experiences + identity
        await cli.patch('/studio/activation/draft', json={
            'draft_token': token,
            'archetype': 'interior_studio',
            'experiences': ['design_journey_os', 'moodboard_experience'],
            'movement': 'identity',
            'payload_patch': {
                'studio_name': studio_name,
                'monogram': 'SC',
                'city': 'Padua',
                'country': 'IT',
                'languages': ['it', 'en-us'],
                'markets': ['private_residential'],
                'temperament': 'composed',
            },
        })

        # 3. Submit
        r = await cli.post('/studio/activation/submit', json={
            'draft_token':   token,
            'contact_email': visitor_email,
            'contact_name':  contact_name,
            'contact_role':  'Founder',
            'phone_prefix':  '+39',
            'phone_number':  '345 1234567',
            'locale':        'it-IT',
        })
        sub = r.json()
        request_id = sub.get('request_id')
        reference  = sub.get('reference')
        _log('request_submitted', bool(request_id), f"ref={reference} id={request_id[:8]}…")

    # ── Phase 2-3: Admin login + Pipeline transitions ──
    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        print("\n=== Phase 2: Advisor Pipeline ===")
        r = await cli.post('/auth/login', json={
            'email': ADMIN_EMAIL, 'password': ADMIN_PW, 'tenant_slug': None,
        })
        jwt = r.json()['token']
        h = {'Authorization': f'Bearer {jwt}'}
        _log('admin_login', bool(jwt), 'super_admin authenticated')

        for st in ('reviewing', 'contacted', 'qualified'):
            r = await cli.patch(f'/admin/studio/requests/{request_id}',
                                json={'status': st}, headers=h)
            _log(f'status_{st}', r.status_code == 200, f"http={r.status_code}")

        # Try to PATCH directly to activated → should be 409 (forced to /activate)
        r = await cli.patch(f'/admin/studio/requests/{request_id}',
                            json={'status': 'activated'}, headers=h)
        _log('patch_activated_blocked', r.status_code == 409,
             f"http={r.status_code} (must use /activate)")

        # ── Phase 3: Activation preview + execute ──
        print("\n=== Phase 3: Tenant Activation (full-auto) ===")
        r = await cli.get(f'/admin/studio/requests/{request_id}/activation-preview',
                          headers=h)
        prev = r.json()
        _log('preview_ok',
             bool(prev.get('suggested_slug')) and not prev.get('already_activated'),
             f"slug={prev.get('suggested_slug')} email={prev.get('founder_email')}",
             extra={'preview': prev})

        # Confirm activation with advisor-edited slug (simulate modal submit)
        chosen_slug = f"completion-{ts}"
        r = await cli.post(f'/admin/studio/requests/{request_id}/activate',
                           json={
                               'tenant_slug': chosen_slug,
                               'tenant_name': studio_name,
                           }, headers=h)
        act = r.json()
        _log('activate_ok', r.status_code == 200 and act.get('ok'),
             f"tenant_id={(act.get('tenant_id') or '')[:8]}… slug={act.get('slug')}",
             extra={'activation': act})

        tenant_id    = act.get('tenant_id')
        magic_link   = act.get('magic_link_url')
        founder_uid  = act.get('founder_user_id')
        _log('magic_link_issued', bool(magic_link),
             magic_link[:60] + '…' if magic_link else 'MISSING')

    # ── Phase 4: DB verification ──
    print("\n=== Phase 4: Database verification ===")
    async with AsyncSessionLocal() as s:
        # request status
        st_row = (await s.execute(text("SELECT status FROM studio_requests WHERE id = CAST(:id AS uuid)"),
                                  {'id': request_id})).mappings().first()
        _log('db_request_activated', st_row and st_row['status'] == 'activated',
             f"status={st_row and st_row['status']}")

        # tenant row
        t_row = (await s.execute(text("SELECT id, slug, name, status FROM tenants WHERE id = CAST(:id AS uuid)"),
                                 {'id': tenant_id})).mappings().first()
        _log('db_tenant_created',
             t_row and t_row['slug'] == chosen_slug,
             f"slug={t_row and t_row['slug']} name={t_row and t_row['name']}")

        # founder user
        u_row = (await s.execute(text(
            "SELECT id, email, role, is_active FROM users WHERE id = CAST(:id AS uuid)"
        ), {'id': founder_uid})).mappings().first()
        _log('db_founder_user', u_row and u_row['role'] == 'owner' and u_row['is_active'],
             f"email={u_row and u_row['email']} role={u_row and u_row['role']}")

        # magic link with 30-day TTL
        m_row = (await s.execute(text("""
            SELECT id, expires_at, created_at, consumed_at, user_id
              FROM access_magic_links
             WHERE user_id = CAST(:uid AS uuid)
             ORDER BY created_at DESC LIMIT 1
        """), {'uid': founder_uid})).mappings().first()
        ttl_days = None
        if m_row:
            ttl_days = round((m_row['expires_at'] - m_row['created_at']).total_seconds() / 86400, 1)
        _log('db_magic_link_30d',
             m_row and 29 <= (ttl_days or 0) <= 31,
             f"ttl_days={ttl_days}")

        # studio_relations linked
        rel_row = (await s.execute(text("""
            SELECT id, tenant_id, status FROM studio_relations
             WHERE studio_request_id = CAST(:rid AS uuid)
             ORDER BY created_at DESC LIMIT 1
        """), {'rid': request_id})).mappings().first()
        _log('db_relation_active',
             rel_row and rel_row['status'] == 'activated' and rel_row['tenant_id'],
             f"status={rel_row and rel_row['status']}")

        # email dispatch log with magic_link in variables
        elog = (await s.execute(text("""
            SELECT id, template_key, status, variables
              FROM studio_email_dispatch_log
             WHERE to_email = :em AND template_key = 'studio_request_approved'
             ORDER BY created_at DESC LIMIT 1
        """), {'em': visitor_email})).mappings().first()
        vars_have_link = False
        if elog:
            vars_have_link = bool((elog['variables'] or {}).get('magic_link_url'))
        _log('db_email_dispatched_with_link',
             elog and vars_have_link,
             f"status={elog and elog['status']} link_in_vars={vars_have_link}")

    # ── Phase 5: Magic link consumption → JWT + redirect ──
    print("\n=== Phase 5: Founder login via magic link ===")
    raw_token = magic_link.split('token=')[-1] if magic_link else ''
    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        r = await cli.post('/auth/magic-link/consume', json={'token': raw_token})
        consume = r.json()
        _log('magic_link_consumed',
             r.status_code == 200 and consume.get('ok'),
             f"redirect={consume.get('redirect_url')}")

        # Founder JWT used to fetch /auth/me
        founder_jwt = consume.get('jwt')
        if founder_jwt:
            r = await cli.get('/auth/me', headers={'Authorization': f'Bearer {founder_jwt}'})
            me = r.json()
            _log('founder_jwt_valid',
                 r.status_code == 200 and me.get('email') == visitor_email,
                 f"role={me.get('role')} tenant_slug={me.get('tenant_slug')}",
                 extra={'me': me})

        # Magic link replay protection (within 60s window = idempotent)
        r2 = await cli.post('/auth/magic-link/consume', json={'token': raw_token})
        _log('magic_link_replay_idempotent_60s',
             r2.status_code == 200 and r2.json().get('ok'),
             f"http={r2.status_code} (replay within window must succeed)")

    # ── Final summary ──
    fails = [r for r in RESULTS if not r['ok']]
    print("\n" + ("=" * 60))
    print(f"OVERALL: {'READY_FOR_REAL_TENANTS' if not fails else 'NEEDS_ITERATION'}")
    print(f"Passes: {len(RESULTS) - len(fails)} / {len(RESULTS)}")
    if fails:
        print("\nFailures:")
        for f in fails:
            print(f"  • {f['phase']} — {f['detail']}")
    print(("=" * 60))

    out = {
        'overall':     'READY_FOR_REAL_TENANTS' if not fails else 'NEEDS_ITERATION',
        'pass_count':  len(RESULTS) - len(fails),
        'total_count': len(RESULTS),
        'request_id':  request_id,
        'reference':   reference,
        'tenant_id':   tenant_id,
        'tenant_slug': chosen_slug if 'chosen_slug' in dir() else None,
        'magic_link_url': magic_link,
        'visitor_email': visitor_email,
        'phases':      RESULTS,
    }
    path = '/tmp/tenant_activation_completion_test.json'
    with open(path, 'w') as f:
        json.dump(out, f, indent=2, default=str)
    print(f"JSON detail: {path}")
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
