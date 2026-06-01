"""
REAL TENANT SIMULATION™ — End-to-end validation of the Tenant Activation Lifecycle.

Runs the entire visitor → tenant journey, capturing for each step:
  • the API endpoint hit
  • the email(s) dispatched
  • the audit log row(s) generated
  • the DB record(s) updated

Output JSON: /app/memory/REAL_TENANT_SIMULATION/trace.json
"""
import asyncio, json, sys, os, time
from datetime import datetime, timezone
sys.path.insert(0, '/app/backend')

import httpx
from sqlalchemy import text
from database import AsyncSessionLocal

BACKEND = os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001'
ADMIN_HEADERS = {"X-Admin-Key": "dev", "X-Tenant-Slug": "studio"}
SIM_EMAIL = "simulation+e2e@moodfordesign.com"
SIM_NAME  = "E2E Simulation"
TRACE = []

def step(name, **data):
    entry = {"step": name, "ts": datetime.now(timezone.utc).isoformat(), **data}
    TRACE.append(entry)
    print(f"\n── {name} " + "─" * (60 - len(name)))
    for k, v in data.items():
        if isinstance(v, (dict, list)):
            print(f"  {k}: {json.dumps(v, indent=2, default=str)[:600]}")
        else:
            print(f"  {k}: {v}")


async def db_query(sql, **params):
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(text(sql), params)).mappings().all()
        return [dict(r) for r in rows]


