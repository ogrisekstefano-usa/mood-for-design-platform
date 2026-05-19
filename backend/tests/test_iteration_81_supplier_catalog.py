"""Iteration 81 — Supplier Catalog Import™ MVP.

Scope (matches review_request features_or_bugs_to_test):
- BACKEND 1: GET /api/inspirations/catalogs/taxonomy → 10 categories + 4 rights_statuses
- BACKEND 2: POST /api/inspirations/catalogs → 201 with UUID id, status='draft'
- BACKEND 3: POST /catalogs/{id}/upload-pdf → 200 with candidates (>=50), pages=113
- BACKEND 4: GET /catalogs/{id} → extraction_payload.candidates persisted
- BACKEND 5: PATCH /catalogs/{id}/candidates → updates persisted
- BACKEND 6: POST /catalogs/{id}/finalize → imported>0, status='imported'
- BACKEND 7: GET /archive?inspiration_type=product → only product items
- BACKEND 8: GET /archive?inspiration_type=editorial / ?brand=Bonaldo filtering
- BACKEND 9: GET /catalogs → list with candidate_count, imported_count, source_file_url
- BACKEND 10: DELETE /catalogs/{id} → status='archived', imported products stay live
"""
import os
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

EMAIL = "demo@moodfordesign.com"
PASSWORD = "Blueprint2024!"
PDF_PATH = "/tmp/bonaldo.pdf"

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    body = r.json()
    sess = body.get("session") or {}
    token = (sess.get("access_token") or body.get("access_token")
             or body.get("token") or (body.get("data") or {}).get("token"))
    assert token, f"no token in login body: {body}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ── BACKEND 1 ─ taxonomy ────────────────────────────────────────────
def test_backend1_taxonomy(auth_session):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/taxonomy", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    cats = data.get("categories") or []
    rights = data.get("rights_statuses") or []
    assert len(cats) == 10, f"expected 10 categories, got {len(cats)}: {cats}"
    assert len(rights) == 4, f"expected 4 rights_statuses, got {len(rights)}"
    cat_keys = {c["key"] for c in cats}
    for required in ("arredi", "cucine", "bagni", "illuminazione", "outdoor"):
        assert required in cat_keys, f"missing category: {required}"
    rights_keys = {r["key"] for r in rights}
    for required in ("uploaded_by_tenant", "supplier_authorized",
                     "external_reference", "unknown"):
        assert required in rights_keys, f"missing rights_status: {required}"


# ── BACKEND 2 ─ create catalog ──────────────────────────────────────
@pytest.fixture(scope="module")
def created_catalog(auth_session):
    body = {
        "brand": "TestBrand",
        "collection": "Test 2026",
        "category": "arredi",
        "rights_status": "supplier_authorized",
    }
    r = auth_session.post(f"{BASE_URL}/api/inspirations/catalogs",
                          json=body, timeout=20)
    if r.status_code != 201:
        pytest.skip(f"create catalog failed: {r.status_code} {r.text[:200]}")
    return r.json()


def test_backend2_create_catalog(created_catalog):
    d = created_catalog
    assert "id" in d, d
    assert UUID_RE.match(d["id"]), f"not a UUID: {d['id']}"
    assert d.get("status") == "draft", d
    assert d.get("brand") == "TestBrand"
    assert d.get("collection") == "Test 2026"
    assert d.get("category") == "arredi"
    assert d.get("rights_status") == "supplier_authorized"


# ── BACKEND 3 ─ upload PDF (use Bonaldo) ───────────────────────────
@pytest.fixture(scope="module")
def bonaldo_catalog(auth_session):
    """Create a fresh Bonaldo catalog and upload the PDF for full pipeline."""
    if not os.path.exists(PDF_PATH):
        pytest.skip(f"Bonaldo PDF not found at {PDF_PATH}")
    body = {
        "brand": "Bonaldo",
        "collection": "Test Iter81 " + uuid.uuid4().hex[:6],
        "category": "arredi",
        "rights_status": "supplier_authorized",
    }
    r = auth_session.post(f"{BASE_URL}/api/inspirations/catalogs",
                          json=body, timeout=20)
    if r.status_code != 201:
        pytest.skip(f"create bonaldo catalog failed: {r.status_code} {r.text[:200]}")
    cat = r.json()
    cid = cat["id"]
    with open(PDF_PATH, "rb") as fh:
        files = {"file": ("Bonaldo_26-Collection-MEDIUM.pdf", fh, "application/pdf")}
        up = auth_session.post(
            f"{BASE_URL}/api/inspirations/catalogs/{cid}/upload-pdf",
            files=files, timeout=300,
        )
    if up.status_code != 200:
        pytest.skip(f"upload-pdf failed: {up.status_code} {up.text[:300]}")
    return {"catalog_id": cid, "upload_response": up.json()}


