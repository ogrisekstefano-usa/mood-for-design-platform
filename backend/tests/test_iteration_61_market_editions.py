"""Iteration 61 backend tests:
- POST /api/editorial/masters (create)
- POST /api/editorial/masters/{mid}/variants (create variant)
- POST /api/editorial/variants/{vid}/schedule (must require 'approved' status -> 409)
- GET /api/markets — toolbar dependency
- GET /api/media list (to check usage_count availability for delete-protection)
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://content-hub-pro-22.preview.emergentagent.com').rstrip('/')
EMAIL = 'demo@moodfordesign.com'
PASS = 'Blueprint2024!'


@pytest.fixture(scope='module')
def session():
    s = requests.Session()
    r = s.post(f'{BASE_URL}/api/auth/login', json={'email': EMAIL, 'password': PASS}, timeout=30)
    assert r.status_code == 200, f'login failed: {r.status_code} {r.text[:200]}'
    body = r.json()
    sess = body.get('session') or {}
    tok = sess.get('access_token') or body.get('access_token') or body.get('token')
    assert tok, f'no token in login response: {list(body.keys())}'
    s.headers.update({'Authorization': f'Bearer {tok}'})
    return s


@pytest.fixture(scope='module')
def created_master(session):
    code = f'TEST_iter61_{int(time.time())}'
    r = session.post(f'{BASE_URL}/api/editorial/masters', json={
        'code': code,
        'title': 'TEST Iter61 Master',
        'canonical_locale': 'it-IT',
        'conceptual_direction': 'Test seed for iteration 61',
    }, timeout=30)
    assert r.status_code == 201, f'create_master failed: {r.status_code} {r.text[:300]}'
    data = r.json()
    assert data.get('id') and data.get('code') == code
    assert data.get('title') == 'TEST Iter61 Master'
    return data


def test_master_appears_in_list(session, created_master):
    r = session.get(f'{BASE_URL}/api/editorial/masters', timeout=30)
    assert r.status_code == 200
    ids = [m['id'] for m in r.json().get('masters', [])]
    assert created_master['id'] in ids


def test_markets_endpoint(session):
    r = session.get(f'{BASE_URL}/api/markets', timeout=30)
    # Markets endpoint must be reachable for toolbar
    assert r.status_code in (200,)
    body = r.json()
    assert isinstance(body, (dict, list))


@pytest.fixture(scope='module')
def created_variant(session, created_master):
    markets_r = session.get(f'{BASE_URL}/api/markets', timeout=30).json()
    mkts = markets_r.get('markets') if isinstance(markets_r, dict) else markets_r
    if not mkts:
        pytest.skip('No markets seeded')
    m = mkts[0]
    slug = f'test-iter61-variant-{int(time.time())}'
    r = session.post(f'{BASE_URL}/api/editorial/masters/{created_master["id"]}/variants', json={
        'market_id': m['id'],
        'target_locale': m.get('primary_locale') or 'en-US',
        'variant_slug': slug,
        'title': 'TEST Iter61 Variant',
    }, timeout=30)
    assert r.status_code == 201, f'create_variant failed: {r.status_code} {r.text[:300]}'
    v = r.json()
    assert v.get('id') and v.get('variant_slug') == slug
    return v


def test_schedule_requires_approved_status(session, created_variant):
    # New variant defaults to status='draft'; schedule must reject with 409
    r = session.post(
        f'{BASE_URL}/api/editorial/variants/{created_variant["id"]}/schedule',
        json={'scheduled_at': '2026-12-01T10:00:00Z'},
        timeout=30,
    )
    assert r.status_code == 409, f'expected 409 for non-approved schedule, got {r.status_code} {r.text[:200]}'


def test_schedule_accepts_after_approval(session, created_variant):
    vid = created_variant['id']
    # Transition draft -> direction_defined -> ready_for_editorial_review -> approved
    for to in ('direction_defined', 'ready_for_editorial_review', 'approved'):
        tr = session.post(f'{BASE_URL}/api/editorial/variants/{vid}/transition', json={'to': to}, timeout=30)
        assert tr.status_code == 200, f'transition to {to} failed: {tr.status_code} {tr.text[:200]}'
    r = session.post(
        f'{BASE_URL}/api/editorial/variants/{vid}/schedule',
        json={'scheduled_at': '2026-12-01T10:00:00Z'},
        timeout=30,
    )
    assert r.status_code == 200, f'schedule failed: {r.status_code} {r.text[:300]}'
    # Verify persistence
    g = session.get(f'{BASE_URL}/api/editorial/variants/{vid}', timeout=30)
    assert g.status_code == 200
    assert g.json().get('status') == 'scheduled'
    assert g.json().get('scheduled_at') is not None


def test_media_list_for_delete_protection(session):
    r = session.get(f'{BASE_URL}/api/media', timeout=30)
    assert r.status_code == 200
    items = r.json().get('data') or r.json().get('items') or []
    assert isinstance(items, list)
    # Detail of first item should return links collection (may be empty)
    if items:
        first = items[0]
        d = session.get(f'{BASE_URL}/api/media/{first["id"]}', timeout=30)
        assert d.status_code == 200
        body = d.json()
        # accept either 'links' key or 'usage_links' or usage_count integer
        assert ('links' in body) or ('usage_links' in body) or ('usage_count' in body)
