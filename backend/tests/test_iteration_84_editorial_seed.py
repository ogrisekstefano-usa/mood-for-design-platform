"""Iteration 84 — Phase D · Sprint D1 — Editorial Inspirations Seed™ + Inline Regia.

Backend regression for the new seed script + display-meta PATCH persistence.
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or 'https://content-hub-pro-22.preview.emergentagent.com').rstrip('/')
EMAIL = 'demo@moodfordesign.com'
PWD = 'Blueprint2024!'

ALLOWED_MARKETS = {'us-miami', 'us-nyc', 'us-socal', 'it-milano', 'uk-london', 'fr-paris', 'ae-dubai'}
LUXURY_LEVELS = {'premium', 'luxury', 'ultra_luxury'}


@pytest.fixture(scope='session')
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={'email': EMAIL, 'password': PWD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    tok = (r.json().get('session') or {}).get('access_token') or r.json().get('access_token') or r.json().get('token')
    if tok:
        sess.headers.update({'Authorization': f'Bearer {tok}'})
    return sess


# ── Editorial Seed: 10 items present with proper metadata ──
class TestEditorialInspirationsSeed:
    def test_editorial_archive_returns_10_seeded(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 50})
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        items = r.json().get('items', [])
        assert len(items) >= 10, f"expected >=10 editorial seeds, got {len(items)}"

    def test_each_seed_has_required_fields(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 50})
        items = r.json().get('items', [])
        assert items, "no editorial items"
        for it in items:
            tid = it.get('id')
            assert it.get('title'), f"title missing for {tid}"
            assert it.get('atmosphere_tags'), f"atmosphere_tags empty for {tid}"
            assert it.get('material_tags'), f"material_tags empty for {tid}"
            mkts = it.get('market_codes') or []
            assert mkts, f"market_codes empty for {tid}"
            for m in mkts:
                assert m in ALLOWED_MARKETS, f"unknown market {m} in {tid}"
            lvl = it.get('luxury_level')
            assert lvl in LUXURY_LEVELS, f"bad luxury_level {lvl} in {tid}"
            assert it.get('hospitality_profile'), f"hospitality_profile missing for {tid}"
            assert it.get('inspiration_type') == 'editorial'

    def test_seeds_titles_italian(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 50})
        items = r.json().get('items', [])
        titles = [it.get('title', '') for it in items]
        joined = ' | '.join(titles).lower()
        # Sanity: italian curatorial titles
        expected_keywords = ['lobby', 'soggiorno', 'studio milanese', 'penthouse', 'hospitality']
        hits = sum(1 for k in expected_keywords if k in joined)
        assert hits >= 3, f"too few italian curatorial titles, got: {titles}"


# ── Idempotency: re-running seed script does not duplicate ──
class TestSeedIdempotency:
    def test_rerun_seed_script_idempotent(self, s):
        import subprocess
        # Count before
        r1 = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 100})
        before_count = len(r1.json().get('items', []))

        # Re-run seed
        result = subprocess.run(
            ['python3', '/app/backend/scripts/seed_editorial_inspirations.py'],
            capture_output=True, text=True, timeout=60, cwd='/app/backend',
        )
        assert result.returncode == 0, f"seed script failed: {result.stderr}"
        assert 'total=10' in result.stdout, f"unexpected output: {result.stdout}"
        # Should be all updates, zero inserts
        assert 'inserted=0' in result.stdout, f"expected inserted=0, got: {result.stdout}"

        # Count after
        r2 = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 100})
        after_count = len(r2.json().get('items', []))
        assert after_count == before_count, f"count changed: before={before_count}, after={after_count}"


# ── Display meta PATCH persistence on a seeded item ──
class TestDisplayMetaPersistence:
    def test_patch_display_meta_persists(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 50})
        items = r.json().get('items', [])
        assert items, "no editorial items"
        iid = items[0]['id']

        patch = {'focal_x': 0.4, 'focal_y': 0.7, 'editorial_filter': 'warm_residential', 'zoom': 1.2}
        r2 = s.patch(f"{BASE_URL}/api/inspirations/archive/{iid}/display-meta", json=patch)
        assert r2.status_code in (200, 204), f"got {r2.status_code}: {r2.text[:300]}"

        # Verify via direct GET of the item (list endpoint omits display_meta — see report)
        r3 = s.get(f"{BASE_URL}/api/inspirations/archive/{iid}")
        assert r3.status_code == 200, f"GET {iid} → {r3.status_code}"
        dm = r3.json().get('display_meta') or {}
        assert dm.get('focal_x') == pytest.approx(0.4), f"focal_x not persisted: {dm}"
        assert dm.get('editorial_filter') == 'warm_residential', f"editorial_filter not persisted: {dm}"
        assert dm.get('focal_y') == pytest.approx(0.7), f"focal_y not persisted: {dm}"
        assert dm.get('zoom') == pytest.approx(1.2), f"zoom not persisted: {dm}"

    def test_list_endpoint_includes_display_meta_after_patch(self, s):
        """REGRESSION: the list endpoint should include display_meta after PATCH.
        Currently the list serializer returns display_meta={} even after persistence."""
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 50})
        items = r.json().get('items', [])
        iid = items[0]['id']
        s.patch(f"{BASE_URL}/api/inspirations/archive/{iid}/display-meta",
                json={'focal_x': 0.33, 'focal_y': 0.66, 'editorial_filter': 'cinematic_dark', 'zoom': 1.4})
        r2 = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 50})
        match = next((it for it in r2.json().get('items', []) if it['id'] == iid), None)
        dm = (match or {}).get('display_meta') or {}
        assert dm.get('focal_x') == pytest.approx(0.33), \
            f"list endpoint does not surface display_meta after PATCH (got {dm})"
