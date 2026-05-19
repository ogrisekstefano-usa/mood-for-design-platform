"""Iteration 78 — Cultural Intelligence Engine™ backend regression.

Validates the hybrid 3-layer pipeline (Vision → Mapping → Editorial) end-to-end
through the /api/inspirations/archive/* endpoints with a real demo login.
"""
from __future__ import annotations

import os
import re
import time
from typing import Any, Dict

import pytest
import requests

def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

BASE_URL = _load_frontend_env()
assert BASE_URL, "REACT_APP_BACKEND_URL not found"
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"

# Pre-existing inspirations confirmed live in tenant by main agent context.
MED_VILLA_ID = "d703a487-4a58-409c-b36e-83ef784878a6"
NYC_PENTHOUSE_ID = "ea38cfce-21e0-4819-9303-4e986ac9e29c"

# Jargon that MUST NOT appear in editorial text (italian-only, no SaaS lingo)
FORBIDDEN_JARGON = ["AI", "score", "prediction", "machine learning", "%", "percentage"]


@pytest.fixture(scope="module")
def auth_headers() -> Dict[str, str]:
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    token = (body.get("session") or {}).get("access_token") or body.get("access_token")
    assert token, f"no access token in login response: {body}"
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get_cr(headers, media_id: str) -> Dict[str, Any]:
    r = requests.get(f"{BASE_URL}/api/inspirations/archive/{media_id}/cultural-reading",
                     headers=headers, timeout=15)
    assert r.status_code == 200, f"GET cr {media_id} -> {r.status_code} {r.text[:200]}"
    return r.json()


# ─── 1. GET cultural-reading on existing item returns at least a status ───
def test_get_cultural_reading_returns_status(auth_headers):
    cr = _get_cr(auth_headers, MED_VILLA_ID)
    assert isinstance(cr, dict)
    assert "status" in cr, f"missing status in: {list(cr.keys())}"
    assert cr["status"] in {"ready", "pending", "in_progress", "failed", "absent"}


# ─── 2. Mediterranean villa: full layered output present ───
def test_mediterranean_villa_full_layers(auth_headers):
    cr = _get_cr(auth_headers, MED_VILLA_ID)
    if cr.get("status") != "ready":
        pytest.skip(f"Mediterranean villa not ready (status={cr.get('status')})")

    # Layer 1
    sig = cr.get("raw_vision_signals")
    assert isinstance(sig, dict) and sig, "raw_vision_signals missing/empty"
    numeric_fields = ["indoor_outdoor_continuity", "urban_density", "hospitality_orientation"]
    found_numeric = [f for f in numeric_fields if isinstance(sig.get(f), (int, float))]
    assert found_numeric, f"no numeric vision fields found, got keys={list(sig.keys())}"
    # climate_cues / room_typology / summary expected
    assert "climate_cues" in sig or "climate" in sig, "climate cues missing"
    assert "room_typology" in sig or "typology" in sig, "room typology missing"
    assert isinstance(sig.get("summary"), str) and sig["summary"], "summary missing"

    # Layer 2
    mapped = cr.get("mapped_cultural_descriptors")
    assert isinstance(mapped, dict) and mapped, "mapped_cultural_descriptors missing"
    assert "activated" in mapped or "by_category" in mapped

    # Layer 3 editorial
    ed = cr.get("editorial_interpretation")
    assert isinstance(ed, dict) and ed, "editorial_interpretation missing"
    for k in ("headline", "body", "spatial_reading", "atmosphere_language"):
        assert ed.get(k), f"editorial.{k} missing"


# ─── 3. Market resonance has 7 markets, sorted desc, Med-favorable ranking ───
def test_market_resonance_seven_markets_sorted(auth_headers):
    cr = _get_cr(auth_headers, MED_VILLA_ID)
    if cr.get("status") != "ready":
        pytest.skip("not ready")
    mr = cr.get("market_resonance")
    assert isinstance(mr, list) and len(mr) == 7, f"expected 7 markets got {len(mr) if isinstance(mr, list) else mr}"
    # sorted desc by percentage
    pcts = [m.get("percentage") for m in mr]
    assert pcts == sorted(pcts, reverse=True), f"market resonance not sorted desc: {pcts}"

    # expected city set
    cities = {m.get("city") for m in mr}
    expected = {"Miami", "Los Angeles", "New York", "Dubai", "London", "Milano", "Paris"}
    # Allow SoCal variant
    socal_present = any("socal" in (m.get("market_code") or "").lower()
                        or (m.get("city") or "").lower() in {"los angeles", "socal"} for m in mr)
    assert socal_present, f"SoCal/LA not present: {cities}"

    # Mediterranean villa: Miami/SoCal > NYC and Dubai
    by_code = {m["market_code"]: m["percentage"] for m in mr}
    miami = next((m["percentage"] for m in mr if "miami" in m["market_code"].lower()), None)
    socal = next((m["percentage"] for m in mr if "socal" in m["market_code"].lower()
                  or "la" in m["market_code"].lower().split("_")), None)
    nyc = next((m["percentage"] for m in mr if "nyc" in m["market_code"].lower()), None)
    dubai = next((m["percentage"] for m in mr if "dubai" in m["market_code"].lower()), None)
    assert miami is not None and nyc is not None, f"miami/nyc missing in {by_code}"
    assert miami > nyc, f"Mediterranean villa Miami({miami}) should beat NYC({nyc})"
    if dubai is not None:
        assert miami >= dubai - 5, f"miami({miami}) should be near/above dubai({dubai})"


