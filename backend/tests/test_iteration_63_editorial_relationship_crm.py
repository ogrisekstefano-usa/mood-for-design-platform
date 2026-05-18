"""Iteration 63 — Editorial Relationship CRM™ backend tests.

Tests Phase R-CRM-2 endpoints introduced in /app/backend/routers/relationships.py:
  • Engagement signals (POST/GET)
  • Affinities (GET + POST recompute)
  • Project / inspiration / material-affinity / market linkages
  • Intelligence dashboard view
  • Editorial Journey lookups (10 canonical stages)
  • Regression on R-CRM-1 endpoints

Run:
  cd /app && python -m pytest backend/tests/test_iteration_63_editorial_relationship_crm.py -v
"""
from __future__ import annotations

import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"

DEMO_EMAIL = "demo@moodfordesign.com"
DEMO_PASSWORD = "Blueprint2024!"

CANONICAL_JOURNEY_STAGES = {
    "discovery",
    "inspiration",
    "editorial_engagement",
    "project_conversation",
    "material_exploration",
    "strategic_direction",
    "specification",
    "proposal",
    "active_collaboration",
    "long_term_relationship",
}


# ─── Fixtures ────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def headers():
    r = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    token = r.json()["session"]["access_token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def account_id(headers):
    r = requests.get(f"{BASE}/api/relationships/accounts", headers=headers, timeout=15)
    r.raise_for_status()
    payload = r.json()
    items = payload.get("accounts") or payload.get("data") or []
    assert items, "No accounts in demo tenant — cannot run tests"
    return items[0]["id"]


@pytest.fixture(scope="module")
def cleanup_state():
    """Holds ids/uuids created during tests so we can clean up at the end."""
    return {
        "project_ids": [],
        "reference_ids": [],
        "material_ids": [],
        "market_ids": [],
    }


# ─── Lookups: 10 Editorial Journey canonical stages ──────────────────

def test_lookups_contains_canonical_journey_stages(headers):
    r = requests.get(f"{BASE}/api/relationships/lookups", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    payload = r.json()
    # The response shape is {lookups: {group_key: [rows]}, total: N}
    lookups = payload.get("lookups") or {}
    lifecycle = lookups.get("lifecycle_stage") or []
    assert lifecycle, f"No lifecycle_stage group returned in lookups (keys: {list(lookups.keys())})"
    value_keys = {row.get("value_key") for row in lifecycle}
    missing = CANONICAL_JOURNEY_STAGES - value_keys
    assert not missing, (
        f"Missing canonical Editorial Journey stages: {missing}. "
        f"Got value_keys: {value_keys}"
    )

    # Check metadata for at least one canonical stage
    canonical_rows = [
        row for row in lifecycle
        if row.get("value_key") in CANONICAL_JOURNEY_STAGES
    ]
    assert canonical_rows
    flagged = [
        r for r in canonical_rows
        if (r.get("metadata") or {}).get("canonical") is True
        and (r.get("metadata") or {}).get("editorial_journey") is True
    ]
    assert flagged, (
        "Expected at least some canonical journey stage rows to have "
        "metadata.canonical=true AND metadata.editorial_journey=true. "
        f"Sample row: {canonical_rows[0]}"
    )


# ─── Engagement signals: POST + GET + filter ─────────────────────────

def test_post_engagement_signal(headers, account_id):
    body = {
        "signal_type": "viewed_article",
        "editorial_register": "Ceremonial Hospitality",
        "atmosphere_tags": ["mediterranean", "stone"],
        "cta_intent": "private_consultation",
        "signal_weight": 1.5,
    }
    r = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/engagement",
        headers=headers,
        json=body,
        timeout=15,
    )
    assert r.status_code == 201, f"POST engagement failed: {r.status_code} {r.text}"
    data = r.json()
    sig = data.get("signal")
    assert sig, f"No 'signal' in response: {data}"
    assert sig.get("id"), "signal.id missing"
    assert sig.get("account_id") == account_id
    assert sig.get("occurred_at"), "signal.occurred_at missing"
    assert sig.get("signal_type") == "viewed_article"
    assert sig.get("editorial_register") == "Ceremonial Hospitality"
    assert sig.get("cta_intent") == "private_consultation"
    assert sig.get("atmosphere_tags") == ["mediterranean", "stone"]


def test_get_engagement_signals_lists_and_filters(headers, account_id):
    # Unfiltered list — newest first
    r = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/engagement",
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    signals = r.json().get("signals") or []
    assert isinstance(signals, list)
    assert len(signals) >= 1, "Expected at least the signal created in previous test"
    # newest first — timestamps non-increasing
    ts = [s.get("occurred_at") for s in signals if s.get("occurred_at")]
    assert ts == sorted(ts, reverse=True), "signals not ordered newest-first"

    # Filter by signal_type
    r2 = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/engagement"
        "?signal_type=viewed_article",
        headers=headers,
        timeout=15,
    )
    assert r2.status_code == 200
    filtered = r2.json().get("signals") or []
    assert all(s.get("signal_type") == "viewed_article" for s in filtered), \
        f"Filter not applied: {filtered}"
    assert len(filtered) >= 1


