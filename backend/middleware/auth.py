"""Verify Supabase JWT via JWKS (asymmetric ES256/RS256) with fallback to HS256 legacy secret."""
import jwt
import logging
import requests
from functools import lru_cache
from fastapi import HTTPException, Request, Depends
from database import SUPABASE_URL, SUPABASE_JWT_SECRET, db, db_available

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_jwks_client():
    if not SUPABASE_URL:
        return None
    jwks_uri = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    try:
        return jwt.PyJWKClient(jwks_uri, cache_keys=True, lifespan=3600)
    except Exception as e:
        logger.warning(f"JWKS init failed: {e}")
        return None


def decode_supabase_token(token: str) -> dict:
    """Try JWKS asymmetric first, then HS256 fallback."""
    # Read header to pick strategy
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(401, f'Invalid token header: {e}')

    alg = unverified_header.get('alg', 'HS256')

    if alg in ('RS256', 'ES256'):
        jwks_client = _get_jwks_client()
        if jwks_client is None:
            raise HTTPException(503, "JWKS not available")
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token).key
            return jwt.decode(
                token, signing_key, algorithms=[alg],
                audience='authenticated',
                options={"verify_exp": True},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(401, 'Token expired')
        except jwt.InvalidTokenError as e:
            raise HTTPException(401, f'Invalid token: {e}')

    # Fallback HS256
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(503, "JWT secret not configured")
    try:
        return jwt.decode(
            token, SUPABASE_JWT_SECRET, algorithms=['HS256'],
            audience='authenticated', options={"verify_exp": True},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, 'Token expired')
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f'Invalid token: {e}')


def _extract_token(request: Request) -> str:
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        raise HTTPException(401, 'Not authenticated')
    return auth[7:]


def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    payload = decode_supabase_token(token)
    auth_user_id = payload.get('sub')
    if not auth_user_id:
        raise HTTPException(401, 'Invalid token payload')

    if not db_available():
        raise HTTPException(503, 'Database not configured')

    client = db()
    result = (
        client.table('users_profile')
        .select('id, tenant_id, role, email, first_name, last_name, avatar_url, status, auth_user_id')
        .eq('auth_user_id', auth_user_id).limit(1).execute()
    )
    if not result.data:
        raise HTTPException(403, 'User profile not found')

    p = result.data[0]
    if p.get('status') == 'suspended':
        raise HTTPException(403, 'Account suspended')

    return {
        'auth_user_id': auth_user_id,
        'profile_id': p['id'],
        'tenant_id': p['tenant_id'],
        'role': p['role'],
        'email': p['email'] or payload.get('email', ''),
        'first_name': p.get('first_name') or '',
        'last_name': p.get('last_name') or '',
        'full_name': f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip() or (p.get('email') or '').split('@')[0],
        'avatar_url': p.get('avatar_url'),
    }


def require_roles(*roles):
    def checker(user: dict = Depends(get_current_user)):
        if user.get('role') not in roles:
            raise HTTPException(403, 'Insufficient permissions')
        return user
    return checker
