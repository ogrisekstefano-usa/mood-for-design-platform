"""Phase P0.6.A + P0.6.B — Project workspace v2 endpoints."""
import os
import pytest
import requests

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://i18n-recovery-1.preview.emergentagent.com').rstrip('/')

DEMO_EMAIL = 'demo@moodfordesign.com'
DEMO_PASS = 'Blueprint2024!'
SHOWROOM_EMAIL = 'studio2@moodfordesign.com'
SHOWROOM_PASS = 'Studio2024!'

PROJECTS = [
    'adea95da-3ff8-4a10-80db-bbc02a0ed119',   # Apartment Stefano (HAS AI Brief)
    '48c02e6b-2e4f-4ce8-a87a-2de1ec81c474',   # Penthouse Stefano
    'd7833e2f-235b-4ef0-a671-dc9083870086',   # Villa Roma Camilla
]


def _login(email, password):
    s = requests.Session()
    r = s.post(f'{BASE}/api/auth/login', json={'email': email, 'password': password}, timeout=20)
    assert r.status_code == 200, f'login failed {r.status_code} {r.text[:200]}'
    body = r.json()
    sess = body.get('session') or {}
    token = sess.get('access_token') or body.get('access_token') or body.get('token')
    if token:
        s.headers.update({'Authorization': f'Bearer {token}'})
    return s


@pytest.fixture(scope='module')
def demo():
    return _login(DEMO_EMAIL, DEMO_PASS)


@pytest.fixture(scope='module')
def showroom():
    return _login(SHOWROOM_EMAIL, SHOWROOM_PASS)


# 1. Project detail loads
@pytest.mark.parametrize('pid', PROJECTS)
def test_project_detail(demo, pid):
    r = demo.get(f'{BASE}/api/projects/{pid}', timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert j.get('id') == pid
    assert j.get('title')


# 2. Inspirations endpoint
@pytest.mark.parametrize('pid', PROJECTS)
def test_inspirations(demo, pid):
    r = demo.get(f'{BASE}/api/projects/{pid}/inspirations', timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert 'items' in j and 'clusters' in j and 'total' in j
    # If items exist, clusters must reference_type-keyed and counts sum to total
    if j['total'] > 0:
        assert sum(c['count'] for c in j['clusters']) == j['total']
        for c in j['clusters']:
            assert 'key' in c and 'label' in c and 'items' in c


# 3. Timeline endpoint
@pytest.mark.parametrize('pid', PROJECTS)
def test_timeline(demo, pid):
    r = demo.get(f'{BASE}/api/projects/{pid}/timeline', timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert 'events' in j and 'total' in j
    # Sort descending check
    ats = [e.get('at') for e in j['events'] if e.get('at')]
    assert ats == sorted(ats, reverse=True)
    # Italian human labels
    kinds = {e['kind'] for e in j['events']}
    assert kinds.issubset({'activity', 'inspiration', 'ai_brief', 'message'})


# 4. Materials endpoint
@pytest.mark.parametrize('pid', PROJECTS)
def test_materials(demo, pid):
    r = demo.get(f'{BASE}/api/projects/{pid}/materials', timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert 'items' in j and 'total' in j
    for m in j['items']:
        assert 'id' in m and 'name' in m


# 5. Proposals endpoint
@pytest.mark.parametrize('pid', PROJECTS)
def test_proposals(demo, pid):
    r = demo.get(f'{BASE}/api/projects/{pid}/proposals', timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert 'items' in j and 'continuity' in j
    cont = j['continuity']
    assert 'moodboards_in_project' in cont
    assert 'inspirations_in_project' in cont


# 6. Conversations endpoint
@pytest.mark.parametrize('pid', PROJECTS)
def test_conversations(demo, pid):
    r = demo.get(f'{BASE}/api/projects/{pid}/conversations', timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert 'messages' in j and 'participants' in j


# 7. AI Brief - read latest for the seeded project (must exist)
def test_ai_brief_get_seeded(demo):
    pid = PROJECTS[0]
    r = demo.get(f'{BASE}/api/projects/{pid}/ai-brief', timeout=20)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    brief = j.get('brief')
    assert brief is not None, 'expected seeded brief for Apartment Stefano'
    s = brief.get('sections') or {}
    # Headline + 5 mandatory sections per spec
    assert s.get('headline')
    for k in ('direction', 'material_language', 'emotional_positioning',
              'market_adaptation', 'design_risks'):
        assert s.get(k), f'missing section {k}'


# 8. Tenant isolation — Showroom tenant must NOT see Demo Studio projects
@pytest.mark.parametrize('pid', PROJECTS)
def test_tenant_isolation(showroom, pid):
    for path in ('', '/inspirations', '/timeline', '/materials',
                 '/proposals', '/conversations', '/ai-brief'):
        r = showroom.get(f'{BASE}/api/projects/{pid}{path}', timeout=20)
        assert r.status_code in (403, 404), (
            f'cross-tenant leak on {path}: {r.status_code} {r.text[:120]}'
        )


# 9. Unknown project id → 404
def test_unknown_project_404(demo):
    bogus = '00000000-0000-0000-0000-000000000000'
    r = demo.get(f'{BASE}/api/projects/{bogus}/inspirations', timeout=20)
    assert r.status_code in (403, 404)
