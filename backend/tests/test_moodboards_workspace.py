"""Phase E — Moodboards V1 (blocks/approval/share) + Workspace (tasks/notes/activity/convert_lead)
End-to-end backend tests via real REACT_APP_BACKEND_URL.

Covers:
  - Auth login (Supabase password grant via /api/auth/login)
  - /api/moodboards CRUD (list/create/get/update/delete)
  - /api/moodboards/{id}/blocks CRUD (image/text/palette/note/product/material)
  - /api/moodboards/{id}/blocks/batch (autosave)
  - /api/moodboards/{id}/approval workflow (draft → sent → approved + invalid 400)
  - /api/moodboards/{id}/share + GET /api/moodboards/public/share/{token}
  - /api/workspace/projects/{id}/tasks GET/POST/PUT/DELETE
  - /api/workspace/projects/{id}/notes GET/POST/PUT/DELETE (pinned)
  - /api/workspace/projects/{id}/activity auto-populated
  - /api/workspace/leads/{lead_id}/convert
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    tok = r.json()["session"]["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def project_id(session):
    """Pick any existing project from the tenant (created via prior convert)."""
    r = session.get(f"{BASE_URL}/api/projects", timeout=30)
    assert r.status_code == 200, r.text
    items = r.json().get("data") or r.json().get("items") or []
    if not items and isinstance(r.json(), list):
        items = r.json()
    assert items, "no projects available — Marco Bianchi convert flow expected to have created one"
    return items[0]["id"]


@pytest.fixture
def moodboard(session, project_id):
    r = session.post(f"{BASE_URL}/api/moodboards",
                     json={"title": f"TEST_MB_{uuid.uuid4().hex[:6]}", "project_id": project_id}, timeout=30)
    assert r.status_code in (200, 201), r.text
    mb = r.json()
    yield mb
    try:
        session.delete(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=30)
    except Exception:
        pass


# ─── Moodboard CRUD ──────────────────────────────────────────────────────────
class TestMoodboardCRUD:
    def test_list(self, session):
        r = session.get(f"{BASE_URL}/api/moodboards", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "data" in body
        assert isinstance(body["data"], list)

    def test_create_standalone(self, session):
        r = session.post(f"{BASE_URL}/api/moodboards",
                         json={"title": f"TEST_Standalone_{uuid.uuid4().hex[:6]}"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        mb = r.json()
        assert mb["title"].startswith("TEST_Standalone_")
        assert mb["status"] == "draft"
        # GET verifies persistence
        g = session.get(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=30)
        assert g.status_code == 200
        assert g.json()["id"] == mb["id"]
        assert "elements" in g.json()
        session.delete(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=30)

    def test_create_with_project(self, session, project_id):
        r = session.post(f"{BASE_URL}/api/moodboards",
                         json={"title": f"TEST_WithProj_{uuid.uuid4().hex[:6]}",
                               "project_id": project_id}, timeout=30)
        assert r.status_code in (200, 201)
        mb = r.json()
        assert mb["project_id"] == project_id
        session.delete(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=30)

    def test_update(self, session, moodboard):
        new_title = f"TEST_Updated_{uuid.uuid4().hex[:6]}"
        r = session.put(f"{BASE_URL}/api/moodboards/{moodboard['id']}",
                        json={"title": new_title}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["title"] == new_title
        g = session.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=30)
        assert g.json()["title"] == new_title

    def test_delete(self, session):
        r = session.post(f"{BASE_URL}/api/moodboards",
                         json={"title": f"TEST_ToDelete_{uuid.uuid4().hex[:6]}"}, timeout=30)
        mid = r.json()["id"]
        d = session.delete(f"{BASE_URL}/api/moodboards/{mid}", timeout=30)
        assert d.status_code == 200
        g = session.get(f"{BASE_URL}/api/moodboards/{mid}", timeout=30)
        assert g.status_code == 404


# ─── Block CRUD ──────────────────────────────────────────────────────────────
BLOCK_TYPES_CONTENTS = [
    ("image",    {"src": "https://placehold.co/600x400", "alt": "demo"}),
    ("text",     {"text": "Hello world", "fontSize": 18}),
    ("palette",  {"colors": ["#0a0a0a", "#ffffff", "#a07a3c"]}),
    ("note",     {"text": "Cliente preferisce toni caldi"}),
    ("product",  {"name": "Lampada Flos IC", "price": 690}),
    ("material", {"name": "Travertino Romano", "finish": "honed"}),
]


class TestBlocks:
    @pytest.mark.parametrize("btype,content", BLOCK_TYPES_CONTENTS)
    def test_create_block_each_type(self, session, moodboard, btype, content):
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
                         json={"type": btype, "x": 50, "y": 60, "width": 300, "height": 200, "content": content},
                         timeout=30)
        assert r.status_code in (200, 201), r.text
        b = r.json()
        assert b["type"] == btype
        # Layout flattened back to root
        assert b["x"] == 50 and b["y"] == 60
        assert b["width"] == 300 and b["height"] == 200

    def test_update_block_position(self, session, moodboard):
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
                         json={"type": "text", "content": {"text": "drag me"}}, timeout=30)
        bid = r.json()["id"]
        u = session.put(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/{bid}",
                        json={"x": 150, "y": 200, "width": 400}, timeout=30)
        assert u.status_code == 200, u.text
        ub = u.json()
        assert ub["x"] == 150 and ub["y"] == 200 and ub["width"] == 400

    def test_batch_autosave(self, session, moodboard):
        ids = []
        for i in range(3):
            r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
                             json={"type": "note", "content": {"text": f"n{i}"}}, timeout=30)
            ids.append(r.json()["id"])
        payload = {"blocks": [{"id": bid, "x": 100 + i * 10, "y": 200 + i * 10}
                              for i, bid in enumerate(ids)]}
        r = session.patch(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/batch",
                          json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("updated") == 3
        # Verify via GET
        g = session.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=30)
        by_id = {e["id"]: e for e in g.json().get("elements", [])}
        for i, bid in enumerate(ids):
            assert by_id[bid]["x"] == 100 + i * 10

    def test_delete_block(self, session, moodboard):
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
                         json={"type": "text", "content": {"text": "doomed"}}, timeout=30)
        bid = r.json()["id"]
        d = session.delete(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/{bid}", timeout=30)
        assert d.status_code == 200
        g = session.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=30)
        assert bid not in [e["id"] for e in g.json().get("elements", [])]

    def test_unsupported_type_400(self, session, moodboard):
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
                         json={"type": "nonexistent", "content": {}}, timeout=30)
        assert r.status_code == 400


# ─── Approval workflow ───────────────────────────────────────────────────────
class TestApproval:
    def test_draft_to_sent_to_approved(self, session, moodboard):
        # draft → sent
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/approval",
                         json={"status": "sent"}, timeout=30)
        assert r.status_code == 200, r.text
        # sent → approved
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/approval",
                         json={"status": "approved", "note": "ok"}, timeout=30)
        assert r.status_code == 200, r.text
        g = session.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=30)
        assert g.json()["status"] == "approved"

    def test_invalid_transition_400(self, session, moodboard):
        # draft → approved directly is invalid
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/approval",
                         json={"status": "approved"}, timeout=30)
        assert r.status_code == 400

    def test_revision_requested(self, session, moodboard):
        session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/approval",
                     json={"status": "sent"}, timeout=30)
        r = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/approval",
                         json={"status": "revision_requested", "note": "spostare blocchi"}, timeout=30)
        assert r.status_code == 200
        g = session.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=30)
        assert g.json()["status"] == "revision_requested"


# ─── Share token (public, no auth) ───────────────────────────────────────────
class TestShare:
    def test_share_blocked_on_draft(self, session, moodboard):
        s = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/share", timeout=30)
        assert s.status_code == 200
        token = s.json()["share_token"]
        # public fetch on draft must be 403
        anon = requests.Session()
        r = anon.get(f"{BASE_URL}/api/moodboards/public/share/{token}", timeout=30)
        assert r.status_code == 403, f"expected 403 on draft, got {r.status_code}: {r.text}"

    def test_share_visible_after_sent(self, session, moodboard):
        # add a block first so the share has content
        session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
                     json={"type": "palette", "content": {"colors": ["#fff", "#000"]}}, timeout=30)
        # send to review (status=sent)
        session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/approval",
                     json={"status": "sent"}, timeout=30)
        # create share
        s = session.post(f"{BASE_URL}/api/moodboards/{moodboard['id']}/share", timeout=30)
        token = s.json()["share_token"]
        anon = requests.Session()
        r = anon.get(f"{BASE_URL}/api/moodboards/public/share/{token}", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["id"] == moodboard["id"]
        assert "tenant_id" not in body
        assert isinstance(body.get("elements"), list)
        assert len(body["elements"]) >= 1

    def test_share_invalid_token_404(self):
        anon = requests.Session()
        r = anon.get(f"{BASE_URL}/api/moodboards/public/share/{uuid.uuid4().hex}", timeout=30)
        assert r.status_code == 404


# ─── Workspace: Tasks ────────────────────────────────────────────────────────
class TestWorkspaceTasks:
    def test_task_crud(self, session, project_id):
        # CREATE
        r = session.post(f"{BASE_URL}/api/workspace/projects/{project_id}/tasks",
                         json={"title": "TEST_Task", "priority": "high"}, timeout=30)
        assert r.status_code == 201, r.text
        task = r.json()
        tid = task["id"]
        assert task["status"] == "todo"
        # LIST
        lst = session.get(f"{BASE_URL}/api/workspace/projects/{project_id}/tasks", timeout=30)
        assert lst.status_code == 200
        assert tid in [t["id"] for t in lst.json()["data"]]
        # UPDATE → done sets completed_at
        u = session.put(f"{BASE_URL}/api/workspace/projects/{project_id}/tasks/{tid}",
                        json={"status": "done"}, timeout=30)
        assert u.status_code == 200
        assert u.json()["status"] == "done"
        assert u.json().get("completed_at")
        # DELETE
        d = session.delete(f"{BASE_URL}/api/workspace/projects/{project_id}/tasks/{tid}", timeout=30)
        assert d.status_code == 200
        lst2 = session.get(f"{BASE_URL}/api/workspace/projects/{project_id}/tasks", timeout=30)
        assert tid not in [t["id"] for t in lst2.json()["data"]]


# ─── Workspace: Notes ────────────────────────────────────────────────────────
class TestWorkspaceNotes:
    def test_note_crud_and_pin(self, session, project_id):
        r = session.post(f"{BASE_URL}/api/workspace/projects/{project_id}/notes",
                         json={"body": "TEST_Note seed", "pinned": False}, timeout=30)
        assert r.status_code == 201, r.text
        nid = r.json()["id"]
        # PIN
        u = session.put(f"{BASE_URL}/api/workspace/projects/{project_id}/notes/{nid}",
                        json={"pinned": True, "body": "TEST_Note pinned"}, timeout=30)
        assert u.status_code == 200
        assert u.json()["pinned"] is True
        # LIST — pinned first
        lst = session.get(f"{BASE_URL}/api/workspace/projects/{project_id}/notes", timeout=30)
        data = lst.json()["data"]
        assert data, "notes list empty"
        assert data[0]["pinned"] is True
        # DELETE
        d = session.delete(f"{BASE_URL}/api/workspace/projects/{project_id}/notes/{nid}", timeout=30)
        assert d.status_code == 200


# ─── Workspace: Activity auto-populated ──────────────────────────────────────
class TestWorkspaceActivity:
    def test_activity_records_task_creation(self, session, project_id):
        r = session.post(f"{BASE_URL}/api/workspace/projects/{project_id}/tasks",
                         json={"title": "TEST_ActivityProbe"}, timeout=30)
        tid = r.json()["id"]
        act = session.get(f"{BASE_URL}/api/workspace/projects/{project_id}/activity", timeout=30)
        assert act.status_code == 200
        types = [e.get("type") for e in act.json()["data"]]
        assert "task.created" in types
        session.delete(f"{BASE_URL}/api/workspace/projects/{project_id}/tasks/{tid}", timeout=30)


# ─── Workspace: Lead → Project converter ─────────────────────────────────────
class TestLeadConvert:
    def test_convert_lead_to_project(self, session):
        # seed lead
        lead_payload = {
            "first_name": "TEST_Convert",
            "last_name":  uuid.uuid4().hex[:6],
            "email":      f"test_{uuid.uuid4().hex[:6]}@example.com",
            "status":     "new",
            "source":     "manual",
        }
        c = session.post(f"{BASE_URL}/api/leads", json=lead_payload, timeout=30)
        assert c.status_code in (200, 201), c.text
        lead = c.json()
        lid = lead["id"]
        try:
            # convert
            r = session.post(f"{BASE_URL}/api/workspace/leads/{lid}/convert", timeout=30)
            assert r.status_code in (200, 201), r.text
            proj = r.json()
            assert proj.get("lead_id") == lid
            assert proj.get("title") and proj["title"].startswith("TEST_Convert")
            # lead status → project_opened
            lg = session.get(f"{BASE_URL}/api/leads/{lid}", timeout=30)
            assert lg.status_code == 200
            assert lg.json().get("status") == "project_opened"
            # activity stream has 'project.created_from_lead'
            act = session.get(f"{BASE_URL}/api/workspace/projects/{proj['id']}/activity", timeout=30)
            assert "project.created_from_lead" in [e.get("type") for e in act.json()["data"]]
        finally:
            try: session.delete(f"{BASE_URL}/api/leads/{lid}", timeout=30)
            except Exception: pass