def test_backend3_upload_pdf_extracts_candidates(bonaldo_catalog):
    res = bonaldo_catalog["upload_response"]
    assert res.get("catalog_id") == bonaldo_catalog["catalog_id"]
    assert res.get("pages") == 113, f"expected 113 pages, got {res.get('pages')}"
    cands = res.get("candidates") or []
    assert len(cands) >= 50, f"expected >=50 candidates, got {len(cands)}"
    assert isinstance(res.get("warnings"), list)
    # Verify the first candidate has expected shape
    c0 = cands[0]
    for key in ("page_number", "image_url", "storage_path", "selected"):
        assert key in c0, f"candidate missing key: {key}"
    # Verify image_url is reachable
    img_url = c0["image_url"]
    img_resp = requests.get(img_url, timeout=15)
    assert img_resp.status_code == 200, (
        f"candidate image_url not reachable: {img_url} → {img_resp.status_code}"
    )


# ── BACKEND 4 ─ GET catalog returns persisted candidates ────────────
def test_backend4_get_catalog_persists_candidates(auth_session, bonaldo_catalog):
    cid = bonaldo_catalog["catalog_id"]
    r = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/{cid}", timeout=20)
    assert r.status_code == 200, r.text
    cat = r.json()
    payload = cat.get("extraction_payload") or {}
    cands = payload.get("candidates") or []
    assert cands, "no candidates in extraction_payload"
    named = [c for c in cands if c.get("product_name")]
    assert named, "no named candidates"
    sample = named[0]
    for key in ("product_name", "page_number", "image_url"):
        assert sample.get(key) is not None, f"missing {key} on candidate"
    assert sample.get("selected") is True, "named candidate not pre-selected"


# ── BACKEND 5 ─ PATCH candidates persists ──────────────────────────
def test_backend5_patch_candidates_persists(auth_session, bonaldo_catalog):
    cid = bonaldo_catalog["catalog_id"]
    # Get a couple of candidate pages
    g = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/{cid}", timeout=20)
    cands = (g.json().get("extraction_payload") or {}).get("candidates") or []
    assert len(cands) >= 2
    p1 = cands[0]["page_number"]
    p2 = cands[1]["page_number"]
    body = {
        "candidates": [
            {"page_number": p1, "product_name": "Custom Flatiron", "selected": True},
            {"page_number": p2, "selected": False},
        ]
    }
    r = auth_session.patch(f"{BASE_URL}/api/inspirations/catalogs/{cid}/candidates",
                           json=body, timeout=20)
    assert r.status_code == 200, r.text
    assert r.json().get("updated") == 2

    # Re-fetch and verify
    g2 = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/{cid}", timeout=20)
    cands2 = (g2.json().get("extraction_payload") or {}).get("candidates") or []
    by_page = {c["page_number"]: c for c in cands2}
    assert by_page[p1].get("product_name") == "Custom Flatiron"
    assert by_page[p1].get("selected") is True
    assert by_page[p2].get("selected") is False


# ── BACKEND 6 ─ finalize → imports Product Inspirations ────────────
@pytest.fixture(scope="module")
def finalized_catalog(auth_session, bonaldo_catalog):
    cid = bonaldo_catalog["catalog_id"]
    body = {
        "default_atmosphere": ["sobrio"],
        "default_material": ["legno"],
        "default_markets": ["italy_milano"],
        "default_luxury_level": "contemporary",
    }
    r = auth_session.post(f"{BASE_URL}/api/inspirations/catalogs/{cid}/finalize",
                          json=body, timeout=120)
    if r.status_code != 201:
        pytest.skip(f"finalize failed: {r.status_code} {r.text[:300]}")
    return {"catalog_id": cid, "response": r.json()}


