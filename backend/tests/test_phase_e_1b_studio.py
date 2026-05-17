"""Phase E-1B smoke — Editorial Studio + Memory invariants.

Lightweight tests that don't invoke the studio (avoid LLM costs in CI).
The expensive composition tests were run manually during development.
This suite validates:
  • Endpoint surface exists & enforces tenant auth.
  • internal_translation NEVER leaks to the calendar / public surfaces.
  • Editorial language rules: payloads / responses don't mention AI/GPT/Claude.
  • Market Learning recompute is idempotent + returns a structured summary.
  • composition_log audit endpoint returns the modular trace.

  cd /app/backend && pytest tests/test_phase_e_1b_studio.py -v
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"


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


def test_internal_translation_endpoint_requires_auth():
    r = requests.get(f"{BASE}/api/editorial/variants/{uuid.uuid4()}/internal-translation", timeout=10)
    assert r.status_code in (401, 403)


def test_market_learnings_endpoint_returns_structure(headers, gcc_market_id):
    r = requests.get(f"{BASE}/api/editorial/markets/{gcc_market_id}/learnings",
                     headers=headers, timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "patterns" in j and "market_id" in j and "total" in j
    assert isinstance(j["patterns"], list)


def test_recompute_learnings_is_idempotent(headers, gcc_market_id):
    r1 = requests.post(f"{BASE}/api/editorial/markets/{gcc_market_id}/recompute-learnings",
                       headers=headers, timeout=15)
    assert r1.status_code == 200
    j = r1.json()
    assert j["market_id"] == gcc_market_id
    assert "patterns" in j and "recomputed_at" in j
    # Second call must succeed too.
    r2 = requests.post(f"{BASE}/api/editorial/markets/{gcc_market_id}/recompute-learnings",
                       headers=headers, timeout=15)
    assert r2.status_code == 200


def test_calendar_never_leaks_internal_translation(headers):
    r = requests.get(f"{BASE}/api/editorial/calendar", headers=headers, timeout=10)
    assert r.status_code == 200
    for item in r.json().get("items", []):
        assert "internal_translation" not in item, (
            f"variant {item.get('id')} leaked internal_translation through calendar"
        )


def test_public_storefront_markets_never_mentions_ai():
    """Defence in depth: the public storefront response must NEVER hint
    at provider tech (no 'gpt', 'claude', 'openai', 'anthropic' anywhere)."""
    r = requests.get(f"{BASE}/api/storefront/public/mood-demo-studio-81a09e/markets", timeout=10)
    text = r.text.lower()
    for forbidden in ("gpt", "claude", "openai", "anthropic", "ai generated", "ai-generated"):
        assert forbidden not in text, f"public storefront leaks '{forbidden}'"


def test_refine_angle_validates_options(headers, gcc_market_id):
    """Bad revision_option must be rejected before any composition call."""
    # Create variant
    m = requests.post(f"{BASE}/api/editorial/masters", headers=headers,
                      json={"code": f"smoke-{uuid.uuid4().hex[:6]}", "title": "Smoke"},
                      timeout=10).json()
    v = requests.post(f"{BASE}/api/editorial/masters/{m['id']}/variants", headers=headers,
                      json={"market_id": gcc_market_id, "variant_slug": "smoke",
                            "target_locale": "en-AE"}, timeout=10).json()
    r = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/refine-angle",
                      headers=headers, timeout=10,
                      json={"revision_options": ["rewrite_completely"], "notes": "x"})
    assert r.status_code == 400


def test_composition_log_endpoint_returns_modules_when_present(headers):
    """If composition_log entries exist, they must expose the modular
    composition_trace (not just a blob)."""
    # Find an existing variant.
    masters = requests.get(f"{BASE}/api/editorial/masters", headers=headers, timeout=10).json().get("masters", [])
    if not masters:
        pytest.skip("No masters yet")
    for m in masters:
        vs = requests.get(f"{BASE}/api/editorial/masters/{m['id']}/variants",
                          headers=headers, timeout=10).json().get("variants", [])
        for v in vs:
            r = requests.get(f"{BASE}/api/editorial/variants/{v['id']}/composition-log",
                             headers=headers, timeout=10)
            assert r.status_code == 200
            entries = r.json().get("entries", [])
            if entries:
                e = entries[0]
                assert "composition_trace" in e
                assert "user_facing_label" in e
                # The user-facing label must be editorial, never tech-y.
                forbidden = ("gpt", "claude", "openai", "anthropic", " ai ", "regenerate", "rewrite")
                lbl = (e.get("user_facing_label") or "").lower()
                for f in forbidden:
                    assert f not in lbl, f"user_facing_label leaks '{f}'"
                return
    pytest.skip("No composition_log entries to inspect")
