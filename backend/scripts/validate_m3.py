"""M3 Validation — Activity Log Advanced™
============================================

14 functional (F1-F14) + 18 security (S1-S18) = 32 check.

Run: `python scripts/validate_m3.py`
"""
from __future__ import annotations
import asyncio, os, sys, json, time, base64
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import httpx, asyncpg

BASE = os.environ.get("BASE_URL")
if not BASE:
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.strip().startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().strip('"')

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PWD   = "MoodAdmin2026!"
MARTINEL = "c64659f6-5a76-41dd-8d8d-b901d29862af"

CHECKS: list[dict] = []
def add(name: str, ok: bool, **kw):
    CHECKS.append({"name": name, "ok": ok, **kw})
    print(f"  {'✅' if ok else '❌'} {name}  " + " ".join(f"{k}={v}" for k, v in kw.items()))


async def _get_founder_jwt(cli: httpx.AsyncClient) -> dict:
    """Generate a real founder JWT via dry_run_fresh_lead, then magic-link consume."""
    from scripts.dry_run_fresh_lead import main as mk_lead
    import io, contextlib, re
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        await mk_lead()
    m = re.search(r'\{.*\}', buf.getvalue(), re.DOTALL)
    data = json.loads(m.group(0))
    tok = data['magic_link_url'].split('token=')[1]
    r = await cli.post('/api/auth/magic-link/consume', json={"token": tok})
    body = r.json()
    return {"jwt": body['jwt'], "slug": body['tenant']['slug'],
            "tid": body['tenant']['id'], "user_id": body.get('user', {}).get('id')}


