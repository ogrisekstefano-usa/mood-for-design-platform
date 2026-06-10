"""
Backend tests for Plan-Aware Server-First License Enforcement.

Covers (Phase 3 — Projects, Moodboards, Storage, Domains):
- GET /api/license returns plan + limits (incl. max_moodboards) + real usage
- POST /api/projects 403 LICENSE_LIMIT_REACHED when over starter limit
- POST /api/moodboards 403 LICENSE_LIMIT_REACHED when over starter limit
- POST /api/domains 403 on custom domain at cap, but SUCCESS on subdomain bypass
- POST /api/storage/signed-upload 403 LICENSE_LIMIT_REACHED on storage_gb
- POST /api/moodboards/{id}/archive then /restore lifecycle
- POST /api/license/{tenant_id}/assign — super_admin only, enterprise restore

IMPORTANT: This suite flips the demo tenant to 'starter' and MUST restore
to 'enterprise' at the end (session-scoped fixture finalizer).
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://i18n-recovery-1.preview.emergentagent.com").rstrip("/")
SUPER_EMAIL = "demo@moodfordesign.com"
SUPER_PASSWORD = "Blueprint2024!"
DEMO_TENANT_ID = "81a09ead-0306-4d71-a5c4-ca2b3956add2"


# ─────────────────────────── fixtures ───────────────────────────
@pytest.fixture(scope="session")
def super_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = (
        data.get("session", {}).get("access_token")
        or data.get("access_token")
        or data.get("token")
    )
    assert token, f"No access token: {data}"
    return token


@pytest.fixture(scope="session")
def headers(super_token):
    return {"Authorization": f"Bearer {super_token}", "Content-Type": "application/json"}


def _assign_plan(headers, plan_key):
    r = requests.post(
        f"{BASE_URL}/api/license/{DEMO_TENANT_ID}/assign",
        headers=headers,
        json={"plan_key": plan_key},
        timeout=30,
    )
    return r


@pytest.fixture(scope="session", autouse=True)
def restore_enterprise(headers):
    """Run last: ensure tenant is on 'enterprise' so demo isn't left locked."""
    yield
    r = _assign_plan(headers, "enterprise")
    assert r.status_code == 200, f"Failed to restore enterprise: {r.status_code} {r.text}"


