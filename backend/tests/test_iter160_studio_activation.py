"""ITER160 Studio Activation backend tests."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://editorial-platform-4.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "MoodAdmin2026!"

# Shared state across tests
state = {}


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_jwt(client):
    r = client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "tenant_slug": "studio"
    })
    if r.status_code != 200:
        return None
    return r.json().get("token") or r.json().get("access_token")


# ─── BACKEND-A: Manifest ──────────────────────────────────────────
class TestManifest:
    def test_manifest_structure(self, client):
        r = client.get(f"{BASE_URL}/api/studio/activation/manifest?locale=it")
        assert r.status_code == 200, r.text
        m = r.json()
        assert len(m["archetypes"]) == 6
        for a in m["archetypes"]:
            assert {"key", "title_key", "descriptor_key", "image_url"} <= set(a.keys())
        assert len(m["experiences"]) == 5
        assert "archetype_to_suggested" in m
        assert "entrance_image_url" in m
        assert len(m["copy_keys"]) > 100
        assert "copy" in m

    def test_manifest_copy_resolved(self, client):
        m = client.get(f"{BASE_URL}/api/studio/activation/manifest?locale=it").json()
        copy = m["copy"]
        assert copy.get("studio.activation.entrance.headline"), "entrance headline empty"
        assert copy.get("studio.activation.market.private_residential") == "Residenziale privato", \
            f"market.private_residential = {copy.get('studio.activation.market.private_residential')!r}"
        assert copy.get("studio.activation.temperament.quiet.title") == "Quieto", \
            f"temperament.quiet.title = {copy.get('studio.activation.temperament.quiet.title')!r}"
        assert copy.get("studio.activation.language.en-us") == "English", \
            f"language.en-us = {copy.get('studio.activation.language.en-us')!r}"


# ─── BACKEND-B: Draft lifecycle ───────────────────────────────────
class TestDraftLifecycle:
    def test_create_fresh_draft(self, client):
        r = client.post(f"{BASE_URL}/api/studio/activation/draft", json={})
        assert r.status_code == 200
        d = r.json()
        assert d["draft_token"]
        assert d["current_movement"] == "entrance"
        assert d["archetype"] is None
        assert d["experiences"] == []
        assert d["payload"] == {}
        state["tokenB"] = d["draft_token"]

    def test_patch_draft(self, client):
        tok = state["tokenB"]
        r = client.patch(f"{BASE_URL}/api/studio/activation/draft", json={
            "draft_token": tok, "archetype": "luxury_showroom", "movement": "practice"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["archetype"] == "luxury_showroom"
        assert d["current_movement"] == "practice"

    def test_resume_draft(self, client):
        tok = state["tokenB"]
        r = client.post(f"{BASE_URL}/api/studio/activation/draft", json={"draft_token": tok})
        assert r.status_code == 200
        d = r.json()
        assert d["draft_token"] == tok
        assert d.get("resumed") is True
        assert d["archetype"] == "luxury_showroom"

    def test_invalid_archetype_silently_ignored(self, client):
        tok = state["tokenB"]
        r = client.patch(f"{BASE_URL}/api/studio/activation/draft", json={
            "draft_token": tok, "archetype": "foo"
        })
        assert r.status_code == 200
        d = r.json()
        # Should remain previous valid value
        assert d["archetype"] == "luxury_showroom"


# ─── BACKEND-C: Submit ────────────────────────────────────────────
class TestSubmit:
    def test_full_happy_path(self, client):
        # Create draft
        r = client.post(f"{BASE_URL}/api/studio/activation/draft", json={})
        tok = r.json()["draft_token"]
        state["tokenC"] = tok
        # PATCH
        patch = {
            "draft_token": tok,
            "archetype": "interior_studio",
            "experiences": ["design_journey_os", "moodboard_experience"],
            "movement": "identity",
            "payload": {
                "studio_name": "Atelier Test", "monogram": "AT",
                "city": "Milano", "country": "Italia",
                "languages": ["it"],
                "markets": ["private_residential", "hospitality"],
                "temperament": "composed",
                "atelier": [{"name": "A R", "role": "Founder"}]
            }
        }
        r = client.patch(f"{BASE_URL}/api/studio/activation/draft", json=patch)
        assert r.status_code == 200
        # Submit
        r = client.post(f"{BASE_URL}/api/studio/activation/submit", json={
            "draft_token": tok,
            "contact_email": "advisor-test@studio.com",
            "contact_name": "A R", "contact_role": "Founder",
            "phone_prefix": "+39", "phone_number": "333000",
            "notes": "Sample note"
        })
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["ok"] is True
        assert "request_id" in out
        assert re.match(r"^MOOD-[0-9A-F]{4}-[0-9A-F]{4}$", out["reference"]), f"bad ref {out['reference']}"
        state["request_id"] = out["request_id"]
        state["reference"] = out["reference"]

    def test_draft_marked_completed(self, client):
        tok = state["tokenC"]
        r = client.post(f"{BASE_URL}/api/studio/activation/draft", json={"draft_token": tok})
        assert r.status_code == 200
        d = r.json()
        # Per spec: completed draft must NOT be marked resumed:true
        # It should return either a new token OR the completed state. Either way, resumed should not be true.
        if d.get("draft_token") == tok:
            assert d.get("resumed") is not True, "Completed draft incorrectly marked as resumed"

    def test_empty_email_soft_fail(self, client):
        r = client.post(f"{BASE_URL}/api/studio/activation/submit", json={
            "draft_token": "anything", "contact_email": ""
        })
        assert r.status_code == 200
        assert r.json() == {"ok": False, "reason": "empty_email"}

    def test_unknown_token(self, client):
        r = client.post(f"{BASE_URL}/api/studio/activation/submit", json={
            "draft_token": "nonexistent-token-xyz", "contact_email": "x@y.com"
        })
        assert r.status_code == 200
        assert r.json() == {"ok": False, "reason": "no_draft"}


# ─── BACKEND-D: Admin endpoints ────────────────────────────────────
class TestAdmin:
    def _auth_headers(self, jwt):
        if jwt:
            return {"Authorization": f"Bearer {jwt}"}
        return {"X-Admin-Key": "dev", "X-Tenant-Slug": "studio"}

    def test_admin_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/admin/studio/requests")
        assert r.status_code in (401, 403)

    def test_admin_wrong_key_rejected(self, client):
        r = client.get(f"{BASE_URL}/api/admin/studio/requests",
                       headers={"X-Admin-Key": "bogus", "X-Tenant-Slug": "studio"})
        assert r.status_code in (401, 403)

    def test_admin_site_blocks_requires_auth(self, client):
        r = client.get(f"{BASE_URL}/api/admin/site/blocks?namespace=site.access")
        assert r.status_code in (401, 403)

    def test_admin_site_blocks_key_ok(self, client):
        r = client.get(f"{BASE_URL}/api/admin/site/blocks?namespace=site.access",
                       headers={"X-Admin-Key": "dev", "X-Tenant-Slug": "studio"})
        assert r.status_code == 200

    def test_admin_with_jwt_ok(self, client, admin_jwt):
        if not admin_jwt:
            pytest.skip("No JWT obtained")
        r = client.get(f"{BASE_URL}/api/admin/studio/requests",
                       headers={"Authorization": f"Bearer {admin_jwt}"})
        assert r.status_code == 200

    def test_admin_list(self, client, admin_jwt):
        h = self._auth_headers(admin_jwt)
        r = client.get(f"{BASE_URL}/api/admin/studio/requests", headers=h)
        assert r.status_code == 200, r.text
        items = r.json()
        match = [x for x in items if x["id"] == state.get("request_id")]
        assert match, "Test request not found in admin list"
        x = match[0]
        assert x["reference"] == state["reference"]
        assert x["archetype"] == "interior_studio"
        assert x["studio_name"] == "Atelier Test"
        assert x["languages"] == ["it"]
        assert "hospitality" in x["markets"]
        assert x["temperament"] == "composed"
        assert x["contact_email"] == "advisor-test@studio.com"
        assert x["status"] == "received"
        assert x["notes"] == "Sample note"

    def test_admin_filter_received(self, client, admin_jwt):
        h = self._auth_headers(admin_jwt)
        r = client.get(f"{BASE_URL}/api/admin/studio/requests?status=received", headers=h)
        assert r.status_code == 200
        for x in r.json():
            assert x["status"] == "received"

    def test_admin_patch_status(self, client, admin_jwt):
        h = self._auth_headers(admin_jwt)
        rid = state["request_id"]
        r = client.patch(f"{BASE_URL}/api/admin/studio/requests/{rid}",
                         json={"status": "reviewing"}, headers=h)
        assert r.status_code == 200, r.text
        # verify
        items = client.get(f"{BASE_URL}/api/admin/studio/requests", headers=h).json()
        x = next(i for i in items if i["id"] == rid)
        assert x["status"] == "reviewing"
        assert x["reviewed_at"] is not None

    def test_admin_patch_notes(self, client, admin_jwt):
        h = self._auth_headers(admin_jwt)
        rid = state["request_id"]
        r = client.patch(f"{BASE_URL}/api/admin/studio/requests/{rid}",
                         json={"advisor_notes": "Looks aligned."}, headers=h)
        assert r.status_code == 200
        items = client.get(f"{BASE_URL}/api/admin/studio/requests", headers=h).json()
        x = next(i for i in items if i["id"] == rid)
        assert x["advisor_notes"] == "Looks aligned."


# ─── Cleanup ──────────────────────────────────────────────────────
def test_zzz_cleanup():
    """Best-effort cleanup using direct DB if possible."""
    try:
        import psycopg2
        url = os.environ.get("SESSION_POOLER_URL") or os.environ.get("DATABASE_URL")
        if not url:
            pytest.skip("No DB URL for cleanup")
        conn = psycopg2.connect(url)
        cur = conn.cursor()
        cur.execute("DELETE FROM studio_requests WHERE contact_email IN (%s,%s)",
                    ("advisor-test@studio.com", "ui-test@studio.com"))
        cur.execute("DELETE FROM studio_activation_drafts WHERE founder_email IN (%s,%s) OR completed_at IS NOT NULL",
                    ("advisor-test@studio.com", "ui-test@studio.com"))
        conn.commit()
        cur.close(); conn.close()
    except Exception as e:
        print(f"Cleanup skipped: {e}")
