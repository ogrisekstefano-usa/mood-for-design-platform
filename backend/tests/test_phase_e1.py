"""Phase E.1 Polish Sprint backend tests.

Covers:
  - POST /api/moodboards/{id}/blocks/{block_id}/duplicate (offset, z_index+1, locked=False)
  - PUT  /api/moodboards/{id}/blocks/{block_id} with locked/hidden/opacity/rotation (DB raw verified)
  - PATCH /api/moodboards/{id}/blocks/batch with `style` payload (crop_x/y, focal_point, fit_mode, zoom)
  - V2 scaffold tables existence + column counts + FK constraints (SQL introspection)
  - GET  /api/storage/signed-upload returns signed_url

NB: V2 tables are intentionally NOT exposed via REST API.
"""
import os
import uuid
import json
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")
EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"

try:
    import psycopg2
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False

DB_URL = os.environ.get("DATABASE_URL")


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


@pytest.fixture
def moodboard(session):
    r = session.post(
        f"{BASE_URL}/api/moodboards",
        json={"title": f"TEST_E1_{uuid.uuid4().hex[:6]}"},
        timeout=30,
    )
    assert r.status_code in (200, 201), r.text
    mb = r.json()
    yield mb
    try:
        session.delete(f"{BASE_URL}/api/moodboards/{mb['id']}", timeout=30)
    except Exception:
        pass


# ─── Duplicate block ─────────────────────────────────────────────────────────
class TestDuplicateBlock:
    def test_duplicate_offsets_and_resets_locked(self, session, moodboard):
        # create source block locked=True
        r = session.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
            json={"type": "text", "x": 100, "y": 200, "width": 300, "height": 100,
                  "content": {"text": "source"}},
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        src = r.json()
        src_id = src["id"]
        src_z = src.get("z_index", 0)
        # lock the source
        u = session.put(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/{src_id}",
            json={"locked": True}, timeout=30,
        )
        assert u.status_code == 200, u.text

        # duplicate
        d = session.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/{src_id}/duplicate",
            timeout=30,
        )
        assert d.status_code in (200, 201), d.text
        dup = d.json()
        assert dup["id"] != src_id, "duplicate must have new id"
        assert dup["x"] == src["x"] + 24, f"expected offset +24, got x={dup['x']}"
        assert dup["y"] == src["y"] + 24, f"expected offset +24, got y={dup['y']}"
        assert dup.get("z_index", 0) == src_z + 1, f"expected z_index+1, got {dup.get('z_index')}"
        assert dup.get("locked") is False, "duplicate must reset locked=False"
        # ensure top-level layout normalization (no JSONB leaks)
        assert "position_json" not in dup
        assert "style_json" not in dup
        # content preserved
        assert (dup.get("content") or {}).get("text") == "source"

    def test_duplicate_404_on_invalid_block(self, session, moodboard):
        r = session.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/{uuid.uuid4()}/duplicate",
            timeout=30,
        )
        assert r.status_code == 404


# ─── PUT with locked/hidden/opacity/rotation ─────────────────────────────────
class TestPutStructuredFlags:
    def test_put_persists_locked_hidden_opacity_rotation(self, session, moodboard):
        r = session.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
            json={"type": "note", "content": {"text": "flag-target"}},
            timeout=30,
        )
        bid = r.json()["id"]
        u = session.put(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/{bid}",
            json={"locked": True, "hidden": False, "opacity": 0.55, "rotation": 12.5},
            timeout=30,
        )
        assert u.status_code == 200, u.text
        out = u.json()
        assert out.get("locked") is True
        assert out.get("hidden") in (False, None)
        assert abs(float(out.get("opacity", 0)) - 0.55) < 0.01
        assert abs(float(out.get("rotation", 0)) - 12.5) < 0.01

        # Raw DB verify (4 structured columns)
        if DB_AVAILABLE and DB_URL:
            conn = psycopg2.connect(DB_URL)
            try:
                cur = conn.cursor()
                cur.execute(
                    "SELECT locked, hidden, opacity, rotation FROM moodboard_elements WHERE id=%s",
                    (bid,),
                )
                row = cur.fetchone()
                assert row is not None
                locked, hidden, opacity, rotation = row
                assert locked is True
                assert hidden is False
                assert abs(float(opacity) - 0.55) < 0.01
                assert abs(float(rotation) - 12.5) < 0.01
            finally:
                conn.close()
        else:
            pytest.skip("psycopg2 unavailable — API-level check only")


