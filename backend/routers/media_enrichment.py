"""
media_enrichment.py — batch image-filter + focal-point enrichment helper.

When the public storefront renders a Project's gallery / Magazine article
body, the JSON blocks reference assets by URL but the filters/focal_point
metadata lives on `media_library`. To keep "what the user edits in
Blueprint is what the visitor sees", we resolve those metadata in a
single batch query and inline them into each item.

Usage:
    from .media_enrichment import enrich_items_with_filters

    project = _shape_variant_public(variant, master)
    enrich_items_with_filters(project["gallery"], project["story_body"])

The helper walks recursively into `items[]` (gallery blocks) where needed.

Only inlines: `filters`, `focal_point`. Other media_library columns are
NOT exposed — keeps the public payload minimal.
"""
from typing import List, Dict, Any
from database import db


def _collect_asset_ids(items: List[Dict[str, Any]]) -> set:
    out = set()
    if not items:
        return out
    for it in items:
        if not isinstance(it, dict):
            continue
        aid = it.get("asset_id")
        if aid:
            out.add(aid)
        # gallery blocks nested items
        for sub in (it.get("items") or []):
            if isinstance(sub, dict) and sub.get("asset_id"):
                out.add(sub["asset_id"])
    return out


def _apply(items: List[Dict[str, Any]], by_id: Dict[str, Dict[str, Any]]) -> None:
    if not items:
        return
    for it in items:
        if not isinstance(it, dict):
            continue
        aid = it.get("asset_id")
        if aid and aid in by_id:
            meta = by_id[aid]
            f = meta.get("filters")
            fp = meta.get("focal_point")
            if f:
                it["filters"] = f
            if fp and "focal_point" not in it:
                it["focal_point"] = fp
        for sub in (it.get("items") or []):
            if isinstance(sub, dict):
                sub_aid = sub.get("asset_id")
                if sub_aid and sub_aid in by_id:
                    meta = by_id[sub_aid]
                    if meta.get("filters"):
                        sub["filters"] = meta["filters"]
                    if meta.get("focal_point") and "focal_point" not in sub:
                        sub["focal_point"] = meta["focal_point"]


def enrich_items_with_filters(*item_lists: List[Dict[str, Any]]) -> None:
    """Mutates `item_lists` in place — each list contains dicts with
    optional `asset_id`. Single batched IN query against media_library."""
    asset_ids: set = set()
    for items in item_lists:
        asset_ids |= _collect_asset_ids(items)
    if not asset_ids:
        return
    c = db()
    r = c.table("media_library").select("id, filters, focal_point") \
        .in_("id", list(asset_ids)).execute()
    by_id = {row["id"]: row for row in (r.data or [])}
    for items in item_lists:
        _apply(items, by_id)
