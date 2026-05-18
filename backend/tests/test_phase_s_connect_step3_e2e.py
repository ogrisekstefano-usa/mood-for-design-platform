"""Phase S-CONNECT Step 3 — Projects Studio™ end-to-end (LLM + isolation).

Exercises the FULL workflow including:
  - real Claude compose for an Italian (it-IT) market
  - variant publish flips public list/detail
  - cross-tenant isolation (studio2 cannot touch demo's master)
"""
import os
import uuid
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") + "/api"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASS = "Blueprint2024!"
DEMO_TENANT_SLUG = "mood-demo-studio-81a09e"

STUDIO2_EMAIL = "studio2@moodfordesign.com"
STUDIO2_PASS = "Studio2024!"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(DEMO_EMAIL, DEMO_PASS)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def studio2_headers():
    return {"Authorization": f"Bearer {_login(STUDIO2_EMAIL, STUDIO2_PASS)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def italian_market(admin_headers):
    """Resolve the demo tenant's active Italian market_id from /api/tenants/me/markets."""
    r = requests.get(f"{API}/tenants/me/markets", headers=admin_headers, timeout=10)
    assert r.status_code == 200, r.text
    payload = r.json()
    markets = payload.get("markets") if isinstance(payload, dict) else payload
    if not markets:
        pytest.skip("no markets returned for tenant")
    active = [m for m in markets if m.get("is_active") in (True, None)]
    # Prefer it-IT locale
    italian = next((m for m in active if (m.get("locale_code") or m.get("default_locale") or "").lower().startswith("it")), None)
    if not italian:
        italian = active[0]
    return italian


@pytest.fixture(scope="module")
def composed_master(admin_headers):
    """Create a master, publish it, return master row."""
    slug = f"e2e-compose-{uuid.uuid4().hex[:8]}"
    body = {
        "slug": slug, "title": "Villa Belvedere", "category": "residential",
        "subtitle": "A travertine retreat above the lake",
        "client": "Famiglia Rossi", "location": "Como, Italia",
        "year": 2025, "material_palette": ["travertino romano", "noce canaletto", "lino grezzo"],
        "story_body": [
            {"type": "paragraph", "text": "The villa sits on a south-facing ridge above Lake Como, framed by century-old cypress."},
            {"type": "paragraph", "text": "Interiors are organized around a central travertine hearth that anchors living, dining and library wings."},
        ],
        "gallery": [
            {"id": "g1", "url": "https://example.com/g1.jpg", "caption": "Living room with travertine hearth"},
            {"id": "g2", "url": "https://example.com/g2.jpg", "caption": "Dining wing"},
        ],
        "default_locale": "it-IT",
    }
    r = requests.post(f"{API}/portfolio/admin/projects", json=body, headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    master = r.json()
    # publish so public endpoints can serve
    pub = requests.post(f"{API}/portfolio/admin/projects/{master['id']}/publish", json={},
                       headers=admin_headers, timeout=10)
    assert pub.status_code == 200
    yield master
    requests.delete(f"{API}/portfolio/admin/projects/{master['id']}", headers=admin_headers, timeout=10)


# ─────────────── REAL Claude compose ───────────────
def test_compose_market_edition_real_claude(admin_headers, composed_master, italian_market):
    """REAL Claude call — expect 30-60s. Verifies variant is culturally adapted."""
    market_id = italian_market.get("id") or italian_market.get("market_id")
    assert market_id, f"no market id in {italian_market}"
    t0 = time.time()
    r = requests.post(
        f"{API}/portfolio/admin/projects/{composed_master['id']}/compose",
        json={"market_id": market_id},
        headers=admin_headers, timeout=180,
    )
    elapsed = time.time() - t0
    assert r.status_code == 200, f"compose failed in {elapsed:.1f}s: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("ok") is True, body
    assert body.get("variant_id"), body
    print(f"[compose] OK in {elapsed:.1f}s variant_id={body['variant_id']}")

    # Read back the master+variants
    read = requests.get(f"{API}/portfolio/admin/projects/{composed_master['id']}",
                       headers=admin_headers, timeout=10)
    assert read.status_code == 200
    payload = read.json()
    variants = payload["variants"]
    assert variants, "no variants persisted"
    v = next((x for x in variants if x["id"] == body["variant_id"]), variants[0])

    # Must be Italian
    assert (v.get("target_locale") or "").lower().startswith("it"), v.get("target_locale")
    # Cultural fields populated
    for fld in ("cultural_angle", "hospitality_tone", "material_language", "story_body"):
        assert v.get(fld), f"variant.{fld} is empty: {v}"
    # story_body should be a list of block dicts
    assert isinstance(v["story_body"], list) and len(v["story_body"]) > 0

    # Not a literal translation: compare a master sentence vs variant body
    master_text = " ".join(b.get("text", "") for b in composed_master.get("story_body", [])).lower()
    variant_text = " ".join(
        (b.get("text") or b.get("body") or "") for b in v["story_body"] if isinstance(b, dict)
    ).lower()
    if master_text and variant_text:
        # quick heuristic: the variant should not be a verbatim copy of the master English text
        assert master_text not in variant_text, "variant appears to be a verbatim copy of the master"

    return body["variant_id"]


def test_variant_patch_then_publish_then_public(admin_headers, composed_master, italian_market):
    """After compose, patch the variant, publish it, then read via public locale-filtered endpoints."""
    # find existing variant for the master (already composed in prior test)
    read = requests.get(f"{API}/portfolio/admin/projects/{composed_master['id']}",
                       headers=admin_headers, timeout=10)
    assert read.status_code == 200
    variants = read.json()["variants"]
    if not variants:
        pytest.skip("no variant present (compose test likely failed)")
    v = variants[0]
    vid = v["id"]

    # patch
    p = requests.patch(f"{API}/portfolio/admin/variants/{vid}",
                      json={"variant_title": "Villa Belvedere · Edizione Italiana"},
                      headers=admin_headers, timeout=10)
    assert p.status_code == 200
    assert p.json()["variant_title"] == "Villa Belvedere · Edizione Italiana"

    # publish variant
    pub = requests.post(f"{API}/portfolio/admin/variants/{vid}/publish", json={},
                       headers=admin_headers, timeout=10)
    assert pub.status_code == 200
    assert pub.json()["is_published"] is True

    # public list (anonymous) should now have at least 1
    pl = requests.get(f"{API}/portfolio/public/{DEMO_TENANT_SLUG}/projects", timeout=10)
    assert pl.status_code == 200
    plj = pl.json()
    assert plj["total"] >= 1, plj
    slugs = [p["slug"] for p in plj["projects"]]
    assert composed_master["slug"] in slugs

    # public detail with locale_code=it-IT must return variant-shaped payload
    locale = (v.get("target_locale") or "it-IT")
    pd = requests.get(
        f"{API}/portfolio/public/{DEMO_TENANT_SLUG}/{composed_master['slug']}",
        params={"locale_code": locale}, timeout=10,
    )
    assert pd.status_code == 200
    proj = pd.json()["project"]
    assert proj["slug"] == composed_master["slug"]
    assert proj.get("cultural_angle"), "variant cultural_angle missing on public detail"
    assert proj.get("story_body"), "story_body empty on public detail"
    assert proj.get("target_locale", "").lower().startswith("it")


# ─────────────── Cross-tenant isolation ───────────────
def test_cross_tenant_isolation_read(admin_headers, studio2_headers, composed_master):
    """studio2 (different tenant) must NOT be able to read demo's master."""
    r = requests.get(f"{API}/portfolio/admin/projects/{composed_master['id']}",
                    headers=studio2_headers, timeout=10)
    assert r.status_code in (403, 404), f"isolation breach: studio2 got {r.status_code}: {r.text}"


def test_cross_tenant_isolation_patch(studio2_headers, composed_master):
    r = requests.patch(f"{API}/portfolio/admin/projects/{composed_master['id']}",
                      json={"subtitle": "HACKED"}, headers=studio2_headers, timeout=10)
    assert r.status_code in (403, 404), f"isolation breach on PATCH: {r.status_code}"


def test_cross_tenant_isolation_delete(studio2_headers, composed_master, admin_headers):
    requests.delete(f"{API}/portfolio/admin/projects/{composed_master['id']}",
                   headers=studio2_headers, timeout=10)
    # confirm master still exists under demo
    r = requests.get(f"{API}/portfolio/admin/projects/{composed_master['id']}",
                    headers=admin_headers, timeout=10)
    assert r.status_code == 200, "demo's master was deleted via cross-tenant call!"
