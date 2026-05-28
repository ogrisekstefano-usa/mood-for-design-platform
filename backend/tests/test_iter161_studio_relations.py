"""
ITER161 — Studio Relations & Advisor Governance™ backend tests.
Curatorial / advisory infrastructure (NOT a CRM). Italian-first editorial copy.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://editorial-platform-4.preview.emergentagent.com").rstrip("/")

ADMIN_HEADERS = {
    "X-Admin-Key": "dev",
    "X-Tenant-Slug": "studio",
    "Content-Type": "application/json",
}

# Reuse an existing relation if available (per main-agent context)
EXISTING_RELATION_ID = "a1475339-7a31-4fdc-b5c2-4170ef3a7ca0"


# ── Auth guard ────────────────────────────────────────────────────────
class TestAuthGuards:
    """Unauthenticated requests must be rejected with 401."""

    def test_no_auth_relations_list_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/relations")
        assert r.status_code == 401, r.text

    def test_no_auth_console_summary_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/advisor/console-summary")
        assert r.status_code == 401

    def test_no_auth_copy_manifest_401(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/copy/manifest",
            params={"namespace": "admin.studioRelations", "locale": "it"},
        )
        assert r.status_code == 401

    def test_wrong_admin_key_401(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/relations",
            headers={"X-Admin-Key": "bogus", "X-Tenant-Slug": "studio"},
        )
        assert r.status_code == 401


# ── Editorial copy manifest ───────────────────────────────────────────
class TestCopyManifest:
    """Curatorial Italian editorial copy under admin.studioRelations namespace."""

    def test_manifest_it_returns_values(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/copy/manifest",
            params={"namespace": "admin.studioRelations", "locale": "it"},
            headers=ADMIN_HEADERS,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["namespace"] == "admin.studioRelations"
        assert body["locale"] == "it"
        values = body["values"]
        assert isinstance(values, dict)
        # The PRD specifies ~162 IT keys
        assert len(values) >= 100, f"Expected ≥100 IT keys, got {len(values)}"

    def test_manifest_has_curatorial_anchors(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/copy/manifest",
            params={"namespace": "admin.studioRelations", "locale": "it"},
            headers=ADMIN_HEADERS,
        )
        body = r.json()
        joined = " ".join(str(v) for v in body["values"].values()).lower()
        # Curatorial / advisory vocabulary present
        assert "relazion" in joined or "ecosistema" in joined or "advisory" in joined
        # NO CRM/sales vocabulary
        forbidden = ["crm", "lead", "pipeline di vendita", "venditore", "deal closing"]
        for term in forbidden:
            assert term not in joined, f"Forbidden CRM term '{term}' found in editorial copy"


# ── Identity verification ─────────────────────────────────────────────
class TestVerifyIdentity:
    def test_verify_clear_for_random(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/relations/verify-identity",
            headers=ADMIN_HEADERS,
            json={
                "studio_name": f"TEST_NoMatch_{uuid.uuid4().hex[:8]}",
                "contact_email": f"test_{uuid.uuid4().hex[:8]}@example.invalid",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "verdict" in body
        assert "matches" in body
        assert body["verdict"] in {"clear", "existing_relation", "review"}
        assert isinstance(body["matches"], list)

    def test_verify_existing_relation_detected(self):
        # Insert a deterministic test relation first
        unique = uuid.uuid4().hex[:8]
        email = f"test_iter161_{unique}@example.invalid"
        name = f"TEST_StudioBrera_{unique}"
        create = requests.post(
            f"{BASE_URL}/api/admin/relations",
            headers=ADMIN_HEADERS,
            json={"studio_name": name, "contact_email": email, "city": "Milano"},
        )
        assert create.status_code in (200, 201), create.text
        cbody = create.json()
        assert cbody.get("ok") is True
        assert "relation_id" in cbody or "id" in cbody
        # Now verify with same name/email
        verify = requests.post(
            f"{BASE_URL}/api/admin/relations/verify-identity",
            headers=ADMIN_HEADERS,
            json={"studio_name": name, "contact_email": email},
        )
        assert verify.status_code == 200
        body = verify.json()
        assert body["verdict"] == "existing_relation", body
        assert len(body["matches"]) >= 1


# ── Relations CRUD ────────────────────────────────────────────────────
class TestRelationsCRUD:
    relation_id: str | None = None

    def test_a_create_relation(self):
        unique = uuid.uuid4().hex[:8]
        r = requests.post(
            f"{BASE_URL}/api/admin/relations",
            headers=ADMIN_HEADERS,
            json={
                "studio_name": f"TEST_AtelierMilano_{unique}",
                "contact_email": f"test_{unique}@example.invalid",
                "contact_name": "Test Contact",
                "city": "Milano",
                "country": "IT",
            },
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        rid = body.get("relation_id") or body.get("id")
        assert rid, f"no relation_id in response: {body}"
        TestRelationsCRUD.relation_id = rid

    def test_b_list_relations(self):
        r = requests.get(f"{BASE_URL}/api/admin/relations", headers=ADMIN_HEADERS)
        assert r.status_code == 200
        body = r.json()
        items = body if isinstance(body, list) else body.get("items") or body.get("relations") or []
        assert isinstance(items, list)
        assert len(items) >= 1

    def test_c_get_relation_details(self):
        rid = TestRelationsCRUD.relation_id or EXISTING_RELATION_ID
        r = requests.get(f"{BASE_URL}/api/admin/relations/{rid}", headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("id") == rid or "id" in body
        # Expect at least the curatorial dossier shape
        for key in ("events", "visits", "followups"):
            assert key in body, f"missing field '{key}' in relation detail: {list(body.keys())}"

    def test_d_patch_relation(self):
        rid = TestRelationsCRUD.relation_id
        if not rid:
            pytest.skip("no relation created")
        r = requests.patch(
            f"{BASE_URL}/api/admin/relations/{rid}",
            headers=ADMIN_HEADERS,
            json={"status": "qualified", "temperature": "warm",
                  "notes": "TEST curatorial note", "actor_id": None},
        )
        assert r.status_code == 200, r.text
        # GET to verify persistence + timeline event logged
        g = requests.get(f"{BASE_URL}/api/admin/relations/{rid}", headers=ADMIN_HEADERS)
        body = g.json()
        # Some implementations nest under 'relation'
        rel = body.get("relation") or body
        assert rel.get("status") == "qualified", rel
        events = body.get("events") or []
        assert isinstance(events, list)

    def test_e_create_visit(self):
        rid = TestRelationsCRUD.relation_id
        if not rid:
            pytest.skip("no relation")
        r = requests.post(
            f"{BASE_URL}/api/admin/relations/{rid}/visits",
            headers=ADMIN_HEADERS,
            json={
                "atmosphere": "TEST: composto, luminoso, silenzioso",
                "rating_clarity": 4,
                "rating_taste": 5,
                "rating_readiness": 3,
            },
        )
        assert r.status_code in (200, 201), r.text

    def test_f_create_and_complete_followup(self):
        rid = TestRelationsCRUD.relation_id
        if not rid:
            pytest.skip("no relation")
        cr = requests.post(
            f"{BASE_URL}/api/admin/relations/{rid}/followups",
            headers=ADMIN_HEADERS,
            json={
                "type": "call",
                "due_at": "2026-12-31T10:00:00Z",
                "notes": "TEST followup",
            },
        )
        assert cr.status_code in (200, 201), cr.text
        fbody = cr.json()
        fid = fbody.get("id") or fbody.get("followup_id")
        assert fid, f"no followup id in response: {fbody}"
        done = requests.patch(
            f"{BASE_URL}/api/admin/followups/{fid}/complete",
            headers=ADMIN_HEADERS,
            json={"next_action": "TEST complete"},
        )
        assert done.status_code == 200, done.text


# ── Console summary ───────────────────────────────────────────────────
class TestConsoleSummary:
    def test_console_summary_shape(self):
        r = requests.get(f"{BASE_URL}/api/admin/advisor/console-summary", headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "summary" in body and "pending_introductions" in body
        s = body["summary"]
        for k in ("total", "active", "activated", "ready", "strong", "warm",
                  "pipeline_recurring", "pipeline_setup"):
            assert k in s, f"missing summary key {k}"
        assert isinstance(body["pending_introductions"], list)


# ── Activate ecosystem ────────────────────────────────────────────────
class TestActivateEcosystem:
    def test_activate_ecosystem_returns_tenant(self):
        # Create a fresh relation to activate (not the seeded already-activated one)
        unique = uuid.uuid4().hex[:8]
        cr = requests.post(
            f"{BASE_URL}/api/admin/relations",
            headers=ADMIN_HEADERS,
            json={
                "studio_name": f"TEST_Activate_{unique}",
                "contact_email": f"test_act_{unique}@example.invalid",
                "contact_name": "Founder Test",
                "city": "Milano",
                "country": "IT",
            },
        )
        assert cr.status_code in (200, 201), cr.text
        rid = cr.json().get("relation_id") or cr.json().get("id")
        assert rid
        r = requests.post(
            f"{BASE_URL}/api/admin/relations/{rid}/activate-ecosystem",
            headers=ADMIN_HEADERS,
            json={},
        )
        # In sandbox mode magic link is stubbed — must still return ok+tenant_id+slug
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        for k in ("tenant_id", "slug", "founder_user_id"):
            assert k in body, f"missing key {k} in {body}"
        assert "magic_link_sent" in body
