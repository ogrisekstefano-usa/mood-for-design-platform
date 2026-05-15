"""Blueprint Module Registry.

Each module has metadata and is gated by permissions + tenant enabled-state.
Frontend reads this to render only modules the current user/tenant has access to.
"""
from typing import Dict, List, Optional
from core.permissions import (
    P_LEADS_READ, P_PROJECTS_READ, P_PROPOSALS_READ, P_MOODBOARDS_READ,
    P_INSPIRATIONS_READ, P_INSIGHTS_READ, P_TENANT_SETTINGS,
    P_SUPER_TENANTS_READ, P_STORAGE_READ,
)


MODULES: List[dict] = [
    {
        "id": "workspace",
        "labelKey": "module.workspace",
        "icon": "Briefcase",
        "description": "Leads, Projects, Proposals, Client Portal — integrated.",
        "default_enabled": True,
        "enterprise_only": False,
        "requires_permissions": [P_PROJECTS_READ, P_LEADS_READ, P_PROPOSALS_READ],
        "routes": [
            {"to": "/workspace/leads", "icon": "Users", "labelKey": "nav.leads", "requires": [P_LEADS_READ]},
            {"to": "/workspace/projects", "icon": "FolderOpen", "labelKey": "nav.projects", "requires": [P_PROJECTS_READ]},
            {"to": "/workspace/proposals", "icon": "FileText", "labelKey": "nav.proposals", "requires": [P_PROPOSALS_READ]},
        ],
    },
    {
        "id": "moodboards",
        "labelKey": "module.moodboards",
        "icon": "Layers",
        "description": "Premium drag & drop moodboard editor with versioning.",
        "default_enabled": True,
        "enterprise_only": False,
        "requires_permissions": [P_MOODBOARDS_READ],
        "routes": [{"to": "/moodboards", "icon": "Layers", "labelKey": "nav.moodboards", "requires": [P_MOODBOARDS_READ]}],
    },
    {
        "id": "inspirations",
        "labelKey": "module.inspirations",
        "icon": "BookOpen",
        "description": "Magazine CMS, editorial publishing.",
        "default_enabled": True,
        "enterprise_only": False,
        "requires_permissions": [P_INSPIRATIONS_READ],
        "routes": [{"to": "/inspirations", "icon": "BookOpen", "labelKey": "nav.inspirations", "requires": [P_INSPIRATIONS_READ]}],
    },
    {
        "id": "library",
        "labelKey": "module.library",
        "icon": "Archive",
        "description": "Media Library + Material Registry — operational asset layer.",
        "default_enabled": True,
        "enterprise_only": False,
        "requires_permissions": [P_STORAGE_READ],
        "routes": [
            {"to": "/library", "icon": "Archive", "labelKey": "nav.library", "requires": [P_STORAGE_READ]},
            {"to": "/library/materials", "icon": "Gem", "labelKey": "nav.materials", "requires": [P_STORAGE_READ]},
        ],
    },
    {
        "id": "insights",
        "labelKey": "module.insights",
        "icon": "BarChart3",
        "description": "Analytics, funnels, conversion intelligence.",
        "default_enabled": True,
        "enterprise_only": False,
        "requires_permissions": [P_INSIGHTS_READ],
        "routes": [{"to": "/insights", "icon": "BarChart3", "labelKey": "nav.insights", "requires": [P_INSIGHTS_READ]}],
    },
    {
        "id": "concierge",
        "labelKey": "module.concierge",
        "icon": "BellRing",
        "description": "Premium service & sourcing layer (future).",
        "default_enabled": False,
        "enterprise_only": True,
        "requires_permissions": [],
        "routes": [],
    },
]


MODULE_INDEX: Dict[str, dict] = {m["id"]: m for m in MODULES}


def get_all_modules() -> List[dict]:
    return MODULES


def get_module(module_id: str) -> Optional[dict]:
    return MODULE_INDEX.get(module_id)


def default_enabled_modules() -> List[str]:
    return [m["id"] for m in MODULES if m["default_enabled"]]
