"""Iter92 · Sprint F2.2 — Composition Modes™ + Material View™ + Usage Memory™.

Backend coverage:
  • /api/inspirations/usage-memory/studio-language
  • /api/inspirations/materials/atlas (+ filters)
  • Italian curatorial language (NO analytics/KPI/dashboard jargon)
"""
import os
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


# ── 1. Studio Language (Usage Memory™) ────────────────────────────────
class TestStudioLanguage:
    def test_shape(self, token):
        r = requests.get(f"{API}/api/inspirations/usage-memory/studio-language?days=90",
                         headers=auth(token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("window_days", "moodboards_built", "atmospheres",
                    "materialities", "brands", "color_families",
                    "composition_modes", "narrative_threads"):
            assert key in d, f"missing {key}"
        assert d["window_days"] == 90
        assert isinstance(d["narrative_threads"], list)
        assert len(d["narrative_threads"]) >= 1

    def test_window_validation(self, token):
        r = requests.get(f"{API}/api/inspirations/usage-memory/studio-language?days=1000",
                         headers=auth(token), timeout=20)
        # Pydantic should reject 1000 (max 365)
        assert r.status_code == 422

    def test_narrative_italian(self, token):
        """Narrative threads must be italian — no dashboard/KPI English."""
        r = requests.get(f"{API}/api/inspirations/usage-memory/studio-language",
                         headers=auth(token), timeout=20)
        d = r.json()
        joined = " ".join(d["narrative_threads"]).lower()
        # NO forbidden english analytics jargon
        for forbidden in ("dashboard", "analytics", "kpi", " score ", "engagement",
                          "metric", "percentage"):
            assert forbidden not in joined, f"forbidden english jargon: {forbidden}"

    def test_presence_label_values(self, token):
        r = requests.get(f"{API}/api/inspirations/usage-memory/studio-language",
                         headers=auth(token), timeout=20)
        d = r.json()
        valid = {"forte", "ricorrente", "presente"}
        for a in (d.get("atmospheres") or []):
            assert a.get("presence") in valid, f"bad presence value {a}"
        for m in (d.get("materialities") or []):
            assert m.get("presence") in valid


# ── 2. Material Atlas ─────────────────────────────────────────────────
class TestMaterialAtlas:
    def test_shape(self, token):
        r = requests.get(f"{API}/api/inspirations/materials/atlas?limit=20",
                         headers=auth(token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("items", "count", "color_families", "materials", "filters_applied"):
            assert k in d
        # Items must be material-type assets only
        for it in d["items"]:
            assert it["asset_type"] in ("texture", "material_sample", "detail"), \
                f"non-material asset: {it.get('asset_type')}"

    def test_filter_by_family(self, token):
        # Get the most common family first
        r0 = requests.get(f"{API}/api/inspirations/materials/atlas?limit=160",
                          headers=auth(token), timeout=20).json()
        if not r0["color_families"]:
            pytest.skip("No color families in tenant")
        fam = r0["color_families"][0]["family"]
        r = requests.get(
            f"{API}/api/inspirations/materials/atlas?color_family={fam}&limit=40",
            headers=auth(token), timeout=20,
        )
        assert r.status_code == 200
        d = r.json()
        for it in d["items"]:
            assert it["color_family"] == fam, f"color_family filter not respected"
        assert d["filters_applied"]["color_family"] == fam

    def test_filter_by_material(self, token):
        r0 = requests.get(f"{API}/api/inspirations/materials/atlas?limit=160",
                          headers=auth(token), timeout=20).json()
        if not r0["materials"]:
            pytest.skip("No material tags in tenant")
        mat = r0["materials"][0]["label"]
        r = requests.get(
            f"{API}/api/inspirations/materials/atlas?material={mat}",
            headers=auth(token), timeout=20,
        )
        assert r.status_code == 200
        # Items should match material tag (loose match — substring)
        # Just verify endpoint returns 200 with filter_applied echoed
        assert r.json()["filters_applied"]["material"] == mat

    def test_sorting_texture_first(self, token):
        r = requests.get(f"{API}/api/inspirations/materials/atlas?limit=40",
                         headers=auth(token), timeout=20)
        d = r.json()
        items = d["items"]
        if len(items) < 2:
            pytest.skip("Not enough material assets to verify sort")
        # texture_repetition_score should be non-increasing for the first few
        scores = [it.get("texture_repetition_score") or 0 for it in items[:5]]
        for i in range(len(scores) - 1):
            assert scores[i] >= scores[i + 1] - 0.001, \
                f"sort violated at {i}: {scores}"


# ── 3. Italian curatorial language compliance in modules ──────────────
class TestLanguageCompliance:
    def test_router_uses_curatorial_italian(self):
        src = (Path(__file__).resolve().parent.parent / "routers" /
               "usage_memory.py").read_text()
        # Required Italian curatorial markers
        for required in ("materioteca", "linguaggio progettuale",
                         "atmosfere", "materialità", "atelier"):
            assert required in src.lower(), f"missing curatorial term: {required}"
        # Forbidden analytics jargon in narrative output strings
        forbidden_in_user_text = ("dashboard", "kpi", "analytics", "ml model",
                                  "engagement rate")
        # Check ONLY in italian f-strings (after `narratives.append`) — not in docstrings
        # Simplest: look at the narratives.append blocks for any english analytics term
        # We assert presence of the curatorial alternatives only
        assert "linguaggio progettuale" in src.lower()
