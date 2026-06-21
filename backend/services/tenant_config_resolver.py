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

import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from database import db, db_available

log = logging.getLogger(__name__)

_CACHE_LOCK = threading.RLock()
_CACHE: Dict[str, Any] = {}
_TTL = 60.0

# ITER146 · Core Module Safety™ — states that are NOT operationally usable.
# A `is_core_critical` module must NEVER end up in any of these states.
NON_OPERATIONAL_STATES = frozenset({
    "disabled", "hidden", "locked", "coming_soon", "beta_restricted",
})
OPERATIONAL_STATES = frozenset({"enabled", "beta"})


def _log_core_critical_event(*, code: str, attempted_state: str,
                              attempted_source: str, action: str,
                              actor: Optional[Dict[str, Any]] = None,
                              tenant_id: Optional[str] = None) -> None:
    """Best-effort audit log for any core-critical safety event.

    `action` is one of:
      - `resolver_auto_force`      (state silently promoted to enabled)
      - `mutation_blocked`         (PATCH rejected at API layer)
    """
    log.warning(
        "core_critical_safety event=%s code=%s attempted_state=%s "
        "attempted_source=%s tenant_id=%s actor=%s",
        action, code, attempted_state, attempted_source,
        tenant_id, (actor or {}).get("email"),
    )
    if not db_available():
        return
    try:
        db().table("configuration_change_events").insert({
            "id":            str(uuid.uuid4()),
            "tenant_id":     tenant_id,
            "actor_user_id": (actor or {}).get("profile_id"),
            "actor_email":   (actor or {}).get("email"),
            "event_type":    f"core_critical.{action}",
            "scope":         "platform" if action == "resolver_auto_force"
                              else "tenant",
            "source":        attempted_source or "resolver",
            "module_code":   code,
            "diff_before":   {"attempted_state": attempted_state},
            "diff_after":    {"effective_state": "enabled"},
            "notes":         (f"Core-critical module '{code}' protected against "
                              f"non-operational state '{attempted_state}'."),
            "created_at":    datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:  # never block on audit failure
        log.warning("core_critical audit insert failed: %s", e)


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
                    "required_role, position, is_core, is_core_critical, "
                    "nav_route, nav_icon, "
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
        # ITER146 · Core Module Safety™ — critical modules are runtime
        # essentials. Any non-operational state coming from ANY source
        # is auto-promoted to `enabled` and logged as a safety event.
        # This check runs BEFORE the softer is_core legacy fallback so
        # the structured `core_critical_force_enabled` source wins.
        if m.get("is_core_critical") and state not in ("enabled", "beta"):
            _log_core_critical_event(
                code=code,
                attempted_state=state,
                attempted_source=source,
                action="resolver_auto_force",
            )
            state = "enabled"
            source = "core_critical_force_enabled"
        elif m.get("is_core") and state == "disabled":
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


def is_core_critical(code: str) -> bool:
    """ITER146 · Core Module Safety™ — registry lookup."""
    for m in _registry():
        if m["code"] == code:
            return bool(m.get("is_core_critical"))
    return False


def list_core_critical_codes() -> List[str]:
    """ITER146 · canonical list (used by tests / UI)."""
    return [m["code"] for m in _registry() if m.get("is_core_critical")]


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


# ── STORE MODE™ curated navigation (STORE-001 · refactor IA SHOWROOM/KNOWLEDGE/GROWTH/STUDIO) ──
# Quando tenant_configuration.is_store_mode=TRUE la sidebar mostra
# esclusivamente queste 14 surface, raccontando lo storytelling del
# Design Sales Operating System™:
#   SHOWROOM   → converti un cliente in un progetto chiuso
#   KNOWLEDGE  → il cervello digitale dello showroom
#   GROWTH    → visibilità internazionale & lead generation
#   STUDIO    → risorse interne dello studio
#
# - NESSUN modulo viene rimosso dalla registry.
# - NESSUNA route del frontend viene cancellata.
# - Gating puramente di visibilità (sidebar runtime).
STORE_NAVIGATION_TREE: List[Dict[str, Any]] = [
    {
        "code": "showroom",
        "label": "Showroom",
        "position": 10,
        "items": [
            {"code": "dashboard",          "label": "Dashboard",
             "route": "/dashboard",                 "icon": "LayoutDashboard",
             "test_id": "sidebar-nav-dashboard",          "position": 10},
            {"code": "client_relations",   "label": "Client Relations",
             "route": "/relations/accounts",        "icon": "Users",
             "test_id": "sidebar-nav-client-relations",   "position": 20},
            {"code": "design_journeys",    "label": "Design Journeys",
             "route": "/workspace/projects",        "icon": "Compass",
             "test_id": "sidebar-nav-design-journeys",    "position": 30},
            {"code": "partner_network",    "label": "Partner Network",
             "route": "/partner-network",            "icon": "Network",
             "test_id": "sidebar-nav-partner-network",    "position": 35},
            {"code": "moodboards",         "label": "Moodboards",
             "route": "/moodboards",                "icon": "Image",
             "test_id": "sidebar-nav-moodboards",         "position": 40},
            {"code": "material_boards",    "label": "Material Boards",
             "route": "/material-boards",           "icon": "Palette",
             "test_id": "sidebar-nav-material-boards",    "position": 50},
            {"code": "specifications",     "label": "Specifications",
             "route": "/specifications",            "icon": "FileText",
             "test_id": "sidebar-nav-specifications",     "position": 60},
            {"code": "project_stories",    "label": "Project Stories",
             "route": "/project-stories",           "icon": "Sparkles",
             "test_id": "sidebar-nav-project-stories",    "position": 70},
        ],
    },
    {
        "code": "knowledge",
        "label": "Knowledge",
        "position": 20,
        "items": [
            {"code": "brand_atlas",        "label": "Brand Atlas",
             "route": "/inspirations/brands",       "icon": "BookOpen",
             "test_id": "sidebar-nav-brand-atlas",        "position": 10},
            {"code": "knowledge_engine",   "label": "Knowledge Engine",
             "route": "/inspirations/knowledge-engine", "icon": "Brain",
             "test_id": "sidebar-nav-knowledge-engine",   "position": 20},
        ],
    },
    {
        "code": "growth",
        "label": "Growth",
        "position": 30,
        "items": [
            {"code": "magazine",           "label": "Magazine",
             "route": "/settings/magazine",            "icon": "BookOpen",
             "test_id": "sidebar-nav-magazine",              "position": 5},
            {"code": "content_studio",     "label": "Content Studio",
             "route": "/blueprint/editorial",       "icon": "PenLine",
             "test_id": "sidebar-nav-content-studio",     "position": 10},
            {"code": "editorial_calendar", "label": "Editorial Calendar",
             "route": "/blueprint/editorial-calendar", "icon": "CalendarDays",
             "test_id": "sidebar-nav-editorial-calendar", "position": 20},
        ],
    },
    {
        "code": "studio",
        "label": "Studio",
        "position": 40,
        "items": [
            {"code": "media_library",      "label": "Media Library",
             "route": "/library",                   "icon": "Library",
             "test_id": "sidebar-nav-media-library",      "position": 10},
            {"code": "calendar",           "label": "Calendar",
             "route": "/workspace/calendar",        "icon": "Calendar",
             "test_id": "sidebar-nav-calendar",            "position": 20},
            {"code": "settings_workspace", "label": "Workspace Settings",
             "route": "/settings",                  "icon": "Settings",
             "test_id": "sidebar-nav-settings",           "position": 30},
        ],
    },
]


def _store_navigation_tree() -> List[Dict[str, Any]]:
    """Return a deep copy of STORE_NAVIGATION_TREE annotated with the
    runtime fields the frontend Sidebar expects.
    """
    out: List[Dict[str, Any]] = []
    for g in STORE_NAVIGATION_TREE:
        items = [dict(it, state="enabled", end=False, has_mark=False,
                      visibility="tenant") for it in g["items"]]
        out.append({"code": g["code"], "label": g["label"],
                    "position": g["position"], "items": items})
    return out


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

    # STORE-001 · STORE MODE™
    # When the tenant is flagged is_store_mode=True (default for showroom
    # tenants), return the curated 11-surface navigation regardless of
    # the modules registry. Tenants without a configuration row default
    # to TRUE (DB column NOT NULL DEFAULT TRUE). Platform governance
    # remains accessible via the separate /admin/* surfaces.
    if bool(cfg.get("is_store_mode", True)):
        return _store_navigation_tree()

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
    branding = (cfg.get("branding") or {})
    # Also surface tenant.name and logo_url as canonical brand_name/logo so
    # the frontend can apply favicon + tab title without further fetch.
    tenant_row = None
    if tenant_id:
        try:
            r = db().table("tenants").select("name, logo_url").eq("id", tenant_id).limit(1).execute().data
            tenant_row = r[0] if r else None
        except Exception:
            tenant_row = None
    brand_block = {
        "brand_name":  branding.get("brand_name") or (tenant_row and tenant_row.get("name")),
        "tagline":     branding.get("tagline"),
        "logo_url":    branding.get("logo_url") or (tenant_row and tenant_row.get("logo_url")),
        "favicon_url": branding.get("favicon_url") or branding.get("logo_url"),
    }
    return {
        "tenant_id":    tenant_id,
        "is_store_mode": bool(cfg.get("is_store_mode", True)),
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
        "branding":   brand_block,
        "modules":    [{
            "code":          m["code"],
            "display_name":  m["display_name"],
            "category":      m["category"],
            "state":         m["effective_state"],
            "source":        m["resolution_source"],
            "visibility":    m.get("nav_visibility") or "tenant",
            "is_core":          bool(m.get("is_core")),
            "is_core_critical": bool(m.get("is_core_critical")),
            "route":            m.get("nav_route"),
        } for m in modules],
        "navigation": resolve_navigation(tenant_id, user_role,
                                         is_super_admin, is_root),
    }
