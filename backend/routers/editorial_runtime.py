"""
Editorial Runtime · public (non-admin) endpoint for resolved overrides.

Mounted at `/api/editorial-copy/runtime`. Any authenticated user can
call it; returns the flat `{i18n_key: string}` map for their tenant +
locale. The frontend `useT()` consults this BEFORE the static JSON,
so admin copy edits propagate to the live UI without a redeploy.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends

from core.tenant_context import get_tenant_context
from database import db

router = APIRouter()


@router.get("/runtime")
def runtime_overrides(
    locale: str = "it",
    ctx: dict = Depends(get_tenant_context),
):
    sb = db()
    tid = ctx["tenant_id"]
    loc = (locale or "it").split("-")[0].lower()

    phrases = (
        sb.table("editorial_phrases")
        .select("id, phrase_key, i18n_keys, eyebrow, title, body, cta")
        .neq("i18n_keys", "{}")
        .execute()
    ).data or []

    if not phrases:
        return {"locale": loc, "overrides": {}}

    ids = [p["id"] for p in phrases]
    overrides = (
        sb.table("editorial_phrase_overrides")
        .select("phrase_id, eyebrow, title, body, cta")
        .eq("tenant_id", tid)
        .in_("phrase_id", ids)
        .execute()
    ).data or []
    by_pid = {o["phrase_id"]: o for o in overrides}

    out: dict = {}
    for p in phrases:
        ov = by_pid.get(p["id"]) or {}
        mapping = p.get("i18n_keys") or {}
        for scope, i18n_key in mapping.items():
            src = ov.get(scope) if ov.get(scope) else p.get(scope)
            if not src:
                continue
            val = src.get(loc) or src.get("it") or src.get("en")
            if val:
                out[i18n_key] = val

    return {"locale": loc, "overrides": out}
