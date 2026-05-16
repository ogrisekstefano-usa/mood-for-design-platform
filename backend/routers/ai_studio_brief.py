"""Strategic Direction™ — locale-native design intelligence memo.

NOT a chatbot. NOT a GPT summary. NOT a translator.

A cinematic 6-section editorial memo composed NATIVELY in the target
locale's culture using the matching `locale_profiles` row. The same project
produces fundamentally different narratives between EN_US / EN_GB / EN_AE —
they share English but are three distinct cultural positionings.

Endpoints:
  GET  /api/projects/{pid}/ai-brief                       latest snapshot
  POST /api/projects/{pid}/ai-brief/generate              create snapshot
  GET  /api/projects/{pid}/strategic-direction/history    snapshots rail
  GET  /api/projects/{pid}/strategic-direction/snapshot/{sid}
  POST /api/projects/{pid}/strategic-direction/send-memo
  POST /api/projects/{pid}/strategic-direction/promote-to-proposal
"""
import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from core.tenant_context import get_tenant_context
from core.locale_runtime import with_runtime_prompt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["ai-studio-brief"])


# ─── Locale resolution ───────────────────────────────────────────────────

# Map: legacy `market` shortcut → composite locale_code.
MARKET_TO_LOCALE_CODE = {
    "IT":  "IT_IT",
    "US":  "EN_US",
    "UK":  "EN_GB", "GB": "EN_GB",
    "AE":  "EN_AE", "UAE": "EN_AE",
    "DE":  "DE_DE",
    "FR":  "FR_FR",
    "ES":  "ES_ES",
}

# Market-intent-preserving fallback chain. The previous architecture blindly
# fell back to IT_IT, which collapsed EN_AE prestige positioning into Italian
# craftsmanship — destroying the entire premise of the Locale Architecture.
# Each chain preserves the closest cultural register.
LOCALE_FALLBACK_CHAIN: Dict[str, List[str]] = {
    "EN_AE": ["EN_GB", "EN_US"],   # prestige → restrained UK editorial, then US
    "EN_GB": ["EN_US"],
    "EN_US": ["EN_GB"],
    "FR_FR": ["IT_IT", "EN_GB"],   # Mediterranean editorial neighbour, then UK
    "DE_DE": ["EN_GB"],            # rigor → UK restraint
    "ES_ES": ["IT_IT", "EN_GB"],   # Mediterranean neighbour, then UK
    "IT_IT": ["EN_GB"],
}


def _load_locale_profile(c, locale_code: str) -> Optional[Dict[str, Any]]:
    r = (c.table("locale_profiles").select("*")
         .eq("locale_code", locale_code.upper()).limit(1).execute())
    return r.data[0] if r.data else None


def _resolve_profile(c, locale_code: str) -> Dict[str, Any]:
    """Load the locale profile with market-intent-preserving fallback."""
    p = _load_locale_profile(c, locale_code)
    if p:
        return p
    for alt in LOCALE_FALLBACK_CHAIN.get(locale_code, []):
        alt_p = _load_locale_profile(c, alt)
        if alt_p:
            logger.warning(
                f"locale fallback {locale_code} → {alt} "
                f"(closest cultural register, NOT a blind default)"
            )
            return alt_p
    # last-resort: any seeded profile (should never happen in practice)
    any_p = (c.table("locale_profiles").select("*").limit(1).execute().data or [])
    if not any_p:
        raise HTTPException(500, "no locale_profiles seeded — run seed_locale_profiles.py")
    logger.error(f"locale exhaust-fallback {locale_code} → {any_p[0]['locale_code']}")
    return any_p[0]


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_project(c, pid: str, tid: str) -> Dict[str, Any]:
    r = (c.table("projects").select("*").eq("id", pid).eq("tenant_id", tid)
         .limit(1).execute())
    if not r.data:
        raise HTTPException(404, "project not found")
    return r.data[0]


