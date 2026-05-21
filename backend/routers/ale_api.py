"""Adaptive Language Experience™ — API surface · iter123.

Endpoints
─────────
  POST /api/ale/localize           → translate a single message
  POST /api/ale/localize-batch     → translate up to 20 messages in one call
  GET  /api/ale/preferences        → read the caller's content-language prefs
  PUT  /api/ale/preferences        → update the caller's content-language prefs

Preferences are stored in the existing `user_preferences` table (created on
write — graceful no-op if the table is missing in the legacy schema).
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from services.relational_translation import translate, SUPPORTED_LOCALES, cache_stats

router = APIRouter()

VALID_MODES = frozenset({"original_only", "localized_only", "dual"})


# ── Schemas ────────────────────────────────────────────────────
class LocalizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    source_locale: str
    target_locale: str
    dnt_terms: Optional[List[str]] = None  # tenant-supplied additions

class BatchItem(BaseModel):
    id: str
    text: str = Field(..., min_length=1, max_length=4000)
    source_locale: str

class LocalizeBatchRequest(BaseModel):
    target_locale: str
    items: List[BatchItem] = Field(..., max_length=20)

class PreferencesPayload(BaseModel):
    auto_localize: bool = True
    display_mode: str = "localized_only"   # one of VALID_MODES
    show_translation_label: bool = True


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
    dnt = tuple(req.dnt_terms) if req.dnt_terms else None
    result = translate(req.text, req.source_locale, req.target_locale, dnt_terms=dnt)
    return result.to_dict()


@router.post("/localize-batch")
def localize_batch(req: LocalizeBatchRequest, ctx: dict = Depends(get_tenant_context)):
    _validate_locales(req.target_locale)
    out = []
    for item in req.items:
        if item.source_locale not in SUPPORTED_LOCALES:
            out.append({"id": item.id, "error": "unsupported_source_locale"})
            continue
        result = translate(item.text, item.source_locale, req.target_locale)
        out.append({"id": item.id, **result.to_dict()})
    return {"items": out, "target_locale": req.target_locale}


# ── User preferences ──────────────────────────────────────────
def _load_preferences(user_id: str) -> PreferencesPayload:
    # Lazy import to avoid hard DB dependency for tests that mock get_tenant_context.
    try:
        from database import db, db_available
        if db_available():
            client = db()
            res = client.table('user_preferences').select('value').eq('user_id', user_id).eq('key', 'ale_content').limit(1).execute()
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
        pass  # graceful: settings UI will surface the issue if any


@router.get("/preferences")
def get_preferences(ctx: dict = Depends(get_tenant_context)):
    user_id = ctx.get("user_id") or "anonymous"
    prefs = _load_preferences(user_id)
    return prefs.model_dump()


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


@router.get("/health")
def health():
    return {
        "ok": True,
        "supported_locales": sorted(SUPPORTED_LOCALES),
        "modes": sorted(VALID_MODES),
        "cache": cache_stats(),
    }
