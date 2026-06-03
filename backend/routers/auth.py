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

    Architectural rule (Mar 2026): MOOD Core ≠ Blueprint Tenant.
    Two workspaces live on separate routes:
      • /command-center → MOOD Core   (admin, advisor, founder welcome)
      • /blueprint      → Tenant runtime (CMS, media, publishing)

    Role routing:
      • Founder (role=owner)         → /command-center/welcome (cinematic
                                       first access for the studio; the
                                       CTA then takes them to /blueprint).
      • Advisor (role=advisor)       → /command-center/advisor-console
                                       (own scoped console).
      • Admin / editor               → /command-center/overview
                                       (super-admin governance dashboard;
                                       advisor-console & blueprint are
                                       one click away from there).
      • Anything else (clients, …)   → /  (public site; future:
                                       tenant private panel on subdomain).
    """
    if role == "owner":
        return "/command-center/welcome"
    if role == "advisor":
        return "/command-center/advisor-console"
    if role in ("admin", "editor"):
        return "/command-center/overview"
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
                          u.password_hash, u.tenant_id,
                          t.slug AS tenant_slug, t.name AS tenant_name
                   FROM users u JOIN tenants t ON t.id = u.tenant_id
                   WHERE u.id = CAST(:id AS uuid) LIMIT 1"""),
            {"id": payload["sub"]},
        )).mappings().first()
    if not row or not row["is_active"]:
        raise HTTPException(status_code=401, detail="Utente non trovato.")
    ph = (row["password_hash"] or "").strip()
    has_password = bool(ph) and not ph.startswith("!")
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "full_name": row["full_name"],
        "role": row["role"],
        "has_password": has_password,
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
# Password creation / change (advisor onboarding + general use)
# ─────────────────────────────────────────────────────────────────────
import re  # noqa: E402

PASSWORD_MIN_LEN = 8


def _password_strength_issues(pw: str) -> list[str]:
    """Return a list of human-readable Italian issues. Empty list = OK."""
    issues = []
    if not pw or len(pw) < PASSWORD_MIN_LEN:
        issues.append(f"Almeno {PASSWORD_MIN_LEN} caratteri")
    if not re.search(r"[A-Z]", pw or ""):
        issues.append("Almeno una lettera maiuscola")
    if not re.search(r"[0-9]", pw or ""):
        issues.append("Almeno un numero")
    if not re.search(r"[^A-Za-z0-9]", pw or ""):
        issues.append("Almeno un carattere speciale")
    return issues


class SetPasswordRequest(BaseModel):
    password: str
    confirm_password: str


