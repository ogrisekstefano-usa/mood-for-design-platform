"""Blueprint Moodboards™ V1 — block-based editor backbone.

Extends the existing /api/moodboards router with:
  - Block (element) CRUD on `moodboard_elements`
  - Block batch update (autosave bulk patch)
  - Approval state transitions
  - Public share token (read-only client review)

Block schema (moodboard_elements row):
  id, moodboard_id, type, x, y, width, height, z_index, sort_order,
  content (JSONB), created_at, updated_at

Block types supported in V1:
  image · text · palette · note · product · material
Future (stubs only, no UI yet):
  hotspot · video · audio · vendor · product_grid
"""
import uuid
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel

from core.tenant_context import get_tenant_context, audit_log
from database import db, db_available
from routers.workspace import push_activity

router = APIRouter()
logger = logging.getLogger(__name__)


SUPPORTED_BLOCK_TYPES = {
    "image", "text", "palette", "note", "product", "material",
    # Future-ready stubs (accepted server-side, no UI yet)
    "hotspot", "video", "vendor", "product_grid",
}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _scrub(d: dict) -> dict:
    return {k: v for k, v in d.items() if v is not None}


def _parse_content(content):
    """Content column may come back as a JSON string from Postgres — normalize to dict."""
    import json as _json
    if isinstance(content, str):
        try:
            return _json.loads(content)
        except Exception:
            return {}
    return content or {}


def _normalize_block(b: dict) -> dict:
    """Flatten content.layout up to top-level x/y/width/height/z_index for the frontend."""
    if not b:
        return b
    out = dict(b)
    content = out.get('content') or {}
    if isinstance(content, str):
        try:
            import json
            content = json.loads(content)
        except Exception:
            content = {}
        out['content'] = content
    layout = (content or {}).get('layout') or {}
    out["x"]       = layout.get('x', out.get('x', 40))
    out["y"]       = layout.get('y', out.get('y', 40))
    out["width"]   = layout.get('width', out.get('width', 320))
    out["height"]  = layout.get('height', out.get('height', 240))
    out["z_index"] = layout.get('z_index', out.get('z_index', 0))
    return out


