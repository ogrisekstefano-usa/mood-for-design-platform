#!/usr/bin/env python3
"""ITER189-pre · Phase 1: Create missing mailbox-bodies bucket + reset cursors + re-sync."""
import os, sys
sys.path.insert(0, "/app/backend")
from database import db, get_admin_client

admin = get_admin_client()

# 1. Create bucket if missing
print("[1] Inventory existing buckets…")
buckets = admin.storage.list_buckets()
names = [b.name for b in buckets]
print(f"    Current: {names}")

if "mailbox-bodies" not in names:
    print("[2] Creating 'mailbox-bodies' (private)…")
    try:
        admin.storage.create_bucket("mailbox-bodies", options={
            "public": False,
            "allowed_mime_types": ["text/plain", "text/html"],
            "file_size_limit": 20 * 1024 * 1024,   # 20 MB per body, generous
        })
        print("    ✓ Created.")
    except Exception as e:
        print(f"    ! Create error: {type(e).__name__}: {e}")
        # Maybe simpler options work
        try:
            admin.storage.create_bucket("mailbox-bodies")
            print("    ✓ Created (simple options).")
        except Exception as e2:
            print(f"    !! still failing: {e2}")
            sys.exit(1)
else:
    print("[2] Bucket already exists. Skipping create.")

# Verify
buckets = admin.storage.list_buckets()
print(f"[3] Post-state: {[b.name for b in buckets]}")
print("[✓] Bucket OK")

# 4. Reset cursors for me@moodfordesign.com so re-sync re-fetches all
c = db()
mid = open("/tmp/iter188_mailbox_id").read().strip()
print(f"\n[4] Resetting cursors for mailbox {mid}…")
r = c.table("email_mailbox_cursors").update({"last_uid": 0}).eq("mailbox_id", mid).execute()
print(f"    Cursors reset: {len(r.data or [])} rows")

# 5. Delete previously-synced messages so re-sync doesn't dedupe-skip them
#    (the unique constraint is (mailbox_id, uid_validity, uid))
print(f"[5] Deleting previously-imported messages to allow re-sync…")
r = c.table("email_messages").delete().eq("mailbox_id", mid).execute()
print(f"    Deleted messages: {len(r.data or [])}")

# 6. Reset mailbox aggregate counters
c.table("email_mailboxes").update({
    "messages_synced_total": 0,
    "messages_inbox": 0,
    "messages_sent": 0,
}).eq("id", mid).execute()
print("[6] Mailbox counters reset.")
print("\n[NEXT] Trigger sync via API.")
