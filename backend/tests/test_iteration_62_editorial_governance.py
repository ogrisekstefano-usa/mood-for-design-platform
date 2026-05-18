"""
Iteration 62 — Editorial Context Rail + Adaptation Operations + Market Matrix
Backend regression: existing endpoints used by the new UI.
  - PATCH /api/markets/{id} (cultural_profile / cta_style / seo_intent)
  - GET   /api/editorial/masters/{mid}
  - GET   /api/editorial/masters/{mid}/variants
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
EMAIL = 'demo@moodfordesign.com'
PASSWORD = 'Blueprint2024!'


@pytest.fixture(scope='module')
def auth_client():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    r = s.post(f'{BASE_URL}/api/auth/login', json={'email': EMAIL, 'password': PASSWORD}, timeout=15)
    assert r.status_code == 200, f'login failed {r.status_code}: {r.text[:300]}'
    data = r.json()
    token = (data.get('session') or {}).get('access_token') or data.get('access_token')
    assert token, 'no access_token in login response'
    s.headers.update({'Authorization': f'Bearer {token}'})
    return s


# ─── Markets governance ───────────────────────────────────────────────
class TestMarketsGovernance:
    def test_list_markets(self, auth_client):
        r = auth_client.get(f'{BASE_URL}/api/markets')
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        markets = body.get('markets') if isinstance(body, dict) else body
        assert isinstance(markets, list)
        assert len(markets) >= 1
        codes = [m.get('code') for m in markets]
        assert 'italy' in codes, f'italy market missing, got {codes}'

    def test_patch_market_cultural_profile_persists(self, auth_client):
        # find italy
        r = auth_client.get(f'{BASE_URL}/api/markets')
        markets = r.json().get('markets') if isinstance(r.json(), dict) else r.json()
        italy = next(m for m in markets if m.get('code') == 'italy')
        original_cp = italy.get('cultural_profile') or {}
        original_register = original_cp.get('editorial_register')

        # apply test register
        sentinel = f'TEST_iter62_register_{int(time.time())}'
        new_cp = {**original_cp, 'editorial_register': sentinel}
        rp = auth_client.patch(f'{BASE_URL}/api/markets/{italy["id"]}', json={'cultural_profile': new_cp})
        assert rp.status_code in (200, 204), f'PATCH failed: {rp.status_code} {rp.text[:300]}'

        # verify persistence via GET
        r2 = auth_client.get(f'{BASE_URL}/api/markets')
        ms2 = r2.json().get('markets') if isinstance(r2.json(), dict) else r2.json()
        italy2 = next(m for m in ms2 if m.get('code') == 'italy')
        assert (italy2.get('cultural_profile') or {}).get('editorial_register') == sentinel

        # revert
        revert_cp = {**original_cp}
        if original_register is None:
            revert_cp.pop('editorial_register', None)
        auth_client.patch(f'{BASE_URL}/api/markets/{italy["id"]}', json={'cultural_profile': revert_cp})

    def test_patch_market_cta_style(self, auth_client):
        r = auth_client.get(f'{BASE_URL}/api/markets')
        markets = r.json().get('markets') if isinstance(r.json(), dict) else r.json()
        italy = next(m for m in markets if m.get('code') == 'italy')
        original = italy.get('cta_style') or {}
        sentinel = f'TEST_psych_{int(time.time())}'
        rp = auth_client.patch(f'{BASE_URL}/api/markets/{italy["id"]}', json={'cta_style': {**original, 'psychology': sentinel}})
        assert rp.status_code in (200, 204)
        r2 = auth_client.get(f'{BASE_URL}/api/markets')
        ms2 = r2.json().get('markets') if isinstance(r2.json(), dict) else r2.json()
        italy2 = next(m for m in ms2 if m.get('code') == 'italy')
        assert (italy2.get('cta_style') or {}).get('psychology') == sentinel
        auth_client.patch(f'{BASE_URL}/api/markets/{italy["id"]}', json={'cta_style': original})


# ─── Editorial masters & variants (used by Context Rail) ──────────────
class TestEditorialMastersForContextRail:
    @pytest.fixture(scope='class')
    def master_id(self, auth_client):
        r = auth_client.get(f'{BASE_URL}/api/editorial/masters')
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        items = body.get('masters') or body.get('items') or body
        if not items:
            # create one
            code = f'TEST_iter62_m_{int(time.time())}'
            rc = auth_client.post(f'{BASE_URL}/api/editorial/masters', json={
                'code': code, 'title': 'Iter62 Master',
                'canonical_locale': 'it-IT', 'conceptual_direction': 'Test direction',
            })
            assert rc.status_code in (200, 201), rc.text[:200]
            return rc.json()['id']
        return items[0]['id']

    def test_get_master_detail(self, auth_client, master_id):
        r = auth_client.get(f'{BASE_URL}/api/editorial/masters/{master_id}')
        assert r.status_code == 200, r.text[:200]
        m = r.json()
        assert m.get('id') == master_id
        assert 'title' in m
        assert 'code' in m

    def test_list_variants_for_master(self, auth_client, master_id):
        r = auth_client.get(f'{BASE_URL}/api/editorial/masters/{master_id}/variants')
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        items = body.get('variants') if isinstance(body, dict) else body
        if items is None and isinstance(body, dict):
            items = body.get('items')
        assert isinstance(items, list)


# ─── Compose-from-master endpoint (may or may not exist) ──────────────
class TestComposeFromMaster:
    def test_compose_from_master_endpoint_shape(self, auth_client):
        """Validate the endpoint either works or returns a documented error
        (so the UI's fallback to /generate-composition is exercised)."""
        # list masters to find a variant
        rm = auth_client.get(f'{BASE_URL}/api/editorial/masters')
        body = rm.json()
        items = body.get('masters') or body.get('items') or body
        if not items:
            pytest.skip('no masters available')
        mid = items[0]['id']
        rv = auth_client.get(f'{BASE_URL}/api/editorial/masters/{mid}/variants')
        vbody = rv.json()
        variants = vbody.get('variants') if isinstance(vbody, dict) else vbody
        if not variants:
            pytest.skip('no variants available')
        vid = variants[0]['id']
        r = auth_client.post(f'{BASE_URL}/api/editorial/variants/{vid}/compose-from-master', json={})
        # must NOT be 500 — either 200/201/404 (not implemented) or 4xx
        assert r.status_code != 500, f'compose endpoint 500 leaks: {r.text[:200]}'
