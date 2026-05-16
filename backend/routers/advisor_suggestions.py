"""Phase P0.2.D — Advisor Message Suggestions.

Locale-native message drafts the advisor can send to a client in one click.

NOT a chatbot. NOT auto-reply. Editorial drafts the advisor reviews and
sends — the advisor remains in the driver's seat.

Five surfaces:
  • `first_reply`           — first response after a new lead arrives
  • `proposal_intro`        — short note attached to a fresh proposal
  • `moodboard_commentary`  — comment on a saved moodboard
  • `inspiration_response`  — reply to a client-saved inspiration
  • `follow_up`             — re-engagement after silence

Each surface is composed through `with_runtime_prompt(profile)` so the
locale_profile drives tone, vocabulary and CTA register.
"""
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context
from core.locale_runtime import (
    SUPPORTED_LOCALES,
    MARKET_TO_LOCALE_CODE,
    resolve_profile,
    with_runtime_prompt,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/advisor", tags=["advisor-suggestions"])


SURFACES = {
    "first_reply",
    "proposal_intro",
    "moodboard_commentary",
    "inspiration_response",
    "follow_up",
}


# ─── Models ──────────────────────────────────────────────────────────────

class SuggestIn(BaseModel):
    surface:     str  = Field(..., description="first_reply | proposal_intro | moodboard_commentary | inspiration_response | follow_up")
    locale_code: Optional[str] = None
    project_id:  Optional[str] = None
    lead_id:     Optional[str] = None
    proposal_id: Optional[str] = None
    moodboard_id: Optional[str] = None
    note:        Optional[str] = None  # advisor's optional steering note


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gather_context(c, body: SuggestIn, tid: str) -> Dict[str, Any]:
    """Aggregate light context from any referenced entity. Kept compact so
    the LLM stays under 3k input tokens."""
    out: Dict[str, Any] = {}
    if body.lead_id:
        r = (c.table("leads").select(
            "first_name, last_name, country, language, project_type, "
            "budget_range, source, score, locale_code"
        ).eq("id", body.lead_id).eq("tenant_id", tid).limit(1).execute().data or [])
        if r:
            out["lead"] = r[0]
    if body.project_id:
        r = (c.table("projects").select(
            "title, project_type, status, budget_range, timeline, atmosphere, "
            "description, metadata_json, locale_code"
        ).eq("id", body.project_id).eq("tenant_id", tid).limit(1).execute().data or [])
        if r:
            out["project"] = r[0]
    if body.proposal_id:
        r = (c.table("proposals").select(
            "title, description, market, locale_code, status, currency"
        ).eq("id", body.proposal_id).eq("tenant_id", tid).limit(1).execute().data or [])
        if r:
            out["proposal"] = r[0]
    if body.moodboard_id:
        r = (c.table("moodboards").select("title, description")
             .eq("id", body.moodboard_id).eq("tenant_id", tid)
             .limit(1).execute().data or [])
        if r:
            out["moodboard"] = r[0]
    if body.note:
        out["advisor_note"] = body.note[:600]
    return out


def _resolve_locale(c, body: SuggestIn, ctx_obj: Dict[str, Any],
                    gathered: Dict[str, Any]) -> str:
    """Locale priority for advisor surfaces:
       explicit > lead > project > proposal > user pref > tenant > IT_IT."""
    if body.locale_code and body.locale_code.upper() in SUPPORTED_LOCALES:
        return body.locale_code.upper()
    for key in ("lead", "project", "proposal"):
        row = gathered.get(key)
        if row and row.get("locale_code"):
            return row["locale_code"].upper()
        # Legacy `market` shortcut on proposals.
        if key == "proposal" and row and row.get("market"):
            mapped = MARKET_TO_LOCALE_CODE.get((row["market"] or "").upper())
            if mapped:
                return mapped
    # User preference
    try:
        up = (c.table("users_profile").select("preferred_locale_code")
              .eq("id", ctx_obj["profile_id"]).limit(1).execute().data or [])
        if up and up[0].get("preferred_locale_code"):
            return up[0]["preferred_locale_code"].upper()
    except Exception:
        pass
    # Tenant default
    try:
        tt = (c.table("tenants").select("default_locale_code")
              .eq("id", ctx_obj["tenant_id"]).limit(1).execute().data or [])
        if tt and tt[0].get("default_locale_code"):
            return tt[0]["default_locale_code"].upper()
    except Exception:
        pass
    return "IT_IT"


# ─── Prompt ──────────────────────────────────────────────────────────────

_SURFACE_INTROS = {
    "first_reply":          "You are the senior advisor drafting the FIRST response to a new client lead. Warm, editorial, never templated. You acknowledge their inquiry, you do not pitch.",
    "proposal_intro":       "You are the senior advisor drafting a SHORT cover note that accompanies a freshly composed proposal. Editorial. Confident without overselling.",
    "moodboard_commentary": "You are the senior advisor leaving a SHORT editorial commentary on the moodboard you just curated for the client. Material-led, not adjective-led.",
    "inspiration_response": "You are the senior advisor replying to a single saved inspiration the client just sent in. Reflect WHAT it tells you about their direction, not WHETHER you like it.",
    "follow_up":            "You are the senior advisor sending a brief re-engagement note after a few days of silence. Calm, no pressure, opens one specific door.",
}

_BASE_RULES = """═══ TASK RULES ═══
• Reposition the message NATIVELY for the target locale — never translate.
• 60–120 words max. Single paragraph. No bullet points.
• NO emojis. NO subject lines. NO sign-offs (advisor adds their own).
• Address the client directly. Refer to them by first name if available.
• Output JSON only — no markdown, no preamble:
{
  "draft":   "...",
  "register": "one-line characterization of the tone you used"
}"""


def _build_system_prompt(profile: Dict[str, Any], surface: str) -> str:
    intro = _SURFACE_INTROS.get(surface, _SURFACE_INTROS["first_reply"])
    return f"{intro}\n\n{with_runtime_prompt(profile)}\n\n{_BASE_RULES}"


# ─── Endpoint ────────────────────────────────────────────────────────────

@router.post("/suggestions/draft")
async def draft_suggestion(body: SuggestIn, ctx=Depends(get_tenant_context)):
    """Compose a locale-native draft message for the advisor to review and
    send. Never auto-sent — always returned to the UI for human approval."""
    if body.surface not in SURFACES:
        raise HTTPException(400, f"unknown surface: {body.surface}")
    c = db()
    gathered = _gather_context(c, body, ctx["tenant_id"])
    code = _resolve_locale(c, body, ctx, gathered)
    profile = resolve_profile(c, code)
    if not profile:
        raise HTTPException(404, f"locale profile {code} not found")

    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "AI service unavailable — EMERGENT_LLM_KEY missing")

    from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
    chat = (
        LlmChat(
            api_key=key,
            session_id=f"advisor-{body.surface}-{uuid.uuid4().hex[:8]}",
            system_message=_build_system_prompt(profile, body.surface),
        )
        .with_model("anthropic", "claude-sonnet-4-5-20250929")
        .with_params(max_tokens=400)
    )

    user_msg = (
        f"locale_code: {profile['locale_code']}\n"
        f"market:      {profile['market']}\n"
        f"language:    {profile['language']}\n"
        f"surface:     {body.surface}\n\n"
        f"=== CONTEXT (use what's relevant, ignore the rest) ===\n"
        f"{json.dumps(gathered, ensure_ascii=False, default=str)[:3500]}\n\n"
        f"Compose the locale-native advisor draft. Output JSON only."
    )

    raw = await chat.send_message(UserMessage(text=user_msg))
    text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise HTTPException(502, "AI returned no parsable draft")
    try:
        parsed = json.loads(m.group(0))
    except Exception as e:
        raise HTTPException(502, f"AI returned invalid JSON: {e}")

    return {
        "ok":          True,
        "surface":     body.surface,
        "locale_code": profile["locale_code"],
        "draft":       (parsed.get("draft") or "").strip(),
        "register":    (parsed.get("register") or "").strip(),
        "model":       "claude-sonnet-4-5-20250929",
        "generated_at": _iso(),
    }
