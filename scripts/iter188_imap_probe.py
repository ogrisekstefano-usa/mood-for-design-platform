#!/usr/bin/env python3
"""Direct IMAP probe — list folders, count messages in INBOX without setting \\Seen.
Read-only and PEEK-only by ImapSafeClient guarantee."""
import os, sys
sys.path.insert(0, "/app/backend")
from cultural_engine.mail.imap_safe import ImapSafeClient

c = ImapSafeClient.connect(
    host="gnldm1105.siteground.biz",
    port=993,
    security="ssl",
    username="me@moodfordesign.com",
    password=os.environ["MFD_IMAP_PW"],
    timeout=30,
)
try:
    folders = c.list_folders()
    print(f"[FOLDERS] {len(folders)} found:")
    for f in folders:
        print(f"  · {f!r}")
    # Examine INBOX (read-only)
    try:
        uv, n = c.select_readonly("INBOX")
        print(f"\n[INBOX] uid_validity={uv} num_messages={n}")
        uids = c.uid_search("ALL")
        print(f"[INBOX] uid_search ALL → {len(uids)} uids; last 5: {uids[-5:]}")
        if uids:
            # Fetch envelopes for last 5
            envs = c.uid_fetch_envelopes(uids[-5:])
            for uid, raw in envs:
                txt = raw.decode("utf-8", errors="ignore")[:300]
                print(f"  env: {txt}")
            # Fetch FLAGS for the very last one (proof of unread state)
            last_uid = uids[-1]
            flags = c.uid_fetch_flags(last_uid)
            seen_str = "\\Seen"
            print(f"\n[FLAGS] uid={last_uid} flags={flags}  Seen present? {seen_str in flags}")
    except Exception as e:
        print(f"[!] examine INBOX failed: {e}")
    # Sent folder candidates
    sent_candidates = [f for f in folders if 'sent' in f.lower()]
    print(f"\n[SENT candidates] {sent_candidates}")
    for sf in sent_candidates:
        try:
            uv, n = c.select_readonly(sf)
            print(f"  {sf!r}: {n} messages")
        except Exception as e:
            print(f"  {sf!r}: error {e}")
finally:
    c.close()
print("\n[AUDIT TRAIL]")
for v, a in c.commands_audit:
    print(f"  · {v.upper():<12} {a[:80]}")
