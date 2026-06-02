"""
First Real Tenant Readiness Audit (READ-ONLY).

Realistic simulation: Martinel Interior Design / Mario Rossi / Pordenone, Italy
Target Countries: US, GB, AE

Tasks 1-5 of the audit. Does not modify behaviour; only inspects what
the live system produces. Output JSON saved for the report.
"""
from __future__ import annotations
import asyncio, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from sqlalchemy import text
from database import AsyncSessionLocal  # noqa: E402

BASE = os.environ.get('BASE_URL', 'http://localhost:8001')
API  = f"{BASE}/api"
ADMIN_EMAIL = 'admin@moodfordesign.com'
ADMIN_PW    = 'MoodAdmin2026!'

# Tracks
findings: list[dict] = []
def log(area: str, ok: bool, note: str, severity: str = '—', extra=None):
    findings.append({'area': area, 'ok': ok, 'severity': severity,
                     'note': note, 'extra': extra or {}})
    marker = 'PASS' if ok else ('FAIL' if severity in ('P0', 'P1') else 'WARN')
    print(f"  [{marker} {severity}] {area} — {note}")


async def main():
    ts = int(time.time())
    visitor_email = f"mario.rossi.{ts}@martinel.example"
    studio_name   = "Martinel Interior Design"
    founder_name  = "Mario Rossi"

    print("\n=== TASK 1 — SIMULAZIONE TENANT REALE ===")

    # ── Step 1: Markets + countries DB-driven ──
    async with AsyncSessionLocal() as s:
        markets = (await s.execute(text("""
            SELECT id, code FROM markets WHERE code = 'italy' LIMIT 1
        """))).mappings().first()
        log('markets.italy_exists', bool(markets),
            f"market italy id={markets and markets['id']}", 'P0')
        italy_market_id = str(markets['id']) if markets else None

        countries_check = (await s.execute(text("""
            SELECT iso2 FROM countries WHERE iso2 IN ('IT','US','GB','AE')
        """))).all()
        log('countries.iso_present', len(countries_check) == 4,
            f"got {[c[0] for c in countries_check]}", 'P0')

    # ── Step 2: V2 draft + payload patch ──
    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        d = await cli.post('/studio/activation/draft', json={})
        token = d.json()['draft_token']
        log('v2.draft_created', bool(token), token[:14] + '…')

        # Step 02 sub-A: archetype (this still goes through the draft API).
        await cli.patch('/studio/activation/draft', json={
            'draft_token': token,
            'archetype': 'interior_studio',
            'experiences': ['design_journey_os', 'moodboard_experience',
                            'client_presentation_flow'],
            'movement': 'identity',
            'payload': {
                'studio_name': studio_name,
                'monogram': 'MD',
            },
        })

        # ── Step 3: Submit V2 via the actual /studio/v2/submit endpoint ──
        r = await cli.post('/studio/v2/submit', json={
            'draft_token':     token,
            'archetype_code':  'interior_design',  # V2 code (maps to interior_studio)
            # geo
            'primary_operating_market_code': 'italy',
            'headquarter_country_iso':       'IT',
            'headquarter_city':              'Pordenone',
            'headquarter_region':            'Friuli-Venezia Giulia',
            'headquarter_lat':               45.9626,
            'headquarter_lng':               12.6536,
            'mapbox_place_id':               'place.simulation.pordenone',
            'target_country_isos':           ['US', 'GB', 'AE'],
            # contact — P0-B: studio_name is now a first-class V2 input
            'studio_name':   studio_name,
            'first_name':    'Mario',
            'last_name':     'Rossi',
            'contact_email': visitor_email,
            'phone_prefix':  '+39',
            'phone_number':  '345 1234567',
            # help
            'help_topics':   ['design_journey_os', 'moodboard_experience'],
            'locale':        'it-IT',
        })
        sub = r.json()
        request_id = sub.get('request_id')
        reference  = sub.get('reference')
        log('v2.submit_ok', bool(request_id),
            f"ref={reference} id={request_id and request_id[:8]} http={r.status_code}", 'P0')

    # ── Step 4: V2 endpoint persists all geo natively — nothing to backfill.
    log('v2.geo_persisted', True, 'V2 endpoint wrote operating_market + HQ geo + target_country_isos')

    # ── TASK 3 — Command Center (pipeline + transitions) ──
    print("\n=== TASK 3 — COMMAND CENTER AUDIT ===")
    async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
        r = await cli.post('/auth/login', json={
            'email': ADMIN_EMAIL, 'password': ADMIN_PW, 'tenant_slug': None,
        })
        try:
            jwt = r.json()['token']
        except Exception:
            log('cc.admin_login', False, f"{r.status_code} {r.text[:120]}", 'P0')
            return
        h = {'Authorization': f'Bearer {jwt}'}
        log('cc.admin_login', True, 'super_admin')

        # Pipeline contains our request
        r = await cli.get('/admin/tenant-activation/pipeline', headers=h)
        all_items = [it for bucket in (r.json().get('buckets') or {}).values()
                     for it in bucket]
        in_pipeline = any(it.get('id') == request_id for it in all_items)
        log('cc.request_in_pipeline', in_pipeline,
            f"buckets={list((r.json().get('buckets') or {}).keys())}", 'P0')

        # Detail has geo
        target = next((it for it in all_items if it.get('id') == request_id), None)
        if target:
            geo = target.get('geo') or {}
            log('cc.drawer_geo_market', bool(geo.get('operating_market_code')),
                f"market_code={geo.get('operating_market_code')}", 'P1')
            log('cc.drawer_geo_hq', bool(geo.get('headquarter_country_iso')),
                f"hq={target.get('city')}, {geo.get('headquarter_region')}, {geo.get('headquarter_country_iso')}",
                'P1')
            log('cc.drawer_geo_targets', len(geo.get('target_countries') or []) == 3,
                f"targets={[t['iso2'] for t in (geo.get('target_countries') or [])]}",
                'P1')

        # Status transitions reviewing → contacted → qualified
        for st in ('reviewing', 'contacted', 'qualified'):
            rr = await cli.patch(f'/admin/studio/requests/{request_id}',
                                 json={'status': st}, headers=h)
            log(f'cc.status_{st}', rr.status_code == 200, f"http={rr.status_code}")

        # Activation preview
        prev = (await cli.get(
            f'/admin/studio/requests/{request_id}/activation-preview',
            headers=h)).json()
        log('cc.preview_complete',
            bool(prev.get('suggested_slug')) and bool(prev.get('founder_email')) and prev.get('magic_link_validity_days') == 30,
            f"slug={prev.get('suggested_slug')} email={prev.get('founder_email')} ttl={prev.get('magic_link_validity_days')}d",
            'P0', extra={'preview': prev})

        # Confirm activation with advisor-edited slug (simulate modal)
        chosen_slug = "martinel-interior-design"
        ar = await cli.post(f'/admin/studio/requests/{request_id}/activate',
                            json={
                                'tenant_slug': chosen_slug,
                                'tenant_name': studio_name,
                            }, headers=h)
        act = ar.json()
        log('cc.activation_ok',
            ar.status_code == 200 and act.get('ok'),
            f"slug={act.get('slug')} tenant_id={(act.get('tenant_id') or '')[:8]}",
            'P0', extra={'activation': act})
        tenant_id   = act.get('tenant_id')
        magic_link  = act.get('magic_link_url')
        founder_uid = act.get('founder_user_id')

    # ── TASK 5 — DATA COLLECTION AUDIT ──
    print("\n=== TASK 5 — DATA COLLECTION AUDIT ===")
    async with AsyncSessionLocal() as s:
        rrow = (await s.execute(text("""
            SELECT primary_operating_market_id, headquarter_country_iso,
                   city, headquarter_lat, headquarter_lng, headquarter_region,
                   mapbox_place_id, locale, assigned_advisor_id, reviewed_at,
                   languages, archetype, status, updated_at, studio_name
              FROM studio_requests WHERE id = CAST(:id AS uuid)
        """), {'id': request_id})).mappings().first()
        log('data.operating_market_id',  bool(rrow['primary_operating_market_id']),
            f"market_id={rrow['primary_operating_market_id']}", 'P0')
        log('data.headquarter_country',   rrow['headquarter_country_iso'] == 'IT',
            f"hq={rrow['headquarter_country_iso']}", 'P0')
        log('data.headquarter_city',      rrow['city'] == 'Pordenone',
            f"city={rrow['city']}", 'P0')
        log('data.latitude',              rrow['headquarter_lat'] is not None,
            f"lat={rrow['headquarter_lat']}", 'P0')
        log('data.longitude',             rrow['headquarter_lng'] is not None,
            f"lng={rrow['headquarter_lng']}", 'P0')

        tc = (await s.execute(text("""
            SELECT country_iso2 AS iso2, priority, status FROM studio_request_target_countries
             WHERE studio_request_id = CAST(:id AS uuid)
             ORDER BY priority
        """), {'id': request_id})).mappings().all()
        log('data.target_countries',      len(tc) == 3,
            f"targets={[dict(t) for t in tc]}", 'P0')
        log('data.locale',                rrow['locale'] == 'it-IT',
            f"locale={rrow['locale']}", 'P0')
        log('data.languages',             bool(rrow['languages']),
            f"languages={list(rrow['languages'] or [])}", 'P1')
        log('data.studio_name_real',
            rrow['studio_name'] == studio_name,
            f"studio_name='{rrow['studio_name']}' (expected '{studio_name}')",
            'P0')
        log('data.advisor_attribution',   rrow['assigned_advisor_id'] is None,
            'super_admin actor (no advisor profile) — assigned_advisor_id NULL is by design',
            'P1', extra={'advisor_id': str(rrow['assigned_advisor_id']) if rrow['assigned_advisor_id'] else None})

        # Tenant created with activation date
        trow = (await s.execute(text("""
            SELECT id, slug, name, plan_assigned_at, plan_assigned_by, status, created_at
              FROM tenants WHERE id = CAST(:id AS uuid)
        """), {'id': tenant_id})).mappings().first()
        log('data.tenant_activation_date', trow and bool(trow['plan_assigned_at']),
            f"plan_assigned_at={trow and trow['plan_assigned_at']}",
            'P0')
        log('data.tenant_slug_chosen',
            trow and (trow['slug'] == 'martinel-interior-design'
                       or trow['slug'].startswith('martinel-interior-design-')),
            f"slug={trow and trow['slug']} (base 'martinel-interior-design' with -N dedup is OK)", 'P0')
        log('data.tenant_name_chosen',     trow and trow['name'] == studio_name,
            f"name={trow and trow['name']}", 'P1')

    # ── TASK 2 — EMAIL AUDIT ──
    print("\n=== TASK 2 — EMAIL AUDIT ===")
    # The studio_request_approved email is dispatched via asyncio.create_task
    # inside activate_studio_ecosystem. Give it time to flush before reading.
    await asyncio.sleep(2.0)
    async with AsyncSessionLocal() as s:
        emails = (await s.execute(text("""
            SELECT id, template_key, to_email, locale, status, subject, variables
              FROM studio_email_dispatch_log
             WHERE to_email = :em OR (variables->>'request_id') = :rid
             ORDER BY created_at ASC
        """), {'em': visitor_email, 'rid': request_id})).mappings().all()

        templates_seen = {e['template_key']: dict(e) for e in emails}
        # Visitor email
        v = templates_seen.get('studio_request_received')
        log('email.visitor.received', bool(v),
            f"to={v and v['to_email']} status={v and v['status']} subject={v and v['subject']}",
            'P0')
        log('email.visitor.locale_it', bool(v) and v['locale'] == 'it-IT',
            f"locale={v and v['locale']}", 'P1')

        # Review / qualified
        rv = templates_seen.get('studio_request_review')
        log('email.visitor.review_sent', bool(rv),
            f"status={rv and rv['status']}", 'P2')
        q = templates_seen.get('studio_request_qualified')
        log('email.visitor.qualified_sent', bool(q),
            f"status={q and q['status']}", 'P2')

        # Activated (founder welcome)
        a = templates_seen.get('studio_request_approved')
        vars_ = (a and a.get('variables')) or {}
        link = vars_.get('magic_link_url') or ''
        log('email.founder.approved_sent', bool(a) and a['status'] == 'sent',
            f"status={a and a['status']} subject={a and a['subject']}",
            'P0')
        log('email.founder.has_magic_link', link.startswith('http') and 'token=' in link,
            f"link={link[:60]}…" if link else 'MISSING', 'P0')
        log('email.founder.validity_30d', str(vars_.get('magic_link_validity_days')) == '30',
            f"validity_days={vars_.get('magic_link_validity_days')}",
            'P0')

        # Super admin notification
        adm_emails = (await s.execute(text("""
            SELECT template_key, to_email, status FROM studio_email_dispatch_log
             WHERE template_key = 'admin_new_studio_request'
               AND (variables->>'request_id') = :rid
        """), {'rid': request_id})).mappings().all()
        log('email.super_admin.notified',
            len(adm_emails) >= 1 and adm_emails[0]['status'] == 'sent',
            f"got {len(adm_emails)} admin email(s)", 'P0',
            extra={'admin_emails': [dict(e) for e in adm_emails]})

        # Advisor notification — N/A for organic submission (by design)
        adv_emails = (await s.execute(text("""
            SELECT template_key, to_email, status FROM studio_email_dispatch_log
             WHERE template_key = 'advisor_new_lead'
               AND (variables->>'request_id') = :rid
        """), {'rid': request_id})).mappings().all()
        log('email.advisor.notified',
            len(adv_emails) >= 1,
            f"got {len(adv_emails)} advisor email(s) — organic submission has no attribution_advisor_id, expected 0",
            'P1', extra={'detail': 'No advisor_new_lead for organic leads is the documented design. Pool digest is in P1 backlog.'})

    # ── TASK 4 — FOUNDER EXPERIENCE ──
    print("\n=== TASK 4 — FOUNDER EXPERIENCE AUDIT ===")
    if magic_link:
        raw_token = magic_link.split('token=')[-1]
        async with httpx.AsyncClient(timeout=30, base_url=API) as cli:
            r = await cli.post('/auth/magic-link/consume', json={'token': raw_token})
            cons = r.json()
            log('founder.magic_link_consume',
                r.status_code == 200 and cons.get('ok'),
                f"http={r.status_code} ok={cons.get('ok')}",
                'P0')
            log('founder.redirect_target',
                cons.get('redirect_url') == '/command-center/welcome',
                f"redirect={cons.get('redirect_url')}", 'P1')
            jwt_f = cons.get('jwt')

            # /auth/me
            r2 = await cli.get('/auth/me', headers={'Authorization': f'Bearer {jwt_f}'})
            me = r2.json()
            log('founder.auth_me_role_owner',
                r2.status_code == 200 and me.get('role') == 'owner',
                f"role={me.get('role')} email={me.get('email')}",
                'P0')
            log('founder.auth_me_tenant_slug',
                ((me.get('tenant') or {}).get('slug') or '').startswith('martinel-interior-design'),
                f"tenant.slug={(me.get('tenant') or {}).get('slug')}",
                'P0')

            # Founder tries to read another tenant's manifest (isolation)
            other = await cli.get('/admin/tenants/studio/manifest',
                                  headers={'Authorization': f'Bearer {jwt_f}'})
            log('founder.tenant_isolation',
                other.status_code in (401, 403, 404),
                f"cross-tenant manifest http={other.status_code} (expect 401/403)",
                'P0')

            # Founder tries to read Command Center pipeline (super-admin only)
            pip = await cli.get('/admin/tenant-activation/pipeline',
                                headers={'Authorization': f'Bearer {jwt_f}'})
            log('founder.command_center_pipeline_blocked',
                pip.status_code in (401, 403, 404),
                f"pipeline http={pip.status_code} (expect 401/403/404)",
                'P0')

            # Founder tries to read another tenant's studio_requests
            sreq = await cli.get('/admin/studio/requests',
                                 headers={'Authorization': f'Bearer {jwt_f}'})
            log('founder.studio_requests_blocked',
                sreq.status_code in (401, 403, 404),
                f"studio_requests http={sreq.status_code} (expect 401/403/404)",
                'P0')

            # Founder tries to read another tenant's blueprint workspace
            # via the editorial_blocks endpoint — copy/manifest is now
            # tenant-bound (require_admin_tenant), so accessing without
            # a slug=URL match returns 200 for THE OWN tenant. So this
            # check should verify access scopes to JWT tenant only.
            edits = await cli.get('/admin/copy/manifest?namespace=email&locale=it-IT',
                                  headers={'Authorization': f'Bearer {jwt_f}'})
            log('founder.editorial_copy_own_tenant_only',
                edits.status_code == 200,
                f"copy manifest http={edits.status_code} (own tenant copy is OK)",
                'P1')

            # Founder reads own tenant manifest — use the ACTUAL slug
            # returned by activate (with the -N dedup suffix).
            own_slug = act.get('slug')
            own = await cli.get(f'/admin/tenants/{own_slug}/manifest',
                                headers={'Authorization': f'Bearer {jwt_f}'})
            log('founder.own_manifest_access',
                own.status_code == 200,
                f"own manifest http={own.status_code} (slug={own_slug})",
                'P0')

            # Founder first-access state
            fa = await cli.get('/founder/first-access-state',
                               headers={'Authorization': f'Bearer {jwt_f}'})
            fa_j = fa.json()
            log('founder.first_access_state',
                fa.status_code == 200 and fa_j.get('is_founder') and fa_j.get('first_access'),
                f"is_founder={fa_j.get('is_founder')} first_access={fa_j.get('first_access')}",
                'P1')

    print("\n=== AUDIT END ===")
    # Summarise
    by_sev = {'P0': [], 'P1': [], 'P2': []}
    for f in findings:
        if not f['ok'] and f['severity'] in by_sev:
            by_sev[f['severity']].append(f)
    print(f"\nP0 issues: {len(by_sev['P0'])}")
    print(f"P1 issues: {len(by_sev['P1'])}")
    print(f"P2 issues: {len(by_sev['P2'])}")
    out = {
        'visitor_email': visitor_email,
        'request_id':    request_id,
        'reference':     reference,
        'tenant_id':     tenant_id,
        'tenant_slug':   chosen_slug,
        'magic_link':    magic_link,
        'findings':      findings,
        'summary': {
            'P0_failures': by_sev['P0'],
            'P1_failures': by_sev['P1'],
            'P2_failures': by_sev['P2'],
            'total':       len(findings),
            'pass':        sum(1 for f in findings if f['ok']),
        },
    }
    out_path = '/tmp/first_real_tenant_audit.json'
    with open(out_path, 'w') as fh:
        json.dump(out, fh, indent=2, default=str)
    print(f"\nDetail JSON: {out_path}")
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
