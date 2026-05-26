"""
ITER155.R2 · Editorial Runtime Overrides™ — public (non-admin).

Mounted at `/api/editorial-copy/runtime`. Returns the flat
`{i18n_key: string}` map for the caller's tenant + locale,
consumed by `useT()` BEFORE the static JSON dictionaries.

Resolution chain in pickString():
  1. tenant runtime override (THIS endpoint)
  2. requested-locale static JSON
  3. fallback chain
  4. visible ⟦key⟧ token (strict mode)

The endpoint is intentionally tolerant:
  • no editorial_phrases table  → empty map (200)
  • no tenant context           → fallback to system defaults
  • unknown locale              → fallback to it/en
so the provider never breaks the app.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Request

from database import db

log = logging.getLogger(__name__)
router = APIRouter()


def _safe_tenant_id(request: Request) -> str | None:
    rt = getattr(request.state, "resolved_tenant", None) or {}
    return rt.get("tenant_id")


@router.get("/runtime")
def runtime_overrides(request: Request, locale: str = "it"):
    """Resolve runtime overrides for the current tenant + locale.

    Designed for the public `useT()` consumer: no 4xx, no surprises —
    if anything is missing we return `{overrides: {}}` so the static
    dictionary fallback remains the source of truth.
    """
    loc = (locale or "it").split("-")[0].lower()
    tid = _safe_tenant_id(request)

    try:
        sb = db()
        try:
            phrases = (
                sb.table("editorial_phrases")
                .select("id, phrase_key, i18n_keys, eyebrow, title, body, cta")
                .neq("i18n_keys", "{}")
                .execute()
            ).data or []
        except Exception as e:
            log.info("editorial_runtime · phrases table unavailable: %s", e)
            return {"locale": loc, "overrides": {}, "source": "fallback-empty"}

        if not phrases:
            return {"locale": loc, "overrides": {}, "source": "no-phrases"}

        by_pid: dict = {}
        if tid:
            try:
                ids = [p["id"] for p in phrases]
                overrides = (
                    sb.table("editorial_phrase_overrides")
                    .select("phrase_id, eyebrow, title, body, cta")
                    .eq("tenant_id", tid)
                    .in_("phrase_id", ids)
                    .execute()
                ).data or []
                by_pid = {o["phrase_id"]: o for o in overrides}
            except Exception as e:
                log.info("editorial_runtime · tenant overrides unavailable: %s", e)
                by_pid = {}

        out: dict = {}
        for p in phrases:
            ov = by_pid.get(p["id"]) or {}
            mapping = p.get("i18n_keys") or {}
            for scope, i18n_key in mapping.items():
                src = ov.get(scope) if ov.get(scope) else p.get(scope)
                if not src or not isinstance(src, dict):
                    continue
                val = src.get(loc) or src.get("it") or src.get("en")
                if val:
                    out[i18n_key] = val

        return {
            "locale":    loc,
            "tenant_id": tid,
            "overrides": out,
            "count":     len(out),
            "source":    "resolved",
        }
    except Exception as e:
        # Last-resort: never crash useT()
        log.warning("editorial_runtime · unexpected error: %s", e)
        return {"locale": loc, "overrides": {}, "source": "error-fallback"}
