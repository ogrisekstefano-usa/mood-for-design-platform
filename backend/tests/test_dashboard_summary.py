"""Phase N+ — Dashboard summary aggregator tests.

Covers:
- shape of /api/dashboard/summary response (KPIs, featured_projects, tasks,
  recent_activity, media_preview, top_materials, team_activity, timeline)
- trend cap (±99)
- tenant isolation (studio2 vs studio Demo)
- RBAC (client role -> 403)
"""
import os
import pytest
import requests

# Load frontend .env if not in os.environ
if not os.environ.get("REACT_APP_BACKEND_URL"):
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    os.environ["REACT_APP_BACKEND_URL"] = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "demo@moodfordesign.com", "password": "Blueprint2024!"}
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}
CLIENT = {"email": "client@moodfordesign.com", "password": "Client2024!"}
STUDIO2 = {"email": "studio2@moodfordesign.com", "password": "Studio2024!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {creds['email']}: {r.status_code} {r.text[:120]}")
    body = r.json()
    tok = (body.get("session") or {}).get("access_token") or body.get("access_token") or body.get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ── fixtures ────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def super_client():
    return _login(SUPER)


@pytest.fixture(scope="module")
def studio2_client():
    return _login(STUDIO2)


@pytest.fixture(scope="module")
def client_role_session():
    return _login(CLIENT)


# ── Tests ───────────────────────────────────────────────────────────────
class TestDashboardSummary:
    """Shape + invariants of /api/dashboard/summary"""

    def test_returns_200(self, super_client):
        r = super_client.get(f"{API}/dashboard/summary", timeout=20)
        assert r.status_code == 200, r.text
        assert "application/json" in r.headers.get("content-type", "")

    def test_top_level_keys(self, super_client):
        r = super_client.get(f"{API}/dashboard/summary", timeout=20)
        body = r.json()
        expected = {"kpis", "featured_projects", "tasks", "recent_activity",
                    "media_preview", "top_materials", "team_activity",
                    "timeline", "generated_at"}
        assert expected.issubset(set(body.keys())), f"missing: {expected - set(body.keys())}"

    def test_kpis_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        kpis = body["kpis"]
        assert isinstance(kpis, list) and len(kpis) == 4
        ids = [k["id"] for k in kpis]
        assert ids == ["active_projects", "pending_proposals",
                       "completed_tasks", "hours_logged"]
        for k in kpis:
            assert isinstance(k["value"], int)
            assert isinstance(k["sparkline"], list) and len(k["sparkline"]) == 14
            assert isinstance(k["trend"], int)
            assert -99 <= k["trend"] <= 99, f"trend out of cap: {k['trend']}"
            assert k.get("labelKey", "").startswith("dashboard.kpi.")

    def test_featured_projects_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        fp = body["featured_projects"]
        assert isinstance(fp, list)
        assert len(fp) <= 4
        for p in fp:
            assert "id" in p and "title" in p
            assert "progress" in p and isinstance(p["progress"], int)
            assert 0 <= p["progress"] <= 100
            assert "project_type" in p
            assert "cover_url" in p  # may be None, must exist

    def test_tasks_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        tasks = body["tasks"]
        assert isinstance(tasks, list)
        assert len(tasks) <= 5
        # project_title hydration when project_id present
        for t in tasks:
            assert "id" in t and "title" in t
            if t.get("project_id"):
                assert "project_title" in t

    def test_recent_activity_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        ev = body["recent_activity"]
        assert isinstance(ev, list)
        assert len(ev) <= 8
        for e in ev:
            assert "kind" in e and "type" in e and "title" in e

    def test_media_preview_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        media = body["media_preview"]
        assert isinstance(media, list)
        assert len(media) <= 6
        # at least display_url generated when bucket+path present
        for m in media:
            if m.get("bucket") and m.get("storage_path"):
                assert "display_url" in m

    def test_top_materials_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        mats = body["top_materials"]
        assert isinstance(mats, list)
        assert len(mats) <= 5
        # sorted desc by project_count
        counts = [m["project_count"] for m in mats]
        assert counts == sorted(counts, reverse=True)

    def test_team_activity_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        team = body["team_activity"]
        assert isinstance(team, list)
        assert len(team) <= 5
        for m in team:
            assert "id" in m and "name" in m and "role" in m

    def test_timeline_shape(self, super_client):
        body = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        tl = body["timeline"]
        assert isinstance(tl, list)
        assert len(tl) <= 8
        for it in tl:
            assert "date" in it and "label" in it and "kind" in it


class TestRBAC:
    """Permission gate verification"""

    def test_client_role_blocked(self, client_role_session):
        r = client_role_session.get(f"{API}/dashboard/summary", timeout=15)
        # P_PROJECTS_READ gate -> 403
        assert r.status_code == 403, f"expected 403 for client, got {r.status_code}: {r.text[:120]}"

    def test_designer_allowed(self):
        s = _login(DESIGNER)
        r = s.get(f"{API}/dashboard/summary", timeout=20)
        assert r.status_code == 200


class TestTenantIsolation:
    """Verify studio2 sees only its own data"""

    def test_studio2_has_different_payload(self, super_client, studio2_client):
        a = super_client.get(f"{API}/dashboard/summary", timeout=20).json()
        b = studio2_client.get(f"{API}/dashboard/summary", timeout=20).json()
        # featured projects (if any) must not overlap by id
        a_ids = {p["id"] for p in a["featured_projects"]}
        b_ids = {p["id"] for p in b["featured_projects"]}
        assert not (a_ids & b_ids), f"tenant leak: {a_ids & b_ids}"
        # tasks must not overlap
        at_ids = {t["id"] for t in a["tasks"]}
        bt_ids = {t["id"] for t in b["tasks"]}
        assert not (at_ids & bt_ids)
        # team members must not overlap (different tenant -> different users)
        am = {m["id"] for m in a["team_activity"]}
        bm = {m["id"] for m in b["team_activity"]}
        assert not (am & bm), f"team leak: {am & bm}"

    def test_studio2_returns_200_even_when_sparse(self, studio2_client):
        r = studio2_client.get(f"{API}/dashboard/summary", timeout=20)
        assert r.status_code == 200
        body = r.json()
        # Must still have all keys + 4 KPIs even if values are 0
        assert len(body["kpis"]) == 4
