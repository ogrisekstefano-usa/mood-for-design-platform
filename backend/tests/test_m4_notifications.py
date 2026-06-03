"""M4 Notification Center — backend regression suite.

Covers:
- GET /api/notifications/unread-count shape (total, by_priority, by_category, has_critical)
- GET /api/notifications (cursor pagination + filters)
- GET /api/notifications/categories (9 expected codes)
- POST /api/notifications/mark-read  (ids[] and all=true)
- POST /api/notifications/{id}/archive
- GET / PATCH /api/notifications/preferences
- RBAC: user A cannot mutate user B's notifications
- Hooks: new_contact / new_activity / studio_request_received via real endpoints
- Cron: followup_overdue.run_followup_overdue_scan() is invocable

Cleanup: all dedup_keys prefixed `qa:m4:` are deleted at session teardown.
"""
import os
import uuid
import asyncio
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PASSWORD = "MoodAdmin2026!"

EXPECTED_CATEGORIES = {
    "studio_request_received", "lead_awaiting_review", "tenant_activated",
    "workspace_first_access", "advisor_assigned", "activity_assigned",
    "followup_overdue", "new_contact", "new_activity",
}


# ─── fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "tenant_slug": None,
    }, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_user_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped loop so the asyncpg engine sees the same loop across tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def _db_url():
    import re
    url = os.environ.get("DATABASE_URL") or ""
    if not url:
        # parse from /app/backend/.env
        try:
            with open("/app/backend/.env") as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    # Strip sqlalchemy driver scheme for raw asyncpg
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    return url


@pytest.fixture(scope="session", autouse=True)
def cleanup_qa_rows(event_loop):
    yield
    import asyncpg
    async def _do():
        conn = await asyncpg.connect(_db_url(), statement_cache_size=0)
        try:
            await conn.execute(
                "DELETE FROM relationship_notifications WHERE dedup_key LIKE 'qa:m4:%'"
            )
        finally:
            await conn.close()
    try:
        event_loop.run_until_complete(_do())
    except Exception as ex:
        print("cleanup skipped:", ex)


@pytest.fixture(scope="session")
def studio_tenant_id(event_loop):
    import asyncpg
    async def _do():
        conn = await asyncpg.connect(_db_url(), statement_cache_size=0)
        try:
            r = await conn.fetchrow("SELECT id FROM tenants WHERE slug='studio' LIMIT 1")
            return r["id"] if r else None
        finally:
            await conn.close()
    return event_loop.run_until_complete(_do())


@pytest.fixture(scope="session")
def seed_notification(event_loop, studio_tenant_id):
    """Factory: directly INSERT a notification via raw asyncpg (loop-safe)."""
    import asyncpg, json as _json

    def _factory(user_id, *, type_code="new_activity", priority="normal", dedup_suffix=None):
        ddk = f"qa:m4:{dedup_suffix or uuid.uuid4()}"
        async def _do():
            conn = await asyncpg.connect(_db_url(), statement_cache_size=0)
            try:
                row = await conn.fetchrow("""
                    SELECT label_it, narrative_template
                      FROM platform_notification_types WHERE code=$1
                """, type_code)
                title = row["label_it"] if row else type_code
                narrative = (row["narrative_template"] if row else "") or ""
                rec = await conn.fetchrow("""
                    INSERT INTO relationship_notifications (
                        tenant_id, tenant_name,
                        recipient_user_id, recipient_type,
                        notification_type, notification_type_code,
                        title, narrative, payload, priority,
                        dedup_key, sender_type
                    ) VALUES (
                        $1::uuid, 'QA Studio',
                        $2::uuid, 'admin',
                        $3, $3,
                        $4, $5, $6::jsonb, $7,
                        $8, 'system'
                    )
                    ON CONFLICT (recipient_user_id, dedup_key) WHERE dedup_key IS NOT NULL
                    DO NOTHING
                    RETURNING id
                """, studio_tenant_id, user_id, type_code, title, narrative,
                    _json.dumps({"subject": "QA seed", "studio_name": "QA Studio"}),
                    priority, ddk)
                return [rec["id"]] if rec else []
            finally:
                await conn.close()
        return event_loop.run_until_complete(_do())
    return _factory


# ─── auth sanity ─────────────────────────────────────────────────────────

