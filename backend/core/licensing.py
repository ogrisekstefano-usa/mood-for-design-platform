"""Tenant Licensing Engine — plan defaults, capacity checks, enforcement.

Design notes
─────────────
• Plans are configuration, not schema — adding a plan does NOT require a migration.
• A tenant's row is the source of truth (per-tenant override allowed); plan
  defaults below only seed limits for new tenants.
• `NULL` limit  →  unlimited (used for `enterprise` and ad-hoc super_admin
  overrides).
• Every check raises HTTPException 403 with a STABLE error code that the
  frontend can switch on (e.g. `LICENSE_LIMIT_REACHED`).
"""
from typing import Optional, List, Dict
from fastapi import HTTPException
from database import db

LICENSE_LIMIT_REACHED_CODE = "LICENSE_LIMIT_REACHED"
MODULE_NOT_ENABLED_CODE = "MODULE_NOT_ENABLED"
SUBSCRIPTION_INACTIVE_CODE = "SUBSCRIPTION_INACTIVE"


# ── Default plans (overridable via super_admin per-tenant)──────────────
PLANS: Dict[str, dict] = {
    "starter": {
        "key": "starter",
        "label": "Starter",
        "description": "Solo studio · 3 seats · 10 projects",
        "max_users": 3,
        "max_projects": 10,
        "max_storage_gb": 5.0,
        "max_domains": 1,
        "max_ai_credits": 500,
        "enabled_modules": ["leads", "projects", "proposals", "moodboards", "members"],
    },
    "studio": {
        "key": "studio",
        "label": "Studio",
        "description": "Growing studio · 10 seats · 50 projects",
        "max_users": 10,
        "max_projects": 50,
        "max_storage_gb": 25.0,
        "max_domains": 2,
        "max_ai_credits": 5000,
        "enabled_modules": ["leads", "projects", "proposals", "moodboards", "inspirations",
                            "members", "storefront", "forms"],
    },
    "enterprise": {
        "key": "enterprise",
        "label": "Enterprise",
        "description": "Multi-studio · unlimited",
        "max_users": None,
        "max_projects": None,
        "max_storage_gb": None,
        "max_domains": None,
        "max_ai_credits": None,
        "enabled_modules": ["leads", "projects", "proposals", "moodboards", "inspirations",
                            "members", "storefront", "forms", "ai_translate", "analytics"],
    },
    "custom": {
        "key": "custom",
        "label": "Custom",
        "description": "Bespoke plan assigned by super-admin",
        "max_users": None, "max_projects": None, "max_storage_gb": None,
        "max_domains": None, "max_ai_credits": None,
        "enabled_modules": [],
    },
}

PUBLIC_PLAN_KEYS = ["starter", "studio", "enterprise"]


# ── Tenant license accessor ───────────────────────────────────────────
def get_tenant_license(tenant_id: str) -> dict:
    """Return the effective license for the tenant — DB row first,
    falling back to plan defaults for any NULL columns."""
    client = db()
    r = client.table("tenants").select(
        "id, slug, active_plan, subscription_status, max_users, max_projects, "
        "max_storage_gb, max_domains, max_ai_credits, enabled_modules, "
        "trial_ends_at, billing_cycle, stripe_customer_id, stripe_subscription_id, plan_assigned_at"
    ).eq("id", tenant_id).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    tenant = r.data[0]
    plan_key = tenant.get("active_plan") or "starter"
    plan = PLANS.get(plan_key) or PLANS["starter"]

    # Effective = per-tenant override if not None, else plan default
    def _coalesce(field):
        v = tenant.get(field)
        return v if v is not None else plan.get(field)

    return {
        "tenant_id": tenant["id"],
        "tenant_slug": tenant.get("slug"),
        "plan_key": plan_key,
        "plan_label": plan.get("label", plan_key.title()),
        "subscription_status": tenant.get("subscription_status") or "active",
        "billing_cycle": tenant.get("billing_cycle"),
        "trial_ends_at": tenant.get("trial_ends_at"),
        "stripe_customer_id": tenant.get("stripe_customer_id"),
        "stripe_subscription_id": tenant.get("stripe_subscription_id"),
        "plan_assigned_at": tenant.get("plan_assigned_at"),
        "limits": {
            "max_users":      _coalesce("max_users"),
            "max_projects":   _coalesce("max_projects"),
            "max_storage_gb": _coalesce("max_storage_gb"),
            "max_domains":    _coalesce("max_domains"),
            "max_ai_credits": _coalesce("max_ai_credits"),
        },
        "enabled_modules": tenant.get("enabled_modules") or plan.get("enabled_modules", []),
    }


