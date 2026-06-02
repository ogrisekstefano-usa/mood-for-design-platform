#!/usr/bin/env python3
"""Probe all folders for message count + last subject."""
import os, sys
sys.path.insert(0, "/app/backend")
from cultural_engine.mail.imap_safe import ImapSafeClient

c = ImapSafeClient.connect(
    host="gnldm1105.siteground.biz", port=993, security="ssl",
    username="me@moodfordesign.com", password=os.environ["MFD_IMAP_PW"], timeout=30)
try:
    for f in c.list_folders():
        try:
            uv, n = c.select_readonly(f)
            uids = c.uid_search("ALL")
            print(f"\n=== {f} ({n} msgs) ===")
            if uids:
                envs = c.uid_fetch_envelopes(uids[-3:])
                for _u, raw in envs:
                    print(f"  · {raw.decode('utf-8','ignore')[:250]}")
                # Check FLAGS for the last UID
                flags = c.uid_fetch_flags(uids[-1])
                seen_str = "\\Seen"
                print(f"  [last flags] {flags} · Seen? {seen_str in flags}")
        except Exception as e:
            print(f"  err {f}: {e}")
finally:
    c.close()
