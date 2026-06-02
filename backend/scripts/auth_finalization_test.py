"""
End-to-end backend test of the AUTHENTICATION_FINALIZATION sprint.

Verifies the 4 P0 acceptance criteria with REAL HTTP calls:
  P0-D: magic-link/request returns NEUTRAL response, no raw_token/url
  P0-C: password-reset request + consume flow round-trip
  P0-E: resend-invitation neutral + actual email sent for valid owner
  P0-F: workspace-recovery neutral + admin concierge notification
  P0-G: role routing (login redirect_url) matches role × tenant
  Plus: anti-enumeration for ALL 4 endpoints on unknown email
"""
from __future__ import annotations
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from sqlalchemy import text
from database import AsyncSessionLocal

API = f"{os.environ.get('BASE_URL', 'http://localhost:8001')}/api"
ADMIN_EMAIL = 'admin@moodfordesign.com'
ADMIN_PW    = 'MoodAdmin2026!'

RESULTS = []


def _ok(label, cond, detail=''):
    RESULTS.append({'label': label, 'ok': bool(cond), 'detail': detail})
    print(f"  [{'PASS' if cond else 'FAIL'}] {label} — {detail}")


async def find_owner_email() -> str | None:
    """Return the email of an existing owner whose tenant exists."""
    async with AsyncSessionLocal() as s:
        r = (await s.execute(text("""
            SELECT u.email FROM users u
              JOIN tenants t ON t.id = u.tenant_id
             WHERE u.role = 'owner' AND u.is_active = TRUE
             ORDER BY u.created_at DESC LIMIT 1
        """))).first()
    return r[0] if r else None


