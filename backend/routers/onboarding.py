"""Onboarding router — public/anonymous endpoints that turn a completed
onboarding payload + email + password into a fully populated workspace.

Two entry points:
  • POST /api/onboarding/private/submit      — private client wizard
  • POST /api/onboarding/professional/submit — A&D professional intake

Both perform an atomic sequence:
  1. Create the auth user via Supabase admin API (email_confirm=True)
  2. Create users_profile row in the demo tenant with role='client' or 'ad_partner'
  3. Run core.workspace_genesis.generate(...) to create the lead, project,
     moodboard, pages, and assignment.
  4. Sign in (password grant) to return a session.

Rollback: on any failure mid-flow we attempt to clean up the auth user.

The whole sequence is short (<2s) and the cinematic loading overlay on the
frontend keeps the user in narrative state during this time.
"""
import logging
import os
import uuid
import re
import requests
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from database import db, SUPABASE_URL, SUPABASE_ANON_KEY
from core import workspace_genesis

logger = logging.getLogger(__name__)
router = APIRouter()

NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731

# Demo tenant — single source of truth for the public storefront.
DEMO_TENANT_SLUG = "mood-demo-studio-81a09e"


class OnboardingSubmitBody(BaseModel):
    """Payload accepted by both /private/submit and /professional/submit."""
    first_name: str = Field(min_length=1, max_length=100)
    last_name:  Optional[str] = None
    email:      EmailStr
    password:   str = Field(min_length=8, max_length=128)
    locale:     str = "it"
    # Free-form onboarding answers (mood, style, materials, timeline, budget…)
    payload:    Dict[str, Any] = Field(default_factory=dict)


def _password_grant(email: str, password: str) -> Dict[str, Any]:
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    r = requests.post(url, json={"email": email, "password": password},
                      headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                      timeout=15)
    if r.status_code != 200:
        raise HTTPException(500, "Could not start session after onboarding")
    return r.json()


def _resolve_demo_tenant() -> str:
    client = db()
    t = client.table("tenants").select("id").eq("slug", DEMO_TENANT_SLUG).limit(1).execute()
    if not t.data:
        raise HTTPException(503, "Demo tenant not configured")
    return t.data[0]["id"]


def _create_account(email: str, password: str, first: str, last: Optional[str],
                    tenant_id: str, role: str) -> Dict[str, Any]:
    """Create auth user + users_profile in the given tenant. Returns the new profile."""
    client = db()
    email = email.lower().strip()
    # 1. Auth user
    try:
        admin_resp = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"first_name": first, "last_name": last},
        })
        auth_user = admin_resp.user
        if not auth_user:
            raise HTTPException(500, "Could not create auth user")
        auth_user_id = auth_user.id
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "already" in msg or "duplicate" in msg or "registered" in msg or "exists" in msg:
            raise HTTPException(409, "Email already registered")
        logger.error(f"onboarding admin.create_user error: {e}")
        raise HTTPException(500, f"Account creation failed: {e}")

    # 2. Profile row
    profile_id = str(uuid.uuid4())
    now = NOW()
    try:
        client.table("users_profile").insert({
            "id": profile_id,
            "auth_user_id": auth_user_id,
            "tenant_id": tenant_id,
            "email": email,
            "first_name": first,
            "last_name": last,
            "role": role,
            "status": "active",
            "metadata_json": {"acquired_via": "storefront_wizard"},
            "created_at": now, "updated_at": now,
        }).execute()
    except Exception as e:
        try: client.auth.admin.delete_user(auth_user_id)
        except Exception: pass
        raise HTTPException(500, f"Profile creation failed: {e}")

    return {
        "id": profile_id,
        "auth_user_id": auth_user_id,
        "tenant_id": tenant_id,
        "email": email,
        "first_name": first,
        "last_name": last,
        "role": role,
    }


@router.post("/private/submit", status_code=201)
def submit_private(body: OnboardingSubmitBody):
    """Private client onboarding — creates a client account + workspace shell."""
    tenant_id = _resolve_demo_tenant()
    profile = _create_account(
        body.email, body.password, body.first_name, body.last_name,
        tenant_id=tenant_id, role="client",
    )
    payload = {**body.payload, "first_name": body.first_name, "last_name": body.last_name, "email": profile["email"]}
    try:
        genesis = workspace_genesis.generate(
            tenant_id=tenant_id,
            profile_id=profile["id"],
            payload=payload,
            locale=body.locale,
            lead_type="private_client",
        )
    except Exception as e:
        logger.error(f"workspace_genesis failure: {e}")
        # Don't rollback the account — the user can log in and retry from inside.
        raise HTTPException(500, f"Workspace genesis failed: {e}")

    session = _password_grant(profile["email"], body.password)
    return {
        "session": {
            "access_token": session["access_token"],
            "refresh_token": session.get("refresh_token"),
            "expires_at": session.get("expires_at"),
        },
        "user": profile,
        "genesis": genesis,
    }


@router.post("/professional/submit", status_code=201)
def submit_professional(body: OnboardingSubmitBody):
    """Professional (A&D) onboarding — creates an ad_partner account + workspace shell."""
    tenant_id = _resolve_demo_tenant()
    profile = _create_account(
        body.email, body.password, body.first_name, body.last_name,
        tenant_id=tenant_id, role="ad_partner",
    )
    payload = {**body.payload, "first_name": body.first_name, "last_name": body.last_name, "email": profile["email"]}
    try:
        genesis = workspace_genesis.generate(
            tenant_id=tenant_id,
            profile_id=profile["id"],
            payload=payload,
            locale=body.locale,
            lead_type="ad_partner",
        )
    except Exception as e:
        logger.error(f"workspace_genesis failure: {e}")
        raise HTTPException(500, f"Workspace genesis failed: {e}")

    session = _password_grant(profile["email"], body.password)
    return {
        "session": {
            "access_token": session["access_token"],
            "refresh_token": session.get("refresh_token"),
            "expires_at": session.get("expires_at"),
        },
        "user": profile,
        "genesis": genesis,
    }


@router.get("/team/{tenant_slug}")
def public_team(tenant_slug: str):
    """Public list of designer personas for the tenant — used by the
    Onboarding review step to show 'You may be followed by Elizabeth, Diego, or Sofia.'
    """
    client = db()
    t = client.table("tenants").select("id").eq("slug", tenant_slug).limit(1).execute()
    if not t.data:
        raise HTTPException(404, "Tenant not found")
    tid = t.data[0]["id"]
    pros = client.table("users_profile").select(
        "id, first_name, last_name, email, avatar_url, metadata_json, role"
    ).eq("tenant_id", tid).eq("role", "designer").execute()
    personas = [p for p in (pros.data or []) if (p.get("metadata_json") or {}).get("persona")]
    out = []
    for p in personas:
        meta = p.get("metadata_json") or {}
        out.append({
            "id": p["id"],
            "first_name": p.get("first_name"),
            "last_name": p.get("last_name"),
            "avatar_url": p.get("avatar_url"),
            "role_label": meta.get("role_label"),
            "bio_short": meta.get("bio_short"),
            "languages": meta.get("languages", []),
            "online_status": meta.get("online_status", "available"),
        })
    return {"team": out}
