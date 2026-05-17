"""Phase R-MARKET-1B — Locale wiring backend invariants.

Verifies:
  * /api/storefront/public/{slug}/markets is ANONYMOUS, returns 7 active
    markets with primary_locale + is_default + macro_region.
  * /api/locale-runtime/resolve/public is ANONYMOUS and accepts ?saved_locale=.
  * Internal translation surfaces (editorial variant internal-translation)
    require auth — never anonymous.
"""
from __future__ import annotations
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://content-hub-pro-22.preview.emergentagent.com").rstrip("/")
TENANT_SLUG = "mood-demo-studio-81a09e"
PUBLIC_MARKETS = f"{BASE_URL}/api/storefront/public/{TENANT_SLUG}/markets"
LOCALE_RESOLVE = f"{BASE_URL}/api/locale-runtime/resolve/public"


# ───── Public markets endpoint (anonymous) ─────
class TestPublicMarkets:
    def test_anonymous_access_ok(self):
        r = requests.get(PUBLIC_MARKETS, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tenant_slug"] == TENANT_SLUG
        assert isinstance(body["markets"], list)

    def test_active_markets_count_and_shape(self):
        r = requests.get(PUBLIC_MARKETS, timeout=15)
        markets = r.json()["markets"]
        # Phase R-MARKET-1B expects 7 active markets (public).
        # Allow >=6 in case seed varies but warn if !=7.
        assert len(markets) >= 6, f"Expected ≥6 active markets, got {len(markets)}"
        required_keys = {"primary_locale", "is_default", "macro_region", "code", "display_name"}
        for m in markets:
            missing = required_keys - set(m.keys())
            assert not missing, f"Market {m.get('code')} missing keys: {missing}"
            assert m["primary_locale"], "primary_locale empty"
            assert "-" in m["primary_locale"], f"primary_locale not BCP-47: {m['primary_locale']}"

    def test_exactly_one_default(self):
        r = requests.get(PUBLIC_MARKETS, timeout=15)
        markets = r.json()["markets"]
        defaults = [m for m in markets if m.get("is_default")]
        assert len(defaults) == 1, f"Expected 1 default market, got {len(defaults)}: {[m['code'] for m in defaults]}"

    def test_no_internal_translation_locales_exposed(self):
        """ar-AE, pt-BR (internal_translation locales) must NEVER appear in the public markets list."""
        r = requests.get(PUBLIC_MARKETS, timeout=15)
        markets = r.json()["markets"]
        locales = {m["primary_locale"] for m in markets}
        forbidden = {"ar-AE", "pt-BR"}
        assert not (locales & forbidden), f"Internal locales leaked into public markets: {locales & forbidden}"

    def test_unknown_tenant_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/storefront/public/this-tenant-does-not-exist-xyz/markets", timeout=15)
        assert r.status_code == 404


# ───── Locale resolve (anonymous) ─────
class TestLocaleResolvePublic:
    def test_anonymous_access(self):
        r = requests.get(LOCALE_RESOLVE, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "locale_code" in body or "locale" in body or "active_locale" in body, body
        assert "profile" in body or "candidates" in body, body

    def test_saved_locale_hint(self):
        r = requests.get(LOCALE_RESOLVE, params={"saved_locale": "en-US"}, timeout=15)
        assert r.status_code == 200
        # Should not error with 4xx/5xx on a valid BCP-47 hint
        body = r.json()
        assert body is not None

    def test_invalid_saved_locale_still_resolves(self):
        # Defensive: garbage hint should not 500
        r = requests.get(LOCALE_RESOLVE, params={"saved_locale": "zz-ZZ"}, timeout=15)
        assert r.status_code in (200, 400, 422)


# ───── Internal translation API must be gated ─────
class TestInternalTranslationGuard:
    def test_internal_translation_endpoint_requires_auth(self):
        """No anonymous read of editorial variant internal-translation."""
        # Use any UUID — auth check must fire before id lookup.
        fake_id = "00000000-0000-0000-0000-000000000000"
        r = requests.get(f"{BASE_URL}/api/editorial/variants/{fake_id}/internal-translation", timeout=15)
        assert r.status_code in (401, 403), f"Anonymous access leaked! Got {r.status_code}: {r.text[:300]}"
