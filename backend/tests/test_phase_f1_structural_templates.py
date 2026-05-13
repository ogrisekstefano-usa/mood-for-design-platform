"""
Phase F.1 — Structural Multi-page Templates backend regression.

Covers:
  - GET /api/templates returns all 13 templates with `page_count`
  - GET /api/templates/{id} for structural template returns pages_preview carousel
  - POST /api/templates/{id}/apply (structural): N pages cloned, blocks scoped
    to correct page_id, placeholder metadata propagated via metadata_json.placeholder
  - POST /api/templates/from-moodboard/{id} snapshots multi-page (pages + blocks
    linked to template_page_id, placeholder fields stored on template_blocks)
  - Cross-tenant: studio2 sees structural platform templates (read) but apply
    creates moodboard in studio2's own tenant (NOT in designer's tenant)
  - RBAC: client 403 on apply + from-moodboard
  - Regression: legacy starter templates have page_count == 1, blocks page-scoped
  - i18n: blueprint i18n response includes IT placeholder + page-count keys
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
DESIGNER = {"email": "designer@moodfordesign.com", "password": "Designer2024!"}
STUDIO2 = {"email": "studio2@moodfordesign.com", "password": "Studio2024!"}
CLIENT = {"email": "client@moodfordesign.com",  "password": "Client2024!"}

# Fixed UUIDs per migration 010
LUX_TPL = "22222222-0000-0000-0000-000000000001"  # Luxury Residential — 8 pages
HOSP_TPL = "22222222-0000-0000-0000-000000000002"  # Hospitality Concept — 6 pages
MAT_TPL = "22222222-0000-0000-0000-000000000003"  # Material Board — 1 page


def _login(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login {creds['email']} failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    tok = (body.get("session") or {}).get("access_token") \
        or body.get("access_token") or body.get("token")
    assert tok, f"no access_token in login response: {body}"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def designer():
    return _login(DESIGNER)


@pytest.fixture(scope="module")
def studio2():
    return _login(STUDIO2)


@pytest.fixture(scope="module")
def client_user():
    return _login(CLIENT)


def _extract_templates(payload):
    if isinstance(payload, dict):
        return payload.get("data") or payload.get("templates") or payload.get("items") or []
    return payload


# ── 1. LIST: 13 templates with page_count ────────────────────────────────────
class TestListTemplatesPageCount:
    def test_list_contains_13_templates_with_page_count(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates", timeout=20)
        assert r.status_code == 200, r.text[:300]
        templates = _extract_templates(r.json())
        assert isinstance(templates, list)
        assert len(templates) >= 13, f"expected ≥13 templates, got {len(templates)}"
        # every template must expose page_count
        missing = [t.get("slug") or t.get("id") for t in templates if "page_count" not in t]
        assert not missing, f"page_count missing on: {missing[:5]}"
        ids = {t["id"]: t for t in templates}
        assert LUX_TPL in ids, "Luxury Residential structural template missing"
        assert HOSP_TPL in ids, "Hospitality Concept structural template missing"
        assert MAT_TPL in ids, "Material Board structural template missing"
        assert ids[LUX_TPL]["page_count"] == 8, f"luxury page_count={ids[LUX_TPL]['page_count']}"
        assert ids[HOSP_TPL]["page_count"] == 6, f"hospitality page_count={ids[HOSP_TPL]['page_count']}"
        assert ids[MAT_TPL]["page_count"] == 1, f"material page_count={ids[MAT_TPL]['page_count']}"

    def test_legacy_starter_templates_page_count_is_1(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates", timeout=20)
        templates = _extract_templates(r.json())
        structural = {LUX_TPL, HOSP_TPL, HOSP_TPL, MAT_TPL}
        legacy = [t for t in templates if t["id"] not in structural]
        assert len(legacy) >= 7, f"expected ≥7 legacy starter templates, got {len(legacy)}"
        bad = [t.get("slug") for t in legacy if t.get("page_count") != 1]
        assert not bad, f"legacy starters with page_count != 1: {bad}"


# ── 2. DETAIL: pages_preview carousel ────────────────────────────────────────
class TestTemplateDetailPagesPreview:
    def test_luxury_detail_returns_8_pages_preview(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates/{LUX_TPL}", timeout=20)
        assert r.status_code == 200, r.text[:300]
        tpl = r.json()
        assert tpl.get("page_count") == 8
        carousel = tpl.get("pages_preview")
        assert isinstance(carousel, list), f"pages_preview missing/invalid: {type(carousel)}"
        assert len(carousel) == 8, f"expected 8 page previews, got {len(carousel)}"
        # each entry has id/title/sort_order/preview_svg
        for entry in carousel:
            for k in ("id", "title", "sort_order", "preview_svg"):
                assert k in entry, f"carousel entry missing {k}: keys={list(entry.keys())}"
            assert entry["preview_svg"].startswith("<svg"), \
                f"preview_svg not SVG markup: {entry['preview_svg'][:80]}"
        # sort_order strictly ascending
        orders = [e["sort_order"] for e in carousel]
        assert orders == sorted(orders), f"pages_preview not sorted: {orders}"

    def test_hospitality_detail_returns_6_pages_preview(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates/{HOSP_TPL}", timeout=20)
        assert r.status_code == 200
        tpl = r.json()
        assert tpl.get("page_count") == 6
        assert len(tpl.get("pages_preview") or []) == 6

    def test_material_board_no_carousel_single_page(self, designer):
        r = designer.get(f"{BASE_URL}/api/templates/{MAT_TPL}", timeout=20)
        assert r.status_code == 200
        tpl = r.json()
        assert tpl.get("page_count") == 1
        # Per implementation, pages_preview is only emitted when len(pages) > 1
        assert not tpl.get("pages_preview"), \
            f"single-page template should not emit pages_preview, got {len(tpl.get('pages_preview') or [])}"


# ── 3. APPLY: structural multi-page → moodboard ──────────────────────────────
class TestApplyStructuralTemplate:
    def test_apply_luxury_creates_8_pages_with_placeholders(self, designer):
        title = f"TEST_F1_lux_{uuid.uuid4().hex[:8]}"
        r = designer.post(f"{BASE_URL}/api/templates/{LUX_TPL}/apply",
                          json={"title": title}, timeout=30)
        assert r.status_code in (200, 201), r.text[:400]
        mb_id = r.json().get("id") or r.json().get("moodboard_id")
        assert mb_id
        try:
            g = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)
            assert g.status_code == 200, g.text[:300]
            mb = g.json()
            pages = mb.get("pages") or []
            assert len(pages) == 8, f"expected 8 cloned pages, got {len(pages)}"
            # Cover page first, landscape
            cover = next((p for p in pages if p.get("page_type") == "cover"), None)
            assert cover is not None, "no 'cover' page in cloned moodboard"
            assert cover["aspect_ratio"] == "cover_landscape", \
                f"cover aspect_ratio={cover['aspect_ratio']}"
            # Non-cover pages should mostly be editorial_3_4
            others_ratios = {p["aspect_ratio"] for p in pages if p["page_type"] != "cover"}
            assert "editorial_3_4" in others_ratios, \
                f"editorial_3_4 missing in non-cover ratios: {others_ratios}"
            # current_page_id set
            assert mb.get("current_page_id")
            # All elements have page_id pointing to one of the cloned pages
            page_ids = {p["id"] for p in pages}
            els = mb.get("elements") or []
            assert len(els) >= 20, f"expected many cloned blocks, got {len(els)}"
            unscoped = [e for e in els if e.get("page_id") not in page_ids]
            assert not unscoped, f"{len(unscoped)} elements not scoped to cloned pages"
            # Placeholder metadata populated on at least some blocks
            phs = []
            for e in els:
                meta = e.get("metadata_json") or e.get("metadata") or {}
                if isinstance(meta, str):
                    import json as _json
                    try:
                        meta = _json.loads(meta)
                    except Exception:
                        meta = {}
                ph = (meta or {}).get("placeholder")
                if ph:
                    phs.append(ph)
            assert len(phs) >= 5, \
                f"expected ≥5 placeholder blocks after apply, got {len(phs)}"
            for ph in phs[:5]:
                assert "label" in ph and "type" in ph and "required" in ph, \
                    f"placeholder missing fields: {ph}"
        finally:
            designer.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)

    def test_apply_hospitality_creates_6_pages(self, designer):
        title = f"TEST_F1_hosp_{uuid.uuid4().hex[:8]}"
        r = designer.post(f"{BASE_URL}/api/templates/{HOSP_TPL}/apply",
                          json={"title": title}, timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        mb_id = r.json().get("id")
        assert mb_id
        try:
            mb = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20).json()
            assert len(mb["pages"]) == 6
        finally:
            designer.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)

    def test_apply_material_board_single_page(self, designer):
        title = f"TEST_F1_mat_{uuid.uuid4().hex[:8]}"
        r = designer.post(f"{BASE_URL}/api/templates/{MAT_TPL}/apply",
                          json={"title": title}, timeout=30)
        assert r.status_code in (200, 201)
        mb_id = r.json().get("id")
        try:
            mb = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20).json()
            assert len(mb["pages"]) == 1
            els = mb.get("elements") or []
            assert len(els) >= 3, f"material board should have ≥3 blocks, got {len(els)}"
        finally:
            designer.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)


# ── 4. SAVE-AS-TEMPLATE (multi-page snapshot) ────────────────────────────────
class TestSaveAsTemplateMultipage:
    def test_save_as_template_snapshots_multipage(self, designer):
        # 1) Apply Hospitality (6 pages) so we have a multi-page source moodboard
        title = f"TEST_F1_saveas_src_{uuid.uuid4().hex[:6]}"
        ra = designer.post(f"{BASE_URL}/api/templates/{HOSP_TPL}/apply",
                           json={"title": title}, timeout=30)
        assert ra.status_code in (200, 201), ra.text[:300]
        src_mb_id = ra.json()["id"]
        created_tpl_id = None
        try:
            # 2) save-as-template
            short = uuid.uuid4().hex[:6]
            tpl_name = f"TEST_F1_TPL_{short}"
            tpl_slug = f"test-f1-tpl-{short}"
            rt = designer.post(
                f"{BASE_URL}/api/templates/from-moodboard/{src_mb_id}",
                json={"name": tpl_name, "slug": tpl_slug, "category": "concept"},
                timeout=30,
            )
            assert rt.status_code in (200, 201), rt.text[:400]
            created = rt.json()
            created_tpl_id = created.get("id") or created.get("template_id")
            assert created_tpl_id, f"missing template id in response: {created}"
            # 3) GET detail → must be multi-page
            rd = designer.get(f"{BASE_URL}/api/templates/{created_tpl_id}", timeout=20)
            assert rd.status_code == 200, rd.text[:300]
            new_tpl = rd.json()
            assert new_tpl.get("page_count") == 6, \
                f"save-as page_count={new_tpl.get('page_count')}, expected 6"
            assert len(new_tpl.get("pages_preview") or []) == 6
            # 4) Apply the snapshotted template → must produce 6 pages again
            rapply = designer.post(
                f"{BASE_URL}/api/templates/{created_tpl_id}/apply",
                json={"title": f"TEST_F1_rt_{uuid.uuid4().hex[:6]}"}, timeout=30
            )
            assert rapply.status_code in (200, 201), rapply.text[:300]
            new_mb_id = rapply.json()["id"]
            try:
                new_mb = designer.get(f"{BASE_URL}/api/moodboards/{new_mb_id}",
                                      timeout=20).json()
                assert len(new_mb["pages"]) == 6, \
                    f"round-trip pages={len(new_mb['pages'])}"
                page_ids = {p["id"] for p in new_mb["pages"]}
                unscoped = [e for e in (new_mb.get("elements") or [])
                            if e.get("page_id") not in page_ids]
                assert not unscoped, f"{len(unscoped)} elements off-page after round-trip"
            finally:
                designer.delete(f"{BASE_URL}/api/moodboards/{new_mb_id}", timeout=20)
        finally:
            if created_tpl_id:
                # Attempt cleanup; ignore if endpoint doesn't allow delete
                try:
                    designer.delete(f"{BASE_URL}/api/templates/{created_tpl_id}", timeout=20)
                except Exception:
                    pass
            designer.delete(f"{BASE_URL}/api/moodboards/{src_mb_id}", timeout=20)


# ── 5. Cross-tenant isolation ────────────────────────────────────────────────
class TestCrossTenantIsolation:
    def test_studio2_can_read_structural_platform_templates(self, studio2):
        # Platform templates are visible to every tenant for read
        r = studio2.get(f"{BASE_URL}/api/templates/{LUX_TPL}", timeout=20)
        assert r.status_code == 200, \
            f"studio2 should READ platform structural template, got {r.status_code}"

    def test_studio2_apply_creates_in_own_tenant_not_designer(self, studio2, designer):
        title = f"TEST_F1_xt_{uuid.uuid4().hex[:6]}"
        r = studio2.post(f"{BASE_URL}/api/templates/{LUX_TPL}/apply",
                         json={"title": title}, timeout=30)
        # Studio2 is tenant_admin — apply allowed within their tenant.
        assert r.status_code in (200, 201), r.text[:300]
        mb_id = r.json().get("id")
        assert mb_id
        try:
            # studio2 sees it
            g2 = studio2.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)
            assert g2.status_code == 200, "studio2 should see own moodboard"
            # designer must NOT see it (cross-tenant)
            gd = designer.get(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)
            assert gd.status_code in (403, 404), \
                f"cross-tenant leak: designer got {gd.status_code} on studio2's mb"
        finally:
            studio2.delete(f"{BASE_URL}/api/moodboards/{mb_id}", timeout=20)


# ── 6. RBAC: client 403 on apply + from-moodboard ────────────────────────────
class TestRBACClient:
    def test_client_cannot_apply_template(self, client_user):
        r = client_user.post(f"{BASE_URL}/api/templates/{LUX_TPL}/apply",
                             json={"title": "TEST_F1_client"}, timeout=20)
        assert r.status_code == 403, \
            f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_client_cannot_save_as_template(self, client_user):
        # Use any random uuid — RBAC must fire before tenant/resource lookup
        r = client_user.post(
            f"{BASE_URL}/api/templates/from-moodboard/{uuid.uuid4()}",
            json={"name": "TEST_F1_blocked"}, timeout=20)
        assert r.status_code == 403, \
            f"expected 403, got {r.status_code}: {r.text[:200]}"


# ── 7. i18n IT keys ──────────────────────────────────────────────────────────
class TestI18nItalian:
    def test_blueprint_it_includes_template_and_placeholder_keys(self, designer):
        r = designer.get(f"{BASE_URL}/api/blueprint/i18n/it", timeout=15)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        text = str(body)
        # Spot-check Italian strings. Note: 'AVVIO RAPIDO' / 'PAGINE' are rendered
        # uppercase via CSS text-transform — the source strings are sentence-case.
        expected = ["Avvio rapido", "Tela vuota", "Apri",
                    "Sostituisci con immagine", "Aggiungi pagina", "pagine"]
        missing = [s for s in expected if s not in text]
        assert not missing, f"IT strings missing from blueprint i18n: {missing}"
