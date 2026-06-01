"""
Studio Activation V2 — End-to-End Backend Verification
─────────────────────────────────────────────────────
Simulates a complete visitor submission through /api/studio/v2/submit
exercising the new geography fields (priority + status + region) and
verifies DB persistence.

Run: python scripts/e2e_studio_v2_full.py
"""
import asyncio, os, sys, uuid
import httpx
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from sqlalchemy import text
from database import AsyncSessionLocal

API = os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001'
if 'preview.emergentagent.com' not in API:
    with open('/app/frontend/.env') as f:
        for ln in f:
            if ln.startswith('REACT_APP_BACKEND_URL='):
                API = ln.strip().split('=', 1)[1]
                break

EMAIL = f"e2e.v2.{uuid.uuid4().hex[:8]}@moodtest.example.com"

async def step(title):
    print(f"\n━━━ {title} ━━━")

async def main():
    results = {}

    # ─── 1. Manifest ─────────────────────────────────────────
    await step("1. GET /api/studio/v2/manifest")
    async with httpx.AsyncClient(timeout=20) as cx:
        r = await cx.get(f"{API}/api/studio/v2/manifest?locale=it-IT")
        manifest = r.json()
        archs = manifest.get('archetypes', [])
        topics = manifest.get('help_topics', [])
        print(f"  archetypes={len(archs)}  help_topics={len(topics)}")
        # Verify no legacy terms in archetype labels/descriptions
        all_text = ' '.join([(a.get('label') or '') + ' ' + (a.get('description') or '')
                              for a in archs]).lower()
        legacy = ['practice', 'ecosystem', 'temperament', 'movement', 'monogram']
        leaked = [w for w in legacy if w in all_text]
        results['no_legacy_in_archetypes'] = not leaked
        if leaked: print(f"  ❌ Legacy terms in archetypes: {leaked}")
        else:       print(f"  ✓ No legacy term in archetype copy")
        assert archs, "no archetypes"

    # ─── 2. Geo endpoints ─────────────────────────────────────
    await step("2. Geo endpoints")
    async with httpx.AsyncClient(timeout=20) as cx:
        r = await cx.get(f"{API}/api/geo/operating-markets?locale=it-IT")
        markets = (r.json() or {}).get('items', [])
        print(f"  operating-markets={len(markets)}")
        labels = ' '.join([m['label'] for m in markets]).lower()
        # Visitor must NOT see technical codes
        # Only flag *technical* codes containing underscores (snake_case
        # internal identifiers). Single-word business acronyms like
        # "DACH" or "GCC" are legitimate labels.
        tech_codes = ['usa_national', 'spanish_latam', 'gcc_luxury',
                      'france_fr_europe', 'uk_ireland', 'spain_iberian',
                      'usa_east_coast', 'usa_west_coast', 'usa_south_florida',
                      'usa_midwest', 'usa_mountain_central', 'spanish_mexico']
        leaked = [c for c in tech_codes if c in labels]
        results['no_technical_codes_in_market_labels'] = not leaked
        print(f"  {'❌' if leaked else '✓'} technical codes visible: {leaked or 'NONE'}")

        r = await cx.get(f"{API}/api/geo/countries?locale=it-IT")
        countries = (r.json() or {}).get('items', [])
        print(f"  countries={len(countries)}")
        results['countries_global'] = len(countries) >= 240

        # Mapbox: try real call (will likely 403 fallback)
        r = await cx.get(f"{API}/api/studio/v2/cities?country=IT&q=Milano&limit=3")
        cities = (r.json() or {}).get('items', [])
        print(f"  mapbox_cities (Milano)={len(cities)} {'(fallback active)' if not cities else ''}")
        results['mapbox_graceful'] = isinstance(cities, list)

    # ─── 3. Draft + email check ──────────────────────────────
    await step("3. Draft + email uniqueness")
    async with httpx.AsyncClient(timeout=20) as cx:
        r = await cx.post(f"{API}/api/studio/activation/draft", json={})
        draft_token = r.json().get('draft_token')
        print(f"  draft_token={draft_token[:12]}…")
        r = await cx.get(f"{API}/api/studio/v2/check-email",
                         params={'email': EMAIL})
        em = r.json()
        print(f"  email check: available={em.get('available')} reason={em.get('reason')}")
        results['email_uniqueness_check_works'] = em.get('available') is True

    # ─── 4. Submit V2 with new fields ────────────────────────
    await step("4. POST /api/studio/v2/submit")
    payload = {
        "draft_token": draft_token,
        "archetype_code": "interior_design",
        "primary_operating_market_code": "italy",
        "headquarter_country_iso": "IT",
        "headquarter_city":    "Milano",
        "headquarter_region":  "Lombardia",
        "headquarter_lat":     45.4642,
        "headquarter_lng":     9.1900,
        "mapbox_place_id":     "place.test.e2e",
        # New target_countries with priority + status
        "target_countries": [
            {"iso2": "US", "priority": 1, "status": "active"},
            {"iso2": "AE", "priority": 2, "status": "planned"},
            {"iso2": "SG", "priority": 3, "status": "planned"},
        ],
        "first_name": "Sofia",
        "last_name":  "E2E",
        "contact_email": EMAIL,
        "phone_prefix": "+39",
        "phone_number": "3334445566",
        "help_topics": ["process_design", "business_growth"],
        "locale": "it-IT",
    }
    async with httpx.AsyncClient(timeout=30) as cx:
        r = await cx.post(f"{API}/api/studio/v2/submit", json=payload)
        submit_res = r.json()
        print(f"  ok={submit_res.get('ok')}  reference={submit_res.get('reference')}")
        results['submit_ok'] = submit_res.get('ok') is True
        results['has_reference'] = bool(submit_res.get('reference'))
        request_id = submit_res.get('request_id')

    # ─── 5. DB verification ───────────────────────────────────
    await step("5. DB verification")
    async with AsyncSessionLocal() as s:
        sr = (await s.execute(text("""
            SELECT id, contact_email, primary_operating_market_id,
                   headquarter_country_iso, city, headquarter_region,
                   headquarter_lat, headquarter_lng, mapbox_place_id,
                   archetype, status
              FROM studio_requests WHERE contact_email = :em
        """), {"em": EMAIL.lower()})).mappings().first()
        print(f"  studio_requests: id={sr['id']}")
        print(f"    primary_operating_market_id={sr['primary_operating_market_id']}")
        print(f"    headquarter: {sr['city']}, {sr['headquarter_region']}, "
              f"{sr['headquarter_country_iso']} ({sr['headquarter_lat']}, {sr['headquarter_lng']})")
        print(f"    mapbox_place_id={sr['mapbox_place_id']}")
        print(f"    archetype={sr['archetype']}  status={sr['status']}")
        results['hq_persisted'] = (sr['headquarter_country_iso'] == 'IT'
                                    and sr['headquarter_region'] == 'Lombardia'
                                    and sr['headquarter_lat'] == 45.4642)
        results['operating_market_persisted'] = sr['primary_operating_market_id'] is not None

        tg = (await s.execute(text("""
            SELECT country_iso2, priority, status FROM studio_request_target_countries
             WHERE studio_request_id = :rid ORDER BY priority
        """), {"rid": sr['id']})).mappings().all()
        print(f"  target_countries: {len(tg)} rows")
        for t in tg:
            print(f"    P{t['priority']}: {t['country_iso2']} · {t['status']}")
        targets_expected = [('US', 1, 'active'), ('AE', 2, 'planned'), ('SG', 3, 'planned')]
        targets_actual   = [(t['country_iso2'], t['priority'], t['status']) for t in tg]
        results['targets_persisted_with_priority_status'] = targets_actual == targets_expected

        # Email dispatch log
        eml = (await s.execute(text("""
            SELECT template_key, to_email, status FROM studio_email_dispatch_log
             WHERE LOWER(to_email) = :em ORDER BY created_at DESC LIMIT 5
        """), {"em": EMAIL.lower()})).mappings().all()
        print(f"  email dispatch log entries: {len(eml)}")
        for e in eml:
            print(f"    {e['template_key']} → {e['to_email']} [{e['status']}]")
        results['emails_dispatched'] = any(e['status'] == 'sent' for e in eml)

    # ─── 6. Verify Command Center pipeline shows geo ─────────
    await step("6. Command Center pipeline includes geo")
    async with AsyncSessionLocal() as s:
        # Direct DB check that the SELECT works (router-level uses auth)
        cnt = (await s.execute(text("""
            SELECT COUNT(*) AS c FROM studio_requests sr
              LEFT JOIN markets m ON m.id = sr.primary_operating_market_id
              LEFT JOIN studio_request_target_countries tc ON tc.studio_request_id = sr.id
             WHERE sr.id = :rid
        """), {"rid": sr['id']})).mappings().first()
        print(f"  pipeline join row count: {cnt['c']}")
        results['pipeline_join_works'] = cnt['c'] > 0

    # ─── 7. Summary ───────────────────────────────────────────
    await step("VERDICT")
    passed = sum(1 for v in results.values() if v)
    total  = len(results)
    print(f"\n  {passed}/{total} checks passed\n")
    for k, v in results.items():
        print(f"   {'✓' if v else '❌'}  {k}")
    print()
    return 0 if passed == total else 1

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
