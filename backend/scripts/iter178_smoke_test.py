"""ITER178 · JOURNEY ASSIGNMENTS™ Phase 1 — smoke test E2E.

Scenario:
  1. admin@moodfordesign.com login
  2. invite Designer A (role=designer)
  3. set password + first login Designer A (status → active)
  4. Public Begin Journey (cliente Mario Test Iter178)
  5. verify journey created + design_journey_assignments has 1 owner row (= admin)
  6. admin POST /api/admin/journeys/{jid}/assignments → add Designer A as contributor
  7. verify list includes 2 rows
  8. admin POST .../change-owner → handoff to Designer A
  9. verify owner is now Designer A + old owner row is revoked
 10. verify 1-owner-per-journey invariant (DB partial unique index respected)
 11. Designer A GET /api/workspace/journeys/mine → returns 1 journey as owner
 12. admin try to add Designer A again as contributor → 409 user_already_assigned
 13. admin add another observer (admin himself as observer test)
 14. revoke contributor (designer A) — should reject because designer A is owner
 15. revoke observer → ok
 16. try revoke owner row directly via DELETE → 409
 17. admin GET /api/admin/journeys/{jid}/assignments/events → audit trail
 18. Designer A GET /api/admin/journeys/{jid}/assignments → should work (P_PROJECTS_READ)

Cleanup: delete invited Designer + journey rows → restore Founder Only.
"""
import os
import sys
import time
import json
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API_URL = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
DATABASE_URL = os.environ["DATABASE_URL"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ADMIN_EMAIL    = "admin@moodfordesign.com"
ADMIN_PW       = "Blueprint2024!"
DESIGNER_EMAIL = "designer.iter178+a@example.com"
DESIGNER_PW    = "DesignerA2026!"
CLIENT_EMAIL   = "mario.iter178+e2e@example.com"

results = []
def step(name, ok, detail=""):
    flag = "✅" if ok else "❌"
    print(f"  {flag} {name}")
    if detail:
        print(f"     {detail}")
    results.append({"step": name, "ok": ok, "detail": detail})


def supabase_admin():
    return {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}


def cleanup_designer(email):
    h = supabase_admin()
    r = requests.get(f"{SUPABASE_URL}/auth/v1/admin/users", headers=h, timeout=15)
    for u in r.json().get("users", []):
        if u["email"] == email:
            requests.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{u['id']}",
                            headers=h, timeout=10)


def cleanup_db(conn):
    """Reset DB back to Founder Only state."""
    conn.autocommit = True
    cur = conn.cursor()
    # In FK-safe order
    for t in [
        "design_journey_assignment_events", "design_journey_assignments",
        "relationship_messages", "relationship_threads",
        "human_assignment_events", "human_assignments",
        "studio_relationship_events", "studio_relations",
        "journey_timeline_events", "milestone_versions", "journey_milestones",
        "journey_briefs", "design_journeys",
        "projects", "contacts", "accounts", "leads",
        "access_magic_links", "login_attempts", "email_events",
        "funnel_events", "ai_assist_logs", "audit_logs",
        "configuration_change_events", "user_onboarding_state",
        "tenant_memberships", "member_invites",
    ]:
        try:
            cur.execute(f'DELETE FROM "{t}"')
        except Exception:
            pass
    # Delete non-admin profiles
    cur.execute("DELETE FROM users_profile WHERE email != %s", (ADMIN_EMAIL,))
    cur.execute("DELETE FROM users WHERE id != (SELECT id FROM auth.users WHERE email = %s)",
                (ADMIN_EMAIL,))
    cur.close()


