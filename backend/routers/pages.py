"""Blueprint Pages router — Section Engine CRUD.

Pages are stored per tenant in `tenant_settings` with key pattern:
    page.{slug}

This avoids a dedicated schema migration while preserving full flexibility.
Future migration to a dedicated `tenant_pages` table is transparent to the
frontend (same API contract).

Reusable across: homepage, landing pages, proposals, magazine, moodboards,
showcase pages, client portals, onboarding flows.
"""
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from pydantic import BaseModel, Field

from core.tenant_context import (
    get_tenant_context, get_tenant_settings, upsert_tenant_setting,
    audit_log, require_permission,
)
from core.permissions import P_TENANT_BRANDING, P_TENANT_SETTINGS
from core.section_registry import (
    SECTION_TYPES, SECTION_TYPES_BY_KEY,
    section_defaults, section_known, default_page,
)
from database import db

router = APIRouter()

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _page_key(slug: str) -> str:
    return f"page.{slug}"


def _list_page_settings(tenant_id: str) -> List[Dict[str, Any]]:
    client = db()
    r = client.table("tenant_settings").select("key, value_json, updated_at") \
        .eq("tenant_id", tenant_id).like("key", "page.%").execute()
    return r.data or []


# ── Schemas ──────────────────────────────────────────────────────────────────
class SectionBody(BaseModel):
    id: Optional[str] = None
    type: str
    visible: Optional[bool] = True
    order: Optional[int] = 0
    content: Optional[Dict[str, Any]] = None  # {_default:..., en-US:..., it:...}
    settings: Optional[Dict[str, Any]] = None


class PageUpsert(BaseModel):
    title: Optional[str] = None
    published: Optional[bool] = None
    locale_default: Optional[str] = None
    sections: Optional[List[SectionBody]] = None


class SectionCreate(BaseModel):
    type: str
    at_index: Optional[int] = None  # insertion index; appended if None


class SectionReorder(BaseModel):
    order: List[str]  # array of section ids in desired order


# ── Section catalog (public to authenticated users) ──────────────────────────
@router.get("/sections/catalog")
def sections_catalog(ctx: dict = Depends(get_tenant_context)):
    """Returns the registered section types. Frontend renders the page builder
    catalog and the section property editors from this contract."""
    return {"sections": SECTION_TYPES}


# ── Page list ────────────────────────────────────────────────────────────────
@router.get("/pages")
def list_pages(ctx: dict = Depends(get_tenant_context)):
    rows = _list_page_settings(ctx["tenant_id"])
    pages = []
    for r in rows:
        v = r.get("value_json") or {}
        pages.append({
            "slug":     v.get("slug") or r["key"].replace("page.", ""),
            "title":    v.get("title"),
            "published": v.get("published", False),
            "sections_count": len(v.get("sections") or []),
            "updated_at": r.get("updated_at"),
        })
    return {"data": pages}


# ── Page read ────────────────────────────────────────────────────────────────
@router.get("/pages/{slug}")
def get_page(slug: str, ctx: dict = Depends(get_tenant_context)):
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Invalid slug")
    page = get_tenant_settings(ctx["tenant_id"], _page_key(slug), None)
    if not page:
        # Seed default template (in-memory; persisted only on first PUT)
        page = default_page(slug)
        page["_seed"] = True
    # Sort sections defensively
    page["sections"] = sorted(page.get("sections") or [], key=lambda s: s.get("order", 0))
    return page


# ── Page upsert (full document) ─────────────────────────────────────────────
@router.put("/pages/{slug}")
def upsert_page(slug: str, body: PageUpsert,
                ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Invalid slug")

    existing = get_tenant_settings(ctx["tenant_id"], _page_key(slug), None) or default_page(slug)
    existing.pop("_seed", None)

    payload = body.model_dump(exclude_none=True)

    # Validate section types if provided
    if "sections" in payload:
        sections = []
        for idx, s in enumerate(payload["sections"]):
            if not section_known(s["type"]):
                raise HTTPException(400, f"Unknown section type: {s['type']}")
            sid = s.get("id") or str(uuid.uuid4())
            content = s.get("content")
            if content is None:
                content = {"_default": section_defaults(s["type"])}
            sections.append({
                "id":      sid,
                "type":    s["type"],
                "visible": bool(s.get("visible", True)),
                "order":   int(s.get("order", idx)),
                "content": content,
                "settings": s.get("settings") or {},
            })
        payload["sections"] = sorted(sections, key=lambda s: s["order"])

    merged = {**existing, **payload, "slug": slug, "updated_at": _now()}
    upsert_tenant_setting(ctx["tenant_id"], _page_key(slug), merged)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "page.update",
              resource_type="page", resource_id=slug,
              metadata={"keys": list(payload.keys())})
    return merged


