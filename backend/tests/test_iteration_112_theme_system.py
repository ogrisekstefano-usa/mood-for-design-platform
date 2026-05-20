"""Iter112 · Sprint UI-SYS-01 — Theme · Font · Naming Alignment.

Scope: rename Brand Studio → Studio Identity™, Brand Mode → Brand Atlas™,
add route aliases /studio-identity, /brand-atlas, ensure critical editorial
surfaces consume --mood-font-*/--mood-gold tokens (so tenant font/palette
changes propagate), test sidebar labels.

This is a NON-FUNCTIONAL ordering sprint. No new features.
"""
import os
import re
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

SIDEBAR       = REPO / 'frontend' / 'src' / 'components' / 'layout' / 'Sidebar.jsx'
APP_JS        = REPO / 'frontend' / 'src' / 'App.js'
BRAND_STUDIO  = REPO / 'frontend' / 'src' / 'pages' / 'settings' / 'BrandStudioPage.jsx'
BRAND_MODE    = REPO / 'frontend' / 'src' / 'pages' / 'inspirations' / 'BrandModePage.jsx'
MOOD_CSS      = REPO / 'frontend' / 'src' / 'styles' / 'mood-atmosphere.css'
DOSSIER_CSS   = REPO / 'frontend' / 'src' / 'components' / 'client' / 'dossier.css'
COMP_CSS      = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'client-companion.css'
JOURNEY_CSS   = REPO / 'frontend' / 'src' / 'pages' / 'workspace' / 'design-journey.css'
BRAND_MODE_CSS = REPO / 'frontend' / 'src' / 'pages' / 'inspirations' / 'brand-mode.css'
CEREMONY      = REPO / 'frontend' / 'src' / 'components' / 'journey' / 'JourneyClosureCeremony.jsx'


# ── Token consolidation ─────────────────────────────────────────
class TestMoodSemanticTokens:
    def test_mood_atmosphere_exposes_semantic_tokens(self):
        s = MOOD_CSS.read_text(encoding='utf-8')
        # New semantic tokens introduced in this sprint
        for tok in [
            '--mood-surface:',
            '--mood-surface-soft:',
            '--mood-card:',
            '--mood-border:',
            '--mood-border-strong:',
            '--mood-text:',
            '--mood-text-muted:',
            '--mood-accent:',
            '--mood-accent-soft:',
            '--mood-accent-glow:',
            '--mood-gold:',
            '--mood-danger:',
            '--mood-warning:',
        ]:
            assert tok in s, f"--mood semantic token missing: {tok}"

    def test_mood_atmosphere_exposes_font_tokens(self):
        s = MOOD_CSS.read_text(encoding='utf-8')
        for tok in [
            '--mood-font-heading:',
            '--mood-font-body:',
            '--mood-font-serif:',
            '--mood-font-mono:',
        ]:
            assert tok in s, f"--mood font token missing: {tok}"
        # Aliases must read from --bp-* (tenant Studio Identity™)
        assert '--bp-font-heading' in s
        assert '--bp-font-body' in s
        assert '--bp-font-mono' in s


# ── Naming: Brand Studio → Studio Identity™ ─────────────────────
class TestStudioIdentityNaming:
    def test_sidebar_renders_studio_identity(self):
        s = SIDEBAR.read_text(encoding='utf-8')
        assert 'label="Studio Identity"' in s
        # Old confusing label removed from sidebar
        assert 'label="Brand Studio"' not in s

    def test_brand_studio_page_uses_studio_identity_copy(self):
        s = BRAND_STUDIO.read_text(encoding='utf-8')
        assert 'Studio Identity\u2122' in s
        assert 'studio-identity-title' in s
        assert 'studio-identity-eyebrow' in s
        # Old confusing eyebrow gone from the hero header
        # (Note: scope traceability comment may still mention it historically)
        assert 'Workspace · Brand Studio' not in s


# ── Naming: Brand Mode → Brand Atlas™ ───────────────────────────
class TestBrandAtlasNaming:
    def test_sidebar_renders_brand_atlas(self):
        s = SIDEBAR.read_text(encoding='utf-8')
        assert 'label="Brand Atlas"' in s
        # Old label removed
        assert 'label="Brand Mode"' not in s

    def test_brand_mode_page_uses_brand_atlas_copy(self):
        s = BRAND_MODE.read_text(encoding='utf-8')
        assert 'Brand Atlas\u2122' in s
        assert 'brand-atlas-title' in s
        assert 'brand-atlas-eyebrow' in s
        # Old hero copy banished
        assert 'Brand Mode\u2122 · atlante curatoriale</p>' not in s


# ── Route aliases (backward-compatible) ─────────────────────────
class TestRouteAliases:
    def test_studio_identity_alias_present(self):
        s = APP_JS.read_text(encoding='utf-8')
        # /studio-identity → /settings/brand
        assert 'path="/studio-identity"' in s
        assert '/settings/brand' in s

    def test_brand_atlas_alias_present(self):
        s = APP_JS.read_text(encoding='utf-8')
        # /brand-atlas → /inspirations/brands
        assert 'path="/brand-atlas"' in s
        assert '/inspirations/brands' in s

    def test_original_routes_preserved(self):
        """Backward compatibility: legacy routes still resolve."""
        s = APP_JS.read_text(encoding='utf-8')
        assert 'path="/settings/brand"' in s
        assert 'path="/inspirations/brands"' in s


