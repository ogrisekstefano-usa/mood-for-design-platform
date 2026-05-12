"""Feature Flags Engine.

Flags can be set globally (in code defaults) and overridden per tenant via
`tenant_settings.key = 'feature_flags'` with JSON `{flag_id: bool}`.
"""
from typing import Dict, List, Any


# ── Flag catalog ─────────────────────────────────────────────────────────────
FLAGS: List[dict] = [
    {"id": "hotspot", "labelKey": "flag.hotspot", "default": True, "scope": "moodboards"},
    {"id": "video_upload", "labelKey": "flag.video_upload", "default": True, "scope": "storage"},
    {"id": "proposal_approvals", "labelKey": "flag.proposal_approvals", "default": True, "scope": "workspace"},
    {"id": "analytics_advanced", "labelKey": "flag.analytics_advanced", "default": False, "scope": "insights"},
    {"id": "ai_suggestions", "labelKey": "flag.ai_suggestions", "default": False, "scope": "global", "beta": True},
    {"id": "public_magazine", "labelKey": "flag.public_magazine", "default": True, "scope": "inspirations"},
    {"id": "lead_forms", "labelKey": "flag.lead_forms", "default": True, "scope": "workspace"},
    {"id": "ad_section", "labelKey": "flag.ad_section", "default": True, "scope": "global"},
    {"id": "crm_integrations", "labelKey": "flag.crm_integrations", "default": False, "scope": "integrations", "enterprise_only": True},
    {"id": "exports", "labelKey": "flag.exports", "default": True, "scope": "global"},
    {"id": "custom_domain", "labelKey": "flag.custom_domain", "default": False, "scope": "branding", "enterprise_only": True},
]
FLAG_INDEX = {f["id"]: f for f in FLAGS}


def get_all_flags() -> List[dict]:
    return FLAGS


def resolve_flags(tenant_overrides: Dict[str, bool]) -> Dict[str, bool]:
    """Return effective flag map for a tenant given DB overrides."""
    return {f["id"]: bool(tenant_overrides.get(f["id"], f["default"])) for f in FLAGS}


def is_enabled(flag_id: str, tenant_overrides: Dict[str, bool]) -> bool:
    if flag_id not in FLAG_INDEX:
        return False
    return bool(tenant_overrides.get(flag_id, FLAG_INDEX[flag_id]["default"]))