# ── Section add ──────────────────────────────────────────────────────────────
@router.post("/pages/{slug}/sections")
def add_section(slug: str, body: SectionCreate,
                ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Invalid slug")
    if not section_known(body.type):
        raise HTTPException(400, f"Unknown section type: {body.type}")

    page = get_tenant_settings(ctx["tenant_id"], _page_key(slug), None) or default_page(slug)
    page.pop("_seed", None)
    sections = sorted(page.get("sections") or [], key=lambda s: s.get("order", 0))
    new_section = {
        "id":       str(uuid.uuid4()),
        "type":     body.type,
        "visible":  True,
        "order":    0,
        "content":  {"_default": section_defaults(body.type)},
        "settings": {},
    }
    insert_at = body.at_index if body.at_index is not None else len(sections)
    insert_at = max(0, min(insert_at, len(sections)))
    sections.insert(insert_at, new_section)
    # Re-number orders
    for i, s in enumerate(sections):
        s["order"] = i

    page["sections"] = sections
    page["slug"] = slug
    page["updated_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _page_key(slug), page)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "page.section.add",
              resource_type="page", resource_id=slug,
              metadata={"section_type": body.type})
    return {"page": page, "section": new_section}


# ── Section update ───────────────────────────────────────────────────────────
@router.put("/pages/{slug}/sections/{section_id}")
def update_section(slug: str, section_id: str, body: SectionBody,
                   ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Invalid slug")

    page = get_tenant_settings(ctx["tenant_id"], _page_key(slug), None)
    if not page:
        raise HTTPException(404, "Page not found")
    sections = page.get("sections") or []
    idx = next((i for i, s in enumerate(sections) if s.get("id") == section_id), -1)
    if idx < 0:
        raise HTTPException(404, "Section not found")

    payload = body.model_dump(exclude_none=True, exclude={"id"})
    if "type" in payload and not section_known(payload["type"]):
        raise HTTPException(400, f"Unknown section type: {payload['type']}")

    sections[idx] = {**sections[idx], **payload, "id": section_id}
    page["sections"] = sections
    page["updated_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _page_key(slug), page)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "page.section.update",
              resource_type="page", resource_id=slug,
              metadata={"section_id": section_id, "keys": list(payload.keys())})
    return {"page": page, "section": sections[idx]}


# ── Section delete ───────────────────────────────────────────────────────────
@router.delete("/pages/{slug}/sections/{section_id}")
def delete_section(slug: str, section_id: str,
                   ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    page = get_tenant_settings(ctx["tenant_id"], _page_key(slug), None)
    if not page:
        raise HTTPException(404, "Page not found")
    before = page.get("sections") or []
    after = [s for s in before if s.get("id") != section_id]
    if len(after) == len(before):
        raise HTTPException(404, "Section not found")
    for i, s in enumerate(after):
        s["order"] = i
    page["sections"] = after
    page["updated_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _page_key(slug), page)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "page.section.delete",
              resource_type="page", resource_id=slug,
              metadata={"section_id": section_id})
    return {"page": page}


# ── Section reorder ──────────────────────────────────────────────────────────
@router.patch("/pages/{slug}/sections/order")
def reorder_sections(slug: str, body: SectionReorder,
                     ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    page = get_tenant_settings(ctx["tenant_id"], _page_key(slug), None)
    if not page:
        raise HTTPException(404, "Page not found")
    sections = page.get("sections") or []
    by_id = {s["id"]: s for s in sections}
    new_sections = []
    for i, sid in enumerate(body.order):
        if sid in by_id:
            s = by_id[sid]
            s["order"] = i
            new_sections.append(s)
    # Append any sections missing from the order array (safety)
    for s in sections:
        if s["id"] not in {x["id"] for x in new_sections}:
            s["order"] = len(new_sections)
            new_sections.append(s)
    page["sections"] = new_sections
    page["updated_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _page_key(slug), page)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "page.section.reorder",
              resource_type="page", resource_id=slug)
    return {"page": page}


# ── Section duplicate ────────────────────────────────────────────────────────
@router.post("/pages/{slug}/sections/{section_id}/duplicate")
def duplicate_section(slug: str, section_id: str,
                      ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    page = get_tenant_settings(ctx["tenant_id"], _page_key(slug), None)
    if not page:
        raise HTTPException(404, "Page not found")
    sections = page.get("sections") or []
    idx = next((i for i, s in enumerate(sections) if s.get("id") == section_id), -1)
    if idx < 0:
        raise HTTPException(404, "Section not found")
    clone = {**sections[idx], "id": str(uuid.uuid4())}
    sections.insert(idx + 1, clone)
    for i, s in enumerate(sections):
        s["order"] = i
    page["sections"] = sections
    page["updated_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _page_key(slug), page)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "page.section.duplicate",
              resource_type="page", resource_id=slug,
              metadata={"section_id": section_id})
    return {"page": page, "section": clone}


# ── Reset page to default template ──────────────────────────────────────────
@router.post("/pages/{slug}/reset")
def reset_page(slug: str,
               ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Invalid slug")
    fresh = default_page(slug)
    fresh["updated_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _page_key(slug), fresh)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "page.reset",
              resource_type="page", resource_id=slug)
    return fresh


# ── Palette preset catalog (used by Brand Studio) ───────────────────────────
@router.get("/palette-presets")
def palette_presets(ctx: dict = Depends(get_tenant_context)):
    from core.theme_engine import PRESET_PALETTES
    return {"presets": PRESET_PALETTES}
