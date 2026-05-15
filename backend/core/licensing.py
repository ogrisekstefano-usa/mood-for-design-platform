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
• Usage queries are SERVER-FIRST and exclude soft-deleted rows.
"""
from typing import Optional, List, Dict
from fastapi import HTTPException
from database import db

LICENSE_LIMIT_REACHED_CODE = "LICENSE_LIMIT_REACHED"
MODULE_NOT_ENABLED_CODE = "MODULE_NOT_ENABLED"
SUBSCRIPTION_INACTIVE_CODE = "SUBSCRIPTION_INACTIVE"


# ── Default plans (overridable via super_admin per-tenant)──────────────
# Feb 2026 pricing — confirmed by product owner.
# All numeric limits are nullable elsewhere: NULL = unlimited.
PLANS: Dict[str, dict] = {
    "starter": {
        "key": "starter",
        "label": "Starter",
        "description": "Solo studio · 3 seats · 5 projects · 15 moodboards",
        "max_users": 3,
        "max_projects": 5,
        "max_moodboards": 15,
        "max_storage_gb": 5.0,
        "max_domains": 1,
        "max_ai_credits": 500,
        "enabled_modules": ["leads", "projects", "proposals", "moodboards", "members"],
    },
    "studio": {
        "key": "studio",
        "label": "Studio",
        "description": "Growing studio · 10 seats · 25 projects · 100 moodboards",
        "max_users": 10,
        "max_projects": 25,
        "max_moodboards": 100,
        "max_storage_gb": 50.0,
        "max_domains": 3,
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
        "max_moodboards": None,
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
        "max_users": None, "max_projects": None, "max_moodboards": None,
        "max_storage_gb": None, "max_domains": None, "max_ai_credits": None,
        "enabled_modules": [],
    },
}

PUBLIC_PLAN_KEYS = ["starter", "studio", "enterprise"]

# Conversion constant for storage math — kept here so both usage calc
# and capacity check use the exact same denominator.
BYTES_PER_GB = 1024 ** 3


# ── Tenant license accessor ───────────────────────────────────────────
def get_tenant_license(tenant_id: str) -> dict:
    """Return the effective license for the tenant — DB row first,
    falling back to plan defaults for any NULL columns."""
    client = db()
    r = client.table("tenants").select(
        "id, slug, active_plan, subscription_status, max_users, max_projects, "
        "max_moodboards, max_storage_gb, max_domains, max_ai_credits, enabled_modules, "
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
            "max_moodboards": _coalesce("max_moodboards"),
            "max_storage_gb": _coalesce("max_storage_gb"),
            "max_domains":    _coalesce("max_domains"),
            "max_ai_credits": _coalesce("max_ai_credits"),
        },
        "enabled_modules": tenant.get("enabled_modules") or plan.get("enabled_modules", []),
    }


# ── Usage accessors (real, server-first) ──────────────────────────────
def _count(client, table: str, tenant_id: str, *, soft_delete_col: Optional[str] = None,
           archived_col: Optional[str] = None, extra_filter: Optional[Dict] = None) -> int:
    """Count rows for a tenant, excluding soft-deleted/archived if applicable.
    Falls back to 0 if the table or column doesn't exist yet (resilient
    against partial-migration dev environments)."""
    try:
        q = client.table(table).select("id", count="exact").eq("tenant_id", tenant_id)
        if soft_delete_col:
            q = q.is_(soft_delete_col, None)
        if archived_col:
            q = q.is_(archived_col, None)
        if extra_filter:
            for k, v in extra_filter.items():
                q = q.eq(k, v)
        return q.execute().count or 0
    except Exception:
        return 0


def _storage_bytes(client, tenant_id: str) -> int:
    """Sum file_size across media_library for the tenant.
    Future: replace with materialized aggregate or Supabase Storage metadata
    once the platform grows past ~50k assets per tenant."""
    try:
        # supabase-py has no SUM aggregate — pull file_size in pages.
        # For tenants under ~10k assets this is fast (single round-trip).
        r = client.table("media_library").select("file_size") \
            .eq("tenant_id", tenant_id).limit(50000).execute()
        return sum(int(row.get("file_size") or 0) for row in (r.data or []))
    except Exception:
        return 0


def get_tenant_usage(tenant_id: str) -> dict:
    """Compute live usage counts. Lightweight — single COUNT queries.
    Returns the exact shape the frontend's UsageMeter expects."""
    client = db()
    # Users — only ACTIVE/INVITED count toward seats (suspended don't bill)
    try:
        users = client.table("users_profile").select("id", count="exact") \
            .eq("tenant_id", tenant_id).neq("status", "suspended").execute().count or 0
    except Exception:
        users = 0
    projects   = _count(client, "projects", tenant_id)
    moodboards = _count(client, "moodboards", tenant_id, soft_delete_col="deleted_at")
    storage_b  = _storage_bytes(client, tenant_id)
    # Domains usage = ONLY custom domains (subdomains are free)
    domains    = _count(client, "tenant_domains", tenant_id,
                        soft_delete_col="deleted_at",
                        extra_filter={"domain_type": "custom"})
    return {
        "users":          users,
        "projects":       projects,
        "moodboards":     moodboards,
        "storage_gb":     round(storage_b / BYTES_PER_GB, 3),
        "storage_bytes":  storage_b,
        "ai_credits_used": 0,
        "domains":        domains,
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


def assert_capacity(tenant_id: str, resource: str, *, additional: int = 1) -> dict:
    """Generic capacity gate.

    resource ∈ {'users', 'projects', 'moodboards', 'domains'} — counted with COUNT.
    Raises 403 LICENSE_LIMIT_REACHED if `(usage + additional) > limit` (limit not NULL).
    Pre-flight checks pass `additional=N` to reserve N slots in one shot.
    """
    lic = assert_subscription_active(tenant_id)
    limit_key = f"max_{resource}"
    limit = lic["limits"].get(limit_key)
    if limit is None:  # unlimited
        return lic
    usage = get_tenant_usage(tenant_id).get(resource, 0)
    if usage + max(0, additional - 1) >= limit:
        _raise(LICENSE_LIMIT_REACHED_CODE,
               f"Your {lic['plan_label']} plan allows up to {limit} {resource}. "
               f"Upgrade to add more.",
               plan=lic["plan_key"], resource=resource,
               current=usage, limit=limit)
    return lic


def assert_storage_capacity(tenant_id: str, additional_bytes: int = 0) -> dict:
    """Storage-specific gate.

    Pass `additional_bytes` for the file the user is about to upload — the
    check raises if (current + new) would exceed `max_storage_gb`. When
    `additional_bytes=0` it behaves like a soft "are we already over?" check.
    """
    lic = assert_subscription_active(tenant_id)
    limit_gb = lic["limits"].get("max_storage_gb")
    if limit_gb is None:
        return lic
    usage = get_tenant_usage(tenant_id)
    new_bytes = (usage.get("storage_bytes") or 0) + max(0, int(additional_bytes or 0))
    new_gb = new_bytes / BYTES_PER_GB
    if new_gb > float(limit_gb):
        _raise(LICENSE_LIMIT_REACHED_CODE,
               f"Your {lic['plan_label']} plan includes up to {limit_gb} GB of storage. "
               f"This upload would put you at {new_gb:.2f} GB. Upgrade to continue.",
               plan=lic["plan_key"], resource="storage_gb",
               current=round(new_bytes / BYTES_PER_GB, 3),
               limit=float(limit_gb))
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
        "max_users":       plan.get("max_users"),
        "max_projects":    plan.get("max_projects"),
        "max_moodboards":  plan.get("max_moodboards"),
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
    client = db()
    client.table("tenants").update(update).eq("id", tenant_id).execute()
    return get_tenant_license(tenant_id)