# ─── Batch with style payload ────────────────────────────────────────────────
class TestBatchStyle:
    def test_batch_persists_style_jsonb(self, session, moodboard):
        r = session.post(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks",
            json={"type": "image", "content": {"src": "https://placehold.co/600x400"}},
            timeout=30,
        )
        bid = r.json()["id"]
        payload = {
            "blocks": [
                {
                    "id": bid,
                    "style": {
                        "crop_x": 0.1,
                        "crop_y": 0.2,
                        "focal_point": "center",
                        "fit_mode": "cover",
                        "zoom": 1.3,
                    },
                }
            ]
        }
        r = session.patch(
            f"{BASE_URL}/api/moodboards/{moodboard['id']}/blocks/batch",
            json=payload, timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("updated") == 1

        # GET to verify normalized response carries style
        g = session.get(f"{BASE_URL}/api/moodboards/{moodboard['id']}", timeout=30)
        by_id = {e["id"]: e for e in g.json().get("elements", [])}
        st = by_id[bid].get("style") or {}
        assert st.get("fit_mode") == "cover", f"style missing fit_mode: {st}"
        assert st.get("focal_point") == "center"
        assert abs(float(st.get("zoom", 0)) - 1.3) < 0.01

        # Raw DB verify style_json JSONB
        if DB_AVAILABLE and DB_URL:
            conn = psycopg2.connect(DB_URL)
            try:
                cur = conn.cursor()
                cur.execute("SELECT style_json FROM moodboard_elements WHERE id=%s", (bid,))
                (sj,) = cur.fetchone()
                if isinstance(sj, str):
                    sj = json.loads(sj)
                assert sj.get("fit_mode") == "cover"
                assert sj.get("focal_point") == "center"
                assert abs(float(sj.get("zoom", 0)) - 1.3) < 0.01
                assert abs(float(sj.get("crop_x", 0)) - 0.1) < 0.01
            finally:
                conn.close()


# ─── V2 Scaffold Tables (SQL only) ───────────────────────────────────────────
@pytest.mark.skipif(not (DB_AVAILABLE and DB_URL), reason="psycopg2 / DB_URL missing")
class TestV2ScaffoldTables:
    EXPECTED = {
        "moodboard_templates": 21,   # rough count from migration 006
        "template_blocks": 13,
        "moodboard_versions": 14,
        "moodboard_comments": 19,
    }

    def test_tables_exist_and_queryable(self):
        conn = psycopg2.connect(DB_URL)
        try:
            cur = conn.cursor()
            for tbl in self.EXPECTED:
                cur.execute(
                    "SELECT COUNT(*) FROM information_schema.tables "
                    "WHERE table_schema='public' AND table_name=%s",
                    (tbl,),
                )
                (cnt,) = cur.fetchone()
                assert cnt == 1, f"missing scaffold table {tbl}"
                # queryable
                cur.execute(f"SELECT COUNT(*) FROM public.{tbl}")
                cur.fetchone()
        finally:
            conn.close()

    def test_column_counts_approx(self):
        conn = psycopg2.connect(DB_URL)
        try:
            cur = conn.cursor()
            for tbl, expected_min in self.EXPECTED.items():
                cur.execute(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=%s",
                    (tbl,),
                )
                (cnt,) = cur.fetchone()
                # Allow slight drift but ensure schema is non-trivial
                assert cnt >= expected_min - 2, f"{tbl} has {cnt} cols, expected >= {expected_min - 2}"
        finally:
            conn.close()

    def test_fk_constraints_present(self):
        """template_blocks→moodboard_templates, versions/comments→moodboards."""
        conn = psycopg2.connect(DB_URL)
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type='FOREIGN KEY'
                  AND tc.table_schema='public'
                  AND tc.table_name IN ('template_blocks','moodboard_versions','moodboard_comments','moodboard_templates')
            """)
            fks = cur.fetchall()
            fk_pairs = {(r[0], r[2]) for r in fks}
            assert ("template_blocks", "moodboard_templates") in fk_pairs
            assert ("moodboard_versions", "moodboards") in fk_pairs
            assert ("moodboard_comments", "moodboards") in fk_pairs
            assert ("moodboard_comments", "tenants") in fk_pairs
        finally:
            conn.close()

    def test_v2_endpoints_not_exposed(self, session):
        """Confirm no REST surface for V2 tables (intentional)."""
        # Routes that don't collide with /api/moodboards/{id}/...
        for path in ("/api/moodboard-templates", "/api/templates",
                     "/api/moodboard-versions", "/api/moodboard-comments"):
            r = session.get(f"{BASE_URL}{path}", timeout=15)
            assert r.status_code in (404, 405), f"unexpected {path} status {r.status_code}"


# ─── Storage signed upload ───────────────────────────────────────────────────
class TestStorageSignedUpload:
    def test_signed_upload_returns_url(self, session):
        r = session.post(
            f"{BASE_URL}/api/storage/signed-upload",
            json={"bucket": "moodboard-assets",
                  "path": f"e1-test/{uuid.uuid4().hex}.jpg",
                  "content_type": "image/jpeg"},
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # Accept various key naming conventions
        url = body.get("signed_url") or body.get("url") or body.get("upload_url") \
            or (body.get("data") or {}).get("signed_url")
        assert url and url.startswith("http"), f"missing signed_url in {body}"
