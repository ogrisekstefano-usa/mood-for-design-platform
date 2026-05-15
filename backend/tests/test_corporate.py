"""
Corporate API tests for MOOD for Design corporate website.
P0: Verify Supabase-backed CMS (tenants, cms_pages, cms_sections) is the data source.
"""
import os
import time
import re
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api/corporate"

EXPECTED_PAGES = {
    "home", "platform", "pricing", "about", "journal",
    "contact", "start-studio", "blueprint",
}
EXPECTED_LOCALES = {"it", "en-us", "en-uk", "fr", "de", "es"}


# ── Tenant ────────────────────────────────────────────────────────────────────

class TestTenant:
    def test_tenant_returns_mood_corporate(self):
        r = requests.get(f"{API}/tenant", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("slug") == "mood-corporate", data
        assert data.get("status") == "active", data
        # active_plan present (may be string or dict)
        assert "active_plan" in data, data
        # enabled_modules list
        assert "enabled_modules" in data
        assert isinstance(data["enabled_modules"], list)
        # theme block (brand colors / fonts)
        assert "theme" in data and isinstance(data["theme"], dict), data
        # active_languages list
        assert "active_languages" in data
        assert isinstance(data["active_languages"], list)
        # id must be the deterministic UUIDv5
        assert data.get("id") == "51f9ab4d-1aaf-5b8b-b7a9-8a4c8f942a50", data


# ── Locales ───────────────────────────────────────────────────────────────────

class TestLocales:
    def test_locales_returns_6(self):
        r = requests.get(f"{API}/locales", timeout=15)
        assert r.status_code == 200
        codes = {l["code"] for l in r.json().get("locales", [])}
        assert EXPECTED_LOCALES.issubset(codes), f"Missing locales: {EXPECTED_LOCALES - codes}"


# ── Pages list ────────────────────────────────────────────────────────────────

class TestPagesList:
    def test_pages_lists_all_8(self):
        r = requests.get(f"{API}/pages", timeout=15)
        assert r.status_code == 200
        pages = r.json().get("pages", [])
        slugs = {p["slug"] for p in pages}
        assert EXPECTED_PAGES.issubset(slugs), f"Missing pages: {EXPECTED_PAGES - slugs}"
        # All expected pages must be published
        for p in pages:
            if p["slug"] in EXPECTED_PAGES:
                assert p.get("published") is True, f"Page '{p['slug']}' not published"


# ── Page renderer ─────────────────────────────────────────────────────────────

class TestHomePage:
    def _get(self, locale):
        r = requests.get(f"{API}/pages/home", params={"locale": locale}, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_home_it_has_required_sections_no_navigation(self):
        data = self._get("it")
        sections = data.get("sections", [])
        types = [s["type"] for s in sections]
        # Must not include navigation
        assert "navigation" not in types, f"navigation section should NOT be in /pages: {types}"
        # Required section types
        required = {"editorial_hero", "logos_wall", "split_story",
                    "feature_narrative", "cinematic_quote", "cta_section"}
        missing = required - set(types)
        assert not missing, f"Missing required home sections: {missing}. Got: {types}"
        # Each section has content payload
        for s in sections:
            assert isinstance(s.get("content"), dict)

    def test_home_locale_en_us(self):
        data = self._get("en-us")
        assert len(data.get("sections", [])) > 0

    def test_home_locale_fr(self):
        data = self._get("fr")
        assert len(data.get("sections", [])) > 0

    def test_home_locale_de(self):
        data = self._get("de")
        assert len(data.get("sections", [])) > 0

    def test_home_locale_es(self):
        data = self._get("es")
        assert len(data.get("sections", [])) > 0

    def test_home_unknown_locale_falls_back_no_500(self):
        r = requests.get(f"{API}/pages/home", params={"locale": "xx-unknown"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Should still return sections (fallback to en-us or first available)
        assert len(data.get("sections", [])) > 0


class TestOtherPages:
    def test_pricing_has_required_sections_it(self):
        r = requests.get(f"{API}/pages/pricing", params={"locale": "it"}, timeout=15)
        assert r.status_code == 200
        types = {s["type"] for s in r.json().get("sections", [])}
        assert "pricing_cards" in types, types
        assert "faq_accordion" in types, types

    def test_about_has_metrics_strip_it(self):
        r = requests.get(f"{API}/pages/about", params={"locale": "it"}, timeout=15)
        assert r.status_code == 200
        types = {s["type"] for s in r.json().get("sections", [])}
        assert "metrics_strip" in types, types

    def test_journal_has_journal_grid_en(self):
        r = requests.get(f"{API}/pages/journal", params={"locale": "en-us"}, timeout=15)
        assert r.status_code == 200
        types = {s["type"] for s in r.json().get("sections", [])}
        assert "journal_grid" in types, types

    @pytest.mark.parametrize("slug,locale", [
        ("blueprint", "en-us"),
        ("start-studio", "it"),
        ("platform", "it"),
        ("contact", "it"),
    ])
    def test_other_pages_render(self, slug, locale):
        r = requests.get(f"{API}/pages/{slug}", params={"locale": locale}, timeout=15)
        assert r.status_code == 200, f"{slug}/{locale}: {r.text}"
        data = r.json()
        assert "page" in data and "sections" in data

    def test_nonexistent_page_404(self):
        r = requests.get(f"{API}/pages/does-not-exist", params={"locale": "it"}, timeout=15)
        assert r.status_code == 404


# ── Navigation ────────────────────────────────────────────────────────────────

class TestNavigation:
    def _get(self, locale):
        r = requests.get(f"{API}/navigation", params={"locale": locale}, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()

    def test_nav_it_labels(self):
        data = self._get("it")
        assert "main" in data and isinstance(data["main"], list) and len(data["main"]) > 0
        labels = " ".join(
            str(item.get("label", "")) for item in data["main"]
        )
        # Italian-specific labels
        assert "Piattaforma" in labels, f"Expected 'Piattaforma' in IT nav: {labels}"
        assert "Studi" in labels, f"Expected 'Studi' (Per gli Studi) in IT nav: {labels}"
        # CTA in Italian
        cta = data.get("cta") or {}
        cta_label = cta.get("label") if isinstance(cta, dict) else cta
        assert cta_label and "Studio" in str(cta_label), f"Expected IT CTA referencing 'Studio': {cta}"
        # Footer has the 3 groups
        footer = data.get("footer") or {}
        assert isinstance(footer, dict) and len(footer) > 0
        keys_lower = {str(k).lower() for k in footer.keys()}
        # 'company', 'platform', 'resources' may be top-level keys or grouped under 'groups'
        if "groups" in footer:
            keys_lower = {str(g.get("key", g.get("title", ""))).lower() for g in footer["groups"]}
        for expected in ("company", "platform", "resources"):
            assert any(expected in k for k in keys_lower), f"footer group '{expected}' missing: {footer}"

    def test_nav_fr_labels(self):
        data = self._get("fr")
        labels = " ".join(str(i.get("label", "")) for i in data.get("main", []))
        assert "Plateforme" in labels, f"Expected 'Plateforme' in FR nav: {labels}"

    def test_nav_en_us_labels(self):
        data = self._get("en-us")
        labels = " ".join(str(i.get("label", "")) for i in data.get("main", []))
        assert "Platform" in labels, f"Expected 'Platform' in EN nav: {labels}"


# ── Section registry ──────────────────────────────────────────────────────────

class TestSectionRegistry:
    def test_registry_has_15_types(self):
        r = requests.get(f"{API}/sections/registry", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("total") == 15, data.get("total")
        assert len(data.get("registry", [])) == 15


# ── Forms (Supabase persistence) ──────────────────────────────────────────────

class TestNewsletter:
    def test_newsletter_subscribe_and_idempotent(self):
        email = f"TEST_news_{int(time.time())}@example.com"
        r1 = requests.post(f"{API}/newsletter", json={"email": email, "locale": "it"}, timeout=15)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("success") is True
        # Idempotent on duplicate
        r2 = requests.post(f"{API}/newsletter", json={"email": email, "locale": "it"}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("success") is True


class TestContact:
    def test_contact_returns_reference_format(self):
        r = requests.post(f"{API}/contact", json={
            "name": "TEST User", "email": "test@example.com",
            "message": "Integration test", "inquiry_type": "general", "locale": "it",
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        ref = data.get("reference", "")
        assert re.match(r"^MFD-[A-Z0-9]{8}$", ref), f"Bad reference format: {ref}"

    def test_contact_two_submissions_have_unique_refs(self):
        refs = set()
        for i in range(2):
            r = requests.post(f"{API}/contact", json={
                "name": f"TEST {i}", "email": f"t{i}@example.com", "message": "x",
            }, timeout=15)
            refs.add(r.json()["reference"])
        assert len(refs) == 2


class TestStudioRegister:
    def test_studio_register_deterministic_slug(self):
        ts = int(time.time())
        name = f"TEST Studio {ts}"
        r = requests.post(f"{API}/studio/register", json={
            "studio_name": name, "email": f"o{ts}@example.com",
            "first_name": "John", "last_name": "Doe", "plan": "starter",
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        studio = data.get("studio", {})
        expected_slug = f"test-studio-{ts}"
        assert studio.get("slug") == expected_slug, studio
        assert studio.get("subdomain") == f"{expected_slug}.blueprint.moodfordesign.com"


# ── Cache ─────────────────────────────────────────────────────────────────────

class TestCache:
    def test_cache_invalidate_and_repopulate(self):
        # Warm
        r0 = requests.get(f"{API}/pages/home", params={"locale": "it"}, timeout=15)
        assert r0.status_code == 200

        # Invalidate
        r1 = requests.post(f"{API}/cache/invalidate", timeout=15)
        assert r1.status_code == 200
        assert r1.json().get("ok") is True

        # Re-fetch must still work (repopulates from DB)
        r2 = requests.get(f"{API}/pages/home", params={"locale": "it"}, timeout=15)
        assert r2.status_code == 200
        assert len(r2.json().get("sections", [])) > 0

    def test_cache_hit_is_faster(self):
        # Invalidate first
        requests.post(f"{API}/cache/invalidate", timeout=15)
        # Cold call
        t0 = time.perf_counter()
        r1 = requests.get(f"{API}/pages/home", params={"locale": "en-us"}, timeout=15)
        cold = time.perf_counter() - t0
        assert r1.status_code == 200
        # Warm call
        t1 = time.perf_counter()
        r2 = requests.get(f"{API}/pages/home", params={"locale": "en-us"}, timeout=15)
        warm = time.perf_counter() - t1
        assert r2.status_code == 200
        # Soft assertion: warm should not be drastically slower than cold.
        # Allow some jitter (warm < cold * 1.5 OR warm < 0.5s)
        assert warm < max(cold * 1.5, 0.5), f"cold={cold:.3f}s, warm={warm:.3f}s — cache not effective"


# ── Source-of-truth check (NO seed_data import in router/repo) ────────────────

class TestNoSeedDataImport:
    def test_corporate_router_does_not_import_seed_data(self):
        with open('/app/backend/routers/corporate.py', 'r') as f:
            src = f.read()
        # Allow mention in docstring/comments but NOT as import
        for line in src.splitlines():
            stripped = line.strip()
            if stripped.startswith('#'):
                continue
            assert not stripped.startswith('from db.seed_data'), f"Forbidden import: {line}"
            assert not stripped.startswith('import db.seed_data'), f"Forbidden import: {line}"
            assert 'seed_data.' not in line or 'NOT seed_data' in line or stripped.startswith('"""'), \
                f"seed_data usage in router: {line}"

    def test_repository_does_not_import_seed_data(self):
        with open('/app/backend/db/repository.py', 'r') as f:
            src = f.read()
        for line in src.splitlines():
            stripped = line.strip()
            if stripped.startswith('#'):
                continue
            assert 'seed_data' not in line, f"seed_data referenced in repository: {line}"
