"""Iter87 · /inspirations product_category filter (complemento d'arredo).

Tests:
  • /archive/_filters → dynamic product_categories list with counts
  • /archive?product_category=... → only matching items returned
  • Empty category → still works (defaults all)
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


def test_filters_endpoint_includes_product_categories(token):
    r = requests.get(f"{API}/api/inspirations/archive/_filters",
                     headers=auth(token), timeout=15)
    assert r.status_code == 200
    cfg = r.json()
    assert "product_categories" in cfg
    cats = cfg["product_categories"]
    # Dataset has at least Complementi / Sedie / Letti / Divani / Tavoli
    assert len(cats) >= 3, f"expected at least 3 categories, got {cats}"
    labels = {c["label"] for c in cats}
    assert any(l in labels for l in ["Complementi", "Sedie", "Letti"]), labels
    # Each entry must have count
    for c in cats:
        assert "count" in c and c["count"] > 0


def test_filter_by_complementi_returns_only_that_category(token):
    r = requests.get(f"{API}/api/inspirations/archive",
                     params={"product_category": "Complementi", "limit": 30},
                     headers=auth(token), timeout=20)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) > 0, "Complementi category should have items"
    for i in items:
        assert i.get("product_category") == "Complementi", \
            f"non-complementi leaked: {i.get('product_name')} cat={i.get('product_category')}"


def test_filter_by_sedie_returns_only_chairs(token):
    r = requests.get(f"{API}/api/inspirations/archive",
                     params={"product_category": "Sedie", "limit": 30},
                     headers=auth(token), timeout=20)
    items = r.json()["items"]
    assert len(items) > 0
    for i in items:
        assert (i.get("product_category") or "").lower() == "sedie"


def test_filter_no_category_returns_all_types(token):
    r = requests.get(f"{API}/api/inspirations/archive",
                     params={"limit": 60},
                     headers=auth(token), timeout=20)
    items = r.json()["items"]
    # Without category filter, mix of editorial + product should appear
    types = {i.get("inspiration_type") for i in items}
    assert types & {"editorial", "product"}, f"missing both types: {types}"


def test_filter_category_combined_with_type_product(token):
    r = requests.get(f"{API}/api/inspirations/archive",
                     params={"inspiration_type": "product",
                             "product_category": "Letti", "limit": 30},
                     headers=auth(token), timeout=20)
    items = r.json()["items"]
    assert len(items) > 0
    for i in items:
        assert i.get("inspiration_type") == "product"
        assert i.get("product_category") == "Letti"
