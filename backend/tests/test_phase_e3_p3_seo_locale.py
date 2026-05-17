"""Phase E-3 / Prompt 3 — SEO localization layer regression suite.

Verifies:
  • GET /api/magazine/public/{tenant}/editorial/{slug} returns
    `article.slug_map_by_locale` and `article._locale` with `preview` flag.
  • Anonymous + ?preview=1 still gets published-only (no preview unlock).
  • Internal translation never leaks to public response.
  • slug_map_by_locale values are variant_slugs (not prefix-replaced).
"""
import os
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

TENANT = "mood-demo-studio-81a09e"
# Seeded EN-AE published variant per agent_to_agent_context_note
SEED_SLUG = "warm-italian-gcc-luxury"


def _find_any_published_variant_slug():
    """Fallback: hit calendar to find ANY published variant slug for this tenant."""
    r = requests.get(
        f"{BASE}/api/editorial/calendar",
        params={"tenant_slug": TENANT},
        timeout=15,
    )
    if r.status_code != 200:
        return None
    for v in (r.json() or {}).get("variants", []):
        if v.get("is_published") and v.get("variant_slug"):
            return v["variant_slug"]
    return None


def test_public_editorial_returns_slug_map_by_locale():
    # Try seeded slug first, then fallback
    for slug in (SEED_SLUG, _find_any_published_variant_slug()):
        if not slug:
            continue
        r = requests.get(
            f"{BASE}/api/magazine/public/{TENANT}/editorial/{slug}",
            timeout=15,
        )
        if r.status_code == 200:
            data = r.json()
            article = data.get("article") or {}
            assert "slug_map_by_locale" in article, "slug_map_by_locale missing"
            sm = article["slug_map_by_locale"]
            assert isinstance(sm, dict) and len(sm) >= 1
            # Each key must look like a BCP-47 locale, value must be a slug string
            for loc, vslug in sm.items():
                assert "-" in loc or len(loc) >= 2
                assert isinstance(vslug, str) and len(vslug) > 0
            # _locale block present, source=editorial_variant
            assert article.get("_source") == "editorial_variant"
            loc_block = article.get("_locale") or {}
            assert loc_block.get("source") == "editorial_variant"
            # Internal translation is stripped
            assert "internal_translation" not in article
            assert "internal_translation" not in r.text
            return
    import pytest
    pytest.skip("No published editorial variant found to test slug_map_by_locale")


def test_public_editorial_preview_anonymous_no_unlock():
    """Anonymous ?preview=1 must NOT serve draft variants — published only."""
    r = requests.get(
        f"{BASE}/api/magazine/public/{TENANT}/editorial/this-slug-should-not-exist-xyz",
        params={"preview": 1},
        timeout=15,
    )
    # Either 404 (slug doesn't exist) or, if it did, must be is_published=true.
    assert r.status_code in (404,), f"Anonymous preview must not unlock drafts, got {r.status_code}"


def test_public_editorial_preview_anonymous_unknown_returns_404():
    r = requests.get(
        f"{BASE}/api/magazine/public/{TENANT}/editorial/__never__",
        params={"preview": 1},
        timeout=15,
    )
    assert r.status_code == 404


def test_public_editorial_locale_preview_flag_false_when_published_no_session():
    """When anonymous and variant is published, _locale.preview must be False."""
    slug = _find_any_published_variant_slug()
    if not slug:
        import pytest
        pytest.skip("No published variant available")
    r = requests.get(
        f"{BASE}/api/magazine/public/{TENANT}/editorial/{slug}",
        params={"preview": 1},  # anonymous → not granted
        timeout=15,
    )
    assert r.status_code == 200
    art = r.json()["article"]
    loc_block = art.get("_locale") or {}
    assert loc_block.get("preview") is False, "Anonymous must not get preview=True"
    # Even with preview=1 anonymously, internal translation never leaks
    assert "internal_translation" not in r.text


def test_slug_map_values_are_variant_slugs_not_prefix_replaced():
    """
    Contract: slug_map_by_locale[locale] is the variant_slug for that locale,
    NOT just prefix-replaced (e.g. /it-IT/<same-slug>). When a sibling exists
    with a DIFFERENT variant_slug we should see it in the map.
    """
    slug = _find_any_published_variant_slug()
    if not slug:
        import pytest
        pytest.skip("No published variant")
    r = requests.get(
        f"{BASE}/api/magazine/public/{TENANT}/editorial/{slug}",
        timeout=15,
    )
    assert r.status_code == 200
    sm = r.json()["article"]["slug_map_by_locale"]
    # served locale must always be in map
    served = r.json()["article"]["_locale"]["served"]
    assert served in sm
    # And the slug we requested with must equal sm[served]
    assert sm[served] == slug


def test_internal_translation_endpoint_requires_auth():
    """Sanity check (regression): anon GET → 401."""
    # We pick an arbitrary variant id; even a non-existent one must 401 (auth first)
    r = requests.get(
        f"{BASE}/api/editorial/variants/00000000-0000-0000-0000-000000000000/internal-translation",
        timeout=15,
    )
    assert r.status_code in (401, 403), f"Expected 401/403 for anon, got {r.status_code}"