# ─── Affinities: POST recompute + GET ────────────────────────────────

def test_post_affinities_recompute(headers, account_id):
    r = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/affinities/recompute",
        headers=headers,
        timeout=20,
    )
    assert r.status_code == 200, f"recompute failed: {r.status_code} {r.text}"
    aff = r.json().get("affinities")
    assert aff, f"No 'affinities' in response: {r.json()}"
    assert aff.get("account_id") == account_id
    assert aff.get("signal_count_total", 0) > 0, \
        f"signal_count_total should be > 0 after logging signal, got {aff}"
    assert aff.get("computed_at"), "computed_at missing"
    # Heuristic outcomes derived from the test signal
    assert aff.get("preferred_atmosphere") == "mediterranean", \
        f"preferred_atmosphere mismatch: {aff.get('preferred_atmosphere')}"
    assert aff.get("preferred_cta_intent") == "private_consultation", \
        f"preferred_cta_intent mismatch: {aff.get('preferred_cta_intent')}"
    assert aff.get("preferred_editorial_register") == "Ceremonial Hospitality", \
        f"preferred_editorial_register mismatch: {aff.get('preferred_editorial_register')}"


def test_get_affinities_returns_snapshot(headers, account_id):
    r = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/affinities",
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    aff = r.json().get("affinities")
    assert aff is not None, "affinities not present after recompute"
    assert aff.get("account_id") == account_id
    assert aff.get("preferred_atmosphere") == "mediterranean"


# ─── Project links: POST + GET + DELETE ──────────────────────────────

def test_project_link_create_list_delete(headers, account_id, cleanup_state):
    pid = str(uuid.uuid4())
    cleanup_state["project_ids"].append(pid)

    body = {
        "project_id": pid,
        "role": "client",
        "collaboration_stage": "project_conversation",
    }
    r = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/projects",
        headers=headers,
        json=body,
        timeout=15,
    )
    assert r.status_code == 201, f"link project failed: {r.status_code} {r.text}"
    link = r.json().get("link")
    assert link and link.get("project_id") == pid
    assert link.get("role") == "client"
    assert link.get("collaboration_stage") == "project_conversation"

    # GET list — must contain
    rg = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/projects",
        headers=headers,
        timeout=15,
    )
    assert rg.status_code == 200
    links = rg.json().get("links") or []
    assert any(l.get("project_id") == pid for l in links), \
        f"Linked project {pid} not in list"

    # DELETE
    rd = requests.delete(
        f"{BASE}/api/relationships/accounts/{account_id}/projects/{pid}",
        headers=headers,
        timeout=15,
    )
    assert rd.status_code == 204, f"delete failed: {rd.status_code} {rd.text}"

    # Verify gone
    rg2 = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/projects",
        headers=headers,
        timeout=15,
    )
    links2 = rg2.json().get("links") or []
    assert not any(l.get("project_id") == pid for l in links2), \
        "Project link still present after DELETE"


# ─── Inspiration links: POST + GET + DELETE ──────────────────────────

def test_inspiration_link_create_list_delete(headers, account_id, cleanup_state):
    ref_id = str(uuid.uuid4())
    cleanup_state["reference_ids"].append(ref_id)

    body = {
        "reference_id": ref_id,
        "source": "shared_by_advisor",
        "resonance_note": "test",
    }
    r = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/inspirations",
        headers=headers,
        json=body,
        timeout=15,
    )
    assert r.status_code == 201, f"link inspiration failed: {r.status_code} {r.text}"
    link = r.json().get("link")
    assert link and link.get("reference_id") == ref_id
    assert link.get("source") == "shared_by_advisor"

    rg = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/inspirations",
        headers=headers,
        timeout=15,
    )
    assert rg.status_code == 200
    items = rg.json().get("inspirations") or []
    assert any(it.get("reference_id") == ref_id for it in items)

    rd = requests.delete(
        f"{BASE}/api/relationships/accounts/{account_id}/inspirations/{ref_id}",
        headers=headers,
        timeout=15,
    )
    assert rd.status_code == 204, rd.text

    rg2 = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/inspirations",
        headers=headers,
        timeout=15,
    )
    items2 = rg2.json().get("inspirations") or []
    assert not any(it.get("reference_id") == ref_id for it in items2)


