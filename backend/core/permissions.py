"""Centralized Permissions Engine.

Permissions are declared as `resource:action` strings.
Roles map to a set of permissions. UI and API gates query this module.
"""
from typing import Set, Dict, List


# ── Permission catalog ───────────────────────────────────────────────────────
# Workspace
P_LEADS_READ = "leads:read"
P_LEADS_WRITE = "leads:write"
P_LEADS_DELETE = "leads:delete"
P_PROJECTS_READ = "projects:read"
P_PROJECTS_WRITE = "projects:write"
P_PROJECTS_DELETE = "projects:delete"
P_PROPOSALS_READ = "proposals:read"
P_PROPOSALS_WRITE = "proposals:write"
P_PROPOSALS_APPROVE = "proposals:approve"
P_PROPOSALS_DELETE = "proposals:delete"
P_MOODBOARDS_READ = "moodboards:read"
P_MOODBOARDS_WRITE = "moodboards:write"
P_MOODBOARDS_DELETE = "moodboards:delete"

# Content / CMS
P_INSPIRATIONS_READ = "inspirations:read"
P_INSPIRATIONS_WRITE = "inspirations:write"
P_INSPIRATIONS_PUBLISH = "inspirations:publish"

# Analytics
P_INSIGHTS_READ = "insights:read"

# Tenant settings
P_TENANT_BRANDING = "tenant:branding"
P_TENANT_LOCALES = "tenant:locales"
P_TENANT_SETTINGS = "tenant:settings"
P_TENANT_MEMBERS_READ = "tenant:members:read"
P_TENANT_MEMBERS_WRITE = "tenant:members:write"

# Storage
P_STORAGE_READ = "storage:read"
P_STORAGE_WRITE = "storage:write"

# Super-admin (cross-tenant)
P_SUPER_TENANTS_READ = "super:tenants:read"
P_SUPER_TENANTS_WRITE = "super:tenants:write"
P_SUPER_TENANTS_DELETE = "super:tenants:delete"
P_SUPER_MODULES = "super:modules"
P_SUPER_FEATURES = "super:features"
P_SUPER_IMPERSONATE = "super:impersonate"
P_SUPER_ANALYTICS = "super:analytics"


# ── Role → permissions ──────────────────────────────────────────────────────
_TENANT_FULL: Set[str] = {
    P_LEADS_READ, P_LEADS_WRITE, P_LEADS_DELETE,
    P_PROJECTS_READ, P_PROJECTS_WRITE, P_PROJECTS_DELETE,
    P_PROPOSALS_READ, P_PROPOSALS_WRITE, P_PROPOSALS_APPROVE, P_PROPOSALS_DELETE,
    P_MOODBOARDS_READ, P_MOODBOARDS_WRITE, P_MOODBOARDS_DELETE,
    P_INSPIRATIONS_READ, P_INSPIRATIONS_WRITE, P_INSPIRATIONS_PUBLISH,
    P_INSIGHTS_READ,
    P_TENANT_BRANDING, P_TENANT_LOCALES, P_TENANT_SETTINGS,
    P_TENANT_MEMBERS_READ, P_TENANT_MEMBERS_WRITE,
    P_STORAGE_READ, P_STORAGE_WRITE,
}

ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "super_admin": _TENANT_FULL | {
        P_SUPER_TENANTS_READ, P_SUPER_TENANTS_WRITE, P_SUPER_TENANTS_DELETE,
        P_SUPER_MODULES, P_SUPER_FEATURES, P_SUPER_IMPERSONATE, P_SUPER_ANALYTICS,
    },
    "tenant_admin": _TENANT_FULL,
    "editor": {
        P_LEADS_READ, P_LEADS_WRITE,
        P_PROJECTS_READ, P_PROJECTS_WRITE,
        P_PROPOSALS_READ, P_PROPOSALS_WRITE,
        P_MOODBOARDS_READ, P_MOODBOARDS_WRITE,
        P_INSPIRATIONS_READ, P_INSPIRATIONS_WRITE, P_INSPIRATIONS_PUBLISH,
        P_INSIGHTS_READ, P_STORAGE_READ, P_STORAGE_WRITE,
    },
    "analyst": {
        P_LEADS_READ, P_PROJECTS_READ, P_PROPOSALS_READ,
        P_MOODBOARDS_READ, P_INSPIRATIONS_READ, P_INSIGHTS_READ,
    },
    "project_manager": {
        P_LEADS_READ, P_LEADS_WRITE,
        P_PROJECTS_READ, P_PROJECTS_WRITE,
        P_PROPOSALS_READ, P_PROPOSALS_WRITE, P_PROPOSALS_APPROVE,
        P_MOODBOARDS_READ, P_INSIGHTS_READ,
        P_STORAGE_READ, P_STORAGE_WRITE,
    },
    "designer": {
        P_PROJECTS_READ,
        P_MOODBOARDS_READ, P_MOODBOARDS_WRITE,
        P_PROPOSALS_READ,
        P_STORAGE_READ, P_STORAGE_WRITE,
    },
    "client": {P_PROJECTS_READ, P_PROPOSALS_READ, P_PROPOSALS_APPROVE, P_MOODBOARDS_READ},
    "ad_partner": {P_PROJECTS_READ, P_MOODBOARDS_READ, P_INSPIRATIONS_READ},
}


def has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role or "", set())


def get_role_permissions(role: str) -> List[str]:
    return sorted(ROLE_PERMISSIONS.get(role or "", set()))


def is_super_admin(role: str) -> bool:
    return role == "super_admin"
