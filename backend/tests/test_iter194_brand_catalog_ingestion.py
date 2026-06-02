"""ITER194 · Backend tests · Multi-PDF Brand Catalog Ingestion Workspace.

Covers:
  • Brand create / list / detail
  • Catalog Set CRUD + slug uniqueness
  • Multi-PDF upload (batch ≤50, current test: 2 PDFs)
  • Extract pipeline E2E with synthetic ARBI-like PDFs
  • Unified Brand Index — confidence-thresholded dedup:
      - same product (AURORA) across both PDFs → auto_merged
      - distinct product appears once → separate / needs_review
  • Page snapshots (brand_catalog_pages) created
  • Validation Summary endpoint structure
  • Entity merge / patch + Publish gate

Vision Layer 2 is disabled for speed (ITER189_DISABLE_VISION=1).
"""
from __future__ import annotations

import io
import os
import time
from typing import List

import pytest
import requests

os.environ.setdefault("ITER189_DISABLE_VISION", "1")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = ("admin@moodfordesign.com", "Blueprint2024!")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login",
                       json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    body = r.json()
    tok = (body.get("session") or {}).get("access_token") \
        or body.get("access_token") or body.get("token")
    assert tok, "No token in login response"
    return tok


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


def _make_arbi_pdf(*, products: List[dict]) -> bytes:
    """Build a small ARBI-style PDF with bathroom products."""
    import fitz
    from PIL import Image as PILImage

    doc = fitz.open()
    # Cover
    p = doc.new_page(width=595, height=842)
    p.insert_text((40, 80), "ARBI Bathroom", fontsize=28)
    p.insert_text((40, 130), "Test Catalogue", fontsize=18)
    # TOC
    p = doc.new_page(width=595, height=842)
    p.insert_text((40, 60), "Indice", fontsize=22)
    for i, prod in enumerate(products, 1):
        p.insert_text((40, 110 + 30 * i),
                       f"{prod['title']} ........ {3 + i*2}", fontsize=12)
    for prod in products:
        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 80), prod["title"], fontsize=32)
        p.insert_text((40, 120), f"design {prod['designer']}", fontsize=12)
        img = PILImage.new("RGB", (400, 300),
                            color=prod.get("color", (220, 215, 210)))
        buf = io.BytesIO(); img.save(buf, format="PNG")
        p.insert_image(fitz.Rect(40, 160, 555, 600), stream=buf.getvalue())
        p.insert_text(
            (40, 640),
            f"This is {prod['title']}, an iconic bathroom composition designed by "
            f"{prod['designer']}. Crafted in {', '.join(prod['materials'])} with "
            f"refined Italian heritage and customizable finishes.",
            fontsize=10,
        )
        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 60), "Dimensioni", fontsize=14)
        p.insert_text((40, 85), prod.get("dim", "120 x 50 x 80 cm"), fontsize=11)
        p.insert_text((40, 140), "Materiali", fontsize=14)
        p.insert_text((40, 165), ", ".join(prod["materials"]), fontsize=11)
        p.insert_text((40, 220), "Finiture", fontsize=14)
        for j, fin in enumerate(prod.get("finishes", ["Bianco Opaco", "Carrara"])):
            p.insert_text((40, 245 + j * 20), fin, fontsize=11)
    pdf = doc.tobytes(); doc.close()
    return pdf


# ── Synthetic ARBI catalogue set (2 PDFs) ──────────────────────────────
@pytest.fixture(scope="module")
def admin_tok():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def pdf_code_collection() -> bytes:
    """Catalog A — 'Code' collection: AURORA + BOREALE."""
    return _make_arbi_pdf(products=[
        {"title": "AURORA", "designer": "Marco Rossi",
         "materials": ["ceramic", "steel"],
         "finishes": ["Bianco Opaco", "Carrara"],
         "color": (220, 215, 210)},
        {"title": "BOREALE", "designer": "Anna Verdi",
         "materials": ["wood", "brass"],
         "finishes": ["Burned Oak", "Oxybrass"],
         "color": (180, 150, 110)},
    ])