# ── Usage accessor ────────────────────────────────────────────────────
def get_tenant_usage(tenant_id: str) -> dict:
    """Compute live usage counts. Lightweight — single COUNT queries."""
    client = db()
    users = client.table("users_profile").select("id", count="exact") \
        .eq("tenant_id", tenant_id).neq("status", "suspended").execute()
    projects = client.table("projects").select("id", count="exact") \
        .eq("tenant_id", tenant_id).execute()
    return {
        "users":    users.count or 0,
        "projects": projects.count or 0,
        # Storage + ai_credits will be wired when those metrics exist;
        # exposing 0 keeps the API shape stable for the frontend.
        "storage_gb": 0.0,
        "ai_credits_used": 0,
        "domains": 0,
    }


# ── Enforcement helpers ──────────────────────────────────────────────
def _raise(code: str, message: str, **extra):
    raise HTTPException(403, {"code": code, "message": message, **extra})


def assert_subscription_active(tenant_id: str) -> dict:
    lic = get_tenant_license(tenant_id)
    status = lic["subscription_status"]
    if status in ("active", "trial"):
        return lic
    _raise(SUBSCRIPTION_INACTIVE_CODE,
           f"This workspace is {status}. Reactivate the plan to continue.",
           subscription_status=status, plan=lic["plan_key"])


def assert_module_enabled(tenant_id: str, module_key: str) -> dict:
    lic = assert_subscription_active(tenant_id)
    if module_key not in (lic["enabled_modules"] or []):
        _raise(MODULE_NOT_ENABLED_CODE,
               f"The '{module_key}' module is not included in your plan.",
               plan=lic["plan_key"], module=module_key)
    return lic


def assert_capacity(tenant_id: str, resource: str) -> dict:
    """resource ∈ {'users','projects','domains'}.
    Raises 403 LICENSE_LIMIT_REACHED if usage[resource] >= limit (non-NULL)."""
    lic = assert_subscription_active(tenant_id)
    limit_key = f"max_{resource}"
    limit = lic["limits"].get(limit_key)
    if limit is None:  # unlimited
        return lic
    usage = get_tenant_usage(tenant_id).get(resource, 0)
    if usage >= limit:
        _raise(LICENSE_LIMIT_REACHED_CODE,
               f"Your {lic['plan_label']} plan allows up to {limit} {resource}. "
               f"Upgrade to add more.",
               plan=lic["plan_key"], resource=resource,
               current=usage, limit=limit)
    return lic


# ── Plan administration (super-admin only) ────────────────────────────
def list_plans(public_only: bool = True) -> List[dict]:
    keys = PUBLIC_PLAN_KEYS if public_only else list(PLANS.keys())
    return [PLANS[k] for k in keys if k in PLANS]


def assign_plan(tenant_id: str, plan_key: str, assigned_by: Optional[str] = None,
                override_limits: Optional[dict] = None,
                override_modules: Optional[List[str]] = None) -> dict:
    """Assign a plan to a tenant. By default applies the plan's default limits;
    `override_limits` can pin specific fields, NULL = unlimited."""
    if plan_key not in PLANS:
        raise HTTPException(400, f"Unknown plan: {plan_key}")
    plan = PLANS[plan_key]
    update = {
        "active_plan":     plan_key,
        "plan_assigned_at": "now()",
        "max_users":       plan.get("max_users"),
        "max_projects":    plan.get("max_projects"),
        "max_storage_gb":  plan.get("max_storage_gb"),
        "max_domains":     plan.get("max_domains"),
        "max_ai_credits":  plan.get("max_ai_credits"),
        "enabled_modules": override_modules if override_modules is not None
                           else plan.get("enabled_modules", []),
    }
    if assigned_by:
        update["plan_assigned_by"] = assigned_by
    if override_limits:
        for k, v in override_limits.items():
            if k in update:
                update[k] = v
    # Strip the postgres function placeholder if present (supabase-py doesn't
    # interpret "now()" — let the DB default-trigger column refresh externally).
    update.pop("plan_assigned_at", None)
    client = db()
    client.table("tenants").update(update).eq("id", tenant_id).execute()
    return get_tenant_license(tenant_id)