def _gather_context(c, project: Dict[str, Any], tid: str) -> Dict[str, Any]:
    """Aggregate all real signals available about the project."""
    pid = project["id"]
    ctx: Dict[str, Any] = {
        "project": {
            "title":          project.get("title"),
            "type":           project.get("project_type"),
            "status":         project.get("status"),
            "budget_range":   project.get("budget_range"),
            "timeline":       project.get("timeline"),
            "atmosphere":     project.get("atmosphere"),
            "description":    project.get("description"),
            "metadata":       project.get("metadata_json") or {},
        },
    }

    # Advisor
    if project.get("assigned_designer_id"):
        a = (c.table("users_profile")
             .select("first_name,last_name,role,markets,languages,expertise_tags,signature_quote,editorial_tone,design_philosophy")
             .eq("id", project["assigned_designer_id"]).eq("tenant_id", tid).limit(1).execute())
        if a.data:
            ad = a.data[0]
            ctx["advisor"] = {
                "name": f"{ad.get('first_name') or ''} {ad.get('last_name') or ''}".strip() or "Advisor",
                "role": ad.get("role"),
                "markets":    ad.get("markets") or [],
                "languages":  ad.get("languages") or [],
                "expertise":  ad.get("expertise_tags") or [],
                "philosophy": ad.get("design_philosophy"),
                "tone":       ad.get("editorial_tone"),
                "signature":  ad.get("signature_quote"),
            }

    # Client (lead) signals
    lead_id = (project.get("metadata_json") or {}).get("lead_id")
    if lead_id:
        lq = (c.table("leads").select("country,language,project_type,budget_range,score,source,metadata_json")
             .eq("id", lead_id).eq("tenant_id", tid).limit(1).execute())
        if lq.data:
            ld = lq.data[0]
            ctx["client"] = {
                "country":  ld.get("country"),
                "language": ld.get("language"),
                "project_type": ld.get("project_type"),
                "budget_range": ld.get("budget_range"),
                "score":    ld.get("score"),
                "source":   ld.get("source"),
                "answers":  (ld.get("metadata_json") or {}).get("answers"),
            }

    # Saved inspirations (moodboard_candidates)
    try:
        cands = (c.table("moodboard_candidates")
                 .select("source_type, source_article_id, source_hotspot_id, "
                         "title, description, image_url, reference_type, "
                         "created_at, status, advisor_note")
                 .eq("tenant_id", tid).eq("project_id", pid)
                 .order("created_at", desc=True).limit(20).execute().data or [])
        ctx["inspirations"] = [{
            "type":         cc.get("source_type"),
            "reference":    cc.get("reference_type"),
            "title":        cc.get("title"),
            "summary":      cc.get("description"),
            "saved_at":     cc.get("created_at"),
            "status":       cc.get("status"),
            "advisor_note": cc.get("advisor_note"),
        } for cc in cands]
    except Exception:
        ctx["inspirations"] = []

    # Materials linked to project
    try:
        rows = (c.table("material_registry")
                .select("id, name, category, finish, dominant_color, tags, metadata_json")
                .eq("tenant_id", tid).eq("status", "active").limit(500).execute().data or [])
        linked = []
        for r in rows:
            meta = r.get("metadata_json") or {}
            if pid in (meta.get("linked_project_ids") or []):
                linked.append({
                    "name":     r.get("name"),
                    "category": r.get("category"),
                    "finish":   r.get("finish"),
                    "color":    r.get("dominant_color"),
                    "tags":     r.get("tags") or [],
                })
        ctx["materials"] = linked
    except Exception:
        ctx["materials"] = []

    # Studio palette memory (top 6)
    try:
        tt = (c.table("tenants").select("theme_settings").eq("id", tid).limit(1).execute().data or [])
        sp = (tt[0].get("theme_settings") if tt else {} or {}).get("studio_palette") or []
        ctx["studio_palette"] = [p.get("hex") for p in sp[:6] if p.get("hex")]
    except Exception:
        ctx["studio_palette"] = []

    return ctx


