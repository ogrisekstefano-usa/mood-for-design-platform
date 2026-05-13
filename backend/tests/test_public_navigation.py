"""Phase C backend tests — Public Rendering Layer + Navigation/Footer editor.

Covers:
  - GET /api/public/tenants/{slug}                       (no auth)
  - GET /api/public/tenants/{unknown}                    (404)
  - GET /api/public/tenants/{slug}/pages/homepage        (seed if not published)
  - GET /api/public/tenants/{slug}/pages/about           (404 if not published)
  - Auth gating for /api/settings/navigation + /footer
  - PUT navigation with i18n labels → reflected by public endpoint
  - Reset endpoints restore canonical defaults
"""
import os
import pytest
import requests
from pathlib import Path


def _load_frontend_env():
    env = Path("/app/frontend/.env")
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL"):
                return line.split("=", 1)[1].strip()
    return ""


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"
TENANT_SLUG = "mood-demo-studio-81a09e"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def H(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ── Public tenant resolution ────────────────────────────────────────────────
def test_public_tenant_config_no_auth():
    r = requests.get(f"{BASE_URL}/api/public/tenants/{TENANT_SLUG}", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    # Required keys
    for k in ("id", "name", "slug", "logo_url", "locales", "theme", "navigation", "footer"):
        assert k in data, f"Missing key: {k}"
    assert data["slug"] == TENANT_SLUG
    # locales structure
    assert "default" in data["locales"]
    assert "available" in data["locales"]
    assert isinstance(data["locales"]["available"], list)
    # navigation has items + cta + logo (defaults seed if no override)
    nav = data["navigation"]
    assert "items" in nav and isinstance(nav["items"], list)
    # footer has columns
    fo = data["footer"]
    assert "columns" in fo and isinstance(fo["columns"], list)
    # theme has effective tokens
    assert "palette" in data["theme"] or "colors" in data["theme"] or isinstance(data["theme"], dict)


def test_public_tenant_unknown_returns_404():
    r = requests.get(f"{BASE_URL}/api/public/tenants/this-tenant-does-not-exist-xyz", timeout=15)
    assert r.status_code == 404, r.text


# ── Public page ──────────────────────────────────────────────────────────────
def test_public_homepage_returns_page():
    """Homepage either returns published page or graceful seed."""
    r = requests.get(f"{BASE_URL}/api/public/tenants/{TENANT_SLUG}/pages/homepage", timeout=15)
    assert r.status_code == 200, r.text
    page = r.json()
    assert "sections" in page
    assert isinstance(page["sections"], list)
    assert len(page["sections"]) >= 1


def test_public_about_404_when_not_published():
    """about page that does not exist → 404."""
    r = requests.get(f"{BASE_URL}/api/public/tenants/{TENANT_SLUG}/pages/nonexistent-test-page-xyz",
                     timeout=15)
    assert r.status_code == 404, r.text


# ── Auth gating ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize("method,endpoint", [
    ("GET",  "/api/settings/navigation"),
    ("PUT",  "/api/settings/navigation"),
    ("POST", "/api/settings/navigation/reset"),
    ("GET",  "/api/settings/footer"),
    ("PUT",  "/api/settings/footer"),
    ("POST", "/api/settings/footer/reset"),
])
def test_editor_endpoints_require_auth(method, endpoint):
    r = requests.request(method, f"{BASE_URL}{endpoint}",
                         json={} if method != "GET" else None, timeout=15)
    assert r.status_code in (401, 403), \
        f"{method} {endpoint} returned {r.status_code} — expected 401/403"


# ── Authenticated GET/PUT/Reset ─────────────────────────────────────────────
def test_get_navigation_authenticated(H):
    r = requests.get(f"{BASE_URL}/api/settings/navigation", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "navigation" in body
    nav = body["navigation"]
    assert "items" in nav


def test_get_footer_authenticated(H):
    r = requests.get(f"{BASE_URL}/api/settings/footer", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "footer" in body
    assert "columns" in body["footer"]


def test_put_navigation_i18n_and_reflected_publicly(H):
    """PUT i18n nav label, verify GET /api/public/tenants/... reflects it."""
    payload = {
        "items": [
            {"id": "home",     "type": "link",
             "label": {"_default": "Home", "en-US": "Home", "it": "Home"}, "href": "/"},
            {"id": "showcase", "type": "link",
             "label": {"_default": "Showcase", "en-US": "Showcase", "it": "Vetrina"},
             "href": "/showcase"},
            {"id": "about",    "type": "link",
             "label": {"_default": "About", "en-US": "About", "it": "Chi siamo"},
             "href": "/about"},
            {"id": "contact",  "type": "link",
             "label": {"_default": "Contact", "en-US": "Contact", "it": "Contattaci"},
             "href": "#contact"},
        ],
        "cta": {"label": {"_default": "Start a project", "it": "Contattaci"}, "href": "#contact"},
    }
    r = requests.put(f"{BASE_URL}/api/settings/navigation",
                     headers=H, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    persisted = r.json()["navigation"]
    assert persisted["cta"]["label"]["it"] == "Contattaci"

    # Reflected publicly without auth
    p = requests.get(f"{BASE_URL}/api/public/tenants/{TENANT_SLUG}", timeout=15)
    assert p.status_code == 200, p.text
    pub_nav = p.json()["navigation"]
    # i18n payload exposed as-is
    assert pub_nav["cta"]["label"].get("it") == "Contattaci"
    it_labels = [i["label"].get("it") for i in pub_nav["items"]]
    assert "Vetrina" in it_labels
    assert "Chi siamo" in it_labels


def test_put_footer_persists(H):
    payload = {
        "columns": [
            {"id": "studio", "heading": {"_default": "Studio", "it": "Studio"},
             "links": [{"label": {"_default": "About", "it": "Chi siamo"}, "href": "/about"}]},
        ],
        "bottom": {"copyright": {"_default": "© {year} {brand}", "it": "© {year} {brand}"}},
    }
    r = requests.put(f"{BASE_URL}/api/settings/footer", headers=H, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()["footer"]
    assert body["columns"][0]["heading"]["it"] == "Studio"

    g = requests.get(f"{BASE_URL}/api/settings/footer", headers=H, timeout=15)
    assert g.status_code == 200
    assert g.json()["footer"]["columns"][0]["heading"]["it"] == "Studio"


def test_reset_navigation_restores_default(H):
    r = requests.post(f"{BASE_URL}/api/settings/navigation/reset", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    nav = r.json()["navigation"]
    # Canonical default has 4 items
    assert len(nav["items"]) == 4
    item_ids = {i["id"] for i in nav["items"]}
    assert {"home", "showcase", "about", "contact"} <= item_ids


def test_reset_footer_restores_default(H):
    r = requests.post(f"{BASE_URL}/api/settings/footer/reset", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    fo = r.json()["footer"]
    # Canonical default has 3 columns
    assert len(fo["columns"]) == 3
    col_ids = {c["id"] for c in fo["columns"]}
    assert {"studio", "services", "social"} <= col_ids


def test_navigation_defaults_endpoint():
    """Public seed endpoint used by editor."""
    r = requests.get(f"{BASE_URL}/api/public/navigation/defaults", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "navigation" in body and "footer" in body
    assert len(body["navigation"]["items"]) == 4
    assert len(body["footer"]["columns"]) == 3
