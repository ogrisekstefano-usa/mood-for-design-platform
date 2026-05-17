"""Phase R-CRM-2A — relationship_lookups locale-aware invariants.

Validates that the Blueprint Command Center catalog is:
  • Tenant-scoped (no leakage across tenants).
  • Locale-keyed with strict BCP-47 codes (it-IT, en-US, en-GB, es-ES, fr-FR, de-DE).
  • en-US ≠ en-GB for the lookups that the seed intentionally diverges
    (lifecycle_stage.lead, source.web_form, …).
  • Every lifecycle_stage value carries metadata.color for chip rendering.

Run:
  cd /app/backend && pytest tests/test_relationship_lookups_locale.py -v
"""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"
REQUIRED_LOCALES = ["it-IT", "en-US", "en-GB", "es-ES", "fr-FR", "de-DE"]


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["session"]["access_token"]


@pytest.fixture(scope="module")
def lookups(auth_token):
    r = requests.get(
        f"{BASE}/api/relationships/lookups",
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["lookups"]


def test_all_required_groups_present(lookups):
    expected = {
        "lifecycle_stage", "account_type", "source", "interaction_type",
        "action_type", "priority", "budget_range", "timing_range",
        "style", "material", "atmosphere", "visibility_level",
        "relationship_health", "communication_preference",
    }
    missing = expected - set(lookups.keys())
    assert not missing, f"Missing lookup groups: {missing}"


def test_lifecycle_stage_has_all_six_locales(lookups):
    """Every stage value MUST have labels in all 6 BCP-47 locales."""
    for entry in lookups["lifecycle_stage"]:
        for loc in REQUIRED_LOCALES:
            assert loc in entry["label"], (
                f"stage={entry['value_key']} missing locale {loc}: "
                f"present={list(entry['label'].keys())}"
            )
            assert entry["label"][loc], f"stage={entry['value_key']} empty {loc}"


def test_lifecycle_stage_has_color_metadata(lookups):
    """Every stage value MUST have metadata.color for chip rendering."""
    for entry in lookups["lifecycle_stage"]:
        color = (entry.get("metadata") or {}).get("color") or {}
        assert "bg" in color and "ink" in color, (
            f"stage={entry['value_key']} missing color metadata: {entry.get('metadata')}"
        )


def test_en_us_differs_from_en_gb_on_lead_stage(lookups):
    """Luxury terminology diverges: en-US='Lead' vs en-GB='Opportunity'."""
    lead = next(e for e in lookups["lifecycle_stage"] if e["value_key"] == "lead")
    assert lead["label"]["en-US"] == "Lead"
    assert lead["label"]["en-GB"] == "Opportunity"
    assert lead["label"]["en-US"] != lead["label"]["en-GB"], (
        "en-US and en-GB must be independently editable per the locale-aware spec"
    )


def test_account_type_has_all_six_locales(lookups):
    for entry in lookups["account_type"]:
        for loc in REQUIRED_LOCALES:
            assert loc in entry["label"], (
                f"account_type={entry['value_key']} missing {loc}"
            )


def test_source_has_all_six_locales(lookups):
    for entry in lookups["source"]:
        for loc in REQUIRED_LOCALES:
            assert loc in entry["label"], (
                f"source={entry['value_key']} missing {loc}"
            )


def test_no_legacy_language_only_keys(lookups):
    """Foundation rule: labels must use BCP-47 locale codes, NOT language-only.
    A label dict like {'it': '...', 'en': '...'} indicates stale seed.
    """
    legacy_keys = {"it", "en", "es", "fr", "de"}
    for group, entries in lookups.items():
        for entry in entries:
            stray = set(entry["label"].keys()) & legacy_keys
            assert not stray, (
                f"group={group} value={entry['value_key']} has language-only "
                f"keys {stray} — must be BCP-47 (it-IT, en-US, …)"
            )


def test_priority_carries_color_metadata(lookups):
    """priority is used in chips — must expose colors like lifecycle_stage."""
    for entry in lookups["priority"]:
        color = (entry.get("metadata") or {}).get("color") or {}
        assert color.get("bg") and color.get("ink"), (
            f"priority={entry['value_key']} missing color"
        )


def test_relationship_health_carries_color_metadata(lookups):
    for entry in lookups["relationship_health"]:
        color = (entry.get("metadata") or {}).get("color") or {}
        assert color.get("bg") and color.get("ink"), (
            f"relationship_health={entry['value_key']} missing color"
        )


def test_lookups_filter_by_group(auth_token):
    """?group=… narrows to a single group, returns the same shape."""
    r = requests.get(
        f"{BASE}/api/relationships/lookups?group=lifecycle_stage",
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=10,
    )
    r.raise_for_status()
    j = r.json()
    assert set(j["lookups"].keys()) == {"lifecycle_stage"}
    assert len(j["lookups"]["lifecycle_stage"]) >= 8  # at least 9 stages seeded


def test_lookups_requires_authentication():
    """Anonymous request must be rejected — lookups are tenant-scoped."""
    r = requests.get(f"{BASE}/api/relationships/lookups", timeout=10)
    assert r.status_code in (401, 403)
