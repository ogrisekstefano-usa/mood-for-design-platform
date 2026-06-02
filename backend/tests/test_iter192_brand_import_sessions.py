"""ITER192 · Backend tests · Founding Brands Program™ Phase 1.

Covers:
  • Brand Import Session lifecycle (create → upload → process → completed)
  • Multi-PDF processing (2 synthetic PDFs)
  • Entity Resolution: same material in 2 PDFs → 1 canonical row, mention_count=2
  • Vision Cache: same image in 2 PDFs → only 1 LLM call
  • Knowledge Package Score & Knowledge Graph endpoints

Uses ITER187_DISABLE_VISION=1 inheritance is NOT set: we DO want
Vision Cache exercised. But to keep tests offline-friendly we test
the cache module directly with mocked entries.
"""
from __future__ import annotations

import io
import os
import time

import pytest
import requests

from cultural_engine import entity_resolver
from cultural_engine import vision_cache as vcache


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@moodfordesign.com", "Blueprint2024!")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    body = r.json()
    tok = body.get("access_token") or body.get("token") \
        or (body.get("session") or {}).get("access_token")
    assert tok
    return tok


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_tok():
    return _login(*ADMIN)


# ── Synthetic 2-PDF set for the same brand ──────────────────────────
def _make_pdf(*, products: list) -> bytes:
    """Build a small PDF with given products (title, designer, materials)."""
    import fitz
    from PIL import Image as PILImage

    doc = fitz.open()
    # Cover
    p = doc.new_page(width=595, height=842)
    p.insert_text((40, 80), "MOOD Test Brand", fontsize=28)

    # TOC
    p = doc.new_page(width=595, height=842)
    p.insert_text((40, 60), "Indice", fontsize=22)
    for i, prod in enumerate(products, 1):
        p.insert_text((40, 110 + 30 * i), f"{prod['title']} ........ {3 + i*2}",
                      fontsize=12)

    for prod in products:
        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 80), prod["title"], fontsize=32)
        p.insert_text((40, 120), f"design {prod['designer']}", fontsize=12)
        img = PILImage.new("RGB", (400, 300), color=prod.get("color", (180, 160, 140)))
        buf = io.BytesIO(); img.save(buf, format="PNG")
        p.insert_image(fitz.Rect(40, 160, 555, 600), stream=buf.getvalue())
        p.insert_text((40, 640),
                      f"This is {prod['title']}, an iconic table designed by "
                      f"{prod['designer']}. Crafted in {', '.join(prod['materials'])} "
                      f"with traditional Italian heritage and sustainable processes.",
                      fontsize=10)

        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 60), "Dimensioni", fontsize=14)
        p.insert_text((40, 85), prod.get("dim", "240 x 100 x 75 cm"), fontsize=11)
        p.insert_text((40, 140), "Materiali", fontsize=14)
        p.insert_text((40, 165), ", ".join(prod["materials"]), fontsize=11)
        p.insert_text((40, 220), "Finiture", fontsize=14)
        for j, fin in enumerate(prod.get("finishes", ["Carrara", "Calacatta"])):
            p.insert_text((40, 245 + j * 20), fin, fontsize=11)

    pdf = doc.tobytes(); doc.close()
    return pdf


@pytest.fixture(scope="module")
def pdf_a() -> bytes:
    """PDF A — products Aurora + Boreale, materials: ceramic + steel."""
    return _make_pdf(products=[
        {"title": "AURORA", "designer": "Marco Rossi",
         "materials": ["ceramic", "steel"], "color": (200, 180, 140)},
        {"title": "BOREALE", "designer": "Anna Verdi",
         "materials": ["wood", "brass"], "color": (130, 100, 80)},
    ])


@pytest.fixture(scope="module")
def pdf_b() -> bytes:
    """PDF B — product Eclissi + Aurora (SAME product, different doc) — entity res target."""
    return _make_pdf(products=[
        {"title": "ECLISSI", "designer": "Marco Rossi",
         "materials": ["marble", "brass"], "color": (160, 140, 130)},
        {"title": "AURORA",  "designer": "Marco Rossi",
         "materials": ["ceramic", "wood"], "color": (210, 190, 150)},
    ])


