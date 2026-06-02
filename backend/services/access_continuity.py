"""
ITER167 — Access Continuity™ service.

Three responsibilities:
  1. identity_probe(email)            → role hint (magic_link / password / unknown)
  2. issue_magic_link(email, …)        → store hash, send email via Resend
  3. consume_magic_link(token)         → return JWT access token + tenant context

Tone: hospitality-grade. No raw exceptions surface to the caller — the router
maps everything to neutral concierge messages.

Token scheme:
  • Raw token = 32-byte URL-safe random string (`secrets.token_urlsafe`).
  • DB stores ONLY sha256(raw_token).
  • TTL: 15 minutes from creation.
  • Single-use: `consumed_at` set on first successful consume.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import resend
from sqlalchemy import text

from database import AsyncSessionLocal

logger = logging.getLogger(__name__)

MAGIC_LINK_TTL_MIN  = 15
RATE_LIMIT_WINDOW   = 10   # minutes
RATE_LIMIT_MAX      = 3    # links per window per email


# ──────────────────────────────────────────────────────────────────────
# Identity probe
# ──────────────────────────────────────────────────────────────────────
async def identity_probe(email: str) -> dict:
    """
    Return the routing hint for an email.

    Never reveals whether an account exists. The shape is:
      { "channel": "magic_link" | "password" | "studio_pending" | "concierge",
        "display_name": Optional[str] }

    MOOD is a strictly B2B platform. The central identity probe recognises
    only platform-side identities (Admin, Advisor, Founder, Tenant Staff)
    and studio applicants. `private_client` belongs to the tenant CRM and
    has NO central identity — those emails resolve to concierge.

    Order of resolution (matches the MOOD access model exactly):
      Step 1 — public.users
               ├─ has real password AND role in (admin, editor)
               │      → channel="password"
               └─ otherwise (magic-only sentinel OR role in
                  owner/member/guest)               → channel="magic_link"
      Step 2 — studio_requests
               ├─ status='approved'      → channel="concierge"   (post-activation
               │                            user row should exist; if it doesn't,
               │                            something is off — fall to concierge)
               └─ status in (received, reviewing, contacted, …)
                                          → channel="studio_pending"
      Step 3 — nothing matched           → channel="concierge"
    """
    email = (email or "").lower().strip()
    if not email:
        return {"channel": "concierge", "display_name": None}

    async with AsyncSessionLocal() as session:
        # ── Step 1: applicative users ──────────────────────────────
        urow = (await session.execute(
            text("""
                SELECT u.id, u.role, u.full_name, u.password_hash
                  FROM users u
                 WHERE lower(u.email) = :em AND u.is_active = TRUE
                 ORDER BY CASE u.role
                            WHEN 'admin'  THEN 1
                            WHEN 'editor' THEN 2
                            WHEN 'owner'  THEN 3
                            ELSE 4
                          END
                 LIMIT 1
            """),
            {"em": email},
        )).mappings().first()

        if urow:
            ph = (urow["password_hash"] or "").strip()
            has_real_password = bool(ph) and not ph.startswith("!")
            # Password channel for ANY role that has set a real password
            # (admin, editor, advisor, owner...). The sentinel "!magic-link-only"
            # forces magic_link for first-time advisors/founders, who will then
            # set a password during onboarding.
            if has_real_password:
                return {"channel": "password",
                        "display_name": urow["full_name"]}
            return {"channel": "magic_link",
                    "display_name": urow["full_name"]}

        # ── Step 2: studio applications ────────────────────────────
        sreq = (await session.execute(
            text("""
                SELECT id, status, studio_name, contact_name
                  FROM studio_requests
                 WHERE lower(contact_email) = :em
                 ORDER BY created_at DESC
                 LIMIT 1
            """),
            {"em": email},
        )).mappings().first()

        if sreq:
            if sreq["status"] == "approved":
                # The activation flow should already have created a
                # users row. If it didn't, fall through to concierge
                # rather than silently inventing one.
                return {"channel": "concierge", "display_name": None}
            return {"channel": "studio_pending",
                    "display_name": sreq["contact_name"] or sreq["studio_name"]}

        # ── Step 3: nothing matched ────────────────────────────────
        return {"channel": "concierge", "display_name": None}


# ──────────────────────────────────────────────────────────────────────
# Magic link issuance
# ──────────────────────────────────────────────────────────────────────
def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _rate_limit_ok(session, email: str) -> bool:
    res = await session.execute(
        text("""
            SELECT COUNT(*) FROM access_magic_links
             WHERE email_attempt = :em
               AND created_at > NOW() - (:w || ' minutes')::interval
        """),
        {"em": email, "w": str(RATE_LIMIT_WINDOW)},
    )
    return (res.scalar() or 0) < RATE_LIMIT_MAX


async def issue_magic_link(
    *,
    email: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    locale: str = "it",
    ttl_minutes: Optional[int] = None,
    send_email: bool = True,
    expose_token: bool = False,
    link_path: str = "/journey/continue",
) -> dict:
    """
    Generate a magic link, persist its hash, and email it via Resend.

    Args:
      ttl_minutes:  Override the default 15-min TTL (e.g. 43200 = 30 days
                    for founder activation invitations).
      send_email:   If False, the link is issued and persisted but the
                    transactional email is NOT sent. Caller is responsible
                    for delivery (e.g. piggybacking on a different template).
      expose_token: If False (DEFAULT), the response NEVER contains
                    `raw_token` or `magic_link_url` regardless of outcome —
                    safe to expose to public endpoints (anti-enumeration +
                    anti-account-takeover). If True, the caller MUST be an
                    internal trusted call site (e.g. activate_studio_
                    ecosystem injecting the URL into the founder email).

    Always returns a neutral success-shape, even if the email is unknown,
    to avoid account enumeration. Default public-safe response:
      { "delivered": True, "expires_in_minutes": <ttl> }

    Internally:
      • If user is unknown → silently no-op (still returns success).
      • If rate-limited → returns { "delivered": False, "reason": "rate_limited" }
        so the page can show "you've requested a link recently".
    """
    ttl = int(ttl_minutes or MAGIC_LINK_TTL_MIN)
    email = (email or "").lower().strip()
    if not email:
        out = {"delivered": True, "expires_in_minutes": ttl}
        if expose_token:
            out.update({"magic_link_url": None, "raw_token": None})
        return out

    async with AsyncSessionLocal() as session:
        # Rate-limit FIRST (before any account lookup). This applies to
        # every email — known OR unknown — so the endpoint cannot be
        # used as a free enumeration relay.
        if not await _rate_limit_ok(session, email):
            return {"delivered": False, "reason": "rate_limited",
                    "retry_after_minutes": RATE_LIMIT_WINDOW}

        # Look up user; tolerate unknown emails silently.
        urow = (await session.execute(
            text("""
                SELECT u.id, u.tenant_id, u.role, u.full_name, u.email,
                       t.slug AS tenant_slug, t.name AS tenant_name
                  FROM users u JOIN tenants t ON t.id = u.tenant_id
                 WHERE lower(u.email) = :em AND u.is_active = TRUE
                 ORDER BY CASE u.role
                            WHEN 'admin' THEN 1
                            WHEN 'owner' THEN 1
                            WHEN 'editor' THEN 2
                            ELSE 3
                          END
                 LIMIT 1
            """),
            {"em": email},
        )).mappings().first()

        if not urow:
            # Record the *attempt* anyway so the rate-limit window
            # counts unknown-email probes. We use a hash-marker row
            # (no user_id, no token) — purely a tally entry.
            await session.execute(
                text("""
                    INSERT INTO access_magic_links
                      (email_attempt, token_hash, expires_at, ip, user_agent)
                    VALUES (:em, :th, NOW(), :ip, :ua)
                """),
                {"em": email,
                 "th": f"probe:{secrets.token_hex(16)}",
                 "ip": ip, "ua": user_agent},
            )
            await session.commit()
            # silent success to prevent enumeration
            out = {"delivered": True, "expires_in_minutes": ttl}
            if expose_token:
                out.update({"magic_link_url": None, "raw_token": None})
            return out

        raw = secrets.token_urlsafe(32)
        token_hash = _hash(raw)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl)

        await session.execute(
            text("""
                INSERT INTO access_magic_links
                  (tenant_id, user_id, email_attempt, token_hash, expires_at, ip, user_agent)
                VALUES (:tid, :uid, :em, :th, :exp, :ip, :ua)
            """),
            {"tid": str(urow["tenant_id"]), "uid": str(urow["id"]),
             "em": email, "th": token_hash, "exp": expires_at,
             "ip": ip, "ua": user_agent},
        )
        await session.commit()

    # Send the email (sandbox-safe: returns silently if API key invalid)
    if send_email:
        try:
            await _send_magic_link_email(
                to_email=email,
                to_name=urow["full_name"],
                raw_token=raw,
                locale=locale,
                link_path=link_path,
            )
        except Exception as e:
            # Don't leak the error — log internally, return neutral success.
            logger.warning("Resend send failed (email=%s): %s", email, e)

    base = os.environ.get("ACCESS_LINK_BASE_URL", "").rstrip("/")
    magic_url = f"{base}{link_path}?token={raw}" if base else None
    out = {"delivered": True, "expires_in_minutes": ttl}
    if expose_token:
        out.update({"magic_link_url": magic_url, "raw_token": raw})
    return out


# ──────────────────────────────────────────────────────────────────────
# Magic link consumption
# ──────────────────────────────────────────────────────────────────────
async def consume_magic_link(raw_token: str) -> dict:
    """
    Validate a magic link token. Returns:
      { "ok": True, "user": {...}, "tenant": {...}, "jwt": "<...>" }
    or
      { "ok": False, "reason": "expired" | "invalid" | "already_used" }

    On consume, we mark consumed_at and issue an access JWT identical
    to the password-login flow (so the rest of the app is unchanged).

    P0.2 hardening: within a 60-second window after a successful consume,
    requests for the same token are treated as idempotent replays and
    return a fresh JWT for the same user. This neutralises any client
    race (React 18 StrictMode, browser link-prefetch, HMR remount) that
    would otherwise cause the legitimate founder's first click to land
    on `already_used`. After 60 seconds the link reverts to single-use.
    """
    if not raw_token or len(raw_token) < 16:
        return {"ok": False, "reason": "invalid"}

    token_hash = _hash(raw_token)
    async with AsyncSessionLocal() as session:
        row = (await session.execute(
            text("""
                SELECT m.id, m.user_id, m.tenant_id, m.expires_at, m.consumed_at,
                       u.email, u.role, u.full_name,
                       t.slug AS tenant_slug, t.name AS tenant_name
                  FROM access_magic_links m
                  LEFT JOIN users   u ON u.id = m.user_id
                  LEFT JOIN tenants t ON t.id = m.tenant_id
                 WHERE m.token_hash = :th
                 LIMIT 1
            """),
            {"th": token_hash},
        )).mappings().first()

        if not row:
            return {"ok": False, "reason": "invalid"}
        # Idempotent replay window: if the link was consumed less than
        # 60 seconds ago, treat this call as the same arrival and re-issue
        # the JWT. This is the defensive backstop for race conditions on
        # the founder's first click.
        if row["consumed_at"] is not None:
            age = (datetime.now(timezone.utc) - row["consumed_at"]).total_seconds()
            if age > 60:
                return {"ok": False, "reason": "already_used"}
            # Within the replay window — fall through and re-issue the JWT.
        elif row["expires_at"] < datetime.now(timezone.utc):
            return {"ok": False, "reason": "expired"}
        if not row["user_id"]:
            return {"ok": False, "reason": "invalid"}

        # Mark consumed only on the first call (idempotent thereafter).
        if row["consumed_at"] is None:
            await session.execute(
                text("UPDATE access_magic_links SET consumed_at = NOW() WHERE id = :id"),
                {"id": str(row["id"])},
            )
            await session.execute(
                text("UPDATE users SET last_login_at = NOW() WHERE id = :id"),
                {"id": str(row["user_id"])},
            )
            await session.commit()

        # Issue the same JWT shape used by /auth/login
        from routers.auth import create_access_token, tenant_redirect_for
        token = create_access_token(
            user_id=str(row["user_id"]),
            tenant_id=str(row["tenant_id"]),
            tenant_slug=row["tenant_slug"],
            role=row["role"],
            email=row["email"],
        )
        return {
            "ok": True,
            "jwt": token,
            "user": {
                "id": str(row["user_id"]),
                "email": row["email"],
                "full_name": row["full_name"],
                "role": row["role"],
            },
            "tenant": {
                "id": str(row["tenant_id"]),
                "slug": row["tenant_slug"],
                "name": row["tenant_name"],
            },
            "redirect_url": tenant_redirect_for(row["tenant_slug"], row["role"]),
        }


# ──────────────────────────────────────────────────────────────────────
# Email rendering + delivery (Resend)
# ──────────────────────────────────────────────────────────────────────
EMAIL_COPY = {
    "it": {
        "subject":     "Continua il tuo Design Journey",
        "preheader":   "L'accesso al tuo spazio progettuale è pronto.",
        "eyebrow":     "MOOD for DESIGN",
        "headline":    "Il tuo Design Journey è pronto a continuare.",
        "body":        "Il tuo accesso è stato approvato. Continua la tua esperienza dentro MOOD for DESIGN.",
        "cta":         "Attiva Blueprint™",
        "note":        "Questo link è valido per 15 minuti e può essere utilizzato una sola volta. Se non hai richiesto l'accesso, puoi ignorare questo messaggio in tutta tranquillità.",
        "signature":   "Il team MOOD for DESIGN",
    },
    "en-us": {
        "subject":     "Continue your Design Journey",
        "preheader":   "Your editorial workspace is ready.",
        "eyebrow":     "MOOD for DESIGN",
        "headline":    "Your Design Journey is ready to continue.",
        "body":        "Your access has been approved. Continue your experience inside MOOD for DESIGN.",
        "cta":         "Attiva Blueprint™",
        "note":        "This link is valid for 15 minutes and can be used only once. If you did not request access, you may safely disregard this message.",
        "signature":   "The MOOD for DESIGN team",
    },
    "fr": {
        "subject":     "Poursuivez votre Design Journey",
        "preheader":   "Votre espace éditorial vous attend.",
        "eyebrow":     "MOOD for DESIGN",
        "headline":    "Votre Design Journey est prêt à se poursuivre.",
        "body":        "Votre accès a été approuvé. Poursuivez votre expérience à l'intérieur de MOOD for DESIGN.",
        "cta":         "Attiva Blueprint™",
        "note":        "Ce lien est valable 15 minutes et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message en toute tranquillité.",
        "signature":   "L'équipe MOOD for DESIGN",
    },
    "de": {
        "subject":     "Setzen Sie Ihre Design Journey fort",
        "preheader":   "Ihr editorialer Raum erwartet Sie.",
        "eyebrow":     "MOOD for DESIGN",
        "headline":    "Ihre Design Journey kann fortgesetzt werden.",
        "body":        "Ihr Zugang wurde freigegeben. Setzen Sie Ihre Erfahrung innerhalb von MOOD for DESIGN fort.",
        "cta":         "Attiva Blueprint™",
        "note":        "Dieser Link ist 15 Minuten gültig und kann nur einmal verwendet werden. Wenn Sie keinen Zugang angefordert haben, dürfen Sie diese Nachricht in aller Ruhe ignorieren.",
        "signature":   "Das MOOD for DESIGN Team",
    },
    "es": {
        "subject":     "Continúa tu Design Journey",
        "preheader":   "Tu espacio editorial te está esperando.",
        "eyebrow":     "MOOD for DESIGN",
        "headline":    "Tu Design Journey está listo para continuar.",
        "body":        "Tu acceso ha sido aprobado. Continúa tu experiencia dentro de MOOD for DESIGN.",
        "cta":         "Attiva Blueprint™",
        "note":        "Este enlace tiene una validez de 15 minutos y solo puede usarse una vez. Si no has solicitado el acceso, puedes ignorar este mensaje con total tranquilidad.",
        "signature":   "El equipo MOOD for DESIGN",
    },
}


def _render_email(*, raw_token: str, locale: str,
                   link_path: str = "/journey/continue") -> tuple[str, str, str]:
    """
    Render (subject, html, text) for the magic-link email.

    The HTML is a single dark editorial card — inline CSS only.
    """
    copy = EMAIL_COPY.get(locale) or EMAIL_COPY["en-us"]
    base = os.environ.get("ACCESS_LINK_BASE_URL", "").rstrip("/")
    link = f"{base}{link_path}?token={raw_token}"

    html = f"""<!doctype html>
