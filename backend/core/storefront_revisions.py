"""Storefront Revision Engine — Draft / Live / Diff publishing workflow.

Owns the publish → snapshot → diff → revert cycle for the Storefront CMS.
Sits ONE LAYER ABOVE the existing cms_pages / cms_sections tables — it
never mutates section content directly, it only freezes/restores it.

Public API
──────────
• snapshot_page(tenant_id, page_id)           — frozen JSONB of page + sections
• publish_page(tenant_id, page_key, profile)  — create revision, point page at it
• list_revisions(tenant_id, page_id)          — newest-first
• diff_against_published(tenant_id, page_id)  — structured diff payload
• revert_to_revision(tenant_id, page_id, rid) — restore snapshot to live tables
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from fastapi import HTTPException
from database import db

_NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731


# ── Snapshot ─────────────────────────────────────────────────────────
SECTION_FIELDS_TO_FREEZE = (
    "id", "section_type", "sort_order", "visible",
    "locale_content", "settings", "asset_refs",
)
PAGE_FIELDS_TO_FREEZE = (
    "title", "locale_meta", "page_content",
    "status", "scheduled_publish_at",
)


def _fetch_page(tenant_id: str, page_id: str) -> Dict[str, Any]:
    client = db()
    r = client.table("cms_pages").select("*") \
        .eq("id", page_id).eq("tenant_id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Page not found")
    return r.data[0]


def _fetch_sections(tenant_id: str, page_id: str) -> List[Dict[str, Any]]:
    client = db()
    r = client.table("cms_sections").select("*") \
        .eq("tenant_id", tenant_id).eq("page_id", page_id) \
        .order("sort_order").execute()
    return r.data or []


def _fetch_assets(tenant_id: str, asset_ids: List[str]) -> Dict[str, Any]:
    """Bundle minimal asset metadata so revisions can render even after
    an asset is deleted/replaced. Reverting an old revision should still
    show the image the user remembered approving."""
    if not asset_ids:
        return {}
    client = db()
    # de-dup
    ids = list({a for a in asset_ids if a})
    if not ids:
        return {}
    r = client.table("cms_assets").select("id, public_url, alt_text, focal_point, dimensions") \
        .eq("tenant_id", tenant_id).in_("id", ids).execute()
    return {row["id"]: row for row in (r.data or [])}


def _collect_asset_ids(sections: List[Dict[str, Any]]) -> List[str]:
    out: List[str] = []
    for s in sections:
        refs = s.get("asset_refs") or []
        out.extend([a for a in refs if isinstance(a, str)])
        # also peek into settings for asset_id fields (defensive)
        settings = s.get("settings") or {}
        for v in settings.values() if isinstance(settings, dict) else []:
            if isinstance(v, str) and len(v) == 36:
                out.append(v)
    return out


def snapshot_page(tenant_id: str, page_id: str) -> Dict[str, Any]:
    """Build an immutable snapshot dict for the current state of the page."""
    page = _fetch_page(tenant_id, page_id)
    sections = _fetch_sections(tenant_id, page_id)
    sec_payload = [{k: s.get(k) for k in SECTION_FIELDS_TO_FREEZE} for s in sections]
    asset_index = _fetch_assets(tenant_id, _collect_asset_ids(sections))
    return {
        "page":     {k: page.get(k) for k in PAGE_FIELDS_TO_FREEZE},
        "sections": sec_payload,
        "asset_index": asset_index,
        "frozen_at": _NOW(),
    }


# ── Diff engine ──────────────────────────────────────────────────────
def _diff_dicts(a: Optional[Dict[str, Any]], b: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Shallow per-key diff. Returns {added, removed, changed: {key: {from, to}}}."""
    a = a or {}; b = b or {}
    keys = set(a.keys()) | set(b.keys())
    added: Dict[str, Any] = {}
    removed: Dict[str, Any] = {}
    changed: Dict[str, Any] = {}
    for k in keys:
        if k not in a:
            added[k] = b[k]
        elif k not in b:
            removed[k] = a[k]
        elif a[k] != b[k]:
            changed[k] = {"from": a[k], "to": b[k]}
    return {"added": added, "removed": removed, "changed": changed}


def _diff_section_content(prev: Dict[str, Any], curr: Dict[str, Any]) -> Dict[str, Any]:
    """Diff a single section's locale_content + settings.

    locale_content is {locale: {field: value}}. We diff per-locale and per-field.
    """
    prev_lc = prev.get("locale_content") or {}
    curr_lc = curr.get("locale_content") or {}
    locales = set(prev_lc.keys()) | set(curr_lc.keys())
    locale_diff: Dict[str, Any] = {}
    for loc in locales:
        ld = _diff_dicts(prev_lc.get(loc), curr_lc.get(loc))
        if ld["added"] or ld["removed"] or ld["changed"]:
            locale_diff[loc] = ld
    settings_diff = _diff_dicts(prev.get("settings"), curr.get("settings"))
    out: Dict[str, Any] = {}
    if locale_diff:
        out["locale_content"] = locale_diff
    if settings_diff["added"] or settings_diff["removed"] or settings_diff["changed"]:
        out["settings"] = settings_diff
    # Visibility / type / order change flags
    if prev.get("visible") != curr.get("visible"):
        out["visibility"] = {"from": prev.get("visible"), "to": curr.get("visible")}
    if prev.get("section_type") != curr.get("section_type"):
        out["section_type"] = {"from": prev.get("section_type"), "to": curr.get("section_type")}
    return out


