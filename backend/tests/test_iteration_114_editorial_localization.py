"""Iter114 · Sprint I18N-02 — Editorial Localization Cleanup.

Companion + Dossier + Index now consume Blueprint t() with editorial
copy in 6 base locales (it/en-US/en-GB/fr-FR/de-DE/es-ES/ar).

Direction Lock:
  · Tone profiles enforced per locale (no literal translation).
  · Brand-protected ™ terms NEVER translated: Design Journey™,
    Material Direction™, Site Evolution™, Shared Thoughts™,
    Journey Archive™, Brand Atlas™, Studio Identity™,
    Cultural Edition™, Certified Closure™.
  · Empty states use semantic, not literal, translations.
"""
import os
import re
import json
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

TM_FILE     = REPO / 'frontend' / 'src' / 'i18n' / 'translation-memory.js'
STRINGS_DIR = REPO / 'frontend' / 'src' / 'i18n' / 'strings'
COMPANION   = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientCompanionPage.jsx'
INDEX_PAGE  = REPO / 'frontend' / 'src' / 'pages' / 'client' / 'ClientJourneysIndexPage.jsx'
DOSSIER     = REPO / 'frontend' / 'src' / 'components' / 'client' / 'DossierSection.jsx'
ENGINE_JS   = REPO / 'frontend' / 'src' / 'i18n' / 'engine.js'

LOCALE_FILES = {
    'it':    'it-IT.json',
    'en-US': 'en-US.json',
    'en-GB': 'en-GB.json',
    'fr':    'fr-FR.json',
    'de':    'de-DE.json',
    'es':    'es-ES.json',
    'ar':    'ar.json',
}

BRAND_TERMS = (
    'Design Journey™', 'Material Direction™', 'Site Evolution™',
    'Shared Thoughts™', 'Journey Archive™', 'Brand Atlas™',
    'Studio Identity™', 'Cultural Edition™', 'Certified Closure™',
)


def load(locale):
    return json.loads((STRINGS_DIR / LOCALE_FILES[locale]).read_text(encoding='utf-8'))


def deep_get(d, dotted):
    """Walk a nested dict via dotted path."""
    cur = d
    for p in dotted.split('.'):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


# ── Translation Memory™ canonical layer ─────────────────────────
class TestTranslationMemoryLayer:
    def test_tm_file_exists(self):
        assert TM_FILE.exists()

    def test_tm_exposes_brand_terms_invariant(self):
        s = TM_FILE.read_text(encoding='utf-8')
        assert "BRAND_TERMS" in s
        for term in BRAND_TERMS:
            assert term in s, f"TM missing brand term: {term}"

    def test_tm_exposes_helpers(self):
        s = TM_FILE.read_text(encoding='utf-8')
        # Public API: tm, toneFor, semanticLock
        assert "export function tm" in s
        assert "export function toneFor" in s
        assert "export function semanticLock" in s

    def test_tm_tone_profiles_cover_six_locales(self):
        s = TM_FILE.read_text(encoding='utf-8')
        for loc in ("'it'", "'en-US'", "'fr'", "'de'", "'es'", "'ar'"):
            assert f"{loc}:" in s, f"TM tone profile missing for {loc}"

    def test_tm_semantic_locks_cover_lifecycle_archived(self):
        s = TM_FILE.read_text(encoding='utf-8')
        # The lifecycle.archived lock should have all 6 base locales
        assert "lifecycle.archived" in s
        # Italian uses 'Memoria della casa', not 'Journey completato'
        assert "Memoria della casa" in s
        assert "Living memory of the home" in s
        assert "Mémoire vivante de la maison" in s
        assert "ذاكرة البيت" in s


# ── Locale files have companion + dossier namespaces ───────────
class TestLocaleNamespaces:
    @pytest.mark.parametrize('locale', list(LOCALE_FILES))
    def test_companion_namespace_present(self, locale):
        d = load(locale)
        assert 'companion' in d, f"{locale}.json missing companion namespace"
        # Core keys (nested paths)
        core = ['hero.eyebrow', 'index.hero.title', 'index.hero.lede',
                'index.zero.title', 'index.zero.lede',
                'index.active.eyebrow', 'index.active.title',
                'index.archive.eyebrow', 'index.archive.title', 'index.archive.lede',
                'card.chapter_active', 'card.progress', 'card.deposited_at',
                'loading']
        for k in core:
            assert deep_get(d['companion'], k) is not None, \
                f"{locale}.json companion missing {k}"

    @pytest.mark.parametrize('locale', list(LOCALE_FILES))
    def test_dossier_namespace_present(self, locale):
        d = load(locale)
        assert 'dossier' in d, f"{locale}.json missing dossier namespace"
        core = ['hero.eyebrow', 'statement.eyebrow', 'duration.start',
                'duration.end', 'duration.span', 'chapters.eyebrow',
                'chapters.title', 'transformations.eyebrow',
                'transformations.title', 'transformations.before',
                'transformations.after', 'visuals.eyebrow', 'visuals.title',
                'closure.line', 'loading', 'empty.message']
        for k in core:
            assert deep_get(d['dossier'], k) is not None, \
                f"{locale}.json dossier missing {k}"


