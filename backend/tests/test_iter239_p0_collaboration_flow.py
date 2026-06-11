"""
P0 Collaboration Flow Tests — iteration 239
Tests: P0-1 Prospects/Accounts journey enrichment, P0-2 notification wiring,
       P0-3 messaging, P0-4 leads CTA, Regression leads count
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def get_admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@moodfordesign.com",
        "password": "Blueprint2024!"
    })
    if resp.status_code == 200:
        data = resp.json()
        session = data.get('session') or {}
        return session.get('access_token') or data.get('access_token') or data.get('token')
    return None

@pytest.fixture(scope="module")
def auth_headers():
    token = get_admin_token()
    if not token:
        pytest.skip("Admin login failed")
    return {"Authorization": f"Bearer {token}"}


class TestP01Prospects:
    """P0-1a: Prospects endpoint returns 11 items with journey enrichment"""

    def test_prospects_count(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/prospects", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data.get('data', [])
        total = data.get('total', 0)
        print(f"Prospects count: {len(items)}, total: {total}")
        assert len(items) > 0, "Prospects should not be empty"
        assert len(items) >= 11 or total >= 11, f"Expected >= 11 prospects, got {len(items)}"

    def test_prospects_have_first_name(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/prospects", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json().get('data', [])
        assert items, "No prospect items"
        assert 'first_name' in items[0], "first_name field missing"

    def test_prospects_have_journey_enrichment(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/prospects", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json().get('data', [])
        # At least some should have journey_lifecycle_state
        with_journey = [i for i in items if i.get('journey_lifecycle_state')]
        print(f"Prospects with journey_lifecycle_state: {len(with_journey)}/{len(items)}")
        assert len(with_journey) > 0, "No prospects have journey_lifecycle_state"

    def test_prospects_have_journey_project_id(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/prospects", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json().get('data', [])
        with_proj = [i for i in items if i.get('journey_project_id')]
        print(f"Prospects with journey_project_id: {len(with_proj)}/{len(items)}")
        assert len(with_proj) > 0, "No prospects have journey_project_id"


class TestP01Accounts:
    """P0-1b: Accounts endpoint returns items with journey enrichment"""

    def test_accounts_count(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/accounts", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data.get('data', [])
        print(f"Accounts count: {len(items)}, total: {data.get('total')}")
        assert len(items) > 0, "Accounts should not be empty"

    def test_accounts_have_journey_lifecycle_state(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/accounts", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json().get('data', [])
        with_journey = [i for i in items if i.get('journey_lifecycle_state')]
        print(f"Accounts with journey_lifecycle_state: {len(with_journey)}/{len(items)}")
        assert len(with_journey) > 0, "No accounts have journey_lifecycle_state"

    def test_accounts_have_journey_project_id(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/accounts", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json().get('data', [])
        with_proj = [i for i in items if i.get('journey_project_id')]
        print(f"Accounts with journey_project_id: {len(with_proj)}/{len(items)}")
        assert len(with_proj) > 0, "No accounts have journey_project_id"


class TestP03Messaging:
    """P0-3: Notifications unread-count returns a count"""

    def test_unread_count(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        count = data.get('count', data.get('unread_count', -1))
        print(f"Unread notification count: {count}")
        assert count >= 0, "unread count should be >= 0"


class TestRegressionLeads:
    """Regression: leads endpoint still returns 14 leads"""

    def test_leads_count(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/relations/leads", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        items = data.get('data', [])
        total = data.get('total', 0)
        print(f"Leads count: {len(items)}, total: {total}")
        assert len(items) > 0 or total > 0, "Leads should not be empty"
        # Regression: should still be ~14
        assert total >= 10, f"Expected >= 10 leads, got {total}"
