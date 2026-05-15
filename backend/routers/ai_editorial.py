"""AI Editorial Assistant — context-aware editorial intelligence.

Phase Q.1 surface: invoked from the Diff Drawer "Suggest Improvements"
action on any text change. The model receives FULL context (tenant
identity, locale, audience, page type, section type, current tone,
the original text, the changed text, and the desired editorial action)
and returns a single suggested rewrite + a one-sentence reasoning.

NOT a chatbot. Single-shot completions only. No session history.

Backend wraps the EMERGENT_LLM_KEY universal key via the
`emergentintegrations` library — Claude Sonnet 4.5 is the default
editorial model because of its prose quality.
"""
import os
import time
import json
import uuid
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from core.tenant_context import get_tenant_context
from emergentintegrations.llm.chat import LlmChat, UserMessage

log = logging.getLogger(__name__)
router = APIRouter()


# ── Supported editorial actions ──────────────────────────────────────
ACTIONS = {
    "improve":            "Refine the text for editorial sophistication while preserving meaning and structure.",
    "premium":            "Rewrite to feel more premium, restrained, and luxury-aligned. Avoid hype.",
    "concise":            "Tighten the text — remove filler, redundancy, and stiff phrasing. Same meaning, fewer words.",
    "seo":                "Improve SEO discoverability by surfacing the primary keyword early and naturalising long-tail phrasing — without losing editorial tone.",
    "audience_us":        "Adapt language and references for a sophisticated US audience. Spell US-English. Reframe European-specific cues lightly. Keep restraint.",
    "audience_luxury":    "Tune for a luxury / high-net-worth audience. Architectural restraint, no marketing hyperbole, never patronising.",
    "improve_cta":        "Rewrite as a precise call-to-action: confident, short, action-led, no hype.",
    "storytelling":       "Add subtle editorial storytelling — sensory cues, a single concrete detail, restrained pacing. Do not extend length more than 20%.",
    "readability":        "Improve flow and rhythm. Break dense clauses. Keep the same register.",
    "rewrite_headline":   "Rewrite as a single editorial headline. Max 80 characters. No subtitle. No quotation marks.",
    "alternative_titles": "Propose 3 alternative editorial titles, distinct in angle. Return as a numbered list, one per line. Max 70 chars each.",
}

# Editorial system prompt — the ONLY place we encode tone
SYSTEM_PROMPT = """You are an Editorial Intelligence layer embedded inside Blueprint OS™ — a
workflow operating system used by high-end interior design studios,
architectural firms, luxury showrooms and A&D editorial teams.

You are NOT a chatbot. You write like a senior editor at a publication
such as Cabana, Dezeen Quarterly, AD France, or Wallpaper*. Your
default register is editorial, architectural, restrained, international.

ABSOLUTE RULES
1. Output exactly ONE JSON object — no prose before or after, no markdown
   fencing, no commentary. Pure JSON.
2. JSON shape (strict):
   {
     "suggested_text": "...the rewritten copy...",
     "reasoning": "...one short sentence (≤ 22 words) on the editorial intent behind the rewrite..."
   }
3. NEVER use these phrases: "transform your business", "unlock your
   creativity", "in today's world", "game-changer", "elevate your",
   "take it to the next level", "discover the power of". They are
   banned.
4. NEVER add exclamation marks unless the original already had them.
5. NEVER use emojis.
6. NEVER pad with introductions like "Here is the rewritten text".
7. Preserve the original LANGUAGE of the input unless explicitly told
   to translate (Italian stays Italian, English stays English).
8. Preserve the original FORMAT — if the input is one paragraph, return
   one paragraph; if it's a headline, return a headline.
9. Length discipline — never grow the output more than 25% beyond the
   original unless the action explicitly says so."""


class SuggestRequest(BaseModel):
    action: str = Field(..., description="one of ACTIONS keys")
    # The text the editor wants AI to improve. Either the changed version
    # (preferred — we focus on the delta) or the only available text.
    text: str = Field(..., min_length=1, max_length=4000)
    original_text: Optional[str] = Field(None, max_length=4000,
        description="Pre-change text — included so the model sees the delta.")
    # Context fields — every one improves output quality
    locale: Optional[str] = "it"
    audience: Optional[str] = None
    page_type: Optional[str] = None
    section_type: Optional[str] = None
    page_title: Optional[str] = None
    tenant_name: Optional[str] = None
    tone_hint: Optional[str] = None
    extra_instructions: Optional[str] = None


class SuggestResponse(BaseModel):
    suggested_text: str
    reasoning: str
    action: str
    model_used: str
    latency_ms: int


