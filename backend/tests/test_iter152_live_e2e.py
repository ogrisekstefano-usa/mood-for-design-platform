"""ITER152 · Live E2E test against REAL ALE / Claude through preview backend."""
from __future__ import annotations
import time
import pytest
import requests

BASE = "https://content-hub-pro-22.preview.emergentagent.com"
EMAIL = "admin@moodfordesign.com"
PASSWORD = "Blueprint2024!"
STUDIO_PROFILE_ID = "caee7b92-34b4-4ecf-bdaa-8a3eda93a70e"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    return (data.get("access_token") or data.get("token")
            or data["session"]["access_token"])


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get_locale(headers, field, locale):
    r = requests.get(f"{BASE}/api/profile/me/identity", headers=headers, timeout=20)
    assert r.status_code == 200
    for l in r.json()["fields"][field]["locales"]:
        if l["locale"] == locale:
            return l
    return None


def test_01_get_identity_shape(headers):
    r = requests.get(f"{BASE}/api/profile/me/identity", headers=headers, timeout=20)
    assert r.status_code == 200
    data = r.json()
    for field in ("role_label", "short_bio", "response_time_label", "contact_cta_label"):
        locs = {l["locale"] for l in data["fields"][field]["locales"]}
        for need in ("it-it", "en-us", "fr-fr", "de-de", "es-es"):
            assert need in locs


def test_02_cultural_adaptation_real_ale(headers):
    """Source already set to 'Fondatore' - assert REAL ALE cultural adaptation."""
    # Force a regenerate to ensure fresh ALE call
    payload = {"field": "role_label", "value": "Fondatore", "source_locale": "it-IT", "force": True}
    r = requests.patch(f"{BASE}/api/profile/me/identity/source", headers=headers,
                       json=payload, timeout=60)
    assert r.status_code == 200, r.text[:300]
    time.sleep(8)  # allow ALE recompose for any new variants

    rows = {}
    for loc in ("en-us", "fr-fr", "de-de", "es-es"):
        row = _get_locale(headers, "role_label", loc)
        rows[loc] = row["value"] if row else None
    print(f"\nALE cultural results: {rows}")

    # Cultural adaptation: each non-Italian locale must be MULTI-WORD (not literal one-word)
    misses = []
    for loc, val in rows.items():
        if not val:
            misses.append(f"{loc}: empty")
        elif len(val.split()) < 2:
            misses.append(f"{loc}: literal one-word = {val!r}")
    assert not misses, f"Cultural adaptation regression: {misses}"


def test_03_manual_override_persists_across_source_repatch(headers):
    # Set manual
    r = requests.patch(f"{BASE}/api/profile/me/identity/role_label/en-US",
                       headers=headers, json={"value": "Founding Partner"}, timeout=20)
    assert r.status_code == 200, r.text[:300]
    en = _get_locale(headers, "role_label", "en-us")
    assert en["status"] == "manual" and en["value"] == "Founding Partner"

    # Re-PATCH source (no force) — manual must survive
    r = requests.patch(f"{BASE}/api/profile/me/identity/source", headers=headers,
                       json={"field": "role_label", "value": "Fondatore", "source_locale": "it-IT"},
                       timeout=30)
    assert r.status_code == 200
    time.sleep(3)
    en = _get_locale(headers, "role_label", "en-us")
    assert en["status"] == "manual", f"manual was overwritten: {en}"
    assert en["value"] == "Founding Partner"


def test_04_regenerate(headers):
    # Restore first so we're not on locked/manual
    r = requests.post(f"{BASE}/api/profile/me/identity/role_label/en-US/restore-ale",
                      headers=headers, timeout=30)
    assert r.status_code == 200
    time.sleep(3)
    r = requests.post(f"{BASE}/api/profile/me/identity/role_label/en-US/regenerate",
                      headers=headers, timeout=30)
    assert r.status_code == 200, r.text[:300]
    time.sleep(2)
    en = _get_locale(headers, "role_label", "en-us")
    assert en["status"] in ("auto", "stale"), en
    assert en["value"] != "Founding Partner"
    print(f"\nregenerate en-us → {en['value']!r}")


def test_05_lock_blocks_regenerate(headers):
    r = requests.post(f"{BASE}/api/profile/me/identity/role_label/en-US/lock",
                      headers=headers, params={"locked": "true"}, timeout=20)
    assert r.status_code == 200
    en = _get_locale(headers, "role_label", "en-us")
    assert en["status"] == "locked", en

    # Regenerate must 409
    r = requests.post(f"{BASE}/api/profile/me/identity/role_label/en-US/regenerate",
                      headers=headers, timeout=20)
    assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text[:200]}"

    # Unlock
    r = requests.post(f"{BASE}/api/profile/me/identity/role_label/en-US/lock",
                      headers=headers, params={"locked": "false"}, timeout=20)
    assert r.status_code == 200


def test_06_restore_ale(headers):
    requests.patch(f"{BASE}/api/profile/me/identity/role_label/en-US",
                   headers=headers, json={"value": "TEMP MANUAL"}, timeout=20)
    r = requests.post(f"{BASE}/api/profile/me/identity/role_label/en-US/restore-ale",
                      headers=headers, timeout=30)
    assert r.status_code == 200
    time.sleep(3)
    en = _get_locale(headers, "role_label", "en-us")
    assert en["status"] == "auto"
    assert en["value"] != "TEMP MANUAL"


def test_07_resolve_for_locale(headers):
    r = requests.get(f"{BASE}/api/profile/{STUDIO_PROFILE_ID}/identity/resolve",
                     headers=headers, params={"locale": "en-US"}, timeout=20)
    assert r.status_code == 200
    out = r.json()
    # Shape: {"fields": {...}, "locale", "profile_id", "tenant_id"}
    assert "fields" in out and "role_label" in out["fields"]
    role = out["fields"]["role_label"]
    print(f"\nresolve en-US: {role!r}")
    assert role and role != "Fondatore"

    # Missing locale falls back to source (Italian)
    r2 = requests.get(f"{BASE}/api/profile/{STUDIO_PROFILE_ID}/identity/resolve",
                      headers=headers, params={"locale": "zh-CN"}, timeout=20)
    assert r2.status_code == 200
    print(f"\nresolve zh-CN fallback: {r2.json()['fields']}")
