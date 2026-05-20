#!/usr/bin/env python3
"""Reclassify existing Product Inspirations™ (Phase F1 migration script).

Re-run Layer 1 (asset_classifier) and compute visual_group_key for every
`media_library` row with `is_inspiration=true` AND
`inspiration_meta.inspiration_type='product'`.

Layer 2 (Vision LLM) is NOT invoked — this script is BATCH and FREE.

Properties:
  • Idempotent (every run produces the same metadata for the same image)
  • Resumable: skip rows that already have `inspiration_meta.classified_by`
    unless `--force` is given
  • Batch-safe: processes 50 rows at a time, sleeps between batches
  • Logs every action; counts at the end
  • Single-tenant or all-tenants mode

Usage:
  python3 scripts/reclassify_existing_assets.py             # all tenants, skip done
  python3 scripts/reclassify_existing_assets.py --force     # re-run all
  python3 scripts/reclassify_existing_assets.py --tenant TID
  python3 scripts/reclassify_existing_assets.py --limit 20  # debug small batch
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

# Bootstrap path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from cultural_engine import asset_classifier, visual_grouping  # noqa: E402
from database import db                                          # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s reclassify: %(message)s",
)
logger = logging.getLogger("reclassify")


def _fetch_image(url: str, timeout: int = 15) -> Optional[bytes]:
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as cli:
            r = cli.get(url)
            if r.status_code != 200:
                return None
            return r.content
    except Exception as e:
        logger.warning(f"fetch failed for {url[:80]}: {e}")
        return None


def _process_row(row: Dict[str, Any], force: bool) -> str:
    """Returns: 'updated' | 'skipped' | 'no_image' | 'failed'."""
    meta = row.get("inspiration_meta") or {}
    if not force and meta.get("classified_by") in ("rule", "vision"):
        return "skipped"

    image_url = row.get("file_url")
    if not image_url:
        return "no_image"

    img_bytes = _fetch_image(image_url)
    if not img_bytes:
        return "no_image"

    try:
        layer1 = asset_classifier.classify_asset(
            img_bytes,
            width=row.get("width"),
            height=row.get("height"),
        )
    except Exception as e:
        logger.warning(f"classify failed for {row['id']}: {e}")
        return "failed"

    # Compute visual group key
    vg_key = visual_grouping.compute_visual_group_key(
        tenant_id=row.get("tenant_id"),
        supplier_catalog_id=meta.get("supplier_catalog_id"),
        brand_id=meta.get("brand_id"),
        brand_name=meta.get("brand"),
        product_name=meta.get("product_name"),
        collection=meta.get("collection"),
        page_window=visual_grouping.page_window_for(meta.get("page_number") or 0),
    )

    merged = {
        **meta,
        **layer1,
        "visual_group_key":      vg_key,
        "reclassified_at":       datetime.now(timezone.utc).isoformat(),
    }

    try:
        db().table("media_library").update({
            "inspiration_meta": merged,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", row["id"]).execute()
        return "updated"
    except Exception as e:
        logger.warning(f"DB update failed for {row['id']}: {e}")
        return "failed"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true", help="re-classify even already-done rows")
    p.add_argument("--tenant", default=None, help="single tenant_id (default: all)")
    p.add_argument("--limit", type=int, default=10000, help="max rows to process")
    p.add_argument("--batch", type=int, default=50)
    p.add_argument("--sleep", type=float, default=0.0)
    args = p.parse_args()

    c = db()
    query = (c.table("media_library").select(
        "id,tenant_id,file_url,width,height,inspiration_meta,created_at"
    ).eq("is_inspiration", True)
     .eq("inspiration_meta->>inspiration_type", "product")
     .order("created_at", desc=False)
     .limit(args.limit))
    if args.tenant:
        query = query.eq("tenant_id", args.tenant)
    rows: List[Dict[str, Any]] = query.execute().data or []
    logger.info(f"loaded {len(rows)} Product Inspirations to consider")

    counts = {"updated": 0, "skipped": 0, "no_image": 0, "failed": 0}
    for i, row in enumerate(rows, 1):
        verdict = _process_row(row, force=args.force)
        counts[verdict] += 1
        if i % args.batch == 0:
            logger.info(f"... {i}/{len(rows)} processed | counts={counts}")
            if args.sleep > 0:
                time.sleep(args.sleep)
    logger.info(f"DONE | totals={counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
