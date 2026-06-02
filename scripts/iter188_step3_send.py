#!/usr/bin/env python3
"""ITER188 T6: Send an outbound email via Blueprint SMTP.
Self-send + send to slabreality@gmail.com to validate delivery."""
import sys, time, requests, datetime

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
    ts = datetime.datetime.now().strftime("%H:%M:%S")

    # Send #1 — self-send to me@moodfordesign.com (proves IMAP + SMTP loop)
    payload1 = {
        "to_addrs": ["me@moodfordesign.com"],
        "cc_addrs": [],
        "bcc_addrs": [],
        "subject": f"ITER188 · Blueprint SMTP Self-Test · {ts}",
        "body_text": (
            "This is an automated ITER188 live validation message sent BY Blueprint\n"
            "TO the same mailbox to validate the full IMAP→SMTP→Sent loop.\n\n"
            f"Sent at: {ts}\n"
            "Sprint: ITER188 Live Validation\n"
            "Sender: Blueprint Journey Mail Intelligence™\n"
        ),
        "body_html": None,
    }
    print(f"[T6.a] Sending self-test → me@moodfordesign.com")
    r = requests.post(f"{BACKEND}/api/journey-mail/mailboxes/{mbid}/send",
                       headers=headers, json=payload1, timeout=120)
    print(f"  HTTP {r.status_code}: {r.text[:300]}")

    # Send #2 — real external recipient
    payload2 = {
        "to_addrs": ["slabreality@gmail.com"],
        "cc_addrs": [],
        "bcc_addrs": [],
        "subject": f"ITER188 · Blueprint live validation · {ts}",
        "body_text": (
            "Hi,\n\n"
            "This is an automated ITER188 live-validation message sent from MOOD for "
            "DESIGN™ via Blueprint Journey Mail Intelligence™.\n\n"
            f"Sent at: {ts}\n"
            "If you receive this and the sender shows correctly as 'MOOD for DESIGN <me@moodfordesign.com>', "
            "the SMTP outbound path is validated.\n\n"
            "— Blueprint (automated test)\n"
        ),
        "body_html": None,
    }
    print(f"\n[T6.b] Sending external → slabreality@gmail.com")
    r = requests.post(f"{BACKEND}/api/journey-mail/mailboxes/{mbid}/send",
                       headers=headers, json=payload2, timeout=120)
    print(f"  HTTP {r.status_code}: {r.text[:300]}")

if __name__ == "__main__":
    main()
