"""Adaptive Language Experience™ — API surface · iter123 → iter124.

Endpoints
─────────
  POST  /api/ale/localize           — translate / serve-from-cache a single message
  POST  /api/ale/localize-batch     — up to 20 messages in one call
  GET   /api/ale/preferences        — user content-language prefs (auto-localize on/off, …)
  PUT   /api/ale/preferences        — update prefs
  GET   /api/ale/stats              — tenant Governance Overlay numbers
  GET   /api/ale/dnt                — list tenant DNT terms
  POST  /api/ale/dnt                — add a tenant DNT term
  DELETE /api/ale/dnt/{term_id}     — deactivate a tenant DNT term
  POST  /api/ale/review/{variant_id} — mark a translation as human-reviewed or locked
  GET   /api/ale/health             — endpoint health + cache stats

Cache flow (iter124):
   1. POST /localize with message_id → service first checks
      (message_id, target_locale) variant in `message_translations`
   2. Cache hit → return immediately (translation_cached=true)
   3. Cache miss → service consults Translation Memory™ for the same
      tenant + identical original_hash
   4. Still miss → LLM call, then persist
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from services.relational_translation import SUPPORTED_LOCALES, cache_stats
from services.translation_memory import (
    KNOWN_SURFACES,
    invalidate_for_message,
    localize_with_memory,
    stats_for_tenant,
)

router = APIRouter()

VALID_MODES = frozenset({"original_only", "localized_only", "dual"})
DNT_CATEGORIES = frozenset({"brand", "material", "designer",
                            "collection", "studio", "protected_term"})
REVIEW_STATUSES = frozenset({"ai_only", "human_reviewed", "locked_approved"})


# ── Schemas ────────────────────────────────────────────────────
class LocalizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    source_locale: str
    target_locale: str
    message_id: Optional[str] = None        # iter124: anchor for per-message cache
    surface: Optional[str] = None           # iter124: client_message, milestone_note, …
    dnt_terms: Optional[List[str]] = None   # caller-supplied extras (tests, ad-hoc)


class BatchItem(BaseModel):
    id: str
    text: str = Field(..., min_length=1, max_length=4000)
    source_locale: str
    message_id: Optional[str] = None
    surface: Optional[str] = None


class LocalizeBatchRequest(BaseModel):
    target_locale: str
    items: List[BatchItem] = Field(..., max_length=20)


class PreferencesPayload(BaseModel):
    auto_localize: bool = True
    display_mode: str = "localized_only"
    show_translation_label: bool = True


class DntCreatePayload(BaseModel):
    term: str = Field(..., min_length=1, max_length=200)
    category: str = "protected_term"


class ReviewPayload(BaseModel):
    review_status: str
    note: Optional[str] = None


def _validate_locales(*locales: str) -> None:
    for lc in locales:
        if lc not in SUPPORTED_LOCALES:
            raise HTTPException(
                status_code=422,
                detail={"error": "unsupported_locale", "locale": lc,
                        "supported": sorted(SUPPORTED_LOCALES)},
            )


# ── Translation endpoints ─────────────────────────────────────
@router.post("/localize")
def localize(req: LocalizeRequest, ctx: dict = Depends(get_tenant_context)):
    _validate_locales(req.source_locale, req.target_locale)
    surface = req.surface or 'client_message'
    if surface not in KNOWN_SURFACES:
        # we do not reject — surface is editorial governance, not a hard
        # constraint. We pass it through verbatim.
        pass
    payload = localize_with_memory(
        text=req.text,
        source_locale=req.source_locale,
        target_locale=req.target_locale,
        tenant_id=ctx.get('tenant_id'),
        message_id=req.message_id,
        surface=surface,
        extra_dnt_terms=tuple(req.dnt_terms) if req.dnt_terms else None,
    )
    return payload


@router.post("/localize-batch")
def localize_batch(req: LocalizeBatchRequest, ctx: dict = Depends(get_tenant_context)):
    _validate_locales(req.target_locale)
    out = []
    for item in req.items:
        if item.source_locale not in SUPPORTED_LOCALES:
            out.append({"id": item.id, "error": "unsupported_source_locale"})
            continue
        payload = localize_with_memory(
            text=item.text,
            source_locale=item.source_locale,
            target_locale=req.target_locale,
            tenant_id=ctx.get('tenant_id'),
            message_id=item.message_id,
            surface=item.surface or 'client_message',
        )
        out.append({"id": item.id, **payload})
    return {"items": out, "target_locale": req.target_locale}


# ── User preferences ──────────────────────────────────────────
def _load_preferences(user_id: str) -> PreferencesPayload:
    try:
        from database import db, db_available
        if db_available():
            client = db()
            res = (client.table('user_preferences')
                   .select('value')
                   .eq('user_id', user_id).eq('key', 'ale_content')
                   .limit(1).execute())
            if res.data:
                val = res.data[0].get('value') or {}
                return PreferencesPayload(**val)
    except Exception:
        pass
    return PreferencesPayload()


def _save_preferences(user_id: str, prefs: PreferencesPayload) -> None:
    try:
        from database import db, db_available
        if not db_available():
            return
        client = db()
        client.table('user_preferences').upsert({
            'user_id': user_id,
            'key': 'ale_content',
            'value': prefs.model_dump(),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        pass


@router.get("/preferences")
def get_preferences(ctx: dict = Depends(get_tenant_context)):
    user_id = ctx.get("user_id") or "anonymous"
    return _load_preferences(user_id).model_dump()


@router.put("/preferences")
def put_preferences(payload: PreferencesPayload, ctx: dict = Depends(get_tenant_context)):
    if payload.display_mode not in VALID_MODES:
        raise HTTPException(status_code=422, detail={
            "error": "invalid_display_mode",
            "valid": sorted(VALID_MODES),
        })
    user_id = ctx.get("user_id") or "anonymous"
    _save_preferences(user_id, payload)
    return {"ok": True, **payload.model_dump()}


# ── Tenant DNT registry ───────────────────────────────────────
@router.get("/dnt")
def list_dnt(ctx: dict = Depends(get_tenant_context)):
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        return {"items": []}
    try:
        from database import db, db_available
        if not db_available():
            return {"items": []}
        res = (db().table('tenant_dnt_registry')
               .select('id, term, category, active, created_at, updated_at')
               .eq('tenant_id', tenant_id)
               .order('term')
               .execute())
        return {"items": res.data or []}
    except Exception as e:
        raise HTTPException(500, f"dnt list failed: {e}")


@router.post("/dnt")
def add_dnt(payload: DntCreatePayload, ctx: dict = Depends(get_tenant_context)):
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    cat = payload.category if payload.category in DNT_CATEGORIES else 'protected_term'
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        client = db()
        # idempotent upsert on (tenant_id, term)
        res = client.table('tenant_dnt_registry').upsert({
            'tenant_id': tenant_id,
            'term': payload.term.strip(),
            'category': cat,
            'active': True,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }, on_conflict='tenant_id,term').execute()
        return {"ok": True, "item": (res.data or [None])[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"dnt add failed: {e}")


@router.delete("/dnt/{term_id}")
def delete_dnt(term_id: str, ctx: dict = Depends(get_tenant_context)):
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        client = db()
        client.table('tenant_dnt_registry').update({
            'active': False,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }).eq('tenant_id', tenant_id).eq('id', term_id).execute()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"dnt delete failed: {e}")


# ── Review system ─────────────────────────────────────────────
@router.post("/review/{variant_id}")
def review_translation(variant_id: str, payload: ReviewPayload,
                       ctx: dict = Depends(get_tenant_context)):
    if payload.review_status not in REVIEW_STATUSES:
        raise HTTPException(422, {"error": "invalid_review_status",
                                  "valid": sorted(REVIEW_STATUSES)})
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        client = db()
        res = client.table('message_translations').update({
            'review_status': payload.review_status,
            'reviewed_by': ctx.get('profile_id') or ctx.get('user_id'),
            'reviewed_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }).eq('tenant_id', tenant_id).eq('id', variant_id).execute()
        if not res.data:
            raise HTTPException(404, "variant_not_found")
        return {"ok": True, "item": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"review failed: {e}")


# ── Invalidation (admin / tests) ──────────────────────────────
@router.post("/invalidate/{message_id}")
def invalidate(message_id: str, ctx: dict = Depends(get_tenant_context)):
    role = (ctx.get('role') or '').lower()
    if role not in {'super_admin', 'tenant_admin', 'designer'}:
        raise HTTPException(403, "forbidden")
    n = invalidate_for_message(message_id)
    return {"ok": True, "invalidated": n}


# ── Governance Overlay numbers ────────────────────────────────
@router.get("/stats")
def stats(ctx: dict = Depends(get_tenant_context)):
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        return {"cache_total": 0, "reviewed": 0, "locked": 0, "today": 0}
    s = stats_for_tenant(tenant_id)
    s.update({
        "tenant_id": tenant_id,
        "process_cache": cache_stats(),
    })
    return s


@router.get("/health")
def health():
    return {
        "ok": True,
        "supported_locales": sorted(SUPPORTED_LOCALES),
        "modes": sorted(VALID_MODES),
        "surfaces": sorted(KNOWN_SURFACES),
        "review_statuses": sorted(REVIEW_STATUSES),
        "process_cache": cache_stats(),
    }
