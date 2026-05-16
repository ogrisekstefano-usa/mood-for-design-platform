"""Phase Y.1 EXT + Y.2 — Magazine engine regression suite.

Covers:
  * Admin list/get articles (the P0 'articles: 0' bug)
  * Admin CRUD on articles + hotspots, publish, reading_minutes auto-calc
  * Tenant isolation (Showroom admin must not see Demo Studio articles)
  * Public list w/ filters (category / tag / vertical / reading_min / reading_max)
  * Public taxonomy
  * Public related-articles
  * Public article detail w/ hotspots
  * Public save-reference (anonymous soft-lead) for hospitality hotspot
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")
DEMO_TENANT_SLUG = "mood-demo-studio-81a09e"
DEMO_TENANT_ID = "81a09ead-0306-4d71-a5c4-ca2b3956add2"

DEMO_ADMIN = ("demo@moodfordesign.com", "Blueprint2024!")
OTHER_TENANT_ADMIN = ("studio2@moodfordesign.com", "Studio2024!")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    tok = r.json().get("session", {}).get("access_token")
    assert tok, "no access_token in login response"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(*DEMO_ADMIN)


@pytest.fixture(scope="module")
def other_token():
    return _login(*OTHER_TENANT_ADMIN)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def other_headers(other_token):
    return {"Authorization": f"Bearer {other_token}", "Content-Type": "application/json"}


# ──────────────────────────────────────────────────────────────
# ADMIN list / get  (P0 bug regression)
# ──────────────────────────────────────────────────────────────

def test_admin_list_articles_returns_two(admin_headers):
    r = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text[:300]
    arts = r.json().get("articles", [])
    assert len(arts) >= 2, f"expected ≥2 articles, got {len(arts)}"
    slugs = {a["slug"] for a in arts}
    assert "casa-vista-mare-ligure" in slugs
    assert "mediterranean-boutique-hospitality-puglia" in slugs


def test_admin_get_article_includes_hotspots(admin_headers):
    r = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=admin_headers, timeout=20)
    hosp = next(a for a in r.json()["articles"] if a["slug"] == "mediterranean-boutique-hospitality-puglia")
    rid = hosp["id"]
    g = requests.get(f"{BASE_URL}/api/magazine/admin/articles/{rid}", headers=admin_headers, timeout=20)
    assert g.status_code == 200, g.text[:300]
    body = g.json()
    assert "hotspots" in body, "admin_get_article must return hotspots[]"
    assert isinstance(body["hotspots"], list)
    assert len(body["hotspots"]) == 4, f"expected 4 hospitality hotspots, got {len(body['hotspots'])}"


# ──────────────────────────────────────────────────────────────
# PATCH body_blocks → auto-recompute reading_minutes
# ──────────────────────────────────────────────────────────────

def test_patch_body_blocks_recomputes_reading_minutes(admin_headers):
    lst = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=admin_headers, timeout=20).json()
    res = next(a for a in lst["articles"] if a["slug"] == "casa-vista-mare-ligure")
    aid = res["id"]
    original_body = res.get("body_blocks") or []
    original_minutes = res.get("reading_minutes")
    # Send a large body_blocks to push reading_minutes up
    big_text = " ".join(["parola"] * 1500)
    patch_body = {
        "body_blocks": [
            {"id": "tmp", "type": "paragraph", "locale_content": {"it": {"text": big_text}}}
        ]
    }
    pr = requests.patch(f"{BASE_URL}/api/magazine/admin/articles/{aid}",
                        headers=admin_headers, json=patch_body, timeout=20)
    assert pr.status_code == 200, pr.text[:300]
    new_minutes = pr.json().get("reading_minutes")
    assert new_minutes and new_minutes >= 6, f"expected ≥6 min, got {new_minutes}"
    # restore
    requests.patch(f"{BASE_URL}/api/magazine/admin/articles/{aid}",
                   headers=admin_headers,
                   json={"body_blocks": original_body, "reading_minutes": original_minutes},
                   timeout=20)


# ──────────────────────────────────────────────────────────────
# HOTSPOT CRUD
# ──────────────────────────────────────────────────────────────

def test_hotspot_crud_full_cycle(admin_headers):
    lst = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=admin_headers, timeout=20).json()
    art = next(a for a in lst["articles"] if a["slug"] == "casa-vista-mare-ligure")
    aid = art["id"]
    # CREATE
    hot_body = {
        "block_id": "test-block-" + uuid.uuid4().hex[:6],
        "x_pct": 42.5, "y_pct": 58.3,
        "reference_type": "atmosphere",
        "locale_content": {"it": {"label": "TEST hotspot"}},
        "cta_action": "save_to_project", "sort_order": 99,
    }
    c = requests.post(f"{BASE_URL}/api/magazine/admin/articles/{aid}/hotspots",
                      headers=admin_headers, json=hot_body, timeout=20)
    assert c.status_code in (200, 201), c.text[:300]
    hid = c.json()["id"]
    assert c.json()["x_pct"] == 42.5
    # PATCH
    p = requests.patch(f"{BASE_URL}/api/magazine/admin/hotspots/{hid}",
                       headers=admin_headers, json={"x_pct": 12.1, "y_pct": 80.0}, timeout=20)
    assert p.status_code == 200, p.text[:300]
    assert p.json()["x_pct"] == 12.1
    # DELETE
    d = requests.delete(f"{BASE_URL}/api/magazine/admin/hotspots/{hid}",
                        headers=admin_headers, timeout=20)
    assert d.status_code == 200, d.text[:300]


# ──────────────────────────────────────────────────────────────
# Publish
# ──────────────────────────────────────────────────────────────

def test_publish_endpoint_ok(admin_headers):
    lst = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=admin_headers, timeout=20).json()
    art = lst["articles"][0]
    r = requests.post(f"{BASE_URL}/api/magazine/admin/articles/{art['id']}/publish",
                      headers=admin_headers, timeout=20)
    assert r.status_code == 200, r.text[:300]
    assert r.json().get("ok") is True


# ──────────────────────────────────────────────────────────────
# Tenant isolation
# ──────────────────────────────────────────────────────────────

def test_other_tenant_cannot_see_demo_articles(other_headers, admin_headers):
    # Other tenant admin lists their own articles — none should be demo studio's
    r = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=other_headers, timeout=20)
    assert r.status_code == 200, r.text[:300]
    slugs = {a["slug"] for a in r.json().get("articles", [])}
    assert "casa-vista-mare-ligure" not in slugs
    assert "mediterranean-boutique-hospitality-puglia" not in slugs


def test_other_tenant_cannot_get_demo_article_by_id(other_headers, admin_headers):
    lst = requests.get(f"{BASE_URL}/api/magazine/admin/articles", headers=admin_headers, timeout=20).json()
    demo_aid = lst["articles"][0]["id"]
    g = requests.get(f"{BASE_URL}/api/magazine/admin/articles/{demo_aid}", headers=other_headers, timeout=20)
    assert g.status_code == 404, f"expected 404 cross-tenant, got {g.status_code}"


# ──────────────────────────────────────────────────────────────
# PUBLIC endpoints
# ──────────────────────────────────────────────────────────────

def test_public_list_two_articles_ordered():
    r = requests.get(f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/articles", timeout=20)
    assert r.status_code == 200, r.text[:300]
    arts = r.json()["articles"]
    assert len(arts) >= 2
    # ordered by published_at desc
    pubs = [a.get("published_at") for a in arts if a.get("published_at")]
    assert pubs == sorted(pubs, reverse=True)
    # project_vertical present
    assert any(a.get("project_vertical") for a in arts)


def test_public_filter_category_hospitality():
    r = requests.get(f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/articles",
                     params={"category": "hospitality"}, timeout=20)
    assert r.status_code == 200
    arts = r.json()["articles"]
    assert len(arts) == 1, f"expected exactly 1 hospitality article, got {len(arts)}"
    assert arts[0]["slug"] == "mediterranean-boutique-hospitality-puglia"


def test_public_filter_tag_puglia():
    r = requests.get(f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/articles",
                     params={"tag": "puglia"}, timeout=20)
    assert r.status_code == 200
    arts = r.json()["articles"]
    assert len(arts) == 1
    assert arts[0]["slug"] == "mediterranean-boutique-hospitality-puglia"


def test_public_filter_reading_max_4():
    r = requests.get(f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/articles",
                     params={"reading_max": 4}, timeout=20)
    assert r.status_code == 200
    arts = r.json()["articles"]
    slugs = {a["slug"] for a in arts}
    assert "casa-vista-mare-ligure" in slugs
    assert "mediterranean-boutique-hospitality-puglia" not in slugs


def test_public_taxonomy():
    r = requests.get(f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/taxonomy", timeout=20)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    for k in ("categories", "verticals", "tags", "materials", "atmospheres"):
        assert k in body, f"missing {k}"
        assert isinstance(body[k], list)
    assert "hospitality" in body["categories"] or "residential" in body["categories"]
    assert len(body["tags"]) > 0


def test_public_related_articles_hospitality_returns_residential():
    r = requests.get(
        f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/articles/mediterranean-boutique-hospitality-puglia/related",
        timeout=20)
    assert r.status_code == 200, r.text[:300]
    arts = r.json()["articles"]
    assert len(arts) >= 1, "related must surface the residential article"
    assert any(a["slug"] == "casa-vista-mare-ligure" for a in arts)


def test_public_article_detail_residential_has_4_hotspots():
    r = requests.get(
        f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/articles/casa-vista-mare-ligure",
        timeout=20)
    assert r.status_code == 200, r.text[:300]
    art = r.json()["article"]
    assert "hotspots" in art
    assert len(art["hotspots"]) == 4, f"expected 4 hotspots, got {len(art['hotspots'])}"


def test_public_save_reference_hospitality_hotspot():
    # Get hospitality article + first hotspot
    r = requests.get(
        f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/articles/mediterranean-boutique-hospitality-puglia",
        timeout=20)
    assert r.status_code == 200
    art = r.json()["article"]
    hs = art.get("hotspots") or []
    assert hs, "hospitality article must have hotspots"
    payload = {
        "article_id": art["id"],
        "hotspot_id": hs[0]["id"],
        "locale": "it",
        "email": f"TEST_anon_{uuid.uuid4().hex[:8]}@example.com",
        "first_name": "Test",
        "last_name": "Anon",
    }
    s = requests.post(f"{BASE_URL}/api/magazine/public/{DEMO_TENANT_SLUG}/save-reference",
                      json=payload, timeout=20)
    assert s.status_code in (200, 201), s.text[:300]
    body = s.json()
    assert body.get("ok") is True
    assert body.get("lead_id")
    assert body.get("candidate_id")
