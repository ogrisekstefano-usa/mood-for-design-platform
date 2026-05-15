"""Profile — current-user profile read/update + avatar upload.

Phase S.2 — Human-First Tenant Model.

Endpoints:
    GET   /api/profile/me                 → full profile of current user
    PATCH /api/profile/me                 → update editorial fields
    POST  /api/profile/me/avatar          → multipart avatar upload

The avatar is uploaded server-side to Supabase Storage in the
`tenant-assets` bucket under `avatars/{tenant_id}/{profile_id}.{ext}`.
The resulting public URL is stored on `users_profile.avatar_url` and
returned.
"""
from datetime import datetime, timezone
from typing import Optional
import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field
from core.tenant_context import get_tenant_context
from database import db, get_admin_client

router = APIRouter()


ALLOWED_AVATAR_MIME = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
}
MAX_AVATAR_BYTES = 4 * 1024 * 1024  # 4 MB


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _profile_to_public(p: dict) -> dict:
    """Shape returned to the authenticated user themselves — INCLUDES
    role + email since it's the user's own data. Differs from the
    `public_assignee_profile()` used for cross-user exposure."""
    return {
        "id":               p.get("id"),
        "email":            p.get("email"),
        "first_name":       p.get("first_name"),
        "last_name":        p.get("last_name"),
        "role":             p.get("role"),
        "avatar_url":       p.get("avatar_url"),
        "role_label":       p.get("role_label"),
        "short_bio":        p.get("short_bio"),
        "response_time_label": p.get("response_time_label"),
        "contact_cta_label":   p.get("contact_cta_label"),
        "is_introduced":    _is_introduced(p),
    }


def _is_introduced(p: dict) -> bool:
    """An introduction is complete when there is an avatar AND a bio
    AND a role label. These are the three signals the Client Portal
    relies on to show the Human Card."""
    return bool(
        (p.get("avatar_url") or "").strip()
        and (p.get("short_bio") or "").strip()
        and (p.get("role_label") or "").strip()
    )


@router.get("/me")
def get_my_profile(ctx: dict = Depends(get_tenant_context)):
    c = db()
    r = (
        c.table("users_profile")
        .select("id,email,first_name,last_name,role,avatar_url,short_bio,role_label,response_time_label,contact_cta_label")
        .eq("id", ctx["profile_id"]).limit(1).execute()
    )
    if not r.data:
        raise HTTPException(404, "Profile not found.")
    return {"profile": _profile_to_public(r.data[0])}


class ProfilePatch(BaseModel):
    first_name:          Optional[str] = Field(None, max_length=80)
    last_name:           Optional[str] = Field(None, max_length=80)
    role_label:          Optional[str] = Field(None, max_length=80)
    short_bio:           Optional[str] = Field(None, max_length=240)
    response_time_label: Optional[str] = Field(None, max_length=80)
    contact_cta_label:   Optional[str] = Field(None, max_length=80)
    avatar_url:          Optional[str] = Field(None, max_length=1024)


@router.patch("/me")
def update_my_profile(body: ProfilePatch, ctx: dict = Depends(get_tenant_context)):
    """Updates editorial fields on the current user's profile. Email
    and role are intentionally NOT modifiable here — those go through
    the admin members router."""
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(400, "Nothing to update.")
    # Normalize whitespace on text fields
    for k, v in list(payload.items()):
        if isinstance(v, str):
            payload[k] = v.strip()
    payload["updated_at"] = _now()
    c = db()
    c.table("users_profile").update(payload).eq("id", ctx["profile_id"]).execute()
    r = (
        c.table("users_profile")
        .select("id,email,first_name,last_name,role,avatar_url,short_bio,role_label,response_time_label,contact_cta_label")
        .eq("id", ctx["profile_id"]).limit(1).execute()
    )
    return {"profile": _profile_to_public(r.data[0])}


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    ctx: dict = Depends(get_tenant_context),
):
    """Upload an avatar image to Supabase Storage and persist its URL
    on the current user's profile.

    The file lives under `tenant-assets/avatars/{tenant_id}/{profile_id}.{ext}`,
    namespaced by tenant so there is no cross-tenant leakage.
    """
    if file.content_type not in ALLOWED_AVATAR_MIME:
        raise HTTPException(400, "Tipo file non supportato. Usa JPG, PNG, WebP o GIF.")
    content = await file.read()
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(413, "L'immagine supera 4 MB. Comprimi prima di caricare.")
    if len(content) < 256:
        raise HTTPException(400, "File troppo piccolo / vuoto.")

    # Resolve extension from content_type → never trust client filename
    ext_map = {
        "image/jpeg": "jpg", "image/jpg": "jpg",
        "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    }
    ext = ext_map.get(file.content_type, "jpg")
    bucket = "tenant-assets"
    # Append a cache-buster uuid so subsequent uploads don't get cached
    # under the previous URL by browsers / CDNs.
    obj_path = f"avatars/{ctx['tenant_id']}/{ctx['profile_id']}-{uuid.uuid4().hex[:8]}.{ext}"

    admin = get_admin_client()
    if admin is None:
        raise HTTPException(500, "Storage non disponibile.")

    try:
        admin.storage.from_(bucket).upload(
            obj_path, content,
            {"content-type": file.content_type, "x-upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(500, f"Upload fallito: {e}")

    # Public URL — tenant-assets is a public bucket on this project
    # (logos already use it). We rely on Supabase's public URL helper.
    public = admin.storage.from_(bucket).get_public_url(obj_path)
    if isinstance(public, dict):
        url = public.get("publicURL") or public.get("publicUrl")
    else:
        url = public
    if not url or not isinstance(url, str):
        raise HTTPException(500, "Public URL non disponibile.")
    # Strip trailing ? if Supabase added an empty querystring
    url = url.rstrip("?")

    # Persist on the profile
    c = db()
    c.table("users_profile").update({
        "avatar_url": url, "updated_at": _now(),
    }).eq("id", ctx["profile_id"]).execute()

    return {"avatar_url": url}
