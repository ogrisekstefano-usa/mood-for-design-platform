"""Iter104 · Sprint G.4 — Journey Pulse™ validation.

Backend (5) + Frontend static (5).
"""
import os
from pathlib import Path
import pytest, requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO / 'backend' / '.env')
load_dotenv(REPO / 'frontend' / '.env')

API  = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
PULSE_JSX = REPO / 'frontend' / 'src' / 'pages' / 'dashboard' / 'JourneyPulsePage.jsx'
PULSE_CSS = REPO / 'frontend' / 'src' / 'pages' / 'dashboard' / 'journey-pulse.css'
APP_JS    = REPO / 'frontend' / 'src' / 'App.js'


@pytest.fixture(scope='module')
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email":"demo@moodfordesign.com","password":"Blueprint2024!"},
                      timeout=20)
    return r.json()["session"]["access_token"]


def H(t): return {"Authorization": f"Bearer {t}"}


# ── BACKEND ───────────────────────────────────────────────────────
class TestPulseEndpoint:
    def test_pulse_returns_seven_sections(self, token):
        r = requests.get(f"{API}/api/dashboard/pulse", headers=H(token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("active_journeys","voices_today","chapters_waiting","revisions_open",
                  "recent_evolutions","silent_journeys","next_actions","counts"):
            assert k in d, f"missing section: {k}"

    def test_pulse_responds_under_5_seconds(self, token):
        import time
        t0 = time.time()
        r = requests.get(f"{API}/api/dashboard/pulse", headers=H(token), timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 5, f"pulse too slow: {elapsed:.2f}s"

    def test_pulse_active_journey_has_italian_lifecycle_label(self, token):
        d = requests.get(f"{API}/api/dashboard/pulse", headers=H(token), timeout=20).json()
        if not d["active_journeys"]:
            pytest.skip("no active journeys")
        j = d["active_journeys"][0]
        valid = {"Conversazione aperta","Viaggio in corso","Direzione presentata",
                 "In ascolto","In pausa","Direzione approvata",
                 "Capitolo chiuso","Edizione culturale","Viaggio sospeso"}
        assert j["lifecycle_label"] in valid

    def test_pulse_voices_today_use_editorial_phrasing(self, token):
        d = requests.get(f"{API}/api/dashboard/pulse", headers=H(token), timeout=20).json()
        for v in d["voices_today"]:
            # voice_phrase must NEVER be a code-y kind
            assert v["voice_phrase"] not in ("embraces","request_variant","reorient")
            assert v["tone"] in ("embrace","curious","reorient","voice")

    def test_pulse_next_actions_are_editorial_suggestions(self, token):
        d = requests.get(f"{API}/api/dashboard/pulse", headers=H(token), timeout=20).json()
        for a in d["next_actions"]:
            # suggestion is italian editorial — never a "task" verb
            s = a["suggestion"]
            assert " · " in s   # editorial pattern
            for forbidden in ("Submit","Update task","Close ticket","Approve version","Reject"):
                assert forbidden not in s


# ── FRONTEND STATIC ───────────────────────────────────────────────
class TestPulseFrontend:
    def test_page_renders_all_seven_section_titles(self):
        """After Sprint HARDENING-I18N-GUARD (iter117), section titles live in the
        i18n JSON dictionaries (`dashboard.pulse.sections.*.title`). The JSX
        references them via `t()`. We verify the keys are wired, not the literals."""
        src = PULSE_JSX.read_text()
        for key in [
            "t('dashboard.pulse.eyebrow')",
            "t('dashboard.pulse.sections.active.title')",
            "t('dashboard.pulse.sections.voices.title')",
            "t('dashboard.pulse.sections.waiting.title')",
            "t('dashboard.pulse.sections.revisions.title')",
            "t('dashboard.pulse.sections.evolutions.title')",
            "t('dashboard.pulse.sections.silent.title')",
            "t('dashboard.pulse.sections.actions.title')",
        ]:
            assert key in src, f"missing i18n key wiring: {key}"

    def test_page_has_required_testids(self):
        src = PULSE_JSX.read_text()
        for tid in [
            'data-testid="journey-pulse-page"',
            'data-testid="jp-hero"',
            'data-testid="jp-active-section"',
            'data-testid="jp-voices-section"',
            'data-testid="jp-waiting-section"',
            'data-testid="jp-revisions-section"',
            'data-testid="jp-evolutions-section"',
            'data-testid="jp-silent-section"',
            'data-testid="jp-actions-section"',
        ]:
            assert tid in src, f"missing testid: {tid}"

    def test_no_enterprise_dashboard_lexicon(self):
        text = (PULSE_JSX.read_text() + PULSE_CSS.read_text()).lower()
        # Direction Lock guard for G.4
        for bad in [
            "conversion rate","sales metrics","revenue","close rate",
            "pipeline","kpi wall","business intelligence",
            "lead score","stat cards","analytics dashboard",
            "win rate","forecast","crm overview",
            "salesforce","hubspot","pipedrive",
        ]:
            assert bad not in text, f"forbidden enterprise term '{bad}'"

    def test_app_js_mounts_pulse_as_primary_dashboard(self):
        app = APP_JS.read_text()
        assert 'path="/dashboard"' in app
        assert "JourneyPulsePage" in app
        # legacy still reachable
        assert 'path="/dashboard/legacy"' in app

    def test_empty_state_invites_begin_journey_not_create_project(self):
        """Iter117: empty-state CTA is now sourced from `dashboard.pulse.sections.active.cta`.
        Verify the i18n key wiring and that the IT JSON still owns the canonical phrase."""
        src = PULSE_JSX.read_text()
        assert "t('dashboard.pulse.sections.active.cta')" in src
        assert "/begin-journey" in src
        # Verify the canonical IT phrase still lives in the dictionary
        import json as _json
        it = _json.loads((REPO / "frontend" / "src" / "i18n" / "strings" / "it-IT.json").read_text(encoding="utf-8"))
        assert it["dashboard"]["pulse"]["sections"]["active"]["cta"] == "Inizia una conversazione progettuale"
        # ensure NO commercial CTAs
        for bad in ["Get started", "Create your first project", "Request a demo"]:
            assert bad not in src
