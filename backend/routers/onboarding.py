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


# ─── PHASE V — AI BRIEFING SUMMARY (foundation) ─────────────────────────
# Generates a *structured* internal briefing from the adaptive onboarding
# answers. Used by the studio as the operational starting point of the
# project. NEVER returned to the client as raw AI text — the client only
# sees the final cinematic "Project Ready" recap.

class BriefingSummaryBody(BaseModel):
    payload: Dict[str, Any] = Field(default_factory=dict)
    locale: str = "it"


_BRIEFING_SYSTEM_PROMPT = """You are the senior editorial briefing assistant
for MOOD for DESIGN™, a luxury interior design platform.

Your job: read a client's adaptive onboarding answers and produce a
*structured* operational briefing in JSON format. The briefing must feel
like a senior studio principal summarising a new project after a
30-minute discovery call — not a CRM ticket.

NEVER include marketing language. NEVER address the client directly.
ALWAYS write in the client's locale ({locale}). NEVER invent details
that aren't supported by the input. Keep every field concise (≤2 lines).

Output STRICT JSON with this shape:
{
  "project_intent":       "<one-sentence what the client wants>",
  "project_category":     "<residential|hospitality|commercial|other>",
  "stylistic_direction":  "<one-line summary of mood + materials>",
  "priorities":           ["...", "...", "..."],
  "emotional_tone":       "<one short phrase>",
  "complexity_hint":      "<focused|mid|multi-area>",
  "briefing_summary":     "<3-4 sentence executive narrative the studio
                          principal can read in 10 seconds>"
}
"""


def _build_briefing_user_message(payload: Dict[str, Any]) -> str:
    bs = payload.get("briefing_shape") or {}
    parts = [
        f"PROJECT TYPE: {payload.get('project_type') or 'n/a'}",
        f"CATEGORY: {bs.get('project_category') or payload.get('project_category') or 'n/a'}",
        f"SPACES SELECTED: {', '.join(bs.get('spaces') or []) or '(none)'}",
        f"MOODS: {', '.join(bs.get('stylistic_direction') or payload.get('moods') or []) or '(none)'}",
        f"MATERIALS: {', '.join(bs.get('materials_priority') or payload.get('materials') or []) or '(none)'}",
        f"PALETTE: {', '.join(bs.get('palette_priority') or payload.get('colors') or []) or '(none)'}",
        f"FEELING: {bs.get('emotional_tone') or (payload.get('lifestyle_answers') or {}).get('feel') or '(not provided)'}",
        f"INSPIRATION: {bs.get('inspirations_sources') or (payload.get('lifestyle_answers') or {}).get('inspires') or '(not provided)'}",
        f"ATMOSPHERE: {bs.get('atmosphere') or (payload.get('lifestyle_answers') or {}).get('atmosphere') or '(not provided)'}",
        f"TIMELINE: {payload.get('timeline') or 'n/a'}",
        f"BUDGET: {payload.get('budget') or 'n/a'}",
        f"START DATE: {payload.get('start_date') or 'n/a'}",
        f"NOTES: {payload.get('notes') or '(none)'}",
    ]
    return "\n".join(parts) + "\n\nReturn ONLY the JSON object."


@router.post("/briefing-summary")
async def briefing_summary(body: BriefingSummaryBody):
    """Generate a structured operational briefing from the adaptive
    onboarding payload. Best-effort: on AI/key failure returns the
    raw briefing_shape so the studio still has a usable starting point."""
    bs = body.payload.get("briefing_shape") or {}
    # Always-available fallback derived from the deterministic shape.
    fallback = {
        "project_intent":      f"{body.payload.get('project_type') or 'project'} brief",
        "project_category":    bs.get("project_category") or body.payload.get("project_category") or "other",
        "stylistic_direction": ", ".join(bs.get("stylistic_direction") or []) or "(not specified)",
        "priorities":          (bs.get("spaces") or [])[:3],
        "emotional_tone":      bs.get("emotional_tone") or "(not specified)",
        "complexity_hint":     bs.get("complexity_hint") or "focused",
        "briefing_summary":    "Adaptive briefing pending — raw answers preserved in payload.",
        "source":              "fallback",
    }

    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return {"briefing": fallback}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        import json as _json

        chat = (
            LlmChat(
                api_key=key,
                session_id=f"briefing-{uuid.uuid4()}",
                system_message=_BRIEFING_SYSTEM_PROMPT.replace("{locale}", body.locale),
            )
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
            .with_params(max_tokens=700)
        )
        raw = await chat.send_message(UserMessage(text=_build_briefing_user_message(body.payload)))
        text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
        # Pull the first {...} block defensively
        m = re.search(r"\{[\s\S]*\}", text)
        parsed = _json.loads(m.group(0)) if m else None
        if not parsed:
            return {"briefing": fallback}
        parsed["source"] = "ai"
        return {"briefing": parsed}
    except Exception as e:
        logger.warning(f"briefing-summary AI fallback: {e}")
        return {"briefing": fallback}
