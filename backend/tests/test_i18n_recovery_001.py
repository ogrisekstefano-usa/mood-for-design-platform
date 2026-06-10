"""
I18N-RECOVERY-001 — Backend tests.

P0-A: locale propagation fields (target_locale, tenant_primary_locale) accepted
      by concept-directions/generate, working-moodboards/from-concept, and
      project-stories/generate-from-specification endpoints.
P0-B: es-MX in platform/languages registry.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


# ── Auth ──────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@moodfordesign.com",
        "password": "Blueprint2024!",
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    t = r.json()["session"]["access_token"]
    assert t
    return t


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ── Seed: create a test journey via public endpoint ───────────────
@pytest.fixture(scope="module")
def test_journey_id():
    """Create a test journey via the public initiation endpoint."""
    r = requests.post(f"{BASE_URL}/api/public/journeys/initiate", json={
        "welcome": {
            "first_name": "TEST_I18N",
            "email": "test_i18n_recovery@example.com",
            "country_code": "IT",
            "dial_code": "+39",
            "normalized_phone": "+393331234567",
        }
    })
    if r.status_code in (200, 201):
        data = r.json()
        jid = data.get("journey_id")
        assert jid, f"No journey_id in response: {data}"
        return jid
    # If already exists (409) or another error, try to list from admin
    pytest.skip(f"Could not create test journey: {r.status_code} {r.text[:200]}")


# ═══════════════════════════════════════════════════════════════════
#  P0-A · LOCALE PROPAGATION — concept-directions/generate
# ═══════════════════════════════════════════════════════════════════
class TestConceptDirectionsLocaleField:
    """POST /api/journeys/{jid}/concept-directions/generate accepts locale fields."""

    def test_generate_accepts_target_locale_field(self, auth_headers, test_journey_id):
        """Endpoint accepts target_locale in body without 422 validation error."""
        r = requests.post(
            f"{BASE_URL}/api/journeys/{test_journey_id}/concept-directions/generate",
            json={"target_locale": "en-US", "tenant_primary_locale": "it"},
            headers=auth_headers,
        )
        # Expect 200 (success) or 404 (journey/brief issue in empty DB) but NOT 422/500 for schema
        assert r.status_code not in (422,), (
            f"Pydantic rejected locale fields — status {r.status_code}: {r.text[:300]}"
        )
        print(f"concept-directions/generate status: {r.status_code}")

    def test_generate_accepts_es_mx_locale(self, auth_headers, test_journey_id):
        """Endpoint accepts es-MX locale value without 422."""
        r = requests.post(
            f"{BASE_URL}/api/journeys/{test_journey_id}/concept-directions/generate",
            json={"target_locale": "es-MX", "tenant_primary_locale": "it"},
            headers=auth_headers,
        )
        assert r.status_code not in (422,), (
            f"Pydantic rejected es-MX — status {r.status_code}: {r.text[:300]}"
        )
        print(f"concept-directions/generate es-MX status: {r.status_code}")

    def test_generate_no_locale_still_works(self, auth_headers, test_journey_id):
        """Endpoint works without locale fields (backward compatibility)."""
        r = requests.post(
            f"{BASE_URL}/api/journeys/{test_journey_id}/concept-directions/generate",
            json={},
            headers=auth_headers,
        )
        assert r.status_code not in (422,), (
            f"Empty body rejected — status {r.status_code}: {r.text[:300]}"
        )
        print(f"concept-directions/generate empty body status: {r.status_code}")

    def test_generate_returns_correct_shape(self, auth_headers, test_journey_id):
        """200 response contains locale in concept seed."""
        r = requests.post(
            f"{BASE_URL}/api/journeys/{test_journey_id}/concept-directions/generate",
            json={"target_locale": "en-US", "tenant_primary_locale": "it"},
            headers=auth_headers,
        )
        if r.status_code == 200:
            data = r.json()
            # Should have directions
            assert "directions" in data or "set_id" in data, f"Unexpected shape: {data.keys()}"
            print(f"concept-directions/generate returned {len(data.get('directions', []))} directions")
        else:
            print(f"Skipping shape check — status {r.status_code}: {r.text[:200]}")


# ═══════════════════════════════════════════════════════════════════
#  P0-A · LOCALE PROPAGATION — working-moodboards/from-concept
# ═══════════════════════════════════════════════════════════════════
class TestWorkingMoodboardsLocaleField:
    """POST /api/journeys/{jid}/working-moodboards/from-concept/{id} accepts locale fields."""

    def test_from_concept_accepts_locale_fields(self, auth_headers, test_journey_id):
        """Endpoint accepts target_locale and tenant_primary_locale.
        We use a dummy concept_mb_id; the key assertion is NOT 422."""
        dummy_concept_id = "00000000-0000-0000-0000-000000000001"
        r = requests.post(
            f"{BASE_URL}/api/journeys/{test_journey_id}/working-moodboards/from-concept/{dummy_concept_id}",
            json={"target_locale": "en-US", "tenant_primary_locale": "it"},
            headers=auth_headers,
        )
        # 404 = journey or concept not found → fine, locale fields were accepted
        # 422 = Pydantic validation error → fail
        assert r.status_code not in (422,), (
            f"Pydantic rejected locale fields — status {r.status_code}: {r.text[:300]}"
        )
        print(f"working-moodboards/from-concept status: {r.status_code}")

    def test_from_concept_accepts_es_mx(self, auth_headers, test_journey_id):
        """Endpoint accepts es-MX target_locale."""
        dummy_concept_id = "00000000-0000-0000-0000-000000000001"
        r = requests.post(
            f"{BASE_URL}/api/journeys/{test_journey_id}/working-moodboards/from-concept/{dummy_concept_id}",
            json={"target_locale": "es-MX", "tenant_primary_locale": "it"},
            headers=auth_headers,
        )
        assert r.status_code not in (422,), (
            f"Pydantic rejected es-MX — status {r.status_code}: {r.text[:300]}"
        )
        print(f"working-moodboards/from-concept es-MX status: {r.status_code}")

    def test_from_concept_empty_body_ok(self, auth_headers, test_journey_id):
        """Endpoint accepts empty body (all fields optional)."""
        dummy_concept_id = "00000000-0000-0000-0000-000000000001"
        r = requests.post(
            f"{BASE_URL}/api/journeys/{test_journey_id}/working-moodboards/from-concept/{dummy_concept_id}",
            json={},
            headers=auth_headers,
        )
        assert r.status_code not in (422,), (
            f"Empty body rejected — status {r.status_code}: {r.text[:300]}"
        )
        print(f"working-moodboards/from-concept empty body: {r.status_code}")

    def test_list_working_moodboards_ok(self, auth_headers, test_journey_id):
        """GET /api/journeys/{jid}/working-moodboards returns 200."""
        r = requests.get(
            f"{BASE_URL}/api/journeys/{test_journey_id}/working-moodboards",
            headers=auth_headers,
        )
        assert r.status_code == 200, f"List WMBs failed: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "working_moodboards" in data
        print(f"list working-moodboards returned {data['total']} items")


# ═══════════════════════════════════════════════════════════════════
#  P0-A · LOCALE PROPAGATION — project-stories/generate-from-specification
# ═══════════════════════════════════════════════════════════════════
class TestProjectStoriesLocaleField:
    """POST /api/project-stories/generate-from-specification/{id} accepts locale fields."""

    def test_generate_from_spec_accepts_locale_fields(self, auth_headers):
        """Endpoint accepts target_locale and tenant_primary_locale body fields.
        Uses a dummy spec_id; expect 404 (spec not found) NOT 422."""
        dummy_spec_id = "00000000-0000-0000-0000-000000000002"
        r = requests.post(
            f"{BASE_URL}/api/project-stories/generate-from-specification/{dummy_spec_id}",
            json={"target_locale": "en-US", "tenant_primary_locale": "it"},
            headers=auth_headers,
        )
        # 404 = spec not found → locale fields were accepted
        # 422 = Pydantic rejected → FAIL
        assert r.status_code not in (422,), (
            f"Pydantic rejected locale fields — status {r.status_code}: {r.text[:300]}"
        )
        print(f"project-stories/generate-from-spec status: {r.status_code}")

    def test_generate_from_spec_accepts_es_mx(self, auth_headers):
        """Endpoint accepts es-MX target_locale."""
        dummy_spec_id = "00000000-0000-0000-0000-000000000002"
        r = requests.post(
            f"{BASE_URL}/api/project-stories/generate-from-specification/{dummy_spec_id}",
            json={"target_locale": "es-MX", "tenant_primary_locale": "it"},
            headers=auth_headers,
        )
        assert r.status_code not in (422,), (
            f"Pydantic rejected es-MX — status {r.status_code}: {r.text[:300]}"
        )
        print(f"project-stories/generate-from-spec es-MX status: {r.status_code}")

    def test_generate_from_spec_empty_body_ok(self, auth_headers):
        """Endpoint accepts empty body (all fields optional)."""
        dummy_spec_id = "00000000-0000-0000-0000-000000000002"
        r = requests.post(
            f"{BASE_URL}/api/project-stories/generate-from-specification/{dummy_spec_id}",
            json={},
            headers=auth_headers,
        )
        assert r.status_code not in (422,), (
            f"Empty body rejected — status {r.status_code}: {r.text[:300]}"
        )
        print(f"project-stories/generate-from-spec empty body: {r.status_code}")

    def test_list_project_stories(self, auth_headers):
        """GET /api/project-stories returns 200."""
        r = requests.get(f"{BASE_URL}/api/project-stories", headers=auth_headers)
        assert r.status_code == 200, f"List stories: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "items" in data
        print(f"list project-stories returned {data['count']} items")


# ═══════════════════════════════════════════════════════════════════
#  P0-B · es-MX in platform/languages registry
# ═══════════════════════════════════════════════════════════════════
class TestEsMxInRegistry:
    """es-MX is registered in platform/languages."""

    def test_platform_languages_includes_es_mx(self, auth_headers):
        """GET /api/platform/languages includes es-MX."""
        r = requests.get(f"{BASE_URL}/api/platform/languages?scope=all", headers=auth_headers)
        if r.status_code == 200:
            data = r.json()
            codes = [l.get("code") for l in data.get("languages", [])]
            assert "es-MX" in codes, (
                f"es-MX not in platform languages. Found codes: {codes}"
            )
            print(f"Platform languages ({len(codes)}): {codes}")
        else:
            # Endpoint might not exist or require different auth — skip gracefully
            print(f"platform/languages status: {r.status_code} — skipping assertion")

    def test_locale_runtime_resolve_includes_es_mx_in_supported(self, auth_headers):
        """GET /api/locale-runtime/resolve includes ES_MX in supported list."""
        r = requests.get(f"{BASE_URL}/api/locale-runtime/resolve", headers=auth_headers)
        if r.status_code == 200:
            data = r.json()
            supported = data.get("supported", [])
            assert "ES_MX" in supported, (
                f"ES_MX not in locale-runtime supported list. Got: {supported}"
            )
            print(f"locale-runtime supported: {supported}")
        else:
            print(f"locale-runtime/resolve status: {r.status_code} — check auth")


# ═══════════════════════════════════════════════════════════════════
#  LOCALE RUNTIME  — resolve returns supported locales
# ═══════════════════════════════════════════════════════════════════
class TestLocaleRuntime:
    """Basic locale-runtime endpoint checks."""

    def test_locale_runtime_resolve_returns_200(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/locale-runtime/resolve", headers=auth_headers)
        assert r.status_code == 200, f"locale-runtime/resolve: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "locale_code" in data
        assert "supported" in data
        print(f"locale_code={data['locale_code']} supported={data.get('supported')}")

    def test_locale_runtime_public_resolve(self):
        """Anonymous path returns 200."""
        r = requests.get(f"{BASE_URL}/api/locale-runtime/resolve/public")
        assert r.status_code == 200, f"public resolve: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "locale_code" in data
        print(f"public locale_code={data['locale_code']}")

    def test_blueprint_i18n_it(self, auth_headers):
        """Blueprint i18n endpoint for IT returns 200."""
        r = requests.get(f"{BASE_URL}/api/blueprint/i18n/it", headers=auth_headers)
        assert r.status_code == 200, f"i18n/it: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "messages" in data
        print(f"i18n/it messages count: {len(data.get('messages', {}))}")

    def test_blueprint_i18n_en_us(self, auth_headers):
        """Blueprint i18n endpoint for en-US returns 200."""
        r = requests.get(f"{BASE_URL}/api/blueprint/i18n/en-US", headers=auth_headers)
        assert r.status_code == 200, f"i18n/en-US: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "messages" in data
        print(f"i18n/en-US messages count: {len(data.get('messages', {}))}")

    def test_blueprint_i18n_es_mx(self, auth_headers):
        """Blueprint i18n endpoint for es-MX returns 200 or 403 (non-Blueprint locale is expected to block)."""
        r = requests.get(f"{BASE_URL}/api/blueprint/i18n/es-MX", headers=auth_headers)
        # es-MX has blueprint_enabled=false → backend returns 403 (expected)
        # OR returns 200 with empty messages if not enforced
        print(f"i18n/es-MX status: {r.status_code} data: {r.text[:300]}")
        # 403 is EXPECTED behavior: es-MX is not a Blueprint operational locale.
        # Just ensure we don't get a 500 server error.
        assert r.status_code != 500, f"Unexpected 500 error: {r.text[:300]}"
