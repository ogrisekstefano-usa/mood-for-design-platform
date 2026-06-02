"""Vision Cache™ — Phase 1 Founding Brands Program (ITER192).

pHash → Vision LLM result lookup, hybrid scope:
  • Default per-tenant (`scope='tenant'`, `tenant_id` set)
  • Global cross-tenant for curated_public assets (`scope='global'`)

Cache key encoding:
  • tenant: "<phash>::tenant:<tenant_id>"
  • global: "<phash>::global"

Lookup order (resolve_cached): global first, then tenant. If hit, increments
hit_count + last_hit_at. NEVER raises.

Public API:
    lookup_cached(phash, tenant_id, model) -> Optional[dict]
    store_cache(phash, tenant_id, model, result_json, scope='tenant') -> None
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _key(phash: str, tenant_id: Optional[str], scope: str) -> str:
    if scope == "global":
        return f"{phash}::global"
    return f"{phash}::tenant:{tenant_id or 'unknown'}"


def lookup_cached(
    db_client: Any,
    phash: Optional[str],
    tenant_id: Optional[str],
    model: str,
) -> Optional[Dict[str, Any]]:
    """Return cached vision result_json or None on miss.

    Lookup precedence:
      1. global scope (curated_public asset reuse)
      2. tenant scope (per-tenant private cache)
    """
    if not phash or not db_client:
        return None
    try:
        # 1. Global
        global_key = _key(phash, None, "global")
        rows = (db_client.table("vision_cache").select("*")
                .eq("cache_key", global_key).eq("model", model)
                .limit(1).execute().data or [])
        if rows:
            _bump_hit(db_client, global_key)
            return rows[0].get("result_json")
        # 2. Tenant
        if tenant_id:
            tenant_key = _key(phash, tenant_id, "tenant")
            rows = (db_client.table("vision_cache").select("*")
                    .eq("cache_key", tenant_key).eq("model", model)
                    .limit(1).execute().data or [])
            if rows:
                _bump_hit(db_client, tenant_key)
                return rows[0].get("result_json")
    except Exception as e:
        logger.warning(f"vision_cache lookup failed: {e}")
    return None


def store_cache(
    db_client: Any,
    phash: str,
    tenant_id: Optional[str],
    model: str,
    result_json: Dict[str, Any],
    *,
    scope: str = "tenant",
) -> None:
    """Insert or upsert the cache entry. Never raises."""
    if not phash or not result_json or not db_client:
        return
    try:
        key = _key(phash, tenant_id, scope)
        row = {
            "cache_key":  key,
            "phash":      phash,
            "scope":      scope if scope in ("global", "tenant") else "tenant",
            "tenant_id":  None if scope == "global" else tenant_id,
            "model":      model,
            "result_json": result_json,
            "hit_count":  0,
            "created_at": _now(),
            "last_hit_at": _now(),
        }
        # Upsert (cache_key is PK)
        db_client.table("vision_cache").upsert(row, on_conflict="cache_key").execute()
    except Exception as e:
        logger.warning(f"vision_cache store failed: {e}")


def _bump_hit(db_client: Any, cache_key: str) -> None:
    """Increment hit_count + update last_hit_at. Best-effort."""
    try:
        cur = (db_client.table("vision_cache").select("hit_count")
               .eq("cache_key", cache_key).limit(1).execute().data or [])
        hc = (cur[0].get("hit_count") if cur else 0) or 0
        db_client.table("vision_cache").update({
            "hit_count": hc + 1, "last_hit_at": _now(),
        }).eq("cache_key", cache_key).execute()
    except Exception:
        pass


def cache_stats(db_client: Any, tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """Return aggregate cache stats for diagnostics dashboards."""
    out = {"total": 0, "global": 0, "tenant": 0, "total_hits": 0}
    if not db_client:
        return out
    try:
        rows = (db_client.table("vision_cache")
                .select("scope,hit_count,tenant_id").execute().data or [])
        for r in rows:
            if tenant_id and r.get("scope") == "tenant" and r.get("tenant_id") != tenant_id:
                continue
            out["total"] += 1
            out[r.get("scope", "tenant")] = out.get(r.get("scope", "tenant"), 0) + 1
            out["total_hits"] += int(r.get("hit_count") or 0)
    except Exception as e:
        logger.warning(f"cache_stats failed: {e}")
    return out
