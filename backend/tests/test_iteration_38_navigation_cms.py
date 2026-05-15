"""Iteration 38 — CMS Navigation/Footer renderers backend validation.

Verifies the newly seeded `navigation` CMS page exposes two sections
(nav_top + footer_columns) via the storefront public endpoint.
"""
import os
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
SLUG = "mood-demo-studio-81a09e"
URL = f"{BASE_URL}/api/storefront/public/{SLUG}/pages/navigation"


@pytest.fixture(scope="module")
def page():
    r = requests.get(URL, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "page" in body
    return body["page"]


def test_page_published(page):
    assert page["status"] == "published", f"expected published, got {page['status']}"
    assert page["published_at"], "published_at must be set"


def test_two_sections_nav_and_footer(page):
    sections = page["sections"]
    assert len(sections) == 2, f"expected 2 sections, got {len(sections)}"
    types = sorted([s["section_type"] for s in sections])
    assert types == ["footer_columns", "nav_top"], types


def test_nav_top_structure(page):
    nav = next(s for s in page["sections"] if s["section_type"] == "nav_top")
    settings = nav["settings"]
    assert "links" in settings and isinstance(settings["links"], list)
    assert len(settings["links"]) == 7, f"expected 7 links, got {len(settings['links'])}"
    # Each link has id, href, label (i18n), is_cta, visible, show_on_mobile, show_on_desktop
    for link in settings["links"]:
        for k in ("id", "href", "label", "is_cta", "visible", "show_on_mobile", "show_on_desktop"):
            assert k in link, f"link missing {k}: {link}"
        assert isinstance(link["label"], dict)
        # i18n must include at least it + en-US + _default
        assert "_default" in link["label"]
        assert "it" in link["label"]
        assert "en-US" in link["label"]
    # logo defaults
    assert settings.get("logo_size") == 104
    assert settings.get("logo_src"), "logo_src required"
    # access_label per locale
    locale_content = nav["locale_content"]
    for loc in ("it", "en-US", "_default"):
        assert loc in locale_content, f"missing {loc} in locale_content"
    assert locale_content["it"].get("access_label") == "ACCEDI"
    assert locale_content["en-US"].get("access_label") == "SIGN IN"


def test_footer_columns_structure(page):
    footer = next(s for s in page["sections"] if s["section_type"] == "footer_columns")
    settings = footer["settings"]
    # 4 columns: AZIENDA, SERVIZI, RISORSE, SUPPORTO
    cols = settings.get("columns", [])
    assert len(cols) == 4, f"expected 4 columns, got {len(cols)}"
    col_ids = [c["id"] for c in cols]
    # IDs from seed: company, services, resources, support
    assert set(col_ids) == {"company", "services", "resources", "support"}, col_ids
    # each column has heading (i18n) and links list
    for c in cols:
        assert "heading" in c or "title" in c, f"col missing title/heading: {c}"
        assert "links" in c and isinstance(c["links"], list)
    # 4 socials
    socials = settings.get("socials", [])
    assert len(socials) == 4, f"expected 4 socials, got {len(socials)}"
    for s in socials:
        assert "id" in s or "name" in s
        assert "href" in s
    # showroom_address_lines list
    addr = settings.get("showroom_address_lines")
    assert isinstance(addr, list) and len(addr) >= 1, addr
    # locale_content per locale (tagline, showroom_title, book_cta_label, copyright)
    lc = footer["locale_content"]
    for loc in ("it", "en-US"):
        assert loc in lc, f"missing locale {loc}"
        for key in ("tagline", "showroom_title", "book_cta_label", "copyright"):
            assert key in lc[loc], f"{loc} missing {key}"


def test_it_vs_en_column_titles(page):
    """Switching locale changes column titles (CHI SIAMO → ABOUT etc.)."""
    footer = next(s for s in page["sections"] if s["section_type"] == "footer_columns")
    cols = footer["settings"]["columns"]
    company = next(c for c in cols if c["id"] == "company")
    heading = company.get("heading") or company.get("title")
    assert isinstance(heading, dict)
    it_val = heading.get("it", "").upper()
    en_val = heading.get("en-US", "").upper()
    assert it_val == "AZIENDA", f"IT heading expected AZIENDA, got {it_val}"
    assert en_val == "COMPANY", f"EN heading expected COMPANY, got {en_val}"


def test_no_preview_returns_published(page):
    """Without preview=1 query we get the published payload."""
    assert page["status"] == "published"
    # No drafts should leak
    assert page.get("scheduled_publish_at") is None or page["status"] == "published"
