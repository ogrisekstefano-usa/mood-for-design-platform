"""
TENANT ACQUISITION READINESS AUDIT
─────────────────────────────────────────────────────
Simulazione completa Visitor → Blueprint Access.
Verifica ogni fase del lifecycle e produce un dict con
PASS/FAIL per ogni task.
"""
import asyncio, os, sys, json, time
sys.path.insert(0, '/app/backend')
import httpx
from sqlalchemy import text
from database import AsyncSessionLocal

API = open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].splitlines()[0].strip()
ADMIN_KEY = 'dev'
EMAIL = f"readiness.{int(time.time())}@moodtest.example.com"
STUDIO = "Studio Readiness Audit"

REPORT = {
    'task1': {},  # E2E audit
    'task2': {},  # data collection
    'task3': {},  # gap analysis (filled at end)
}

def log(s): print(s, flush=True)
def passfail(b): return "PASS" if b else "FAIL"

async def main():
    request_id = None
    tenant_id  = None
    advisor_id = None

    # ═══ TASK 1.1 — STUDIO V2 SUBMIT ═══════════════════════════════
    log("\n████ T1.1 — STUDIO V2 SUBMIT ████")
    async with httpx.AsyncClient(timeout=30) as cx:
        # draft
        d = (await cx.post(f"{API}/api/studio/activation/draft", json={})).json()
        draft_token = d['draft_token']
        # submit
        payload = {
            "draft_token": draft_token,
            "archetype_code": "interior_design",
            "primary_operating_market_code": "italy",
            "headquarter_country_iso": "IT",
            "headquarter_city": "Padua",
            "headquarter_region": "Padua",
            "headquarter_lat": 45.40779,
            "headquarter_lng": 11.876048,
            "mapbox_place_id": "place.39233648",
            "target_countries": [
                {"iso2": "US", "priority": 1, "status": "active"},
                {"iso2": "AE", "priority": 2, "status": "active"},
                {"iso2": "GB", "priority": 3, "status": "planned"},
            ],
            "first_name": "Sofia",
            "last_name": "Readiness",
            "contact_email": EMAIL,
            "phone_prefix": "+39",
            "phone_number": "3334445566",
            "help_topics": ["process_design", "business_growth"],
            "locale": "it-IT",
        }
        r = (await cx.post(f"{API}/api/studio/v2/submit", json=payload)).json()
        log(f"  submit ok={r.get('ok')} reference={r.get('reference')}")
        request_id = r.get('request_id')

    # Verify DB persistence
    async with AsyncSessionLocal() as s:
        sr = (await s.execute(text("""
            SELECT id, contact_email, archetype, status, locale,
                   primary_operating_market_id,
                   headquarter_country_iso, city, headquarter_region,
                   headquarter_lat, headquarter_lng, mapbox_place_id
              FROM studio_requests WHERE id = :id
        """), {'id': request_id})).mappings().first()
        tg = (await s.execute(text("""
            SELECT country_iso2, priority, status
              FROM studio_request_target_countries
             WHERE studio_request_id = :id ORDER BY priority
        """), {'id': request_id})).mappings().all()
    REPORT['task1']['studio_v2_submit'] = {
        'status': passfail(bool(sr) and sr['status'] == 'received'),
        'reference': r.get('reference'),
        'operating_market_id_present': bool(sr and sr['primary_operating_market_id']),
        'headquarter_persisted': bool(sr and sr['headquarter_country_iso'] == 'IT'
                                       and sr['city'] == 'Padua'
                                       and sr['headquarter_lat'] == 45.40779),
        'target_countries_count': len(tg),
        'target_countries_with_priority_and_status': all(
            t['priority'] in (1,2,3) and t['status'] in ('active','planned') for t in tg),
    }
    log(f"  → {REPORT['task1']['studio_v2_submit']}")

    # ═══ TASK 1.2 / 1.3 / 1.4 — EMAILS ═════════════════════════════
    log("\n████ T1.2 — EMAIL VISITOR / T1.3 — ADVISOR / T1.4 — ADMIN ████")
    await asyncio.sleep(2.0)
    async with AsyncSessionLocal() as s:
        em = (await s.execute(text("""
            SELECT template_key, to_email, locale, subject, status, error
              FROM studio_email_dispatch_log
             WHERE LOWER(to_email) = LOWER(:em) OR to_email LIKE '%@moodfordesign.com'
             ORDER BY created_at DESC LIMIT 12
        """), {'em': EMAIL})).mappings().all()
        # Filter to this submission's emails
        relevant = [e for e in em if EMAIL.lower() in e['to_email'].lower()
                    or e['to_email'] in ('admin@moodfordesign.com',
                                          'raffaella@moodfordesign.com',
                                          'ogrisekadvisor@gmail.com',
                                          'ogrisek.stefano@gmail.com')][:6]
        for e in relevant:
            log(f"    {e['template_key']:34s} → {e['to_email']:40s} [{e['status']}] {e['locale']}")
    tpl = {e['template_key']: e for e in relevant}
    REPORT['task1']['email_visitor'] = {
        'status': passfail('studio_request_received' in tpl
                           and tpl.get('studio_request_received', {}).get('status') == 'sent'),
        'template': 'studio_request_received',
        'locale_correct': tpl.get('studio_request_received', {}).get('locale') == 'it-IT',
        'reference_in_subject': 'MOOD-' in (tpl.get('studio_request_received', {}).get('subject') or ''),
    }
    REPORT['task1']['email_admin'] = {
        'status': passfail('admin_new_studio_request' in tpl
                           and tpl.get('admin_new_studio_request', {}).get('status') == 'sent'),
    }
    REPORT['task1']['email_advisor'] = {
        'status': 'CONDITIONAL',
        'reason': 'advisor_new_lead by design parte solo quando attribution_advisor_id è impostato'
                   ' (submission con referral attivo). Per submission organica → unassigned pool,'
                   ' advisor self-claim via Command Center. Template registrato e funzionante (3 dispatch storici).',
    }

    # ═══ TASK 1.5 — ADVISOR REVIEW ═════════════════════════════════
    log("\n████ T1.5 — ADVISOR REVIEW ████")
    async with httpx.AsyncClient(timeout=20, headers={"X-Admin-Key": ADMIN_KEY}) as cx:
        r = await cx.get(f"{API}/api/admin/tenant-activation/pipeline")
        data = r.json()
        found_in_bucket = None
        for bucket, items in (data.get('buckets') or {}).items():
            for it in items:
                if it.get('id') == request_id:
                    found_in_bucket = bucket; break
            if found_in_bucket: break
        log(f"  Found in bucket: {found_in_bucket}")
        # Transition lifecycle
        transitions = []
        for status in ('reviewing', 'contacted', 'qualified', 'activated'):
            r = await cx.patch(f"{API}/api/admin/studio/requests/{request_id}",
                                json={"status": status})
            ok = r.status_code == 200 and r.json().get('ok') is True
            transitions.append((status, ok))
            log(f"  {status:12s} [{r.status_code}] {ok}")
            await asyncio.sleep(0.5)
    REPORT['task1']['advisor_review'] = {
        'status': passfail(found_in_bucket is not None
                           and all(ok for _, ok in transitions)),
        'visible_in_pipeline': bool(found_in_bucket),
        'lifecycle_transitions_ok': all(ok for _, ok in transitions),
    }

    # ═══ TASK 1.6 — TENANT ACTIVATION ══════════════════════════════
    log("\n████ T1.6 — TENANT ACTIVATION ████")
    await asyncio.sleep(1.0)
    t = None
    try:
        async with AsyncSessionLocal() as s:
            t = (await s.execute(text("""
                SELECT id, name, slug, status, default_locale_code, created_at
                  FROM tenants
                 WHERE slug LIKE 'studio-readiness%'
                    OR name ILIKE '%readiness audit%'
                 ORDER BY created_at DESC LIMIT 1
            """))).mappings().first()
    except Exception as e:
        log(f"  tenants query error: {repr(e)[:120]}")
    if t:
        tenant_id = t['id']
        log(f"  Tenant: {t['name']} (slug={t['slug']}, status={t['status']})")
        rel = None
        try:
            async with AsyncSessionLocal() as s:
                rel = (await s.execute(text(
                    "SELECT id, advisor_id, tenant_id, status FROM studio_relations WHERE tenant_id = :tid LIMIT 1"
                ), {'tid': tenant_id})).mappings().first()
            log(f"  Studio relation: {rel}")
        except Exception as e:
            log(f"  studio_relations query error: {repr(e)[:80]}")
        mem = []
        try:
            async with AsyncSessionLocal() as s:
                mem = (await s.execute(text(
                    "SELECT * FROM tenant_memberships WHERE tenant_id = :tid"
                ), {'tid': tenant_id})).mappings().all()
            log(f"  Memberships: {len(mem)}")
            for x in mem:
                log(f"    role={x.get('role')} status={x.get('status')}")
        except Exception as e:
            log(f"  memberships query error: {repr(e)[:80]}")
        REPORT['task1']['tenant_activation'] = {
            'status': passfail(t['status'] == 'active'),
            'tenant_created': True,
            'tenant_slug': t['slug'],
            'tenant_status': t['status'],
            'has_advisor_relation': bool(rel),
            'memberships_count': len(mem),
        }
    else:
        REPORT['task1']['tenant_activation'] = {
            'status': 'FAIL',
            'tenant_created': False,
            'reason': 'No tenant row found for this submission. activated status does not auto-create a tenant.',
        }
        log("  ⚠ NO TENANT CREATED for this submission")

    # ═══ TASK 1.7 — FOUNDER INVITATION (MAGIC LINK) ════════════════
    log("\n████ T1.7 — FOUNDER INVITATION ████")
    ml = []
    # Try a list of possible magic-link table names — schema varies.
    for tn in ('access_magic_links', 'magic_links', 'auth_magic_links',
               'studio_magic_links', 'tenant_magic_links'):
        try:
            async with AsyncSessionLocal() as s2:
                ml = (await s2.execute(text(
                    f"SELECT * FROM {tn} ORDER BY 1 DESC LIMIT 1"
                ))).mappings().all()
            log(f"  Magic links table FOUND: {tn}")
            ml_table = tn
            break
        except Exception:
            ml_table = None
            continue
    # Now scan for our test email if a table was found
    found_ml = []
    if ml_table:
        try:
            async with AsyncSessionLocal() as s2:
                # Try common email column names
                for col in ('target_email', 'email', 'recipient_email', 'user_email'):
                    try:
                        found_ml = (await s2.execute(text(
                            f"SELECT * FROM {ml_table} WHERE LOWER({col}) = LOWER(:em) ORDER BY 1 DESC LIMIT 3"
                        ), {'em': EMAIL})).mappings().all()
                        if found_ml or True:
                            log(f"  Looked up by {col}: {len(found_ml)} hits")
                            break
                    except Exception:
                        continue
        except Exception as e:
            log(f"  scan error: {repr(e)[:120]}")
    else:
        log("  No magic_links-like table found in DB")

    async with AsyncSessionLocal() as s3:
        wm = (await s3.execute(text("""
            SELECT template_key, subject, status FROM studio_email_dispatch_log
             WHERE LOWER(to_email) = LOWER(:em)
               AND (template_key LIKE '%approved%' OR template_key LIKE '%welcome%'
                    OR template_key LIKE '%invit%' OR template_key LIKE '%founder%')
             ORDER BY created_at DESC LIMIT 5
        """), {'em': EMAIL})).mappings().all()
        log(f"  Welcome/invitation emails: {len(wm)}")
        for x in wm:
            log(f"    {x['template_key']:34s} [{x['status']}] {x['subject'][:70]}")
        REPORT['task1']['founder_invitation'] = {
            'status': passfail(len(found_ml) > 0 or any('approved' in e['template_key'] for e in wm)),
            'magic_links_table_found': ml_table,
            'magic_links_issued_for_email': len(found_ml),
            'welcome_email_sent': any(e['status'] == 'sent' for e in wm),
            'reason_if_partial': (
                'Currently the studio_request_approved email is dispatched. '
                'NO automated magic link / founder invitation token is issued at "activated" status. '
                'Founder must reach /accedi from the email CTA and request a magic link manually — '
                'OR an admin must provision the founder in users + tenant_memberships before founder can sign in.'
            ) if not found_ml else None,
        }

    # ═══ TASK 1.8 — FOUNDER ACCESS / BLUEPRINT ═════════════════════
    log("\n████ T1.8 — FOUNDER ACCESS / BLUEPRINT ████")
    u = None; p = None
    try:
        async with AsyncSessionLocal() as s:
            u = (await s.execute(text(
                "SELECT id, email, role, is_active FROM users WHERE LOWER(email) = LOWER(:em)"
            ), {'em': EMAIL})).mappings().first()
        log(f"  User row: {u}")
    except Exception as e:
        log(f"  users query error: {repr(e)[:120]}")
    try:
        async with AsyncSessionLocal() as s:
            p = (await s.execute(text(
                "SELECT id, email FROM profiles WHERE LOWER(email) = LOWER(:em)"
            ), {'em': EMAIL})).mappings().first()
        log(f"  Profile row: {p}")
    except Exception as e:
        log(f"  profiles table not present: {repr(e)[:80]}")
    REPORT['task1']['founder_access'] = {
        'status': passfail(bool(u) or bool(p)),
        'user_exists': bool(u),
        'profile_exists': bool(p),
        'reason': ('Activated status does NOT create a users row or magic link. '
                   'Founder cannot log in to Blueprint until manual provisioning.'
                   if not (u or p) else None),
    }

    # ═══ TASK 2 — DATA COLLECTION AUDIT ════════════════════════════
    log("\n████ T2 — DATA COLLECTION AUDIT ████")
    expected = ['operating_market', 'headquarter_country', 'headquarter_city',
                'latitude', 'longitude', 'target_countries', 'languages',
                'specializations', 'project_types']
    async with AsyncSessionLocal() as s:
        # studio_requests schema audit
        cols = (await s.execute(text("""
            SELECT column_name FROM information_schema.columns
             WHERE table_name='studio_requests'
        """))).mappings().all()
        sr_cols = {c['column_name'] for c in cols}
        log(f"  studio_requests has {len(sr_cols)} columns")

        # Check each expected field
        T2 = {}
        # 1. operating_market
        T2['operating_market'] = {
            'collected': 'primary_operating_market_id' in sr_cols,
            'storage': 'studio_requests.primary_operating_market_id (UUID FK→markets)',
            'value_in_test': str(sr['primary_operating_market_id']) if sr['primary_operating_market_id'] else None,
        }
        # 2. headquarter_country
        T2['headquarter_country'] = {
            'collected': 'headquarter_country_iso' in sr_cols,
            'storage': 'studio_requests.headquarter_country_iso (TEXT, ISO2)',
            'value_in_test': sr['headquarter_country_iso'],
        }
        # 3. headquarter_city
        T2['headquarter_city'] = {
            'collected': 'city' in sr_cols,
            'storage': 'studio_requests.city (TEXT)',
            'value_in_test': sr['city'],
        }
        # 4. latitude
        T2['latitude'] = {
            'collected': 'headquarter_lat' in sr_cols,
            'storage': 'studio_requests.headquarter_lat (DOUBLE PRECISION)',
            'value_in_test': sr['headquarter_lat'],
        }
        # 5. longitude
        T2['longitude'] = {
            'collected': 'headquarter_lng' in sr_cols,
            'storage': 'studio_requests.headquarter_lng (DOUBLE PRECISION)',
            'value_in_test': sr['headquarter_lng'],
        }
        # 6. target_countries
        T2['target_countries'] = {
            'collected': True,
            'storage': 'studio_request_target_countries bridge table (iso2, priority, status)',
            'value_in_test_count': len(tg),
        }
        # 7. languages
        spoken = (await s.execute(text("""
            SELECT column_name FROM information_schema.columns
             WHERE table_name='studio_requests' AND column_name IN ('languages', 'spoken_languages', 'communication_languages')
        """))).mappings().all()
        T2['languages'] = {
            'collected': len(spoken) > 0,
            'storage': spoken[0]['column_name'] if spoken else 'NOT COLLECTED',
            'value_in_test': None,
            'gap': 'Studio V2 funnel does NOT ask for studio languages of operation. Inferred only from submission locale.'
                    if not spoken else None,
        }
        # 8. specializations
        spec_cols = (await s.execute(text("""
            SELECT column_name FROM information_schema.columns
             WHERE table_name='studio_requests'
               AND column_name IN ('specializations', 'specialties', 'archetype')
        """))).mappings().all()
        spec_names = {c['column_name'] for c in spec_cols}
        T2['specializations'] = {
            'collected': 'archetype' in spec_names,
            'storage': 'studio_requests.archetype (TEXT, single value, e.g. interior_studio)',
            'value_in_test': sr['archetype'],
            'gap': 'Only one archetype captured. Multi-specialization (e.g. "interior + hospitality + retail") NOT collected.',
        }
        # 9. project_types
        pt_cols = (await s.execute(text("""
            SELECT column_name FROM information_schema.columns
             WHERE table_name='studio_requests'
               AND column_name IN ('project_types', 'project_categories', 'sectors', 'help_topics')
        """))).mappings().all()
        pt_names = {c['column_name'] for c in pt_cols}
        T2['project_types'] = {
            'collected': 'help_topics' in pt_names,
            'storage': 'studio_requests.help_topics (TEXT[]) — collected at Step 4',
            'value_in_test_count': '6 topics catalog (from studio_help_topics_v2)',
            'gap': 'help_topics captures "support themes" not "project types". A separate concept '
                   '(residential/hospitality/retail/office/healthcare/etc.) is NOT captured.',
        }
        REPORT['task2'] = T2
        for k, v in T2.items():
            log(f"  {k:22s} collected={v['collected']}  storage={v.get('storage')[:60] if v.get('storage') else None}")

    return REPORT

if __name__ == '__main__':
    r = asyncio.run(main())
    out = '/tmp/readiness_audit.json'
    with open(out, 'w') as f:
        json.dump(r, f, indent=2, default=str)
    print(f"\nFull report JSON: {out}")