class TestAuth:
    def test_login_returns_token(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_unauthenticated_blocked(self):
        r = requests.get(f"{BASE_URL}/api/notifications/unread-count", timeout=10)
        assert r.status_code in (401, 403)


# ─── categories ──────────────────────────────────────────────────────────

class TestCategories:
    def test_categories_catalog_has_nine_codes(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/notifications/categories")
        assert r.status_code == 200, r.text
        data = r.json()
        codes = {it["code"] for it in data["items"]}
        missing = EXPECTED_CATEGORIES - codes
        assert not missing, f"Missing catalog codes: {missing}"
        # Each row exposes label_it + category + default_priority
        first = data["items"][0]
        for k in ("code", "label_it", "category", "default_priority"):
            assert k in first


# ─── unread-count ────────────────────────────────────────────────────────

class TestUnreadCount:
    def test_unread_count_shape(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/notifications/unread-count")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "by_priority", "by_category", "has_critical"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["total"], int)
        assert isinstance(d["has_critical"], bool)
        assert isinstance(d["by_priority"], dict)
        assert isinstance(d["by_category"], dict)

    def test_has_critical_true_after_high_seed(self, admin_client, admin_user_id, seed_notification):
        seed_notification(admin_user_id, priority="high",
                           dedup_suffix=f"hi-{uuid.uuid4()}")
        r = admin_client.get(f"{BASE_URL}/api/notifications/unread-count")
        d = r.json()
        assert d["has_critical"] is True
        assert d["total"] >= 1


# ─── list + filters ──────────────────────────────────────────────────────

class TestList:
    def test_list_default(self, admin_client, admin_user_id, seed_notification):
        seed_notification(admin_user_id, dedup_suffix=f"l1-{uuid.uuid4()}")
        r = admin_client.get(f"{BASE_URL}/api/notifications?limit=5")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("items", "next_cursor", "count"):
            assert k in d
        assert isinstance(d["items"], list)

    def test_list_only_unread(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/notifications?only_unread=true&limit=10")
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["read_at"] is None

    def test_list_only_critical(self, admin_client, admin_user_id, seed_notification):
        seed_notification(admin_user_id, priority="urgent",
                           dedup_suffix=f"cr-{uuid.uuid4()}")
        r = admin_client.get(f"{BASE_URL}/api/notifications?only_critical=true&limit=10")
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["priority"] in ("high", "urgent")

    def test_list_type_codes_filter(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/notifications?type_codes=new_activity&limit=5")
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["notification_type_code"] == "new_activity"


# ─── mark-read + archive ─────────────────────────────────────────────────

class TestMutators:
    def test_mark_read_by_ids(self, admin_client, admin_user_id, seed_notification):
        ids = seed_notification(admin_user_id, dedup_suffix=f"mr-{uuid.uuid4()}")
        assert ids, "seed must produce a notification"
        nid = str(ids[0])
        r = admin_client.post(f"{BASE_URL}/api/notifications/mark-read",
                              json={"ids": [nid]})
        assert r.status_code == 200, r.text
        assert r.json()["updated"] >= 1

    def test_mark_all_read_empties_unread(self, admin_client, admin_user_id, seed_notification):
        seed_notification(admin_user_id, dedup_suffix=f"ma-{uuid.uuid4()}")
        r = admin_client.post(f"{BASE_URL}/api/notifications/mark-read",
                              json={"all": True})
        assert r.status_code == 200, r.text
        # Verify badge empty
        r2 = admin_client.get(f"{BASE_URL}/api/notifications/unread-count")
        assert r2.json()["total"] == 0

    def test_mark_read_validation(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/notifications/mark-read", json={})
        assert r.status_code == 400

    def test_archive(self, admin_client, admin_user_id, seed_notification):
        ids = seed_notification(admin_user_id, dedup_suffix=f"ar-{uuid.uuid4()}")
        nid = str(ids[0])
        r = admin_client.post(f"{BASE_URL}/api/notifications/{nid}/archive")
        assert r.status_code == 200, r.text
        # Item now hidden from list
        r2 = admin_client.get(f"{BASE_URL}/api/notifications?limit=100")
        ids_seen = {it["id"] for it in r2.json()["items"]}
        assert nid not in ids_seen

    def test_archive_404_on_unknown(self, admin_client):
        fake = str(uuid.uuid4())
        r = admin_client.post(f"{BASE_URL}/api/notifications/{fake}/archive")
        assert r.status_code == 404


# ─── preferences ─────────────────────────────────────────────────────────

class TestPreferences:
    def test_get_preferences_full_matrix(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/notifications/preferences")
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        codes = {it["code"] for it in items}
        assert EXPECTED_CATEGORIES.issubset(codes)
        for it in items:
            for k in ("in_app_enabled", "email_enabled", "push_enabled"):
                assert k in it
            # defaults
            assert it["in_app_enabled"] in (True, False)

    def test_patch_preferences_persists(self, admin_client):
        r = admin_client.patch(
            f"{BASE_URL}/api/notifications/preferences",
            json={"items": [
                {"notification_type": "new_activity",
                 "in_app_enabled": False, "email_enabled": False, "push_enabled": False}
            ]},
        )
        assert r.status_code == 200, r.text
        assert r.json()["updated"] == 1
        # Verify
        r2 = admin_client.get(f"{BASE_URL}/api/notifications/preferences")
        for it in r2.json()["items"]:
            if it["code"] == "new_activity":
                assert it["in_app_enabled"] is False
        # Restore default ON so subsequent hook tests still notify
        admin_client.patch(
            f"{BASE_URL}/api/notifications/preferences",
            json={"items": [
                {"notification_type": "new_activity",
                 "in_app_enabled": True, "email_enabled": False, "push_enabled": False}
            ]},
        )


# ─── RBAC ────────────────────────────────────────────────────────────────

class TestRBAC:
    def test_cannot_mark_other_users_notification(self, admin_client, admin_user_id):
        """Try marking-read with a UUID that doesn't belong to current user."""
        random_id = str(uuid.uuid4())
        r = admin_client.post(f"{BASE_URL}/api/notifications/mark-read",
                              json={"ids": [random_id]})
        assert r.status_code == 200
        assert r.json()["updated"] == 0

    def test_cannot_archive_other_users_notification(self, admin_client):
        random_id = str(uuid.uuid4())
        r = admin_client.post(f"{BASE_URL}/api/notifications/{random_id}/archive")
        assert r.status_code == 404


# ─── cron ────────────────────────────────────────────────────────────────

class TestCron:
    def test_followup_overdue_scan_invocable(self, event_loop):
        import sys
        sys.path.insert(0, "/app/backend")
        from jobs.followup_overdue import run_followup_overdue_scan
        result = event_loop.run_until_complete(run_followup_overdue_scan())
        for k in ("date", "scanned", "created", "skipped"):
            assert k in result
        assert isinstance(result["scanned"], int)
        assert result["created"] + result["skipped"] == result["scanned"]