# ─── Material affinities: upsert (no duplicate row) ──────────────────

def test_material_affinity_upsert(headers, account_id, cleanup_state):
    mid = str(uuid.uuid4())
    cleanup_state["material_ids"].append(mid)

    # Insert
    r1 = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/material-affinities",
        headers=headers,
        json={"material_id": mid, "attraction_score": 75, "sample_requested": True},
        timeout=15,
    )
    assert r1.status_code in (200, 201), r1.text

    # Re-post with different score — should upsert (same key)
    r2 = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/material-affinities",
        headers=headers,
        json={"material_id": mid, "attraction_score": 90, "sample_requested": False},
        timeout=15,
    )
    assert r2.status_code in (200, 201), r2.text

    rg = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/material-affinities",
        headers=headers,
        timeout=15,
    )
    assert rg.status_code == 200
    rows = rg.json().get("affinities") or []
    matching = [row for row in rows if row.get("material_id") == mid]
    assert len(matching) == 1, f"Expected 1 row after upsert, got {len(matching)}"
    assert float(matching[0].get("attraction_score") or 0) == 90, \
        f"upsert did not update score: {matching[0]}"


# ─── Account ↔ market linkage ─────────────────────────────────────────

def test_account_market_link_and_primary_demote(headers, account_id, cleanup_state):
    # Use real market_ids from /api/markets if available, else random uuids
    rm = requests.get(f"{BASE}/api/markets", headers=headers, timeout=15)
    market_a = None
    market_b = None
    if rm.status_code == 200:
        markets = (rm.json().get("markets") or rm.json().get("data") or [])
        if len(markets) >= 2:
            market_a = markets[0].get("id")
            market_b = markets[1].get("id")
    if not market_a or not market_b:
        market_a = str(uuid.uuid4())
        market_b = str(uuid.uuid4())
    cleanup_state["market_ids"].extend([market_a, market_b])

    # Snapshot original accounts.market_id so we can restore it
    ra = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}",
        headers=headers,
        timeout=15,
    )
    original_market_id = (ra.json().get("account") or {}).get("market_id")

    # Link market_a as primary
    r1 = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/markets",
        headers=headers,
        json={"market_id": market_a, "is_primary": True},
        timeout=15,
    )
    assert r1.status_code == 201, f"link market_a failed: {r1.status_code} {r1.text}"

    # Verify accounts.market_id pointer updated to market_a
    ra2 = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}",
        headers=headers,
        timeout=15,
    )
    pointer = (ra2.json().get("account") or {}).get("market_id")
    assert pointer == market_a, \
        f"accounts.market_id not updated to market_a: got {pointer}"

    # Link market_b as primary — should demote market_a
    r2 = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/markets",
        headers=headers,
        json={"market_id": market_b, "is_primary": True},
        timeout=15,
    )
    assert r2.status_code == 201, f"link market_b failed: {r2.status_code} {r2.text}"

    rg = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/markets",
        headers=headers,
        timeout=15,
    )
    rows = rg.json().get("markets") or []
    rows_a = [r for r in rows if r.get("market_id") == market_a]
    rows_b = [r for r in rows if r.get("market_id") == market_b]
    assert rows_a and rows_a[0].get("is_primary") is False, \
        f"market_a should have been demoted to is_primary=false: {rows_a}"
    assert rows_b and rows_b[0].get("is_primary") is True, \
        f"market_b should be is_primary=true: {rows_b}"

    # Cleanup: remove the test market links AND restore the original pointer
    # The router doesn't expose DELETE for markets, so do a best-effort
    # cleanup via Supabase? Skip — leave test data; original_market_id
    # restoration done via direct API patch if exposed.
    if original_market_id is not None:
        # Try PATCH to restore (best effort, ignore failure)
        requests.patch(
            f"{BASE}/api/relationships/accounts/{account_id}",
            headers=headers,
            json={"metadata_json": {}},  # no-op; market_id not patchable here
            timeout=10,
        )


# ─── Intelligence dashboard view ──────────────────────────────────────

