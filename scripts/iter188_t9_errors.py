#!/usr/bin/env python3
"""ITER188 T9: error handling validation.
Tests wrong password / wrong host / disabled — no credential leakage."""
import os, requests, json

BACKEND = "http://localhost:8001"

def login():
    r = requests.post(f"{BACKEND}/api/auth/login", json={
        "email": "admin@moodfordesign.com",
        "password": "Blueprint2024!"}, timeout=30)
    return r.json()["session"]["access_token"]


def main():
    token = login()
    headers = {"Authorization": f"Bearer {token}"}

    # T9.a — Wrong password mailbox: create temp mailbox with bad password
    print("=== T9.a · Wrong IMAP password ===")
    payload = {
        "mailbox_name": "T9 · Bad Password",
        "mailbox_type": "personal",
        "from_name": "Test",
        "from_email": "t9bad@moodfordesign.com",
        "imap_host": "gnldm1105.siteground.biz", "imap_port": 993, "imap_security": "ssl",
        "imap_username": "me@moodfordesign.com", "imap_password": "wrongpw_xyz_12345",
        "smtp_host": "gnldm1105.siteground.biz", "smtp_port": 465, "smtp_security": "ssl",
        "smtp_username": "me@moodfordesign.com", "smtp_password": "wrongpw_xyz_12345",
        "provider_hint": "siteground",
        "visibility_scope": {"mode": "tenant"},
    }
    r = requests.post(f"{BACKEND}/api/journey-mail/mailboxes", headers=headers, json=payload, timeout=60)
    print(f"  Create HTTP {r.status_code}")
    if r.status_code < 300:
        bid = r.json()["id"]
        h = requests.get(f"{BACKEND}/api/journey-mail/mailboxes/{bid}/health",
                          headers=headers, timeout=60).json()
        print(f"  IMAP ok={h['imap']['ok']} last_error={h['imap'].get('last_error')!r}")
        print(f"  SMTP ok={h['smtp']['ok']} last_error={h['smtp'].get('last_error')!r}")
        leak_test_words = ["wrongpw_xyz_12345", "Rebby2016"]
        full_response = json.dumps(h)
        leak = any(w in full_response for w in leak_test_words)
        print(f"  Credential leak in response? {'⚠️ YES' if leak else '✅ NO'}")
        # cleanup
        requests.delete(f"{BACKEND}/api/journey-mail/mailboxes/{bid}", headers=headers)
        print(f"  cleanup OK")

    # T9.b — Wrong host
    print("\n=== T9.b · Wrong IMAP host ===")
    payload["mailbox_name"] = "T9 · Bad Host"
    payload["from_email"] = "t9host@moodfordesign.com"
    payload["imap_host"] = "imap.this-host-does-not-exist-2026.invalid"
    payload["smtp_host"] = "smtp.this-host-does-not-exist-2026.invalid"
    payload["imap_password"] = os.environ["MFD_IMAP_PW"]
    payload["smtp_password"] = os.environ["MFD_SMTP_PW"]
    r = requests.post(f"{BACKEND}/api/journey-mail/mailboxes", headers=headers, json=payload, timeout=60)
    print(f"  Create HTTP {r.status_code}")
    if r.status_code < 300:
        bid = r.json()["id"]
        h = requests.get(f"{BACKEND}/api/journey-mail/mailboxes/{bid}/health",
                          headers=headers, timeout=60).json()
        print(f"  IMAP ok={h['imap']['ok']} last_error={h['imap'].get('last_error')!r}")
        print(f"  SMTP ok={h['smtp']['ok']} last_error={h['smtp'].get('last_error')!r}")
        # Verify no stacktrace leak
        full = json.dumps(h)
        has_traceback = "Traceback" in full or "File \"/app" in full
        print(f"  Stacktrace leak? {'⚠️ YES' if has_traceback else '✅ NO'}")
        requests.delete(f"{BACKEND}/api/journey-mail/mailboxes/{bid}", headers=headers)

    # T9.c — Disabled mailbox: disable our main and try sync
    print("\n=== T9.c · Disabled mailbox sync attempt ===")
    main_id = open("/tmp/iter188_mailbox_id").read().strip()
    r = requests.patch(f"{BACKEND}/api/journey-mail/mailboxes/{main_id}",
                        headers=headers, json={"sync_enabled": False}, timeout=30)
    print(f"  Disable sync HTTP {r.status_code}")
    r = requests.post(f"{BACKEND}/api/journey-mail/mailboxes/{main_id}/sync",
                       headers=headers, timeout=30)
    print(f"  Sync HTTP {r.status_code} response={r.text[:200]}")
    # Re-enable
    requests.patch(f"{BACKEND}/api/journey-mail/mailboxes/{main_id}",
                    headers=headers, json={"sync_enabled": True}, timeout=30)
    print(f"  Re-enabled sync.")


if __name__ == "__main__":
    main()
