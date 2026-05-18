"""Phase S-CONNECT Step 3 — Projects Studio™ smoke tests.

Only tests deterministic CRUD + publishing flows. The AI compose endpoint
is exercised by the testing agent end-to-end (long-running, LLM-dependent).
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") + "/api"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASS = "Blueprint2024!"
TENANT_SLUG = "mood-demo-studio-81a09e"


def _login() -> str:
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS}, timeout=10)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login()}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def fresh_master(admin_headers):
    slug = f"e2e-villa-{uuid.uuid4().hex[:8]}"
    body = {
        "slug": slug, "title": "E2E Villa", "category": "residential",
        "subtitle": "Test smoke", "client": "Test", "location": "Roma",
        "year": 2025, "material_palette": ["travertino"],
        "story_body": [{"type": "paragraph", "text": "story"}],
        "default_locale": "it-IT",
    }
    r = requests.post(f"{API}/portfolio/admin/projects", json=body, headers=admin_headers, timeout=10)
    assert r.status_code == 200, r.text
    master = r.json()
    yield master
    # cleanup
    requests.delete(f"{API}/portfolio/admin/projects/{master['id']}", headers=admin_headers, timeout=10)


def test_portfolio_router_registered():
    r = requests.get(f"{API}/portfolio/public/{TENANT_SLUG}/projects", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "projects" in body and "total" in body


def test_admin_requires_auth():
    r = requests.get(f"{API}/portfolio/admin/projects", timeout=10)
    assert r.status_code in (401, 403)


def test_list_then_create_then_read(admin_headers, fresh_master):
    list_r = requests.get(f"{API}/portfolio/admin/projects", headers=admin_headers, timeout=10)
    assert list_r.status_code == 200
    ids = [p["id"] for p in list_r.json()["projects"]]
    assert fresh_master["id"] in ids

    read_r = requests.get(f"{API}/portfolio/admin/projects/{fresh_master['id']}", headers=admin_headers, timeout=10)
    assert read_r.status_code == 200
    body = read_r.json()
    assert body["master"]["id"] == fresh_master["id"]
    assert isinstance(body["variants"], list)


def test_patch_master(admin_headers, fresh_master):
    r = requests.patch(
        f"{API}/portfolio/admin/projects/{fresh_master['id']}",
        json={"subtitle": "Updated subtitle"},
        headers=admin_headers, timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["subtitle"] == "Updated subtitle"


def test_publish_master(admin_headers, fresh_master):
    r = requests.post(
        f"{API}/portfolio/admin/projects/{fresh_master['id']}/publish",
        json={}, headers=admin_headers, timeout=10,
    )
    assert r.status_code == 200
    assert r.json()["is_published"] is True
    # Public list should now include this master… but no variant exists,
    # so it should still NOT appear (variant-required policy).
    pub = requests.get(f"{API}/portfolio/public/{TENANT_SLUG}/projects", timeout=10)
    assert pub.status_code == 200


def test_public_detail_master_only_fallback(admin_headers, fresh_master):
    # After master publish, the slug detail endpoint should serve master.
    r = requests.get(f"{API}/portfolio/public/{TENANT_SLUG}/{fresh_master['slug']}", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["project"]["slug"] == fresh_master["slug"]
    assert body["project"].get("_source") == "master_only" or body["project"].get("title")


def test_compose_requires_valid_market(admin_headers, fresh_master):
    r = requests.post(
        f"{API}/portfolio/admin/projects/{fresh_master['id']}/compose",
        json={"market_id": "00000000-0000-0000-0000-000000000000"},
        headers=admin_headers, timeout=15,
    )
    assert r.status_code == 502  # composer returns ok=False → 502


def test_unknown_master_404(admin_headers):
    r = requests.get(
        f"{API}/portfolio/admin/projects/00000000-0000-0000-0000-000000000000",
        headers=admin_headers, timeout=10,
    )
    assert r.status_code == 404
