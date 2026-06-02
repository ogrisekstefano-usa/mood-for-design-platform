"""
End-to-end real email lifecycle test for the hardened email layer.

Runs ONE realistic submission, walks through the full advisor pipeline
(received → reviewing → contacted → qualified → activated), and verifies
that EVERY email of the lifecycle is REALLY dispatched via Resend
(status='sent' with external_id), not silently shorted to 'sandbox'.

Expected emails (5 total):
  1. studio_request_received   → visitor   (on submit)
  2. admin_new_studio_request  → admin     (on submit)
  3. studio_request_review     → visitor   (status='reviewing')
  4. studio_request_qualified  → visitor   (status='qualified')
  5. studio_request_approved   → founder   (post-activation, with magic link CTA)

Output: structured PASS/FAIL list + JSON detail.
"""
from __future__ import annotations
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from sqlalchemy import text
from database import AsyncSessionLocal

BASE = os.environ.get('BASE_URL', 'http://localhost:8001')
API  = f"{BASE}/api"
ADMIN_EMAIL = 'admin@moodfordesign.com'
ADMIN_PW    = 'MoodAdmin2026!'

RESULTS = []


def _log(label, ok, detail='', extra=None):
    RESULTS.append({'label': label, 'ok': ok, 'detail': detail,
                    'extra': extra or {}})
    print(f"  [{'PASS' if ok else 'FAIL'}] {label} — {detail}")


async def fetch_email(visitor_email: str, template_key: str, *, request_id: str | None = None):
    async with AsyncSessionLocal() as s:
        q = """
            SELECT id, template_key, to_email, status, external_id,
                   error, locale, subject, created_at, variables
              FROM studio_email_dispatch_log
             WHERE template_key = :tk
               AND (to_email = :em OR (variables->>'request_id') = :rid)
             ORDER BY created_at DESC LIMIT 1
        """
        r = (await s.execute(text(q), {
            "tk": template_key, "em": visitor_email,
            "rid": request_id or '',
        })).mappings().first()
        return dict(r) if r else None


