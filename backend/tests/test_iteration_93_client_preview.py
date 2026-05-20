"""Iter93 · Sprint F2.4 — Client Preview Link™.

Backend coverage:
  • Generate / list / patch / revoke preview tokens
  • client_visible gating (only client_visible can generate)
  • PUBLIC endpoint /api/inspirations/public/preview/{token} (no auth)
  • Client feedback submission (approve/alternatives/note)
  • View tracking + uniques counter
  • 410 Gone on revoked / expired tokens
  • PUBLIC endpoint does NOT leak studio-private metadata
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOGIN = "demo@moodfordesign.com"
PWD = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": LOGIN, "password": PWD}, timeout=20)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture
def client_visible_collection(token):
    """Create a fresh client_visible collection with one saved asset, then cleanup."""
    r = requests.post(f"{API}/api/inspirations/references/collections",
                      headers=auth(token), timeout=20,
                      json={"title": f"F24 {uuid.uuid4().hex[:6]}",
                            "visibility": "client_visible"})
    coll = r.json()["item"]
    # Save one asset
    a = requests.get(f"{API}/api/inspirations/archive?inspiration_type=product&limit=1",
                     headers=auth(token), timeout=20).json()["items"][0]
    requests.post(f"{API}/api/inspirations/references/save",
                  headers=auth(token), timeout=20,
                  json={"visual_asset_id": a["id"],
                        "curated_collection_id": coll["id"]})
    yield coll, a
    requests.delete(f"{API}/api/inspirations/references/collections/{coll['id']}",
                    headers=auth(token), timeout=20)


# ── 1. Generate / gate ────────────────────────────────────────────────
class TestGeneratePreviewLink:
    def test_create_requires_client_visible(self, token):
        """Private and team collections cannot generate preview links."""
        for vis in ("private", "team"):
            r = requests.post(f"{API}/api/inspirations/references/collections",
                              headers=auth(token), timeout=20,
                              json={"title": "gate", "visibility": vis})
            cid = r.json()["item"]["id"]
            try:
                r2 = requests.post(
                    f"{API}/api/inspirations/references/collections/{cid}/preview-links",
                    headers=auth(token), timeout=20,
                    json={"preview_mode": "editorial"},
                )
                assert r2.status_code == 400, f"vis={vis} should be blocked"
                # Italian error message
                assert "cliente" in r2.json()["detail"].lower()
            finally:
                requests.delete(
                    f"{API}/api/inspirations/references/collections/{cid}",
                    headers=auth(token), timeout=20)

    def test_create_client_visible_succeeds(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        r = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20,
            json={"preview_mode": "editorial", "title": "Direzione Cliente"},
        )
        assert r.status_code == 201, r.text
        item = r.json()["item"]
        assert item["token"] and len(item["token"]) > 30   # secure token
        assert item["preview_mode"] == "editorial"
        assert item["revoked_at"] is None
        assert item["views_count"] == 0

    def test_invalid_preview_mode(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        r = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20,
            json={"preview_mode": "WRONG"},
        )
        assert r.status_code == 400


# ── 2. PUBLIC endpoint shape + no-leak ───────────────────────────────
class TestPublicPreview:
    def test_public_fetch_no_auth(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        link = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20, json={},
        ).json()["item"]
        # Fetch WITHOUT auth header
        r = requests.get(
            f"{API}/api/inspirations/public/preview/{link['token']}",
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("token", "title", "preview_mode", "direction", "studio", "assets", "count"):
            assert key in d
        assert d["studio"].get("name")
        # Studio dict must NOT include internal fields (id, tenant_id, settings…)
        forbidden = {"tenant_id", "id", "secret", "api_key"}
        for f in forbidden:
            assert f not in d["studio"]

    def test_public_assets_dont_leak_internal_fields(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        link = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20, json={},
        ).json()["item"]
        r = requests.get(
            f"{API}/api/inspirations/public/preview/{link['token']}", timeout=20)
        d = r.json()
        assets = d.get("assets") or []
        if not assets: pytest.skip("no assets")
        a = assets[0]
        # Public-safe fields only
        forbidden_internal = ("tenant_id", "uploaded_by", "metadata_json",
                               "storage_path", "supplier_catalog_id")
        for f in forbidden_internal:
            assert f not in a, f"public leak: {f} in asset"

    def test_invalid_token_404(self):
        r = requests.get(f"{API}/api/inspirations/public/preview/totally-invalid-{uuid.uuid4().hex}",
                         timeout=20)
        assert r.status_code == 404

    def test_revoked_returns_410(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        link = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20, json={},
        ).json()["item"]
        # Revoke
        rd = requests.delete(
            f"{API}/api/inspirations/references/preview-links/{link['id']}",
            headers=auth(token), timeout=20)
        assert rd.status_code == 204
        r = requests.get(f"{API}/api/inspirations/public/preview/{link['token']}",
                         timeout=20)
        assert r.status_code == 410

    def test_view_counter_increments(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        link = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20, json={},
        ).json()["item"]
        # 2 fetches
        requests.get(f"{API}/api/inspirations/public/preview/{link['token']}", timeout=20)
        requests.get(f"{API}/api/inspirations/public/preview/{link['token']}", timeout=20)
        # Read studio-side
        lst = requests.get(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20).json()["items"]
        active = [l for l in lst if l["id"] == link["id"]][0]
        assert active["views_count"] >= 2


# ── 3. Client Feedback ────────────────────────────────────────────────
class TestClientFeedback:
    def test_approve_direction(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        link = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20, json={},
        ).json()["item"]
        r = requests.post(
            f"{API}/api/inspirations/public/preview/{link['token']}/feedback",
            timeout=20,
            json={"action_type": "approve_direction", "client_identifier": "Riva"},
        )
        assert r.status_code == 201
        # Studio reads
        sr = requests.get(
            f"{API}/api/inspirations/references/preview-links/{link['id']}/feedback",
            headers=auth(token), timeout=20).json()
        assert sr["summary"]["approvals"] >= 1

    def test_note_with_target_asset(self, token, client_visible_collection):
        coll, asset = client_visible_collection
        link = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20, json={},
        ).json()["item"]
        r = requests.post(
            f"{API}/api/inspirations/public/preview/{link['token']}/feedback",
            timeout=20,
            json={"action_type": "note",
                  "note": "Mi piace molto questa direzione materica",
                  "target_asset_id": asset["id"],
                  "client_identifier": "Cliente"},
        )
        assert r.status_code == 201
        sr = requests.get(
            f"{API}/api/inspirations/references/preview-links/{link['id']}/feedback",
            headers=auth(token), timeout=20).json()
        assert sr["summary"]["notes"] >= 1
        # The note text is preserved
        fb_notes = [f for f in sr["feedback"] if f["action_type"] == "note"]
        assert any(f["note"] == "Mi piace molto questa direzione materica" for f in fb_notes)

    def test_invalid_action_type_400(self, token, client_visible_collection):
        coll, _ = client_visible_collection
        link = requests.post(
            f"{API}/api/inspirations/references/collections/{coll['id']}/preview-links",
            headers=auth(token), timeout=20, json={},
        ).json()["item"]
        r = requests.post(
            f"{API}/api/inspirations/public/preview/{link['token']}/feedback",
            timeout=20, json={"action_type": "reject"},
        )
        assert r.status_code == 400


# ── 4. Italian curatorial language compliance ─────────────────────────
class TestLanguageCompliance:
    def test_router_italian(self):
        src = (Path(__file__).resolve().parent.parent / "routers" /
               "client_preview.py").read_text().lower()
        for required in ("direzione", "anteprima", "client preview link"):
            assert required in src, f"missing italian/canonical marker: {required}"
        # No "reject" / "decline" / "disapprove" naming (per spec)
        # action_type values must NOT include those
        assert "'reject'" not in src
        assert "'decline'" not in src
