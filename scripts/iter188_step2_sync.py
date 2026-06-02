#!/usr/bin/env python3
"""ITER188 Step 2/3: Trigger sync, then read messages."""
import os, sys, time, requests

BACKEND = "http://localhost:8001"

def login():
    r = requests.post(f"{BACKEND}/api/auth/login", json={
        "email": "admin@moodfordesign.com",
        "password": "Blueprint2024!"}, timeout=30)
    return r.json()["session"]["access_token"]


def main():
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    mbid = open("/tmp/iter188_mailbox_id").read().strip()
    print(f"[i] Mailbox: {mbid}")

    # Sync
    print("[T2/T3] Triggering sync…")
    r = requests.post(f"{BACKEND}/api/journey-mail/mailboxes/{mbid}/sync",
                       headers=headers, timeout=60)
    print(f"  Sync HTTP {r.status_code}: {r.text[:200]}")

    # Poll mailbox detail until sync completes (max 60s)
    deadline = time.time() + 60
    while time.time() < deadline:
        r = requests.get(f"{BACKEND}/api/journey-mail/mailboxes/{mbid}",
                          headers=headers, timeout=30)
        m = r.json()
        status = m.get("connection_status")
        synced = m.get("messages_synced_total")
        last = m.get("last_sync_completed_at")
        print(f"  poll · status={status} · synced={synced} · last_sync={last}")
        if last:
            break
        time.sleep(5)
    
    # List messages
    print("\n[T3] Listing messages…")
    r = requests.get(f"{BACKEND}/api/journey-mail/mailboxes/{mbid}/messages",
                      headers=headers, params={"limit": 30, "offset": 0}, timeout=30)
    data = r.json()
    msgs = data.get("messages", [])
    print(f"  Total returned: {len(msgs)}")
    # Save full first message id for detail testing
    saved = []
    for i, msg in enumerate(msgs[:15]):
        print(f"  [{i+1}] {msg.get('received_at','?'):<22}"
              f" {msg.get('direction',' ')[:2]:>3}"
              f" subj={(msg.get('subject') or '(none)')[:60]!r:<62}"
              f" from={msg.get('from_addr','')[:35]}")
        saved.append({"id": msg["id"], "subject": msg.get("subject"), "from": msg.get("from_addr")})
    
    if saved:
        with open("/tmp/iter188_first_msg_id", "w") as f:
            f.write(saved[0]["id"])
        print(f"\n[i] First message id saved → /tmp/iter188_first_msg_id")

    # Look for the founder's test email
    target = next((m for m in msgs if "ITER188" in (m.get("subject") or "")
                                       or "test email sito" in (m.get("subject") or "").lower()), None)
    if target:
        print(f"\n[★] Founder test email FOUND: {target.get('subject')!r}")
        with open("/tmp/iter188_target_msg_id", "w") as f:
            f.write(target["id"])
    else:
        print("\n[i] Founder test email not found in first 30 messages (will use first message for T4 detail).")


if __name__ == "__main__":
    main()