async def main() -> int:
    t0 = time.time()
    async with httpx.AsyncClient(timeout=60, base_url=BASE) as cli:
        # Setup admin JWT
        r = await cli.post('/api/auth/login', json={
            "email": ADMIN_EMAIL, "password": ADMIN_PWD})
        admin_token = r.json()['token']
        admin_uid = r.json()['user']['id']
        aH = {"Authorization": f"Bearer {admin_token}"}

        # Setup founder JWT
        f = await _get_founder_jwt(cli)
        fH = {"Authorization": f"Bearer {f['jwt']}", "X-Tenant-Slug": f['slug']}
        print(f"[setup] founder slug={f['slug']} tid={f['tid'][:8]}… uid={(f['user_id'] or '')[:8]}…")
        print(f"[setup] admin uid={admin_uid[:8]}…\n")

        # =============================================================
        # FUNCTIONAL (F1-F14)
        # =============================================================
        # F1: POST meeting (M1 rejected with 422)
        r = await cli.post(f'/api/admin/tenants/{MARTINEL}/activities',
                            json={"activity_type_code": "meeting",
                                  "subject": "F1 meeting test"}, headers=aH)
        add("F1.post_meeting_accepted", r.status_code == 200, status=r.status_code)
        meeting_id = r.json().get('id') if r.status_code == 200 else None

        # F2: Response includes 7 new fields
        body = r.json() if r.status_code == 200 else {}
        expected_keys = {'notes', 'completed_at', 'created_by', 'importance',
                         'sentiment', 'source_code', 'activity_outcome_code'}
        add("F2.response_has_new_fields",
            expected_keys.issubset(set(body.keys())) if body else False,
            present=len(expected_keys & set(body.keys())) if body else 0,
            total=len(expected_keys))

        # F3: Activity with next_step_due_at appears in open-followups
        r = await cli.post(f'/api/admin/tenants/{MARTINEL}/activities',
                            json={"activity_type_code": "call",
                                  "subject": "F3 pending",
                                  "next_step": "Followup",
                                  "next_step_due_at": "2026-07-01T10:00:00Z"},
                            headers=aH)
        pending_id = r.json().get('id') if r.status_code == 200 else None
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/open-followups',
                           headers=aH)
        items = r.json().get('items', [])
        add("F3.open_followups_lists_pending",
            any(i['id'] == pending_id for i in items),
            total=len(items))

        # F4: complete removes from open
        r = await cli.post(
            f'/api/admin/tenants/{MARTINEL}/activities/{pending_id}/complete',
            json={"activity_outcome_code": "completed"}, headers=aH)
        ok4 = r.status_code == 200 and r.json().get('completed_at') is not None
        r2 = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/open-followups',
                            headers=aH)
        add("F4.complete_removes_from_open",
            ok4 and not any(i['id'] == pending_id for i in r2.json().get('items', [])),
            completed_at_set=ok4)

        # F5: reopen
        r = await cli.post(
            f'/api/admin/tenants/{MARTINEL}/activities/{pending_id}/reopen', headers=aH)
        add("F5.reopen_clears_completed_at",
            r.status_code == 200 and r.json().get('completed_at') is None,
            status=r.status_code)

        # F6: filter by activity_outcome_code
        r = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/activities/v2?activity_outcome_code=completed',
            headers=aH)
        items = r.json().get('items', [])
        ok6 = all(i.get('activity_outcome_code') == 'completed' for i in items)
        add("F6.filter_outcome_code", ok6 and r.status_code == 200,
            n=len(items))

        # F7: FTS search
        await cli.post(f'/api/admin/tenants/{MARTINEL}/activities',
                        json={"activity_type_code": "internal_note",
                              "subject": "Onboarding masterclass",
                              "notes": "Studio aderente onboarding completo"},
                        headers=aH)
        r = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/activities/search?q=onboarding',
            headers=aH)
        items = r.json().get('items', [])
        add("F7.fts_search_works",
            r.status_code == 200 and len(items) >= 1, n=len(items))

        # F8: Activity appears in v_relationship_timeline (M2)
        r = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/timeline?type_codes=meeting&limit=50',
            headers=aH)
        items = r.json().get('items', [])
        add("F8.activity_in_timeline_view",
            any(i.get('id') == meeting_id for i in items), n=len(items))

        # F9: type change meeting→visit applies delta (+8 reverted, +10 applied → +2 net on tenant)
        c = await asyncpg.connect(os.environ['DATABASE_URL'], statement_cache_size=0)
        try:
            t_before = await c.fetchval(
                "SELECT relationship_score FROM tenants WHERE id=$1::uuid", MARTINEL)
            r = await cli.patch(
                f'/api/admin/tenants/{MARTINEL}/activities/{meeting_id}',
                json={"activity_type_code": "visit"}, headers=aH)
            await asyncio.sleep(0.3)
            t_after = await c.fetchval(
                "SELECT relationship_score FROM tenants WHERE id=$1::uuid", MARTINEL)
            add("F9.type_change_delta_net",
                r.status_code == 200 and (t_after - t_before) == 2,
                before=t_before, after=t_after, delta_net=t_after - t_before)
        finally:
            await c.close()

        # F10: cursor pagination no overlap
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/v2?limit=3',
                           headers=aH)
        page1 = r.json()
        ids1 = {i['id'] for i in page1.get('items', [])}
        cur = page1.get('next_cursor')
        if cur:
            cur_b64 = base64.urlsafe_b64encode(json.dumps(cur).encode()).decode().rstrip('=')
            # base64 padding-safe
            cur_b64 = base64.urlsafe_b64encode(json.dumps(cur).encode()).decode()
            r = await cli.get(
                f'/api/admin/tenants/{MARTINEL}/activities/v2',
                params={"limit": 3, "cursor": cur_b64}, headers=aH)
            ids2 = {i['id'] for i in r.json().get('items', [])}
            add("F10.cursor_no_overlap",
                r.status_code == 200 and ids1 and ids2 and not (ids1 & ids2),
                page1=len(ids1), page2=len(ids2), overlap=len(ids1 & ids2))
        else:
            add("F10.cursor_no_overlap", True, note="single_page")

        # F11: archive is soft (row preserved in DB, hidden from active timeline feed)
        r = await cli.delete(f'/api/admin/tenants/{MARTINEL}/activities/{meeting_id}',
                              headers=aH)
        ok11_archive = r.status_code == 200
        # Row still readable via direct GET (audit trail preserved)
        r_get = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/{meeting_id}',
                               headers=aH)
        row_preserved = (r_get.status_code == 200
                         and r_get.json().get('archived_at') is not None)
        # Hidden from active timeline feed (M0 view filters archived_at IS NULL)
        r2 = await cli.get(
            f'/api/admin/tenants/{MARTINEL}/timeline?type_codes=visit&limit=200',
            headers=aH)
        hidden_from_feed = not any(i.get('id') == meeting_id
                                    for i in r2.json().get('items', []))
        add("F11.archive_soft_audit_preserved",
            ok11_archive and row_preserved and hidden_from_feed,
            archived=ok11_archive, row_preserved=row_preserved,
            hidden_from_feed=hidden_from_feed)

        # F12: persist outcome_code
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/{pending_id}',
                           headers=aH)
        add("F12.outcome_persisted",
            r.status_code == 200 and r.json().get('activity_outcome_code') is not None,
            value=r.json().get('activity_outcome_code'))

        # F13: persist source_code (advisor default from admin router)
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/{pending_id}',
                           headers=aH)
        add("F13.source_persisted",
            r.status_code == 200 and r.json().get('source_code') in ('advisor', 'manual'),
            value=r.json().get('source_code'))

        # F14: DELETE is soft
        c = await asyncpg.connect(os.environ['DATABASE_URL'], statement_cache_size=0)
        try:
            row = await c.fetchrow(
                "SELECT archived_at FROM relationship_activities WHERE id=$1::uuid",
                meeting_id)
            add("F14.delete_is_soft", row and row['archived_at'] is not None,
                archived_at=str(row['archived_at']) if row else "row_gone")
        finally:
            await c.close()

        # =============================================================
        # SECURITY (S1-S18)
        # =============================================================
        # S1: anon
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/v2')
        add("S1.anon_admin_401", r.status_code in (401, 403), status=r.status_code)

        # S2: founder → other tenant
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/v2', headers=fH)
        add("S2.founder_cross_tenant_403",
            r.status_code in (401, 403, 404), status=r.status_code)

        # S3-S4: founder POST owner/created_by forced to self
        r = await cli.post('/api/blueprint/activities',
                            json={"activity_type_code": "call",
                                  "subject": "S3 test",
                                  "owner_user_id": admin_uid,        # tentativo escalation
                                  "created_by": admin_uid},
                            headers=fH)
        founder_act = r.json() if r.status_code == 200 else {}
        add("S3.founder_post_owner_forced_self",
            founder_act.get('owner_user_id') == f['user_id'],
            owner=founder_act.get('owner_user_id'))
        add("S4.founder_post_created_by_forced_self",
            founder_act.get('created_by') == f['user_id'],
            created_by=founder_act.get('created_by'))
        founder_act_id = founder_act.get('id')

        # S5-S9: PATCH strips
        if founder_act_id:
            r = await cli.patch(f'/api/blueprint/activities/{founder_act_id}',
                                 json={"subject": "S5 patched",
                                       "owner_user_id": admin_uid,
                                       "created_by": admin_uid,
                                       "tenant_id": MARTINEL,
                                       "archived_at": "2026-06-02T00:00:00Z",
                                       "created_at": "2020-01-01T00:00:00Z"},
                                 headers=fH)
            patched = r.json() if r.status_code == 200 else {}
            add("S5.patch_strip_owner",
                patched.get('owner_user_id') == f['user_id'],
                owner=patched.get('owner_user_id'))
            add("S6.patch_strip_created_by",
                patched.get('created_by') == f['user_id'],
                created_by=patched.get('created_by'))
            add("S7.patch_strip_tenant_id",
                str(patched.get('tenant_id')) == f['tid'],
                tenant_id=patched.get('tenant_id'))
            add("S8.patch_strip_archived_at",
                patched.get('archived_at') is None,
                archived_at=patched.get('archived_at'))
            add("S9.patch_strip_created_at",
                patched.get('created_at') and not str(patched.get('created_at')).startswith('2020'),
                created_at=patched.get('created_at'))
        else:
            for n in ("S5", "S6", "S7", "S8", "S9"):
                add(f"{n}.patch_strip", False, note="founder_act creation failed")

        # S10: Founder DELETE on activity NOT created by self → 403 (need an
        # admin-created activity in founder's own tenant). Create one via
        # admin endpoint with founder's tenant.
        r = await cli.post(f'/api/admin/tenants/{f["tid"]}/activities',
                            json={"activity_type_code": "call",
                                  "subject": "S10 admin-created on founder tenant"},
                            headers=aH)
        admin_act_in_founder_tenant = r.json().get('id') if r.status_code == 200 else None
        if admin_act_in_founder_tenant:
            r = await cli.delete(f'/api/blueprint/activities/{admin_act_in_founder_tenant}',
                                  headers=fH)
            add("S10.founder_cant_delete_others",
                r.status_code == 403,
                status=r.status_code,
                detail=r.json().get('detail', {}).get('code', '?') if r.text else '')
        else:
            add("S10.founder_cant_delete_others", False, note="setup failed")

        # S11: founder CAN delete own
        if founder_act_id:
            r = await cli.delete(f'/api/blueprint/activities/{founder_act_id}',
                                  headers=fH)
            add("S11.founder_can_delete_own", r.status_code == 200, status=r.status_code)
        else:
            add("S11.founder_can_delete_own", False, note="no founder_act")

        # S12: founder can complete admin-created
        if admin_act_in_founder_tenant:
            r = await cli.post(
                f'/api/blueprint/activities/{admin_act_in_founder_tenant}/complete',
                json={}, headers=fH)
            add("S12.founder_can_complete_others_activity",
                r.status_code == 200, status=r.status_code)
        else:
            add("S12.founder_can_complete_others_activity", False, note="setup failed")

        # S13: invalid activity_type_code → 422
        r = await cli.post(f'/api/admin/tenants/{MARTINEL}/activities',
                            json={"activity_type_code": "ZZ_NONEXISTENT"}, headers=aH)
        add("S13.invalid_type_422", r.status_code == 422, status=r.status_code)

        # S14: invalid outcome → 422
        r = await cli.post(f'/api/admin/tenants/{MARTINEL}/activities',
                            json={"activity_type_code": "call",
                                  "activity_outcome_code": "ZZ_BAD_OUTCOME"},
                            headers=aH)
        add("S14.invalid_outcome_422", r.status_code == 422, status=r.status_code)

        # S15: invalid source → 422
        r = await cli.post(f'/api/admin/tenants/{MARTINEL}/activities',
                            json={"activity_type_code": "call",
                                  "source_code": "ZZ_BAD_SOURCE"},
                            headers=aH)
        add("S15.invalid_source_422", r.status_code == 422, status=r.status_code)

        # S16: cursor cross-tenant safe (cursor from Martinel doesn't leak data when used on founder tenant)
        r = await cli.get(f'/api/admin/tenants/{MARTINEL}/activities/v2?limit=3',
                           headers=aH)
        cur = r.json().get('next_cursor')
        if cur:
            cur_b64 = base64.urlsafe_b64encode(json.dumps(cur).encode()).decode()
            r = await cli.get(
                f'/api/blueprint/activities/v2',
                params={"limit": 50, "cursor": cur_b64}, headers=fH)
            items = r.json().get('items', [])
            # Founder tenant id should be on each row
            leak = [i for i in items if str(i.get('tenant_id')) != f['tid']]
            add("S16.cursor_cross_tenant_safe",
                r.status_code == 200 and not leak,
                items=len(items), leak=len(leak))
        else:
            add("S16.cursor_cross_tenant_safe", True, note="no cursor")

        # S17: meeting/visit/task accepted (catalog-only, no whitelist)
        codes_ok = 0
        for code in ("meeting", "visit", "task"):
            r = await cli.post(f'/api/admin/tenants/{MARTINEL}/activities',
                                json={"activity_type_code": code,
                                      "subject": f"S17 {code}"}, headers=aH)
            if r.status_code == 200:
                codes_ok += 1
        add("S17.removed_M1_whitelist", codes_ok == 3, accepted=codes_ok)

        # S18: backward compat /activities/quick
        r = await cli.post(f'/api/admin/tenants/{MARTINEL}/activities/quick',
                            json={"activity_type_code": "call",
                                  "subject": "S18 quick compat"}, headers=aH)
        add("S18.quick_endpoint_compat", r.status_code == 200, status=r.status_code)

    pass_n = sum(1 for c in CHECKS if c['ok'])
    fail_n = sum(1 for c in CHECKS if not c['ok'])
    print(f"\n{'='*64}\nM3 VALIDATION: {pass_n}/{len(CHECKS)} PASS · {fail_n} FAIL  in {time.time()-t0:.2f}s")
    Path("/tmp/m3_validation.json").write_text(json.dumps(CHECKS, indent=2, default=str))
    print("JSON dump → /tmp/m3_validation.json")
    return 0 if fail_n == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
