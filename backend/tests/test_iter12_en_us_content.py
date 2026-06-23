"""
test_iter12_en_us_content.py
Backend API verification for Phase 2 EN-US content seeding.
Tests cover:
  - studio_v2.ui manifest landing keys (EN-US and IT-IT)
  - site.audience EN-US hero content + IT regression
  - site.training EN-US hero/intro content
  - site.features EN-US hero (no forbidden keywords) + item_07-item_13
  - site.footer regression (returns 200)
  - site.navigation regression (5 main items)
  - Forbidden keyword check across EN-US hero sections

API response shape:
  {
    "page": {...},
    "sections": [
      {
        "id": "...",
        "type": "audience_hero_split" | "feature_hero_split" | "training_hero" | etc,
        "sort": 0,
        "content": { "title": "...", "eyebrow": "...", "body": "...",
                     "title_line_1": "...",  # training
                     "item_07_title": "...",  # feature_numbered_list
                     ...
        }
      }, ...
    ]
  }
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

FORBIDDEN_KEYWORDS = ["platform", "software", "free", "sign up", "subscription"]


# ─── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ─── Helper functions ──────────────────────────────────────────────────────

def _get_hero_section(data: dict) -> dict:
    """Return the hero section content dict from a page response."""
    sections = data.get("sections", [])
    if isinstance(sections, list):
        for sec in sections:
            if isinstance(sec, dict):
                t = sec.get("type", "")
                # Hero sections have types like *_hero_*, training_hero, etc.
                if "hero" in t:
                    return sec.get("content", {}) or {}
    return {}


def _get_section_by_type(data: dict, section_type: str) -> dict:
    """Return content dict of the first section matching the given type."""
    sections = data.get("sections", [])
    if isinstance(sections, list):
        for sec in sections:
            if isinstance(sec, dict) and sec.get("type") == section_type:
                return sec.get("content", {}) or {}
    return {}


def _collect_hero_text(data: dict) -> list:
    """Collect all string values from hero section content."""
    hero = _get_hero_section(data)
    return [v for v in hero.values() if isinstance(v, str) and v]


def _extract_nav_items(data) -> list:
    """Extract navigation items list from various response shapes."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("items", "navigation", "nav", "links", "main"):
            if key in data and isinstance(data[key], list):
                return data[key]
        if "data" in data:
            inner = data["data"]
            if isinstance(inner, list):
                return inner
            if isinstance(inner, dict):
                for key in ("items", "navigation", "nav", "links", "main"):
                    if key in inner and isinstance(inner[key], list):
                        return inner[key]
    return []


# ─── §1 Studio V2 Manifest — landing keys ──────────────────────────────────

