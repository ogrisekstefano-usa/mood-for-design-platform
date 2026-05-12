import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from models.auth import RegisterRequest, LoginRequest, ForgotPasswordRequest, AuthResponse, UserResponse
from middleware.auth import hash_password, verify_password, create_access_token, get_current_user
from database import get_db, db_available

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user.get('id', '')),
        email=user.get('email', ''),
        full_name=user.get('full_name'),
        role=user.get('role', 'designer'),
        tenant_id=str(user.get('tenant_id', '')),
        avatar_url=user.get('avatar_url'),
        is_active=user.get('is_active', True),
    )


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    existing = db.table('users').select('id').eq('email', body.email.lower()).execute()
    if existing.data:
        raise HTTPException(409, "Email already registered")

    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    now = _now()
    slug = body.company_name.lower().replace(' ', '-').replace("'", '')[:50] + '-' + tenant_id[:8]

    db.table('tenants').insert({
        'id': tenant_id,
        'name': body.company_name,
        'slug': slug,
        'subscription_plan': 'trial',
        'settings': {},
        'feature_flags': {},
        'created_at': now,
        'updated_at': now,
    }).execute()

    hashed = hash_password(body.password)
    db.table('users').insert({
        'id': user_id,
        'email': body.email.lower(),
        'password_hash': hashed,
        'full_name': body.full_name,
        'role': 'tenant_admin',
        'tenant_id': tenant_id,
        'is_active': True,
        'created_at': now,
        'updated_at': now,
    }).execute()

    token = create_access_token(user_id, body.email.lower(), tenant_id, 'tenant_admin')
    user_resp = UserResponse(id=user_id, email=body.email.lower(), full_name=body.full_name,
                             role='tenant_admin', tenant_id=tenant_id, is_active=True)
    return AuthResponse(access_token=token, user=user_resp)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    if not db_available():
        raise HTTPException(503, "Database not configured")

    db = get_db()
    result = db.table('users').select('*').eq('email', body.email.lower()).execute()
    if not result.data:
        raise HTTPException(401, "Invalid email or password")

    user = result.data[0]
    if not user.get('is_active', True):
        raise HTTPException(403, "Account deactivated")

    password_hash = user.get('password_hash', '')
    if not verify_password(body.password, password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token(
        str(user['id']), user['email'],
        str(user['tenant_id']), user.get('role', 'designer')
    )
    return AuthResponse(access_token=token, user=_user_to_response(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    if not db_available():
        return UserResponse(**{k: current_user.get(k, '') for k in
                               ['id', 'email', 'role', 'tenant_id']},
                           full_name=current_user.get('email', '').split('@')[0])

    db = get_db()
    result = db.table('users').select('*').eq('id', current_user['sub']).execute()
    if not result.data:
        raise HTTPException(404, "User not found")
    return _user_to_response(result.data[0])


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    if not db_available():
        return {"message": "Password reset email sent (if account exists)"}

    db = get_db()
    import secrets
    token = secrets.token_urlsafe(32)
    result = db.table('users').select('id').eq('email', body.email.lower()).execute()
    if result.data:
        # Store reset token — in MVP, log it. Production: send email via Resend/SendGrid
        import logging
        logging.getLogger(__name__).info(
            f"🔑 Password reset token for {body.email}: {token}"
        )
    return {"message": "Password reset email sent (if account exists)"}