# ────────── GET /api/license shape ──────────
class TestLicenseEndpoint:
    def test_license_returns_plan_limits_usage(self, headers):
        # Ensure enterprise first so we have a known state for shape
        _assign_plan(headers, "enterprise")
        r = requests.get(f"{BASE_URL}/api/license", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tenant_id"] == DEMO_TENANT_ID
        assert "plan_key" in data
        # limits dict with max_moodboards (Phase 3 addition)
        assert "limits" in data
        lim = data["limits"]
        for k in ("max_users", "max_projects", "max_moodboards",
                  "max_storage_gb", "max_domains", "max_ai_credits"):
            assert k in lim, f"missing {k} in limits"
        # usage with real storage bytes
        assert "usage" in data
        us = data["usage"]
        for k in ("users", "projects", "moodboards", "storage_gb",
                  "storage_bytes", "domains", "ai_credits_used"):
            assert k in us, f"missing {k} in usage"
        # storage_gb computed from bytes (within rounding)
        assert isinstance(us["storage_bytes"], int)
        assert us["storage_bytes"] >= 0
        gb_calc = round(us["storage_bytes"] / (1024 ** 3), 3)
        assert abs(us["storage_gb"] - gb_calc) < 0.01


# ────────── Plan assignment (super_admin) ──────────
class TestPlanAssignment:
    def test_assign_starter_then_enterprise(self, headers):
        r = _assign_plan(headers, "starter")
        assert r.status_code == 200, r.text
        assert r.json()["plan_key"] == "starter"
        assert r.json()["limits"]["max_projects"] == 5

        r2 = _assign_plan(headers, "enterprise")
        assert r2.status_code == 200, r2.text
        assert r2.json()["plan_key"] == "enterprise"
        # All limits NULL on enterprise
        for v in r2.json()["limits"].values():
            assert v is None, f"enterprise should have unlimited (NULL), got {v}"

    def test_assign_invalid_plan_400(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/license/{DEMO_TENANT_ID}/assign",
            headers=headers, json={"plan_key": "nonexistent"}, timeout=30,
        )
        assert r.status_code == 400


# ────────── Capacity gates on starter plan ──────────
class TestStarterCapsRejectCreation:
    """Tenant has 50+ projects, 150+ moodboards — switching to starter must reject."""

    def setup_method(self, _):
        # Re-login each method just in case; but headers fixture is class-scoped
        pass

    def test_projects_create_rejected_on_starter(self, headers):
        _assign_plan(headers, "starter")
        r = requests.post(
            f"{BASE_URL}/api/projects",
            headers=headers,
            json={"title": "TEST_quota_proj", "client_name": "TEST"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
        body = r.json()
        # FastAPI may wrap dict in {"detail": {...}}
        detail = body.get("detail", body)
        assert detail.get("code") == "LICENSE_LIMIT_REACHED"
        assert detail.get("resource") == "projects"
        assert detail.get("limit") == 5
        assert detail.get("plan") == "starter"
        assert isinstance(detail.get("current"), int)

    def test_moodboards_create_rejected_on_starter(self, headers):
        _assign_plan(headers, "starter")
        r = requests.post(
            f"{BASE_URL}/api/moodboards",
            headers=headers,
            json={"title": "TEST_quota_mb"},
            timeout=30,
        )
        assert r.status_code == 403, r.text
        detail = r.json().get("detail", r.json())
        assert detail.get("code") == "LICENSE_LIMIT_REACHED"
        assert detail.get("resource") == "moodboards"
        assert detail.get("limit") == 15

    def test_domain_custom_rejected_at_cap(self, headers):
        _assign_plan(headers, "starter")
        # Even if no custom domains exist, starter limit is 1.
        # First create attempt — count starts at 0 so should succeed; we test
        # that a SECOND custom domain (or any when already at cap) rejects.
        # Use unique hostname.
        host1 = f"test-custom-{uuid.uuid4().hex[:8]}.example.com"
        r1 = requests.post(
            f"{BASE_URL}/api/domains", headers=headers,
            json={"hostname": host1}, timeout=30,
        )
        # Could succeed (201) or fail if already at cap from prior test runs.
        # Either is fine — we want to verify the second one rejects.
        if r1.status_code == 201:
            created_id_1 = r1.json().get("id")
        else:
            assert r1.status_code in (403, 409), r1.text
            created_id_1 = None

        host2 = f"test-custom-{uuid.uuid4().hex[:8]}.example.com"
        r2 = requests.post(
            f"{BASE_URL}/api/domains", headers=headers,
            json={"hostname": host2}, timeout=30,
        )
        assert r2.status_code == 403, f"second custom domain should reject: {r2.status_code} {r2.text}"
        detail = r2.json().get("detail", r2.json())
        assert detail.get("code") == "LICENSE_LIMIT_REACHED"
        assert detail.get("resource") == "domains"

        # Cleanup created custom domain
        if created_id_1:
            requests.delete(f"{BASE_URL}/api/domains/{created_id_1}", headers=headers, timeout=30)

    def test_subdomain_bypass_succeeds_at_cap(self, headers):
        """*.moodfordesign.com must succeed even if custom-domain cap reached."""
        _assign_plan(headers, "starter")
        # Create a custom to reach cap first (best-effort)
        host_custom = f"test-cap-{uuid.uuid4().hex[:8]}.example.com"
        r_custom = requests.post(
            f"{BASE_URL}/api/domains", headers=headers,
            json={"hostname": host_custom}, timeout=30,
        )
        created_custom_id = r_custom.json().get("id") if r_custom.status_code == 201 else None

        # Now subdomain — should always succeed
        sub_host = f"test-sub-{uuid.uuid4().hex[:8]}.moodfordesign.com"
        r_sub = requests.post(
            f"{BASE_URL}/api/domains", headers=headers,
            json={"hostname": sub_host}, timeout=30,
        )
        assert r_sub.status_code == 201, f"subdomain should bypass cap: {r_sub.status_code} {r_sub.text}"
        body = r_sub.json()
        assert body.get("domain_type") == "subdomain"

        # Cleanup
        sub_id = body.get("id")
        if sub_id:
            requests.delete(f"{BASE_URL}/api/domains/{sub_id}", headers=headers, timeout=30)
        if created_custom_id:
            requests.delete(f"{BASE_URL}/api/domains/{created_custom_id}", headers=headers, timeout=30)

    def test_storage_signed_upload_rejected_over_quota(self, headers):
        _assign_plan(headers, "starter")
        # Starter = 5 GB. Request file 100 GB — must reject.
        huge = 100 * 1024 ** 3
        r = requests.post(
            f"{BASE_URL}/api/storage/signed-upload",
            headers=headers,
            json={
                "bucket": "tenant-assets",
                "path": f"TEST_quota_{uuid.uuid4().hex[:6]}.bin",
                "file_size": huge,
            },
            timeout=30,
        )
        assert r.status_code == 403, r.text
        detail = r.json().get("detail", r.json())
        assert detail.get("code") == "LICENSE_LIMIT_REACHED"
        assert detail.get("resource") == "storage_gb"


# ────────── Enterprise plan accepts creation ──────────
class TestEnterpriseAcceptsCreation:
    def test_create_project_on_enterprise(self, headers):
        _assign_plan(headers, "enterprise")
        name = f"TEST_ent_proj_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BASE_URL}/api/projects",
            headers=headers,
            json={"title": name, "client_name": "TEST"},
            timeout=30,
        )
        assert r.status_code == 201, r.text
        proj_id = r.json()["id"]
        # GET back to verify persistence
        g = requests.get(f"{BASE_URL}/api/projects/{proj_id}", headers=headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["title"] == name
        # Cleanup
        requests.delete(f"{BASE_URL}/api/projects/{proj_id}", headers=headers, timeout=30)


# ────────── Moodboard archive/restore lifecycle ──────────
class TestMoodboardArchiveRestore:
    def test_archive_then_restore(self, headers):
        _assign_plan(headers, "enterprise")
        # Create
        c = requests.post(
            f"{BASE_URL}/api/moodboards",
            headers=headers,
            json={"title": f"TEST_archive_{uuid.uuid4().hex[:6]}"},
            timeout=30,
        )
        assert c.status_code == 201, c.text
        mb_id = c.json()["id"]

        # Archive
        a = requests.post(
            f"{BASE_URL}/api/moodboards/{mb_id}/archive",
            headers=headers, timeout=30,
        )
        assert a.status_code == 200, a.text

        # Restore
        rs = requests.post(
            f"{BASE_URL}/api/moodboards/{mb_id}/restore",
            headers=headers, timeout=30,
        )
        assert rs.status_code == 200, rs.text
        body = rs.json()
        assert body.get("archived_at") is None
        assert body.get("deleted_at") is None

        # Cleanup (soft delete)
        requests.delete(f"{BASE_URL}/api/moodboards/{mb_id}", headers=headers, timeout=30)
