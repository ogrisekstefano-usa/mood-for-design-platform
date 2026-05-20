"""Client Preview Link™ router — Sprint F2.4.

Private Curatorial Presentation Experience™.

PRIVATE endpoints (require studio auth):
  POST   /api/inspirations/references/collections/{id}/preview-links
         Generate a tokenized preview URL for a `client_visible` collection.
  GET    /api/inspirations/references/collections/{id}/preview-links
         List tokens for a collection (active + revoked).
  PATCH  /api/inspirations/references/preview-links/{token_id}
         Update preview_mode / settings / expires_at.
  DELETE /api/inspirations/references/preview-links/{token_id}
         Revoke (sets revoked_at, does NOT hard-delete to preserve feedback FK).
  GET    /api/inspirations/references/preview-links/{token_id}/feedback
         List client feedback events (approve/alternative/note) + views aggregate.

PUBLIC endpoints (NO auth — token in URL is the auth):
  GET    /api/public/preview/{token}
         Returns the curated collection + assets shaped for client preview.
         Increments views_count + writes a client_preview_view row.
  POST   /api/public/preview/{token}/feedback
         Client submits action: approve_direction / request_alternatives / note.
  POST   /api/public/preview/{token}/view
         Best-effort tracking of asset opens (in-modal zoom etc.).

Security:
  • Token is 32 url-safe random bytes (=~ 256 bit entropy).
  • Revoked or expired tokens return 410 Gone.
  • Public endpoints do NOT leak tenant_id, internal ids of assets
    that are NOT in the shared collection, or any studio-private metadata.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_PREVIEW_MODES = {"editorial", "material", "storytelling", "composition"}
VALID_ACTION_TYPES = {"approve_direction", "request_alternatives", "note"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in (row or {}).items() if k != "_id"}


def _make_token() -> str:
    """32 url-safe bytes (~256-bit entropy)."""
    return secrets.token_urlsafe(32)


def _viewer_signature(request: Request) -> str:
    """Hash of UA + IP — best-effort uniqueness, NO PII stored."""
    ua = request.headers.get("user-agent", "")[:200]
    ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
          or (request.client.host if request.client else ""))
    h = hashlib.sha256(f"{ua}|{ip}".encode("utf-8")).hexdigest()
    return h[:16]


# ─── Models ────────────────────────────────────────────────────────────
class PreviewLinkCreate(BaseModel):
    title:         Optional[str] = None
    preview_mode:  Optional[str] = "editorial"
    settings:      Optional[Dict[str, Any]] = None
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365)


class PreviewLinkUpdate(BaseModel):
    title:        Optional[str] = None
    preview_mode: Optional[str] = None
    settings:     Optional[Dict[str, Any]] = None
    expires_in_days: Optional[int] = Field(default=None, ge=0, le=365)


class ClientFeedbackIn(BaseModel):
    action_type:      str
    target_asset_id:  Optional[str] = None
    note:             Optional[str] = None
    client_identifier: Optional[str] = None


class ClientViewIn(BaseModel):
    target_asset_id:  Optional[str] = None
    duration_ms:      Optional[int] = Field(default=None, ge=0, le=24*60*60*1000)


# ─── PRIVATE · Generate / list / revoke ────────────────────────────────
@router.post("/references/collections/{cid}/preview-links", status_code=201)
def create_preview_link(cid: str, body: PreviewLinkCreate,
                        ctx=Depends(get_tenant_context)):
    """Generate a Client Preview Link™ for a curated collection.

    Only `client_visible` collections may generate preview links.
    """
    c = db()
    tid = ctx["tenant_id"]
    uid = ctx.get("profile_id")

    coll_rows = (c.table("curated_collections").select("*")
                 .eq("id", cid).eq("tenant_id", tid)
                 .limit(1).execute().data or [])
    if not coll_rows:
        raise HTTPException(404, "Collezione non trovata")
    coll = coll_rows[0]
    if coll.get("visibility") != "client_visible":
        raise HTTPException(
            400,
            "Solo le collezioni con visibilità 'cliente' possono generare un Client Preview Link™."
        )

    mode = (body.preview_mode or "editorial").lower()
    if mode not in VALID_PREVIEW_MODES:
        raise HTTPException(400, "Modalità di anteprima non valida")

    expires_at = None
    if body.expires_in_days:
        from datetime import timedelta
        expires_at = (datetime.now(timezone.utc) +
                      timedelta(days=body.expires_in_days)).isoformat()

    row = {
        "id":             str(uuid.uuid4()),
        "tenant_id":      tid,
        "created_by":     uid,
        "token":          _make_token(),
        "resource_type":  "curated_collection",
        "resource_id":    cid,
        "title":          (body.title or coll.get("title") or "").strip()[:200] or None,
        "preview_mode":   mode,
        "settings":       body.settings or {},
        "expires_at":     expires_at,
        "revoked_at":     None,
        "views_count":    0,
        "unique_visitors_count": 0,
        "last_viewed_at": None,
        "created_at":     _now(),
        "updated_at":     _now(),
    }
    c.table("preview_tokens").insert(row).execute()
    return {"item": _slim(row)}


@router.get("/references/collections/{cid}/preview-links")
def list_preview_links(cid: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("preview_tokens").select("*")
            .eq("tenant_id", tid).eq("resource_id", cid)
            .order("created_at", desc=True).limit(60).execute().data or [])
    return {"items": [_slim(r) for r in rows]}


@router.patch("/references/preview-links/{tid_token}")
def update_preview_link(tid_token: str, body: PreviewLinkUpdate,
                        ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("preview_tokens").select("*")
            .eq("id", tid_token).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Preview link non trovato")

    patch: Dict[str, Any] = {}
    if body.title is not None:        patch["title"] = body.title.strip()[:200] or None
    if body.preview_mode is not None:
        m = body.preview_mode.lower()
        if m not in VALID_PREVIEW_MODES:
            raise HTTPException(400, "Modalità di anteprima non valida")
        patch["preview_mode"] = m
    if body.settings is not None:     patch["settings"] = body.settings
    if body.expires_in_days is not None:
        if body.expires_in_days == 0:
            patch["expires_at"] = None
        else:
            from datetime import timedelta
            patch["expires_at"] = (datetime.now(timezone.utc) +
                                   timedelta(days=body.expires_in_days)).isoformat()
    if not patch:
        return {"item": _slim(rows[0])}
    patch["updated_at"] = _now()
    c.table("preview_tokens").update(patch).eq("id", tid_token).execute()
    upd = (c.table("preview_tokens").select("*")
           .eq("id", tid_token).limit(1).execute().data or [])[0]
    return {"item": _slim(upd)}


@router.delete("/references/preview-links/{tid_token}", status_code=204)
def revoke_preview_link(tid_token: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("preview_tokens").select("id")
            .eq("id", tid_token).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Preview link non trovato")
    c.table("preview_tokens").update(
        {"revoked_at": _now(), "updated_at": _now()}
    ).eq("id", tid_token).execute()
    return None


@router.get("/references/preview-links/{tid_token}/feedback")
def list_preview_feedback(tid_token: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("preview_tokens").select("*")
            .eq("id", tid_token).eq("tenant_id", tid)
            .limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Preview link non trovato")
    fb = (c.table("client_preview_feedback").select("*")
          .eq("preview_token_id", tid_token).eq("tenant_id", tid)
          .order("created_at", desc=True).limit(200).execute().data or [])
    views = (c.table("client_preview_views").select("target_asset_id,duration_ms,created_at")
             .eq("preview_token_id", tid_token).eq("tenant_id", tid)
             .order("created_at", desc=True).limit(500).execute().data or [])
    return {
        "preview":   _slim(rows[0]),
        "feedback":  [_slim(r) for r in fb],
        "views":     [_slim(v) for v in views],
        "summary": {
            "total_views":     len(views),
            "approvals":       sum(1 for r in fb if r.get("action_type") == "approve_direction"),
            "alternatives":    sum(1 for r in fb if r.get("action_type") == "request_alternatives"),
            "notes":           sum(1 for r in fb if r.get("action_type") == "note"),
        },
    }


# ─── PUBLIC · Client preview consumption (NO AUTH) ─────────────────────
def _load_token_or_410(c, token: str) -> Dict[str, Any]:
    rows = (c.table("preview_tokens").select("*")
            .eq("token", token).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Anteprima non trovata")
    t = rows[0]
    if t.get("revoked_at"):
        raise HTTPException(status.HTTP_410_GONE, "Questa anteprima non è più attiva")
    exp = t.get("expires_at")
    if exp:
        try:
            from dateutil import parser as _dp  # type: ignore
            if _dp.parse(exp) < datetime.now(timezone.utc):
                raise HTTPException(status.HTTP_410_GONE, "Anteprima scaduta")
        except HTTPException: raise
        except Exception:
            # Loose parse — if we can't parse expires_at we don't enforce it.
            pass
    return t


def _public_card(row: Dict[str, Any]) -> Dict[str, Any]:
    """Strip all studio-private fields; keep what the client should see."""
    meta = row.get("inspiration_meta") or {}
    return {
        "id":               row.get("id"),
        "file_url":         row.get("file_url"),
        "alt_text":         row.get("alt_text"),
        "width":            row.get("width"),
        "height":           row.get("height"),
        "product_name":     meta.get("product_name"),
        "brand":            meta.get("brand"),
        "collection":       meta.get("collection"),
        "asset_type":       meta.get("asset_type"),
        "color_family":     meta.get("color_family"),
        "mood_tags":        meta.get("mood_tags") or [],
        "moodboard_priority": meta.get("moodboard_priority"),
        "editorial_score":  meta.get("editorial_score"),
        "dominant_color_palette": meta.get("dominant_color_palette") or [],
    }


@router.get("/public/preview/{token}")
def public_get_preview(token: str, request: Request):
    """Return the public-safe preview payload for a token.

    Increments views_count + writes a client_preview_view row for the
    initial page-open (target_asset_id=NULL).
    """
    c = db()
    tk = _load_token_or_410(c, token)
    tid = tk["tenant_id"]

    # Load collection
    coll_rows = (c.table("curated_collections").select(
        "id,title,description,tags,cover_asset_id,visibility,created_at"
    ).eq("id", tk["resource_id"]).eq("tenant_id", tid)
     .limit(1).execute().data or [])
    if not coll_rows:
        raise HTTPException(404, "Direzione progettuale non disponibile")
    coll = coll_rows[0]

    # Load saved references + media metadata
    saved = (c.table("saved_references")
             .select("id,visual_asset_id,note,tags,created_at")
             .eq("tenant_id", tid)
             .eq("curated_collection_id", tk["resource_id"])
             .order("created_at", desc=False).limit(200).execute().data or [])
    cards: List[Dict[str, Any]] = []
    if saved:
        ids = [s["visual_asset_id"] for s in saved]
        media = (c.table("media_library").select(
            "id,file_url,alt_text,width,height,inspiration_meta"
        ).in_("id", ids).eq("tenant_id", tid).limit(500).execute().data or [])
        by_id = {m["id"]: m for m in media}
        for s in saved:
            asset = by_id.get(s["visual_asset_id"])
            if not asset: continue
            card = _public_card(asset)
            card["client_note"]     = s.get("note")
            card["reference_tags"]  = s.get("tags") or []
            cards.append(card)

    # Studio branding — tenant slug + name only (NO internal data)
    studio = (c.table("tenants").select("id,name,slug").eq("id", tid)
              .limit(1).execute().data or [])
    studio_branding = {
        "name": (studio[0]["name"] if studio else "Studio"),
        "slug": (studio[0]["slug"] if studio else None),
    }

    # Record page-view event + bump counter (best effort)
    try:
        sig = _viewer_signature(request)
        c.table("client_preview_views").insert({
            "id": str(uuid.uuid4()),
            "preview_token_id": tk["id"],
            "tenant_id":  tid,
            "target_asset_id": None,
            "viewer_signature": sig,
            "created_at": _now(),
        }).execute()
        # Compute unique visitors so far
        sigs = (c.table("client_preview_views")
                .select("viewer_signature")
                .eq("preview_token_id", tk["id"])
                .limit(1000).execute().data or [])
        uniques = len({(r.get("viewer_signature") or "") for r in sigs if r.get("viewer_signature")})
        c.table("preview_tokens").update({
            "views_count":          (tk.get("views_count") or 0) + 1,
            "unique_visitors_count": uniques,
            "last_viewed_at":       _now(),
        }).eq("id", tk["id"]).execute()
    except Exception as e:
        logger.warning(f"preview view tracking failed: {e}")

    return {
        "token":         tk["token"],
        "title":         tk.get("title") or coll.get("title"),
        "preview_mode":  tk.get("preview_mode") or "editorial",
        "settings":      tk.get("settings") or {},
        "direction": {
            "title":       coll.get("title"),
            "description": coll.get("description"),
            "tags":        coll.get("tags") or [],
        },
        "studio":        studio_branding,
        "assets":        cards,
        "count":         len(cards),
    }


@router.post("/public/preview/{token}/feedback", status_code=201)
def public_post_feedback(token: str, body: ClientFeedbackIn, request: Request):
    """Client submits an action (approve / alternatives / note).

    Non-blocking: even if validation fails on optional fields we DO save
    the action_type with empty fields, to preserve the emotional signal.
    """
    c = db()
    tk = _load_token_or_410(c, token)
    action = body.action_type.lower()
    if action not in VALID_ACTION_TYPES:
        raise HTTPException(400, "Tipo di azione non valido")
    row = {
        "id":                str(uuid.uuid4()),
        "preview_token_id":  tk["id"],
        "tenant_id":         tk["tenant_id"],
        "action_type":       action,
        "target_asset_id":   body.target_asset_id,
        "note":              (body.note or "").strip()[:2000] or None,
        "client_identifier": (body.client_identifier or "").strip()[:120] or None,
        "metadata":          {"viewer_signature": _viewer_signature(request)},
        "created_at":        _now(),
    }
    c.table("client_preview_feedback").insert(row).execute()
    return {"item": _slim(row)}


@router.post("/public/preview/{token}/view", status_code=204)
def public_post_view(token: str, body: ClientViewIn, request: Request):
    """Best-effort tracking of individual asset opens.

    NEVER returns an error to the client even if writes fail — the
    preview UX must remain seamless.
    """
    try:
        c = db()
        tk = _load_token_or_410(c, token)
        c.table("client_preview_views").insert({
            "id":               str(uuid.uuid4()),
            "preview_token_id": tk["id"],
            "tenant_id":        tk["tenant_id"],
            "target_asset_id":  body.target_asset_id,
            "duration_ms":      body.duration_ms,
            "viewer_signature": _viewer_signature(request),
            "created_at":       _now(),
        }).execute()
    except HTTPException:
        # 410/404 → re-raise so client knows it's gone
        raise
    except Exception as e:
        logger.warning(f"preview view-event write failed: {e}")
    return None