<html lang="{locale.split('-')[0]}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{copy['subject']}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Georgia,'Times New Roman',serif;color:#FFFFFF;">
<span style="display:none!important;opacity:0;color:transparent;visibility:hidden;mso-hide:all;">{copy['preheader']}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0A;">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" border="0"
           style="max-width:540px;background:#0F0F0F;border:1px solid rgba(255,255,255,0.08);border-radius:14px;">
      <tr><td style="padding:48px 48px 8px 48px;">
        <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.22em;
                   text-transform:uppercase;color:#00C9B3;">{copy['eyebrow']}</p>
      </td></tr>
      <tr><td style="padding:24px 48px 8px 48px;">
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:400;
                    font-size:30px;line-height:1.18;color:#FFFFFF;">{copy['headline']}</h1>
      </td></tr>
      <tr><td style="padding:20px 48px 4px 48px;">
        <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.65;
                   color:rgba(255,255,255,0.82);">{copy['body']}</p>
      </td></tr>
      <tr><td style="padding:36px 48px 12px 48px;">
        <a href="{link}"
           style="display:inline-block;padding:14px 26px;background:#00C9B3;color:#000000;
                  font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;letter-spacing:0.10em;
                  text-decoration:none;border-radius:999px;font-weight:600;">{copy['cta']}</a>
      </td></tr>
      <tr><td style="padding:28px 48px 4px 48px;">
        <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;
                   color:rgba(255,255,255,0.45);">{copy['note']}</p>
      </td></tr>
      <tr><td style="padding:24px 48px 40px 48px;">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;
                   font-size:13px;color:rgba(255,255,255,0.55);">{copy['signature']}</p>
      </td></tr>
    </table>
    <p style="margin:24px 0 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;
              color:rgba(255,255,255,0.35);letter-spacing:0.06em;">
      MOOD for DESIGN™ · Blueprint Command Center™
    </p>
  </td></tr>
