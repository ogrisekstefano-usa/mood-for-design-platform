"""Auth via Supabase Auth — signup creates auth.user + tenant (if new) + users_profile."""
import os
import uuid
import logging
import re
from datetime import datetime, timezone
import requests
from fastapi import APIRouter, HTTPException, Depends, Request
from models.schemas import (
    SignupRequest, LoginRequest, ForgotPasswordRequest,
    AuthResponse, AuthSession, UserProfileResponse,
)
from middleware.auth import get_current_user
from database import db, db_available, SUPABASE_URL, SUPABASE_ANON_KEY

router = APIRouter()
logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(s: str) -> str:
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s[:40] or 'studio'


def _profile_to_resp(p: dict) -> UserProfileResponse:
    return UserProfileResponse(
        id=p['id'],
        auth_user_id=p['auth_user_id'],
        tenant_id=p['tenant_id'],
        email=p.get('email', ''),
        first_name=p.get('first_name'),
        last_name=p.get('last_name'),
        avatar_url=p.get('avatar_url'),
        role=p.get('role', 'designer'),
        status=p.get('status'),
        is_root_superadmin=bool(p.get('is_root_superadmin')),
    )


def _supabase_password_grant(email: str, password: str) -> dict:
    """Sign in via Supabase REST API to get access + refresh tokens."""
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    r = requests.post(url, json={"email": email, "password": password},
                      headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                      timeout=15)
    if r.status_code != 200:
        try:
            err = r.json().get('error_description') or r.json().get('msg') or 'Invalid credentials'
        except Exception:
            err = 'Invalid credentials'
        raise HTTPException(401, err)
    return r.json()


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(body: SignupRequest):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()

    email = body.email.lower().strip()

    # 1) Create auth.user via admin API (email confirmed for MVP)
    try:
        admin_resp = client.auth.admin.create_user({
            "email": email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {
                "first_name": body.first_name,
                "last_name": body.last_name,
            },
        })
        auth_user = admin_resp.user
        if not auth_user:
            raise HTTPException(500, "Could not create auth user")
        auth_user_id = auth_user.id
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e)
        if 'already' in msg.lower() or 'duplicate' in msg.lower() or 'registered' in msg.lower():
            raise HTTPException(409, "Email already registered")
        logger.error(f"signup admin.create_user error: {e}")
        raise HTTPException(500, f"Signup failed: {msg}")

    # 2) Create tenant (each signup creates its own tenant — multi-tenant by design)
    tenant_id = str(uuid.uuid4())
    slug_base = _slugify(body.company_name)
    slug = f"{slug_base}-{tenant_id[:6]}"
    now = _now_iso()
    try:
        client.table('tenants').insert({
            'id': tenant_id,
            'name': body.company_name,
            'slug': slug,
            'status': 'active',
            'default_language': body.locale,
            'active_languages': ['en-US', 'en-GB', 'it', 'fr', 'de', 'es'],
            'created_at': now,
            'updated_at': now,
        }).execute()
    except Exception as e:
        # Rollback auth user
        try: client.auth.admin.delete_user(auth_user_id)
        except Exception: pass
        raise HTTPException(500, f"Tenant creation failed: {e}")

    # 3) Create users_profile
    profile_id = str(uuid.uuid4())
    try:
        client.table('users_profile').insert({
            'id': profile_id,
            'auth_user_id': auth_user_id,
            'tenant_id': tenant_id,
            'email': email,
            'first_name': body.first_name,
            'last_name': body.last_name,
            'role': 'tenant_admin',
            'status': 'active',
            'created_at': now,
            'updated_at': now,
        }).execute()
    except Exception as e:
        try: client.auth.admin.delete_user(auth_user_id)
        except Exception: pass
        try: client.table('tenants').delete().eq('id', tenant_id).execute()
        except Exception: pass
        raise HTTPException(500, f"Profile creation failed: {e}")

    # 4) Sign in to return session
    session_data = _supabase_password_grant(email, body.password)
    profile_resp = UserProfileResponse(
        id=profile_id, auth_user_id=auth_user_id, tenant_id=tenant_id,
        email=email, first_name=body.first_name, last_name=body.last_name,
        role='tenant_admin', status='active',
    )
    return AuthResponse(
        session=AuthSession(
            access_token=session_data['access_token'],
            refresh_token=session_data['refresh_token'],
            expires_at=session_data.get('expires_at'),
        ),
        user=profile_resp,
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    session_data = _supabase_password_grant(body.email.lower(), body.password)
    auth_user = session_data.get('user', {})
    auth_user_id = auth_user.get('id')

    client = db()
    result = client.table('users_profile').select('*').eq('auth_user_id', auth_user_id).limit(1).execute()
    if not result.data:
        raise HTTPException(403, "User profile not found. Contact support.")
    p = result.data[0]
    if p.get('status') == 'suspended':
        raise HTTPException(403, "Account suspended")

    return AuthResponse(
        session=AuthSession(
            access_token=session_data['access_token'],
            refresh_token=session_data['refresh_token'],
            expires_at=session_data.get('expires_at'),
        ),
        user=_profile_to_resp(p),
    )


@router.post("/refresh", response_model=AuthSession)
def refresh(request: Request):
    body = {}
    try:
        import json
        body = json.loads(request.scope.get('body', b'') or b'{}')
    except Exception:
        pass
    # accept refresh_token from body
    refresh_token = body.get('refresh_token') if isinstance(body, dict) else None
    if not refresh_token:
        raise HTTPException(400, "refresh_token required")
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token"
    r = requests.post(url, json={"refresh_token": refresh_token},
                      headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                      timeout=15)
    if r.status_code != 200:
        raise HTTPException(401, "Refresh failed")
    d = r.json()
    return AuthSession(access_token=d['access_token'], refresh_token=d['refresh_token'],
                       expires_at=d.get('expires_at'))


@router.get("/me", response_model=UserProfileResponse)
def me(current_user: dict = Depends(get_current_user)):
    client = db()
    result = client.table('users_profile').select('*').eq('id', current_user['profile_id']).limit(1).execute()
    if not result.data:
        raise HTTPException(404, "Profile not found")
    return _profile_to_resp(result.data[0])


@router.post("/logout")
def logout():
    return {"message": "Logged out"}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    # Trigger Supabase password reset email (if SMTP configured in Supabase project)
    url = f"{SUPABASE_URL}/auth/v1/recover"
    try:
        requests.post(url, json={"email": body.email.lower()},
                      headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
                      timeout=10)
    except Exception:
        pass
    return {"message": "If the account exists, a reset email has been sent"}
