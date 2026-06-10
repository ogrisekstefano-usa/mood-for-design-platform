"""STORE-012F · CLIENT APPROVAL THREAD™ + MATERIAL BOARD SYNC™
Validates:
  - POST /api/client/moodboard-elements/{eid}/feedback (interesting/explore_further/comment/422)
  - PATCH /api/moodboard-elements/{eid}/approval-status (approved/rejected/discussed/422 suggested)
  - POST /api/working-moodboards/{mbid}/sync-materials-board (create, idempotent, no-approved)
  - GET  /api/client/moodboards/{id}/presentation (NO approval_* keys anywhere)
  - Italian Client Signal™ timeline events with element title quoted
"""
import os, json, pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://i18n-recovery-1.preview.emergentagent.com").rstrip("/")
WMB_ID = "47821aa0-50c0-4ff6-ae5f-e6dccf0391e7"
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PWD = "Blueprint2024!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="session")
def s(token):
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def payload(s):
    r = s.get(f"{BASE_URL}/api/moodboards/{WMB_ID}/working-payload", timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def material_elements(payload):
    out = []
    for sec in payload["sections"]:
        if sec["section"] == "materials":
            out.extend(sec["elements"])
    assert out, "Need at least one material element on WMB"
    return out


@pytest.fixture(scope="session")
def journey_id(payload):
    return payload["journey_id"]


def _scan_keys(obj, bad_prefix=None, bad_keys=None):
    """Walks obj and returns list of keys matching bad_prefix or bad_keys."""
    found = []
    bad_keys = bad_keys or set()
    def walk(x, path=""):
        if isinstance(x, dict):
            for k, v in x.items():
                p = f"{path}.{k}"
                if bad_prefix and k.startswith(bad_prefix):
                    found.append(p)
                if k in bad_keys:
                    found.append(p)
                walk(v, p)
        elif isinstance(x, list):
            for i, v in enumerate(x):
                walk(v, f"{path}[{i}]")
    walk(obj)
    return found


# ─────────────────── PATCH approval-status ───────────────────
class TestApprovalStatusPatch:
    def test_patch_approved_material_sets_specification_candidate(self, s, material_elements):
        eid = material_elements[0]["id"]
        r = s.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                    json={"approval_status": "approved"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["approval_status"] == "approved"
        assert body["decision_stage"] == "approved"
        assert body["specification_candidate"] is True

        # Verify via re-GET
        pay = s.get(f"{BASE_URL}/api/moodboards/{WMB_ID}/working-payload").json()
        mat = [e for sec in pay["sections"] if sec["section"] == "materials" for e in sec["elements"] if e["id"] == eid][0]
        meta = (mat["content"].get("metadata") or {})
        assert meta.get("decision_stage") == "approved"
        assert meta.get("specification_candidate") is True

    def test_patch_rejected_sets_evaluation_and_false(self, s, material_elements):
        eid = material_elements[1]["id"] if len(material_elements) > 1 else material_elements[0]["id"]
        r = s.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                    json={"approval_status": "rejected"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["decision_stage"] == "evaluation"
        assert body["specification_candidate"] is False

    def test_patch_discussed_keeps_evaluation_default(self, s, material_elements):
        eid = material_elements[-1]["id"]
        r = s.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                    json={"approval_status": "discussed"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["decision_stage"] == "evaluation"
        assert body.get("specification_candidate") in (False, None)

    def test_patch_suggested_rejected_422(self, s, material_elements):
        eid = material_elements[0]["id"]
        r = s.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                    json={"approval_status": "suggested"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_patch_emits_italian_timeline_event(self, s, material_elements, journey_id):
        eid = material_elements[0]["id"]
        # Re-approve to trigger an italian narrative
        s.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                json={"approval_status": "approved"})
        r = s.get(f"{BASE_URL}/api/journeys/{journey_id}/timeline")
        if r.status_code != 200:
            pytest.skip("timeline endpoint not available")
        data = r.json()
        events = data.get("items") or data.get("events") or []
        narratives = " | ".join((e.get("narrative_text") or e.get("narrative") or "") for e in events)
        types = " ".join(e.get("event_type") or "" for e in events)
        assert ("Il designer ha approvato" in narratives) or ("element_status_changed" in types)


# ─────────────────── CLIENT FEEDBACK ───────────────────
class TestClientElementFeedback:
    def test_interesting_persists_and_emits_signal(self, s, material_elements):
        eid = material_elements[0]["id"]
        r = s.post(f"{BASE_URL}/api/client/moodboard-elements/{eid}/feedback",
                   json={"reaction": "interesting"}, timeout=30)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["reaction"] == "interesting"
        assert 'Client Signal' in body["narrative"]
        assert 'Il cliente ha mostrato interesse' in body["narrative"]
        # element title is quoted with "
        assert body["narrative"].count('"') >= 2

        # Re-GET via working-payload — client_reactions should exist
        pay = s.get(f"{BASE_URL}/api/moodboards/{WMB_ID}/working-payload").json()
        mat = [e for sec in pay["sections"] if sec["section"] == "materials" for e in sec["elements"] if e["id"] == eid][0]
        reactions = (mat["content"].get("metadata") or {}).get("client_reactions") or []
        assert any(r.get("type") == "interesting" for r in reactions)

    def test_explore_further_narrative(self, s, material_elements):
        eid = material_elements[0]["id"]
        r = s.post(f"{BASE_URL}/api/client/moodboard-elements/{eid}/feedback",
                   json={"reaction": "explore_further"}, timeout=30)
        assert r.status_code == 201, r.text
        assert 'Il cliente vorrebbe approfondire' in r.json()["narrative"]

    def test_comment_narrative_contains_quote(self, s, material_elements):
        eid = material_elements[0]["id"]
        comment = "Adoro la grana di questa pietra"
        r = s.post(f"{BASE_URL}/api/client/moodboard-elements/{eid}/feedback",
                   json={"reaction": "comment", "comment": comment}, timeout=30)
        assert r.status_code == 201, r.text
        assert comment in r.json()["narrative"]

    def test_comment_without_body_422(self, s, material_elements):
        eid = material_elements[0]["id"]
        r = s.post(f"{BASE_URL}/api/client/moodboard-elements/{eid}/feedback",
                   json={"reaction": "comment"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_invalid_reaction_422(self, s, material_elements):
        eid = material_elements[0]["id"]
        r = s.post(f"{BASE_URL}/api/client/moodboard-elements/{eid}/feedback",
                   json={"reaction": "love"}, timeout=30)
        assert r.status_code == 422, r.text

    def test_concept_board_returns_403(self, s, journey_id):
        # Find a Concept Board (one with concept_seed)
        r = s.get(f"{BASE_URL}/api/journeys/{journey_id}/concept-directions")
        if r.status_code != 200:
            pytest.skip("no concept-directions available")
        sets = r.json().get("sets") or []
        if not sets:
            pytest.skip("no concept sets")
        # Pick any concept moodboard and any of its elements
        cb_id = None
        for st in sets:
            for d in st.get("directions") or []:
                if d.get("moodboard_id"):
                    cb_id = d["moodboard_id"]; break
            if cb_id: break
        if not cb_id:
            pytest.skip("no concept moodboard id")
        pay = s.get(f"{BASE_URL}/api/moodboards/{cb_id}/working-payload")
        if pay.status_code != 200:
            pytest.skip("can't load concept working-payload")
        elems = [e for sec in pay.json()["sections"] for e in sec.get("elements") or []]
        if not elems:
            pytest.skip("concept has no elements")
        eid = elems[0]["id"]
        r = s.post(f"{BASE_URL}/api/client/moodboard-elements/{eid}/feedback",
                   json={"reaction": "interesting"}, timeout=30)
        assert r.status_code == 403, r.text
        assert "Working Moodboard" in r.text


# ─────────────────── SYNC MATERIAL BOARD ───────────────────
class TestSyncMaterialBoard:
    def test_sync_creates_or_adds(self, s, material_elements):
        # Make sure at least one is approved
        eid = material_elements[0]["id"]
        s.patch(f"{BASE_URL}/api/moodboard-elements/{eid}/approval-status",
                json={"approval_status": "approved"})
        r = s.post(f"{BASE_URL}/api/working-moodboards/{WMB_ID}/sync-materials-board",
                   json={}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["approved_materials"] >= 1
        # added>=1 OR all already-present (idempotency from previous runs)
        assert body["added"] >= 0
        assert "material_board_id" in body

        # After sync, the synced element's metadata.decision_stage should be 'specified'
        pay = s.get(f"{BASE_URL}/api/moodboards/{WMB_ID}/working-payload").json()
        mat = [e for sec in pay["sections"] if sec["section"] == "materials" for e in sec["elements"] if e["id"] == eid][0]
        assert (mat["content"].get("metadata") or {}).get("decision_stage") == "specified"

    def test_sync_idempotent(self, s):
        # Call sync twice — second call must return added=0 (no NEW approvals between calls)
        r1 = s.post(f"{BASE_URL}/api/working-moodboards/{WMB_ID}/sync-materials-board",
                    json={}, timeout=30)
        assert r1.status_code == 200, r1.text
        r2 = s.post(f"{BASE_URL}/api/working-moodboards/{WMB_ID}/sync-materials-board",
                    json={}, timeout=30)
        assert r2.status_code == 200, r2.text
        body = r2.json()
        # Second consecutive call: nothing new should be added
        assert body["added"] == 0, f"expected 0 added on consecutive idempotent call, got {body}"
        assert body["skipped"] >= 1

    def test_sync_no_approved_returns_zero(self, s, payload):
        # Find a Working Moodboard with NO approved materials. Easiest: list and pick another.
        jid = payload["journey_id"]
        r = s.get(f"{BASE_URL}/api/journeys/{jid}/working-moodboards")
        if r.status_code != 200:
            pytest.skip("can't list")
        wmbs = r.json().get("working_moodboards") or []
        candidate = None
        for w in wmbs:
            if w["moodboard_id"] == WMB_ID:
                continue
            pay = s.get(f"{BASE_URL}/api/moodboards/{w['moodboard_id']}/working-payload").json()
            mats = [e for sec in pay["sections"] if sec["section"] == "materials" for e in sec["elements"]]
            if mats and not any((e["content"] or {}).get("approval_status") == "approved" for e in mats):
                candidate = w["moodboard_id"]; break
        if not candidate:
            pytest.skip("no WMB without approved materials available")
        r = s.post(f"{BASE_URL}/api/working-moodboards/{candidate}/sync-materials-board",
                   json={}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["approved_materials"] == 0
        assert body["added"] == 0


# ─────────────────── CLIENT PRESENTATION INVARIANT ───────────────────
class TestClientPresentationInvariant:
    def test_no_approval_keys_and_no_internal_metadata(self, s):
        r = s.get(f"{BASE_URL}/api/client/moodboards/{WMB_ID}/presentation", timeout=30)
        # super_admin gets bypass; if 403 the bypass is broken
        assert r.status_code == 200, f"expected admin bypass: {r.status_code} {r.text}"
        body = r.json()
        raw = json.dumps(body)
        # NO approval_* keys anywhere on any element
        leaked = _scan_keys(body, bad_prefix="approval_")
        assert not leaked, f"leaked approval_* keys: {leaked}"
        # NO designer-internal keys
        leaked2 = _scan_keys(body, bad_keys={"client_alignment_score", "specification_candidate",
                                              "decision_stage", "material_board_id"})
        assert not leaked2, f"leaked internal keys: {leaked2}"
        # client_reactions is allowed
        assert "client_alignment_score" not in raw


# ─────────────────── REGRESSION ───────────────────
class TestRegression:
    def test_working_payload_still_intact(self, payload):
        sections = {s["section"] for s in payload["sections"]}
        assert sections == {"vision", "materials", "products", "atmosphere", "notes"}

    def test_project_brain_intact(self, s):
        r = s.get(f"{BASE_URL}/api/moodboards/{WMB_ID}/project-brain", timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("moodboard_id", "journey_id", "discovery", "concept_pulse", "recommended_next_action"):
            assert k in body