def test_get_intelligence_returns_view_rows(headers, account_id):
    r = requests.get(
        f"{BASE}/api/relationships/intelligence",
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200, f"intelligence failed: {r.status_code} {r.text}"
    rels = r.json().get("relationships") or []
    assert isinstance(rels, list)
    assert len(rels) >= 1, "Expected at least one relationship row from the view"

    target = next((row for row in rels if row.get("account_id") == account_id), None)
    assert target, f"Test account {account_id} not in intelligence view"

    expected_fields = [
        "account_id",
        "account_name",
        "signal_count_total",
        "signal_count_30d",
        "signal_count_7d",
        "linked_project_count",
        "linked_inspiration_count",
        "material_affinity_count",
        "market_count",
    ]
    missing = [f for f in expected_fields if f not in target]
    assert not missing, (
        f"intelligence view missing fields: {missing}. Got keys: {list(target.keys())}"
    )

    # signal_count_total reflects the engagement signal we logged
    assert (target.get("signal_count_total") or 0) >= 1


def test_intelligence_filter_market_id(headers):
    # Just check the endpoint accepts the filter without exploding
    r = requests.get(
        f"{BASE}/api/relationships/intelligence?market_id=" + str(uuid.uuid4()),
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200
    # Random uuid → empty list (no match) — both shapes acceptable
    rels = r.json().get("relationships") or []
    assert isinstance(rels, list)


def test_intelligence_filter_journey_stage(headers):
    r = requests.get(
        f"{BASE}/api/relationships/intelligence?journey_stage=discovery",
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200
    assert isinstance(r.json().get("relationships") or [], list)


# ─── Regression: existing R-CRM-1 endpoints still work ────────────────

def test_regression_accounts_list(headers):
    r = requests.get(f"{BASE}/api/relationships/accounts", headers=headers, timeout=15)
    assert r.status_code == 200
    items = r.json().get("accounts") or r.json().get("data") or []
    assert isinstance(items, list)
    assert len(items) > 0


def test_regression_account_detail(headers, account_id):
    r = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}",
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    acct = body.get("account") or body
    assert acct.get("id") == account_id
    assert "_id" not in acct, "Mongo ObjectId leaked"


def test_regression_account_stage_endpoint(headers, account_id):
    """Stage POST still functional (round-trip)."""
    r = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}",
        headers=headers,
        timeout=15,
    )
    current = (r.json().get("account") or {}).get("lifecycle_stage") or "discovery"

    # Pick any canonical journey stage that differs
    target = "discovery" if current != "discovery" else "inspiration"
    r2 = requests.post(
        f"{BASE}/api/relationships/accounts/{account_id}/stage",
        headers=headers,
        json={"lifecycle_stage": target},
        timeout=15,
    )
    assert r2.status_code in (200, 204), f"stage POST failed: {r2.status_code} {r2.text}"

    # Restore original
    if current and current != target:
        requests.post(
            f"{BASE}/api/relationships/accounts/{account_id}/stage",
            headers=headers,
            json={"lifecycle_stage": current},
            timeout=10,
        )


# ─── Migration 041 sanity: tables exist (via empty-list endpoint hits) ──

def test_migration_041_tables_reachable(headers, account_id):
    """Hitting endpoints that read each new table proves the table exists
    (else the DB call would 500). We use list endpoints which return [] safely.
    """
    endpoints = [
        f"/api/relationships/accounts/{account_id}/engagement",
        f"/api/relationships/accounts/{account_id}/projects",
        f"/api/relationships/accounts/{account_id}/inspirations",
        f"/api/relationships/accounts/{account_id}/material-affinities",
        f"/api/relationships/accounts/{account_id}/markets",
        f"/api/relationships/accounts/{account_id}/affinities",
        f"/api/relationships/intelligence",
    ]
    failed = []
    for ep in endpoints:
        r = requests.get(f"{BASE}{ep}", headers=headers, timeout=15)
        if r.status_code != 200:
            failed.append((ep, r.status_code, r.text[:300]))
    assert not failed, f"Migration 041 tables/views not reachable: {failed}"


# ─── Final cleanup: remove the engagement signal we logged ────────────

def test_zzz_cleanup_engagement_signal(headers, account_id):
    """Best-effort cleanup: there is no DELETE endpoint for individual
    signals exposed in the router. We just record that the test signal
    persists; downstream tests should tolerate it. This test always passes
    (informational only).
    """
    r = requests.get(
        f"{BASE}/api/relationships/accounts/{account_id}/engagement"
        "?signal_type=viewed_article",
        headers=headers,
        timeout=10,
    )
    sigs = r.json().get("signals") or []
    print(f"\n[cleanup] {len(sigs)} viewed_article signals remain on account "
          f"{account_id} — no DELETE endpoint exposed, leaving in place.")
    assert True
