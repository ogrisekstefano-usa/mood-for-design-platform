"""ITER161 · Client Provisioning Service™

Provisioning relazionale (NON un signup SaaS) del cliente privato al
completamento del rituale "Inizia il tuo Design Journey™".

Responsabilità:
  1. Idempotenza: se esiste già un users_profile con quell'email nel
     tenant, riusa tutto. Mai duplicare.
  2. Crea auth.user (email confirmed) + users_profile role=client.
  3. Genera magic link Supabase con redirect_to → /auth/callback?
     flow=magic_link&next=/client (Blueprint callback gestisce
     il cross-origin handoff).
  4. Assegna il referente principale via core.human_assignment.
  5. Apre relationship_thread + posta primo messaggio di sistema con
     tono relazionale ("ha completato le prime indicazioni del Journey",
     mai "new lead submitted").
  6. Manda email backup "Il tuo spazio è pronto" (lessico editoriale).

Lessico richiesto dall'utente:
  • spazio progettuale · Design Journey · Client Profile · percorso
    · capitoli · conversazione · referente
  • MAI: dashboard · CRM · ticket · task · pipeline · workflow · owner

Tutto NON-blocking: se uno step accessorio fallisce (email, thread)
NON deve impedire l'apertura del Journey. Logghiamo e proseguiamo.
"""
from __future__ import annotations

import logging
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import requests

from database import db, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from core.human_assignment import assign, hydrate_assignee
from services.auth_redirect import build_callback_url
from services.email_service import send_template_email

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _supabase_admin_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _find_auth_user(email: str) -> Optional[Dict[str, Any]]:
    """Lookup auth.user by email via Supabase Admin API."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return None
    try:
        url = f"{SUPABASE_URL}/auth/v1/admin/users?email={email}"
        r = requests.get(url, headers=_supabase_admin_headers(), timeout=10)
        if r.status_code == 200:
            users = (r.json().get("users") or [])
            for u in users:
                if (u.get("email") or "").lower() == email.lower():
                    return u
    except Exception:
        logger.exception("supabase admin users lookup failed for %s", email)
    return None


def _create_auth_user(email: str, first_name: Optional[str]) -> Optional[str]:
    """Create a passwordless auth.user (email confirmed). Returns user id."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return None
    try:
        url = f"{SUPABASE_URL}/auth/v1/admin/users"
        # No password — magic link only. The user can later set a password
        # from inside the Client Profile (opzionale, mai obbligatoria).
        payload = {
            "email": email,
            "email_confirm": True,
            "user_metadata": {"first_name": first_name, "source": "begin_journey_ritual"},
        }
        r = requests.post(url, headers=_supabase_admin_headers(), json=payload, timeout=15)
        if r.status_code in (200, 201):
            j = r.json()
            uid = j.get("id") or (j.get("user") or {}).get("id")
            return uid
        logger.warning("create_auth_user non-200 %s · %s", r.status_code, r.text[:200])
    except Exception:
        logger.exception("create_auth_user failed for %s", email)
    return None


def _generate_magic_link(email: str, redirect_to: str) -> Optional[str]:
    """Generate a one-time magic link via Supabase Admin API.

    redirect_to is the Blueprint /auth/callback URL (already includes
    flow, origin, next). Supabase will redirect with hash fragment
    carrying access_token / refresh_token.
    """
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return None
    try:
        url = f"{SUPABASE_URL}/auth/v1/admin/generate_link"
        r = requests.post(
            url,
            headers=_supabase_admin_headers(),
            json={
                "type": "magiclink",
                "email": email,
                "options": {"redirect_to": redirect_to},
            },
            timeout=15,
        )
        if r.status_code in (200, 201):
            j = r.json()
            link = (j.get("properties") or {}).get("action_link") or j.get("action_link")
            return link
        logger.warning("magic_link non-200 %s · %s", r.status_code, r.text[:200])
    except Exception:
        logger.exception("magic_link generate failed for %s", email)
    return None


