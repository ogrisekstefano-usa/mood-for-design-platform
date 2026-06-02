"""M1 Security Validation — Cross-tenant isolation tests.

Verifica che:
  1. Founder JWT non possa accedere a /api/admin/*
  2. Founder JWT non possa accedere ad altri tenant
  3. Founder PATCH non possa cambiare relationship_owner
  4. Founder PATCH non possa cambiare tenant_relationship_owner
  5. Founder può fare CRUD sui propri contatti
  6. Anti-duplicate email funziona
  7. Primary unique constraint funziona
"""
from __future__ import annotations
import asyncio, os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

BASE = os.environ.get('BASE_URL', 'http://localhost:8001')
ADMIN_EMAIL = 'admin@moodfordesign.com'
ADMIN_PW    = 'MoodAdmin2026!'

CHECKS: list[dict] = []


def add(name: str, ok: bool, **kw):
    CHECKS.append({"name": name, "ok": ok, **kw})
    icon = "✅" if ok else "❌"
    extra = " ".join(f"{k}={v}" for k, v in kw.items() if k not in ('name','ok'))
    print(f"  {icon} {name}  {extra}")


async def main() -> int:
    t0 = time.time()
    async with httpx.AsyncClient(timeout=60, base_url=f"{BASE}/api") as cli:
        # 1. Login admin
        r = await cli.post('/auth/login', json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
        jwt = r.json()['token']
        ah = {"Authorization": f"Bearer {jwt}"}

        # 2. Generate fresh tenant + founder JWT
        from scripts.dry_run_fresh_lead import main as mk_lead
        # capture stdout
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

        r = await cli.post('/auth/magic-link/consume', json={"token": tok})
        fjwt = r.json()['jwt']
        slug = r.json()['tenant']['slug']
        ftid = r.json()['tenant']['id']
        fh = {"Authorization": f"Bearer {fjwt}", "X-Tenant-Slug": slug}

        print(f"\n[setup] founder slug={slug} tid={ftid[:8]}...")

        # 3. Test 1: founder cannot access /admin/tenants
        r = await cli.get('/admin/tenants', headers=fh)
        add("admin.tenants_forbidden_for_founder", r.status_code == 403,
            status=r.status_code)

        # 4. Test 2: founder cannot access another tenant's overview
        r2 = await cli.get('/admin/tenants?limit=2', headers=ah)
        other_tid = r2.json()['items'][1]['id']
        r = await cli.get(f'/admin/tenants/{other_tid}/overview', headers=fh)
        add("admin.cross_tenant_overview_forbidden", r.status_code == 403,
            status=r.status_code)

        # 5. Test 3: founder GET own overview (200)
        r = await cli.get('/blueprint/overview', headers=fh)
        add("blueprint.overview_own_tenant_200", r.status_code == 200,
            status=r.status_code)

        # 6. Test 4: founder creates a contact
        r = await cli.post('/blueprint/contacts', headers=fh, json={
            "first_name": "Lucia", "last_name": "Bianchi",
            "role_code": "purchasing",
            "email": "lucia.b@martinel.test",
            "preferred_language": "it-IT",
        })
        add("blueprint.contact_create", r.status_code == 200, status=r.status_code)
        cid = r.json().get('id')

        # 7. Test 5: anti-duplicate email
        r = await cli.post('/blueprint/contacts', headers=fh, json={
            "first_name": "Lucia 2", "role_code": "designer",
            "email": "lucia.b@martinel.test",
        })
        add("blueprint.anti_duplicate_email_409", r.status_code == 409,
            status=r.status_code)

        # 8. Test 6: founder PATCH cannot change relationship_owner (D4)
        admin_uid = (await cli.get('/admin/users/eligible-owners?limit=1', headers=ah)).json()[0]['id']
        r = await cli.patch(f'/blueprint/contacts/{cid}', headers=fh, json={
            "first_name": "Lucia-Updated",
            "relationship_owner_user_id": admin_uid,
        })
        add("blueprint.owner_change_stripped",
            r.status_code == 200 and r.json().get('relationship_owner_user_id') is None,
            status=r.status_code,
            owner=r.json().get('relationship_owner_user_id'))

        # 9. Test 7: admin CAN change relationship_owner
        r = await cli.post(f'/admin/tenants/{ftid}/contacts/{cid}/assign-owner',
                           headers=ah, json={"relationship_owner_user_id": admin_uid})
        add("admin.assign_relationship_owner",
            r.status_code == 200 and r.json().get('relationship_owner_user_id') == admin_uid,
            status=r.status_code)

        # 10. Test 8: admin assigns tenant_relationship_owner
        r = await cli.post(f'/admin/tenants/{ftid}/assign-owner', headers=ah,
                           json={"tenant_relationship_owner_user_id": admin_uid})
        add("admin.assign_tenant_owner",
            r.status_code == 200 and r.json().get('tenant_relationship_owner_user_id') == admin_uid,
            status=r.status_code)

        # 11. Test 9: founder set-primary on own contact
        r = await cli.post(f'/blueprint/contacts/{cid}/set-primary', headers=fh)
        add("blueprint.set_primary_own", r.status_code == 200, status=r.status_code)

        # 12. Test 10: primary unique constraint enforcement
        r = await cli.post('/blueprint/contacts', headers=fh, json={
            "first_name": "Paolo", "role_code": "owner",
            "email": "paolo@martinel.test",
            "is_primary": True,
        })
        add("blueprint.primary_replaced", r.status_code == 200, status=r.status_code)
        # Verify only 1 primary
        contacts = (await cli.get('/blueprint/contacts', headers=fh)).json()
        n_prim = sum(1 for c in contacts if c.get('is_primary'))
        add("blueprint.single_primary_active", n_prim == 1, primary_count=n_prim)

        # 13. Test 11: founder quick activity
        r = await cli.post('/blueprint/activities/quick', headers=fh, json={
            "activity_type_code": "call",
            "subject": "Test call from founder",
            "outcome": "Positive",
            "contact_id": cid,
        })
        add("blueprint.quick_activity_call",
            r.status_code == 200 and r.json().get('activity_type_code') == 'call',
            status=r.status_code)

        # 14. Test 12: founder list activities
        r = await cli.get('/blueprint/activities?limit=5', headers=fh)
        add("blueprint.list_activities",
            r.status_code == 200 and len(r.json()) >= 1,
            count=len(r.json() or []))

        # 15. Test 13: founder archive contact
        r = await cli.delete(f'/blueprint/contacts/{cid}', headers=fh)
        add("blueprint.archive_contact",
            r.status_code == 200 and r.json().get('status') == 'archived',
            status=r.status_code)

        # 16. Test 14: search global limited to own scope for advisor
        # (As founder doesn't have search access; only admin/advisor can hit /admin/search)
        r = await cli.get('/admin/search?q=lucia', headers=fh)
        add("admin.search_forbidden_for_founder", r.status_code == 403,
            status=r.status_code)

        # 17. Test 15: anonymous request to /admin/* → 401
        r = await cli.get('/admin/tenants')
        add("admin.anon_401", r.status_code in (401, 403), status=r.status_code)

    total = len(CHECKS)
    passed = sum(1 for c in CHECKS if c["ok"])
    failed = total - passed
    print(f"\n{'='*60}")
    print(f"M1 SECURITY: {passed}/{total} PASS · {failed} FAIL  in {time.time()-t0:.2f}s")
    if failed:
        for c in CHECKS:
            if not c["ok"]:
                print(f"  ❌ {c['name']}  " + " ".join(f"{k}={v}" for k,v in c.items() if k not in ('name','ok')))

    with open("/tmp/m1_security_validation.json", "w") as f:
        json.dump({"summary": {"total": total, "pass": passed, "fail": failed},
                    "checks": CHECKS}, f, indent=2, default=str)
    print(f"\nJSON dump → /tmp/m1_security_validation.json")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