@router.post("/set-password")
async def set_password(
    body: SetPasswordRequest,
    user: dict = Depends(get_current_user),
):
    """
    Authenticated user sets (or rotates) their own password.

    Use cases:
      • Advisor onboarding: first login via magic-link → modal forces a
        password so subsequent accesses use email+password (no email).
      • Any user who wants to change their password.

    Strength rules (server-side, authoritative):
      • ≥ 8 characters
      • ≥ 1 uppercase letter
      • ≥ 1 number
      • ≥ 1 special character
    """
    pw = body.password or ""
    if pw != (body.confirm_password or ""):
        raise HTTPException(
            status_code=422,
            detail="Le due password non coincidono.",
        )
    issues = _password_strength_issues(pw)
    if issues:
        raise HTTPException(
            status_code=422,
            detail="Password non valida: " + " · ".join(issues),
        )
    new_hash = hash_password(pw)
    async with AsyncSessionLocal() as session:
        await session.execute(
            text("""UPDATE users
                       SET password_hash = :ph,
                           updated_at = NOW()
                     WHERE id = CAST(:id AS uuid)"""),
            {"ph": new_hash, "id": user["id"]},
        )
        await session.commit()
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

    SECURITY: the response NEVER contains the raw token or the magic URL.
    Only the access channel (email delivery) carries the credential.
    """
    try:
        ip  = request.client.host if request.client else None
        ua  = request.headers.get("user-agent")
        res = await access_continuity.issue_magic_link(
            email=body.email,
            ip=ip,
            user_agent=ua,
            locale=(body.locale or "it"),
            expose_token=False,  # public endpoint — never leak the token
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
        result = await access_continuity.consume_magic_link(body.token)
    except Exception:
        return {"ok": False, "reason": "invalid"}

    # ── M4 · workspace_first_access notification ───────────────────────────
    # Fired only on the very first successful magic-link consume per user.
    try:
        if isinstance(result, dict) and result.get("ok"):
            user = result.get("user") or {}
            tenant = result.get("tenant") or {}
            user_id = user.get("id")
            tenant_id = tenant.get("id")
            if user_id and tenant_id:
                from services import notifications as _notif
                from database import AsyncSessionLocal as _Session
                from sqlalchemy import text as _t
                async with _Session() as _ns:
                    # Use last_login_at column to detect first-time consume
                    is_first = (await _ns.execute(_t("""
                        SELECT 1 FROM users
                         WHERE id = CAST(:u AS uuid)
                           AND (last_login_at IS NULL
                                OR last_login_at < NOW() - INTERVAL '1 minute')
                        LIMIT 1
                    """), {"u": user_id})).scalar()
                    if is_first:
                        await _notif.notify(
                            _ns,
                            type_code='workspace_first_access',
                            tenant_id=tenant_id,
                            payload={
                                'user_name':  user.get("full_name") or user.get("email") or "—",
                                'studio_name': tenant.get("name") or "—",
                            },
                            created_by_user_id=user_id,
                            dedup_key=f'first_access:{user_id}',
                            source_event_type='access:workspace_first_access',
                            source_event_id=user_id,
                        )
                        await _ns.commit()
    except Exception as _ex:
        import logging
        logging.getLogger('auth').warning(
            'M4 notify(workspace_first_access) failed: %s', _ex)

    return result


# ── Password reset (P0-C) ─────────────────────────────────────────────
class PasswordResetRequest(BaseModel):
    email: EmailStr
    locale: str | None = "it"


class PasswordResetConsume(BaseModel):
    token: str
    new_password: str


@router.post("/password-reset/request")
async def password_reset_request(body: PasswordResetRequest, request: Request):
    """
    Trigger a password reset email.

    Implementation note: under the hood we re-use the magic-link
    infrastructure (same TTL=15min, same anti-enumeration neutrality).
    The user clicks the link → lands on `/reset-password?token=...` →
    the page calls /password-reset/consume with new_password.

    Public endpoint — response is ALWAYS neutral. No token in response.
    """
    try:
        ip  = request.client.host if request.client else None
        ua  = request.headers.get("user-agent")
        await access_continuity.issue_magic_link(
            email=body.email,
            ip=ip,
            user_agent=ua,
            locale=(body.locale or "it"),
            expose_token=False,
            link_path="/reset-password",
        )
    except Exception:
        pass
    return {"delivered": True,
            "expires_in_minutes": access_continuity.MAGIC_LINK_TTL_MIN}


@router.post("/password-reset/consume")
async def password_reset_consume(body: PasswordResetConsume):
    """
    Consume a reset token + set a new password.

    Returns:
      • { ok: True }                                — success
      • { ok: False, reason: "invalid"|"expired"|"already_used" }
      • { ok: False, reason: "weak_password" }
    """
    if not _password_is_strong(body.new_password):
        return {"ok": False, "reason": "weak_password"}
    try:
        res = await access_continuity.consume_magic_link(body.token)
    except Exception:
        return {"ok": False, "reason": "invalid"}
    if not res.get("ok"):
        return {"ok": False, "reason": res.get("reason") or "invalid"}
    # Token valid — set the new password.
    user_email = (res.get("user") or {}).get("email")
    if not user_email:
        return {"ok": False, "reason": "invalid"}
    pw_hash = hash_password(body.new_password)
    async with AsyncSessionLocal() as s:
        await s.execute(
            text("UPDATE users SET password_hash = :h, updated_at = NOW() "
                  "WHERE email = :em"),
            {"h": pw_hash, "em": user_email},
        )
        await s.commit()
    return {"ok": True}


# ── Resend invitation (P0-E) ──────────────────────────────────────────
class ResendInvitationBody(BaseModel):
    email: EmailStr


@router.post("/resend-invitation")
async def resend_invitation(body: ResendInvitationBody, request: Request):
    """
    Re-emit the founder activation magic link.

    Anti-enumeration: response is always neutral. If the email matches
    an active Founder user whose tenant exists AND whose magic-link has
    expired or been consumed, a fresh 30-day link is issued.

    For any other case (unknown email, non-owner role, no tenant) the
    response is the same neutral shape — no signal leaked to the client.
    """
    try:
        ip  = request.client.host if request.client else None
        ua  = request.headers.get("user-agent")
        # Only re-issue if the email belongs to an owner with a tenant.
        # The issue_magic_link service silently no-ops for everything else.
        async with AsyncSessionLocal() as s:
            row = (await s.execute(
                text("""SELECT u.id, u.role FROM users u
                         WHERE u.email = :em AND u.is_active = TRUE
                           AND u.role = 'owner' AND u.tenant_id IS NOT NULL"""),
                {"em": body.email.lower().strip()},
            )).first()
        if row:
            await access_continuity.issue_magic_link(
                email=body.email,
                ip=ip, user_agent=ua,
                locale="it",
                ttl_minutes=30 * 24 * 60,  # 30 days, founder invitation
                expose_token=False,
            )
    except Exception:
        pass
    return {"delivered": True}


# ── Workspace recovery (P0-F) ─────────────────────────────────────────
class WorkspaceRecoveryBody(BaseModel):
    email: EmailStr


@router.post("/workspace-recovery")
async def workspace_recovery(body: WorkspaceRecoveryBody, request: Request):
    """
    "Non trovi il tuo workspace?" CTA.

    Anti-enumeration: response is always neutral. Backend dispatches an
    internal concierge alert to admin@moodfordesign.com with the email
    so the Advisor team can manually reach out. The client never learns
    whether the email belongs to an account.
    """
    try:
        from services import email_dispatcher
        await email_dispatcher.dispatch_email(
            template_key='workspace_recovery_concierge',
            to_email=os.environ.get(
                'MOOD_ADMIN_NOTIFY_EMAIL',
                os.environ.get('ADMIN_EMAIL', 'admin@moodfordesign.com'),
            ),
            to_name='MOOD Concierge',
            locale='it-IT',
            variables={
                'visitor_email': body.email.lower().strip(),
                'ip':            request.client.host if request.client else 'unknown',
            },
        )
    except Exception:
        pass
    return {"delivered": True}


def _password_is_strong(pw: str) -> bool:
    """Same rules as /auth/set-password: ≥8 chars, 1 upper, 1 digit, 1 special."""
    import re as _re
    return (
        isinstance(pw, str)
        and len(pw) >= 8
        and bool(_re.search(r'[A-Z]', pw))
        and bool(_re.search(r'\d',    pw))
        and bool(_re.search(r'[^A-Za-z0-9]', pw))
    )