# ─── LLM prompt (runtime-injected) ──────────────────────────────────────
#
# Phase P0.2.A — locale runtime context comes from with_runtime_prompt().

_TASK_INTRO = """You are an editorial design strategist composing a cinematic
Strategic Direction™ memo for an international luxury interior design studio.
You are NOT a chatbot. You write calm, precise, editorial design memos —
the kind a creative director would publish in a print magazine."""

_TASK_RULES = """═══ TASK RULES ═══
• Reposition, do NOT translate. Even if a previous brief exists, REWRITE
  natively for this locale.
• Tone: editorial, strategic, premium.
• Each section: 2–4 sentences. NO bullet points except in `next_moves`.
• NO emojis.

Return ONLY a single valid JSON object — no markdown, no preamble — shaped:
{
  "direction":             "...",
  "material_language":     "...",
  "emotional_positioning": "...",
  "market_adaptation":     "...",
  "design_risks":          "...",
  "next_moves":            ["...", "...", "..."],
  "headline":              "short editorial line, max 12 words, in this locale's language"
}"""


def _build_system_prompt(profile: Dict[str, Any]) -> str:
    return f"{_TASK_INTRO}\n\n{with_runtime_prompt(profile)}\n\n{_TASK_RULES}"


def _build_user_msg(ctx: Dict[str, Any], profile: Dict[str, Any]) -> str:
    return (
        f"locale_code: {profile['locale_code']}\n"
        f"market:      {profile['market']}\n"
        f"language:    {profile['language']}\n\n"
        f"=== PROJECT CONTEXT (verbatim — use only what's relevant) ===\n"
        f"{json.dumps(ctx, ensure_ascii=False, indent=2, default=str)[:6000]}\n\n"
        f"Compose the 6-section Strategic Direction memo NATIVELY for this "
        f"locale profile. Output JSON only."
    )


# ─── Locale-aware fallback (used only when LLM is unreachable) ───────────

_FALLBACK_DIRECTION = {
    "it": "Direzione strategica non ancora elaborata. Apri il progetto, salva le prime ispirazioni dal Magazine o collega materiali: la direzione si comporrà sui segnali reali del cliente, del mercato e dell'advisor.",
    "en": "Strategic direction not yet composed. Open the project, save the first inspirations from the Magazine or link materials: the direction will compose itself from the real signals of client, market and advisor.",
    "fr": "Direction stratégique non encore composée. Ouvrez le projet, enregistrez les premières inspirations du Magazine ou liez des matériaux : la direction se composera à partir des signaux réels du client, du marché et du conseiller.",
    "de": "Strategische Ausrichtung noch nicht komponiert. Öffnen Sie das Projekt, speichern Sie die ersten Inspirationen aus dem Magazine oder verknüpfen Sie Materialien.",
    "es": "Dirección estratégica aún no compuesta. Abre el proyecto, guarda las primeras inspiraciones del Magazine o vincula materiales.",
}
_FALLBACK_HEADLINE = {
    "it": "Direzione in attesa di elaborazione",
    "en": "Direction awaiting composition",
    "fr": "Direction en attente de composition",
    "de": "Ausrichtung wartet auf Komposition",
    "es": "Dirección a la espera de composición",
}
_FALLBACK_MARKET_ADAPTATION = {
    "it": "Locale di riferimento rilevato: {l}.",
    "en": "Target locale detected: {l}.",
    "fr": "Locale cible détectée : {l}.",
    "de": "Erkanntes Ziel-Locale: {l}.",
    "es": "Locale objetivo detectado: {l}.",
}


def _fallback_sections(profile: Dict[str, Any]) -> Dict[str, Any]:
    L = profile.get("language", "en")
    L = L if L in _FALLBACK_DIRECTION else "en"
    return {
        "direction":             _FALLBACK_DIRECTION[L],
        "material_language":     "—",
        "emotional_positioning": "—",
        "market_adaptation":     _FALLBACK_MARKET_ADAPTATION[L].format(l=profile.get("locale_code") or "—"),
        "design_risks":          "—",
        "next_moves":            [],
        "headline":              _FALLBACK_HEADLINE[L],
        "source":                "fallback",
    }


