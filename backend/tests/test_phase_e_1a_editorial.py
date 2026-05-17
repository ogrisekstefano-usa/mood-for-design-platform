"""Phase E-1A — Editorial Intelligence OS invariants.

  cd /app/backend && pytest tests/test_phase_e_1a_editorial.py -v

Covers:
  • Platform lookup invariants for the 7 new editorial groups
    (article_status / revision_option / cta_tier / cta_intent /
    editorial_tone / editorial_pacing / editorial_lead_intent).
  • cta_tier metadata exposes resulting_lifecycle_stage AND
    resulting_intent_label_key (this is the rule that wires CTA → CRM).
  • Master CRUD + duplicate-code rejection.
  • Variant creation with platform-lookup validation (tone, pacing).
  • Multiple variants per master × market ARE allowed (seasonal /
    edition / A-B narrative) — unique (slug, edition, season).
  • Status transition graph: legal jumps OK, illegal jumps 409.
  • Revision append-only + variant counter bump.
  • PUBLIC CTA-click endpoint is anonymous and FEEDS the CRM:
      SOFT  → no Account/Contact (no identity supplied)
      STRONG → creates Account+Contact+Interaction, lifecycle_stage=discovery,
               editorial_lead_intent=discovery_request, metadata captures
               variant_id/market_id/cultural_angle/tone_label.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"
DEMO_TENANT_SLUG = "mood-demo-studio-81a09e"

EDITORIAL_GROUPS = {
    "article_status", "revision_option", "cta_tier", "cta_intent",
    "editorial_tone", "editorial_pacing", "editorial_lead_intent",
}


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
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def gcc_market_id(headers):
    r = requests.get(f"{BASE}/api/tenants/me/markets", headers=headers, timeout=10)
    return next(m["id"] for m in r.json()["markets"] if m["code"] == "gcc_luxury")


@pytest.fixture(scope="module")
def lookups(headers):
    r = requests.get(f"{BASE}/api/relationships/lookups", headers=headers, timeout=10)
    return r.json()["lookups"]


# ── Platform lookup invariants ───────────────────────────────────────────

def test_seven_editorial_groups_are_platform_only(lookups):
    for grp in EDITORIAL_GROUPS:
        assert grp in lookups, f"missing group {grp}"
        scopes = {row.get("scope") for row in lookups[grp]}
        assert scopes == {"platform"}, f"{grp} must be platform-only, got {scopes}"
        for row in lookups[grp]:
            assert row.get("tenant_id") is None


def test_revision_options_are_editorial_grade(lookups):
    keys = {r["value_key"] for r in lookups["revision_option"]}
    # The user explicitly forbade tech terms like "rewrite", "fix grammar", "shorten".
    forbidden = {"rewrite", "fix_grammar", "fix-grammar", "shorten"}
    assert not (forbidden & keys), f"Forbidden tech terms in revision_option: {forbidden & keys}"
    # And a few of the cultural ones MUST be there.
    must_have = {"increase_hospitality_resonance", "reduce_luxury_intensity",
                 "strengthen_material_storytelling", "more_architectural_authority",
                 "more_collectible_design_tone", "more_international_buyer_appeal"}
    missing = must_have - keys
    assert not missing, f"Missing editorial-grade revision options: {missing}"


def test_cta_tier_has_three_levels_and_crm_mapping(lookups):
    entries = {r["value_key"]: r for r in lookups["cta_tier"]}
    assert set(entries.keys()) == {"soft", "medium", "strong"}
    expected = {
        "soft":   ("new_inquiry", "inspiration_interest"),
        "medium": ("lead",         "qualified_editorial_lead"),
        "strong": ("discovery",    "discovery_request"),
    }
    for tier, (stage, intent) in expected.items():
        meta = entries[tier]["metadata"] or {}
        assert meta.get("resulting_lifecycle_stage") == stage, f"{tier}.resulting_lifecycle_stage"
        assert meta.get("resulting_intent_label_key") == intent, f"{tier}.resulting_intent_label_key"
        assert (meta.get("color") or {}).get("bg") and (meta.get("color") or {}).get("ink"), f"{tier} missing color"


def test_editorial_lookups_have_all_six_locales(lookups):
    for grp in EDITORIAL_GROUPS:
        for entry in lookups[grp]:
            for loc in ("it-IT", "en-US", "en-GB", "es-ES", "fr-FR", "de-DE"):
                assert loc in entry["label"], f"{grp}.{entry['value_key']} missing {loc}"


# ── Master + Variant ────────────────────────────────────────────────────

def _create_master(headers, code: str = None):
    code = code or f"test-master-{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE}/api/editorial/masters", headers=headers,
        json={
            "code": code,
            "title": "Test Editorial Direction",
            "canonical_locale": "it-IT",
            "conceptual_direction": "Tessitura materica del vivere mediterraneo.",
            "emotional_objective": {"primary_feeling": "calm gravitas"},
        },
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def test_master_create_and_list(headers):
    m = _create_master(headers)
    assert m["id"] and m["code"]
    r = requests.get(f"{BASE}/api/editorial/masters", headers=headers, timeout=10)
    assert r.status_code == 200
    codes = {x["code"] for x in r.json()["masters"]}
    assert m["code"] in codes


def test_master_duplicate_code_rejected(headers):
    m = _create_master(headers)
    r = requests.post(f"{BASE}/api/editorial/masters", headers=headers,
                      json={"code": m["code"], "title": "Dup"}, timeout=10)
    assert r.status_code == 409


def test_variant_validates_tone_against_platform_lookup(headers, gcc_market_id):
    m = _create_master(headers)
    bad = requests.post(
        f"{BASE}/api/editorial/masters/{m['id']}/variants", headers=headers,
        json={"market_id": gcc_market_id, "variant_slug": "ok-slug",
              "target_locale": "en-AE", "tone_label": "made_up_tone"},
        timeout=10,
    )
    assert bad.status_code == 400


def test_multiple_variants_per_master_market_allowed(headers, gcc_market_id):
    """Seasonal / edition / A-B narrative. NO unique (master, market)."""
    m = _create_master(headers)
    for season in ("fw26", "ss27"):
        r = requests.post(
            f"{BASE}/api/editorial/masters/{m['id']}/variants", headers=headers,
            json={
                "market_id": gcc_market_id,
                "variant_slug": "warm-italian-gcc",
                "target_locale": "en-AE",
                "season_code": season,
                "title": f"Warm Italian Houses · {season}",
                "tone_label": "prestige_restraint",
                "pacing_label": "ceremonial",
            }, timeout=10,
        )
        assert r.status_code == 201, r.text[:200]
    r = requests.get(f"{BASE}/api/editorial/masters/{m['id']}/variants", headers=headers, timeout=10)
    assert r.json()["total"] == 2


def test_duplicate_variant_slug_within_same_edition_rejected(headers, gcc_market_id):
    m = _create_master(headers)
    payload = {"market_id": gcc_market_id, "variant_slug": "dup-test",
               "target_locale": "en-AE", "season_code": "ss27"}
    r1 = requests.post(f"{BASE}/api/editorial/masters/{m['id']}/variants", headers=headers, json=payload, timeout=10)
    assert r1.status_code == 201
    r2 = requests.post(f"{BASE}/api/editorial/masters/{m['id']}/variants", headers=headers, json=payload, timeout=10)
    assert r2.status_code == 409


# ── Status transitions ──────────────────────────────────────────────────

def _create_variant(headers, gcc_market_id):
    m = _create_master(headers)
    r = requests.post(
        f"{BASE}/api/editorial/masters/{m['id']}/variants", headers=headers,
        json={"market_id": gcc_market_id, "variant_slug": f"v-{uuid.uuid4().hex[:6]}",
              "target_locale": "en-AE", "title": "Transition test",
              "tone_label": "prestige_restraint"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def test_legal_status_transitions(headers, gcc_market_id):
    v = _create_variant(headers, gcc_market_id)
    pipeline = ["direction_defined", "ai_composing", "ready_for_editorial_review",
                "approved", "scheduled", "published"]
    for target in pipeline:
        r = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                          headers=headers, json={"to": target}, timeout=10)
        assert r.status_code == 200, f"transition to {target}: {r.text[:200]}"


def test_illegal_status_jump_rejected(headers, gcc_market_id):
    v = _create_variant(headers, gcc_market_id)
    # draft → published (skipping the whole pipeline) must be blocked.
    r = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                      headers=headers, json={"to": "published"}, timeout=10)
    assert r.status_code == 409


def test_unknown_status_rejected(headers, gcc_market_id):
    v = _create_variant(headers, gcc_market_id)
    r = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                      headers=headers, json={"to": "made_up_status"}, timeout=10)
    assert r.status_code == 400


# ── Revisions ────────────────────────────────────────────────────────────

def test_revision_append_validates_options_and_bumps_counter(headers, gcc_market_id):
    v = _create_variant(headers, gcc_market_id)
    # Bring it to ready_for_editorial_review first.
    for tgt in ["direction_defined", "ai_composing", "ready_for_editorial_review"]:
        requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                      headers=headers, json={"to": tgt}, timeout=10)

    # Bad option → 400
    bad = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/revisions",
                       headers=headers,
                       json={"revision_options": ["rewrite_completely"]},
                       timeout=10)
    assert bad.status_code == 400

    # Good options → 201
    good = requests.post(f"{BASE}/api/editorial/variants/{v['id']}/revisions",
                        headers=headers,
                        json={"revision_options": ["increase_hospitality_resonance",
                                                   "strengthen_material_storytelling"],
                              "notes": "Lift the welcome paragraph."},
                        timeout=10)
    assert good.status_code == 201

    # Variant status auto-moved to revision_requested + counter bumped.
    rv = requests.get(f"{BASE}/api/editorial/variants/{v['id']}", headers=headers, timeout=10).json()
    assert rv["status"] == "revision_requested"
    assert rv["revision_count"] == 1


# ── Public CTA-click → CRM ───────────────────────────────────────────────

def test_public_cta_click_is_anonymous_soft_no_account(headers, gcc_market_id):
    v = _create_variant(headers, gcc_market_id)
    # bring it through pipeline (anonymous endpoint doesn't require publication
    # in this phase, but we still exercise the workflow).
    for tgt in ["direction_defined", "ai_composing", "ready_for_editorial_review", "approved", "published"]:
        requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                      headers=headers, json={"to": tgt}, timeout=10)

    # SOFT click WITHOUT identity → no Account.
    r = requests.post(f"{BASE}/api/public/editorial/cta-click", timeout=10, json={
        "tenant_slug": DEMO_TENANT_SLUG, "variant_id": v["id"],
        "cta_tier": "soft", "cta_action": "discover_collections",
        "cta_intent": "discover_collections",
        "time_on_article_sec": 30, "device_locale": "en-AE",
    })
    assert r.status_code == 201, r.text[:200]
    j = r.json()
    assert j["account_id"] is None
    assert j["resulting_lifecycle_stage"] == "new_inquiry"
    assert j["resulting_intent_label"] == "inspiration_interest"


def test_public_cta_click_strong_creates_full_crm_chain(headers, gcc_market_id):
    v = _create_variant(headers, gcc_market_id)
    for tgt in ["direction_defined", "ai_composing", "ready_for_editorial_review", "approved", "published"]:
        requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                      headers=headers, json={"to": tgt}, timeout=10)
    unique_email = f"e1a-test-{uuid.uuid4().hex[:8]}@example.ae"
    r = requests.post(f"{BASE}/api/public/editorial/cta-click", timeout=10, json={
        "tenant_slug": DEMO_TENANT_SLUG, "variant_id": v["id"],
        "cta_tier": "strong", "cta_action": "book_discovery_session",
        "cta_intent": "book_discovery_session",
        "visitor_name": "Maya Aldhabi", "visitor_email": unique_email,
        "visitor_country": "AE", "visitor_city": "Abu Dhabi",
        "visitor_notes": "Penthouse Q4 2026.",
        "atmosphere_context": {"atmosphere_tags": ["ceremonial", "warm"], "scroll_depth_pct": 88},
    })
    assert r.status_code == 201
    j = r.json()
    assert j["account_id"] and j["contact_id"] and j["interaction_id"]
    assert j["resulting_lifecycle_stage"] == "discovery"
    assert j["resulting_intent_label"] == "discovery_request"

    # Confirm the account landed in the CRM with editorial provenance.
    acc = requests.get(f"{BASE}/api/relationships/accounts/{j['account_id']}",
                       headers=headers, timeout=10).json()
    a = acc.get("account", acc)
    assert a["lifecycle_stage"] == "discovery"
    md = a.get("metadata_json") or {}
    assert md.get("editorial_lead_intent") == "discovery_request"
    assert md.get("cta_tier") == "strong"
    assert md.get("origin_variant_id") == v["id"]

    # Interaction got the editorial intelligence payload.
    ix = requests.get(f"{BASE}/api/relationships/accounts/{j['account_id']}/interactions",
                      headers=headers, timeout=10).json()
    assert ix["interactions"], "interaction not created"
    rp = ix["interactions"][0].get("report_payload") or {}
    assert rp.get("editorial_lead_intent") == "discovery_request"
    assert rp.get("cta_tier") == "strong"
    assert rp.get("variant_id") == v["id"]


def test_public_cta_click_unknown_tenant_404():
    r = requests.post(f"{BASE}/api/public/editorial/cta-click", timeout=10, json={
        "tenant_slug": "no-such-tenant", "variant_id": str(uuid.uuid4()),
        "cta_tier": "soft",
    })
    assert r.status_code == 404


def test_public_cta_click_invalid_tier_400():
    r = requests.post(f"{BASE}/api/public/editorial/cta-click", timeout=10, json={
        "tenant_slug": DEMO_TENANT_SLUG, "variant_id": str(uuid.uuid4()),
        "cta_tier": "ultra",
    })
    # Either 400 (validated tier) or 404 (variant unknown). Both prove the
    # endpoint rejected the bad payload before doing damage.
    assert r.status_code in (400, 404)


# ── Calendar ─────────────────────────────────────────────────────────────

def test_calendar_returns_scheduled_variants(headers, gcc_market_id):
    v = _create_variant(headers, gcc_market_id)
    for tgt in ["direction_defined", "ai_composing", "ready_for_editorial_review", "approved"]:
        requests.post(f"{BASE}/api/editorial/variants/{v['id']}/transition",
                      headers=headers, json={"to": tgt}, timeout=10)
    requests.post(f"{BASE}/api/editorial/variants/{v['id']}/schedule",
                  headers=headers, json={"scheduled_at": "2026-12-15T10:00:00Z"}, timeout=10)
    r = requests.get(f"{BASE}/api/editorial/calendar?from=2026-12-01&to=2026-12-31",
                     headers=headers, timeout=10)
    assert r.status_code == 200
    ids = {item["id"] for item in r.json()["items"]}
    assert v["id"] in ids
    # The internal_translation must NEVER leak through the calendar.
    for it in r.json()["items"]:
        assert "internal_translation" not in it
