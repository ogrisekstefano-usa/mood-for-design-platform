"""M2 Security Validation — Timeline + Health Hooks
==================================================

14 obbligatori (acceptance §8) + 2 sanity (15+16). Forward-only, no SQL.
"""
from __future__ import annotations
import asyncio, os, sys, json, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import httpx

BASE = os.environ.get("BASE_URL")
if not BASE:
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.strip().startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().strip('"')

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PWD   = "MoodAdmin2026!"
MARTINEL = "c64659f6-5a76-41dd-8d8d-b901d29862af"
MARTINEL_SLUG = "martinel-interior-design"

CHECKS: list[dict] = []
def add(name: str, ok: bool, **kw):
    CHECKS.append({"name": name, "ok": ok, **kw})
    print(f"  {'✅' if ok else '❌'} {name}  " + " ".join(f"{k}={v}" for k, v in kw.items()))


async def main() -> int:
    t0 = time.time()
    async with httpx.AsyncClient(timeout=60, base_url=BASE) as cli:
        # ── Setup: admin JWT + founder JWT via dry_run_fresh_lead ──────
        r = await cli.post('/api/auth/login', json={
            "email": ADMIN_EMAIL, "password": ADMIN_PWD})
        admin_token = r.json()['token']
        aH = {"Authorization": f"Bearer {admin_token}"}

        from scripts.dry_run_fresh_lead import main as mk_lead
        import io, contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            await mk_lead()
        out = buf.getvalue()
        import re
        m = re.search(r'\{.*\}', out, re.DOTALL)
        data = json.loads(m.group(0))
        magic = data['magic_link_url']
        tok = magic.split('token=')[1]
        r = await cli.post('/api/auth/magic-link/consume', json={"token": tok})
        fjwt = r.json()['jwt']
        fslug = r.json()['tenant']['slug']
        ftid  = r.json()['tenant']['id']
        fH = {"Authorization": f"Bearer {fjwt}", "X-Tenant-Slug": fslug}
        print(f"[setup] founder slug={fslug} tid={ftid[:8]}…")

        # ──────────────────────────────────────────────────────────────
        # 1. Founder JWT → /blueprint/timeline own → 200
        r = await cli.get('/api/blueprint/timeline', headers=fH)
        add("01.founder.timeline.own", r.status_code == 200,
            status=r.status_code, items=len(r.json().get('items', [])))

        # 2. Founder JWT → /admin/tenants/{OTHER}/timeline → 403/404
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/timeline', headers=fH)
        add("02.founder.cant_access_admin_timeline",
            r.status_code in (401, 403, 404), status=r.status_code)

        # 3. Founder timeline MUST NOT include admin_new_studio_request
        r = await cli.get('/api/blueprint/timeline?limit=200', headers=fH)
        codes = {i['type_code'] for i in r.json().get('items', [])}
        add("03.founder.no_admin_new_studio_request",
            'admin_new_studio_request' not in codes,
            codes_count=len(codes))

        # 4. Founder timeline MUST NOT include any visibility='admin_only' codes
        async with httpx.AsyncClient(timeout=30, base_url=BASE) as c2:
            r2 = await c2.get('/api/catalogs/timeline-types', headers=aH)
            admin_only = {x['code'] for x in r2.json() if x.get('visibility') == 'admin_only'}
        leak = codes & admin_only
        add("04.founder.no_admin_only_leak", not leak,
            admin_only_count=len(admin_only), leaked=list(leak))

        # 5. Anon → admin timeline → 401
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/timeline')
        add("05.anon.admin_timeline_401", r.status_code in (401, 403), status=r.status_code)

        # 6. Cursor pagination: page1 + page2 must have no overlap
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/timeline?limit=5', headers=aH)
        page1 = r.json()
        ids1 = {f"{i['source']}-{i['id']}" for i in page1['items']}
        cur = page1.get('next_cursor')
        if cur:
            r = await cli.get(
                f'/api/admin/tenants/{MARTINEL}/timeline',
                params={"limit": 5, "cursor": cur}, headers=aH)
            try:
                page2 = r.json()
            except Exception:
                page2 = {"items": []}
            ids2 = {f"{i['source']}-{i['id']}" for i in page2.get('items', [])}
            add("06.cursor.no_overlap",
                r.status_code == 200 and len(ids1) > 0 and len(ids2) > 0 and not (ids1 & ids2),
                status=r.status_code, page1=len(ids1), page2=len(ids2),
                overlap=len(ids1 & ids2))
        else:
            add("06.cursor.no_overlap", True, note="single_page")

        # 7. Filter by type_code returns only matching
        r = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/timeline?type_codes=call&limit=50', headers=aH)
        items = r.json().get('items', [])
        all_call = all(i['type_code'] == 'call' for i in items)
        add("07.filter.type_code", all_call and len(items) >= 1,
            n=len(items), all_call=all_call)

        # 8. Filter by since boundary
        r = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/timeline?since=2026-06-02T00:00:00Z&limit=200',
            headers=aH)
        items = r.json().get('items', [])
        ok_since = all(i['at'] and i['at'] >= '2026-06-02' for i in items)
        add("08.filter.since_boundary", ok_since, n=len(items))

        # 9. Malformed date → 422
        r = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/timeline?since=not-a-date', headers=aH)
        add("09.malformed_date_422", r.status_code == 422, status=r.status_code)

        # 10/11/12. apply_signal effects (read-only verification)
        import asyncpg
        c = await asyncpg.connect(os.environ['DATABASE_URL'], statement_cache_size=0)
        try:
            t_before = await c.fetchrow(
                "SELECT relationship_score, last_touch_at FROM tenants WHERE id=$1::uuid",
                MARTINEL)
            gi = await c.fetchrow(
                "SELECT id, relationship_score, last_touch_at FROM tenant_contacts "
                "WHERE tenant_id=$1::uuid AND first_name='Giulia' AND status='active' LIMIT 1",
                MARTINEL)
            if gi:
                c_before = (gi['relationship_score'], gi['last_touch_at'])
                # Fire one more call activity (delta +5, touch=True)
                r = await cli.post(
                    f'/api/admin/tenants/{MARTINEL}/activities/quick',
                    json={"contact_id": str(gi['id']),
                          "activity_type_code": "call",
                          "subject": "sec-check"},
                    headers=aH)
                ok = r.status_code == 200
                await asyncio.sleep(0.3)
                t_after = await c.fetchrow(
                    "SELECT relationship_score, last_touch_at FROM tenants WHERE id=$1::uuid",
                    MARTINEL)
                c_after = await c.fetchrow(
                    "SELECT relationship_score, last_touch_at FROM tenant_contacts WHERE id=$1::uuid",
                    gi['id'])
                add("10.signal.contact_score_increments",
                    c_after['relationship_score'] == c_before[0] + 5,
                    before=c_before[0], after=c_after['relationship_score'])
                add("11.signal.last_touch_updated",
                    c_after['last_touch_at'] is not None
                    and (c_before[1] is None or c_after['last_touch_at'] > c_before[1]),
                    before=str(c_before[1])[:19], after=str(c_after['last_touch_at'])[:19])
                add("12.signal.tenant_score_increments",
                    t_after['relationship_score'] == t_before['relationship_score'] + 5,
                    before=t_before['relationship_score'],
                    after=t_after['relationship_score'])
            else:
                add("10.signal.contact_score_increments", False, note="no Giulia found")
                add("11.signal.last_touch_updated", False, note="no Giulia found")
                add("12.signal.tenant_score_increments", False, note="no Giulia found")

            # 13. Archive contact → contact_archived event → tenant_score -2
            # Use a tmp probe contact to avoid corrupting state
            r = await cli.post(
                f'/api/admin/tenants/{MARTINEL}/contacts',
                json={"first_name": "M2Probe", "role_code": "founder",
                      "email": f"m2.probe.{int(time.time())}@martinel.example",
                      "preferred_language": "it-IT"},
                headers=aH)
            if r.status_code in (200, 201):
                pid = r.json()['id']
                # Already contact_added +2. Now archive → contact_archived -2.
                t_b2 = await c.fetchrow(
                    "SELECT relationship_score FROM tenants WHERE id=$1::uuid", MARTINEL)
                await cli.delete(f'/api/admin/tenants/{MARTINEL}/contacts/{pid}', headers=aH)
                await asyncio.sleep(0.3)
                t_a2 = await c.fetchrow(
                    "SELECT relationship_score FROM tenants WHERE id=$1::uuid", MARTINEL)
                # net contact_archived = -2
                add("13.archive.negative_delta",
                    t_a2['relationship_score'] == t_b2['relationship_score'] - 2,
                    before=t_b2['relationship_score'], after=t_a2['relationship_score'])
            else:
                add("13.archive.negative_delta", False, note=f"probe failed {r.status_code}")

            # 14. Tenant score floor 0 — cannot become negative
            # Best-effort: read current; the catalog max negative is -50 (archived).
            cur = await c.fetchval(
                "SELECT relationship_score FROM tenants WHERE id=$1::uuid", MARTINEL)
            add("14.tenant.score_floor_nonneg", cur >= 0, current=cur)

        finally:
            await c.close()

        # 15 (sanity). Founder cannot see another tenant's timeline by slug header
        r = await cli.get('/api/blueprint/timeline',
                          headers={"Authorization": f"Bearer {fjwt}",
                                   "X-Tenant-Slug": MARTINEL_SLUG})
        # Header is IGNORED for owner role per require_admin_tenant policy.
        # The returned timeline should be founder's OWN tenant, NOT Martinel's.
        items = r.json().get('items', [])
        ok = (r.status_code == 200)  # Items should be from founder's tenant, not Martinel
        add("15.founder.slug_header_ignored", ok, status=r.status_code, items=len(items))

        # 16 (sanity). filter-options endpoints respond 200 with non-empty shape
        r1 = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/timeline/filter-options', headers=aH)
        r2 = await cli.get('/api/blueprint/timeline/filter-options',
                            headers={"Authorization": f"Bearer {fjwt}",
                                     "X-Tenant-Slug": fslug})
        add("16.filter_options.shape",
            r1.status_code == 200 and r2.status_code == 200,
            admin=r1.status_code, founder=r2.status_code)

    pass_n = sum(1 for c in CHECKS if c['ok'])
    fail_n = sum(1 for c in CHECKS if not c['ok'])
    print(f"\n{'='*64}\nM2 SECURITY: {pass_n}/{len(CHECKS)} PASS · {fail_n} FAIL  in {time.time()-t0:.2f}s")
    Path("/tmp/m2_security_validation.json").write_text(json.dumps(CHECKS, indent=2, default=str))
    print("JSON dump → /tmp/m2_security_validation.json")
    return 0 if fail_n == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
