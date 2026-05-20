"""Sprint D3 · Brand Mode™ — atlante curatoriale endpoints.

Tests:
  • GET /api/inspirations/registry/brands-atlas       → enriched cards
  • GET /api/inspirations/registry/brands/{id}/curatorial-profile
       → testual curatorial_insights (NOT analytics) + dominants
"""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent.parent / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOGIN = "demo@moodfordesign.com"
PWD   = "Blueprint2024!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/api/auth/login", json={"email": LOGIN, "password": PWD}, timeout=20)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


# ── Brand Atlas list ─────────────────────────────────────────────
class TestBrandsAtlas:
    def test_atlas_returns_enriched_cards(self, token):
        r = requests.get(f"{API}/api/inspirations/registry/brands-atlas?limit=30",
                         headers=auth(token), timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 5, "atlante deve contenere almeno alcuni produttori curated"
        # Each card must have enrichment fields
        for b in items[:5]:
            assert "collections_count" in b
            assert "inspirations_count" in b
            assert "products_count" in b
            assert "dominant_atmospheres" in b
            assert "dominant_materials" in b

    def test_atlas_search_q(self, token):
        r = requests.get(f"{API}/api/inspirations/registry/brands-atlas?q=bonaldo",
                         headers=auth(token), timeout=20)
        items = r.json()["items"]
        # If Bonaldo exists in curated_public + tenant import, must appear
        names = [b["name"].lower() for b in items]
        assert any("bonaldo" in n for n in names), f"q=bonaldo dovrebbe matchare; got {names}"

    def test_bonaldo_has_product_aggregations(self, token):
        r = requests.get(f"{API}/api/inspirations/registry/brands-atlas?q=bonaldo",
                         headers=auth(token), timeout=20)
        items = r.json()["items"]
        bonaldo = next((b for b in items if "bonaldo" in (b["name"] or "").lower()), None)
        assert bonaldo, "Bonaldo not found in tenant"
        # Bonaldo has Supplier Catalog Import seed → 57 products with atmospheres
        assert bonaldo["products_count"] > 0
        assert len(bonaldo["dominant_atmospheres"]) > 0
        assert len(bonaldo["dominant_materials"]) > 0


# ── Brand Curatorial Profile ─────────────────────────────────────
class TestCuratorialProfile:
    def test_profile_404_for_missing(self, token):
        r = requests.get(f"{API}/api/inspirations/registry/brands/00000000-0000-0000-0000-000000000000/curatorial-profile",
                         headers=auth(token), timeout=15)
        assert r.status_code == 404

    def test_profile_shape_full(self, token):
        # Pick Bonaldo
        atlas = requests.get(f"{API}/api/inspirations/registry/brands-atlas?q=bonaldo",
                             headers=auth(token), timeout=20).json()["items"]
        bonaldo = next((b for b in atlas if "bonaldo" in b["name"].lower()), None)
        assert bonaldo, "Bonaldo prerequisite missing"

        r = requests.get(f"{API}/api/inspirations/registry/brands/{bonaldo['id']}/curatorial-profile",
                         headers=auth(token), timeout=20)
        assert r.status_code == 200
        p = r.json()
        # Schema
        assert "brand" in p and "collections" in p
        assert "curatorial_insights" in p
        assert "dominant_atmospheres" in p
        assert "dominant_materials" in p
        assert "dominant_markets" in p
        assert "counts" in p
        # Insights are TEXTUAL (>= 1 sentence each)
        for ins in p["curatorial_insights"]:
            assert isinstance(ins, str)
            assert len(ins) > 40, f"insight too short / not editorial: {ins}"
        # Italian editorial language: no forbidden English jargon
        joined = " ".join(p["curatorial_insights"]).lower()
        for bad in ["dashboard", "kpi", "engagement", "leaderboard", "score",
                    "analytics", "ai insights", "vendor"]:
            assert bad not in joined, f"forbidden jargon '{bad}' in insights: {joined}"

    def test_profile_for_brand_without_data(self, token):
        # A brand with 0 products / 0 inspirations should still return a profile
        # with the "in costruzione" fallback insight.
        atlas = requests.get(f"{API}/api/inspirations/registry/brands-atlas?limit=60",
                             headers=auth(token), timeout=20).json()["items"]
        empty_brand = next((b for b in atlas
                            if b["products_count"] == 0 and b["inspirations_count"] == 0
                            and b["collections_count"] == 0), None)
        if not empty_brand:
            pytest.skip("No empty-state brand in this tenant")
        r = requests.get(f"{API}/api/inspirations/registry/brands/{empty_brand['id']}/curatorial-profile",
                         headers=auth(token), timeout=20)
        assert r.status_code == 200
        p = r.json()
        # Must include the editorial fallback insight
        joined = " ".join(p["curatorial_insights"]).lower()
        assert "lettura curatoriale" in joined or "atlante" in joined or "produttore" in joined, joined
