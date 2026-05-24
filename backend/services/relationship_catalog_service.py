"""ITER148 Sprint A · Relationship Catalog Service.

Builds a hierarchical catalog payload (groups → questions → options) from
the runtime view `relationship_catalog_v1`. Server-side caching keeps the
intake wizard payload sub-50ms even on cold DB.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

from database import db

logger = logging.getLogger(__name__)

_CACHE: dict[str, object] = {"payload": None, "loaded_at": 0.0}
_CACHE_TTL = 60.0  # seconds


def invalidate_catalog_cache() -> None:
    _CACHE["payload"] = None
    _CACHE["loaded_at"] = 0.0


def _load_raw() -> list[dict]:
    """Load the flat catalog view."""
    try:
        rows = (db().table('relationship_catalog_v1')
                .select('*')
                .order('group_order')
                .order('question_order')
                .order('option_order')
                .execute().data) or []
        return rows
    except Exception:
        logger.exception("relationship_catalog_service: failed loading view")
        return []


def get_catalog(lead_type: Optional[str] = None) -> dict:
    """Return runtime catalog as `{groups: [{questions: [{options: []}]}]}`.

    Filters by `lead_type` when provided (NULL applies_to ↔ both).
    Result is cached in process for `_CACHE_TTL` seconds.
    """
    now = time.time()
    if _CACHE["payload"] is not None and (now - float(_CACHE["loaded_at"])) < _CACHE_TTL:
        cached = _CACHE["payload"]
    else:
        rows = _load_raw()
        groups: dict[str, dict] = {}
        for r in rows:
            g_key = r["group_key"]
            if g_key not in groups:
                groups[g_key] = {
                    "group_key":   g_key,
                    "display_order": r["group_order"],
                    "label":       r["group_label"],
                    "sublabel":    r.get("group_sublabel"),
                    "applies_to":  r.get("group_applies_to"),
                    "questions":   {},
                }
            q_key = r.get("question_key")
            if not q_key:
                continue
            qs = groups[g_key]["questions"]
            if q_key not in qs:
                qs[q_key] = {
                    "question_key":   q_key,
                    "question_type":  r["question_type"],
                    "max_selections": r.get("max_selections"),
                    "prompt":         r["question_prompt"],
                    "helper":         r.get("question_helper"),
                    "is_required":    bool(r.get("is_required")),
                    "display_order":  r["question_order"],
                    "options":        [],
                }
            if r.get("option_value") is not None:
                qs[q_key]["options"].append({
                    "value":             r["option_value"],
                    "label":             r["option_label"],
                    "helper":            r.get("option_helper"),
                    "tag_cluster":       r.get("tag_cluster") or [],
                    "atmosphere":        r.get("atmosphere") or [],
                    "material":          r.get("material") or [],
                    "cultural_register": r.get("cultural_register"),
                    "luxury_tier":       r.get("luxury_tier"),
                    "intent_weight":     float(r.get("intent_weight") or 0.0),
                    "image_url":         r.get("image_url"),
                    "display_order":     r.get("option_order"),
                })
        out_groups = []
        for g in sorted(groups.values(), key=lambda x: x["display_order"] or 0):
            g["questions"] = sorted(g["questions"].values(),
                                    key=lambda q: q["display_order"] or 0)
            out_groups.append(g)
        cached = {"groups": out_groups}
        _CACHE["payload"] = cached
        _CACHE["loaded_at"] = now

    if not lead_type:
        return cached

    # Filter copy by lead_type
    filtered = []
    for g in cached["groups"]:
        if g.get("applies_to") and g["applies_to"] != lead_type:
            continue
        filtered.append(g)
    return {"groups": filtered}


def question_to_group_key(question_key: str) -> Optional[str]:
    cat = get_catalog()
    for g in cat["groups"]:
        for q in g["questions"]:
            if q["question_key"] == question_key:
                return g["group_key"]
    return None