def _ensure_profile(
    *,
    tenant_id: str,
    auth_user_id: str,
    email: str,
    first_name: Optional[str],
    last_name: Optional[str] = None,
    phone: Optional[str] = None,
    locale: str = "it",
) -> Dict[str, Any]:
    """Idempotent users_profile for role=client. Returns the row."""
    c = db()
    existing = (c.table("users_profile").select("*")
                .eq("auth_user_id", auth_user_id).limit(1).execute().data or [])
    if existing:
        return existing[0]
    pid = str(uuid.uuid4())
    now = _now()
    row = {
        "id": pid,
        "auth_user_id": auth_user_id,
        "tenant_id": tenant_id,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "role": "client",
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    try:
        c.table("users_profile").insert(row).execute()
    except Exception:
        logger.exception("users_profile insert failed for %s", email)
        raise
    return row


def _ensure_thread(
    *,
    tenant_id: str,
    lead_id: Optional[str],
    client_profile_id: str,
    primary_designer_id: Optional[str],
    journey_id: Optional[str] = None,
) -> Optional[str]:
    """Open (idempotent) relationship_thread for this lead/client.
    Returns thread_id or None on failure (non-blocking)."""
    c = db()
    try:
        if lead_id:
            existing = (c.table("relationship_threads").select("id")
                        .eq("tenant_id", tenant_id)
                        .eq("lead_id", lead_id).limit(1).execute().data or [])
            if existing:
                return existing[0]["id"]
        tid = str(uuid.uuid4())
        now = _now()
        c.table("relationship_threads").insert({
            "id": tid,
            "tenant_id": tenant_id,
            "lead_id": lead_id,
            "client_profile_id": client_profile_id,
            "primary_designer_id": primary_designer_id,
            "status": "active",
            "last_message_at": now,
            "metadata": {"journey_id": journey_id} if journey_id else {},
            "created_at": now,
            "updated_at": now,
        }).execute()
        return tid
    except Exception:
        logger.exception("relationship_thread ensure failed")
        return None


def _post_system_message(
    *,
    tenant_id: str,
    thread_id: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    c = db()
    try:
        mid = str(uuid.uuid4())
        now = _now()
        c.table("relationship_messages").insert({
            "id": mid,
            "tenant_id": tenant_id,
            "thread_id": thread_id,
            "sender_type": "system",
            "sender_label": "Sistema",
            "message_type": "system_narrative",
            "content": content,
            "metadata": metadata or {},
            "created_at": now,
        }).execute()
        c.table("relationship_threads").update({
            "last_message_at": now,
            "last_message_preview": content[:140],
            "unread_for_designer": 1,
            "updated_at": now,
        }).eq("id", thread_id).execute()
    except Exception:
        logger.exception("system message insert failed")


def provision_client_after_journey(
    *,
    tenant_id: str,
    request_host: str,
    first_name: str,
    email: str,
    phone: Optional[str],
    locale: str,
    journey_id: str,
    account_id: str,
    lead_id: Optional[str],
    summary_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Orchestrates the post-3-step provisioning.

    Returns a dict with:
      {
        "magic_link_url":  str | None,
        "profile_id":      str | None,
        "assignee_profile": dict | None,
        "thread_id":       str | None,
        "auth_user_id":    str | None,
        "is_new_account":  bool,
      }
    """
    email = (email or "").lower().strip()
    result: Dict[str, Any] = {
        "magic_link_url": None,
        "profile_id": None,
        "assignee_profile": None,
        "thread_id": None,
        "auth_user_id": None,
        "is_new_account": False,
    }

    if not email:
        return result

    c = db()

    # ── 1. Idempotent auth.user + users_profile ──────────────────────
    auth_user = _find_auth_user(email)
    if auth_user:
        auth_user_id = auth_user.get("id")
        is_new = False
    else:
        auth_user_id = _create_auth_user(email, first_name)
        is_new = bool(auth_user_id)
    if not auth_user_id:
        logger.warning("client_provisioning: no auth_user_id for %s", email)
        return result
    result["auth_user_id"] = auth_user_id
    result["is_new_account"] = is_new

    try:
        profile = _ensure_profile(
            tenant_id=tenant_id,
            auth_user_id=auth_user_id,
            email=email,
            first_name=first_name,
            phone=phone,
            locale=locale,
        )
        result["profile_id"] = profile["id"]
    except Exception:
        return result

    profile_id = result["profile_id"]

    # ── 2. Human assignment (referente principale) ───────────────────
    assignment_row = assign(tenant_id, "client", profile_id)
    hydrated = hydrate_assignee(assignment_row)
    result["assignee_profile"] = hydrated.get("assignee") if hydrated else None
    primary_designer_id = (hydrated or {}).get("assignee_user_id")

    # ── 3. Relationship thread + system message ──────────────────────
    thread_id = _ensure_thread(
        tenant_id=tenant_id,
        lead_id=lead_id,
        client_profile_id=profile_id,
        primary_designer_id=primary_designer_id,
        journey_id=journey_id,
    )
    result["thread_id"] = thread_id

    if thread_id:
        opening = (
            f"{first_name} ha completato le prime indicazioni del Journey. "
            "Le sue parole sono nel Client Profile."
        )
        _post_system_message(
            tenant_id=tenant_id,
            thread_id=thread_id,
            content=opening,
            metadata={
                "journey_id": journey_id,
                "lead_id": lead_id,
                "kind": "journey_initial_brief_completed",
            },
        )

    # ── 4. Magic link (redirect → /auth/client/callback → /journey/:jid) ─
    # ITER169 · CLIENT auth pipeline isolated. The magic link returns
    # to the DEDICATED client callback (NOT /auth/callback) so the
    # AuthGuard race condition with homepage fallback is eliminated.
    from .auth_redirect import build_client_callback_url
    logger.info("[ITER169] client magic-link host=%r", request_host)
    redirect_to = build_client_callback_url(
        request_host,
        next_path="/journey/auto",
    )
    logger.info("[ITER169] redirect_to=%r", redirect_to)
    magic_link = _generate_magic_link(email, redirect_to)
    result["magic_link_url"] = magic_link

    # ── 5. Email Continuity™ "Il tuo spazio è pronto" (ITER167.R3) ────
    if magic_link:
        try:
            studio_row = (c.table("tenants").select("name").eq("id", tenant_id)
                          .limit(1).execute().data or [])
            studio_name = studio_row[0]["name"] if studio_row else "Lo Studio"
            # Pull the referente's real name for the signature.
            referente_name = ""
            if primary_designer_id:
                try:
                    ref = (c.table("users_profile")
                           .select("first_name,last_name")
                           .eq("id", primary_designer_id).limit(1).execute().data or [])
                    if ref:
                        ref0 = ref[0]
                        referente_name = (
                            f"{ref0.get('first_name') or ''} {ref0.get('last_name') or ''}"
                        ).strip()
                except Exception:
                    pass
            # Hero quote: short excerpt from the brief, if available.
            hero_quote = ""
            if summary_text:
                qt = (summary_text or "").strip().split("\n", 1)[0]
                if 12 < len(qt) <= 160:
                    hero_quote = qt
            # Editorial template_key="space_ready" → uses email.space_ready.* blocks.
            # We reuse the magic_link composer (same cinematic shell, different copy).
            send_template_email(
                to=email,
                template_key="space_ready",
                context={
                    "magic_url":      magic_link,
                    "first_name":     first_name,
                    "studio_name":    studio_name,
                    "referente_name": referente_name,
                    "hero_quote":     hero_quote,
                },
                tenant_id=tenant_id,
                locale=locale or "it",
                event_type="client.space_ready",
                source_host=request_host,
                metadata={
                    "journey_id": journey_id,
                    "profile_id": profile_id,
                    "kind": "post_journey_welcome",
                },
            )
        except Exception:
            logger.exception("space_ready email dispatch failed")

    # ── 6. Internal notification to referente (relazionale) ──────────
    if primary_designer_id:
        try:
            ref_email = (
                c.table("users_profile").select("email,preferred_locale_code")
                .eq("id", primary_designer_id).limit(1).execute().data or [{}]
            )[0]
            if ref_email.get("email"):
                summary_excerpt = (summary_text or "").strip()
                if len(summary_excerpt) > 280:
                    summary_excerpt = summary_excerpt[:280].rsplit(" ", 1)[0] + "…"
                send_template_email(
                    to=ref_email["email"],
                    template_key="generic",
                    context={
                        "eyebrow": "Nuova conversazione progettuale",
                        "title": f"{first_name} ha aperto il suo Design Journey.",
                        "body": (
                            f"Le prime indicazioni di {first_name} sono ora "
                            f"disponibili nel Client Profile. "
                            + (f"\n\n«{summary_excerpt}»" if summary_excerpt else "")
                        ),
                        "cta_label": "Apri il Client Profile",
                        "cta_url": "/relations/accounts",
                        "subject": f"Nuova conversazione progettuale · {first_name}",
                        "preheader": "Le sue parole ti aspettano nel Client Profile.",
                    },
                    tenant_id=tenant_id,
                    locale=(ref_email.get("preferred_locale_code") or "it"),
                    user_id=primary_designer_id,
                    source_host=request_host,
                    event_type="referente.new_conversation",
                    metadata={
                        "journey_id": journey_id,
                        "profile_id": profile_id,
                        "thread_id": thread_id,
                        "kind": "internal_referente_notification",
                    },
                )
        except Exception:
            logger.exception("referente notification dispatch failed")

    return result


def silent_magic_link(email: str, request_host: str, next_path: str = "/client") -> bool:
    """Apple-style silent magic link for the "Accedi" entry from landing.

    Always returns True (opaque) for privacy. If the user exists, an
    email is sent. If not, we just log and return.
    """
    email = (email or "").lower().strip()
    if not email:
        return True

    # Look up — we still send the email even if no auth.user exists,
    # but to keep flow safe, we ONLY send a magic link if the user is
    # provisioned (otherwise Supabase returns an error we silently swallow).
    auth_user = _find_auth_user(email)
    if not auth_user:
        # Opaque: do not enumerate. Just log.
        logger.info("silent_magic_link: no profile for %s (opaque)", email)
        return True

    redirect_to = build_callback_url(request_host, "magic_link", next_path=next_path)
    link = _generate_magic_link(email, redirect_to)
    if not link:
        return True

    # Resolve tenant for branding (best effort)
    c = db()
    tenant_id = None
    locale = "it"
    first_name = None
    studio_name = "Lo Studio"
    try:
        rows = (c.table("users_profile").select("tenant_id,first_name,preferred_locale_code")
                .eq("auth_user_id", auth_user.get("id")).limit(1).execute().data or [])
        if rows:
            tenant_id = rows[0].get("tenant_id")
            first_name = rows[0].get("first_name")
            locale = rows[0].get("preferred_locale_code") or "it"
            if tenant_id:
                t = (c.table("tenants").select("name").eq("id", tenant_id)
                     .limit(1).execute().data or [])
                if t:
                    studio_name = t[0]["name"]
    except Exception:
        logger.exception("silent_magic_link branding lookup failed")

    try:
        # ITER167.R3 · Email Continuity™ — cinematic letter from the studio.
        # Lookup the assigned referente for the real signature.
        referente_name = ""
        try:
            assigns = (c.table("human_assignments")
                       .select("assignee_id")
                       .eq("subject_type", "users_profile")
                       .eq("subject_id", rows[0].get("id") if rows else None)
                       .eq("role", "primary_designer")
                       .limit(1).execute().data or [])
            if assigns:
                ref = (c.table("users_profile")
                       .select("first_name,last_name")
                       .eq("id", assigns[0]["assignee_id"]).limit(1).execute().data or [])
                if ref:
                    referente_name = (
                        f"{ref[0].get('first_name') or ''} {ref[0].get('last_name') or ''}"
                    ).strip()
        except Exception:
            pass

        send_template_email(
            to=email,
            template_key="magic_link",
            context={
                "magic_url":      link,
                "first_name":     first_name or "",
                "studio_name":    studio_name,
                "referente_name": referente_name,
            },
            tenant_id=tenant_id,
            locale=locale,
            source_host=request_host,
            event_type="client.silent_magic_link",
            metadata={"kind": "silent_login"},
        )
    except Exception:
        logger.exception("silent_magic_link email failed")

    return True
