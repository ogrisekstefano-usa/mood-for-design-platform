"""Phase P0.3.C — Reference actions endpoint regression.

Covers POST /api/references/{id}/actions:
  • link_project (missing project_id → 400, cross-tenant → 404, ok)
  • discuss / moodboard / material_study → 200 ok=true
  • unknown action → 400
  • tenant isolation: studio2 sees no MOOD Demo Studio references
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

SUPER_EMAIL = "demo@moodfordesign.com"
SUPER_PASS = "Blueprint2024!"
SHOW_EMAIL = "studio2@moodfordesign.com"
SHOW_PASS = "Studio2024!"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login",
               json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login: {r.status_code} {r.text[:200]}"
    body = r.json()
    sess = body.get("session") or {}
    token = sess.get("access_token") or body.get("access_token") or body.get("token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def super_admin():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def showroom():
    return _login(SHOW_EMAIL, SHOW_PASS)


@pytest.fixture(scope="module")
def first_ready_reference_id(super_admin):
    r = super_admin.get(f"{BASE}/api/references", timeout=30)
    assert r.status_code == 200, r.text[:200]
    refs = r.json().get("references", [])
    assert refs, "no seeded references found for super_admin"
    return refs[0]["id"]


class TestActions:
    def test_unknown_action_returns_400(self, super_admin, first_ready_reference_id):
        r = super_admin.post(
            f"{BASE}/api/references/{first_ready_reference_id}/actions",
            json={"action": "explode"}, timeout=20,
        )
        assert r.status_code == 400, r.text[:200]

    def test_link_project_missing_project_id_returns_400(self, super_admin, first_ready_reference_id):
        r = super_admin.post(
            f"{BASE}/api/references/{first_ready_reference_id}/actions",
            json={"action": "link_project"}, timeout=20,
        )
        assert r.status_code == 400, r.text[:200]

    def test_link_project_cross_tenant_returns_404(self, super_admin, first_ready_reference_id):
        # Bogus / cross-tenant project id => 404
        r = super_admin.post(
            f"{BASE}/api/references/{first_ready_reference_id}/actions",
            json={"action": "link_project",
                  "project_id": "00000000-0000-0000-0000-000000000000"},
            timeout=20,
        )
        assert r.status_code == 404, r.text[:200]

    def test_link_project_ok(self, super_admin, first_ready_reference_id):
        # Find or create a project in super_admin's tenant
        pr = super_admin.get(f"{BASE}/api/projects", timeout=20)
        assert pr.status_code == 200, pr.text[:200]
        body = pr.json()
        plist = body.get("data") or body.get("projects") or (body if isinstance(body, list) else [])
        if not plist:
            pytest.skip("no projects available in tenant")
        pid = plist[0]["id"]
        r = super_admin.post(
            f"{BASE}/api/references/{first_ready_reference_id}/actions",
            json={"action": "link_project", "project_id": pid}, timeout=20,
        )
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert data.get("ok") is True
        assert data.get("action") == "link_project"
        assert data.get("project_id") == pid

    @pytest.mark.parametrize("action", ["discuss", "moodboard", "material_study"])
    def test_lightweight_actions_ok(self, super_admin, first_ready_reference_id, action):
        r = super_admin.post(
            f"{BASE}/api/references/{first_ready_reference_id}/actions",
            json={"action": action}, timeout=20,
        )
        assert r.status_code == 200, r.text[:200]
        data = r.json()
        assert data.get("ok") is True
        assert data.get("action") == action


class TestTenantIsolation:
    def test_showroom_sees_zero_seeded_references(self, showroom):
        r = showroom.get(f"{BASE}/api/references", timeout=20)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        # showroom is a different tenant — must not see any MOOD Demo Studio refs
        assert body.get("total", 0) == 0, f"expected 0, got {body.get('total')}"
        assert body.get("references", []) == []

    def test_showroom_sees_zero_collections(self, showroom):
        r = showroom.get(f"{BASE}/api/reference-collections", timeout=20)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("total", 0) == 0
        assert body.get("collections", []) == []

    def test_showroom_cannot_action_studio_reference(self, showroom, first_ready_reference_id):
        r = showroom.post(
            f"{BASE}/api/references/{first_ready_reference_id}/actions",
            json={"action": "discuss"}, timeout=20,
        )
        assert r.status_code == 404, r.text[:200]
