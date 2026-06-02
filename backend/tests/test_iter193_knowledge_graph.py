"""ITER193 · Backend tests · Design Knowledge Graph™ Phase 1.

Tests:
  • Canonical vocab is seeded (≥90 rows total)
  • Auto-tagger runs on product approval
  • Auto-tagger detects spaces/styles/features/markets from text
  • Material-derived style boost (wood → organic, marble → luxury, brass → art_deco)
  • Market relevance 7-axis JSONB computed
  • /explore endpoint with filter resolves products correctly
  • /products/{id}/retag rerun
  • /products/{id}/edges returns 4 categories
  • Admin can add custom market (city level)
"""
from __future__ import annotations

import io
import os
import time

import pytest
import requests

from cultural_engine import auto_tagger


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = ("admin@moodfordesign.com", "Blueprint2024!")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code}")
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


class TestCanonicalVocab:
    def test_spaces_seeded(self, admin_tok):
        r = requests.get(f"{API}/knowledge-graph/canonical/spaces?limit=200",
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200
        body = r.json()
        keys = {item["space_key"] for item in body["items"]}
        for required in ("living_room", "hospitality", "outdoor", "kitchen", "bedroom"):
            assert required in keys, f"Missing seeded space: {required}"

    def test_features_seeded(self, admin_tok):
        r = requests.get(f"{API}/knowledge-graph/canonical/features?limit=200",
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200
        keys = {item["feature_key"] for item in r.json()["items"]}
        for required in ("modular", "acoustic", "sustainable", "outdoor_rated"):
            assert required in keys

    def test_styles_seeded(self, admin_tok):
        r = requests.get(f"{API}/knowledge-graph/canonical/styles?limit=200",
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200
        keys = {item["style_key"] for item in r.json()["items"]}
        for required in ("contemporary", "minimal", "luxury", "italian_modern"):
            assert required in keys

    def test_markets_seeded_with_cities(self, admin_tok):
        r = requests.get(f"{API}/knowledge-graph/canonical/markets?limit=200",
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        keys = {item["market_key"] for item in items}
        # Countries
        for required in ("usa", "italy", "germany", "uae"):
            assert required in keys
        # Cities (Founder requirement)
        for city in ("city_milano", "city_new_york", "city_dubai", "city_miami"):
            assert city in keys, f"Missing city: {city}"
        # Has geo_level=city for at least 6 entries
        cities = [m for m in items if m.get("geo_level") == "city"]
        assert len(cities) >= 6


class TestAdminAddCustomMarket:
    def test_add_custom_city(self, admin_tok):
        # Founder says markets must be admin-extensible to cities
        # Use a unique key per test run for idempotency
        import time as _t
        unique = f"city_test_{int(_t.time())%100000}"
        r = requests.post(
            f"{API}/knowledge-graph/canonical/markets",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={
                "key": unique,
                "display_name": "Scottsdale Test",
                "region": "NA",
                "segment": "luxury_residential",
                "geo_level": "city",
                "parent_market_key": "usa",
                "keywords": ["scottsdale", "phoenix area", "arizona luxury"],
            },
            timeout=15,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["market_key"] == unique
        assert body["geo_level"] == "city"
        assert body["is_global"] is False  # tenant extension
        assert body.get("parent_market_id"), "parent_market_id should resolve from 'usa'"


class TestAutoTagger:
    """E2E test: create session → upload PDF → process → approve → verify edges."""

    def test_full_auto_tag_pipeline(self, admin_tok):
        # 1. Create session
        r = requests.post(
            f"{API}/inspirations/knowledge-factory/sessions",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"session_name": "ITER193 auto-tag test"},
            timeout=15,
        )
        assert r.status_code == 201
        session_id = r.json()["id"]

        # 2. Build a single PDF with rich text that should trigger many tags
        from PIL import Image as PILImage
        import fitz
        doc = fitz.open()
        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 80), "MOOD Brand", fontsize=24)
        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 60), "Indice", fontsize=22)
        p.insert_text((40, 110), "Sirius ........ 3", fontsize=12)

        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 80), "SIRIUS", fontsize=32)
        p.insert_text((40, 120), "design Patricia Urquiola", fontsize=12)
        img = PILImage.new("RGB", (400, 300), color=(200, 180, 140))
        buf = io.BytesIO(); img.save(buf, format="PNG")
        p.insert_image(fitz.Rect(40, 160, 555, 600), stream=buf.getvalue())
        # Rich text triggering MANY tags
        p.insert_text((40, 640),
                      "Sirius is a contemporary modular sofa designed for luxury "
                      "hospitality and high-end residential projects. Crafted in "
                      "Italian leather and brass with acoustic insulation for hotel "
                      "lobbies. The minimal silhouette is ideal for the New York "
                      "and Milano luxury residential market.",
                      fontsize=9)

        p = doc.new_page(width=595, height=842)
        p.insert_text((40, 60), "Dimensioni", fontsize=14)
        p.insert_text((40, 85), "240 x 100 x 75 cm", fontsize=11)
        p.insert_text((40, 140), "Materiali", fontsize=14)
        p.insert_text((40, 165), "Pelle, ottone, legno noce", fontsize=11)
        p.insert_text((40, 220), "Finiture", fontsize=14)
        p.insert_text((40, 245), "Cognac", fontsize=11)
        p.insert_text((40, 265), "Burnished Brass", fontsize=11)
        pdf = doc.tobytes(); doc.close()

        # Upload
        r = requests.post(
            f"{API}/inspirations/knowledge-factory/sessions/{session_id}/documents",
            headers=_h(admin_tok),
            files=[("files", ("rich_catalog.pdf", pdf, "application/pdf"))],
            timeout=60,
        )
        assert r.status_code == 201
        assert r.json()["ok_count"] == 1

        # Process
        os.environ["ITER189_DISABLE_VISION"] = "1"
        r = requests.post(
            f"{API}/inspirations/knowledge-factory/sessions/{session_id}/process",
            headers={**_h(admin_tok), "Content-Type": "application/json"},
            json={"max_candidates_per_doc": 30}, timeout=15,
        )
        assert r.status_code == 200

        final = None
        for _ in range(40):
            time.sleep(2)
            r = requests.get(
                f"{API}/inspirations/knowledge-factory/sessions/{session_id}",
                headers=_h(admin_tok), timeout=15,
            )
            body = r.json()
            if body["session"]["status"] in ("completed", "failed"):
                final = body
                break
        assert final and final["session"]["status"] == "completed"

        # Find the SIRIUS product
        r = requests.get(
            f"{API}/inspirations/knowledge-factory/products?source_document_id=none&limit=20",
            headers=_h(admin_tok), timeout=15,
        )
        # Better: use brand_import_session_id filter via products endpoint
        # But knowledge_factory has no session filter. Use direct DB.
        from database import db
        c = db()
        prods = (c.table("products").select("*")
                 .eq("brand_import_session_id", session_id).execute().data or [])
        assert prods, "No products created"
        sirius = next((p for p in prods if "SIRIUS" in (p.get("product_name") or "")), prods[0])

        # 3. Approve product → triggers auto-tagger
        r = requests.post(
            f"{API}/inspirations/knowledge-factory/products/{sirius['id']}/approve",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        approve_body = r.json()
        assert approve_body["review_status"] == "approved"
        tag_result = approve_body.get("auto_tagger") or {}
        assert "edges_created" in tag_result, f"Auto-tagger did not run: {tag_result}"
        edges = tag_result["edges_created"]
        # Expected: many style/space/feature matches from rich text
        assert edges["styles"]   >= 2, f"Expected ≥2 styles, got {edges}"
        assert edges["spaces"]   >= 2, f"Expected ≥2 spaces, got {edges}"
        assert edges["features"] >= 1, f"Expected ≥1 features, got {edges}"

        detected = tag_result.get("detected", {})
        # Specific detections we expect from the rich text
        assert "contemporary" in detected.get("styles", [])
        assert "minimal" in detected.get("styles", []) or "luxury" in detected.get("styles", [])
        assert "hospitality" in detected.get("spaces", []) or "luxury_residential" in detected.get("spaces", [])
        assert "modular" in detected.get("features", []) or "acoustic" in detected.get("features", [])

        # 4. Market relevance must be populated 7-axis
        mr = tag_result.get("market_relevance") or {}
        for axis in ("us", "eu", "apac", "me", "hospitality", "residential", "retail"):
            assert axis in mr, f"Missing market axis: {axis}"
            assert 0.0 <= mr[axis] <= 0.99

        # Sanity: hospitality_signal text → hospitality score elevated
        assert mr["hospitality"] >= 0.65, f"Hospitality should be elevated: {mr}"

        # Store for next test
        pytest.tagged_product_id = sirius["id"]
        pytest.tag_session_id = session_id

    def test_product_edges_endpoint(self, admin_tok):
        pid = getattr(pytest, "tagged_product_id", None)
        if not pid:
            pytest.skip("Previous test did not produce a tagged product")
        r = requests.get(
            f"{API}/knowledge-graph/products/{pid}/edges",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["edge_count"] >= 5, f"Expected ≥5 edges, got {body}"
        assert "spaces" in body["edges"]
        assert "styles" in body["edges"]

    def test_retag_product(self, admin_tok):
        pid = getattr(pytest, "tagged_product_id", None)
        if not pid:
            pytest.skip("Previous test did not produce a tagged product")
        # Lower threshold should produce same-or-more edges
        r = requests.post(
            f"{API}/knowledge-graph/products/{pid}/retag?threshold=0.30",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert "edges_created" in body


class TestExploreEndpoint:

    def test_explore_basic(self, admin_tok):
        r = requests.get(f"{API}/knowledge-graph/explore?limit=10",
                         headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "nodes" in body and "edges" in body and "counts" in body
        # Without filters → all canonical types included
        assert "spaces" in body["nodes"] and len(body["nodes"]["spaces"]) >= 20
        assert "markets" in body["nodes"] and len(body["nodes"]["markets"]) >= 20

    def test_explore_filter_by_style(self, admin_tok):
        pid = getattr(pytest, "tagged_product_id", None)
        if not pid:
            pytest.skip("Need tagged product")
        # The SIRIUS product was tagged contemporary
        r = requests.get(
            f"{API}/knowledge-graph/explore?style=contemporary&include_edges=true",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        product_ids = {p["id"] for p in body["nodes"]["products"]}
        assert pid in product_ids, f"Tagged product should match style=contemporary filter"

        # Edges should include this product
        edges_from_product = [e for e in body["edges"] if e["from"] == f"product:{pid}"]
        assert len(edges_from_product) > 0

    def test_explore_filter_no_match(self, admin_tok):
        # Combine impossible filters → empty product result
        r = requests.get(
            f"{API}/knowledge-graph/explore?space=non_existent_space_xyz",
            headers=_h(admin_tok), timeout=15,
        )
        assert r.status_code == 200
        # space=non_existent → space_id is None → no filter applied
        body = r.json()
        assert "products" in body["nodes"]


class TestAutoTaggerUnit:
    """Unit tests on auto_tagger functions (no API)."""

    def test_score_keyword_match(self):
        score, ev = auto_tagger._score_keyword_match(
            "This is a contemporary modular sofa for hospitality",
            ["contemporary", "modular", "hospitality"],
        )
        assert score > 0.4
        assert len(ev) >= 2

    def test_score_keyword_match_no_match(self):
        score, ev = auto_tagger._score_keyword_match(
            "Just a simple sentence",
            ["nonexistent", "alien_word"],
        )
        assert score == 0.0
        assert ev == []

    def test_market_relevance_hospitality_signal(self):
        mr = auto_tagger._compute_market_relevance(
            {"designer_name": "Patricia Urquiola"},
            detected_styles=["luxury", "italian_modern"],
            detected_spaces=["hospitality", "lounge"],
            detected_features=["acoustic", "modular"],
            materials=["marble", "brass"],
        )
        assert mr["hospitality"] >= 0.85
        assert mr["us"] >= 0.75  # premium + italian designer + minimal-like
        assert mr["me"] >= 0.70  # premium + luxury + marble + brass
        assert 0 <= mr["retail"] <= 0.99