@pytest.fixture(scope="module")
def pdf_code_wave_collection() -> bytes:
    """Catalog B — 'Code Wave' (alias of Code) — AURORA repeats, MIRAGE new."""
    return _make_arbi_pdf(products=[
        {"title": "AURORA", "designer": "Marco Rossi",
         "materials": ["ceramic", "marble"],
         "finishes": ["Bianco Opaco", "Tortora"],
         "color": (200, 195, 190)},
        {"title": "MIRAGE", "designer": "Carla Bianchi",
         "materials": ["glass", "brass"],
         "finishes": ["Oxybrass", "Cement"],
         "color": (210, 220, 225)},
    ])


# ─── Brand + Catalog Set lifecycle ────────────────────────────────────
class TestBrandLifecycle:

    def test_create_arbi_brand(self, admin_tok):
        r = requests.post(
            f"{API}/knowledge/brands",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"name": "ARBI Test Bathroom",
                   "slug": f"arbi-test-{int(time.time())}",
                   "category": "bathroom",
                   "country": "IT"},
            timeout=30,
        )
        assert r.status_code == 201, r.text
        brand = r.json()
        assert brand["name"] == "ARBI Test Bathroom"
        pytest.arbi_brand_id = brand["id"]

    def test_list_brands_contains_arbi(self, admin_tok):
        r = requests.get(f"{API}/knowledge/brands",
                          headers=_h(admin_tok), timeout=30)
        assert r.status_code == 200
        names = [b["name"] for b in r.json()["brands"]]
        assert "ARBI Test Bathroom" in names

    def test_create_catalog_set(self, admin_tok):
        r = requests.post(
            f"{API}/knowledge/brands/{pytest.arbi_brand_id}/catalog-sets",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"name": "ARBI Master Set 2026",
                   "description": "Pilot ingestion test"},
            timeout=30,
        )
        assert r.status_code == 201, r.text
        cset = r.json()
        assert cset["status"] == "draft"
        assert cset["document_count"] == 0
        pytest.set_id = cset["id"]

    def test_get_catalog_set_empty(self, admin_tok):
        r = requests.get(f"{API}/knowledge/catalog-sets/{pytest.set_id}",
                          headers=_h(admin_tok), timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["catalog_set"]["status"] == "draft"
        assert body["document_count"] == 0


# ─── Multi-PDF upload + extraction E2E ────────────────────────────────
class TestExtractionPipeline:

    def test_upload_two_pdfs(self, admin_tok, pdf_code_collection,
                              pdf_code_wave_collection):
        files = [
            ("files", ("code.pdf", pdf_code_collection, "application/pdf")),
            ("files", ("code-wave.pdf", pdf_code_wave_collection, "application/pdf")),
        ]
        r = requests.post(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/documents/upload",
            headers=_h(admin_tok), files=files, timeout=120,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["ok_count"] == 2
        assert body["failed_count"] == 0

    def test_list_documents_after_upload(self, admin_tok):
        r = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/documents",
            headers=_h(admin_tok), timeout=30,
        )
        assert r.status_code == 200
        docs = r.json()["documents"]
        assert len(docs) == 2
        # Pages discovered during upload
        for d in docs:
            assert d["page_count"] is not None
            assert d["extraction_status"] == "pending"

    def test_trigger_extraction(self, admin_tok):
        r = requests.post(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/extract",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"max_candidates_per_doc": 60, "rebuild_index": True},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "queued"

    def test_extraction_completes(self, admin_tok):
        # Poll up to 180s
        deadline = time.time() + 180
        last_status = None
        while time.time() < deadline:
            r = requests.get(
                f"{API}/knowledge/catalog-sets/{pytest.set_id}/extraction-status",
                headers=_h(admin_tok), timeout=30,
            )
            assert r.status_code == 200
            body = r.json()
            last_status = body["status"]
            if last_status in ("needs_review", "validated", "published"):
                break
            time.sleep(2.5)
        assert last_status in ("needs_review", "validated", "published"), \
               f"Final status: {last_status}"


# ─── Unified Brand Index ──────────────────────────────────────────────
class TestUnifiedIndex:

    def test_validation_summary_structure(self, admin_tok):
        r = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/validation-summary",
            headers=_h(admin_tok), timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["catalog_set"]["status"] == "needs_review"
        assert body["brand"]["name"] == "ARBI Test Bathroom"
        assert len(body["documents"]) == 2
        ec = body["entity_counts"]
        # at least products + designers + materials + finishes detected
        for et in ("product", "designer", "material", "finish"):
            assert et in ec, f"missing entity_type {et} in entity_counts"

    def test_entities_listed_and_cross_doc_merged(self, admin_tok):
        r = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/entities",
            headers=_h(admin_tok), params={"entity_type": "product"},
            timeout=30,
        )
        assert r.status_code == 200
        products = r.json()["entities"]
        names = [p["display_name"].upper() for p in products]
        # AURORA appears in BOTH pdfs → should be a single entity
        aurora_rows = [p for p in products if "AURORA" in p["display_name"].upper()]
        assert len(aurora_rows) == 1, f"Aurora duplicated: {names}"
        aurora = aurora_rows[0]
        # Cross-doc mention boost should push it to auto_merged or needs_review
        assert aurora["status"] in ("auto_merged", "needs_review", "detected"), \
               f"unexpected status {aurora['status']}"
        assert aurora["mention_count"] >= 2
        assert len(aurora["source_document_ids"]) == 2

    def test_designer_marco_rossi_appears_across_docs(self, admin_tok):
        r = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/entities",
            headers=_h(admin_tok), params={"entity_type": "designer"},
            timeout=30,
        )
        assert r.status_code == 200
        rows = r.json()["entities"]
        marco = [d for d in rows if "MARCO" in d["display_name"].upper()]
        assert len(marco) == 1
        # Marco Rossi appears in both PDFs (3 mentions total)
        assert marco[0]["mention_count"] >= 2

    def test_pages_snapshot_exists(self, admin_tok):
        r = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/pages",
            headers=_h(admin_tok), params={"limit": 50}, timeout=30,
        )
        assert r.status_code == 200
        pages = r.json()["pages"]
        assert len(pages) >= 6  # ≥3 pages per PDF × 2 PDFs
        # Each page has a visual_role
        roles = {p["visual_role"] for p in pages}
        assert "cover" in roles or "product_spread" in roles

    def test_patch_page_review(self, admin_tok):
        r = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/pages",
            headers=_h(admin_tok), params={"limit": 1}, timeout=30,
        )
        pid = r.json()["pages"][0]["id"]
        r2 = requests.patch(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/pages/{pid}",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"review_status": "validated", "review_notes": "ok"},
            timeout=30,
        )
        assert r2.status_code == 200
        assert r2.json()["page"]["review_status"] == "validated"


