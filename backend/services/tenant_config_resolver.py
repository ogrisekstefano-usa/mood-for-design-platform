"""ITER144 · Tenant Configuration Resolver™.

Resolves the effective per-tenant configuration with strict precedence:

  1. tenant_configuration.feature_flags[code]          (tenant override)
  2. tenant_configuration.enabled_modules[code]        (tenant simple toggle)
  3. platform_feature_defaults[code].state             (operator override)
  4. feature_modules_registry[code].default_state      (declarative default)
  5. 'enabled' (last-resort)

Public functions:
  • resolve_tenant_config(tenant_id) → dict (the full config blob)
  • resolve_modules(tenant_id) → list of {code, state, ...}
  • is_module_enabled(tenant_id, code) → bool

Caching: short-lived in-memory cache (60s) keyed by tenant_id. Invalidated
by `invalidate_tenant_config(tenant_id)`.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

from database import db, db_available

_CACHE_LOCK = threading.RLock()
_CACHE: Dict[str, Any] = {}
_TTL = 60.0


def _now() -> float:
    return time.time()


def invalidate_tenant_config(tenant_id: Optional[str] = None) -> None:
    with _CACHE_LOCK:
        if tenant_id is None:
            _CACHE.clear()
        else:
            for k in [k for k in _CACHE if k.startswith(f"cfg|{tenant_id}")
                      or k.startswith(f"mods|{tenant_id}")]:
                _CACHE.pop(k, None)


def _registry() -> List[Dict[str, Any]]:
    ck = "registry|all"
    with _CACHE_LOCK:
        v = _CACHE.get(ck)
        if v and (_now() - v[0]) < _TTL:
            return v[1]
    if not db_available():
        return []
    rows = (db().table("feature_modules_registry")
            .select("code, display_name, category, description, default_state, "
                    "required_role, position, is_core")
            .order("position").execute().data or [])
    with _CACHE_LOCK:
        _CACHE[ck] = (_now(), rows)
    return rows


def _platform_defaults() -> Dict[str, str]:
    ck = "platform_defaults|all"
    with _CACHE_LOCK:
        v = _CACHE.get(ck)
        if v and (_now() - v[0]) < _TTL:
            return v[1]
    if not db_available():
        return {}
    rows = (db().table("platform_feature_defaults")
            .select("module_code, state").execute().data or [])
    out = {r["module_code"]: r["state"] for r in rows}
    with _CACHE_LOCK:
        _CACHE[ck] = (_now(), out)
    return out


def resolve_tenant_config(tenant_id: str) -> Dict[str, Any]:
    if not tenant_id:
        return {}
    ck = f"cfg|{tenant_id}"
    with _CACHE_LOCK:
        v = _CACHE.get(ck)
        if v and (_now() - v[0]) < _TTL:
            return v[1]
    if not db_available():
        return {}
    rows = (db().table("tenant_configuration").select("*")
            .eq("tenant_id", tenant_id).limit(1).execute().data or [])
    cfg = rows[0] if rows else {"tenant_id": tenant_id}
    with _CACHE_LOCK:
        _CACHE[ck] = (_now(), cfg)
    return cfg


def resolve_modules(tenant_id: str) -> List[Dict[str, Any]]:
    """Return every registered module with its EFFECTIVE state for this tenant."""
    ck = f"mods|{tenant_id}"
    with _CACHE_LOCK:
        v = _CACHE.get(ck)
        if v and (_now() - v[0]) < _TTL:
            return v[1]
    registry = _registry()
    platform = _platform_defaults()
    cfg = resolve_tenant_config(tenant_id) if tenant_id else {}
    tenant_flags = cfg.get("feature_flags") or {}
    tenant_enabled = cfg.get("enabled_modules") or {}

    out: List[Dict[str, Any]] = []
    for m in registry:
        code = m["code"]
        # PRECEDENCE
        state = None
        source = None
        if code in tenant_flags and tenant_flags[code]:
            state = tenant_flags[code]
            source = "tenant_flag"
        elif code in tenant_enabled:
            state = "enabled" if tenant_enabled[code] else "disabled"
            source = "tenant_module_toggle"
        elif code in platform:
            state = platform[code]
            source = "platform_default"
        else:
            state = m["default_state"]
            source = "registry_default"
        # Core modules cannot be fully disabled
        if m.get("is_core") and state == "disabled":
            state = "enabled"
            source = "core_force_enabled"
        out.append({
            **m,
            "effective_state": state,
            "resolution_source": source,
        })
    with _CACHE_LOCK:
        _CACHE[ck] = (_now(), out)
    return out


def is_module_enabled(tenant_id: str, code: str) -> bool:
    for m in resolve_modules(tenant_id):
        if m["code"] == code:
            return m["effective_state"] in ("enabled", "beta")
    return False