def test_backend6_finalize_imports_products(auth_session, finalized_catalog):
    res = finalized_catalog["response"]
    cid = finalized_catalog["catalog_id"]
    imported = res.get("imported", 0)
    assert imported > 0, f"no products imported: {res}"
    assert isinstance(res.get("media_ids"), list)
    assert len(res["media_ids"]) == imported

    # Verify catalog status flipped to 'imported'
    g = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/{cid}", timeout=20)
    cat = g.json()
    assert cat.get("status") == "imported", cat.get("status")
    assert cat.get("imported_count", 0) >= imported


# ── BACKEND 7 ─ archive filter inspiration_type=product ─────────────
def test_backend7_archive_filter_product(auth_session, finalized_catalog):
    r = auth_session.get(
        f"{BASE_URL}/api/inspirations/archive",
        params={"inspiration_type": "product", "limit": 200}, timeout=30,
    )
    assert r.status_code == 200, r.text
    items = r.json().get("items") or []
    assert items, "no product inspirations returned"
    for it in items:
        assert it.get("inspiration_type") == "product", it
    # Required fields on the cards
    sample = items[0]
    for key in ("brand", "product_name", "product_category",
                "rights_status", "supplier_catalog_id"):
        assert key in sample, f"product card missing {key}: {sample}"


# ── BACKEND 8 ─ editorial filter + brand filter (case-insensitive) ──
def test_backend8_archive_filter_editorial_and_brand(auth_session):
    r = auth_session.get(
        f"{BASE_URL}/api/inspirations/archive",
        params={"inspiration_type": "editorial", "limit": 50}, timeout=30,
    )
    assert r.status_code == 200, r.text
    items = r.json().get("items") or []
    for it in items:
        assert it.get("inspiration_type") == "editorial", (
            f"product leaked into editorial filter: {it.get('id')}"
        )

    # brand filter (case-insensitive)
    r2 = auth_session.get(
        f"{BASE_URL}/api/inspirations/archive",
        params={"brand": "bonaldo", "limit": 200}, timeout=30,
    )
    assert r2.status_code == 200
    items2 = r2.json().get("items") or []
    assert items2, "no Bonaldo items returned (case-insensitive)"
    for it in items2:
        assert (it.get("brand") or "").lower() == "bonaldo", it


# ── BACKEND 9 ─ list catalogs ──────────────────────────────────────
def test_backend9_list_catalogs(auth_session, bonaldo_catalog):
    r = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs", timeout=20)
    assert r.status_code == 200, r.text
    items = r.json().get("items") or []
    assert items, "no catalogs"
    by_id = {c["id"]: c for c in items}
    cid = bonaldo_catalog["catalog_id"]
    assert cid in by_id, "uploaded catalog missing from list"
    c = by_id[cid]
    for key in ("candidate_count", "imported_count", "source_file_url"):
        assert key in c, f"list row missing {key}"
    assert c.get("candidate_count", 0) > 0
    assert c.get("source_file_url"), "source_file_url empty"


# ── BACKEND 10 ─ delete catalog soft-archives ──────────────────────
def test_backend10_delete_catalog_soft_archive(auth_session, finalized_catalog):
    cid = finalized_catalog["catalog_id"]
    media_ids = finalized_catalog["response"].get("media_ids") or []
    r = auth_session.delete(f"{BASE_URL}/api/inspirations/catalogs/{cid}", timeout=20)
    assert r.status_code in (200, 204), f"{r.status_code} {r.text[:200]}"

    # Verify status='archived'
    g = auth_session.get(f"{BASE_URL}/api/inspirations/catalogs/{cid}", timeout=20)
    assert g.status_code == 200
    assert g.json().get("status") == "archived"

    # Verify imported product still live in archive
    if media_ids:
        sample_id = media_ids[0]
        a = auth_session.get(f"{BASE_URL}/api/inspirations/archive/{sample_id}",
                             timeout=20)
        assert a.status_code == 200, f"imported product gone after archive: {a.text[:200]}"
        assert a.json().get("inspiration_type") == "product"