# ─── Models ──────────────────────────────────────────────────────────────

class GenerateBriefIn(BaseModel):
    locale_code: Optional[str] = Field(None, description="Composite locale (IT_IT, EN_US, EN_GB, EN_AE, DE_DE, FR_FR, ES_ES)")
    market:      Optional[str] = Field(None, description="Legacy 2-letter market shortcut — locale_code wins if both provided")
    locale:      Optional[str] = Field(None, description="Deprecated — language-only. Use locale_code.")


# ─── Endpoints ───────────────────────────────────────────────────────────

@router.get("/{project_id}/ai-brief")
def get_latest_brief(project_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])  # tenant scope check
    r = (c.table("project_ai_briefs").select(
        "id, sections, market, locale, locale_code, model, created_at"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"])
       .order("created_at", desc=True).limit(1).execute())
    if not r.data:
        return {"brief": None}
    return {"brief": r.data[0]}


@router.post("/{project_id}/ai-brief/generate")
async def generate_brief(project_id: str, body: GenerateBriefIn,
                         ctx=Depends(get_tenant_context)):
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    gathered = _gather_context(c, project, ctx["tenant_id"])

    # ── Locale resolution priority ──────────────────────────────────
    #   1. body.locale_code (explicit composite code)
    #   2. body.market → MARKET_TO_LOCALE_CODE
    #   3. client country → MARKET_TO_LOCALE_CODE
    #   4. advisor primary market → MARKET_TO_LOCALE_CODE
    #   5. default IT_IT
    locale_code = (body.locale_code or "").upper().strip() or None
    if not locale_code:
        market = (body.market or "").strip().upper() or None
        if not market:
            country = (gathered.get("client") or {}).get("country")
            if country:
                market = country.upper()
            elif (gathered.get("advisor") or {}).get("markets"):
                market = (gathered["advisor"]["markets"][0] or "").upper()
        locale_code = MARKET_TO_LOCALE_CODE.get((market or "IT").upper(), "IT_IT")

    profile = _resolve_profile(c, locale_code)
    # If fallback kicked in we keep the requested locale_code in the response
    # but compose using the closest cultural register profile.
    effective_locale = profile["locale_code"]
    market_label = profile["market"]
    language = profile["language"]

    sections = _fallback_sections(profile)
    model_used = "fallback"
    key = os.environ.get("EMERGENT_LLM_KEY")
    if key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
            chat = (
                LlmChat(
                    api_key=key,
                    session_id=f"brief-{project_id}-{uuid.uuid4().hex[:8]}",
                    system_message=_build_system_prompt(profile),
                )
                .with_model("anthropic", "claude-sonnet-4-5-20250929")
                .with_params(max_tokens=900)
            )
            raw = await chat.send_message(UserMessage(
                text=_build_user_msg(gathered, profile),
            ))
            text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
            m = re.search(r"\{[\s\S]*\}", text)
            if m:
                parsed = json.loads(m.group(0))
                sections = {
                    "direction":              parsed.get("direction") or "—",
                    "material_language":      parsed.get("material_language") or "—",
                    "emotional_positioning":  parsed.get("emotional_positioning") or "—",
                    "market_adaptation":      parsed.get("market_adaptation") or "—",
                    "design_risks":           parsed.get("design_risks") or "—",
                    "next_moves":             [s for s in (parsed.get("next_moves") or []) if isinstance(s, str)][:6],
                    "headline":               (parsed.get("headline") or "").strip()[:140] or "Direzione progettuale",
                    "source":                 "ai",
                }
                model_used = "claude-sonnet-4-5-20250929"
        except Exception as e:
            logger.warning(f"ai-brief LLM fallback for {effective_locale}: {e}")

    bid = str(uuid.uuid4())
    c.table("project_ai_briefs").insert({
        "id":              bid,
        "tenant_id":       ctx["tenant_id"],
        "project_id":      project_id,
        "sections":        sections,
        "context_payload": gathered,
        "market":          market_label,     # legacy column
        "locale":          language,         # legacy column
        "locale_code":     effective_locale, # NEW — composite locale
        "model":           model_used,
        "created_by":      ctx["profile_id"],
    }).execute()

    return {
        "brief": {
            "id":          bid,
            "sections":    sections,
            "market":      market_label,
            "locale":      language,
            "locale_code": effective_locale,
            "model":       model_used,
            "created_at":  _iso(),
        },
    }


# ═══════════════════════════════════════════════════════════════════════
# Strategic Direction™ extensions (history · memo · promote-to-proposal)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/strategic-direction/history")
def list_direction_history(project_id: str, ctx=Depends(get_tenant_context)):
    """Timestamped snapshots of strategic direction (one row per regeneration).
    Each row carries headline + market + locale_code + creator so the timeline
    can render an evolution rail ('Mediterranean warmth → Quiet luxury shift')."""
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])
    rows = (c.table("project_ai_briefs").select(
        "id, market, locale, locale_code, model, created_at, created_by, sections"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"])
       .order("created_at", desc=True).limit(40).execute().data or [])

    creator_ids = list({r.get("created_by") for r in rows if r.get("created_by")})
    creators: Dict[str, Dict[str, Any]] = {}
    if creator_ids:
        try:
            pr = (c.table("users_profile").select("id, first_name, last_name, avatar_url")
                  .in_("id", creator_ids).execute().data or [])
            creators = {p["id"]: p for p in pr}
        except Exception:
            pass

    out = []
    for r in rows:
        s = r.get("sections") or {}
        cr = creators.get(r.get("created_by")) or {}
        out.append({
            "id":          r["id"],
            "market":      r.get("market"),
            "locale":      r.get("locale"),
            "locale_code": r.get("locale_code"),
            "headline":    s.get("headline") or "Direzione",
            "created_at":  r.get("created_at"),
            "created_by": {
                "id":         cr.get("id"),
                "name":       f"{cr.get('first_name') or ''} {cr.get('last_name') or ''}".strip() or "Studio",
                "avatar_url": cr.get("avatar_url"),
            } if cr else None,
        })
    return {"snapshots": out, "total": len(out)}


@router.get("/{project_id}/strategic-direction/snapshot/{snapshot_id}")
def get_direction_snapshot(project_id: str, snapshot_id: str,
                           ctx=Depends(get_tenant_context)):
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])
    r = (c.table("project_ai_briefs").select(
        "id, market, locale, locale_code, model, created_at, sections"
    ).eq("id", snapshot_id).eq("project_id", project_id)
       .eq("tenant_id", ctx["tenant_id"]).limit(1).execute())
    if not r.data:
        raise HTTPException(404, "snapshot not found")
    return {"brief": r.data[0]}