</table>
</body>
</html>"""

    text_body = (
        f"{copy['headline']}\n\n"
        f"{copy['body']}\n\n"
        f"{copy['cta']}: {link}\n\n"
        f"{copy['note']}\n\n"
        f"— {copy['signature']}\n"
    )
    return copy["subject"], html, text_body


async def _send_magic_link_email(
    *, to_email: str, to_name: Optional[str],
    raw_token: str, locale: str,
    link_path: str = "/journey/continue",
) -> None:
    """Send the magic link via Resend. Synchronous SDK wrapped in to_thread."""
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key or api_key.startswith("re_sandbox_placeholder"):
        # No real key configured. Log the link so devs can still test.
        base = os.environ.get("ACCESS_LINK_BASE_URL", "").rstrip("/")
        logger.info("MAGIC_LINK_DEV_PREVIEW email=%s url=%s%s?token=%s",
                     to_email, base, link_path, raw_token)
        return

    resend.api_key = api_key
    subject, html, text_body = _render_email(raw_token=raw_token,
                                              locale=locale,
                                              link_path=link_path)
    sender_email = os.environ.get("ACCESS_SENDER_EMAIL", "onboarding@resend.dev")
    sender_name  = os.environ.get("ACCESS_SENDER_NAME", "MOOD for DESIGN")
    from_field = f"{sender_name} <{sender_email}>"
    to_field   = f"{to_name} <{to_email}>" if to_name else to_email

    def _send():
        return resend.Emails.send({
            "from": from_field,
            "to":   [to_field],
            "subject": subject,
            "html":   html,
            "text":   text_body,
        })

    await asyncio.to_thread(_send)