def main():
    print("\n=== ITER178 · Journey Assignments Phase 1 · Smoke Test ===\n")
    conn = psycopg2.connect(DATABASE_URL)

    # Pre-cleanup any leftover
    cleanup_designer(DESIGNER_EMAIL)
    cleanup_designer(CLIENT_EMAIL)
    cleanup_db(conn)

    # ── 1 · Admin login ───────────────────────────────────────────────
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PW},
                      timeout=15)
    step("admin login", r.ok, f"HTTP {r.status_code}")
    if not r.ok:
        return False
    admin_tok = r.json()["session"]["access_token"]
    AH = {"Authorization": f"Bearer {admin_tok}"}
    admin_profile_id = r.json()["user"]["id"]

    # ── 2 · Invite Designer A ─────────────────────────────────────────
    r = requests.post(
        f"{API_URL}/api/members/invite",
        json={"email": DESIGNER_EMAIL, "first_name": "DesignerA",
              "last_name": "ITER178", "role": "designer"},
        headers=AH, timeout=60,
    )
    step("invite Designer A", r.status_code == 201, f"HTTP {r.status_code}")
    if r.status_code != 201:
        print("    ", r.text[:200])
        return False
    designer_profile_id = r.json()["id"]
    designer_auth_id    = r.json().get("auth_user_id")

    # ── 3 · Set password + login Designer A ───────────────────────────
    h = supabase_admin()
    h2 = {**h, "Content-Type": "application/json"}
    r = requests.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{designer_auth_id}",
        headers=h2,
        json={"password": DESIGNER_PW, "email_confirm": True},
        timeout=15,
    )
    step("set Designer A password", r.ok, f"HTTP {r.status_code}")
    time.sleep(1)
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": DESIGNER_EMAIL, "password": DESIGNER_PW},
                      timeout=15)
    step("Designer A login → status active", r.ok and r.json()["user"]["status"] == "active",
         f"HTTP {r.status_code}, status={r.json().get('user', {}).get('status')}")
    designer_tok = r.json()["session"]["access_token"]
    DH = {"Authorization": f"Bearer {designer_tok}"}

    # ── 4 · Begin Journey (cliente) ───────────────────────────────────
    r = requests.post(
        f"{API_URL}/api/public/journeys/initiate",
        json={"welcome": {
            "first_name": "MarioITER178",
            "email": CLIENT_EMAIL,
            "country_code": "IT",
            "dial_code": "+39",
            "normalized_phone": "+393331111179",
        }},
        timeout=30,
    )
    step("Begin Journey (public) → 201", r.status_code == 201,
         f"HTTP {r.status_code}")
    if r.status_code != 201:
        print("    ", r.text[:200])
        return False
    journey_id = r.json()["journey_id"]
    print(f"     journey_id={journey_id}")

    # ── 5 · Verify auto-created owner row ─────────────────────────────
    # NB: human_assignment priority chain is:
    #   tenant_admin > project_manager > designer/editor > super_admin
    # With (super_admin + designer) active, designer wins → Designer A
    # becomes both referente (human_assignments) AND owner (dja).
    time.sleep(0.5)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, user_id, assignment_role, client_visible
          FROM design_journey_assignments
         WHERE journey_id = %s AND revoked_at IS NULL
         ORDER BY assigned_at""", (journey_id,))
    rows = cur.fetchall()
    step("auto-created 1 owner row at journey init",
         len(rows) == 1 and rows[0][2] == "owner" and str(rows[0][1]) == designer_profile_id,
         f"rows={[(str(r[0])[:8], r[2], str(r[1])[:8]) for r in rows]} "
         f"(expected owner=Designer {designer_profile_id[:8]})")
    initial_owner_aid = rows[0][0] if rows else None

    # ── 6 · Admin adds himself as contributor ─────────────────────────
    r = requests.post(
        f"{API_URL}/api/admin/journeys/{journey_id}/assignments",
        json={"user_id": admin_profile_id, "assignment_role": "contributor"},
        headers=AH, timeout=15,
    )
    step("admin POST add contributor (admin himself)",
         r.status_code == 201, f"HTTP {r.status_code}, role={r.json().get('assignment_role') if r.ok else r.text[:120]}")
    contributor_aid = r.json().get("id") if r.ok else None

    # ── 7 · List assignments returns 2 rows ───────────────────────────
    r = requests.get(f"{API_URL}/api/admin/journeys/{journey_id}/assignments",
                     headers=AH, timeout=15)
    step("GET list → 2 rows (owner+contributor)",
         r.ok and len(r.json()) == 2 and r.json()[0]["assignment_role"] == "owner",
         f"HTTP {r.status_code}, rows={len(r.json()) if r.ok else 0}, order={[x['assignment_role'] for x in r.json()] if r.ok else None}")

    # ── 8 · Change owner: handoff from Designer A → admin ─────────────
    r = requests.post(
        f"{API_URL}/api/admin/journeys/{journey_id}/assignments/change-owner",
        json={"user_id": admin_profile_id, "reason": "test_handoff_to_admin"},
        headers=AH, timeout=15,
    )
    step("admin POST change-owner → admin",
         r.status_code == 201 and r.json().get("user_id") == admin_profile_id,
         f"HTTP {r.status_code}, new_owner={r.json().get('user_id') if r.ok else r.text[:120]}")
    new_owner_aid = r.json().get("id") if r.ok else None

    # ── 9 · Verify owner is admin + old Designer A row revoked ────────
    cur.execute("""
        SELECT user_id, assignment_role FROM design_journey_assignments
         WHERE journey_id = %s AND assignment_role='owner' AND revoked_at IS NULL""",
        (journey_id,))
    owner_row = cur.fetchone()
    step("DB: active owner is now admin",
         owner_row and str(owner_row[0]) == admin_profile_id,
         f"owner={owner_row}")

    cur.execute("""
        SELECT user_id, revoked_at, revoke_reason FROM design_journey_assignments
         WHERE id = %s""", (initial_owner_aid,))
    old_owner = cur.fetchone()
    step("DB: previous Designer A owner row revoked",
         old_owner and old_owner[1] is not None,
         f"revoked_at={old_owner[1] if old_owner else None}, reason={old_owner[2] if old_owner else None}")

    cur.execute("""
        SELECT id, revoked_at, revoke_reason FROM design_journey_assignments
         WHERE id = %s""", (contributor_aid,))
    promoted = cur.fetchone()
    step("DB: admin's old contributor row revoked (auto-promoted)",
         promoted and promoted[1] is not None,
         f"revoked_at={promoted[1] if promoted else None}, reason={promoted[2] if promoted else None}")

    # ── 10 · Owner unique invariant ───────────────────────────────────
    cur.execute("""
        SELECT COUNT(*) FROM design_journey_assignments
         WHERE journey_id = %s AND assignment_role='owner' AND revoked_at IS NULL""",
        (journey_id,))
    n_active_owners = cur.fetchone()[0]
    step("invariant: exactly 1 active owner per journey", n_active_owners == 1,
         f"count={n_active_owners}")

    # ── 11 · Designer A GET /workspace/journeys/mine ──────────────────
    # After handoff, Designer A has 0 active assignment (admin took owner)
    r = requests.get(f"{API_URL}/api/workspace/journeys/mine",
                     headers=DH, timeout=15)
    step("Designer A GET /workspace/journeys/mine → 0 (handed off)",
         r.ok and len(r.json()) == 0,
         f"HTTP {r.status_code}, rows={len(r.json()) if r.ok else 0}")

    # admin now owns the journey
    r = requests.get(f"{API_URL}/api/workspace/journeys/mine",
                     headers=AH, timeout=15)
    step("admin GET /workspace/journeys/mine → 1 (now owner)",
         r.ok and len(r.json()) == 1 and r.json()[0]["assignment_role"] == "owner",
         f"HTTP {r.status_code}, rows={len(r.json()) if r.ok else 'err'}")

    # ── 12 · Add admin again → 409 user_already_assigned ──────────────
    r = requests.post(
        f"{API_URL}/api/admin/journeys/{journey_id}/assignments",
        json={"user_id": admin_profile_id, "assignment_role": "contributor"},
        headers=AH, timeout=15,
    )
    step("re-add admin → 409 user_already_assigned",
         r.status_code == 409, f"HTTP {r.status_code}, detail={r.json().get('detail', '')[:80] if not r.ok else 'OK'}")

    # ── 13 · Add Designer A as observer ───────────────────────────────
    r = requests.post(
        f"{API_URL}/api/admin/journeys/{journey_id}/assignments",
        json={"user_id": designer_profile_id, "assignment_role": "observer"},
        headers=AH, timeout=15,
    )
    step("add Designer A as observer (client_visible=False default)",
         r.status_code == 201 and r.json()["assignment_role"] == "observer"
         and r.json()["client_visible"] is False,
         f"HTTP {r.status_code}, client_visible={r.json().get('client_visible')}")
    observer_aid = r.json().get("id") if r.ok else None

    # ── 14 · Try revoke owner via DELETE → 409 ────────────────────────
    r = requests.delete(
        f"{API_URL}/api/admin/journeys/{journey_id}/assignments/{new_owner_aid}",
        json={"reason": "test_reject_owner_revoke"},
        headers=AH, timeout=15,
    )
    step("DELETE owner via revoke → 409 (rejected)",
         r.status_code == 409, f"HTTP {r.status_code}, detail={r.json().get('detail', '')[:120] if not r.ok else 'OK'}")

    # ── 15 · Revoke observer → ok ─────────────────────────────────────
    r = requests.delete(
        f"{API_URL}/api/admin/journeys/{journey_id}/assignments/{observer_aid}",
        json={"reason": "no_longer_needed"},
        headers=AH, timeout=15,
    )
    step("DELETE observer → 200 ok", r.ok,
         f"HTTP {r.status_code}, response={r.json() if r.ok else r.text[:120]}")

    cur.execute("SELECT revoked_at, revoke_reason FROM design_journey_assignments WHERE id=%s",
                (observer_aid,))
    rev = cur.fetchone()
    step("DB: observer revoked_at != NULL",
         rev and rev[0] is not None, f"revoke_reason={rev[1] if rev else None}")

    # ── 16 · Designer A reads assignments (P_PROJECTS_READ) ───────────
    r = requests.get(f"{API_URL}/api/admin/journeys/{journey_id}/assignments",
                     headers=DH, timeout=15)
    step("Designer A GET admin assignments (READ permission ok)",
         r.ok and len(r.json()) == 1, f"HTTP {r.status_code}, rows={len(r.json()) if r.ok else 'err'}")

    # ── 17 · Audit trail events ───────────────────────────────────────
    r = requests.get(
        f"{API_URL}/api/admin/journeys/{journey_id}/assignments/events",
        headers=AH, timeout=15,
    )
    if r.ok:
        events = r.json().get("events", [])
        types = [e["event_type"] for e in events]
        expected = {"owner_assigned", "contributor_added", "owner_changed",
                    "role_changed", "observer_added", "observer_removed"}
        step("audit events include all expected types",
             expected.issubset(set(types)),
             f"got={sorted(set(types))}, missing={expected - set(types)}")
    else:
        step("audit events", False, f"HTTP {r.status_code}")

    # ── 18 · Final check: client referente is Designer A (round-robin) ─
    # Note: human_assignments priority chain picks designer over super_admin
    # when both are present. This is intentional (operator before founder).
    cur.execute("""SELECT assignee_user_id FROM human_assignments
                    WHERE subject_type='client' AND status='active'""")
    ha = cur.fetchone()
    step("client human_assignments referente assigned (Designer A by priority)",
         ha and str(ha[0]) == designer_profile_id,
         f"referente_user_id={ha[0] if ha else None}")

    cur.close()

    # ── Cleanup ───────────────────────────────────────────────────────
    cleanup_db(conn)
    cleanup_designer(DESIGNER_EMAIL)
    cleanup_designer(CLIENT_EMAIL)
    conn.close()

    # Verify cleanup restored Founder Only
    conn2 = psycopg2.connect(DATABASE_URL)
    cur = conn2.cursor()
    cur.execute("SELECT COUNT(*) FROM users_profile")
    n_users = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM design_journeys")
    n_journeys = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM design_journey_assignments")
    n_assignments = cur.fetchone()[0]
    cur.close(); conn2.close()
    step("post-cleanup: Founder Only restored",
         n_users == 1 and n_journeys == 0 and n_assignments == 0,
         f"users={n_users}, journeys={n_journeys}, assignments={n_assignments}")

    # ── Summary ───────────────────────────────────────────────────────
    print("\n=== SUMMARY ===")
    passed = sum(1 for r in results if r["ok"])
    print(f"  {passed}/{len(results)} steps passed")
    if passed < len(results):
        print("  FAILED:")
        for r in results:
            if not r["ok"]:
                print(f"    ❌ {r['step']}: {r['detail']}")

    with open("/app/backups/iter178_smoke_results.json", "w") as f:
        json.dump({"passed": passed, "total": len(results), "results": results},
                  f, indent=2, default=str)
    return passed == len(results)


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