async def main():
    request_id = None
    reference = None
    relation_id = None
    tenant_id = None

    async with httpx.AsyncClient(base_url=BACKEND, timeout=30) as cx:
        # ── 1) MANIFEST (public, no auth) ──────────────────────────────
        r = await cx.get('/api/studio/activation/manifest?locale=it')
        step("01_manifest_loaded",
             endpoint="GET /api/studio/activation/manifest?locale=it",
             status_code=r.status_code,
             archetypes_count=len(r.json().get('archetypes', [])))

        # ── 2) CREATE DRAFT ─────────────────────────────────────────────
        r = await cx.post('/api/studio/activation/draft', json={})
        d = r.json()
        draft_token = d['draft_token']
        step("02_draft_created",
             endpoint="POST /api/studio/activation/draft",
             status_code=r.status_code,
             draft_token=draft_token,
             current_movement=d.get('current_movement'))

        # ── 3) PATCH DRAFT with identity payload ───────────────────────
        identity = {
            "studio_name":  "Studio Simulazione E2E",
            "monogram":     "SE",
            "city":         "Milano",
            "country":      "IT",
            "languages":    ["it", "en"],
            "markets":      ["IT", "FR", "DE"],
            "temperament":  "editoriale",
            "atelier":      [],
            # Advisor attribution (simulates the visitor having arrived via
            # ?ref=ADV-80A9C5 — advisor Raffaella's referral link).
            "attribution_advisor_id": "4d67d793-c3f7-4d73-9e36-72361d39a030",
        }
        r = await cx.patch('/api/studio/activation/draft', json={
            "draft_token": draft_token,
            "archetype":   "interior_studio",
            "experiences": ["design_journey_os", "material_intelligence"],
            "payload":     identity,
            "movement":    "identity",
        })
        step("03_draft_patched_identity",
             endpoint="PATCH /api/studio/activation/draft",
             status_code=r.status_code,
             archetype="interior_studio",
             experiences_count=2,
             identity_keys=list(identity.keys()))

        # ── 4) SUBMIT REQUEST (visitor) ─────────────────────────────────
        before_log = await db_query(
            "SELECT COUNT(*) AS n FROM studio_email_dispatch_log")
        r = await cx.post('/api/studio/activation/submit', json={
            "draft_token":   draft_token,
            "contact_email": SIM_EMAIL,
            "contact_name":  SIM_NAME,
            "contact_role":  "Founder",
            "phone_prefix":  "+39",
            "phone_number":  "0000000000",
            "website":       "https://example.com",
            "notes":         "E2E real-tenant simulation",
            "locale":        "it",
        })
        sub = r.json()
        request_id = sub.get('request_id')
        reference  = sub.get('reference')
        step("04_submit_request",
             endpoint="POST /api/studio/activation/submit",
             status_code=r.status_code,
             response=sub)

        # Allow async email tasks to flush
        await asyncio.sleep(2.5)

        # Inspect emails fired
        after_log = await db_query(
            "SELECT template_key, to_email, status, subject FROM studio_email_dispatch_log "
            "WHERE to_email IN (:em, :adm) "
            "  AND created_at >= NOW() - INTERVAL '30 seconds' "
            "ORDER BY created_at",
            em=SIM_EMAIL, adm="admin@moodfordesign.com")
        step("05_submit_emails_audit",
             endpoint="DB studio_email_dispatch_log",
             before_count=before_log[0]['n'],
             after_count=before_log[0]['n'] + len(after_log),
             emails_fired=after_log)

        # Inspect studio_requests row
        sr = await db_query(
            "SELECT id, studio_name, contact_email, status, archetype, locale, "
            "created_at FROM studio_requests WHERE id = :id", id=request_id)
        step("06_studio_request_record",
             endpoint="DB studio_requests",
             record=sr[0] if sr else None)

        # ── 5) OPEN RELATION FROM REQUEST (super admin) ────────────────
        r = await cx.post(f'/api/admin/relations/from-request/{request_id}',
                          headers=ADMIN_HEADERS, json={})
        rel = r.json()
        relation_id = rel.get('relation_id') or rel.get('id')
        step("07_relation_opened",
             endpoint=f"POST /api/admin/relations/from-request/{request_id}",
             status_code=r.status_code,
             response=rel)

        # ── 6) STATUS → reviewing (super admin) ────────────────────────
        r = await cx.patch(f'/api/admin/studio/requests/{request_id}',
                           headers=ADMIN_HEADERS,
                           json={"status": "reviewing"})
        step("08_status_reviewing",
             endpoint=f"PATCH /api/admin/studio/requests/{request_id}",
             status_code=r.status_code,
             body={"status": "reviewing"},
             response=r.json())

        await asyncio.sleep(2.0)
        emails = await db_query(
            "SELECT template_key, to_email, status, subject FROM studio_email_dispatch_log "
            "WHERE to_email = :em AND template_key = 'studio_request_review' "
            "ORDER BY created_at DESC LIMIT 1",
            em=SIM_EMAIL)
        step("09_reviewing_email_audit",
             endpoint="DB studio_email_dispatch_log",
             expected_template="studio_request_review",
             found=emails)

        # ── 7) STATUS → qualified ──────────────────────────────────────
        r = await cx.patch(f'/api/admin/studio/requests/{request_id}',
                           headers=ADMIN_HEADERS,
                           json={"status": "qualified",
                                 "advisor_notes": "E2E qualified"})
        step("10_status_qualified",
             endpoint=f"PATCH /api/admin/studio/requests/{request_id}",
             status_code=r.status_code,
             response=r.json())

        await asyncio.sleep(2.0)
        emails = await db_query(
            "SELECT template_key, to_email, status, subject FROM studio_email_dispatch_log "
            "WHERE to_email = :em AND template_key = 'studio_request_qualified' "
            "ORDER BY created_at DESC LIMIT 1",
            em=SIM_EMAIL)
        step("11_qualified_email_audit",
             endpoint="DB studio_email_dispatch_log",
             expected_template="studio_request_qualified",
             found=emails)

        # ── 8) ACTIVATE ECOSYSTEM (creates tenant + founder + magic link)
        r = await cx.post(f'/api/admin/relations/{relation_id}/activate-ecosystem',
                          headers=ADMIN_HEADERS, json={})
        act = r.json()
        tenant_id = act.get('tenant_id')
        step("12_activate_ecosystem",
             endpoint=f"POST /api/admin/relations/{relation_id}/activate-ecosystem",
             status_code=r.status_code,
             response=act)

        await asyncio.sleep(3.0)
        # activate_studio_ecosystem now schedules an async task to fire
        # studio_request_approved (see services/studio_relations.py).
        emails = await db_query(
            "SELECT template_key, to_email, status, subject FROM studio_email_dispatch_log "
            "WHERE to_email = :em AND template_key = 'studio_request_approved' "
            "ORDER BY created_at DESC LIMIT 1",
            em=SIM_EMAIL)
        step("13_activated_email_audit",
             endpoint="DB studio_email_dispatch_log",
             expected_template="studio_request_approved",
             found=emails,
             gap_detected=not emails)

        # ── 9) TENANT + FOUNDER + MAGIC LINK ───────────────────────────
        if tenant_id:
            tn = await db_query(
                "SELECT id, slug, name, status, default_locale_code, "
                "active_plan, plan_assigned_at FROM tenants WHERE id = :id",
                id=tenant_id)
            step("14_tenant_record",
                 endpoint="DB tenants",
                 record=tn[0] if tn else None)

            fu = await db_query(
                "SELECT id, email, full_name, role, tenant_id, "
                "is_active FROM users WHERE tenant_id = :id",
                id=tenant_id)
            step("15_founder_user",
                 endpoint="DB users",
                 record=fu[0] if fu else None)

            ml = await db_query(
                "SELECT id, email_attempt AS email, token_hash, expires_at, "
                "  consumed_at, created_at "
                "FROM access_magic_links WHERE email_attempt = :em "
                "ORDER BY created_at DESC LIMIT 1",
                em=SIM_EMAIL)
            step("16_magic_link",
                 endpoint="DB access_magic_links",
                 record=ml[0] if ml else None,
                 magic_link_issued=bool(ml))

        # ── 10) FULL EMAIL TIMELINE for the request ────────────────────
        all_emails = await db_query(
            "SELECT template_key, to_email, locale, status, subject, "
            "  created_at, external_id "
            "FROM studio_email_dispatch_log "
            "WHERE to_email IN (:em, :adm, :adv) "
            "  AND created_at >= NOW() - INTERVAL '5 minutes' "
            "ORDER BY created_at",
            em=SIM_EMAIL, adm="admin@moodfordesign.com",
            adv="raffaella@moodfordesign.com")
        step("17_full_email_timeline",
             endpoint="DB studio_email_dispatch_log",
             total_emails=len(all_emails),
             timeline=all_emails)

        # ── 11) ASSERTIONS ─────────────────────────────────────────────
        assertions = {
            "submit_visitor_email":  any(e['template_key'] == 'studio_request_received' and e['to_email'] == SIM_EMAIL for e in all_emails),
            "submit_admin_email":    any(e['template_key'] == 'admin_new_studio_request' for e in all_emails),
            "submit_advisor_email":  any(e['template_key'] == 'advisor_new_lead' for e in all_emails),
            "reviewing_email":       any(e['template_key'] == 'studio_request_review' and e['to_email'] == SIM_EMAIL for e in all_emails),
            "qualified_email":       any(e['template_key'] == 'studio_request_qualified' and e['to_email'] == SIM_EMAIL for e in all_emails),
            "activated_email":       any(e['template_key'] == 'studio_request_approved' and e['to_email'] == SIM_EMAIL for e in all_emails),
            "tenant_created":        bool(tenant_id),
            "founder_user_created":  bool(fu) if tenant_id else False,
            "magic_link_issued":     bool(ml) if tenant_id else False,
        }
        all_pass = all(assertions.values())
        step("18_final_assertions",
             assertions=assertions,
             classification="PASS" if all_pass else "FAIL")

    # Save trace
    os.makedirs('/app/memory/REAL_TENANT_SIMULATION', exist_ok=True)
    with open('/app/memory/REAL_TENANT_SIMULATION/trace.json', 'w') as f:
        json.dump({"trace": TRACE, "request_id": request_id,
                   "reference": reference,
                   "relation_id": relation_id,
                   "tenant_id": tenant_id,
                   "classification": "PASS" if all_pass else "FAIL"},
                  f, indent=2, default=str)
    print(f"\n=== CLASSIFICATION: {'PASS' if all_pass else 'FAIL'} ===")
    print("Trace saved to /app/memory/REAL_TENANT_SIMULATION/trace.json")


if __name__ == '__main__':
    asyncio.run(main())
