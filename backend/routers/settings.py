from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from middleware.auth import get_current_user
from database import get_db, db_available
from datetime import datetime, timezone

router = APIRouter()


class TenantSettingsUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    feature_flags: Optional[Dict[str, Any]] = None


@router.get("/tenant")
def get_tenant_settings(current_user: dict = Depends(get_current_user)):
    if not db_available():
        return {"id": current_user['tenant_id'], "name": "Demo Studio", "slug": "demo"}
    db = get_db()
    result = db.table('tenants').select('*').eq('id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Tenant not found")
    return result.data[0]


@router.put("/tenant")
def update_tenant_settings(body: TenantSettingsUpdate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    result = db.table('tenants').update(updates).eq('id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Tenant not found")
    return result.data[0]


@router.get("/team")
def get_team(current_user: dict = Depends(get_current_user)):
    if not db_available():
        return {"data": [], "total": 0}
    db = get_db()
    result = db.table('users').select('id,email,full_name,role,avatar_url,is_active,created_at').eq('tenant_id', current_user['tenant_id']).execute()
    return {"data": result.data, "total": len(result.data)}
