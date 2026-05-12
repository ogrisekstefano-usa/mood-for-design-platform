"""Tenant settings router — branding, theme, navigation overrides."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from middleware.auth import require_roles
from database import db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.put("/branding")
def update_branding(body: dict,
                    current_user: dict = Depends(require_roles('tenant_admin', 'super_admin'))):
    """Updates tenant base columns: logo_url, primary_color, secondary_color, fonts."""
    client = db()
    allowed = {'logo_url', 'primary_color', 'secondary_color', 'font_heading', 'font_body', 'name'}
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}
    if not updates:
        raise HTTPException(400, "No valid fields")
    updates['updated_at'] = _now()
    r = client.table('tenants').update(updates).eq('id', current_user['tenant_id']).execute()
    return r.data[0] if r.data else {}


@router.put("/locales")
def update_locales(body: dict,
                   current_user: dict = Depends(require_roles('tenant_admin', 'super_admin'))):
    """Updates tenant default_language and active_languages."""
    client = db()
    allowed = {'default_language', 'active_languages'}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields")
    updates['updated_at'] = _now()
    r = client.table('tenants').update(updates).eq('id', current_user['tenant_id']).execute()
    return r.data[0] if r.data else {}
