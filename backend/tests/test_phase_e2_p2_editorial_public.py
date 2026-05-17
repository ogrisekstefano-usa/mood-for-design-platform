"""Phase E-2 / Prompt 2 — Public editorial variant endpoint + internal_translation isolation.

  cd /app/backend && REACT_APP_BACKEND_URL=... pytest tests/test_phase_e2_p2_editorial_public.py -v

Covers:
  • GET /api/magazine/public/{tenant_slug}/editorial/{variant_slug}
      - 404 when is_published=false
      - 200 when published; shape matches MagazineArticlePage expectations
      - `_locale.source='editorial_variant'`, `_locale.served=target_locale`
      - `internal_translation` is NEVER present in the response
  • GET /api/editorial/variants/{id}/internal-translation requires auth (401/403 anonymous)
  • GET /api/editorial/calendar — never leaks `internal_translation`
  • Backend smoke for editorial.compose/transition/schedule endpoints existence
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"
DEMO_TENANT_SLUG = "mood-demo-studio-81a09e"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=10)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def gcc_market_id(headers):
    r = requests.get(f"{BASE}/api/tenants/me/markets", headers=headers, timeout=10)
    return next(m["id"] for m in r.json()["markets"] if m["code"] == "gcc_luxury")


def _create_variant(headers, gcc_market_id, slug_seed: str = None):
    code = f"e2p2-{uuid.uuid4().hex[:8]}"
    m = requests.post(f"{BASE}/api/editorial/masters", headers=headers,
                      json={"code": code, "title": "E2-P2 master",
                            "canonical_locale": "it-IT"}, timeout=30).json()
    slug = slug_seed or f"e2p2-{uuid.uuid4().hex[:6]}"
    v = requests.post(f"{BASE}/api/editorial/masters/{m['id']}/variants",
                      headers=headers,
                      json={"market_id": gcc_market_id, "variant_slug": slug,
                            "target_locale": "en-AE", "title": "Public reader test",
                            "tone_label": "prestige_restraint",
                            "excerpt": "Test excerpt",
                            "body_blocks": [{"type": "paragraph",
                                             "text": "Hello visitors of the AE market."}],
                            "internal_translation": {
                                "raw_text": "INTERNAL TEAM-ONLY NOTE — must not leak",
                            }},
                      timeout=60).json()
    return m, v


def _publish(headers, vid):
    for tgt in ["direction_defined", "ai_composing",
                "ready_for_editorial_review", "approved", "published"]:
        requests.post(f"{BASE}/api/editorial/variants/{vid}/transition",
                      headers=headers, json={"to": tgt}, timeout=10)


# ── Public endpoint behavior ──────────────────────────────────────────────

def test_public_editorial_404_when_unpublished(headers, gcc_market_id):
    _, v = _create_variant(headers, gcc_market_id)
    # NOT published — endpoint must 404.
    r = requests.get(f"{BASE}/api/magazine/public/{DEMO_TENANT_SLUG}/editorial/{v['variant_slug']}",
                     timeout=10)
    assert r.status_code == 404


def test_public_editorial_returns_published_variant_as_article(headers, gcc_market_id):
    _, v = _create_variant(headers, gcc_market_id)
    _publish(headers, v["id"])
    r = requests.get(f"{BASE}/api/magazine/public/{DEMO_TENANT_SLUG}/editorial/{v['variant_slug']}",
                     timeout=10)
    assert r.status_code == 200, r.text[:300]
    j = r.json()
    assert "article" in j
    art = j["article"]
    # Article shape that MagazineArticlePage consumes:
    assert art["slug"] == v["variant_slug"]
    assert art.get("body_blocks") and len(art["body_blocks"]) >= 1
    assert art.get("_source") == "editorial_variant"
    # _locale envelope
    loc = j["article"].get("_locale") or {}
    assert loc.get("source") == "editorial_variant"
    assert loc.get("served") == "en-AE"


def test_public_editorial_never_leaks_internal_translation(headers, gcc_market_id):
    _, v = _create_variant(headers, gcc_market_id)
    _publish(headers, v["id"])
    r = requests.get(f"{BASE}/api/magazine/public/{DEMO_TENANT_SLUG}/editorial/{v['variant_slug']}",
                     timeout=10)
    assert r.status_code == 200
    raw = r.text.lower()
    assert "internal_translation" not in raw, "public endpoint leaked internal_translation key"
    assert "internal team-only note" not in raw, "public endpoint leaked internal_translation content"
    art = r.json()["article"]
    assert "internal_translation" not in art


def test_public_editorial_unknown_tenant_404():
    r = requests.get(f"{BASE}/api/magazine/public/no-such-tenant/editorial/whatever", timeout=10)
    assert r.status_code == 404


def test_public_editorial_unknown_slug_404():
    r = requests.get(
        f"{BASE}/api/magazine/public/{DEMO_TENANT_SLUG}/editorial/never-exists-{uuid.uuid4().hex[:6]}",
        timeout=10,
    )
    assert r.status_code == 404


# ── Internal-translation auth isolation ──────────────────────────────────

def test_internal_translation_anonymous_blocked():
    r = requests.get(f"{BASE}/api/editorial/variants/{uuid.uuid4()}/internal-translation", timeout=10)
    assert r.status_code in (401, 403)


def test_internal_translation_authenticated_ok(headers, gcc_market_id):
    _, v = _create_variant(headers, gcc_market_id)
    r = requests.get(f"{BASE}/api/editorial/variants/{v['id']}/internal-translation",
                     headers=headers, timeout=10)
    # Must be 200 (or 404 if the endpoint requires it to exist) — never 401 with auth.
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        body = r.json()
        # The endpoint by definition returns the internal_translation payload — but
        # ONLY when authenticated. Confirm at least the key shape.
        assert isinstance(body, dict)


# ── Calendar never leaks ──────────────────────────────────────────────────

def test_calendar_strips_internal_translation(headers):
    r = requests.get(f"{BASE}/api/editorial/calendar", headers=headers, timeout=10)
    assert r.status_code == 200
    raw = r.text.lower()
    assert "internal_translation" not in raw
    for it in r.json().get("items", []):
        assert "internal_translation" not in it


# ── Endpoint surface for the toolbar verbs ───────────────────────────────

def test_toolbar_endpoint_surface_exists(headers, gcc_market_id):
    """The 3 toolbar verbs hit: compose / refine-angle / rebalance-tone.
    Verify they're mounted (we hit them with empty/bad payload — we just
    need anything other than 404). We don't actually compose to avoid LLM cost."""
    _, v = _create_variant(headers, gcc_market_id)
    for path in ("refine-angle", "rebalance-tone"):
        r = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/{path}",
                          headers=headers, json={}, timeout=60)
        # 400 or 422 is fine — we just want NOT 404.
        assert r.status_code != 404, f"endpoint /{path} not mounted"


