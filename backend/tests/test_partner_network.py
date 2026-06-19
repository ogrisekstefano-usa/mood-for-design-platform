"""Partner Network Sprint Tests — Fase 3, 5, 6"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://i18n-recovery-1.preview.emergentagent.com').rstrip('/')

ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "Blueprint2024!"
TEST_PARTNER_ID = "259f4645-5ad6-4958-96e8-53f1bc8f74c5"
TEST_PARTNER_EMAIL = "marco.ferretti.pntest@example.com"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    res = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if res.status_code == 200:
        data = res.json()
        token = (data.get("session") or {}).get("access_token") or data.get("access_token") or data.get("token")
        if token:
            return token
    pytest.skip(f"Authentication failed: {res.status_code} {res.text[:200]}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ─── FASE 3: POST /api/partner/apply ─────────────────────────────────────────

class TestPartnerApply:
    """Fase 3 — Endpoint pubblico candidatura partner"""

    def test_apply_creates_lead_201(self, session):
        """POST /api/partner/apply returns 201 with partner_id"""
        payload = {
            "tenant_slug": "studio",
            "first_name": "TEST_Giulia",
            "last_name": "TEST_Bianchi",
            "company_name": "TEST Studio Bianchi",
            "email": "TEST_giulia.bianchi.pntest@example.com",
            "professional_category": "architect",
            "territory": "Roma",
        }
        res = session.post(f"{BASE_URL}/api/partner/apply", json=payload)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert "partner_id" in data, f"Missing partner_id in response: {data}"
        assert data.get("status") in ("created", "updated"), f"Unexpected status: {data}"
        print(f"PASS: apply created/updated partner_id={data['partner_id']}, status={data['status']}")

    def test_apply_deduplication(self, session):
        """Second submission with same email returns status='updated'"""
        payload = {
            "tenant_slug": "studio",
            "first_name": "TEST_Giulia",
            "last_name": "TEST_Bianchi",
            "company_name": "TEST Studio Bianchi v2",
            "email": "TEST_giulia.bianchi.pntest@example.com",
            "professional_category": "interior_designer",
        }
        res = session.post(f"{BASE_URL}/api/partner/apply", json=payload)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("status") == "updated", f"Expected status='updated' for dedup, got: {data}"
        print(f"PASS: dedup works, status={data['status']}")

    def test_apply_missing_required_fields_422(self, session):
        """Missing required fields returns 422"""
        payload = {
            "tenant_slug": "studio",
            "first_name": "TEST_X",
            # missing last_name, company_name, email
        }
        res = session.post(f"{BASE_URL}/api/partner/apply", json=payload)
        assert res.status_code == 422, f"Expected 422, got {res.status_code}: {res.text}"
        print(f"PASS: missing fields returns 422")

    def test_apply_no_account_created(self, session):
        """Partner apply should NOT create an auth user account"""
        # We just verify the endpoint response — no account field in response
        payload = {
            "tenant_slug": "studio",
            "first_name": "TEST_NoAccount",
            "last_name": "TEST_Check",
            "company_name": "TEST Studio NoAccount",
            "email": "TEST_noaccount.pntest@example.com",
            "professional_category": "brand",
        }
        res = session.post(f"{BASE_URL}/api/partner/apply", json=payload)
        assert res.status_code == 201
        data = res.json()
        # Should only have partner_id, status, message — no user_id, account_id
        assert "user_id" not in data, f"Unexpected user_id in response: {data}"
        assert "account_id" not in data, f"Unexpected account_id in response: {data}"
        print(f"PASS: no account fields in response")

    def test_apply_existing_partner_id(self, session):
        """Test with test partner email - should return updated"""
        payload = {
            "tenant_slug": "studio",
            "first_name": "Marco",
            "last_name": "Ferretti",
            "company_name": "Studio Ferretti TEST",
            "email": TEST_PARTNER_EMAIL,
            "professional_category": "architect",
        }
        res = session.post(f"{BASE_URL}/api/partner/apply", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data.get("status") == "updated"
        assert data.get("partner_id") == TEST_PARTNER_ID
        print(f"PASS: existing partner dedup, partner_id matches {TEST_PARTNER_ID}")


# ─── FASE 5: GET/PATCH /api/partner-network/partners ─────────────────────────

class TestPartnerNetworkAuth:
    """Fase 5 — Autenticato: lista e aggiornamento stato"""

    def test_list_partners_returns_200(self, session, auth_headers):
        res = session.get(f"{BASE_URL}/api/partner-network/partners", headers=auth_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "partners" in data
        assert "status_counts" in data
        assert isinstance(data["partners"], list)
        print(f"PASS: list_partners returns {len(data['partners'])} partners, counts={data['status_counts']}")

    def test_list_partners_filter_by_status(self, session, auth_headers):
        res = session.get(f"{BASE_URL}/api/partner-network/partners?status=applied", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        for p in data["partners"]:
            assert p.get("partner_status") == "applied", f"Partner has wrong status: {p}"
        print(f"PASS: status filter works, {len(data['partners'])} partners with status=applied")

    def test_patch_status_to_review(self, session, auth_headers):
        """PATCH status applied→review"""
        res = session.patch(
            f"{BASE_URL}/api/partner-network/partners/{TEST_PARTNER_ID}/status",
            json={"status": "review"},
            headers=auth_headers,
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("status") == "review"
        print(f"PASS: status patched to review")

    def test_patch_status_to_approved(self, session, auth_headers):
        """PATCH status review→approved"""
        res = session.patch(
            f"{BASE_URL}/api/partner-network/partners/{TEST_PARTNER_ID}/status",
            json={"status": "approved"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "approved"
        print(f"PASS: status patched to approved")

    def test_patch_status_full_flow(self, session, auth_headers):
        """Status flow: applied→review→approved→active→archived then back to approved"""
        for s in ['active', 'archived', 'approved']:
            res = session.patch(
                f"{BASE_URL}/api/partner-network/partners/{TEST_PARTNER_ID}/status",
                json={"status": s},
                headers=auth_headers,
            )
            assert res.status_code == 200, f"Failed to set status={s}: {res.text}"
            assert res.json().get("status") == s
        print("PASS: full status flow applied→review→approved→active→archived works")

    def test_patch_invalid_status_422(self, session, auth_headers):
        """Invalid status returns 422"""
        res = session.patch(
            f"{BASE_URL}/api/partner-network/partners/{TEST_PARTNER_ID}/status",
            json={"status": "invalid_status"},
            headers=auth_headers,
        )
        assert res.status_code == 422, f"Expected 422, got {res.status_code}: {res.text}"
        print("PASS: invalid status returns 422")

    def test_list_partners_unauthenticated_401(self, session):
        """Unauthenticated request returns 401/403"""
        res = session.get(f"{BASE_URL}/api/partner-network/partners")
        assert res.status_code in (401, 403), f"Expected 401/403, got {res.status_code}"
        print(f"PASS: unauthenticated returns {res.status_code}")

    def test_partner_has_required_fields(self, session, auth_headers):
        """Partners list contains required fields"""
        res = session.get(f"{BASE_URL}/api/partner-network/partners", headers=auth_headers)
        assert res.status_code == 200
        partners = res.json().get("partners", [])
        if partners:
            p = partners[0]
            for field in ['id', 'first_name', 'last_name', 'email', 'partner_status']:
                assert field in p, f"Missing field {field} in partner: {p}"
        print(f"PASS: partner fields present")


# ─── FASE 6: GET /api/partner-network/journeys ───────────────────────────────

class TestPartnerNetworkJourneys:
    """Fase 6 — Design Journey list"""

    def test_list_journeys_authenticated(self, session, auth_headers):
        res = session.get(f"{BASE_URL}/api/partner-network/journeys", headers=auth_headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "journeys" in data
        print(f"PASS: journeys list returns {len(data['journeys'])} journeys")
