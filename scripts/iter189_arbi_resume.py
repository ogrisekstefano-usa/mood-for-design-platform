#!/usr/bin/env python3
"""ITER189-bis · ARBI extraction resume.

1) Mark stuck '2026_cat_SKY' as failed (preserves all 5 review docs + 683 pages).
2) Refresh set progress counters.
3) Re-trigger extraction (skips review+failed, processes 10 pending).
4) Tail status every 30s for the first 3 minutes (sanity poll).
"""
import os, sys, time, requests, json

BACKEND = "http://localhost:8001"
SET_ID = "00e33d7f-bcc4-47ae-914f-617d049906a7"
SKY_DOC_ID = None  # discovered

sys.path.insert(0, "/app/backend")
from database import db

c = db()

# 1. Find the stuck SKY doc
sky = (c.table("brand_catalog_documents")
        .select("id,original_filename,display_name,extraction_status")
        .eq("catalog_set_id", SET_ID)
        .eq("extraction_status", "extracting")
        .execute().data or [])
print(f"[1] Stuck docs (extraction_status=extracting): {len(sky)}")
for d in sky:
    print(f"    · {d.get('display_name') or d.get('original_filename')} (id={d['id']})")

# 2. Mark all of them as failed
for d in sky:
    bcd_id = d["id"]
    c.table("brand_catalog_documents").update({
        "extraction_status": "failed",
        "extraction_completed_at": "2026-06-02T13:35:00+00:00",
        "error_logs": [{"error": "Backend restart at 05:59Z killed FastAPI BackgroundTask. Marked failed for resume per Founder ITER189-pre directive.", "at": "2026-06-02T13:35:00+00:00"}],
    }).eq("id", bcd_id).execute()
    # Also mark source_document
    src_rows = (c.table("brand_catalog_documents").select("source_document_id").eq("id", bcd_id).limit(1).execute().data or [])
    if src_rows:
        sid = src_rows[0]["source_document_id"]
        try:
            c.table("source_documents").update({
                "extraction_status": "failed",
            }).eq("id", sid).execute()
        except Exception as e:
            print(f"    ! source_documents update warn: {e}")
    print(f"    ✓ {bcd_id} marked failed")

# 3. Refresh set progress counters (recomputes from children)
docs = (c.table("brand_catalog_documents")
        .select("id,extraction_status,page_count,pages_processed")
        .eq("catalog_set_id", SET_ID).execute().data or [])
extracted = sum(1 for d in docs if d["extraction_status"] in ("review","validated"))
failed = sum(1 for d in docs if d["extraction_status"] == "failed")
total_pages = sum(int(d.get("page_count") or 0) for d in docs)
pages_done = sum(int(d.get("pages_processed") or 0) for d in docs)
print(f"\n[3] Set state post-cleanup: extracted={extracted}, failed={failed}, pages_done={pages_done}/{total_pages}")

# 4. Re-trigger extraction via API (the worker will SKIP review + failed,
#    process the 10 'pending' docs).
print("\n[4] Re-triggering extraction…")
r = requests.post(f"{BACKEND}/api/auth/login", json={
    "email": "admin@moodfordesign.com", "password": "Blueprint2024!"}, timeout=30)
tk = r.json()["session"]["access_token"]
H = {"Authorization": f"Bearer {tk}"}

# Issue: trigger_extraction blocks if status=='extracting'. We need to flip to needs_review first OR force.
# The set status currently = 'extracting'. We must reset it to allow trigger.
c.table("brand_catalog_sets").update({"status": "needs_review", "updated_at": "2026-06-02T13:35:00+00:00"}).eq("id", SET_ID).execute()
print("    Set status flipped to needs_review to unblock trigger.")

r = requests.post(f"{BACKEND}/api/brand-catalog/catalog-sets/{SET_ID}/extract",
                   headers=H, json={"max_candidates_per_doc": 600, "rebuild_index": True}, timeout=30)
print(f"    Trigger HTTP {r.status_code}: {r.text[:200]}")

# 5. Watch for 90 seconds
print("\n[5] Watching progress (90s)…")
for i in range(6):
    time.sleep(15)
    s = (c.table("brand_catalog_sets")
         .select("status,extraction_progress,documents_extracted,documents_failed,pages_processed,updated_at")
         .eq("id", SET_ID).limit(1).execute().data or [{}])[0]
    print(f"  t+{15*(i+1):>3}s · status={s.get('status'):<14} prog={s.get('extraction_progress')}% "
          f"docs={s.get('documents_extracted')}/16 failed={s.get('documents_failed')} "
          f"pages={s.get('pages_processed')} updated={(s.get('updated_at') or '')[:19]}")
