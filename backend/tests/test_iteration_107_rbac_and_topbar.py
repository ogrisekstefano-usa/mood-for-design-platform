"""Iter107 supplement — RBAC + Topbar copy + single-journey shortcut.

Covers gaps from the existing static test file:
  · designer role gets 403 on /api/client/journeys
  · client role gets 200 (own-data only)
  · super_admin can fetch any journey companion
  · Topbar copy uses 'Bentornato' + 'Il tuo percorso progettuale ti aspetta'
  · ClientSidebar bottom CTA is 'Scrivi al tuo studio' (replacing support framing)
  · App.js wires single-journey shortcut + remaining redirects
"""
import os
from pathlib import Path
import pytest
import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / "backend" / ".env")
load_dotenv(REPO / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

LAYOUT = REPO / "frontend" / "src" / "components" / "client" / "ClientDashboardLayout.jsx"
SIDEBAR = REPO / "frontend" / "src" / "components" / "client" / "ClientSidebar.jsx"
INDEX_PAGE = REPO / "frontend" / "src" / "pages" / "client" / "ClientJourneysIndexPage.jsx"
APP_JS = REPO / "frontend" / "src" / "App.js"


def _login(email: str, password: str) -> dict:
    r = requests.post(
        f"{API}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


def H(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def super_token():
    return _login("demo@moodfordesign.com", "Blueprint2024!")["session"]["access_token"]


@pytest.fixture(scope="module")
def designer_token():
    return _login("designer@moodfordesign.com", "Designer2024!")["session"]["access_token"]


@pytest.fixture(scope="module")
def client_token():
    return _login("client@moodfordesign.com", "Client2024!")["session"]["access_token"]


# ── RBAC ────────────────────────────────────────────────────────
class TestClientPortalRBAC:
    def test_designer_blocked_from_journeys(self, designer_token):
        r = requests.get(
            f"{API}/api/client/journeys", headers=H(designer_token), timeout=20
        )
        assert r.status_code == 403, (
            f"Designer must be blocked from /api/client/journeys, got {r.status_code}: {r.text}"
        )

    def test_designer_blocked_from_companion(self, designer_token, super_token):
        # need a real journey id from super_admin pulse
        pulse = requests.get(
            f"{API}/api/dashboard/pulse", headers=H(super_token), timeout=20
        ).json()
        if not pulse.get("active_journeys"):
            pytest.skip("no active journeys on demo tenant")
        jid = pulse["active_journeys"][0]["journey_id"]
        r = requests.get(
            f"{API}/api/client/journeys/{jid}/companion",
            headers=H(designer_token),
            timeout=20,
        )
        assert r.status_code == 403, (
            f"Designer must be blocked from companion, got {r.status_code}"
        )

    def test_client_can_call_journeys(self, client_token):
        r = requests.get(
            f"{API}/api/client/journeys", headers=H(client_token), timeout=20
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "zero_data" in data
        assert isinstance(data.get("journeys"), list)
        # Strict ownership — demo client has no seeded journeys.
        if data["zero_data"]:
            assert data["journeys"] == []

    def test_client_cannot_read_other_journey_companion(self, client_token, super_token):
        """A client user must get 404 on a journey they don't own."""
        pulse = requests.get(
            f"{API}/api/dashboard/pulse", headers=H(super_token), timeout=20
        ).json()
        if not pulse.get("active_journeys"):
            pytest.skip("no active journeys")
        jid = pulse["active_journeys"][0]["journey_id"]
        r = requests.get(
            f"{API}/api/client/journeys/{jid}/companion",
            headers=H(client_token),
            timeout=20,
        )
        # Accept 404 (ownership scope hides the resource) — must NOT be 200.
        assert r.status_code in (403, 404), (
            f"Client should not see another client's journey, got {r.status_code}"
        )

    def test_super_admin_can_call_any_companion(self, super_token):
        pulse = requests.get(
            f"{API}/api/dashboard/pulse", headers=H(super_token), timeout=20
        ).json()
        if not pulse.get("active_journeys"):
            pytest.skip("no active journeys")
        jid = pulse["active_journeys"][0]["journey_id"]
        r = requests.get(
            f"{API}/api/client/journeys/{jid}/companion",
            headers=H(super_token),
            timeout=20,
        )
        assert r.status_code == 200, r.text


# ── Topbar editorial copy ───────────────────────────────────────
class TestTopbarJourneyFirstCopy:
    def test_topbar_uses_bentornato_and_percorso(self):
        src = LAYOUT.read_text()
        assert "Bentornato" in src, "Topbar must greet with 'Bentornato'"
        assert "Il tuo percorso progettuale ti aspetta" in src, (
            "Topbar must use Journey-first lede"
        )
        # G.7 must drop the SaaS dashboard framing.
        assert "Benvenuto" not in src, "Old 'Benvenuto' framing still present"
        assert "Ecco lo stato del tuo progetto" not in src, (
            "Old 'stato del tuo progetto' SaaS framing still present"
        )


# ── Sidebar bottom helper card ──────────────────────────────────
class TestSidebarBottomCTA:
    def test_bottom_cta_invites_conversation(self):
        src = SIDEBAR.read_text()
        assert "Vuoi raccontarci qualcosa" in src
        # Editorial CTA — the user directive says SCRIVI AL TUO STUDIO,
        # implementation may render it as 'Scrivi al tuo studio' (CSS uppercases).
        assert ("Scrivi al tuo studio" in src) or ("SCRIVI AL TUO STUDIO" in src), (
            "Bottom CTA must invite writing to the studio"
        )
        assert "Hai bisogno di aiuto" not in src, (
            "Support-style framing must be removed"
        )


# ── Single-journey shortcut + App.js wiring ─────────────────────
class TestSingleJourneyShortcut:
    def test_index_auto_redirects_when_single_journey(self):
        src = INDEX_PAGE.read_text()
        # Must navigate to /client/journey/<id> when exactly 1 journey returned.
        assert ("/client/journey/" in src), "Index must link to /client/journey/<id>"
        # Look for the auto-redirect intent — either a useEffect with navigate,
        # or a length===1 branch into companion route.
        lowered = src.lower()
        assert ("length === 1" in lowered) or ("length===1" in lowered) or (
            "journeys.length === 1" in src
        ), "Single-journey auto-redirect branch is missing"

    def test_app_js_legacy_redirects_complete(self):
        src = APP_JS.read_text()
        # G.7 directive — all legacy SaaS client routes funnel back to /client.
        for pair in (
            ('path="/client/project"', '<Navigate to="/client" replace />'),
            ('path="/client/moodboards"', '<Navigate to="/client" replace />'),
            ('path="/client/approvals"', '<Navigate to="/client" replace />'),
            ('path="/client/files"', '<Navigate to="/client#direzioni" replace />'),
            ('path="/client/timeline"', '<Navigate to="/client#evoluzione" replace />'),
        ):
            assert pair[0] in src and pair[1] in src, (
                f"Missing redirect {pair[0]} → {pair[1]}"
            )


# ── Direction Lock — Topbar must not say 'Welcome'/'Dashboard' ─
class TestDirectionLockTopbar:
    def test_topbar_has_no_saas_dashboard_jargon(self):
        src = LAYOUT.read_text()
        for bad in ("Welcome", "Dashboard overview", "Project status",
                    "approval queue", "Pending tasks", "kanban"):
            assert bad not in src, f"forbidden topbar term: {bad}"