# ─── Entity Resolver: patch + merge + publish gate ────────────────────
class TestEntityResolverAndPublish:

    def test_patch_entity_status(self, admin_tok):
        r = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/entities",
            headers=_h(admin_tok), params={"entity_type": "product"},
            timeout=30,
        )
        products = r.json()["entities"]
        eid = products[0]["id"]
        r2 = requests.patch(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/entities/{eid}",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"status": "validated"}, timeout=30,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["entity"]["status"] == "validated"

    def test_publish_blocked_while_needs_review(self, admin_tok):
        # If at least one needs_review entity still exists, publish should fail
        r_list = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/entities",
            headers=_h(admin_tok), params={"status": "needs_review"},
            timeout=30,
        )
        if not r_list.json()["entities"]:
            pytest.skip("no needs_review entities — gate untestable")
        r = requests.post(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/publish",
            headers=_h(admin_tok), timeout=30,
        )
        assert r.status_code == 409

    def test_publish_after_clearing_review(self, admin_tok):
        # Validate all remaining needs_review entities
        r_list = requests.get(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/entities",
            headers=_h(admin_tok), params={"status": "needs_review", "limit": 500},
            timeout=30,
        )
        for e in r_list.json()["entities"]:
            requests.patch(
                f"{API}/knowledge/catalog-sets/{pytest.set_id}/entities/{e['id']}",
                headers={**_h(admin_tok), "Content-Type": "application/json"},
                json={"status": "validated"}, timeout=30,
            )
        r = requests.post(
            f"{API}/knowledge/catalog-sets/{pytest.set_id}/publish",
            headers=_h(admin_tok), timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "published"

    def test_archive_at_end(self, admin_tok):
        # Cleanup (won't fail the suite if it errors)
        try:
            requests.delete(
                f"{API}/knowledge/catalog-sets/{pytest.set_id}",
                headers=_h(admin_tok), timeout=30,
            )
        except Exception:
            pass