def diff_payload(snapshot: Dict[str, Any], live_page: Dict[str, Any],
                 live_sections: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compare a frozen snapshot with the live state and return a UI-ready diff."""
    snap_page = snapshot.get("page") or {}
    snap_sections = snapshot.get("sections") or []

    # Page-level diff
    page_diff = _diff_dicts(
        {k: snap_page.get(k) for k in PAGE_FIELDS_TO_FREEZE},
        {k: live_page.get(k) for k in PAGE_FIELDS_TO_FREEZE},
    )

    # Section-level diff
    snap_by_id = {s["id"]: s for s in snap_sections if s.get("id")}
    live_by_id = {s["id"]: s for s in live_sections if s.get("id")}

    added   = [live_by_id[i] for i in live_by_id.keys() if i not in snap_by_id]
    removed = [snap_by_id[i] for i in snap_by_id.keys() if i not in live_by_id]

    # Modified — keep stable order (live sort_order)
    modified: List[Dict[str, Any]] = []
    for sid, live_s in live_by_id.items():
        if sid not in snap_by_id:
            continue
        d = _diff_section_content(snap_by_id[sid], live_s)
        if d or snap_by_id[sid].get("sort_order") != live_s.get("sort_order"):
            modified.append({
                "id": sid,
                "section_type": live_s.get("section_type"),
                "sort_order_from": snap_by_id[sid].get("sort_order"),
                "sort_order_to":   live_s.get("sort_order"),
                "changes": d,
            })

    # Reorder summary — list of (section_id, from, to) for sections present in both
    reorders: List[Dict[str, Any]] = []
    for sid, live_s in live_by_id.items():
        if sid in snap_by_id and snap_by_id[sid].get("sort_order") != live_s.get("sort_order"):
            reorders.append({
                "id": sid, "section_type": live_s.get("section_type"),
                "from": snap_by_id[sid].get("sort_order"),
                "to":   live_s.get("sort_order"),
            })

    # Telemetry summary — flat counts for badges
    field_changes = sum(
        len((mod["changes"].get("locale_content") or {}).get(loc, {}).get("changed", {})) +
        len((mod["changes"].get("locale_content") or {}).get(loc, {}).get("added", {})) +
        len((mod["changes"].get("locale_content") or {}).get(loc, {}).get("removed", {}))
        for mod in modified for loc in (mod["changes"].get("locale_content") or {}).keys()
    )

    return {
        "page": page_diff,
        "sections": {
            "added":    [{"id": s["id"], "section_type": s.get("section_type"), "sort_order": s.get("sort_order")} for s in added],
            "removed":  [{"id": s["id"], "section_type": s.get("section_type"), "sort_order": s.get("sort_order")} for s in removed],
            "modified": modified,
            "reordered": reorders,
        },
        "summary": {
            "sections_added":    len(added),
            "sections_removed":  len(removed),
            "sections_modified": len(modified),
            "sections_reordered": len(reorders),
            "field_changes":     field_changes,
            "has_changes": bool(
                added or removed or modified or reorders or
                page_diff["added"] or page_diff["removed"] or page_diff["changed"]
            ),
        },
    }


# ── Public operations ────────────────────────────────────────────────
def publish_page(tenant_id: str, page_key: str, profile_id: Optional[str],
                 label: Optional[str] = None) -> Dict[str, Any]:
    """Freeze current state, store as revision, point page at it."""
    client = db()
    p = client.table("cms_pages").select("*") \
        .eq("tenant_id", tenant_id).eq("page_key", page_key).limit(1).execute()
    if not p.data:
        raise HTTPException(404, "Page not found")
    page = p.data[0]

    # Precompute the diff vs the previous published snapshot so the timeline
    # can show "X sections, Y fields changed" without re-running the diff.
    prev_rev = None
    if page.get("published_revision_id"):
        rr = client.table("cms_page_revisions").select("snapshot") \
            .eq("id", page["published_revision_id"]).limit(1).execute()
        if rr.data:
            prev_rev = rr.data[0]["snapshot"]

    snap = snapshot_page(tenant_id, page["id"])
    summary = {}
    if prev_rev:
        live_sections = _fetch_sections(tenant_id, page["id"])
        summary = diff_payload(prev_rev, page, live_sections)["summary"]

    rev = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "page_id": page["id"],
        "page_key": page_key,
        "snapshot": snap,
        "label": label,
        "kind": "publish",
        "change_summary": summary,
        "created_by": profile_id,
        "created_at": _NOW(),
    }
    client.table("cms_page_revisions").insert(rev).execute()

    # Point page at the new revision + mark as published
    now = _NOW()
    client.table("cms_pages").update({
        "published_revision_id": rev["id"],
        "status": "published",
        "published_at": now,
        "last_published_at": now,
        "updated_at": now,
        "updated_by": profile_id,
    }).eq("id", page["id"]).execute()

    return {
        "revision_id": rev["id"],
        "page_id": page["id"],
        "published_at": now,
        "change_summary": summary,
    }


def list_revisions(tenant_id: str, page_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    client = db()
    r = client.table("cms_page_revisions") \
        .select("id, page_key, label, kind, change_summary, created_by, created_at") \
        .eq("tenant_id", tenant_id).eq("page_id", page_id) \
        .order("created_at", desc=True).limit(limit).execute()
    return r.data or []


def get_revision(tenant_id: str, revision_id: str) -> Dict[str, Any]:
    client = db()
    r = client.table("cms_page_revisions").select("*") \
        .eq("id", revision_id).eq("tenant_id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Revision not found")
    return r.data[0]


def diff_against_published(tenant_id: str, page_id: str) -> Dict[str, Any]:
    """Live draft vs the currently published revision."""
    page = _fetch_page(tenant_id, page_id)
    rev_id = page.get("published_revision_id")
    if not rev_id:
        # Never published — every live section is "added"
        sections = _fetch_sections(tenant_id, page_id)
        empty_snap = {"page": {}, "sections": [], "asset_index": {}}
        return {
            "has_published": False,
            "published_revision_id": None,
            "published_at": None,
            "draft_updated_at": page.get("draft_updated_at"),
            **diff_payload(empty_snap, page, sections),
        }
    rev = get_revision(tenant_id, rev_id)
    sections = _fetch_sections(tenant_id, page_id)
    return {
        "has_published": True,
        "published_revision_id": rev_id,
        "published_at": page.get("last_published_at"),
        "draft_updated_at": page.get("draft_updated_at"),
        **diff_payload(rev["snapshot"], page, sections),
    }


def diff_between_revisions(tenant_id: str, page_id: str,
                           rev_id_a: str, rev_id_b: str) -> Dict[str, Any]:
    """Compare two historical revisions (A is the BASE, B is the NEW)."""
    a = get_revision(tenant_id, rev_id_a)
    b = get_revision(tenant_id, rev_id_b)
    snap_a = a["snapshot"]; snap_b = b["snapshot"]
    # Reuse diff_payload — synthesize a "live_page" / "live_sections" from b.
    fake_page = {k: snap_b.get("page", {}).get(k) for k in PAGE_FIELDS_TO_FREEZE}
    fake_sections = snap_b.get("sections") or []
    return {
        "from": {"id": rev_id_a, "created_at": a.get("created_at"), "label": a.get("label")},
        "to":   {"id": rev_id_b, "created_at": b.get("created_at"), "label": b.get("label")},
        **diff_payload(snap_a, fake_page, fake_sections),
    }


def revert_to_revision(tenant_id: str, page_id: str, revision_id: str,
                       profile_id: Optional[str]) -> Dict[str, Any]:
    """Restore the snapshot back onto the live tables.

    Strategy: wipe current sections, re-insert from snapshot (preserving the
    original section IDs so future diffs vs old revisions still align), then
    patch page fields. The next publish will create a fresh revision.
    """
    rev = get_revision(tenant_id, revision_id)
    if rev["page_id"] != page_id:
        raise HTTPException(400, "Revision does not belong to this page")
    snap = rev["snapshot"] or {}
    snap_page = snap.get("page") or {}
    snap_sections = snap.get("sections") or []

    client = db()
    # 1) Replace sections
    client.table("cms_sections").delete() \
        .eq("page_id", page_id).eq("tenant_id", tenant_id).execute()
    if snap_sections:
        rows = []
        for s in snap_sections:
            rows.append({
                "id": s.get("id") or str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "page_id": page_id,
                "section_type": s.get("section_type"),
                "sort_order": s.get("sort_order") or 0,
                "visible": s.get("visible", True),
                "locale_content": s.get("locale_content") or {},
                "settings": s.get("settings") or {},
                "asset_refs": s.get("asset_refs") or [],
                "created_at": _NOW(),
                "updated_at": _NOW(),
            })
        client.table("cms_sections").insert(rows).execute()

    # 2) Patch page meta (NOT the published_revision_id — reverting doesn't republish)
    patch = {k: snap_page.get(k) for k in PAGE_FIELDS_TO_FREEZE if k in snap_page}
    patch.update({"updated_at": _NOW(), "updated_by": profile_id, "status": "draft"})
    client.table("cms_pages").update(patch).eq("id", page_id).execute()

    return {"reverted_from": revision_id, "page_id": page_id}