def _assert_moodboard(client, moodboard_id: str, tenant_id: str) -> dict:
    r = client.table('moodboards').select('id, project_id, status, current_version, title') \
        .eq('id', moodboard_id).eq('tenant_id', tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Moodboard not found")
    return r.data[0]


def _get_share_token(client, tenant_id: str, moodboard_id: str) -> Optional[str]:
    from core.tenant_context import get_tenant_settings
    meta = get_tenant_settings(tenant_id, f"moodboard.{moodboard_id}.share", None)
    return (meta or {}).get("token") if meta else None


# ── Block schemas ────────────────────────────────────────────────────────────
class BlockCreate(BaseModel):
    type: str
    x: Optional[float] = 40
    y: Optional[float] = 40
    width: Optional[float] = 320
    height: Optional[float] = 240
    z_index: Optional[int] = 0
    sort_order: Optional[int] = 0
    content: Optional[Dict[str, Any]] = None


class BlockUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    z_index: Optional[int] = None
    sort_order: Optional[int] = None
    content: Optional[Dict[str, Any]] = None


class BlocksBatchUpdate(BaseModel):
    blocks: List[Dict[str, Any]]  # each item must include 'id'


class ApprovalChange(BaseModel):
    status: str  # draft | in_review | approved | rejected
    note:   Optional[str] = None


# ── Block CRUD ───────────────────────────────────────────────────────────────
@router.post("/{moodboard_id}/blocks", status_code=201)
def create_block(moodboard_id: str, body: BlockCreate, ctx: dict = Depends(get_tenant_context)):
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    if body.type not in SUPPORTED_BLOCK_TYPES:
        raise HTTPException(400, f"Unsupported block type: {body.type}")
    now = _now()
    # Layout (x/y/width/height/z_index) is stored inside content.layout to avoid
    # schema migration. Frontend reads it back the same way.
    content = body.content or {}
    content["layout"] = {
        "x":       body.x or 40,
        "y":       body.y or 40,
        "width":   body.width or 320,
        "height":  body.height or 240,
        "z_index": body.z_index or 0,
    }
    block = {
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "moodboard_id": moodboard_id,
        "type": body.type,
        "sort_order": body.sort_order or 0,
        "content": content,
    }
    r = client.table('moodboard_elements').insert(block).execute()
    client.table('moodboards').update({'updated_at': now}).eq('id', moodboard_id).execute()
    if mb.get("project_id"):
        push_activity(ctx["tenant_id"], mb["project_id"],
                      {"actor_id": ctx["profile_id"], "type": "moodboard.block_added",
                       "ref_id": moodboard_id, "label": mb.get("title"),
                       "block_type": body.type})
    out = r.data[0] if r.data else block
    return _normalize_block(out)


@router.put("/{moodboard_id}/blocks/{block_id}")
def update_block(moodboard_id: str, block_id: str, body: BlockUpdate,
                 ctx: dict = Depends(get_tenant_context)):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    # Fetch current content to merge layout updates
    cur = client.table('moodboard_elements').select('content').eq('id', block_id) \
        .eq('moodboard_id', moodboard_id).limit(1).execute()
    if not cur.data:
        raise HTTPException(404, "Block not found")
    content = _parse_content(cur.data[0].get('content'))
    layout = content.get('layout') or {}
    body_d = body.model_dump(exclude_none=True)
    # Pull layout pieces
    for k in ("x", "y", "width", "height", "z_index"):
        if k in body_d:
            layout[k] = body_d.pop(k)
    if layout:
        content["layout"] = layout
    if "content" in body_d:
        content = {**content, **(body_d.pop("content") or {})}
        # Always preserve layout we merged above
        content["layout"] = layout if layout else content.get("layout")
    payload = {"content": content}
    if "sort_order" in body_d:
        payload["sort_order"] = body_d["sort_order"]
    r = client.table('moodboard_elements').update(payload) \
        .eq('id', block_id).eq('moodboard_id', moodboard_id).execute()
    client.table('moodboards').update({'updated_at': _now()}).eq('id', moodboard_id).execute()
    return _normalize_block(r.data[0] if r.data else payload)


@router.delete("/{moodboard_id}/blocks/{block_id}")
def delete_block(moodboard_id: str, block_id: str, ctx: dict = Depends(get_tenant_context)):
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    client.table('moodboard_elements').delete() \
        .eq('id', block_id).eq('moodboard_id', moodboard_id).execute()
    client.table('moodboards').update({'updated_at': _now()}).eq('id', moodboard_id).execute()
    return {"message": "deleted"}


@router.patch("/{moodboard_id}/blocks/batch")
def batch_update_blocks(moodboard_id: str, body: BlocksBatchUpdate,
                        ctx: dict = Depends(get_tenant_context)):
    """Bulk patch used by autosave (positions/sizes after drag/resize)."""
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    now = _now()
    updated = 0
    for b in body.blocks:
        bid = b.get("id")
        if not bid:
            continue
        # Fetch current content to merge
        cur = client.table('moodboard_elements').select('content').eq('id', bid) \
            .eq('moodboard_id', moodboard_id).limit(1).execute()
        if not cur.data:
            continue
        content = _parse_content(cur.data[0].get('content'))
        layout = content.get('layout') or {}
        for k in ("x", "y", "width", "height", "z_index"):
            if k in b and b[k] is not None:
                layout[k] = b[k]
        content["layout"] = layout
        if "content" in b and isinstance(b["content"], dict):
            new_c = {**content, **b["content"]}
            new_c["layout"] = layout
            content = new_c
        upd = {"content": content}
        if "sort_order" in b and b["sort_order"] is not None:
            upd["sort_order"] = b["sort_order"]
        client.table('moodboard_elements').update(upd) \
            .eq('id', bid).eq('moodboard_id', moodboard_id).execute()
        updated += 1
    client.table('moodboards').update({'updated_at': now}).eq('id', moodboard_id).execute()
    return {"updated": updated}


# ── Approval workflow ───────────────────────────────────────────────────────
APPROVAL_TRANSITIONS = {
    "draft":      {"in_review"},
    "in_review":  {"approved", "rejected", "draft"},
    "approved":   {"draft"},  # allow re-open
    "rejected":   {"in_review", "draft"},
}


@router.post("/{moodboard_id}/approval")
def change_approval(moodboard_id: str, body: ApprovalChange,
                    ctx: dict = Depends(get_tenant_context)):
    client = db()
    mb = _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    current = mb.get("status") or "draft"
    if body.status not in APPROVAL_TRANSITIONS.get(current, set()) and body.status != current:
        raise HTTPException(400, f"Invalid transition {current} → {body.status}")
    now = _now()
    upd = {"status": body.status, "updated_at": now}
    r = client.table('moodboards').update(upd).eq('id', moodboard_id).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], f"moodboard.{body.status}",
              resource_type="moodboard", resource_id=moodboard_id,
              metadata={"from": current, "to": body.status, "note": body.note})
    if body.status == "approved":
        # persist approval metadata as tenant_setting (no schema migration)
        from core.tenant_context import upsert_tenant_setting
        upsert_tenant_setting(ctx["tenant_id"], f"moodboard.{moodboard_id}.approval",
                              {"approved_at": now, "approved_by": ctx["profile_id"], "note": body.note})
    if mb.get("project_id"):
        push_activity(ctx["tenant_id"], mb["project_id"],
                      {"actor_id": ctx["profile_id"], "type": f"moodboard.{body.status}",
                       "ref_id": moodboard_id, "label": mb.get("title"),
                       "from": current, "to": body.status})
    return r.data[0] if r.data else upd


