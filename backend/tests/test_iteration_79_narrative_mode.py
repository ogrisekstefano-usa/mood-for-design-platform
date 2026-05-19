"""Iteration 79 — Narrative Mode™ + Editorial Tone Engine backend tests.

Scope:
- BACKEND 1: editorial_voice persists in branding_settings (PUT then GET)
- BACKEND 2: POST cultural-reading no body → narrative_only:false, status queued
- BACKEND 3: POST cultural-reading with body on ready reading → narrative_only:true
- BACKEND 4: provider_meta persisted with narrative_mode / narrative_intensity
- BACKEND 5: editorial_interpretation body / headline have no AI jargon
- BACKEND 6: editorial_voice survives partial PUTs (merge, not shallow overwrite)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"

# Inspiration with cultural_reading=ready (per request context)
READY_INSPIRATION_ID = "ea38cfce-21e0-4819-9303-4e986ac9e29c"

FORBIDDEN_WORDS = [
    "AI", "prompt", "model", "temperature", "algoritmo", "score", "KPI",
    "machine learning",
]


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    body = r.json()
    sess = body.get("session") or {}
    token = (sess.get("access_token") or body.get("access_token")
             or body.get("token") or (body.get("data") or {}).get("token"))
    assert token, f"no token in login body: {body}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ── BACKEND 1 ─ editorial_voice round-trip ────────────────────────────
def test_backend1_editorial_voice_put_and_get(auth_session):
    payload = {
        "branding": {
            "editorial_voice": {
                "communication_personality": "editorial",
                "vocabulary_style": "editorial_magazine",
                "narrative_intensity": "cinematic",
                "interpretation_density": "deep_analysis",
            }
        }
    }
    r = auth_session.put(f"{BASE_URL}/api/branding", json=payload, timeout=20)
    assert r.status_code in (200, 204), f"PUT branding failed: {r.status_code} {r.text[:300]}"

    g = auth_session.get(f"{BASE_URL}/api/branding", timeout=20)
    assert g.status_code == 200, g.text
    data = g.json()
    branding = data.get("branding") or data
    ev = branding.get("editorial_voice")
    assert ev, f"editorial_voice not persisted: {data}"
    assert ev["communication_personality"] == "editorial"
    assert ev["vocabulary_style"] == "editorial_magazine"
    assert ev["narrative_intensity"] == "cinematic"
    assert ev["interpretation_density"] == "deep_analysis"


# ── BACKEND 6 ─ partial PUT must not shallow-overwrite ───────────────
def test_backend6_editorial_voice_survives_partial_put(auth_session):
    # First make sure ev is set
    auth_session.put(f"{BASE_URL}/api/branding", json={
        "branding": {
            "editorial_voice": {
                "communication_personality": "editorial",
                "vocabulary_style": "editorial_magazine",
                "narrative_intensity": "cinematic",
                "interpretation_density": "deep_analysis",
            }
        }
    }, timeout=20)

    # Now do a partial PUT that touches only tagline
    r = auth_session.put(f"{BASE_URL}/api/branding",
                         json={"branding": {"tagline": "TEST_partial_update"}}, timeout=20)
    assert r.status_code in (200, 204), r.text

    g = auth_session.get(f"{BASE_URL}/api/branding", timeout=20).json()
    branding = g.get("branding") or g
    ev = branding.get("editorial_voice")
    assert ev, "editorial_voice was wiped by partial PUT"
    assert ev.get("narrative_intensity") == "cinematic", (
        f"editorial_voice keys lost after partial PUT: {ev}"
    )
    assert ev.get("communication_personality") == "editorial"


# ── BACKEND 2 ─ no-body retry → full pipeline ─────────────────────────
def test_backend2_retry_without_body_full_pipeline(auth_session):
    # Confirm the seed inspiration exists & is ready
    g = auth_session.get(
        f"{BASE_URL}/api/inspirations/archive/{READY_INSPIRATION_ID}/cultural-reading",
        timeout=20)
    if g.status_code == 404:
        pytest.skip("Seed inspiration not present")
    assert g.status_code == 200, g.text

    r = auth_session.post(
        f"{BASE_URL}/api/inspirations/archive/{READY_INSPIRATION_ID}/cultural-reading",
        timeout=20)
    assert r.status_code == 202, f"{r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("status") == "queued"
    assert body.get("narrative_only") is False


# ── BACKEND 3, 4, 5 ─ retry with body → narrative_only:true + persist ──
def test_backend3_4_5_retry_with_body_narrative_only(auth_session):
    # Make sure reading is ready (full pipeline triggered above can take ~25s)
    deadline = time.time() + 60
    while time.time() < deadline:
        g = auth_session.get(
            f"{BASE_URL}/api/inspirations/archive/{READY_INSPIRATION_ID}/cultural-reading",
            timeout=20).json()
        if g.get("status") == "ready":
            break
        time.sleep(3)
    else:
        pytest.skip("seed reading not back to ready in time")

    payload = {"narrative_mode": "cinematic", "narrative_intensity": "editorial"}
    r = auth_session.post(
        f"{BASE_URL}/api/inspirations/archive/{READY_INSPIRATION_ID}/cultural-reading",
        json=payload, timeout=20)
    assert r.status_code == 202, f"{r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("status") == "queued"
    # BACKEND 3
    assert body.get("narrative_only") is True, (
        f"expected narrative_only true on ready reading w/ body, got {body}"
    )

    # Wait for narrative re-balance to complete (~3-8s no vision)
    deadline = time.time() + 45
    cr = None
    while time.time() < deadline:
        cr = auth_session.get(
            f"{BASE_URL}/api/inspirations/archive/{READY_INSPIRATION_ID}/cultural-reading",
            timeout=20).json()
        if cr.get("status") == "ready":
            pm = cr.get("provider_meta") or {}
            if pm.get("narrative_mode") == "cinematic":
                break
        time.sleep(2)
    assert cr and cr.get("status") == "ready", f"reading not ready: {cr}"

    # BACKEND 4
    pm = cr.get("provider_meta") or {}
    assert pm.get("narrative_mode") == "cinematic", f"narrative_mode not persisted: {pm}"
    assert pm.get("narrative_intensity") == "editorial", f"narrative_intensity not persisted: {pm}"

    # BACKEND 5
    ei = cr.get("editorial_interpretation") or {}
    assert ei.get("headline"), f"missing headline: {ei}"
    assert ei.get("body"), f"missing body: {ei}"
    assert ei.get("spatial_reading"), f"missing spatial_reading: {ei}"
    assert ei.get("atmosphere_language"), f"missing atmosphere_language: {ei}"

    # Forbidden jargon check — concatenate all editorial text
    text_blob = " ".join(str(ei.get(k) or "") for k in
                         ("headline", "body", "spatial_reading", "atmosphere_language")).lower()
    leaks = [w for w in FORBIDDEN_WORDS if w.lower() in text_blob]
    # 'model' as substring could appear in 'modello' (Italian) which is OK,
    # so check 'model' only as standalone-ish, similarly 'ai' could appear in 'spazio'
    # We exclude false positives by requiring whole-word boundary.
    import re as _re
    real_leaks = []
    for w in FORBIDDEN_WORDS:
        if _re.search(rf"\b{_re.escape(w.lower())}\b", text_blob):
            real_leaks.append(w)
    assert not real_leaks, f"forbidden jargon present in editorial text: {real_leaks}\n---\n{text_blob}"