class TestStudioV2ManifestLandingKeys:
    """Verify landing.* keys are exposed in studio_v2 manifest for EN-US and IT-IT."""

    def test_manifest_en_us_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: manifest EN-US returns 200")

    def test_manifest_en_us_landing_headline(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        ui = data.get("ui", {})
        headline = ui.get("landing.headline", "")
        assert headline == "Apply your studio to MOOD.", (
            f"Expected 'Apply your studio to MOOD.', got '{headline}'"
        )
        print(f"PASS: landing.headline EN-US = '{headline}'")

    def test_manifest_en_us_landing_cta_start(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get("ui", {})
        cta = ui.get("landing.cta_start", "")
        assert cta == "Begin", f"Expected 'Begin', got '{cta}'"
        print(f"PASS: landing.cta_start EN-US = '{cta}'")

    def test_manifest_en_us_landing_subheadline(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get("ui", {})
        sub = ui.get("landing.subheadline", "")
        assert "3 minutes" in sub or "MOOD Advisor" in sub, (
            f"landing.subheadline EN-US unexpected value: '{sub}'"
        )
        print(f"PASS: landing.subheadline EN-US = '{sub}'")

    def test_manifest_en_us_landing_link_signin(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=en-US")
        assert r.status_code == 200
        ui = r.json().get("ui", {})
        link = ui.get("landing.link_signin", "")
        assert "Sign in" in link, f"Expected 'Sign in' in link_signin, got '{link}'"
        print(f"PASS: landing.link_signin EN-US = '{link}'")

    def test_manifest_it_it_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: manifest IT-IT returns 200")

    def test_manifest_it_it_landing_headline(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        ui = r.json().get("ui", {})
        headline = ui.get("landing.headline", "")
        assert headline == "Candidati a MOOD.", (
            f"Expected 'Candidati a MOOD.', got '{headline}'"
        )
        print(f"PASS: landing.headline IT-IT = '{headline}'")

    def test_manifest_it_it_landing_cta_start(self, session):
        r = session.get(f"{BASE_URL}/api/studio/v2/manifest?locale=it-IT")
        assert r.status_code == 200
        ui = r.json().get("ui", {})
        cta = ui.get("landing.cta_start", "")
        assert cta == "Inizia", f"Expected 'Inizia', got '{cta}'"
        print(f"PASS: landing.cta_start IT-IT = '{cta}'")


# ─── §2 Audience EN-US ─────────────────────────────────────────────────────

class TestAudienceEnUs:
    """Verify EN-US audience page hero content is correctly seeded."""

    def test_audience_en_us_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/audience?locale=en-US")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: audience EN-US returns 200")

    def test_audience_en_us_hero_title_contains_believe(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/audience?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero = _get_hero_section(data)
        hero_title = hero.get("title", "")
        assert hero_title, "hero.title is empty in audience EN-US"
        assert "For studios that believe" in hero_title, (
            f"Expected 'For studios that believe' in hero.title, got: '{hero_title}'"
        )
        print(f"PASS: audience EN-US hero.title = '{hero_title[:80]}'")

    def test_audience_en_us_hero_eyebrow(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/audience?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero = _get_hero_section(data)
        hero_eyebrow = hero.get("eyebrow", "")
        assert hero_eyebrow, "hero.eyebrow is empty in audience EN-US"
        assert "For those who design the way people live" in hero_eyebrow, (
            f"Expected 'For those who design the way people live.' in hero.eyebrow, got: '{hero_eyebrow}'"
        )
        print(f"PASS: audience EN-US hero.eyebrow = '{hero_eyebrow}'")

    def test_audience_en_us_hero_no_forbidden_keywords(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/audience?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero_fields = _collect_hero_text(data)
        assert hero_fields, "No hero fields found for audience EN-US"
        combined = " ".join(hero_fields).lower()
        for kw in FORBIDDEN_KEYWORDS:
            assert kw not in combined, (
                f"Forbidden keyword '{kw}' found in audience EN-US hero: "
                f"{[f for f in hero_fields if kw in f.lower()]}"
            )
        print("PASS: No forbidden keywords in audience EN-US hero sections")


# ─── §3 Audience IT-IT regression ──────────────────────────────────────────

class TestAudienceItItRegression:
    """IT-IT audience content should still return Italian content."""

    def test_audience_it_it_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/audience?locale=it-IT")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: audience IT-IT returns 200")

    def test_audience_it_it_hero_has_content(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/audience?locale=it-IT")
        assert r.status_code == 200
        data = r.json()
        hero = _get_hero_section(data)
        hero_title = hero.get("title", "")
        assert hero_title, "hero.title is empty for IT-IT audience"
        # Verify IT content is NOT just the EN-US seed accidentally applied
        # IT may have its own content or fallback, but should not be blank
        print(f"PASS: audience IT-IT hero.title = '{hero_title[:80]}'")


# ─── §4 Training EN-US ─────────────────────────────────────────────────────

class TestTrainingEnUs:
    """Verify EN-US training page hero content."""

    def test_training_en_us_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/training?locale=en-US")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: training EN-US returns 200")

    def test_training_en_us_hero_title_line_1(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/training?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero = _get_hero_section(data)
        title_line_1 = hero.get("title_line_1", "")
        assert title_line_1 == "Learn.", (
            f"Expected 'Learn.', got '{title_line_1}'"
        )
        print(f"PASS: training EN-US hero.title_line_1 = '{title_line_1}'")

    def test_training_en_us_intro_body_contains_mood_academy(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/training?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        # intro.body is in a page_intro section
        intro = _get_section_by_type(data, "page_intro")
        intro_body = intro.get("body", "")
        assert intro_body, "intro body is empty in training EN-US"
        assert "MOOD Academy" in intro_body, (
            f"Expected 'MOOD Academy' in intro.body, got: '{intro_body[:200]}'"
        )
        print("PASS: training EN-US intro.body contains 'MOOD Academy'")

    def test_training_en_us_hero_no_forbidden_keywords(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/training?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero_fields = _collect_hero_text(data)
        assert hero_fields, "No hero fields found for training EN-US"
        combined = " ".join(hero_fields).lower()
        for kw in FORBIDDEN_KEYWORDS:
            assert kw not in combined, (
                f"Forbidden keyword '{kw}' found in training EN-US hero: "
                f"{[f for f in hero_fields if kw in f.lower()]}"
            )
        print("PASS: No forbidden keywords in training EN-US hero sections")


# ─── §5 Features EN-US ─────────────────────────────────────────────────────

class TestFeaturesEnUs:
    """Verify EN-US features page hero (no forbidden keywords) and items 07-13."""

    def test_features_en_us_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: features EN-US returns 200")

    def test_features_en_us_hero_title(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero = _get_hero_section(data)
        hero_title = hero.get("title", "")
        assert hero_title == "An editorial configuration for the entire project.", (
            f"Expected 'An editorial configuration for the entire project.', got '{hero_title}'"
        )
        print(f"PASS: features EN-US hero.title = '{hero_title}'")

    def test_features_en_us_hero_no_platform_keyword(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero_fields = _collect_hero_text(data)
        combined = " ".join(hero_fields).lower()
        assert "platform" not in combined, (
            f"Forbidden keyword 'platform' found in features EN-US hero: "
            f"{[f for f in hero_fields if 'platform' in f.lower()]}"
        )
        print("PASS: 'platform' not in features EN-US hero")

    def test_features_en_us_hero_no_forbidden_keywords(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        hero_fields = _collect_hero_text(data)
        combined = " ".join(hero_fields).lower()
        for kw in FORBIDDEN_KEYWORDS:
            assert kw not in combined, (
                f"Forbidden keyword '{kw}' found in features EN-US hero: "
                f"{[f for f in hero_fields if kw in f.lower()]}"
            )
        print("PASS: No forbidden keywords in features EN-US hero sections")

    def test_features_en_us_item_07_present(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        content = _get_section_by_type(data, "feature_numbered_list")
        item_07_title = content.get("item_07_title", "")
        assert item_07_title, "item_07_title not found in features EN-US numbered list"
        assert "Never lose the context" in item_07_title, (
            f"Expected 'Never lose the context' in item_07_title, got '{item_07_title}'"
        )
        print(f"PASS: features EN-US item_07_title = '{item_07_title[:80]}'")

    def test_features_en_us_item_08_present(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        content = _get_section_by_type(data, "feature_numbered_list")
        item_08_title = content.get("item_08_title", "")
        assert item_08_title, "item_08_title not found in features EN-US numbered list"
        assert "One story" in item_08_title or "Seven chapters" in item_08_title, (
            f"Unexpected item_08_title: '{item_08_title}'"
        )
        print(f"PASS: features EN-US item_08_title = '{item_08_title}'")

    def test_features_en_us_item_09_eyebrow_editorial_voice(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        content = _get_section_by_type(data, "feature_numbered_list")
        item_09_eyebrow = content.get("item_09_eyebrow", "")
        assert item_09_eyebrow, "item_09_eyebrow not found"
        assert "Editorial voice" in item_09_eyebrow or "editorial" in item_09_eyebrow.lower(), (
            f"Unexpected item_09_eyebrow: '{item_09_eyebrow}'"
        )
        print(f"PASS: features EN-US item_09_eyebrow = '{item_09_eyebrow}'")

    def test_features_en_us_item_10_material_curation(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        content = _get_section_by_type(data, "feature_numbered_list")
        item_10_eyebrow = content.get("item_10_eyebrow", "")
        assert "Material curation" in item_10_eyebrow or "material" in item_10_eyebrow.lower(), (
            f"Unexpected item_10_eyebrow: '{item_10_eyebrow}'"
        )
        item_10_title = content.get("item_10_title", "")
        assert item_10_title, "item_10_title empty"
        print(f"PASS: features EN-US item_10_eyebrow='{item_10_eyebrow}', item_10_title='{item_10_title[:60]}'")

    def test_features_en_us_item_13_present(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        content = _get_section_by_type(data, "feature_numbered_list")
        item_13_title = content.get("item_13_title", "")
        assert item_13_title, "item_13_title not found in features EN-US numbered list"
        assert "Know-how" in item_13_title or "people" in item_13_title.lower(), (
            f"Unexpected item_13_title: '{item_13_title}'"
        )
        print(f"PASS: features EN-US item_13_title = '{item_13_title}'")

    def test_features_en_us_items_07_to_13_all_have_content(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=en-US")
        assert r.status_code == 200
        data = r.json()
        content = _get_section_by_type(data, "feature_numbered_list")
        assert content, "feature_numbered_list section not found"
        missing = []
        for i in range(7, 14):
            k = f"item_{i:02d}"
            title = content.get(f"{k}_title", "")
            eyebrow = content.get(f"{k}_eyebrow", "")
            body = content.get(f"{k}_body", "")
            if not title or not eyebrow or not body:
                missing.append(f"{k} (title={bool(title)}, eyebrow={bool(eyebrow)}, body={bool(body)})")
        assert not missing, f"Items missing content: {missing}"
        print(f"PASS: All items 07-13 have title, eyebrow, body content in features EN-US")


# ─── §6 Features IT-IT regression ──────────────────────────────────────────

class TestFeaturesItItRegression:
    """IT-IT features hero should return Italian content without 'piattaforma' in hero."""

    def test_features_it_it_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=it-IT")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: features IT-IT returns 200")

    def test_features_it_it_hero_title(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=it-IT")
        assert r.status_code == 200
        data = r.json()
        hero = _get_hero_section(data)
        hero_title = hero.get("title", "")
        assert "Una configurazione editoriale" in hero_title, (
            f"Expected 'Una configurazione editoriale per l'intero progetto.', got '{hero_title}'"
        )
        print(f"PASS: features IT-IT hero.title = '{hero_title}'")

    def test_features_it_it_hero_no_piattaforma(self, session):
        r = session.get(f"{BASE_URL}/api/site/pages/features?locale=it-IT")
        assert r.status_code == 200
        data = r.json()
        # Only check the hero section (feature_hero_split) for piattaforma
        hero = _get_hero_section(data)
        hero_fields = [v for v in hero.values() if isinstance(v, str) and v]
        combined = " ".join(hero_fields).lower()
        assert "piattaforma" not in combined, (
            f"Forbidden keyword 'piattaforma' found in features IT-IT hero: "
            f"{[f for f in hero_fields if 'piattaforma' in f.lower()]}"
        )
        print("PASS: 'piattaforma' not in features IT-IT hero")


# ─── §7 Regression: footer + navigation ────────────────────────────────────

class TestRegressionFooterNavigation:
    """Regression: footer returns 200, navigation returns 5 main items."""

    def test_footer_en_us_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/site/footer?locale=en-US")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: footer EN-US returns 200")

    def test_footer_it_it_returns_200(self, session):
        r = session.get(f"{BASE_URL}/api/site/footer?locale=it-IT")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        print("PASS: footer IT-IT returns 200")

    def test_navigation_en_us_returns_5_items(self, session):
        r = session.get(f"{BASE_URL}/api/site/navigation?locale=en-US")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        data = r.json()
        items = _extract_nav_items(data)
        assert len(items) >= 5, (
            f"Expected at least 5 navigation items, got {len(items)}: {items}"
        )
        print(f"PASS: navigation EN-US has {len(items)} items")

    def test_navigation_it_it_returns_5_items(self, session):
        r = session.get(f"{BASE_URL}/api/site/navigation?locale=it-IT")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        data = r.json()
        items = _extract_nav_items(data)
        assert len(items) >= 5, (
            f"Expected at least 5 navigation items, got {len(items)}: {items}"
        )
        print(f"PASS: navigation IT-IT has {len(items)} items")


# ─── §8 Full forbidden keyword scan across all EN-US hero sections ──────────

class TestForbiddenKeywordsAllPages:
    """Check that no forbidden keywords appear in EN-US hero sections across pages."""

    PAGES = ["audience", "features", "training"]

    def test_no_forbidden_keywords_en_us_all_pages(self, session):
        for page in self.PAGES:
            r = session.get(f"{BASE_URL}/api/site/pages/{page}?locale=en-US")
            assert r.status_code == 200, f"Page '{page}' EN-US returned {r.status_code}"
            data = r.json()
            hero_fields = _collect_hero_text(data)
            assert hero_fields, f"No hero content found for {page} EN-US"
            combined = " ".join(hero_fields).lower()
            for kw in FORBIDDEN_KEYWORDS:
                assert kw not in combined, (
                    f"Forbidden keyword '{kw}' found in {page} EN-US hero content: "
                    f"{[f for f in hero_fields if kw in f.lower()]}"
                )
        print(f"PASS: No forbidden keywords in EN-US hero sections for pages: {self.PAGES}")
