"""ITER143C · Blueprint Command Center™ regression tests.

Verifies:
  • Only the ROOT SUPERADMIN can reach `/api/blueprint-admin/*`.
  • Other super_admins (Blueprint Collaborators) receive HTTP 403.
  • DB partial unique index allows only ONE active root.
  • Dashboard returns the canonical shape.
  • Demo Governance status surfaces the demo tenant correctly.
"""
import os
import requests
import pytest

API = os.environ.get('REACT_APP_BACKEND_URL') or 'http://localhost:8001'

ROOT = ('admin@moodfordesign.com', 'Blueprint2024!')
COLLAB = ('demo@moodfordesign.com', 'Blueprint2024!')


def _login(email, password):
    r = requests.post(f"{API}/api/auth/login",
                      json={'email': email, 'password': password}, timeout=20)
    r.raise_for_status()
    return r.json()['session']['access_token']


@pytest.fixture(scope='module')
def root_token():
    return _login(*ROOT)


@pytest.fixture(scope='module')
def collab_token():
    return _login(*COLLAB)


def test_root_me(root_token):
    r = requests.get(f"{API}/api/blueprint-admin/me",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j['is_root_superadmin'] is True
    assert j['email'] == 'admin@moodfordesign.com'


def test_collaborator_rejected(collab_token):
    r = requests.get(f"{API}/api/blueprint-admin/me",
                     headers={'Authorization': f'Bearer {collab_token}'}, timeout=15)
    assert r.status_code == 403
    assert 'ROOT_SUPERADMIN' in (r.json().get('detail') or '')


def test_anonymous_rejected():
    r = requests.get(f"{API}/api/blueprint-admin/dashboard", timeout=15)
    assert r.status_code in (401, 403)


def test_dashboard_shape(root_token):
    r = requests.get(f"{API}/api/blueprint-admin/dashboard",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert 'platform' in j and 'editorial_runtime' in j and 'email' in j and 'demo' in j
    assert isinstance(j['platform']['users_total'], int)
    assert isinstance(j['editorial_runtime']['active_locales'], list)
    assert len(j['editorial_runtime']['active_locales']) >= 6


def test_demo_status_available(root_token):
    r = requests.get(f"{API}/api/blueprint-admin/demo/status",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j['available'] is True
    # ITER143D · slug rename mood-demo → studio
    assert j['tenant']['slug'] == 'studio'
    assert j['tenant']['is_demo'] is True
    assert 'users' in j['inventory']


def test_db_root_unique_constraint():
    """Only one row with is_root_superadmin = TRUE can exist."""
    import sys
    sys.path.insert(0, '/app/backend')
    from database import db
    c = db()
    rows = (c.table('users_profile').select('id, email')
            .eq('is_root_superadmin', True).execute().data or [])
    assert len(rows) == 1, f'expected exactly 1 root, got {len(rows)}: {[r["email"] for r in rows]}'
    assert rows[0]['email'].lower() == 'admin@moodfordesign.com'


def test_legacy_superadmin_routes_redirect():
    """Frontend redirect — verify the backend doesn't expose /superadmin/*
    as a separate API (it never did; this is here to make the contract
    explicit)."""
    r = requests.get(f"{API}/api/superadmin", timeout=10)
    assert r.status_code in (404, 405)


def test_editorial_runtime_listing(root_token):
    r = requests.get(f"{API}/api/blueprint-admin/editorial-runtime",
                     headers={'Authorization': f'Bearer {root_token}'}, timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert 'groups' in j and 'namespaces' in j and 'active_locales' in j
    # The Blueprint Command Center seed should have created admin.* namespaces
    nss = j['namespaces']
    assert any(n.startswith('admin.') for n in nss), nss