async def wait_for(template_key, visitor_email, request_id, timeout=8.0):
    """Async dispatches are fire-and-forget — wait up to N seconds."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        row = await fetch_email(visitor_email, template_key, request_id=request_id)
        if row and row['status'] in ('sent', 'failed', 'sandbox'):
            return row
        await asyncio.sleep(0.3)
    return None


async def main():
    ts = int(time.time())
    visitor_email = f"hardening.{ts}@moodtest.example.com"
    founder_name  = "Lucia Hardening"
    studio_name   = f"Studio Hardening {ts}"

    print("\n=== TASK 5 — END TO END REAL EMAIL TEST ===\n")
    print(f"Visitor: {visitor_email}")
    print(f"Studio:  {studio_name}\n")

    # ── 1. V2 SUBMIT (organic, no advisor attribution) ──
    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        d = await cli.post('/studio/activation/draft', json={})
        draft_token = d.json()['draft_token']

        r = await cli.post('/studio/v2/submit', json={
            'draft_token':     draft_token,
            'archetype_code':  'interior_design',
            'primary_operating_market_code': 'italy',
            'headquarter_country_iso':       'IT',
            'headquarter_city':              'Trieste',
            'headquarter_region':            'Friuli-Venezia Giulia',
            'headquarter_lat':               45.6495,
            'headquarter_lng':               13.7768,
            'mapbox_place_id':               'place.hardening',
            'target_country_isos':           ['US', 'CH'],
            'first_name':    'Lucia',
            'last_name':     'Hardening',
            'contact_email': visitor_email,
            'phone_prefix':  '+39',
            'phone_number':  '345 6543210',
            'help_topics':   ['design_journey_os'],
            'locale':        'it-IT',
        })
        sub = r.json()
        request_id = sub.get('request_id')
        reference  = sub.get('reference')
        _log('submit_ok', bool(request_id), f"ref={reference}")

    # ── 2. Wait for the 2 transactional emails fired on submit ──
    e1 = await wait_for('studio_request_received',  visitor_email, request_id)
    _log('email_received_sent',
         bool(e1) and e1['status'] == 'sent' and e1['external_id'],
         f"status={e1 and e1['status']} ext_id={e1 and e1['external_id']}")

    e2 = await wait_for('admin_new_studio_request', ADMIN_EMAIL, request_id)
    _log('email_admin_sent',
         bool(e2) and e2['status'] == 'sent' and e2['external_id'],
         f"status={e2 and e2['status']} ext_id={e2 and e2['external_id']}")

    # ── 3. Advisor pipeline: status transitions ──
    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        login = await cli.post('/auth/login', json={
            'email': ADMIN_EMAIL, 'password': ADMIN_PW, 'tenant_slug': None,
        })
        jwt = login.json()['token']
        h = {'Authorization': f'Bearer {jwt}'}

        for st in ('reviewing', 'contacted', 'qualified'):
            await cli.patch(f'/admin/studio/requests/{request_id}',
                            json={'status': st}, headers=h)

    e3 = await wait_for('studio_request_review', visitor_email, request_id)
    _log('email_review_sent',
         bool(e3) and e3['status'] == 'sent' and e3['external_id'],
         f"status={e3 and e3['status']} ext_id={e3 and e3['external_id']}")

    e4 = await wait_for('studio_request_qualified', visitor_email, request_id)
    _log('email_qualified_sent',
         bool(e4) and e4['status'] == 'sent' and e4['external_id'],
         f"status={e4 and e4['status']} ext_id={e4 and e4['external_id']}")

    # ── 4. Activate (Tenant Activation modal full-auto) ──
    chosen_slug = f"hardening-{ts}"
    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        login = await cli.post('/auth/login', json={
            'email': ADMIN_EMAIL, 'password': ADMIN_PW, 'tenant_slug': None,
        })
        jwt = login.json()['token']
        h = {'Authorization': f'Bearer {jwt}'}
        r = await cli.post(f'/admin/studio/requests/{request_id}/activate',
                           json={'tenant_slug': chosen_slug, 'tenant_name': studio_name},
                           headers=h)
        act = r.json()
        _log('activate_ok',
             r.status_code == 200 and act.get('ok'),
             f"slug={act.get('slug')} tenant={(act.get('tenant_id') or '')[:8]}")

    e5 = await wait_for('studio_request_approved', visitor_email, request_id)
    has_link = bool(e5 and (e5.get('variables') or {}).get('magic_link_url'))
    _log('email_approved_sent',
         bool(e5) and e5['status'] == 'sent' and e5['external_id'],
         f"status={e5 and e5['status']} ext_id={e5 and e5['external_id']}")
    _log('email_approved_has_magic_link', has_link,
         f"link={(e5 and (e5.get('variables') or {}).get('magic_link_url') or '')[:60]}…")

    # ── 5. Summary table ──
    print("\n=== EMAIL DISPATCH SUMMARY ===")
    print(f"{'TEMPLATE':32s} {'RECIPIENT':36s} {'STATUS':10s} {'EXTERNAL_ID':38s} TIMESTAMP")
    print('─' * 140)
    for label, row in (('1.received',  e1), ('2.admin', e2),
                       ('3.review',    e3), ('4.qualified', e4),
                       ('5.approved',  e5)):
        if row:
            print(f"{label:>11s} {row['template_key']:20s} "
                  f"{row['to_email']:36s} "
                  f"{row['status']:10s} "
                  f"{str(row['external_id']):38s} "
                  f"{row['created_at']}")
        else:
            print(f"{label:>11s} (NOT FOUND)")

    fails = [r for r in RESULTS if not r['ok']]
    verdict = 'READY_FOR_PRODUCTION_EMAILS' if not fails else 'NEEDS_ITERATION'
    print(f"\nVerdict: {verdict}  ({len(RESULTS) - len(fails)}/{len(RESULTS)})")

    out = {
        'verdict':       verdict,
        'visitor_email': visitor_email,
        'request_id':    request_id,
        'reference':     reference,
        'tenant_slug':   chosen_slug,
        'tenant_id':     act.get('tenant_id'),
        'magic_link_url': act.get('magic_link_url'),
        'emails': {
            'studio_request_received':   e1,
            'admin_new_studio_request':  e2,
            'studio_request_review':     e3,
            'studio_request_qualified':  e4,
            'studio_request_approved':   e5,
        },
        'phases': RESULTS,
    }
    path = '/tmp/email_e2e_real_test.json'
    with open(path, 'w') as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\nDetail JSON: {path}")
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
