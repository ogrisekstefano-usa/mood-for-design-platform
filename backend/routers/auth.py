"""
ITER152 — Auth router (JWT + multi-tenant lookup).

Endpoints (all under /api/auth):
  POST /login       — email/password → multi-tenant lookup → JWT + tenant info
  GET  /me          — verify Bearer token → user info
  POST /logout      — client-side stateless (just for completeness)

Multi-tenant lookup:
  - normalize email to lowercase
  - SELECT all users WHERE lower(email) = :email AND is_active
  - for each candidate, verify bcrypt password
  - 0 matches  → 401 "Credenziali non valide"
  - 1 match    → issue JWT, return {token, user, tenant, redirect_url}
  - N matches  → 200 + {requires_tenant_selection: true, tenants: [{slug, name}]}
                 (frontend asks user which tenant; resubmits with tenant_slug)

Brute-force: 5 failed attempts in last 15min per email → 423 Locked.

This file deliberately avoids the existing site_resolver/admin_site session
patterns to remain self-contained and easy to reason about.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Request, Depends, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy import text

from database import AsyncSessionLocal

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 24h (admin app session)
BRUTE_THRESHOLD = 5
BRUTE_WINDOW_MIN = 15


# ── helpers ─────────────────────────────────────────────────────────────
def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(*, user_id: str, tenant_id: str, tenant_slug: str, role: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "tenant_slug": tenant_slug,
        "role": role,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])


def tenant_redirect_for(tenant_slug: str, role: str) -> str:
    """
    Where to land after a successful login.

    • Founder (role=owner)         → /admin/welcome (cinematic first access
                                     for the studio; falls through to /admin
                                     once the moment has been consumed)
    • Admin / editor               → /admin (Blueprint Command Center)
    • Anything else (clients, …)   → /  (public site for now; future:
                                     tenant private panel on its subdomain)
    """
    if role == "owner":
        return "/admin/welcome"
    if role in ("admin", "editor"):
        return "/admin"
    return "/"


# ── brute-force throttle ────────────────────────────────────────────────
async def _is_locked(session, email_key: str) -> bool:
    res = await session.execute(
        text("""SELECT COUNT(*) FROM login_attempts
                 WHERE identifier = :id AND success = FALSE
                   AND created_at > NOW() - INTERVAL ':w minutes'""".replace(
            ":w", str(BRUTE_WINDOW_MIN)
        )),
        {"id": email_key},
    )
    n = res.scalar() or 0
    return n >= BRUTE_THRESHOLD


async def _log_attempt(session, email_key: str, success: bool) -> None:
    await session.execute(
        text("INSERT INTO login_attempts (identifier, success) VALUES (:id, :s)"),
        {"id": email_key, "s": success},
    )


# ── schemas ─────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str | None = None


# ── endpoints ───────────────────────────────────────────────────────────
@router.post("/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()

    async with AsyncSessionLocal() as session:
        if await _is_locked(session, email):
            raise HTTPException(
                status_code=423,
                detail=f"Troppi tentativi falliti. Riprova fra {BRUTE_WINDOW_MIN} minuti.",
            )

        # Look up all candidate users for this email across all tenants
        q = text("""
            SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role, u.full_name,
                   t.slug AS tenant_slug, t.name AS tenant_name
              FROM users u
              JOIN tenants t ON t.id = u.tenant_id
             WHERE lower(u.email) = :email
               AND u.is_active = TRUE
        """)
        params = {"email": email}
        if body.tenant_slug:
            q = text(str(q) + " AND t.slug = :slug")
            params["slug"] = body.tenant_slug.strip().lower()

        rows = (await session.execute(q, params)).mappings().all()

        # Filter to candidates whose password matches
        matches = [r for r in rows if verify_password(body.password, r["password_hash"])]

        if not matches:
            await _log_attempt(session, email, success=False)
            await session.commit()
            raise HTTPException(status_code=401, detail="Credenziali non valide.")

        if len(matches) > 1:
            # Ambiguity: same email + password across multiple tenants.
            # Ask the client to choose a tenant.
            return {
                "requires_tenant_selection": True,
                "tenants": [
                    {"slug": r["tenant_slug"], "name": r["tenant_name"]}
                    for r in matches
                ],
            }

        u = matches[0]
        token = create_access_token(
            user_id=str(u["id"]),
            tenant_id=str(u["tenant_id"]),
            tenant_slug=u["tenant_slug"],
            role=u["role"],
            email=u["email"],
        )
        await session.execute(
            text("UPDATE users SET last_login_at = NOW() WHERE id = :id"),
            {"id": str(u["id"])},
        )
        await _log_attempt(session, email, success=True)
        await session.commit()

        return {
            "token": token,
            "user": {
                "id": str(u["id"]),
                "email": u["email"],
                "full_name": u["full_name"],
                "role": u["role"],
            },
            "tenant": {
                "id": str(u["tenant_id"]),
                "slug": u["tenant_slug"],
                "name": u["tenant_name"],
            },
            "redirect_url": tenant_redirect_for(u["tenant_slug"], u["role"]),
        }


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token mancante.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessione scaduta.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido.")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Tipo di token non valido.")

    async with AsyncSessionLocal() as session:
        row = (await session.execute(
            text("""SELECT u.id, u.email, u.full_name, u.role, u.is_active,
                          u.tenant_id, t.slug AS tenant_slug, t.name AS tenant_name
                   FROM users u JOIN tenants t ON t.id = u.tenant_id
                   WHERE u.id = CAST(:id AS uuid) LIMIT 1"""),
            {"id": payload["sub"]},
        )).mappings().first()
    if not row or not row["is_active"]:
        raise HTTPException(status_code=401, detail="Utente non trovato.")
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "full_name": row["full_name"],
        "role": row["role"],
        "tenant": {
            "id": str(row["tenant_id"]),
            "slug": row["tenant_slug"],
            "name": row["tenant_name"],
        },
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout():
    # Stateless JWT: the client just discards the token. This endpoint
    # is kept for symmetry and to allow future server-side revocation.
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────
# ITER167 — Access Continuity™ (Magic-Link First Experience)
# ─────────────────────────────────────────────────────────────────────
# Endpoints below are designed for a hospitality-grade login UX.
# Errors are *never* surfaced as raw HTTP detail — the router maps every
# failure to neutral, editorial concierge copy that the frontend renders
# via the `site.access.*` editorial blocks.

from services import access_continuity  # noqa: E402


class IdentityProbeRequest(BaseModel):
    email: EmailStr


@router.post("/identity-probe")
async def identity_probe(body: IdentityProbeRequest):
    """
    Adaptive routing for the new /accedi experience.

    Response shape (always 200):
      { "channel": "magic_link" | "password" | "concierge",
        "display_name": str | None }

    Never leaks whether an account exists — the `concierge` channel is
    used both for unknown emails and for any internal error, so the page
    can render the same warm "we couldn't match this email" copy.
    """
    try:
        return await access_continuity.identity_probe(body.email)
    except Exception:
        # Fail-soft: keep the experience uninterrupted.
        return {"channel": "concierge", "display_name": None}


class MagicLinkRequest(BaseModel):
    email: EmailStr
    locale: str | None = "it"


@router.post("/magic-link/request")
async def magic_link_request(body: MagicLinkRequest, request: Request):
    """
    Issue a magic link to the given email (if it belongs to an active
    account). Always returns a neutral success unless rate-limited.
    """
    try:
        ip  = request.client.host if request.client else None
        ua  = request.headers.get("user-agent")
        res = await access_continuity.issue_magic_link(
            email=body.email,
            ip=ip,
            user_agent=ua,
            locale=(body.locale or "it"),
        )
        return res
    except Exception:
        # Concierge intercept — never surface raw errors.
        return {"delivered": True,
                "expires_in_minutes": access_continuity.MAGIC_LINK_TTL_MIN}


class MagicLinkConsumeRequest(BaseModel):
    token: str


@router.post("/magic-link/consume")
async def magic_link_consume(body: MagicLinkConsumeRequest):
    """
    Exchange a magic-link token for a JWT access session.

    Response always 200, with `ok: bool`. If `ok=false`, the frontend
    looks up the editorial concierge copy keyed by `reason`.
    """
    try:
        return await access_continuity.consume_magic_link(body.token)
    except Exception:
        return {"ok": False, "reason": "invalid"}