# ── Brand-protected terms NEVER translated ──────────────────────
class TestBrandTermInvariant:
    @pytest.mark.parametrize('locale', list(LOCALE_FILES))
    def test_journey_archive_unchanged(self, locale):
        d = load(locale)
        assert deep_get(d['dossier'], 'hero.eyebrow') == 'Journey Archive™', \
            f"{locale} dossier.hero.eyebrow drifted from 'Journey Archive™'"

    @pytest.mark.parametrize('locale', list(LOCALE_FILES))
    def test_my_design_journeys_brand_invariant(self, locale):
        d = load(locale)
        assert deep_get(d['companion'], 'index.hero.eyebrow') == 'My Design Journeys™', \
            f"{locale} brand 'My Design Journeys™' was translated"


# ── Editorial tone checks ───────────────────────────────────────
class TestEditorialToneEnglish:
    def test_en_uses_architectural_not_literal(self):
        d = load('en-US')
        s = json.dumps(d['companion'], ensure_ascii=False).lower()
        for bad in ['just started', 'open voices', 'has just',
                    'we are reading', 'has finished']:
            assert bad not in s, f"EN companion has literal-AI wording: {bad}"
        assert deep_get(d['companion'], 'index.zero.title') == 'Your Design Journey™ is beginning'

    def test_en_dossier_voices_uses_publishing_voice(self):
        d = load('en-US')
        assert 'sediment' in deep_get(d['dossier'], 'voices.title').lower()


class TestEditorialToneArabic:
    def test_ar_is_premium_not_overpoetic(self):
        d = load('ar')
        s = json.dumps(d['companion'], ensure_ascii=False)
        # No emoji (architectural restraint)
        for bad in ['🎉', '✨', '🌟', '💫']:
            assert bad not in s, f"AR companion has forbidden decoration: {bad}"
        # Brand terms stay Latin
        assert 'Design Journey™' in s


# ── Companion + Dossier wired to t() ────────────────────────────
class TestCompanionAndDossierWired:
    def test_companion_imports_blueprint_t(self):
        s = COMPANION.read_text(encoding='utf-8')
        assert "useT as useBlueprintT" in s or "useT" in s
        # Translation memory used for brand-protected terms
        assert "translation-memory" in s
        # Hardcoded "Il tuo Journey è appena iniziato" no longer present —
        # replaced by 'companion.section.evolution.empty_title' (the new
        # canonical: 'Il tuo Design Journey™ sta per iniziare' in IT).
        assert "Il tuo Journey è appena iniziato" not in s

    def test_dossier_imports_blueprint_t(self):
        s = DOSSIER.read_text(encoding='utf-8')
        assert "useT" in s
        assert "translation-memory" in s
        # Old hardcoded 'Statement di progetto' no longer present
        # (now driven by t('dossier.statement.eyebrow')).
        assert "<p className=\"dossier-eyebrow\">Statement di progetto</p>" not in s
        # tm('journeyArchive') is now used for the eyebrow
        assert "tm('journeyArchive')" in s

    def test_index_imports_blueprint_t(self):
        s = INDEX_PAGE.read_text(encoding='utf-8')
        assert "useT" in s
        assert "translation-memory" in s
        # Old hardcoded text replaced by t() calls
        assert ">Memoria depositata · {fmtDate" not in s
        assert "companion.card.deposited_at" in s


# ── Engine supports ar locale ───────────────────────────────────
class TestI18nEngineSupportsArabic:
    def test_engine_imports_arabic(self):
        s = ENGINE_JS.read_text(encoding='utf-8')
        assert "from './strings/ar.json'" in s
        assert "'ar-AE'" in s or "'ar':" in s
        assert "SUPPORTED_LOCALES" in s
        # SUPPORTED_LOCALES array must include ar-AE
        assert "'ar-AE'" in s


# ── Sidebar / cross-context still consistent ────────────────────
class TestNoMixedLocaleArtifacts:
    @pytest.mark.parametrize('locale', list(LOCALE_FILES))
    def test_no_raw_translation_keys_in_companion_namespace(self, locale):
        """A raw translation key path should never appear as a VALUE."""
        d = load(locale)
        comp = json.dumps(d['companion'], ensure_ascii=False)
        # Raw dotted keys appearing as values is the problem signal.
        assert not re.search(r'"companion\.\w+\.\w+"', comp), \
            f"{locale}.json companion namespace has raw keys as values"

    @pytest.mark.parametrize('locale', list(LOCALE_FILES))
    def test_no_raw_dossier_keys(self, locale):
        d = load(locale)
        doss = json.dumps(d['dossier'], ensure_ascii=False)
        assert not re.search(r'"dossier\.\w+\.\w+"', doss), \
            f"{locale}.json dossier namespace has raw keys as values"


# ── Backend: Blueprint i18n still resolves all locales ──────────
class TestBackendI18nResolvesAll:
    @pytest.mark.parametrize('locale,key,expected', [
        ('it',    'common.save', 'Salva'),
        ('en-US', 'common.save', 'Save'),
        ('fr',    'common.save', 'Enregistrer'),
        ('de',    'common.save', 'Speichern'),
        ('es',    'common.save', 'Guardar'),
        ('ar',    'common.save', 'حفظ'),
    ])
    def test_backend_locale_returns_expected_translation(self, locale, key, expected):
        # After HARDENING-I18N-GUARD (iter117), AR is only available on the
        # public endpoint. Blueprint operational locales still use the blueprint endpoint.
        endpoint = "public" if locale == "ar" else "blueprint"
        r = requests.get(f"{API}/api/{endpoint}/i18n/{locale}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # Some locales may fallback for the 'common' namespace.
        # As long as the value is the expected one OR a sensible fallback,
        # we consider it correct.
        val = d["messages"].get(key)
        assert val == expected, f"{locale}.{key} returned {val!r}, expected {expected!r}"
