"""Phase V — Adaptive Onboarding Engine backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ENDPOINT = f"{BASE_URL}/api/onboarding/briefing-summary"


class TestBriefingSummary:
    """POST /api/onboarding/briefing-summary"""

    def test_anonymous_access_no_auth(self):
        """Endpoint must be anonymous (no auth header)."""
        body = {
            "payload": {
                "project_type": "office",
                "project_category": "commercial",
                "briefing_shape": {
                    "project_category": "commercial",
                    "spaces": ["Meeting rooms", "Open workspace"],
                    "stylistic_direction": ["minimal"],
                    "materials_priority": ["wood"],
                    "palette_priority": ["warm-neutral"],
                    "emotional_tone": "focused",
                    "complexity_hint": "mid",
                },
                "moods": ["minimal"],
            },
            "locale": "en",
        }
        r = requests.post(ENDPOINT, json=body, timeout=60)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "briefing" in data
        b = data["briefing"]
        # Required keys per spec
        for k in (
            "project_intent",
            "project_category",
            "stylistic_direction",
            "priorities",
            "emotional_tone",
            "complexity_hint",
            "briefing_summary",
            "source",
        ):
            assert k in b, f"missing key '{k}' in briefing: {b}"
        # Critical spec: project_category must be 'commercial'
        assert b["project_category"] == "commercial", (
            f"expected commercial, got {b['project_category']}"
        )
        # source must be 'ai' or 'fallback'
        assert b["source"] in ("ai", "fallback"), f"unexpected source: {b['source']}"
        print(f"[briefing_commercial] source={b['source']} category={b['project_category']}")

    def test_residential_category(self):
        body = {
            "payload": {
                "project_type": "apartment",
                "project_category": "residential",
                "briefing_shape": {
                    "project_category": "residential",
                    "spaces": ["Living room", "Kitchen"],
                    "stylistic_direction": ["modern"],
                    "complexity_hint": "focused",
                },
            },
            "locale": "en",
        }
        r = requests.post(ENDPOINT, json=body, timeout=60)
        assert r.status_code == 200
        b = r.json()["briefing"]
        assert b["project_category"] == "residential"

    def test_hospitality_category(self):
        body = {
            "payload": {
                "project_type": "boutique_hotel",
                "project_category": "hospitality",
                "briefing_shape": {
                    "project_category": "hospitality",
                    "spaces": ["Suites / Rooms", "Lobby / Reception", "Spa / Wellness"],
                    "stylistic_direction": ["luxurious"],
                    "complexity_hint": "multi-area",
                },
            },
            "locale": "en",
        }
        r = requests.post(ENDPOINT, json=body, timeout=60)
        assert r.status_code == 200
        b = r.json()["briefing"]
        assert b["project_category"] == "hospitality"

    def test_empty_payload_fallback(self):
        """No briefing_shape → still returns a valid fallback shape."""
        r = requests.post(ENDPOINT, json={"payload": {}, "locale": "it"}, timeout=60)
        assert r.status_code == 200
        b = r.json()["briefing"]
        assert b["project_category"] == "other"
        assert b["complexity_hint"] in ("focused", "mid", "multi-area")
