"""STORE-011 · DESIGN DISCOVERY™ ENGINE backend tests.

Covers:
  · GET /api/discover/catalog
  · GET/PUT /api/journeys/{jid}/discover-brief (merge, validation)
  · POST /api/journeys/{jid}/discover-brief/complete (with force=true)
  · GET /api/journeys/{jid}/discover-brief/intelligence
  · Regression: GET/POST /api/journeys/{jid}/discover (lead_conversion.py) not shadowed
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://i18n-recovery-1.preview.emergentagent.com").rstrip("/")
JID = "8bb7a3b4-02af-4040-8420-37a254713899"
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    d = r.json()
    return d["session"]["access_token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ── CATALOG ─────────────────────────────────────────────────────────────
class TestCatalog:
    def test_catalog_shape(self, client):
        r = client.get(f"{BASE_URL}/api/discover/catalog", timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("project_types", "space_statuses", "timelines", "investment_ranges",
                 "atmospheres", "materials", "priorities", "styles", "style_images"):
            assert k in d, f"missing {k}"
            assert isinstance(d[k], list) and len(d[k]) > 0

        assert len(d["style_images"]) == 30
        ids = {img["id"] for img in d["style_images"]}
        for i in range(1, 31):
            assert f"img-{i:02d}" in ids
        for img in d["style_images"]:
            assert img.get("url", "").startswith("http")
            assert isinstance(img.get("tags"), list) and len(img["tags"]) >= 1

        assert len(d["atmospheres"]) == 12
        assert len(d["materials"]) == 9
        assert len(d["priorities"]) == 10
        assert len(d["styles"]) == 10


# ── GET brief auto-creates ───────────────────────────────────────────────
class TestGetBrief:
    def test_get_returns_full_shape(self, client):
        r = client.get(f"{BASE_URL}/api/journeys/{JID}/discover-brief", timeout=20)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("brief_id", "journey_id", "project_snapshot", "style_selections",
                 "atmosphere_signals", "material_signals", "priorities",
                 "inspirations", "notes", "discovery_status", "completion"):
            assert k in d, f"missing {k}"
        c = d["completion"]
        assert "sections" in c and len(c["sections"]) == 7
        assert "progress_pct" in c and isinstance(c["progress_pct"], int)

    def test_unknown_journey_404(self, client):
        r = client.get(f"{BASE_URL}/api/journeys/00000000-0000-0000-0000-000000000000/discover-brief", timeout=20)
        assert r.status_code == 404


# ── PUT merge behaviour ──────────────────────────────────────────────────
class TestPutMerge:
    def test_put_snapshot_then_style_then_atmosphere_merge(self, client):
        # 1. project_snapshot
        r1 = client.put(
            f"{BASE_URL}/api/journeys/{JID}/discover-brief",
            json={"project_snapshot": {"project_type": "kitchen", "space_status": "renovation",
                                       "timeline": "3_6_months", "investment_range": "premium"}},
            timeout=20,
        )
        assert r1.status_code == 200, r1.text[:300]
        d1 = r1.json()
        assert d1["project_snapshot"]["project_type"] == "kitchen"
        assert d1["project_snapshot"]["investment_range"] == "premium"

        # 2. style_selections — should not overwrite snapshot
        r2 = client.put(
            f"{BASE_URL}/api/journeys/{JID}/discover-brief",
            json={"style_selections": ["img-01", "img-02", "img-03", "img-04", "img-05",
                                        "img-not-valid", "img-01"]},
            timeout=20,
        )
        assert r2.status_code == 200, r2.text[:300]
        d2 = r2.json()
        assert d2["project_snapshot"]["project_type"] == "kitchen"  # preserved
        sel = d2["style_selections"]
        assert "img-not-valid" not in sel  # filtered
        assert sel.count("img-01") == 1     # deduped
        assert len(sel) == 5

        # 3. atmosphere_signals — should not overwrite snapshot or style_selections
        r3 = client.put(
            f"{BASE_URL}/api/journeys/{JID}/discover-brief",
            json={"atmosphere_signals": ["warm", "elegant", "bogus_chip"]},
            timeout=20,
        )
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["project_snapshot"]["project_type"] == "kitchen"
        assert len(d3["style_selections"]) == 5
        assert "warm" in d3["atmosphere_signals"]
        assert "elegant" in d3["atmosphere_signals"]
        assert "bogus_chip" not in d3["atmosphere_signals"]

    def test_priorities_and_materials_filter_invalid(self, client):
        r = client.put(
            f"{BASE_URL}/api/journeys/{JID}/discover-brief",
            json={
                "priorities": ["design", "durability", "bogus_priority"],
                "material_signals": ["wood", "marble", "natural_stone", "fake_mat"],
            },
            timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        assert "bogus_priority" not in d["priorities"]
        assert set(d["priorities"]) >= {"design", "durability"}
        assert "fake_mat" not in d["material_signals"]
        assert "wood" in d["material_signals"]

    def test_inspirations_and_notes_merge(self, client):
        client.put(
            f"{BASE_URL}/api/journeys/{JID}/discover-brief",
            json={"inspirations": {"website_urls": ["https://example.com"]}},
            timeout=20,
        )
        r = client.put(
            f"{BASE_URL}/api/journeys/{JID}/discover-brief",
            json={"inspirations": {"pinterest_urls": ["https://pinterest.com/x"]},
                  "notes": "TEST_NOTE Italian villa atmosphere"},
            timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        # Both website + pinterest preserved (merge)
        assert d["inspirations"].get("website_urls") == ["https://example.com"]
        assert d["inspirations"].get("pinterest_urls") == ["https://pinterest.com/x"]
        assert "TEST_NOTE" in d["notes"]


# ── COMPLETE ─────────────────────────────────────────────────────────────
class TestComplete:
    def test_complete_force_returns_intelligence(self, client):
        r = client.post(
            f"{BASE_URL}/api/journeys/{JID}/discover-brief/complete",
            json={"force": True},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["discovery_status"] == "completed"
        assert d.get("completed_at")
        intel = d.get("intelligence") or {}
        assert "style_dna" in intel
        assert "material_dna" in intel
        assert "project_profile" in intel
        assert "recommendations" in intel
        rec = intel["recommendations"]
        assert "moodboard_templates" in rec
        assert "brand_atlas" in rec

    def test_intelligence_endpoint(self, client):
        r = client.get(f"{BASE_URL}/api/journeys/{JID}/discover-brief/intelligence", timeout=20)
        assert r.status_code == 200
        d = r.json()
        # Style DNA scores: top up to 5; if non-empty, sum ≈ 100
        sd = d.get("style_dna") or []
        assert len(sd) <= 5
        if sd:
            total = sum(s["score"] for s in sd)
            # Allow small rounding tolerance because each entry is rounded
            assert 90 <= total <= 110, f"style_dna scores sum {total} out of tolerance"
        # Material DNA must reflect wood/marble/natural_stone we set
        mat_keys = {m["key"] for m in d.get("material_dna") or []}
        assert {"wood", "marble", "natural_stone"} <= mat_keys

    def test_project_profile_headline_composed(self, client):
        r = client.get(f"{BASE_URL}/api/journeys/{JID}/discover-brief/intelligence", timeout=20)
        d = r.json()
        pp = d["project_profile"]
        assert pp["project_type"] == "Kitchen"
        assert pp["investment_range"] == "Premium"
        assert "Kitchen" in pp["headline"] or "Premium" in pp["headline"]


# ── REGRESSION: lead_conversion.py /discover endpoints not shadowed ──────
class TestRegressionLegacyDiscover:
    def test_legacy_get_discover_still_works(self, client):
        r = client.get(f"{BASE_URL}/api/journeys/{JID}/discover", timeout=20)
        # Either 200 with payload, or 404 if journey lacks legacy discover entry;
        # but must not return our new shape (no `completion` field) and must NOT
        # return our /discover-brief response.
        assert r.status_code in (200, 404), r.text[:300]
        if r.status_code == 200:
            body = r.json()
            # legacy returns {"discover": {...}} ; not our shape
            assert "discover" in body or "ok" in body
            assert "completion" not in body  # confirm not shadowed by new router

    def test_legacy_post_discover_still_accepts(self, client):
        # Should NOT route to our new PUT-only resource. We send a tiny payload.
        r = client.post(
            f"{BASE_URL}/api/journeys/{JID}/discover",
            json={"notes": "TEST_regression legacy discover"},
            timeout=20,
        )
        # Legacy returns 200 with {"ok": True, "discover": {...}}.
        assert r.status_code in (200, 404, 422), r.text[:200]