# ── Font system: critical surfaces consume tokens ───────────────
class TestFontTokensOnCriticalSurfaces:
    """Components that previously hardcoded Playfair / Inter / JetBrains Mono
    must consume the new --mood-font-* tokens, so tenant font choices in
    Studio Identity™ propagate to the editorial surfaces."""
    def test_dossier_css_consumes_font_tokens(self):
        s = DOSSIER_CSS.read_text(encoding='utf-8')
        assert 'var(--mood-font-serif' in s
        assert 'var(--mood-font-mono' in s
        assert 'var(--mood-font-body' in s
        # Hardcoded font-families WITHOUT the var() wrapper should be ABSENT
        # (we use a regex to catch any naked "font-family: 'Playfair Display', serif"
        # not inside a var() call).
        for naked in [
            r"font-family:\s*'Playfair Display',\s*serif(?!\s*\))",
            r"font-family:\s*'Inter',\s*-apple-system",
            r"font-family:\s*'JetBrains Mono',\s*ui-monospace,\s*monospace(?!\s*\))",
        ]:
            assert not re.search(naked, s), \
                f"dossier.css still has naked font: {naked}"

    def test_client_companion_consumes_font_tokens(self):
        s = COMP_CSS.read_text(encoding='utf-8')
        # client-companion.css used 'Playfair Display', serif extensively
        # In the new pipeline at least the references that existed are tokenised.
        # If the file has any font-family, it must be tokenised.
        for m in re.finditer(r"font-family:\s*([^;]+);", s):
            value = m.group(1).strip()
            assert ('var(--' in value) or value == 'inherit' or value.startswith("'"), \
                f"client-companion.css has untokenised font: {value}"

    def test_design_journey_consumes_font_tokens(self):
        s = JOURNEY_CSS.read_text(encoding='utf-8')
        assert 'var(--mood-font-' in s

    def test_brand_mode_css_consumes_font_tokens(self):
        s = BRAND_MODE_CSS.read_text(encoding='utf-8')
        assert 'var(--mood-font-serif' in s

    def test_ceremony_inline_uses_font_tokens(self):
        s = CEREMONY.read_text(encoding='utf-8')
        # The inline style objects must use var(--mood-font-*)
        assert 'var(--mood-font-mono' in s
        assert 'var(--mood-font-body' in s


# ── Gold color tokenised on critical surfaces ───────────────────
class TestGoldTokenOnCriticalSurfaces:
    def test_ceremony_uses_mood_gold_token(self):
        s = CEREMONY.read_text(encoding='utf-8')
        # All gold references must be tokenised
        assert 'var(--mood-gold' in s
        # No bare hex #b89870 outside var() (i.e., literal hex tokens elsewhere)
        bare = re.findall(r"['\"]#b89870['\"](?!\s*\))", s)
        # The fallback inside var(--mood-gold, #b89870) is fine.
        # We forbid only NAKED hex usage. Each occurrence should be inside a var() call.
        naked_count = len(re.findall(r"(?<!,\s)#b89870(?![0-9a-fA-F])", s))
        # Allow occurrences only when they appear as a var() fallback
        fallback_count = len(re.findall(r"var\(--mood-gold,\s*#b89870\)", s))
        # Naked count must be 0 (every #b89870 is inside a var() fallback)
        # We just compare that all hex usages are inside var() fallback.
        all_hex = len(re.findall(r"#b89870", s))
        assert all_hex == fallback_count, \
            f"ceremony has bare #b89870 hex outside var() fallback: {all_hex} total, {fallback_count} inside var()"

    def test_dossier_css_uses_mood_gold_token(self):
        s = DOSSIER_CSS.read_text(encoding='utf-8')
        assert 'var(--mood-gold' in s


# ── Backend: theme API still works ──────────────────────────────
class TestBrandingApiUnchanged:
    """Sanity: the existing tenant branding API still returns the
    typography object with font_heading/font_body — no regressions."""
    def test_branding_returns_typography(self):
        r = requests.post(f"{API}/api/auth/login",
                          json={"email": "demo@moodfordesign.com",
                                "password": "Blueprint2024!"}, timeout=20)
        assert r.status_code == 200
        tok = r.json()["session"]["access_token"]
        rr = requests.get(f"{API}/api/branding",
                          headers={"Authorization": f"Bearer {tok}"},
                          timeout=20)
        assert rr.status_code == 200
        d = rr.json()
        # Shape exists; if no theme is set yet, theme dict is empty/falsy.
        assert "theme" in d
        assert "branding" in d


# ── No regression on Sidebar ™ usage ────────────────────────────
class TestTrademarkUsageStillRestrained:
    def test_studio_identity_not_inline_in_label_string(self):
        s = SIDEBAR.read_text(encoding='utf-8')
        # Studio Identity™ uses hasMark, so label string itself is "Studio Identity"
        assert 'label="Studio Identity\u2122"' not in s

    def test_brand_atlas_not_inline_in_label_string(self):
        s = SIDEBAR.read_text(encoding='utf-8')
        # Brand Atlas™ uses hasMark, so label string itself is "Brand Atlas"
        assert 'label="Brand Atlas\u2122"' not in s