class MemoIn(BaseModel):
    snapshot_id: Optional[str] = None


def _compose_memo_body(sections: Dict[str, Any], locale_code: Optional[str],
                      market: Optional[str]) -> str:
    s = sections or {}
    headline = (s.get("headline") or "Direzione strategica").strip()
    locale_label = locale_code or market or "IT_IT"
    blocks = [
        f"DIREZIONE — {headline}",
        f"Locale di riferimento: {locale_label}",
        "",
        f"POSIZIONAMENTO\n{s.get('direction') or '—'}",
        f"DIREZIONE EMOTIVA\n{s.get('emotional_positioning') or '—'}",
        f"LINGUAGGIO MATERICO\n{s.get('material_language') or '—'}",
        f"ADATTAMENTO MERCATO\n{s.get('market_adaptation') or '—'}",
        f"RISCHI\n{s.get('design_risks') or '—'}",
    ]
    nm = s.get("next_moves") or []
    if nm:
        blocks.append("MOSSE STRATEGICHE\n" + "\n".join(f"• {m}" for m in nm))
    return "\n\n".join(blocks)


@router.post("/{project_id}/strategic-direction/send-memo")
def send_direction_as_memo(project_id: str, body: MemoIn,
                           ctx=Depends(get_tenant_context)):
    """Push the current Strategic Direction into the project's timeline as
    an internal memo event. Visible to the studio team in the Timeline tab —
    NEVER exposed to the client."""
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])
    q = (c.table("project_ai_briefs").select(
        "id, sections, market, locale, locale_code, created_at"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"]))
    if body.snapshot_id:
        q = q.eq("id", body.snapshot_id)
    else:
        q = q.order("created_at", desc=True).limit(1)
    r = q.execute()
    if not r.data:
        raise HTTPException(404, "no direction available — generate one first")
    brief = r.data[0]
    s = brief.get("sections") or {}
    headline = (s.get("headline") or "Direzione strategica").strip()
    activity_id = str(uuid.uuid4())
    try:
        c.table("project_activity").insert({
            "id":         activity_id,
            "tenant_id":  ctx["tenant_id"],
            "project_id": project_id,
            "actor_id":   ctx["profile_id"],
            "event_type": "direction.shared_with_team",
            "label":      headline,
            "ref_id":     brief["id"],
            "payload":    {
                "market":      brief.get("market"),
                "locale_code": brief.get("locale_code"),
                "memo_body":   _compose_memo_body(s, brief.get("locale_code"), brief.get("market"))[:2000],
            },
        }).execute()
    except Exception as e:
        logger.warning(f"memo send failed: {e}")
        raise HTTPException(500, "memo non inviato")
    return {"ok": True, "activity_id": activity_id}


@router.post("/{project_id}/strategic-direction/promote-to-proposal")
def promote_direction_to_proposal(project_id: str, body: MemoIn,
                                  ctx=Depends(get_tenant_context)):
    """Create a DRAFT proposal pre-populated with the Strategic Direction
    headline as title and the positioning sections as description intro."""
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    q = (c.table("project_ai_briefs").select(
        "id, sections, market, locale_code, created_at"
    ).eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"]))
    if body.snapshot_id:
        q = q.eq("id", body.snapshot_id)
    else:
        q = q.order("created_at", desc=True).limit(1)
    r = q.execute()
    if not r.data:
        raise HTTPException(404, "no direction available — generate one first")
    brief = r.data[0]
    s = brief.get("sections") or {}
    title = (s.get("headline") or project.get("title") or "Proposta progetto").strip()[:160]
    intro_blocks = [
        s.get("direction") or "",
        s.get("emotional_positioning") or "",
        s.get("market_adaptation") or "",
    ]
    description = "\n\n".join([b for b in intro_blocks if b and b != "—"])

    pid = str(uuid.uuid4())
    proposal = {
        "id":          pid,
        "tenant_id":   ctx["tenant_id"],
        "project_id":  project_id,
        "created_by":  ctx["profile_id"],
        "title":       title,
        "description": description,
        "status":      "draft",
        "version":     1,
        "currency":    "EUR",
        "market":      brief.get("market"),
        "locale_code": brief.get("locale_code"),
        "created_at":  _iso(),
        "updated_at":  _iso(),
    }
    try:
        c.table("proposals").insert(proposal).execute()
        c.table("project_activity").insert({
            "id":         str(uuid.uuid4()),
            "tenant_id":  ctx["tenant_id"],
            "project_id": project_id,
            "actor_id":   ctx["profile_id"],
            "event_type": "proposal.created_from_direction",
            "label":      title,
            "ref_id":     pid,
            "payload":    {
                "direction_id": brief["id"],
                "market":       brief.get("market"),
                "locale_code":  brief.get("locale_code"),
            },
        }).execute()
    except Exception as e:
        logger.warning(f"promote to proposal failed: {e}")
        raise HTTPException(500, "creazione proposta non riuscita")
    return {"ok": True, "proposal_id": pid}
