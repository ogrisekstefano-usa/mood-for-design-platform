"""ITER144 · Tenant Configuration Resolver™ + Navigation Runtime™.

This is the single source of truth that the rest of the platform consults
for every per-tenant runtime decision.

Public functions
────────────────
  resolve_tenant_config(tenant_id)            → raw tenant_configuration row
  resolve_modules(tenant_id)                  → list of {code, effective_state, …}
  is_module_enabled(tenant_id, code)          → bool
  resolve_navigation(tenant_id, user_role,
                     is_super_admin, is_root) → list of nav groups
  resolve_theme(tenant_id)                    → dict of theme tokens / CSS vars
  resolve_runtime_bundle(tenant_id, …)        → complete bundle for one-shot
                                                frontend boot
  invalidate_tenant_config(tenant_id=None)    → clear cache
"""
from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

from database import db, db_available

_CACHE_LOCK = threading.RLock()
_CACHE: Dict[str, Any] = {}
_TTL = 60.0


# ── visibility hierarchy ────────────────────────────────────────────
# Higher = more powerful. A module with `nav_visibility="tenant_admin"`
# is shown to tenant_admin and everyone above (super_admin, root).
_VISIBILITY_RANK = {
    "public":           0,
    "tenant":           1,
    "tenant_admin":     2,
    "super_admin":      3,
    "root_superadmin":  4,
}


def _now() -> float:
    return time.time()


def invalidate_tenant_config(tenant_id: Optional[str] = None) -> None:
    with _CACHE_LOCK:
        if tenant_id is None:
            _CACHE.clear()
        else:
            for k in [k for k in _CACHE
                      if k.startswith(f"cfg|{tenant_id}")
                      or k.startswith(f"mods|{tenant_id}")
                      or k.startswith(f"nav|{tenant_id}")
                      or k.startswith(f"theme|{tenant_id}")]:
                _CACHE.pop(k, None)


def invalidate_registry() -> None:
    """Clear platform-wide registry / defaults caches.

    Called when blueprint admin patches feature_modules_registry or
    platform_feature_defaults.
    """
    with _CACHE_LOCK:
        for k in [k for k in _CACHE
                  if k.startswith("registry|") or k.startswith("platform_defaults|")]:
            _CACHE.pop(k, None)
        # Per-tenant caches depend on registry → flush them too.
        for k in [k for k in _CACHE
                  if k.startswith("mods|") or k.startswith("nav|")]:
            _CACHE.pop(k, None)


# ── primitive readers ───────────────────────────────────────────────
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
                    "required_role, position, is_core, nav_route, nav_icon, "
                    "nav_group, nav_section_label, nav_visibility, nav_end_match, "
                    "nav_has_mark, nav_test_id, group_position")
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


def resolve_tenant_config(tenant_id: Optional[str]) -> Dict[str, Any]:
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


# ── module resolution (precedence chain) ────────────────────────────
def resolve_modules(tenant_id: Optional[str]) -> List[Dict[str, Any]]:
    """Return every registered module with its EFFECTIVE state for tenant.

    Precedence:
      1. tenant.feature_flags[code]          (tenant override, string state)
      2. tenant.enabled_modules[code]        (tenant simple bool toggle)
      3. platform_feature_defaults[code]     (operator override)
      4. registry.default_state              (declarative default)
    Core modules can never end up `disabled` — they auto-promote.
    """
    ck = f"mods|{tenant_id or 'anon'}"
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


def is_module_enabled(tenant_id: Optional[str], code: str) -> bool:
    for m in resolve_modules(tenant_id):
        if m["code"] == code:
            return m["effective_state"] in ("enabled", "beta")
    return False


# ── role / visibility filter ────────────────────────────────────────
def _user_rank(role: Optional[str], is_super_admin: bool, is_root: bool) -> int:
    if is_root:
        return _VISIBILITY_RANK["root_superadmin"]
    if is_super_admin:
        return _VISIBILITY_RANK["super_admin"]
    if role in ("tenant_admin",):
        return _VISIBILITY_RANK["tenant_admin"]
    if role in ("client",):
        return _VISIBILITY_RANK["public"]
    return _VISIBILITY_RANK["tenant"]


def _module_visible_to(module: Dict[str, Any], rank: int) -> bool:
    state = module.get("effective_state")
    if state in ("hidden", "disabled"):
        return False
    needed = _VISIBILITY_RANK.get(module.get("nav_visibility") or "tenant", 1)
    return rank >= needed


