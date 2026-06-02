#!/usr/bin/env python3
"""ITER188 Live Validation — Step 1: Connect mailbox via Blueprint API.
Credentials provided via env vars to avoid leaking in logs."""
import os
import sys
import json
import requests

BACKEND = "http://localhost:8001"

def login():
    r = requests.post(f"{BACKEND}/api/auth/login", json={
        "email": "admin@moodfordesign.com",
        "password": "Blueprint2024!",
    }, timeout=30)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def main():
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    imap_pw = os.environ["MFD_IMAP_PW"]
    smtp_pw = os.environ["MFD_SMTP_PW"]

    # First, list any existing mailboxes (cleanup awareness)
    r = requests.get(f"{BACKEND}/api/journey-mail/mailboxes", headers=headers, timeout=30)
    existing = (r.json() or {}).get("mailboxes", [])
    print(f"[i] Existing mailboxes: {len(existing)}")
    for m in existing:
        print(f"    - {m['id']} · {m['mailbox_name']} · {m.get('from_email')}")

    # If me@moodfordesign.com already exists, reuse it
    me_box = next((m for m in existing if m.get("from_email", "").lower() == "me@moodfordesign.com"), None)
    if me_box:
        print(f"[i] Re-using existing mailbox id={me_box['id']}")
        # Rotate credentials to ensure current
        rr = requests.put(
            f"{BACKEND}/api/journey-mail/mailboxes/{me_box['id']}/credentials",
            headers=headers,
            json={"imap_password": imap_pw, "smtp_password": smtp_pw},
            timeout=30,
        )
        print(f"[i] Credential rotation: {rr.status_code}")
        mailbox_id = me_box["id"]
    else:
        payload = {
            "mailbox_name": "MOOD for DESIGN · Founder",
            "mailbox_description": "ITER188 live validation mailbox",
            "mailbox_type": "shared",
            "from_name": "MOOD for DESIGN",
            "from_email": "me@moodfordesign.com",
            "reply_to_email": None,
            "imap_host": "gnldm1105.siteground.biz",
            "imap_port": 993,
            "imap_security": "ssl",
            "imap_username": "me@moodfordesign.com",
            "imap_password": imap_pw,
            "smtp_host": "gnldm1105.siteground.biz",
            "smtp_port": 465,
            "smtp_security": "ssl",
            "smtp_username": "me@moodfordesign.com",
            "smtp_password": smtp_pw,
            "is_primary": True,
            "provider_hint": "siteground",
            "visibility_scope": {"mode": "tenant"},
        }
        r = requests.post(f"{BACKEND}/api/journey-mail/mailboxes", headers=headers, json=payload, timeout=60)
        if r.status_code >= 300:
            print(f"[!] CREATE failed: HTTP {r.status_code}")
            print(r.text[:500])
            sys.exit(1)
        mbox = r.json()
        mailbox_id = mbox["id"]
        print(f"[✓] Created mailbox id={mailbox_id}")

    # Health probe
    print("\n[T1] Health probe…")
    r = requests.get(f"{BACKEND}/api/journey-mail/mailboxes/{mailbox_id}/health",
                      headers=headers, timeout=60)
    print(f"  HTTP {r.status_code}")
    h = r.json()
    print(f"  IMAP ok={h.get('imap', {}).get('ok')}  last_error={h.get('imap', {}).get('last_error')!r}")
    print(f"  SMTP ok={h.get('smtp', {}).get('ok')}  last_error={h.get('smtp', {}).get('last_error')!r}")
    folders = h.get("imap", {}).get("folders") or []
    print(f"  Folders ({len(folders)}): {folders[:15]}")
    peek = h.get("imap", {}).get("peek_supported")
    print(f"  PEEK supported: {peek}")

    # Save mailbox id for next steps
    with open("/tmp/iter188_mailbox_id", "w") as f:
        f.write(mailbox_id)
    print(f"\n[i] Mailbox id saved → /tmp/iter188_mailbox_id")


if __name__ == "__main__":
    main()
