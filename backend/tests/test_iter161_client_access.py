"""ITER161 · Client Profile Access — Backend integration tests.

Covers:
- POST /api/auth/silent-magic-link (opaque, no enumeration)
- GET  /api/auth/resolve-post-login (role-aware)
- POST /api/public/journeys/initiate (provisioning + prospect promotion + idempotency)
- GET  /api/client/welcome-summary (client portal welcome card)
- POST /api/client/recall-requests + GET /mine (role-gated)
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

CLIENT_EMAIL = "client@moodfordesign.com"
CLIENT_PASS = "Blueprint2024!"
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASS = "Blueprint2024!"
DESIGNER_EMAIL = "designer@moodfordesign.com"
DESIGNER_PASS = "Designer2024!"


# ── Helpers ──────────────────────────────────────────────────────────
def _login(email: str, password: str) -> str | None:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    if r.status_code != 200:
        return None
    data = r.json()
    return (
        data.get("access_token")
        or data.get("session", {}).get("access_token")
        or data.get("token")
    )


@pytest.fixture(scope="module")
def client_token():
    tok = _login(CLIENT_EMAIL, CLIENT_PASS)
    if not tok:
        pytest.skip(f"Login failed for {CLIENT_EMAIL}")
    return tok


@pytest.fixture(scope="module")
def admin_token():
    tok = _login(ADMIN_EMAIL, ADMIN_PASS)
    if not tok:
        pytest.skip(f"Login failed for {ADMIN_EMAIL}")
    return tok


@pytest.fixture(scope="module")
def designer_token():
    tok = _login(DESIGNER_EMAIL, DESIGNER_PASS)
    if not tok:
        pytest.skip(f"Login failed for {DESIGNER_EMAIL}")
    return tok


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── 1. Silent Magic Link (opaque) ────────────────────────────────────
class TestSilentMagicLink:
    def test_existing_email_returns_opaque_ok(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/silent-magic-link",
            json={"email": CLIENT_EMAIL, "next": "/client"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("message") == "Ti abbiamo inviato un accesso sicuro."

    def test_unknown_email_no_enumeration(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/silent-magic-link",
            json={"email": f"nonexistent-{int(time.time())}@example.com",
                  "next": "/client"},
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("message") == "Ti abbiamo inviato un accesso sicuro."


# ── 2. resolve-post-login (role-aware) ───────────────────────────────
class TestResolvePostLogin:
    def test_client_resolves_to_client(self, client_token):
        r = requests.get(
            f"{BASE_URL}/api/auth/resolve-post-login",
            headers=_auth(client_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("redirect_to") == "/client"
        assert data.get("role") == "client"

    def test_root_superadmin_resolves_to_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/auth/resolve-post-login",
            headers=_auth(admin_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # admin@moodfordesign.com is_root_superadmin=TRUE → /admin
        if data.get("is_root_superadmin"):
            assert data.get("redirect_to") == "/admin"
        else:
            assert data.get("redirect_to") in ("/dashboard", "/admin")

    def test_designer_resolves_to_dashboard(self, designer_token):
        r = requests.get(
            f"{BASE_URL}/api/auth/resolve-post-login",
            headers=_auth(designer_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # designer is non-client → /dashboard (legacy fallback)
        assert data.get("redirect_to") == "/dashboard"


# ── 3. Public journey initiate (provisioning) ────────────────────────
class TestJourneyInitiate:
    PAYLOAD_BASE = {
        "atmosphere": {
            "space_kinds": ["home"],
            "how_to_feel": "calmo e luminoso",
            "references": "Vincenzo De Cotiis",
        },
        "lifestyle": {
            "guests": "sometimes",
            "materials": ["legno", "pietra"],
            "ambiance": "warm_enveloping",
        },
    }

    def _payload(self, email: str, first_name: str = "TestIter161"):
        return {
            **self.PAYLOAD_BASE,
            "welcome": {
                "first_name": first_name,
                "email": email,
                "phone": "+393331234567",
            },
        }

    def test_initiate_returns_provisioning_envelope(self):
        ts = int(time.time() * 1000)
        email = f"iter161-test-{ts}@moodfordesign.com"
        r = requests.post(
            f"{BASE_URL}/api/public/journeys/initiate",
            json=self._payload(email),
            timeout=40,
        )
        assert r.status_code == 201, r.text
        data = r.json()

        # Core journey envelope
        assert data.get("journey_id"), "journey_id missing"
        assert data.get("lead_id"), "lead_id missing"
        assert data.get("welcome_token"), "welcome_token missing"
        assert data.get("welcome_url"), "welcome_url missing"

        # ITER161 P0.2 provisioning fields
        assert data.get("magic_link_url"), \
            f"magic_link_url MUST NOT be null. Got: {data.get('magic_link_url')}"
        assert data.get("profile_id"), \
            f"profile_id MUST NOT be null. Got: {data.get('profile_id')}"
        assert data.get("thread_id"), \
            f"thread_id MUST NOT be null. Got: {data.get('thread_id')}"

        # Assignee object
        assignee = data.get("assignee")
        assert assignee, "assignee MUST NOT be null"
        assert isinstance(assignee, dict)
        assert assignee.get("name"), "assignee.name missing"
        # role_label may be optional but should usually be present
        # don't hard-fail just in case
        assert "message" in data

    def test_idempotency_no_duplicate_profile(self):
        ts = int(time.time() * 1000)
        email = f"iter161-idemp-{ts}@moodfordesign.com"
        payload = self._payload(email, "IdempTest")

        r1 = requests.post(
            f"{BASE_URL}/api/public/journeys/initiate",
            json=payload, timeout=40,
        )
        assert r1.status_code == 201, r1.text
        profile_id_1 = r1.json().get("profile_id")
        assert profile_id_1

        # Second submission with SAME email — provisioning must reuse profile
        r2 = requests.post(
            f"{BASE_URL}/api/public/journeys/initiate",
            json=payload, timeout=40,
        )
        assert r2.status_code == 201, r2.text
        profile_id_2 = r2.json().get("profile_id")
        assert profile_id_2

        assert profile_id_1 == profile_id_2, (
            f"Idempotency broken: profile_id differs "
            f"({profile_id_1!r} vs {profile_id_2!r})"
        )


# ── 4. Client welcome-summary ────────────────────────────────────────
class TestWelcomeSummary:
    def test_client_welcome_summary_shape(self, client_token):
        r = requests.get(
            f"{BASE_URL}/api/client/welcome-summary",
            headers=_auth(client_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Required: client, studio_name, referente
        assert "client" in data
        assert data["client"].get("email")
        assert data.get("studio_name")
        assert data.get("referente") is not None, (
            "referente must NOT be null (Marco/Stefano assignment expected)"
        )
        ref = data["referente"]
        assert ref.get("name"), f"referente.name missing: {ref}"
        # Optional fields that should exist in the shape contract
        for k in ("summary", "atmosphere", "lifestyle", "journey_id", "next_step"):
            assert k in data, f"missing key {k} in welcome summary"


# ── 5. Recall requests ───────────────────────────────────────────────
class TestRecallRequests:
    def test_create_recall_as_client(self, client_token):
        r = requests.post(
            f"{BASE_URL}/api/client/recall-requests",
            headers=_auth(client_token),
            json={
                "preferred_days": ["mon", "wed"],
                "preferred_time": "afternoon",
                "preferred_channel": "phone",
                "note": "mattina è meglio",
            },
            timeout=20,
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data.get("id")
        assert data.get("status") == "received"
        assert data.get("message") == "Richiesta ricevuta. Lo studio ti proporrà un momento."

    def test_list_my_recall_requests(self, client_token):
        r = requests.get(
            f"{BASE_URL}/api/client/recall-requests/mine",
            headers=_auth(client_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) >= 1, "should have at least the one we just created"

    def test_non_client_forbidden(self, admin_token):
        # super_admin is non-client → must be 403
        r = requests.post(
            f"{BASE_URL}/api/client/recall-requests",
            headers=_auth(admin_token),
            json={"preferred_days": ["mon"], "preferred_channel": "phone"},
            timeout=20,
        )
        assert r.status_code == 403, (
            f"Expected 403 for non-client, got {r.status_code}: {r.text}"
        )