# ── navigation tree ─────────────────────────────────────────────────
def resolve_navigation(tenant_id: Optional[str],
                       user_role: Optional[str],
                       is_super_admin: bool = False,
                       is_root: bool = False) -> List[Dict[str, Any]]:
    """Build the per-user navigation tree.

    Output shape:
      [
        {
          "code": "studio-pulse",
          "label": "Studio Pulse",
          "position": 10,
          "items": [
            {"code":"dashboard","label":"Dashboard","route":"/dashboard",
             "icon":"LayoutDashboard","state":"enabled","has_mark":True,
             "end":True,"test_id":"sidebar-nav-dashboard","visibility":"tenant"},
            …
          ],
        },
        …
      ]

    Modules with `nav_route` set and `nav_group` set are placed inside
    their group. Modules with no `nav_group` are silently skipped (they
    can still be enabled, just not shown in the sidebar).
    """
    cfg = resolve_tenant_config(tenant_id) if tenant_id else {}
    overrides = cfg.get("navigation_overrides") or {}
    # navigation_overrides shape:
    #   {"hide_modules":["editorial_calendar"],
    #    "hide_groups":["content-studio"],
    #    "rename_sections":{"studio-os":"Operations"},
    #    "reorder_groups":{"client-relations":15}}
    hide_modules = set(overrides.get("hide_modules") or [])
    hide_groups  = set(overrides.get("hide_groups") or [])
    rename       = overrides.get("rename_sections") or {}
    regroup_pos  = overrides.get("reorder_groups") or {}

    rank = _user_rank(user_role, is_super_admin, is_root)

    groups: Dict[str, Dict[str, Any]] = {}
    for m in resolve_modules(tenant_id):
        g = m.get("nav_group")
        if not g or not m.get("nav_route"):
            continue
        if g in hide_groups:
            continue
        if m["code"] in hide_modules:
            continue
        if not _module_visible_to(m, rank):
            continue
        if g not in groups:
            groups[g] = {
                "code": g,
                "label": rename.get(g) or m.get("nav_section_label") or g,
                "position": regroup_pos.get(g, m.get("group_position") or 100),
                "items": [],
            }
        groups[g]["items"].append({
            "code":       m["code"],
            "label":      m["display_name"],
            "route":      m["nav_route"],
            "icon":       m.get("nav_icon") or "Circle",
            "state":      m.get("effective_state") or "enabled",
            "end":        bool(m.get("nav_end_match")),
            "has_mark":   bool(m.get("nav_has_mark")),
            "test_id":    m.get("nav_test_id"),
            "visibility": m.get("nav_visibility") or "tenant",
            "position":   m.get("position") or 100,
        })

    # Sort items inside each group
    for g in groups.values():
        g["items"].sort(key=lambda x: (x["position"], x["label"]))
    # Sort groups
    return sorted(groups.values(), key=lambda g: (g["position"], g["label"]))


# ── theme tokens ────────────────────────────────────────────────────
_THEME_DEFAULTS = {
    "logo_url":         None,
    "monogram":         "M",
    "font_heading":     "Cormorant Garamond",
    "font_body":        "Inter",
    "color_primary":    "#7ce4f5",
    "color_secondary":  "#e8ebf0",
    "color_canvas":     "#050608",
    "radius_scale":     "soft",
    "glass_intensity":  "medium",
}


def resolve_theme(tenant_id: Optional[str]) -> Dict[str, Any]:
    """Return the merged branding/theme tokens for a tenant.

    Frontend turns these into CSS variables (`--mfd-color-primary`,
    `--mfd-font-heading`, …). Unset values fall back to the defaults
    above so the frontend never sees `null`.
    """
    ck = f"theme|{tenant_id or 'default'}"
    with _CACHE_LOCK:
        v = _CACHE.get(ck)
        if v and (_now() - v[0]) < _TTL:
            return v[1]
    cfg = resolve_tenant_config(tenant_id) if tenant_id else {}
    branding = cfg.get("branding") or {}
    typography = cfg.get("typography_preset")
    out = dict(_THEME_DEFAULTS)
    # Legacy tenant_configuration columns first (so branding wins over them).
    if cfg.get("primary_color"):
        out["color_primary"] = cfg["primary_color"]
    if cfg.get("secondary_color"):
        out["color_secondary"] = cfg["secondary_color"]
    if typography:
        out["typography_preset"] = typography
    # branding JSONB has the highest precedence (this is where the new
    # ITER144 tenant_admin UI writes).
    for k, v in branding.items():
        if v:
            out[k] = v
    with _CACHE_LOCK:
        _CACHE[ck] = (_now(), out)
    return out


# ── one-shot bundle for frontend boot ───────────────────────────────
def resolve_runtime_bundle(tenant_id: Optional[str],
                           user_role: Optional[str] = None,
                           is_super_admin: bool = False,
                           is_root: bool = False) -> Dict[str, Any]:
    cfg = resolve_tenant_config(tenant_id) if tenant_id else {}
    modules = resolve_modules(tenant_id)
    return {
        "tenant_id":    tenant_id,
        "configuration": {
            "primary_color":          cfg.get("primary_color"),
            "secondary_color":        cfg.get("secondary_color"),
            "typography_preset":      cfg.get("typography_preset"),
            "homepage_variant":       cfg.get("homepage_variant"),
            "editorial_tone":         cfg.get("editorial_tone"),
            "enabled_locales":        cfg.get("enabled_locales") or [],
            "default_locale":         cfg.get("default_locale"),
            "onboarding_mode":        cfg.get("onboarding_mode"),
            "design_journey_variant": cfg.get("design_journey_variant"),
            "cta_style":              cfg.get("cta_style"),
            "custom_domain":          cfg.get("custom_domain"),
            "feature_flags":          cfg.get("feature_flags") or {},
            "enabled_modules":        cfg.get("enabled_modules") or {},
        },
        "theme":      resolve_theme(tenant_id),
        "modules":    [{
            "code":          m["code"],
            "display_name":  m["display_name"],
            "category":      m["category"],
            "state":         m["effective_state"],
            "source":        m["resolution_source"],
            "visibility":    m.get("nav_visibility") or "tenant",
            "is_core":       bool(m.get("is_core")),
            "route":         m.get("nav_route"),
        } for m in modules],
        "navigation": resolve_navigation(tenant_id, user_role,
                                         is_super_admin, is_root),
    }
