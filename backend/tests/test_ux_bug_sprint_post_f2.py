"""
Post-F.2 UX Bug Sprint — Backend regression for batch-insert apply_template.

Validates:
  - POST /api/templates/{id}/apply on Luxury (8 pages) completes well under
    the previous 30s axios timeout (target <5s) using batch inserts.
  - Response shape: 201 + template_slug + blocks_count
  - Cloned pages: count, sort_order preserved
  - Cloned blocks: scoped to the correct page_id via page_id_map; placeholder
    metadata carried into metadata_json.placeholder
  - landing/current_page_id is the FIRST cloned page (page_id_map order)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}
LUX_TPL = "22222222-0000-0000-0000-000000000001"   # 8-page structural
HOSP_TPL = "22222222-0000-0000-0000-000000000002"  # 6-page structural


def _login(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    tok = (body.get("session") or {}).get("access_token") \
        or body.get("access_token") or body.get("token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def designer():
    return _login(DESIGNER)


class TestApplyTemplateBatchInsertPerf:
    """The user-reported bug: apply_template was inserting blocks one-by-one
    causing 30s+ frontend timeouts. Backend now batches both pages and blocks."""

    def test_luxury_apply_completes_quickly(self, designer):
        title = f"TEST_UX_BatchPerf_{uuid.uuid4().hex[:8]}"
        t0 = time.perf_counter()
        r = designer.post(
            f"{BASE_URL}/api/templates/{LUX_TPL}/apply",
            json={"title": title},
            timeout=15,
        )
        elapsed = time.perf_counter() - t0
        assert r.status_code == 201, f"apply failed: {r.status_code} {r.text[:400]}"
        data = r.json()
        assert data.get("title") == title
        assert data.get("template_slug"), f"missing template_slug: {data}"
        assert isinstance(data.get("blocks_count"), int) and data["blocks_count"] > 0
        assert elapsed < 8.0, f"apply_template took {elapsed:.2f}s (target <5s, hard cap 8s)"
        print(f"\nLuxury apply elapsed={elapsed:.2f}s blocks_count={data['blocks_count']}")
        # stash for downstream tests
        TestApplyTemplateBatchInsertPerf.last_id = data["id"]
        TestApplyTemplateBatchInsertPerf.last_blocks = data["blocks_count"]

    def test_luxury_apply_pages_and_landing(self, designer):
        mb_id = getattr(TestApplyTemplateBatchInsertPerf, "last_id", None)
        assert mb_id, "previous test must have run"
        # Verify moodboard has current_page_id pointing to first cloned page
        r = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)
        assert r.status_code == 200, r.text[:300]
        mb = r.json()
        current_page_id = mb.get("current_page_id")
        assert current_page_id, f"no current_page_id: {mb}"

        # List pages — must be 8 with sort_order preserved
        rp = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}/pages", timeout=20)
        assert rp.status_code == 200, rp.text[:300]
        pages_payload = rp.json()
        pages = pages_payload if isinstance(pages_payload, list) \
            else (pages_payload.get("data") or pages_payload.get("pages") or [])
        assert len(pages) == 8, f"expected 8 pages, got {len(pages)}"
        # sorted ascending by sort_order
        orders = [p.get("sort_order", 0) for p in pages]
        assert orders == sorted(orders), f"page sort_order not ascending: {orders}"
        # First page = current_page_id (landing)
        assert pages[0]["id"] == current_page_id, \
            f"landing page mismatch: first={pages[0]['id']} current={current_page_id}"

    def test_luxury_apply_blocks_scoped_to_pages(self, designer):
        mb_id = getattr(TestApplyTemplateBatchInsertPerf, "last_id", None)
        assert mb_id
        # Moodboard detail bundles blocks
        rb = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)
        assert rb.status_code == 200, rb.text[:300]
        mb = rb.json()
        blocks = mb.get("blocks") or mb.get("elements") or []
        assert blocks, f"no blocks returned in detail: keys={list(mb.keys())}"
        # every block has a page_id
        no_page = [b["id"] for b in blocks if not b.get("page_id")]
        assert not no_page, f"blocks without page_id: {no_page[:5]}"
        # page_ids set should be subset of moodboard pages
        rp = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}/pages", timeout=20)
        page_payload = rp.json()
        pages = page_payload if isinstance(page_payload, list) \
            else (page_payload.get("data") or page_payload.get("pages") or [])
        valid_page_ids = {p["id"] for p in pages}
        bad = [b["id"] for b in blocks if b["page_id"] not in valid_page_ids]
        assert not bad, f"blocks pointing to unknown page_ids: {bad[:5]}"
        # at least one block has placeholder metadata (Luxury template has them)
        with_placeholder = [
            b for b in blocks
            if isinstance(b.get("metadata") or b.get("metadata_json"), dict)
            and (b.get("metadata") or b.get("metadata_json") or {}).get("placeholder")
        ]
        assert with_placeholder, "expected at least one placeholder-tagged block"

    def test_hospitality_apply_also_batches(self, designer):
        title = f"TEST_UX_BatchPerf_Hosp_{uuid.uuid4().hex[:8]}"
        t0 = time.perf_counter()
        r = designer.post(
            f"{BASE_URL}/api/templates/{HOSP_TPL}/apply",
            json={"title": title},
            timeout=15,
        )
        elapsed = time.perf_counter() - t0
        assert r.status_code == 201, r.text[:300]
        data = r.json()
        assert data.get("template_slug")
        assert data.get("blocks_count", 0) > 0
        assert elapsed < 8.0, f"Hospitality apply took {elapsed:.2f}s (target <5s)"
        print(f"\nHospitality apply elapsed={elapsed:.2f}s blocks_count={data['blocks_count']}")


class TestInjectTemplateStillWorks:
    """Regression — inject_template_into_moodboard wasn't changed by this sprint
    but lives in the same file. Make sure it still appends pages."""

    def test_inject_appends_pages_at_end(self, designer):
        # Create a target moodboard from a single-page template (to keep
        # things small), then inject Hospitality (6 pages) at end.
        seed = designer.post(
            f"{BASE_URL}/api/templates/22222222-0000-0000-0000-000000000003/apply",
            json={"title": f"TEST_UX_InjectSeed_{uuid.uuid4().hex[:8]}"},
            timeout=15,
        )
        assert seed.status_code == 201, seed.text[:300]
        mb_id = seed.json()["id"]
        rp = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}/pages", timeout=20)
        before = rp.json() if isinstance(rp.json(), list) \
            else (rp.json().get("data") or rp.json().get("pages") or [])
        count_before = len(before)

        inj = designer.post(
            f"{BASE_URL}/api/templates/inject-into/{mb_id}",
            json={"template_id": HOSP_TPL},
            timeout=15,
        )
        assert inj.status_code == 201, inj.text[:400]

        rp2 = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}/pages", timeout=20)
        after_payload = rp2.json()
        after = after_payload if isinstance(after_payload, list) \
            else (after_payload.get("data") or after_payload.get("pages") or [])
        assert len(after) == count_before + 6, \
            f"expected {count_before + 6} pages after inject, got {len(after)}"
        orders = [p.get("sort_order", 0) for p in after]
        assert orders == sorted(orders), f"sort_order not preserved after inject: {orders}"