# ── Share token (read-only client review) ───────────────────────────────────
@router.post("/{moodboard_id}/share")
def create_share_token(moodboard_id: str, ctx: dict = Depends(get_tenant_context)):
    from core.tenant_context import upsert_tenant_setting
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    token = secrets.token_urlsafe(24)
    # Store both directions: moodboard → token AND token → moodboard
    upsert_tenant_setting(ctx["tenant_id"], f"moodboard.{moodboard_id}.share",
                          {"token": token, "created_at": _now()})
    upsert_tenant_setting(ctx["tenant_id"], f"moodboard_share.{token}",
                          {"moodboard_id": moodboard_id, "tenant_id": ctx["tenant_id"], "created_at": _now()})
    audit_log(ctx["tenant_id"], ctx["profile_id"], "moodboard.share_created",
              resource_type="moodboard", resource_id=moodboard_id)
    return {"share_token": token}


@router.delete("/{moodboard_id}/share")
def revoke_share_token(moodboard_id: str, ctx: dict = Depends(get_tenant_context)):
    from core.tenant_context import get_tenant_settings, upsert_tenant_setting
    client = db()
    _assert_moodboard(client, moodboard_id, ctx["tenant_id"])
    # Remove the reverse-lookup setting (token → moodboard) too
    meta = get_tenant_settings(ctx["tenant_id"], f"moodboard.{moodboard_id}.share", None) or {}
    if meta.get("token"):
        try:
            client.table('tenant_settings').delete() \
                .eq('tenant_id', ctx["tenant_id"]) \
                .eq('key', f"moodboard_share.{meta['token']}").execute()
        except Exception:
            pass
    upsert_tenant_setting(ctx["tenant_id"], f"moodboard.{moodboard_id}.share", {"token": None})
    return {"message": "revoked"}


# ── PUBLIC: client review by share token (no auth) ──────────────────────────
@router.get("/public/share/{share_token}")
def public_get_by_share(share_token: str):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    # Token→moodboard reverse lookup via tenant_settings
    s = client.table('tenant_settings').select('tenant_id, value_json') \
        .eq('key', f"moodboard_share.{share_token}").limit(1).execute()
    if not s.data:
        raise HTTPException(404, "Not found")
    record = s.data[0].get('value_json') or {}
    mid = record.get('moodboard_id')
    if not mid:
        raise HTTPException(404, "Not found")
    r = client.table('moodboards').select('*').eq('id', mid).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    mb = r.data[0]
    if mb.get("status") in (None, "draft"):
        raise HTTPException(403, "Not ready for review")
    els = client.table('moodboard_elements').select('*').eq('moodboard_id', mb['id']).execute()
    mb['elements'] = [_normalize_block(b) for b in (els.data or [])]
    mb.pop('tenant_id', None)
    return mb
