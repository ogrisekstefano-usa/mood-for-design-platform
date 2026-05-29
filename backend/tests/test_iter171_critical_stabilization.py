"""
ITER171 — Critical Platform Stabilization backend tests.
Validates post-cleanup (ITER170) state: 196 dial codes, 7 languages,
16 rooms, 9 chapters, identify enumeration-safety, password login,
and journey initiate (3-step intake).
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Read from frontend/.env as fallback
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Platform catalogs (post-cleanup expected counts) ---

def test_phone_dial_codes_196(session):
    r = session.get(f"{BASE}/api/platform/phone-dial-codes", timeout=15)
    assert r.status_code == 200
    data = r.json()
    codes = data.get("codes", data) if isinstance(data, dict) else data
    assert len(codes) == 196, f"expected 196 dial codes, got {len(codes)}"
    # Italy must be present and default
    countries = {c.get("country_code") or c.get("code") or c.get("iso2"): c for c in codes}
    assert "IT" in countries, "Italy IT missing"


def test_languages_public_7(session):
    r = session.get(f"{BASE}/api/platform/languages?scope=public", timeout=15)
    assert r.status_code == 200
    data = r.json()
    langs = data.get("languages", data) if isinstance(data, dict) else data
    assert len(langs) == 7, f"expected 7 languages, got {len(langs)}"
    codes = {(l.get("code") or l.get("language_code") or "").lower() for l in langs}
    assert "it" in codes, "Italian missing"


def test_journeys_catalog_rooms_16(session):
    r = session.get(f"{BASE}/api/journeys/catalog/rooms", timeout=15)
    assert r.status_code == 200
    data = r.json()
    rooms = data.get("rooms", data) if isinstance(data, dict) else data
    assert len(rooms) == 16


def test_journeys_catalog_chapters_9(session):
    r = session.get(f"{BASE}/api/journeys/catalog/chapters", timeout=15)
    assert r.status_code == 200
    data = r.json()
    chapters = data.get("chapters", data) if isinstance(data, dict) else data
    assert len(chapters) == 9


# --- Auth identify / login (anti-enumeration + password) ---

def test_identify_admin_is_professional(session):
    r = session.post(f"{BASE}/api/auth/identify",
                     json={"email": "admin@moodfordesign.com"}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("kind") == "professional"
    assert body.get("password_exists") is True


def test_identify_unknown_is_client(session):
    email = f"iter171unknown_{int(time.time())}@example.com"
    r = session.post(f"{BASE}/api/auth/identify",
                     json={"email": email}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    # Anti-enumeration: unknown should look like client with no password
    assert body.get("kind") == "client"
    assert body.get("password_exists") is False
    # Must NOT leak role/professional/not_found
    forbidden = {"not_found", "professional", "role", "user", "exists"}
    leak = {k for k in body.keys() if k not in {"kind", "password_exists"}}
    # informational only
    assert leak.issubset({"requires_password"}) or len(leak) == 0


def test_login_admin_success_role_and_root(session):
    r = session.post(f"{BASE}/api/auth/login",
                     json={"email": "admin@moodfordesign.com",
                           "password": "Blueprint2024!"}, timeout=20)
    assert r.status_code == 200, r.text[:500]
    body = r.json()
    assert "session" in body
    assert body["session"].get("access_token")
    user = body.get("user", {})
    assert user.get("role") == "super_admin"
    assert user.get("is_root_superadmin") is True
    assert user.get("email") == "admin@moodfordesign.com"


def test_login_admin_wrong_password_401(session):
    r = session.post(f"{BASE}/api/auth/login",
                     json={"email": "admin@moodfordesign.com",
                           "password": "WrongPassword!"}, timeout=20)
    assert r.status_code in (400, 401, 403)


# --- Journey initiate (3-step intake) ---

def test_journey_initiate_3_step_full(session):
    ts = int(time.time())
    email = f"iter171client_{ts}@example.com"
    payload = {
        "welcome": {
            "first_name": "TestIter171",
            "last_name": "Client",
            "email": email,
            "country_code": "IT",
            "dial_code": "+39",
            "phone": "3331234567",
            "normalized_phone": "+393331234567",
        },
        "atmosphere": {
            "spaces": ["casa"],
            "lifestyle": "da_soli",
            "priorities": "caldi_avvolgenti",
        },
        "ambiance": {
            "guests": "intimo",
            "ambiance": "luce_naturale",
        },
    }
    r = session.post(f"{BASE}/api/public/journeys/initiate",
                     json=payload, timeout=20)
    # endpoint should accept and return 201 (or 200) without 422
    assert r.status_code in (200, 201), f"{r.status_code} {r.text[:500]}"
    body = r.json()
    # Should carry continuity surface
    keys = set(body.keys())
    # At least one of these must exist
    assert keys & {"welcome_url", "magic_link_url", "welcome_token",
                   "journey_id", "id", "lead_id"}, body


# --- Magic-link resend ---

def test_client_resend_silent(session):
    """POST resend with an unknown email should NOT leak existence (200 silent)."""
    email = f"iter171resend_{int(time.time())}@example.com"
    r = session.post(f"{BASE}/api/auth/client/resend",
                     json={"email": email}, timeout=15)
    # Endpoint may return 200 (silent) or 202 — must not return 404
    assert r.status_code in (200, 202, 204), r.text[:300]
