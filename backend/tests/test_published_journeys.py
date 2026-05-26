"""ITER157.B · Published Design Journeys™ smoke test."""
import os, requests, pytest

API = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
if not API.endswith("/api"):
    API = API.rstrip("/") + "/api"


def test_public_feed_returns_published_items():
    r = requests.get(f"{API}/public/published-journeys/studio/feed",
                     params={"locale": "it-IT"}, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["tenant"] == "studio"
    assert body["locale"] == "it-IT"
    assert body["count"] >= 1
    titles = [it["title"] for it in body["items"]]
    assert "Lugano Lake House" in titles


def test_locale_resolution_en_us():
    r = requests.get(f"{API}/public/published-journeys/studio/feed",
                     params={"locale": "en-US"}, timeout=10)
    assert r.status_code == 200
    items = r.json().get("items", [])
    if items:
        lugano = next((i for i in items if i["title"] == "Lugano Lake House"), None)
        assert lugano is not None
        assert "Lake Lugano" in (lugano.get("excerpt") or "") \
            or "lake" in (lugano.get("excerpt") or "").lower()


def test_detail_by_slug():
    r = requests.get(f"{API}/public/published-journeys/studio/lugano-lake-house",
                     params={"locale": "it-IT"}, timeout=10)
    assert r.status_code == 200
    item = r.json()["item"]
    assert item["slug"] == "lugano-lake-house"
    assert item["location"] == "Lugano, CH"


def test_empty_state_for_unknown_tenant():
    r = requests.get(f"{API}/public/published-journeys/__not_a_tenant__/feed",
                     timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0
    assert body["items"] == []