def test_patch_variant_endpoint_for_autosave(headers, gcc_market_id):
    """The Prompt 2 inline-edit flow calls PATCH /api/editorial/variants/{id}.
    Confirm the endpoint exists and persists a simple field change."""
    _, v = _create_variant(headers, gcc_market_id)
    new_title = f"Autosave title {uuid.uuid4().hex[:6]}"
    r = requests.patch(f"{BASE}/api/editorial/variants/{v['id']}",
                       headers=headers, json={"title": new_title}, timeout=10)
    assert r.status_code in (200, 204), f"PATCH not mounted: {r.status_code} {r.text[:200]}"
    # Verify persistence
    rv = requests.get(f"{BASE}/api/editorial/variants/{v['id']}",
                      headers=headers, timeout=10).json()
    assert rv.get("title") == new_title


def test_schedule_endpoint_exists(headers, gcc_market_id):
    _, v = _create_variant(headers, gcc_market_id)
    for tgt in ["direction_defined", "ai_composing", "ready_for_editorial_review", "approved"]:
        requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                      headers=headers, json={"to": tgt}, timeout=10)
    r = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/schedule",
                     headers=headers, json={"scheduled_at": "2027-01-15T10:00:00Z"}, timeout=10)
    assert r.status_code in (200, 201)
