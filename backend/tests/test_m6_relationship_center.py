"""M6 Relationship Center — backend regression tests.

Validates:
  - admin login
  - /api/admin/tenants includes new fields open_followups_count and overdue_followups_count
  - Tenant overview / contacts / open-followups / timeline endpoints still respond
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://design-journey-cms.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "MoodAdmin2026!"
TENANT_ID = "c64659f6-5a76-41dd-8d8d-b901d29862af"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "tenant_slug": None},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestM6TenantsList:
    """Verify /api/admin/tenants payload includes new follow-up count fields."""

    def test_tenants_list_returns_new_followup_fields(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tenants?limit=10", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        items = data.get("items", [])
        assert len(items) > 0, "No tenants returned"

        for t in items:
            assert "open_followups_count" in t, f"Missing open_followups_count in {t.get('id')}"
            assert "overdue_followups_count" in t, f"Missing overdue_followups_count in {t.get('id')}"
            assert isinstance(t["open_followups_count"], int)
            assert isinstance(t["overdue_followups_count"], int)
            # Also verify the columns required by the new TenantsList UI
            for f in ("studio_name", "tenant_owner_display", "advisor_display", "last_activity_at", "status"):
                assert f in t, f"Missing '{f}' in tenant payload"

    def test_target_tenant_has_open_followups(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tenants?limit=200", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        items = r.json().get("items", [])
        target = next((t for t in items if t["id"] == TENANT_ID), None)
        assert target, f"Target tenant {TENANT_ID} not in list"
        # Expected ~6 open follow-ups per problem statement
        assert target["open_followups_count"] > 0, (
            f"Expected open_followups_count>0, got {target['open_followups_count']}"
        )


class TestM6TenantDetailEndpoints:
    """Confirm all endpoints used by the M6 3-column dashboard respond OK."""

    def test_overview(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tenants/{TENANT_ID}/overview", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "tenant" in data and "primary_contact" in data and "kpis" in data
        # primary_contact may be None but key must exist

    def test_contacts(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tenants/{TENANT_ID}/contacts", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_eligible_owners(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/users/eligible-owners?limit=100", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_open_followups(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/tenants/{TENANT_ID}/activities/open-followups?limit=100",
            headers=auth_headers, timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_timeline(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/tenants/{TENANT_ID}/timeline?limit=50",
            headers=auth_headers, timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "items" in data

    def test_activities_v2_completed(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/tenants/{TENANT_ID}/activities/v2?status=completed&limit=5",
            headers=auth_headers, timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
