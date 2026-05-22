"""Studio Voice™ API · ITER125.

Endpoints
─────────
  GET    /api/voice/profile               — read the studio's Language DNA™ profile
  PUT    /api/voice/profile               — upsert the profile (preset + extras)
  GET    /api/voice/presets               — list available Language DNA presets

  GET    /api/voice/vocabulary            — list preferred vocabulary
  POST   /api/voice/vocabulary            — add a term pair
  PUT    /api/voice/vocabulary/{id}       — edit a term pair
  DELETE /api/voice/vocabulary/{id}       — deactivate a term pair

  POST   /api/voice/lock/{variant_id}     — lock a translation (sacred)
  POST   /api/voice/unlock/{variant_id}   — revert to ai_only / human_reviewed
  POST   /api/voice/rewrite/{variant_id}  — manual studio rewrite (Learning System™)

  GET    /api/voice/memory                — Translation Memory Inspector™ data
  GET    /api/voice/analytics             — Translation Analytics™ panel
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from services.relational_translation import SUPPORTED_LOCALES
from services.studio_voice import (
    LANGUAGE_DNA_PRESETS,
    load_language_dna,
    load_vocabulary,
    record_correction,
    save_language_dna,
    voice_analytics,
)

router = APIRouter()

VOCAB_CATEGORIES = frozenset({'editorial', 'material', 'atmosphere',
                              'spatial', 'relational', 'technical'})
ADMIN_ROLES = frozenset({'super_admin', 'tenant_admin', 'designer'})


def _require_admin(ctx: dict) -> None:
    role = (ctx.get('role') or '').lower()
    if role not in ADMIN_ROLES:
        raise HTTPException(403, "forbidden")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Language DNA profile ──────────────────────────────────────
class LanguageDnaPayload(BaseModel):
    preset: str = "editorial_italian_luxury"
    communication_style: Optional[str] = None
    hospitality_level: Optional[str] = None
    editorial_density: Optional[str] = None
    avoid_terms: Optional[List[str]] = None
    notes: Optional[str] = None


@router.get("/presets")
def list_presets(
    request: Request,
    ctx: dict = Depends(get_tenant_context),
):
    """List the Studio Voice™ presets. The summary is localized using the
    `Accept-Language` header (defaults to English summary)."""
    al = (request.headers.get('Accept-Language') or '').lower()
    use_it = al.startswith('it')
    return {
        "presets": [
            {
                "id": k,
                "label": v["label"],
                "summary": (v.get("summary_it") if use_it else v["summary"]) or v["summary"],
            }
            for k, v in LANGUAGE_DNA_PRESETS.items()
        ]
    }


@router.get("/profile")
def get_profile(ctx: dict = Depends(get_tenant_context)):
    tenant_id = ctx.get('tenant_id')
    return load_language_dna(tenant_id)


@router.put("/profile")
def put_profile(payload: LanguageDnaPayload, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    if payload.preset not in LANGUAGE_DNA_PRESETS:
        raise HTTPException(422, {"error": "invalid_preset",
                                  "valid": sorted(LANGUAGE_DNA_PRESETS.keys())})
    return save_language_dna(tenant_id, payload.model_dump(),
                             created_by=ctx.get('profile_id') or ctx.get('user_id'))


# ── Preferred Vocabulary™ ─────────────────────────────────────
class VocabularyCreatePayload(BaseModel):
    source_term: str = Field(..., min_length=1, max_length=120)
    source_locale: str
    target_locale: str
    preferred_translation: str = Field(..., min_length=1, max_length=200)
    category: str = "editorial"
    notes: Optional[str] = None


class VocabularyUpdatePayload(BaseModel):
    preferred_translation: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


def _validate_locales(*locales: str) -> None:
    for lc in locales:
        if lc not in SUPPORTED_LOCALES:
            raise HTTPException(422, {"error": "unsupported_locale", "locale": lc})


@router.get("/vocabulary")
def list_vocabulary(
    source_locale: Optional[str] = Query(None),
    target_locale: Optional[str] = Query(None),
    active_only: bool = Query(True),
    ctx: dict = Depends(get_tenant_context),
):
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        return {"items": []}
    return {"items": load_vocabulary(tenant_id, source_locale, target_locale, active_only)}


@router.post("/vocabulary")
def add_vocabulary(payload: VocabularyCreatePayload, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    _validate_locales(payload.source_locale, payload.target_locale)
    cat = payload.category if payload.category in VOCAB_CATEGORIES else 'editorial'
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        res = db().table('studio_vocabulary').upsert({
            'tenant_id': tenant_id,
            'source_term': payload.source_term.strip(),
            'source_locale': payload.source_locale,
            'target_locale': payload.target_locale,
            'preferred_translation': payload.preferred_translation.strip(),
            'category': cat,
            'notes': payload.notes,
            'is_active': True,
            'created_by': ctx.get('profile_id') or ctx.get('user_id'),
            'updated_at': _now_iso(),
        }, on_conflict='tenant_id,source_term,source_locale,target_locale').execute()
        return {"ok": True, "item": (res.data or [None])[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"vocabulary add failed: {e}")


@router.put("/vocabulary/{vocab_id}")
def edit_vocabulary(vocab_id: str, payload: VocabularyUpdatePayload,
                    ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    updates: dict = {}
    if payload.preferred_translation is not None:
        updates['preferred_translation'] = payload.preferred_translation.strip()
    if payload.category is not None:
        if payload.category not in VOCAB_CATEGORIES:
            raise HTTPException(422, {"error": "invalid_category",
                                      "valid": sorted(VOCAB_CATEGORIES)})
        updates['category'] = payload.category
    if payload.notes is not None:
        updates['notes'] = payload.notes
    if payload.is_active is not None:
        updates['is_active'] = payload.is_active
    if not updates:
        raise HTTPException(400, "nothing_to_update")
    updates['updated_at'] = _now_iso()
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        res = (db().table('studio_vocabulary').update(updates)
               .eq('tenant_id', tenant_id).eq('id', vocab_id).execute())
        if not res.data:
            raise HTTPException(404, "vocabulary_not_found")
        return {"ok": True, "item": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"vocabulary update failed: {e}")


@router.delete("/vocabulary/{vocab_id}")
def delete_vocabulary(vocab_id: str, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        db().table('studio_vocabulary').update({
            'is_active': False, 'updated_at': _now_iso(),
        }).eq('tenant_id', tenant_id).eq('id', vocab_id).execute()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"vocabulary delete failed: {e}")


# ── Lock / unlock / rewrite ───────────────────────────────────
class RewritePayload(BaseModel):
    studio_translation: str = Field(..., min_length=1, max_length=4000)
    rationale: Optional[str] = None
    lock: bool = True  # default: lock after rewrite (Learning System™)


@router.post("/lock/{variant_id}")
def lock_translation(variant_id: str, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        res = db().table('message_translations').update({
            'review_status': 'locked_approved',
            'reviewed_by':   ctx.get('profile_id') or ctx.get('user_id'),
            'reviewed_at':   _now_iso(),
            'updated_at':    _now_iso(),
        }).eq('tenant_id', tenant_id).eq('id', variant_id).execute()
        if not res.data:
            raise HTTPException(404, "variant_not_found")
        return {"ok": True, "item": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"lock failed: {e}")


@router.post("/unlock/{variant_id}")
def unlock_translation(variant_id: str, ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        res = db().table('message_translations').update({
            'review_status': 'human_reviewed',
            'updated_at':    _now_iso(),
        }).eq('tenant_id', tenant_id).eq('id', variant_id).execute()
        if not res.data:
            raise HTTPException(404, "variant_not_found")
        return {"ok": True, "item": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"unlock failed: {e}")


@router.post("/rewrite/{variant_id}")
def rewrite_translation(variant_id: str, payload: RewritePayload,
                        ctx: dict = Depends(get_tenant_context)):
    _require_admin(ctx)
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        raise HTTPException(400, "tenant_required")
    try:
        from database import db, db_available
        if not db_available():
            raise HTTPException(503, "db_unavailable")
        client = db()
        # 1) Fetch the current variant to capture before/after for the audit trail.
        cur = (client.table('message_translations')
               .select('*').eq('tenant_id', tenant_id).eq('id', variant_id)
               .limit(1).execute())
        if not cur.data:
            raise HTTPException(404, "variant_not_found")
        prev = cur.data[0]
        new_status = 'locked_approved' if payload.lock else 'human_reviewed'
        # 2) Update in place — we keep the same translation_version but
        #    record the previous text so the Translation Memory Inspector™
        #    can render a before/after view.
        updated = client.table('message_translations').update({
            'localized_text':           payload.studio_translation.strip(),
            'previous_localized_text':  prev.get('localized_text'),
            'review_status':            new_status,
            'reviewed_by':              ctx.get('profile_id') or ctx.get('user_id'),
            'reviewed_at':              _now_iso(),
            'updated_at':               _now_iso(),
            'translation_model':        f"{prev.get('translation_model') or 'unknown'}+studio_rewrite",
        }).eq('id', variant_id).execute()
        # 3) Record the correction (audit trail + future few-shot calibration).
        record_correction(
            tenant_id=tenant_id,
            variant_id=variant_id,
            source_locale=prev['source_locale'],
            target_locale=prev['target_locale'],
            original_text=prev['original_text'],
            ai_translation=prev.get('localized_text') or '',
            studio_translation=payload.studio_translation.strip(),
            rationale=payload.rationale,
            corrected_by=ctx.get('profile_id') or ctx.get('user_id'),
        )
        return {"ok": True, "item": (updated.data or [None])[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"rewrite failed: {e}")


# ── Translation Memory Inspector™ ─────────────────────────────
@router.get("/memory")
def memory_inspector(
    source_locale: Optional[str] = Query(None),
    target_locale: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    ctx: dict = Depends(get_tenant_context),
):
    tenant_id = ctx.get('tenant_id')
    if not tenant_id:
        return {"items": []}
    try:
        from database import db, db_available
        if not db_available():
            return {"items": []}
        q = (db().table('message_translations')
             .select('id, surface, source_locale, target_locale, original_text, '
                     'localized_text, previous_localized_text, review_status, '
                     'translation_version, usage_count, translation_model, '
                     'created_at, updated_at, reviewed_at')
             .eq('tenant_id', tenant_id))
        if source_locale:
            q = q.eq('source_locale', source_locale)
        if target_locale:
            q = q.eq('target_locale', target_locale)
        if review_status:
            q = q.eq('review_status', review_status)
        if search:
            # ilike on either column. Supabase doesn't support OR easily in
            # PostgREST client without `or_()`, so we do two queries and merge.
            base = q
            r1 = base.ilike('original_text', f'%{search}%').limit(limit).execute()
            r2 = q.ilike('localized_text', f'%{search}%').limit(limit).execute()
            seen = set()
            merged = []
            for row in list(r1.data or []) + list(r2.data or []):
                if row['id'] in seen:
                    continue
                seen.add(row['id'])
                merged.append(row)
            return {"items": merged[:limit]}
        res = q.order('usage_count', desc=True).limit(limit).execute()
        return {"items": list(res.data or [])}
    except Exception as e:
        raise HTTPException(500, f"memory failed: {e}")


# ── Translation Analytics™ ────────────────────────────────────
@router.get("/analytics")
def analytics(ctx: dict = Depends(get_tenant_context)):
    tenant_id = ctx.get('tenant_id')
    return voice_analytics(tenant_id) if tenant_id else {}


@router.get("/health")
def health():
    return {
        "ok": True,
        "presets": [k for k in LANGUAGE_DNA_PRESETS.keys()],
        "vocabulary_categories": sorted(VOCAB_CATEGORIES),
        "supported_locales": sorted(SUPPORTED_LOCALES),
    }
