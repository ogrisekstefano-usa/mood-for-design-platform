"""Blueprint Templates™ V1 — moodboard starter templates.

Endpoints:
  GET    /api/templates                       — list (platform + own tenant)
  GET    /api/templates/{id}                  — detail with blocks
  POST   /api/templates                       — create (tenant-private)
  PUT    /api/templates/{id}                  — update own
  DELETE /api/templates/{id}                  — soft archive own
  POST   /api/templates/{id}/apply            — clone template → new moodboard
  POST   /api/templates/from-moodboard/{mid}  — save current moodboard as template

Visibility rules:
  - `platform`: tenant_id IS NULL, visible to ALL tenants (created by super_admin only)
  - `tenant`:   tenant_id = ctx.tenant_id, visible only inside that tenant
  - `private`:  same as tenant for now (per-user privacy reserved for V2)

Permission gating:
  - List/Detail/Apply → P_MOODBOARDS_READ  (designers can pick & apply)
  - Create/Update/Delete on own → P_MOODBOARDS_WRITE
  - Editing PLATFORM templates → super_admin only (via additional check)
"""
import re
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context, require_permission, audit_log
from core.permissions import P_MOODBOARDS_READ, P_MOODBOARDS_WRITE
from core.template_preview import build_preview
from database import db

router = APIRouter()
logger = logging.getLogger(__name__)

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _require_uuid(s: str) -> str:
    if not _UUID_RE.match(s or ""):
        raise HTTPException(404, "Not found")
    return s


def _parse_jsonish(v):
    if v is None:
        return {}
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return {}
    return {}


def _normalize_template_block(b: dict) -> dict:
    out = dict(b)
    pos = _parse_jsonish(out.get("position_json"))
    style = _parse_jsonish(out.get("style_json"))
    content = _parse_jsonish(out.get("content"))
    out["x"] = pos.get("x", 40)
    out["y"] = pos.get("y", 40)
    out["width"] = pos.get("width", 320)
    out["height"] = pos.get("height", 240)
    out["z_index"] = pos.get("z_index", 0)
    out["style"] = style
    out["content"] = content
    out.pop("position_json", None)
    out.pop("style_json", None)
    out.pop("metadata_json", None)
    return out


def _resolve_locale_label(tpl: dict, locale: Optional[str], key: str) -> str:
    """Pick name/description from locale_content with fallback to default columns."""
    locale_content = tpl.get("locale_content") or {}
    if isinstance(locale_content, str):
        locale_content = _parse_jsonish(locale_content)
    if locale and isinstance(locale_content, dict):
        if locale in locale_content and key in locale_content[locale]:
            return locale_content[locale][key]
        # Fallback chain: en-US → first available
        if "en-US" in locale_content and key in locale_content["en-US"]:
            return locale_content["en-US"][key]
    return tpl.get(key) or ""


def _expose(tpl: dict, locale: Optional[str] = None) -> dict:
    """Strip server-side fields + apply locale resolution."""
    out = {k: v for k, v in tpl.items() if k not in ("locale_content",)}
    out["name"] = _resolve_locale_label(tpl, locale, "name") or tpl.get("name")
    out["description"] = _resolve_locale_label(tpl, locale, "description") or tpl.get("description")
    return out


# ── Schemas ──────────────────────────────────────────────────────────────────
class TemplateBlockIn(BaseModel):
    type: str
    x: Optional[float] = 40
    y: Optional[float] = 40
    width: Optional[float] = 320
    height: Optional[float] = 240
    z_index: Optional[int] = 0
    sort_order: Optional[int] = 0
    content: Optional[Dict[str, Any]] = None
    style:   Optional[Dict[str, Any]] = None


class TemplateCreate(BaseModel):
    slug: str = Field(min_length=3, max_length=64)
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    preview_image: Optional[str] = None
    visibility: Optional[str] = "tenant"   # tenant | private
    is_starter: Optional[bool] = False
    locale_content: Optional[Dict[str, Any]] = None
    blocks: Optional[List[TemplateBlockIn]] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    preview_image: Optional[str] = None
    visibility: Optional[str] = None
    is_starter: Optional[bool] = None
    locale_content: Optional[Dict[str, Any]] = None
    sort_order: Optional[int] = None