def _build_user_message(req: SuggestRequest) -> str:
    """Build the structured single-shot prompt for the model."""
    action_directive = ACTIONS.get(req.action)
    if not action_directive:
        raise HTTPException(400, f"Unsupported action '{req.action}'. Allowed: {list(ACTIONS.keys())}")

    ctx_lines = []
    if req.tenant_name:    ctx_lines.append(f"Studio: {req.tenant_name}")
    if req.locale:         ctx_lines.append(f"Locale: {req.locale}")
    if req.audience:       ctx_lines.append(f"Audience: {req.audience}")
    if req.page_type:      ctx_lines.append(f"Page type: {req.page_type}")
    if req.section_type:   ctx_lines.append(f"Section type: {req.section_type}")
    if req.page_title:     ctx_lines.append(f"Page title: {req.page_title}")
    if req.tone_hint:      ctx_lines.append(f"Existing tone: {req.tone_hint}")
    ctx_block = "\n".join(ctx_lines) if ctx_lines else "(no additional context)"

    delta_block = ""
    if req.original_text and req.original_text.strip() != req.text.strip():
        delta_block = (
            "\n\n=== ORIGINAL (before edit) ===\n"
            f"{req.original_text.strip()}\n"
        )

    extra = f"\n\nAdditional instruction: {req.extra_instructions}" if req.extra_instructions else ""

    return f"""=== CONTEXT ===
{ctx_block}

=== EDITORIAL ACTION ===
{action_directive}{extra}
{delta_block}
=== CURRENT TEXT (what to improve) ===
{req.text.strip()}

Return the strict JSON object now."""


def _parse_response(raw: str) -> dict:
    """Tolerant JSON extraction — the model is instructed to return pure
    JSON, but we strip code fences and locate the first JSON object as a
    safety net.
    """
    s = (raw or "").strip()
    # Strip ```json ... ``` fences if any
    if s.startswith("```"):
        s = s.split("\n", 1)[-1] if "\n" in s else s
        if s.endswith("```"):
            s = s[: -3]
        if s.startswith("json"):
            s = s[4:].lstrip()
    # Find first '{' and matching '}'
    if "{" in s:
        start = s.find("{")
        depth = 0
        end = -1
        for i in range(start, len(s)):
            if s[i] == "{":
                depth += 1
            elif s[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end > 0:
            try:
                return json.loads(s[start:end])
            except json.JSONDecodeError:
                pass
    # Last resort — wrap entire output as suggested_text
    return {"suggested_text": s, "reasoning": "(model returned non-JSON; raw output preserved)"}


@router.get("/actions")
def list_actions(ctx: dict = Depends(get_tenant_context)):
    """Return the catalogue of editorial actions the UI can offer."""
    role = (ctx.get("role") or "").lower()
    if role in {"client", "ad_partner"}:
        raise HTTPException(403, "Editorial Assistant is restricted to studio members.")
    return {
        "actions": [
            {"id": k, "directive": v} for k, v in ACTIONS.items()
        ]
    }


@router.post("/editorial-suggest", response_model=SuggestResponse)
async def editorial_suggest(req: SuggestRequest, ctx: dict = Depends(get_tenant_context)):
    """Single-shot editorial rewrite. Returns one structured suggestion."""
    role = (ctx.get("role") or "").lower()
    if role in {"client", "ad_partner"}:
        raise HTTPException(403, "Editorial Assistant is restricted to studio members.")

    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "AI Assistant is not configured (missing EMERGENT_LLM_KEY).")

    if req.action not in ACTIONS:
        raise HTTPException(400, f"Unsupported action '{req.action}'.")

    model_name = "claude-sonnet-4-5-20250929"
    started = time.perf_counter()
    chat = (
        LlmChat(
            api_key=key,
            session_id=str(uuid.uuid4()),  # single-shot, no persistence
            system_message=SYSTEM_PROMPT,
        )
        .with_model("anthropic", model_name)
        .with_params(max_tokens=800)
    )
    user_msg = UserMessage(text=_build_user_message(req))
    try:
        raw = await chat.send_message(user_msg)
    except Exception as e:
        log.exception("editorial-suggest failed")
        # Map common failure surfaces to clearer codes
        msg = str(e).lower()
        if "rate" in msg or "limit" in msg or "429" in msg:
            raise HTTPException(429, "Editorial Assistant is busy — please retry in a moment.")
        if "budget" in msg or "balance" in msg or "credit" in msg or "402" in msg:
            raise HTTPException(402, "AI key budget exhausted — top up in Profile → Universal Key.")
        raise HTTPException(502, "Editorial Assistant is temporarily unavailable.")

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    parsed = _parse_response(raw if isinstance(raw, str) else getattr(raw, "text", str(raw)))

    suggested = (parsed.get("suggested_text") or "").strip()
    reasoning = (parsed.get("reasoning") or "").strip()
    if not suggested:
        raise HTTPException(502, "Editorial Assistant returned an empty suggestion. Try again.")

    return SuggestResponse(
        suggested_text=suggested,
        reasoning=reasoning or "Refined for editorial clarity.",
        action=req.action,
        model_used=model_name,
        latency_ms=elapsed_ms,
    )