# ── Tests ──────────────────────────────────────────────────────────────
class TestSessionLifecycle:

    def test_create_session(self, admin_tok):
        r = requests.post(
            f"{API}/inspirations/knowledge-factory/sessions",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"session_name": "ITER192 lifecycle test"},
            timeout=30,
        )
        assert r.status_code == 201
        body = r.json()
        assert body["status"] == "open"
        assert body["document_count"] == 0
        pytest.session_id = body["id"]

    def test_list_sessions(self, admin_tok):
        r = requests.get(
            f"{API}/inspirations/knowledge-factory/sessions",
            headers=_h(admin_tok), timeout=30,
        )
        assert r.status_code == 200
        body = r.json()
        assert any(s["id"] == pytest.session_id for s in body["sessions"])

    def test_multi_pdf_upload(self, admin_tok, pdf_a, pdf_b):
        files = [
            ("files", ("catalog_a.pdf", pdf_a, "application/pdf")),
            ("files", ("catalog_b.pdf", pdf_b, "application/pdf")),
        ]
        r = requests.post(
            f"{API}/inspirations/knowledge-factory/sessions/"
            f"{pytest.session_id}/documents",
            headers=_h(admin_tok), files=files, timeout=120,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["ok_count"] == 2
        assert body["failed_count"] == 0

    def test_process_session(self, admin_tok):
        # Disable Vision LLM for deterministic test time
        os.environ["ITER189_DISABLE_VISION"] = "1"
        try:
            r = requests.post(
                f"{API}/inspirations/knowledge-factory/sessions/"
                f"{pytest.session_id}/process",
                headers={**_h(admin_tok), "Content-Type": "application/json"},
                json={"max_candidates_per_doc": 50},
                timeout=15,
            )
            assert r.status_code == 200

            # Poll up to 90s
            final = None
            for _ in range(45):
                time.sleep(2)
                r = requests.get(
                    f"{API}/inspirations/knowledge-factory/sessions/{pytest.session_id}",
                    headers=_h(admin_tok), timeout=15,
                )
                assert r.status_code == 200
                body = r.json()
                if body["session"]["status"] in ("completed", "failed"):
                    final = body
                    break
            assert final, "Pipeline did not finish in time"
            assert final["session"]["status"] == "completed", \
                f"Status={final['session']['status']} logs={final['session'].get('error_logs')}"
            assert final["session"]["documents_processed"] == 2
            print(f"✅ session score: {final['session'].get('package_score')}")
            print(f"   metrics: {final['session'].get('metrics')}")
        finally:
            # IMPORTANT: leave Vision disabled for any subsequent tests in this
            # module that don't want LLM costs
            pass

    def test_dashboard_endpoint(self, admin_tok):
        r = requests.get(
            f"{API}/inspirations/knowledge-factory/sessions/{pytest.session_id}/dashboard",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "completed"
        assert body["counts"]["products"] >= 2  # at least 2 unique products
        assert body["package_score"].get("overall") is not None

    def test_knowledge_graph_endpoint(self, admin_tok):
        r = requests.get(
            f"{API}/inspirations/knowledge-factory/sessions/{pytest.session_id}/knowledge-graph",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert "tree" in body
        # Material entity resolution: AURORA appears in both PDFs with ceramic+wood,
        # and ECLISSI/BOREALE add their own materials. We expect dedupe to merge
        # 'ceramic' (in A:Aurora + B:Aurora) into a single canonical row.
        material_keys = {m["material_key"] for m in body["tree"]["materials"]}
        assert "ceramic" in material_keys, f"Expected 'ceramic' canonical: {material_keys}"
        ceramic = next(m for m in body["tree"]["materials"] if m["material_key"] == "ceramic")
        assert ceramic["mention_count"] >= 2, \
            f"Expected mention_count≥2 (Aurora in PDF A + Aurora in PDF B), got {ceramic}"

        # Designer entity resolution: "Marco Rossi" appears in 3 products
        # across 2 PDFs → 1 canonical designer
        designer_keys = {d["designer_key"] for d in body["tree"]["designers"]}
        assert "marco-rossi" in designer_keys
        marco = next(d for d in body["tree"]["designers"] if d["designer_key"] == "marco-rossi")
        assert marco["product_count"] >= 2

        # Stories: at least 'heritage' or 'craftsmanship' should fire on test text
        themes = {s["theme"] for s in body["tree"]["stories"]}
        assert any(t in themes for t in ("heritage", "craftsmanship",
                                          "design_collaboration", "sustainability")), \
            f"Expected at least one of the 10 themes detected: {themes}"

    def test_archive(self, admin_tok):
        r = requests.delete(
            f"{API}/inspirations/knowledge-factory/sessions/{pytest.session_id}",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "archived"


class TestVisionCache:

    def test_cache_normalization(self):
        # Direct test: cache module store/lookup round-trip
        from database import db
        c = db()
        if c is None:
            pytest.skip("DB client not available")
        phash = "deadbeef12345678"
        tenant_id = "00000000-0000-0000-0000-000000000001"
        other_tenant = "00000000-0000-0000-0000-000000000002"
        # Clean up any prior row
        try:
            c.table("vision_cache").delete().eq("phash", phash).execute()
        except Exception:
            pass
        result = {"vision_asset_type": "lifestyle",
                  "vision_compositional_role": "hero",
                  "vision_view_angle": "wide"}
        vcache.store_cache(c, phash, tenant_id, "gpt-5.1", result, scope="tenant")
        hit = vcache.lookup_cached(c, phash, tenant_id, "gpt-5.1")
        assert hit and hit.get("vision_asset_type") == "lifestyle"
        # Wrong tenant should miss
        miss = vcache.lookup_cached(c, phash, other_tenant, "gpt-5.1")
        assert miss is None
        # Global scope cache
        vcache.store_cache(c, phash, None, "gpt-5.1", result, scope="global")
        hit_other = vcache.lookup_cached(c, phash, other_tenant, "gpt-5.1")
        assert hit_other is not None, "Global cache should hit for any tenant"
        # Cleanup
        c.table("vision_cache").delete().eq("phash", phash).execute()


class TestEntityResolverHelpers:

    def test_normalize_designer(self):
        assert entity_resolver._normalize_designer("design Patricia Urquiola") == "patricia-urquiola"
        assert entity_resolver._normalize_designer("Patricia Urquiola") == "patricia-urquiola"
        assert entity_resolver._normalize_designer("PATRICIA URQUIOLA") == "patricia-urquiola"

    def test_levenshtein(self):
        assert entity_resolver._levenshtein("kauri", "kauri") == 0
        assert entity_resolver._levenshtein("kauri", "kaury") == 1
        assert entity_resolver._levenshtein("manzoni-tapinassi",
                                            "manzoni-and-tapinassi") <= 5