class ApplyTemplate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    project_id: Optional[str] = None


class SaveAsTemplate(BaseModel):
    slug: str = Field(min_length=3, max_length=64)
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[str] = "tenant"


# ── Helpers ──────────────────────────────────────────────────────────────────
def _fetch_template(client, template_id: str, tenant_id: str) -> dict:
    """Get template — accessible if platform-global OR owned by current tenant."""
    r = client.table("moodboard_templates").select("*") \
        .eq("id", template_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Template not found")
    tpl = r.data[0]
    owner = tpl.get("tenant_id")
    if owner is not None and owner != tenant_id:
        raise HTTPException(404, "Template not found")
    return tpl


def _list_template_pages(client, template_id: str) -> list:
    """Return template_pages with their blocks attached, for the gallery
    carousel preview. Empty list for legacy single-page templates."""
    pages = client.table("template_pages").select("*") \
        .eq("template_id", template_id).order("sort_order").execute().data or []
    if not pages:
        return []
    blocks_q = client.table("template_blocks").select("*") \
        .eq("template_id", template_id).order("sort_order").execute()
    by_page: dict = {}
    for b in (blocks_q.data or []):
        pid = b.get("template_page_id")
        if pid:
            by_page.setdefault(pid, []).append(b)
    return [{**p, "blocks": by_page.get(p["id"], [])} for p in pages]


def _list_template_blocks(client, template_id: str) -> list:
    r = client.table("template_blocks").select("*") \
        .eq("template_id", template_id).order("sort_order").execute()
    return [_normalize_template_block(b) for b in (r.data or [])]


def _raw_template_blocks(client, template_id: str) -> list:
    """Raw rows (no normalization) — used by preview builder which reads
    position_json / content directly."""
    r = client.table("template_blocks").select("type, content, position_json, sort_order") \
        .eq("template_id", template_id).order("sort_order").execute()
    return r.data or []


def _attach_preview(client, tpl: dict) -> dict:
    """Adds preview_svg + palette to a template dict. For multi-page
    templates also fills `pages_preview` (carousel of mini-SVGs)."""
    raw = _raw_template_blocks(client, tpl["id"])
    pv = build_preview(raw)
    tpl["preview_svg"] = pv["preview_svg"]
    tpl["palette"] = pv["palette"]
    tpl["block_count"] = len(raw)

    # F.1: per-page preview carousel (only emitted when the template is multi-page)
    pages = client.table("template_pages").select("id, title, sort_order") \
        .eq("template_id", tpl["id"]).order("sort_order").execute().data or []
    if len(pages) > 1:
        carousel = []
        for p in pages:
            pblocks = client.table("template_blocks") \
                .select("type, content, position_json, sort_order") \
                .eq("template_page_id", p["id"]).order("sort_order").execute().data or []
            pv2 = build_preview(pblocks)
            carousel.append({
                "id": p["id"], "title": p["title"], "sort_order": p["sort_order"],
                "preview_svg": pv2["preview_svg"],
            })
        tpl["pages_preview"] = carousel
        tpl["page_count"] = len(pages)
    else:
        tpl["page_count"] = max(1, len(pages))
    return tpl


def _attach_lineage(client, tpl: dict) -> dict:
    """Looks up the parent template's name when parent_id is set."""
    pid = tpl.get("parent_id")
    if not pid:
        return tpl
    try:
        r = client.table("moodboard_templates").select("id, name, slug") \
            .eq("id", pid).limit(1).execute()
        if r.data:
            tpl["parent"] = {"id": r.data[0]["id"], "name": r.data[0]["name"],
                             "slug": r.data[0]["slug"]}
    except Exception:
        pass
    return tpl


# ── LIST ────────────────────────────────────────────────────────────────────
@router.get("")
def list_templates(
    category: Optional[str] = Query(None),
    starter_only: bool = Query(False),
    locale: Optional[str] = Query(None),
    with_preview: bool = Query(True),
    ctx: dict = Depends(require_permission(P_MOODBOARDS_READ)),
):
    client = db()
    q = client.table("moodboard_templates").select("*") \
        .is_("archived_at", "null").order("sort_order")
    rows = q.execute().data or []
    # Filter: platform OR own tenant
    rows = [t for t in rows if t.get("tenant_id") is None or t.get("tenant_id") == ctx["tenant_id"]]
    if category:
        rows = [t for t in rows if t.get("category") == category]
    if starter_only:
        rows = [t for t in rows if t.get("is_starter")]

    out = []
    for t in rows:
        exposed = _expose(t, locale)
        if with_preview:
            _attach_preview(client, exposed)
        out.append(exposed)
    return {"data": out, "total": len(out)}


# ── DETAIL ──────────────────────────────────────────────────────────────────
@router.get("/{template_id}")
def get_template(template_id: str, locale: Optional[str] = Query(None),
                 ctx: dict = Depends(require_permission(P_MOODBOARDS_READ))):
    _require_uuid(template_id)
    client = db()
    tpl = _fetch_template(client, template_id, ctx["tenant_id"])
    tpl_out = _expose(tpl, locale)
    tpl_out["blocks"] = _list_template_blocks(client, template_id)
    _attach_preview(client, tpl_out)
    _attach_lineage(client, tpl_out)
    return tpl_out


# ── CREATE (tenant-scoped) ──────────────────────────────────────────────────
@router.post("", status_code=201)
def create_template(body: TemplateCreate,
                    ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    client = db()
    tid = str(uuid.uuid4())
    now = _now()
    visibility = body.visibility if body.visibility in ("tenant", "private") else "tenant"
    row = {
        "id": tid,
        "tenant_id": ctx["tenant_id"],
        "slug": body.slug,
        "name": body.name,
        "description": body.description,
        "category": body.category,
        "tags": body.tags or [],
        "preview_image": body.preview_image,
        "visibility": visibility,
        "is_starter": bool(body.is_starter),
        "locale_content": body.locale_content or {},
        "created_by": ctx["profile_id"],
        "created_at": now,
        "updated_at": now,
    }
    try:
        client.table("moodboard_templates").insert(row).execute()
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(409, "A template with that slug already exists in this tenant")
        raise
    # Blocks
    if body.blocks:
        for i, b in enumerate(body.blocks):
            client.table("template_blocks").insert({
                "template_id": tid,
                "type": b.type,
                "position_json": {"x": b.x, "y": b.y, "width": b.width,
                                  "height": b.height, "z_index": b.z_index or 0},
                "style_json": b.style or {},
                "content": json.dumps(b.content or {}),
                "sort_order": b.sort_order or i,
            }).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "template.created",
              resource_type="template", resource_id=tid, metadata={"slug": body.slug})
    return {"id": tid, "slug": body.slug, "name": body.name}


# ── UPDATE ──────────────────────────────────────────────────────────────────
@router.put("/{template_id}")
def update_template(template_id: str, body: TemplateUpdate,
                    ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    _require_uuid(template_id)
    client = db()
    tpl = _fetch_template(client, template_id, ctx["tenant_id"])
    # Platform templates can only be edited by super_admin
    if tpl.get("tenant_id") is None and ctx.get("role") != "super_admin":
        raise HTTPException(403, "Platform templates are read-only for this role")
    payload = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not payload:
        return _expose(tpl)
    payload["updated_at"] = _now()
    r = client.table("moodboard_templates").update(payload).eq("id", template_id).execute()
    return _expose(r.data[0] if r.data else {**tpl, **payload})


# ── DELETE (soft archive) ───────────────────────────────────────────────────
@router.delete("/{template_id}")
def delete_template(template_id: str,
                    ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    _require_uuid(template_id)
    client = db()
    tpl = _fetch_template(client, template_id, ctx["tenant_id"])
    if tpl.get("tenant_id") is None and ctx.get("role") != "super_admin":
        raise HTTPException(403, "Platform templates cannot be deleted by this role")
    client.table("moodboard_templates") \
        .update({"archived_at": _now()}).eq("id", template_id).execute()
    return {"message": "archived"}


# ── APPLY (clone → new moodboard) ───────────────────────────────────────────
@router.post("/{template_id}/apply", status_code=201)
def apply_template(template_id: str, body: ApplyTemplate,
                   ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    _require_uuid(template_id)
    client = db()
    tpl = _fetch_template(client, template_id, ctx["tenant_id"])
    # Optionally validate project ownership
    if body.project_id:
        _require_uuid(body.project_id)
        proj = client.table("projects").select("id") \
            .eq("id", body.project_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
        if not proj.data:
            raise HTTPException(404, "Project not found")

    moodboard_id = str(uuid.uuid4())
    now = _now()
    # Lineage: persist origin so save-as-template can later set parent_id.
    # `template_id` column on moodboards is already part of the baseline schema.
    mb = {
        "id": moodboard_id,
        "tenant_id": ctx["tenant_id"],
        "project_id": body.project_id,
        "title": body.title,
        "status": "draft",
        "current_version": 1,
        "template_id": template_id,
        "created_by": ctx["profile_id"],
        "created_at": now,
        "updated_at": now,
    }
    mb = {k: v for k, v in mb.items() if v is not None}
    client.table("moodboards").insert(mb).execute()

    # F.1: clone template_pages → moodboard_pages, then each template_block →
    # moodboard_element scoped to its corresponding new page. Fallback for
    # legacy single-page templates (no template_pages rows): synthesize one
    # default page so the loop semantics stay uniform.
    tpl_pages = client.table("template_pages").select("*") \
        .eq("template_id", template_id).order("sort_order").execute().data or []

    page_id_map = {}  # template_page_id → new moodboard_page_id
    if tpl_pages:
        for tp in tpl_pages:
            new_pid = str(uuid.uuid4())
            page_id_map[tp["id"]] = new_pid
            client.table("moodboard_pages").insert({
                "id": new_pid,
                "tenant_id": ctx["tenant_id"],
                "moodboard_id": moodboard_id,
                "title": tp.get("title") or "Page",
                "page_type": tp.get("page_type") or "blank",
                "aspect_ratio": tp.get("aspect_ratio") or "portrait_a4",
                "width": tp.get("width") or 1400,
                "height": tp.get("height") or 2400,
                "background": tp.get("background") or {},
                "settings": tp.get("settings") or {},
                "sort_order": tp.get("sort_order") or 0,
                "created_by": ctx["profile_id"],
            }).execute()
        landing_page_id = page_id_map[tpl_pages[0]["id"]]
    else:
        landing_page_id = str(uuid.uuid4())
        client.table("moodboard_pages").insert({
            "id": landing_page_id,
            "tenant_id": ctx["tenant_id"],
            "moodboard_id": moodboard_id,
            "title": body.title,
            "page_type": "blank",
            "aspect_ratio": "portrait_a4",
            "width": 1400, "height": 2400, "sort_order": 0,
            "created_by": ctx["profile_id"],
        }).execute()

    client.table("moodboards").update({"current_page_id": landing_page_id}) \
        .eq("id", moodboard_id).execute()

    # Clone template_blocks → moodboard_elements (attached to the cloned pages)
    tpl_blocks = client.table("template_blocks").select("*") \
        .eq("template_id", template_id).order("sort_order").execute().data or []
    for tb in tpl_blocks:
        content = _parse_jsonish(tb.get("content"))
        pos = _parse_jsonish(tb.get("position_json"))
        style = _parse_jsonish(tb.get("style_json"))
        # Carry placeholder semantics into metadata so the editor knows to
        # render the "Replace with ..." affordance.
        meta = {}
        if tb.get("is_placeholder"):
            meta["placeholder"] = {
                "label": tb.get("placeholder_label"),
                "type": tb.get("placeholder_type"),
                "required": tb.get("placeholder_required", False),
            }
        target_page_id = page_id_map.get(tb.get("template_page_id"), landing_page_id)
        row = {
            "id": str(uuid.uuid4()),
            "tenant_id": ctx["tenant_id"],
            "moodboard_id": moodboard_id,
            "page_id": target_page_id,
            "type": tb["type"],
            "title": tb.get("title") or (content.get("caption") if tb["type"] == "image" else None),
            "content": json.dumps(content),
            "position_json": pos,
            "style_json": style,
            "metadata_json": meta if meta else None,
            "sort_order": tb.get("sort_order") or 0,
        }
        # Mirror src→image_url for image blocks (parity with regular create_block)
        if tb["type"] == "image":
            img = tb.get("image_url") or content.get("src")
            if img:
                row["image_url"] = img
        row = {k: v for k, v in row.items() if v is not None}
        client.table("moodboard_elements").insert(row).execute()

    audit_log(ctx["tenant_id"], ctx["profile_id"], "template.applied",
              resource_type="moodboard", resource_id=moodboard_id,
              metadata={"template_id": template_id, "slug": tpl.get("slug")})
    return {"id": moodboard_id, "title": body.title, "status": "draft",
            "blocks_count": len(tpl_blocks), "template_slug": tpl.get("slug")}


# ── SAVE-AS-TEMPLATE (from existing moodboard) ──────────────────────────────
@router.post("/from-moodboard/{moodboard_id}", status_code=201)
def save_as_template(moodboard_id: str, body: SaveAsTemplate,
                     ctx: dict = Depends(require_permission(P_MOODBOARDS_WRITE))):
    _require_uuid(moodboard_id)
    client = db()
    mb_q = client.table("moodboards").select("*") \
        .eq("id", moodboard_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not mb_q.data:
        raise HTTPException(404, "Moodboard not found")
    src_mb = mb_q.data[0]
    visibility = body.visibility if body.visibility in ("tenant", "private") else "tenant"

    tid = str(uuid.uuid4())
    now = _now()
    try:
        client.table("moodboard_templates").insert({
            "id": tid,
            "tenant_id": ctx["tenant_id"],
            "parent_id": src_mb.get("template_id"),  # lineage: fork tracking
            "slug": body.slug,
            "name": body.name,
            "description": body.description,
            "category": body.category,
            "tags": body.tags or [],
            "visibility": visibility,
            "is_starter": False,
            "settings": {},  # canvas hints reserved for V2 authoring tools
            "created_by": ctx["profile_id"],
            "created_at": now,
            "updated_at": now,
        }).execute()
    except Exception as e:
        if "duplicate" in str(e).lower():
            raise HTTPException(409, "A template with that slug already exists in this tenant")
        raise

    # F.1: snapshot multi-page — clone moodboard_pages → template_pages first,
    # then clone moodboard_elements → template_blocks scoped to the cloned pages.
    src_pages = client.table("moodboard_pages").select("*") \
        .eq("moodboard_id", moodboard_id).order("sort_order").execute().data or []
    page_id_map: dict = {}
    for sp in src_pages:
        new_tpid = str(uuid.uuid4())
        page_id_map[sp["id"]] = new_tpid
        client.table("template_pages").insert({
            "id": new_tpid,
            "template_id": tid,
            "title": sp.get("title"),
            "page_type": sp.get("page_type") or "blank",
            "aspect_ratio": sp.get("aspect_ratio") or "portrait_a4",
            "width": sp.get("width") or 1400,
            "height": sp.get("height") or 2400,
            "background": sp.get("background") or {},
            "settings": sp.get("settings") or {},
            "sort_order": sp.get("sort_order") or 0,
        }).execute()

    els = client.table("moodboard_elements").select("*") \
        .eq("moodboard_id", moodboard_id).order("sort_order").execute().data or []
    for el in els:
        content = _parse_jsonish(el.get("content"))
        meta = _parse_jsonish(el.get("metadata_json"))
        ph = meta.get("placeholder") if isinstance(meta, dict) else None
        client.table("template_blocks").insert({
            "template_id": tid,
            "template_page_id": page_id_map.get(el.get("page_id")),
            "type": el["type"],
            "title": el.get("title"),
            "image_url": el.get("image_url"),
            "content": json.dumps(content),
            "position_json": _parse_jsonish(el.get("position_json")),
            "style_json": _parse_jsonish(el.get("style_json")),
            "sort_order": el.get("sort_order") or 0,
            "is_placeholder": bool(ph),
            "placeholder_label": ph.get("label") if ph else None,
            "placeholder_type": ph.get("type") if ph else None,
            "placeholder_required": ph.get("required") if ph else False,
        }).execute()

    audit_log(ctx["tenant_id"], ctx["profile_id"], "template.saved_from_moodboard",
              resource_type="template", resource_id=tid,
              metadata={"source_moodboard_id": moodboard_id,
                        "page_count": len(src_pages), "block_count": len(els)})
    return {"id": tid, "slug": body.slug,
            "page_count": len(src_pages), "blocks_count": len(els)}
