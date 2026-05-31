"""ITER177 Phase 0 · Team Foundation smoke test (E2E).

Simulates:
  1. admin@moodfordesign.com logs in
  2. admin invites Designer A (POST /api/members/invite)
  3. Verify users_profile, tenant_memberships, member_invites rows created
  4. Verify GET /api/members excludes clients
  5. Simulate Designer A's first login (Supabase password reset path)
  6. Verify status transitioned invited → active

Cleanup: DELETE the test designer at the end so the DB returns to
Founder-Only state (preserves ITER174 invariants).
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
ADMIN_EMAIL = "admin@moodfordesign.com"
ADMIN_PW    = "Blueprint2024!"
DESIGNER_EMAIL = "designer.test+iter177@example.com"
DESIGNER_PW    = "DesignerTest2026!"

results = []
def step(name, ok, detail=""):
    flag = "✅" if ok else "❌"
    print(f"  {flag} {name}")
    if detail:
        print(f"     {detail}")
    results.append({"step": name, "ok": ok, "detail": detail})


def main():
    print("\n=== ITER177 · Team Foundation Smoke Test ===\n")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # ── 1 · Admin login ───────────────────────────────────────────────
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PW},
                      timeout=15)
    step("admin login", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code != 200:
        return
    admin_token = r.json()["session"]["access_token"]
    H = {"Authorization": f"Bearer {admin_token}"}

    # ── 2 · Verify members list excludes clients (default) ────────────
    r = requests.get(f"{API_URL}/api/members", headers=H, timeout=10)
    members_default = r.json() if r.ok else []
    has_client = any(m["role"] == "client" for m in members_default)
    step("GET /api/members (default) excludes clients",
         r.ok and not has_client,
         f"HTTP {r.status_code}, {len(members_default)} rows, contains client={has_client}")

    # ── 3 · Verify include_clients=true returns clients too ───────────
    r2 = requests.get(f"{API_URL}/api/members?include_clients=true", headers=H, timeout=10)
    step("GET /api/members?include_clients=true overrides filter",
         r2.ok,
         f"HTTP {r2.status_code}, {len(r2.json() if r2.ok else [])} rows")

    # ── 4 · Roles endpoint shows sales + advisor ──────────────────────
    r = requests.get(f"{API_URL}/api/members/roles", headers=H, timeout=10)
    roles_payload = r.json() if r.ok else {}
    role_keys = {x["key"] for x in roles_payload.get("roles", [])}
    step("GET /api/members/roles includes new roles (sales, advisor)",
         {"sales", "advisor"}.issubset(role_keys),
         f"keys={sorted(role_keys)}")

    # ── 5 · Cleanup any leftover from previous run ────────────────────
    # Delete from users_profile + tenant_memberships + member_invites
    # + auth.users to make the test idempotent.
    cur.execute("SELECT id, auth_user_id FROM users_profile WHERE email = %s", (DESIGNER_EMAIL,))
    leftover = cur.fetchone()
    if leftover:
        conn.autocommit = False
        try:
            cur.execute("DELETE FROM tenant_memberships WHERE profile_id = %s", (leftover[0],))
            cur.execute("DELETE FROM member_invites WHERE email = %s", (DESIGNER_EMAIL,))
            cur.execute("DELETE FROM users_profile WHERE id = %s", (leftover[0],))
            conn.commit()
        except Exception as e:
            conn.rollback()
            step("pre-cleanup leftover", False, str(e))
            return
        # auth.users
        requests.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{leftover[1]}",
                        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
                        timeout=10)
        step("pre-cleanup leftover designer", True, f"removed profile {leftover[0]}")

    # ── 6 · POST /api/members/invite (Designer) ───────────────────────
    payload = {
        "email": DESIGNER_EMAIL,
        "first_name": "Designer",
        "last_name":  "Test ITER177",
        "role":       "designer",
    }
    r = requests.post(f"{API_URL}/api/members/invite",
                      json=payload, headers=H, timeout=20)
    invite_ok = r.status_code == 201
    invited = r.json() if invite_ok else {}
    step("POST /api/members/invite (designer)",
         invite_ok,
         f"HTTP {r.status_code}, id={invited.get('id')}, status={invited.get('status')}, role={invited.get('role')}")
    if not invite_ok:
        print(f"     response: {r.text[:200]}")
        return

    designer_profile_id = invited["id"]
    designer_auth_id    = invited.get("auth_user_id")

    # ── 7 · Verify DB rows created correctly ──────────────────────────
    cur.execute("""SELECT id, auth_user_id, tenant_id, email, role, status,
                          invited_by, invited_at
                     FROM users_profile WHERE id = %s""", (designer_profile_id,))
    profile_row = cur.fetchone()
    step("users_profile row has status='invited' and role='designer'",
         profile_row and profile_row[4] == "designer" and profile_row[5] == "invited",
         f"role={profile_row[4]}, status={profile_row[5]}, invited_at={profile_row[7]}" if profile_row else "no row")

    cur.execute("SELECT status FROM tenant_memberships WHERE profile_id = %s", (designer_profile_id,))
    tm = cur.fetchone()
    step("tenant_memberships row created with status='invited'",
         tm and tm[0] == "invited",
         f"status={tm[0] if tm else None}")

    cur.execute("SELECT status, sent_at FROM member_invites WHERE email = %s", (DESIGNER_EMAIL,))
    mi = cur.fetchone()
    step("member_invites row created (status sent or sent_silent)",
         mi and mi[0] in ("sent", "sent_silent"),
         f"status={mi[0] if mi else None}")

    # ── 8 · Verify designer appears in GET /api/members (now we have 2) ─
    r = requests.get(f"{API_URL}/api/members", headers=H, timeout=10)
    members = r.json() if r.ok else []
    designer_in_list = any(m["id"] == designer_profile_id for m in members)
    step("designer appears in GET /api/members",
         designer_in_list,
         f"total={len(members)}")

    # ── 9 · Designer first-login simulation ───────────────────────────
    # Since invite was sent via Supabase Admin API, the user has an auth.users
    # row but no password. We set a password via admin API to simulate the
    # "set password" step that follows the magic-link.
    r = requests.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{designer_auth_id}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json"},
        json={"password": DESIGNER_PW, "email_confirm": True},
        timeout=15,
    )
    step("supabase admin: set password on invited user",
         r.ok, f"HTTP {r.status_code}")

    # Now log in as the designer via /api/auth/login
    time.sleep(1)
    r = requests.post(f"{API_URL}/api/auth/login",
                      json={"email": DESIGNER_EMAIL, "password": DESIGNER_PW},
                      timeout=15)
    designer_login_ok = r.status_code == 200
    designer_user     = r.json().get("user") if designer_login_ok else {}
    step("designer first login via /api/auth/login",
         designer_login_ok,
         f"HTTP {r.status_code}, status_in_response={designer_user.get('status')}")

    # ── 10 · Verify DB transitioned invited → active ──────────────────
    cur.execute("""SELECT status, accepted_at, last_login_at
                     FROM users_profile WHERE id = %s""", (designer_profile_id,))
    p = cur.fetchone()
    step("users_profile transitioned invited→active",
         p and p[0] == "active" and p[1] is not None,
         f"status={p[0]}, accepted_at={p[1]}, last_login_at={p[2]}" if p else "no row")

    cur.execute("SELECT status FROM tenant_memberships WHERE profile_id = %s", (designer_profile_id,))
    tm2 = cur.fetchone()
    step("tenant_memberships mirrored to active",
         tm2 and tm2[0] == "active",
         f"status={tm2[0] if tm2 else None}")

    cur.execute("SELECT status, accepted_at FROM member_invites WHERE email = %s", (DESIGNER_EMAIL,))
    mi2 = cur.fetchone()
    step("member_invites mirrored to accepted",
         mi2 and mi2[0] == "accepted",
         f"status={mi2[0] if mi2 else None}, accepted_at={mi2[1] if mi2 else None}")

    # ── 11 · Designer can fetch /api/auth/me (must succeed) ───────────
    designer_token = r.json()["session"]["access_token"]
    H2 = {"Authorization": f"Bearer {designer_token}"}
    r = requests.get(f"{API_URL}/api/auth/me", headers=H2, timeout=10)
    me_ok = r.ok and r.json().get("email") == DESIGNER_EMAIL
    step("designer GET /api/auth/me", me_ok,
         f"HTTP {r.status_code}, status={r.json().get('status') if r.ok else 'n/a'}")

    # Designer should NOT be able to invite (lacks P_TENANT_MEMBERS_WRITE)
    r = requests.post(f"{API_URL}/api/members/invite",
                      json={"email": "another@example.com", "first_name": "X",
                            "last_name": "Y", "role": "designer"},
                      headers=H2, timeout=10)
    step("designer is BLOCKED from inviting (RBAC)",
         r.status_code == 403, f"HTTP {r.status_code}")

    # ── 12 · Cleanup → restore Founder Only state ─────────────────────
    conn.autocommit = False
    try:
        cur.execute("DELETE FROM tenant_memberships WHERE profile_id = %s", (designer_profile_id,))
        cur.execute("DELETE FROM member_invites WHERE email = %s", (DESIGNER_EMAIL,))
        cur.execute("DELETE FROM users_profile WHERE id = %s", (designer_profile_id,))
        # also remove any audit_logs created by invite/login
        cur.execute("DELETE FROM audit_logs WHERE resource_id = %s OR (metadata_json->>'email') = %s",
                    (designer_profile_id, DESIGNER_EMAIL))
        # clean any login_attempts traces too
        cur.execute("DELETE FROM login_attempts WHERE email = %s", (DESIGNER_EMAIL,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        step("cleanup DB", False, str(e))
    else:
        step("cleanup DB rows", True, f"removed designer profile {designer_profile_id}")

    r = requests.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{designer_auth_id}",
                        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
                        timeout=10)
    step("cleanup auth.users", r.ok, f"HTTP {r.status_code}")

    cur.close()
    conn.close()

    # ── Summary ───────────────────────────────────────────────────────
    print("\n=== SUMMARY ===")
    passed = sum(1 for r in results if r["ok"])
    print(f"  {passed}/{len(results)} steps passed")
    if passed < len(results):
        print("  FAILED steps:")
        for r in results:
            if not r["ok"]:
                print(f"    - {r['step']}: {r['detail']}")
    # Write JSON report
    with open("/app/backups/iter177_smoke_results.json", "w") as f:
        json.dump({"passed": passed, "total": len(results), "results": results},
                  f, indent=2, default=str)
    return passed == len(results)


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
