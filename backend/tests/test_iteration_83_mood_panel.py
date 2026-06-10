"""Iteration 83 — Moodboards Inspirations Flow™ (MoodPanel + Quick Add) backend regression."""
import os, uuid, pytest, requests

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or 'https://i18n-recovery-1.preview.emergentagent.com').rstrip('/')
EMAIL = 'demo@moodfordesign.com'
PWD = 'Blueprint2024!'


@pytest.fixture(scope='session')
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={'email': EMAIL, 'password': PWD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    tok = (r.json().get('session') or {}).get('access_token') or r.json().get('access_token') or r.json().get('token')
    if tok:
        sess.headers.update({'Authorization': f'Bearer {tok}'})
    return sess


@pytest.fixture(scope='session')
def moodboard_id(s):
    # Get an existing moodboard or create one
    r = s.get(f"{BASE_URL}/api/moodboards", timeout=15)
    assert r.status_code == 200
    items = r.json() if isinstance(r.json(), list) else r.json().get('items', [])
    if items:
        return items[0]['id']
    r2 = s.post(f"{BASE_URL}/api/moodboards", json={'title': 'TEST_iter83', 'project_id': None}, timeout=15)
    return r2.json()['id']


# ── Inspirations Archive ──
class TestInspirationsArchive:
    def test_editorial_filter(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'editorial', 'limit': 40})
        assert r.status_code == 200
        d = r.json()
        items = d.get('items', d if isinstance(d, list) else [])
        for it in items:
            t = it.get('inspiration_type')
            assert t in (None, 'editorial', 'inspiration'), f"got {t}"

    def test_product_filter(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'product', 'limit': 40})
        assert r.status_code == 200
        items = r.json().get('items', [])
        assert len(items) >= 1, "expected at least 1 product (Bonaldo seeded)"
        for it in items:
            assert it.get('inspiration_type') == 'product'

    def test_brand_filter_bonaldo(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'brand': 'Bonaldo', 'limit': 40})
        assert r.status_code == 200
        items = r.json().get('items', [])
        # Should have at least some Bonaldo items
        for it in items:
            b = (it.get('brand') or '').lower()
            assert 'bonaldo' in b or b == '', f"unexpected brand {it.get('brand')}"

    def test_catalogs(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/catalogs")
        assert r.status_code == 200
        assert 'items' in r.json() or isinstance(r.json(), list)


# ── Display meta endpoint ──
class TestDisplayMeta:
    def test_patch_display_meta(self, s):
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'limit': 1})
        items = r.json().get('items', [])
        if not items:
            pytest.skip("no inspirations")
        iid = items[0]['id']
        patch = {'focal_x': 0.5, 'focal_y': 0.5, 'zoom': 1.0, 'editorial_filter': 'editorial', 'crop_ratio': '4:5'}
        r2 = s.patch(f"{BASE_URL}/api/inspirations/archive/{iid}/display-meta", json=patch)
        assert r2.status_code in (200, 204), f"got {r2.status_code}: {r2.text[:200]}"


# ── Moodboard blocks: persists curatorial metadata ──
class TestBlockMetadataPersistence:
    def test_create_image_block_with_inspiration_meta(self, s, moodboard_id):
        payload = {
            'type': 'image', 'x': 60, 'y': 60, 'width': 360, 'height': 450,
            'z_index': 99,
            'content': {'src': 'https://example.com/test.jpg', 'caption': 'TEST_iter83'},
            'style': {'fit_mode': 'cover', 'focal_point': '50.0% 50.0%', 'zoom': 1, 'border_radius': 4},
            'metadata': {
                'inspiration_id': str(uuid.uuid4()),
                'brand': 'Bonaldo',
                'source_type': 'product',
                'display_meta': {'focal_x': 0.5, 'focal_y': 0.5, 'editorial_filter': 'editorial', 'zoom': 1},
                'editorial_filter': 'editorial',
                'market_context': ['IT'],
            }
        }
        r = s.post(f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks", json=payload)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        block = r.json()
        bid = block['id']

        # Verify via GET moodboard
        r2 = s.get(f"{BASE_URL}/api/moodboards/{moodboard_id}")
        assert r2.status_code == 200
        elems = r2.json().get('elements', [])
        match = next((e for e in elems if e['id'] == bid), None)
        assert match is not None, "block not persisted"
        assert match.get('content', {}).get('src') == 'https://example.com/test.jpg'
        meta = match.get('metadata', {})
        assert meta.get('brand') == 'Bonaldo'
        assert meta.get('source_type') == 'product'
        assert 'display_meta' in meta
        assert match.get('style', {}).get('focal_point') == '50.0% 50.0%'

        # cleanup
        s.delete(f"{BASE_URL}/api/moodboards/{moodboard_id}/blocks/{bid}")


# ── Product usage events ──
class TestUsageEvents:
    def test_emit_added_to_moodboard(self, s, moodboard_id):
        # Find a product
        r = s.get(f"{BASE_URL}/api/inspirations/archive", params={'inspiration_type': 'product', 'limit': 1})
        items = r.json().get('items', [])
        if not items:
            pytest.skip("no product inspirations")
        pid = items[0]['id']
        r2 = s.post(f"{BASE_URL}/api/inspirations/registry/usage-events", json={
            'product_id': pid, 'usage_type': 'added_to_moodboard', 'moodboard_id': moodboard_id,
        })
        assert r2.status_code in (200, 201, 204), f"{r2.status_code}: {r2.text[:300]}"