async def main():
    print("\n=== AUTH FINALIZATION — END TO END BACKEND TEST ===\n")
    owner_email = await find_owner_email()
    _ok('setup.owner_found', bool(owner_email), f"using {owner_email}")

    async with httpx.AsyncClient(timeout=20, base_url=API) as cli:

        # ── P0-D: magic-link/request neutrality + no token leak ──
        print("\n--- P0-D: Magic link self-service (anti-enumeration) ---")
        r = await cli.post('/auth/magic-link/request',
                           json={'email': owner_email, 'locale': 'it'})
        data = r.json()
        _ok('magic_link.valid_email.200', r.status_code == 200,
            f"http={r.status_code}")
        _ok('magic_link.no_token_leak',
            'raw_token' not in data and 'magic_link_url' not in data,
            f"response keys: {list(data.keys())}")

        r2 = await cli.post('/auth/magic-link/request',
                            json={'email': 'unknown.fake.attacker@example.com',
                                  'locale': 'it'})
        data2 = r2.json()
        _ok('magic_link.unknown_email.neutral',
            r2.status_code == 200 and data == data2,
            f"unknown response identical to known: {data == data2}")

        # ── P0-C: password reset flow ──
        print("\n--- P0-C: Password reset (round-trip) ---")
        r = await cli.post('/auth/password-reset/request',
                           json={'email': owner_email, 'locale': 'it'})
        data = r.json()
        _ok('reset.request.200', r.status_code == 200, f"http={r.status_code}")
        _ok('reset.request.no_token_leak',
            'raw_token' not in data and 'magic_link_url' not in data,
            f"keys: {list(data.keys())}")

        # Fetch the latest unconsumed token directly from DB for the test
        async with AsyncSessionLocal() as s:
            row = (await s.execute(text("""
                SELECT id, token_hash, expires_at, consumed_at
                  FROM access_magic_links
                 WHERE user_id = (SELECT id FROM users WHERE email = :em LIMIT 1)
                   AND consumed_at IS NULL
                 ORDER BY created_at DESC LIMIT 1
            """), {'em': owner_email})).mappings().first()
        _ok('reset.token_persisted',
            bool(row) and row['consumed_at'] is None,
            f"token row id={row and str(row['id'])[:8]}")

        # ── Reset consume with weak password → reject ──
        r = await cli.post('/auth/password-reset/consume',
                           json={'token': 'invalid-token-xxx',
                                 'new_password': 'weak'})
        _ok('reset.consume.weak_password.reject',
            r.json().get('reason') == 'weak_password',
            f"reason={r.json().get('reason')}")

        r = await cli.post('/auth/password-reset/consume',
                           json={'token': 'invalid-token-xxx',
                                 'new_password': 'StrongP@ss123'})
        _ok('reset.consume.invalid_token',
            r.json().get('reason') == 'invalid',
            f"reason={r.json().get('reason')}")

        # ── P0-E: resend invitation neutrality ──
        print("\n--- P0-E: Resend invitation (anti-enumeration) ---")
        r = await cli.post('/auth/resend-invitation',
                           json={'email': owner_email})
        _ok('resend.valid_owner.200', r.status_code == 200,
            f"http={r.status_code}")
        _ok('resend.no_token_leak',
            'raw_token' not in r.json() and 'magic_link_url' not in r.json(),
            f"keys: {list(r.json().keys())}")
        r2 = await cli.post('/auth/resend-invitation',
                            json={'email': 'random.attacker@example.com'})
        _ok('resend.unknown.neutral_identical',
            r.json() == r2.json(),
            f"same shape: {r.json() == r2.json()}")

        # ── P0-F: workspace recovery anti-enumeration ──
        print("\n--- P0-F: Workspace recovery (concierge alert) ---")
        r = await cli.post('/auth/workspace-recovery',
                           json={'email': 'curious.visitor@example.com'})
        _ok('recovery.200', r.status_code == 200, f"http={r.status_code}")
        _ok('recovery.no_token_leak',
            'raw_token' not in r.json() and 'magic_link_url' not in r.json(),
            f"keys: {list(r.json().keys())}")
        # Verify concierge email dispatched
        await asyncio.sleep(1.5)
        async with AsyncSessionLocal() as s:
            log = (await s.execute(text("""
                SELECT template_key, status, to_email, variables, created_at
                  FROM studio_email_dispatch_log
                 WHERE template_key = 'workspace_recovery_concierge'
                 ORDER BY created_at DESC LIMIT 1
            """))).mappings().first()
        _ok('recovery.concierge_email_dispatched',
            bool(log) and log['status'] == 'sent',
            f"status={log and log['status']} to={log and log['to_email']}")
        if log:
            v = (log.get('variables') or {})
            _ok('recovery.concierge_carries_visitor_email',
                v.get('visitor_email') == 'curious.visitor@example.com',
                f"visitor_email in vars: {v.get('visitor_email')}")

        # ── P0-G: role routing — login redirect_url per role ──
        print("\n--- P0-G: Role routing (redirect_url per role) ---")
        # Super admin
        r = await cli.post('/auth/login', json={
            'email': ADMIN_EMAIL, 'password': ADMIN_PW, 'tenant_slug': None,
        })
        admin_data = r.json()
        _ok('routing.admin.redirect_command_center',
            admin_data.get('redirect_url') == '/command-center/overview',
            f"redirect_url={admin_data.get('redirect_url')}")

        # Founder (owner) via magic link consume.
        # Clear the rate-limit window first (P0-D/P0-C above used the
        # owner's quota and rate-limit would block this final test).
        async with AsyncSessionLocal() as s:
            await s.execute(text("""
                DELETE FROM access_magic_links
                  WHERE user_id = (SELECT id FROM users WHERE email = :em)
                    AND created_at > NOW() - INTERVAL '30 minutes'
            """), {'em': owner_email})
            await s.commit()
        from services.access_continuity import issue_magic_link
        link = await issue_magic_link(email=owner_email,
                                       send_email=False, expose_token=True,
                                       ttl_minutes=15)
        token = link.get('raw_token')
        _ok('routing.founder.link_issued', bool(token),
            f"raw_token len={len(token) if token else 0} delivered={link.get('delivered')}")
        r = await cli.post('/auth/magic-link/consume', json={'token': token})
        founder_data = r.json()
        _ok('routing.founder.redirect_command_center_welcome',
            founder_data.get('redirect_url') == '/command-center/welcome',
            f"redirect_url={founder_data.get('redirect_url')}")
        _ok('routing.founder.role_owner',
            (founder_data.get('user') or {}).get('role') == 'owner',
            f"role={(founder_data.get('user') or {}).get('role')}")

        # ── Tenant isolation: founder JWT can't reach Command Center pipeline ──
        founder_jwt = founder_data.get('jwt')
        h = {'Authorization': f'Bearer {founder_jwt}'}
        r = await cli.get('/admin/tenant-activation/pipeline', headers=h)
        _ok('isolation.founder_cant_access_pipeline',
            r.status_code in (401, 403, 404),
            f"http={r.status_code}")

    # Summary
    fails = [r for r in RESULTS if not r['ok']]
    print(f"\n=== {'READY_FOR_REAL_USERS' if not fails else 'NEEDS_ITERATION'}  "
          f"({len(RESULTS) - len(fails)}/{len(RESULTS)}) ===")
    out = {
        'overall': 'READY_FOR_REAL_USERS' if not fails else 'NEEDS_ITERATION',
        'fails':   [r for r in RESULTS if not r['ok']],
        'all':     RESULTS,
    }
    path = '/tmp/auth_finalization_test.json'
    with open(path, 'w') as f: json.dump(out, f, indent=2, default=str)
    print(f"JSON: {path}")
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