# ─── 4. Editorial interpretation: italian, no jargon, body ≤ 600 chars ───
def test_editorial_no_jargon_italian(auth_headers):
    cr = _get_cr(auth_headers, MED_VILLA_ID)
    if cr.get("status") != "ready":
        pytest.skip("not ready")
    ed = cr.get("editorial_interpretation") or {}
    body = ed.get("body") or ""
    assert len(body) <= 600, f"body too long ({len(body)} chars)"

    full = " ".join(str(ed.get(k) or "") for k in
                    ("headline", "body", "spatial_reading", "atmosphere_language"))
    full_lower = full.lower()
    # Forbidden full-word jargon
    for token in ["score", "prediction", "machine learning", "percentage", "%"]:
        assert token.lower() not in full_lower, f"forbidden jargon '{token}' found in editorial: {full[:300]}"
    # "AI" must not appear as standalone token (case-sensitive boundary check)
    assert not re.search(r"\bAI\b", full), f"'AI' token found in editorial: {full[:300]}"


# ─── 5. provider_meta populated ───
def test_provider_meta(auth_headers):
    cr = _get_cr(auth_headers, MED_VILLA_ID)
    if cr.get("status") != "ready":
        pytest.skip("not ready")
    pm = cr.get("provider_meta") or {}
    assert pm, "provider_meta empty"
    assert pm.get("vision_provider"), f"vision_provider missing: {pm}"
    # Editorial provider should be present when ready
    assert pm.get("editorial_provider"), f"editorial_provider missing: {pm}"


# ─── 6. POST /cultural-reading returns 202 queued and re-runs pipeline ───
def test_post_cultural_reading_queues(auth_headers):
    r = requests.post(f"{BASE_URL}/api/inspirations/archive/{MED_VILLA_ID}/cultural-reading",
                      headers=auth_headers, timeout=15)
    assert r.status_code == 202, f"expected 202 got {r.status_code} {r.text[:200]}"
    body = r.json()
    assert body.get("status") == "queued"
    assert body.get("media_id") == MED_VILLA_ID


# ─── 7. NYC penthouse (actually tropical img) — engine reads culture not labels ───
def test_nyc_penthouse_reads_culture(auth_headers):
    cr = _get_cr(auth_headers, NYC_PENTHOUSE_ID)
    if cr.get("status") != "ready":
        pytest.skip(f"NYC penthouse not ready (status={cr.get('status')})")
    mr = cr.get("market_resonance") or []
    assert mr, "no market_resonance"
    top = mr[0]
    # Per agent context, top should be Miami for the actually-tropical image
    assert "miami" in (top.get("market_code") or "").lower() \
        or "socal" in (top.get("market_code") or "").lower(), \
        f"expected Miami/SoCal at top for tropical-content NYC pent, got {top}"


# ─── 8. POST /archive/import auto-schedules cultural reading ───
def test_import_auto_schedules_reading(auth_headers):
    # Use a real, stable interior-design JPEG (Unsplash).
    payload = {
        "url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1280&q=80",
        "title": "TEST_iter78_auto_cultural",
        "source_kind": "url",
        "atmosphere_tags": ["warm_minimal"],
        "material_tags": ["wood_natural"],
    }
    r = requests.post(f"{BASE_URL}/api/inspirations/archive/import",
                      headers=auth_headers, json=payload, timeout=30)
    assert r.status_code == 201, f"import failed: {r.status_code} {r.text[:200]}"
    new_id = r.json().get("id")
    assert new_id

    # Poll for status transition pending → ready (max 40s)
    final = None
    for _ in range(8):
        time.sleep(5)
        cr = _get_cr(auth_headers, new_id)
        final = cr
        if cr.get("status") in {"ready", "failed"}:
            break

    assert final is not None and final.get("status") != "absent", \
        f"cultural reading never scheduled: {final}"
    assert final.get("status") in {"ready", "pending", "in_progress", "failed"}, \
        f"unexpected status: {final.get('status')}"
    # We expect 'ready' or at least 'pending' (still in progress) after 40s
    if final.get("status") == "failed":
        pytest.fail(f"pipeline reported failed: {final.get('provider_meta')}")

    # Cleanup: unflag
    requests.delete(f"{BASE_URL}/api/inspirations/archive/{new_id}",
                    headers=auth_headers, timeout=10)
