"""cultural_editions.py — Cultural Edition™ Flow Activation.

Endpoint reali per la wizard editoriale che adatta un contenuto base
(progetto / moodboard / showcase) per uno specifico mercato culturale.

NIENTE jargon SaaS · NIENTE "AI generating" lato UI · la generazione
testuale via Claude Sonnet è completamente nascosta sotto il linguaggio
editoriale: "La redazione internazionale di MOOD sta preparando
l'adattamento."

  GET  /api/cultural-editions/markets              taxonomy curata (6 mercati)
  GET  /api/cultural-editions/sources?type=...     elenco contenuti base
  POST /api/cultural-editions/drafts               crea bozza + adatta
  GET  /api/cultural-editions/drafts               lista bozze del tenant
  GET  /api/cultural-editions/drafts/{id}          dettaglio per la review page
  PATCH /api/cultural-editions/drafts/{id}         aggiorna stato / market_version

Le edizioni sono atti editoriali, mai funnel di vendita.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.tenant_context import get_tenant_context
from cultural_engine import market_narrative_provider
from database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cultural-editions", tags=["cultural-editions"])


# ── Mercati curati (6) — descrittori editoriali in italiano ─────────────
# Ogni mercato è un atto culturale, non un target. Le keyword guidano la
# generazione e vengono mostrate al designer durante il wizard.
CURATED_MARKETS: List[Dict[str, Any]] = [
    {
        "code": "usa_miami",
        "label": "USA · Miami",
        "country": "Stati Uniti",
        "city": "Miami",
        "descriptors": ["hospitality luxury", "outdoor living", "atmosfere luminose"],
        "atmosphere": "Luce mediterranea con linguaggio resort. Materiali tattili. Vivere all'aperto come gesto quotidiano.",
        "tone": "caldo · scenografico · ospitale",
        "cta_register": "Prenota una visita privata · Scopri la villa",
        "imagery": "luce naturale calda, water reflections, palette sabbia/avorio, materia naturale",
        "default_locale": "en-US",
    },
    {
        "code": "usa_nyc",
        "label": "USA · New York",
        "country": "Stati Uniti",
        "city": "New York",
        "descriptors": ["pied-à-terre verticali", "sartoriale urbano", "luxury discreto"],
        "atmosphere": "Eleganza architettonica verticale. Materiali sobri ma autoriali. Discrezione sopra tutto.",
        "tone": "competente · sartoriale · misurato",
        "cta_register": "Schedule a private viewing · Discover the residence",
        "imagery": "luce diffusa, skyline notturno, materiali compatti, palette graphite/cream",
        "default_locale": "en-US",
    },
    {
        "code": "uae_dubai",
        "label": "UAE · Dubai",
        "country": "Emirati Arabi Uniti",
        "city": "Dubai",
        "descriptors": ["opulenza materica", "scala monumentale", "ospitalità cerimoniale"],
        "atmosphere": "Marmi e ottoni con grammatica monumentale. Hospitality scenografica. Tempo lento dell'accoglienza.",
        "tone": "cerimoniale · prestigioso · scenografico",
        "cta_register": "Request a curated presentation · Reserve a private appointment",
        "imagery": "marmi statuari, ottoni satinati, luci dorate, scale monumentali",
        "default_locale": "en-US",
    },
    {
        "code": "uk_london",
        "label": "UK · Londra",
        "country": "Regno Unito",
        "city": "Londra",
        "descriptors": ["heritage contemporaneo", "layering tessile", "understatement"],
        "atmosphere": "Townhouse contemporanee con memoria del passato. Layering di tessuti e legni. Eleganza che non dichiara.",
        "tone": "colto · misurato · understated",
        "cta_register": "Arrange a private consultation · Request the project book",
        "imagery": "luce nordica, velluti, boiserie scure, palette tortora/verde inglese",
        "default_locale": "en-GB",
    },
    {
        "code": "italy_milano",
        "label": "Italia · Milano",
        "country": "Italia",
        "city": "Milano",
        "descriptors": ["rigore razionalista", "dettaglio artigiano", "cultura del progetto"],
        "atmosphere": "Architettura come pensiero. Materiali nobili, gesti misurati. Il dettaglio racconta tutta la storia.",
        "tone": "rigoroso · culturale · narrativo",
        "cta_register": "Fissa una consulenza · Visita lo studio",
        "imagery": "linee architettoniche pulite, ottoni, noce canaletto, palette cemento/avorio",
        "default_locale": "it-IT",
    },
    {
        "code": "france_paris",
        "label": "Francia · Parigi",
        "country": "Francia",
        "city": "Parigi",
        "descriptors": ["eleganza haussmaniana", "mix antiquariale", "raffinatezza"],
        "atmosphere": "Boiserie e modanature, ma con un guizzo contemporaneo. Mix di pezzi d'epoca e contemporaneo.",
        "tone": "raffinato · letterario · esthète",
        "cta_register": "Demander une consultation privée · Découvrir le projet",
        "imagery": "luce zenitale parigina, parquet a spina, velluti, palette crème/laiton",
        "default_locale": "fr-FR",
    },
]

CURATED_MARKETS_BY_CODE = {m["code"]: m for m in CURATED_MARKETS}


ADAPTATION_SCOPES = [
    {"key": "tone",             "label": "Tono editoriale"},
    {"key": "cta",              "label": "Call to action"},
    {"key": "material_palette", "label": "Palette materica"},
    {"key": "imagery",          "label": "Riferimenti visivi"},
    {"key": "cultural_refs",    "label": "Riferimenti culturali"},
    {"key": "headlines",        "label": "Titoli e cappelli"},
    {"key": "atmosphere",       "label": "Atmosfera narrativa"},
]


SOURCE_TYPES = [
    {"key": "project",            "label": "Progetto"},
    {"key": "moodboard",          "label": "Moodboard"},
    {"key": "showcase",           "label": "Showcase"},
    {"key": "material_selection", "label": "Selezione materiali"},
]


# ─── Models ────────────────────────────────────────────────────────────
class DraftCreate(BaseModel):
    source_type:      str = Field(..., description="project|moodboard|showcase|material_selection")
    source_id:        str
    source_title:     Optional[str] = None
    target_market:    str
    target_locale:    Optional[str] = None
    adaptation_scope: List[str] = Field(default_factory=list)
    note:             Optional[str] = None
    # Market Narrative Profile™ — selezione contestuale dal wizard.
    # Se assenti, il backend usa i suggested del profilo. Se diversi
    # dai suggested → manual_override = true (utile per Cultural Pattern Learning™).
    selected_narrative_mode:   Optional[str] = None
    selected_intensity:        Optional[str] = None


class DraftPatch(BaseModel):
    status:         Optional[str] = None
    market_version: Optional[Dict[str, Any]] = None
    note:           Optional[str] = None


# ─── Helpers ───────────────────────────────────────────────────────────
def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slim(row: Dict[str, Any]) -> Dict[str, Any]:
    """Strip _id, normalize timestamps."""
    return {k: v for k, v in row.items() if k != "_id"}


def _fetch_source_snapshot(c, tid: str, source_type: str, source_id: str) -> Dict[str, Any]:
    """Take a snapshot of the base content's editorial fields.

    Resilient: returns at minimum a title; missing source returns {}.
    """
    snapshot: Dict[str, Any] = {"type": source_type, "id": source_id}
    try:
        if source_type == "project":
            r = (c.table("projects").select("id,title,description,project_type,metadata_json")
                 .eq("id", source_id).eq("tenant_id", tid).limit(1).execute().data or [])
            if r:
                p = r[0]
                meta = p.get("metadata_json") or {}
                snapshot.update({
                    "title":       p.get("title"),
                    "description": p.get("description"),
                    "kind":        p.get("project_type"),
                    "style_tags":  meta.get("style_tags") or meta.get("moods") or [],
                    "atmosphere":  meta.get("atmosphere_tags") or meta.get("moods") or [],
                    "location":    meta.get("location_label") or meta.get("city"),
                    "cover_url":   meta.get("cover_url") or meta.get("hero_image_url"),
                })
        elif source_type == "moodboard":
            r = (c.table("moodboards").select("id,title,description,cover_url")
                 .eq("id", source_id).eq("tenant_id", tid).limit(1).execute().data or [])
            if r:
                m = r[0]
                snapshot.update({
                    "title":       m.get("title"),
                    "description": m.get("description"),
                    "style_tags":  [],
                    "cover_url":   m.get("cover_url"),
                })
        # showcase / material_selection: lightweight, may not have dedicated table yet
    except Exception as e:
        logger.warning(f"snapshot fetch failed for {source_type}/{source_id}: {e}")
    return snapshot


def _fallback_market_version(market: Dict[str, Any], source: Dict[str, Any],
                             scope: List[str], locale: str) -> Dict[str, Any]:
    """Editorial fallback if AI is unavailable.

    Still a real, usable bozza — never lorem ipsum.
    """
    base_title = (source.get("title") or "Progetto senza titolo").strip()
    return {
        "headline":         f"{base_title} · per {market['city']}",
        "lede":             f"Una lettura di {base_title.lower()} pensata per {market['label']}: "
                            f"{market['atmosphere']}",
        "body":             (source.get("description") or
                             "Adattamento editoriale in preparazione. La redazione "
                             "internazionale di MOOD sta calibrando il racconto sul mercato selezionato."),
        "cta_label":        market["cta_register"].split(" · ")[0],
        "cta_subtext":      market["cta_register"].split(" · ")[1] if " · " in market["cta_register"] else "",
        "atmosphere_notes": market["atmosphere"],
        "material_notes":   "Palette materica suggerita: " + ", ".join(market["descriptors"]),
        "imagery_notes":    market["imagery"],
        "cultural_notes":   f"Tono: {market['tone']}. Pubblico: clientela di {market['city']}.",
        "locale":           locale,
    }


def _build_system_prompt(market: Dict[str, Any], locale: str) -> str:
    return (
        "Sei la redazione internazionale di MOOD for DESIGN, una piattaforma editoriale "
        "per studi di interior design di alta fascia. Adatti i contenuti dello studio "
        "al mercato culturale di destinazione SENZA mai usare jargon SaaS, KPI o linguaggio "
        "commerciale. Lavori come un caporedattore editoriale, non come un copywriter di marketing.\n\n"
        f"MERCATO DI DESTINAZIONE: {market['label']}\n"
        f"DESCRITTORI: {', '.join(market['descriptors'])}\n"
        f"ATMOSFERA: {market['atmosphere']}\n"
        f"TONO RICHIESTO: {market['tone']}\n"
        f"REGISTRO CTA: {market['cta_register']}\n"
        f"IMMAGINARIO VISIVO: {market['imagery']}\n"
        f"LINGUA OUTPUT: {locale}\n\n"
        "Rispondi SOLO con un oggetto JSON valido, niente testo aggiuntivo. "
        "Le frasi devono essere brevi, editoriali, di una rivista di interior design.\n"
        "Schema richiesto:\n"
        "{\n"
        '  "headline": "...",          // titolo principale 6-10 parole\n'
        '  "lede": "...",              // sottotitolo/cappello 1-2 frasi\n'
        '  "body": "...",              // corpo editoriale 3-5 frasi, narrativo\n'
        '  "cta_label": "...",         // CTA primaria 2-4 parole\n'
        '  "cta_subtext": "...",       // riga di supporto sotto la CTA, opzionale\n'
        '  "atmosphere_notes": "...",  // 1 frase atmosfera target\n'
        '  "material_notes": "...",    // 1 frase palette materica suggerita\n'
        '  "imagery_notes": "...",     // 1 frase indicazioni fotografiche\n'
        '  "cultural_notes": "..."     // 1 frase riferimenti culturali da onorare\n'
        "}\n"
    )


def _build_user_message(source: Dict[str, Any], scope: List[str], note: Optional[str]) -> str:
    parts = [
        f"CONTENUTO BASE — tipo: {source.get('type')}",
        f"Titolo: {source.get('title') or '—'}",
    ]
    if source.get("description"):
        parts.append(f"Descrizione: {source['description'][:600]}")
    if source.get("style_tags"):
        parts.append(f"Style tags: {', '.join(source['style_tags'][:8])}")
    if source.get("atmosphere"):
        parts.append(f"Atmosphere tags: {', '.join(source['atmosphere'][:8])}")
    if source.get("location"):
        parts.append(f"Location originaria: {source['location']}")
    if source.get("kind"):
        parts.append(f"Tipologia: {source['kind']}")
    if scope:
        parts.append("Ambiti di adattamento richiesti: " + ", ".join(scope))
    if note:
        parts.append(f"Briefing del designer: {note}")
    parts.append("\nAdatta il contenuto al mercato di destinazione. Rispondi SOLO con il JSON.")
    return "\n".join(parts)


async def _generate_market_version(market: Dict[str, Any], source: Dict[str, Any],
                                   scope: List[str], locale: str,
                                   note: Optional[str],
                                   market_influence_block: Optional[str] = None,
                                   selected_narrative_mode: Optional[str] = None,
                                   selected_intensity: Optional[str] = None) -> Dict[str, Any]:
    """Returns (market_version_dict, generation_meta_dict).

    Quando viene passato `market_influence_block` (testo Italian editoriale
    dal Market Narrative Provider™), viene **appeso** al system prompt come
    *soft influence* — modula il tono SENZA cancellare l'identità di base.
    """
    fallback = _fallback_market_version(market, source, scope, locale)
    meta = {
        "model":        "fallback",
        "generated_at": _iso(),
        "fallback":     True,
    }
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return fallback, meta
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        system_prompt = _build_system_prompt(market, locale)
        if market_influence_block:
            system_prompt = (
                system_prompt
                + "\n\n"
                + market_influence_block
            )
        # Direzione narrativa scelta dal designer (override del profilo).
        if selected_narrative_mode or selected_intensity:
            extras = ["DIREZIONE EDITORIALE SCELTA DAL DESIGNER (rispetta sempre):"]
            if selected_narrative_mode:
                extras.append(f"- Modalità narrativa: {selected_narrative_mode}")
            if selected_intensity:
                extras.append(f"- Intensità narrativa: {selected_intensity}")
            system_prompt += "\n\n" + "\n".join(extras)
        chat = (
            LlmChat(
                api_key=key,
                session_id=f"cultural-edition-{uuid.uuid4().hex[:10]}",
                system_message=system_prompt,
            )
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
            .with_params(max_tokens=1100)
        )
        raw = await chat.send_message(UserMessage(text=_build_user_message(source, scope, note)))
        text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return fallback, {**meta, "error": "no_json_found"}
        parsed = json.loads(m.group(0))
        version = {
            "headline":         (parsed.get("headline") or fallback["headline"]).strip(),
            "lede":             (parsed.get("lede") or fallback["lede"]).strip(),
            "body":             (parsed.get("body") or fallback["body"]).strip(),
            "cta_label":        (parsed.get("cta_label") or fallback["cta_label"]).strip(),
            "cta_subtext":      (parsed.get("cta_subtext") or "").strip(),
            "atmosphere_notes": (parsed.get("atmosphere_notes") or fallback["atmosphere_notes"]).strip(),
            "material_notes":   (parsed.get("material_notes") or fallback["material_notes"]).strip(),
            "imagery_notes":    (parsed.get("imagery_notes") or fallback["imagery_notes"]).strip(),
            "cultural_notes":   (parsed.get("cultural_notes") or fallback["cultural_notes"]).strip(),
            "locale":           locale,
        }
        meta = {
            "model":               "claude-sonnet-4-5-20250929",
            "generated_at":        _iso(),
            "fallback":            False,
            "market_influence":    bool(market_influence_block),
            "selected_narrative_mode": selected_narrative_mode,
            "selected_intensity":      selected_intensity,
        }
        return version, meta
    except Exception as e:
        logger.warning(f"cultural edition generation fallback: {e}")
        return fallback, {**meta, "error": str(e)[:200]}


# ─── Endpoints ─────────────────────────────────────────────────────────
@router.get("/markets")
def list_markets():
    """Public curated taxonomy + Market Narrative Profiles™ inline."""
    profiles = market_narrative_provider.list_profiles()
    # Map curated market codes ↔ narrative profile market codes
    # (some legacy codes need normalization to match seed data)
    code_alias = {
        "usa_miami":   "usa_miami",
        "usa_nyc":     "usa_nyc",
        "usa_socal":   "usa_socal",
        "uae_dubai":   "uae_dubai",
        "uk_london":   "uk_london",
        "italy_milano":"italy_milano",
        "france_paris":"france_paris",
    }
    enriched = []
    for m in CURATED_MARKETS:
        profile = profiles.get(code_alias.get(m["code"], m["code"]))
        copy_market = {**m}
        if profile:
            copy_market["narrative_profile"] = {
                "id":                       profile.get("id"),
                "curator_note":             profile.get("curator_note"),
                "narrative_direction":      profile.get("narrative_direction"),
                "suggested_narrative_mode": profile.get("suggested_narrative_mode"),
                "suggested_intensity":      profile.get("suggested_intensity"),
                "luxury_expression":        profile.get("luxury_expression"),
                "anti_patterns":            profile.get("anti_patterns"),
            }
        enriched.append(copy_market)
    return {
        "markets":           enriched,
        "adaptation_scopes": ADAPTATION_SCOPES,
        "source_types":      SOURCE_TYPES,
    }


@router.get("/market-narrative-profile/{market_code}")
def get_market_narrative_profile(market_code: str):
    """Full Market Narrative Profile™ for the wizard's contextual card.

    Pubblico (no auth) come `/markets`: i profili sono taxonomy curata,
    non dati di tenant. UI usa questa per mostrare 'Direzione narrativa
    del mercato' con curator_note + suggerimenti + anti-patterns.
    """
    profile = market_narrative_provider.get_profile(market_code)
    if not profile:
        # Non bloccante: alcuni mercati legacy potrebbero non essere ancora seeded
        raise HTTPException(404, "Profilo narrativo non disponibile per questo mercato")
    return {"profile": profile}


@router.get("/sources")
def list_sources(type: str = Query(..., description="project|moodboard"),
                 limit: int = 24,
                 ctx=Depends(get_tenant_context)):
    """Elenco contenuti base disponibili per lo step 2 del wizard."""
    c = db()
    tid = ctx["tenant_id"]
    items: List[Dict[str, Any]] = []
    try:
        if type == "project":
            rows = (c.table("projects").select("id,title,project_type,status,updated_at,metadata_json")
                    .eq("tenant_id", tid).order("updated_at", desc=True).limit(limit).execute().data or [])
            for r in rows:
                meta = r.get("metadata_json") or {}
                cover = meta.get("cover_url") or meta.get("hero_image_url") or None
                items.append({
                    "id":         r.get("id"),
                    "title":      r.get("title") or "Senza titolo",
                    "subtitle":   r.get("project_type") or r.get("status") or "progetto",
                    "cover_url":  cover,
                    "updated_at": r.get("updated_at"),
                })
        elif type == "moodboard":
            rows = (c.table("moodboards").select("id,title,status,cover_url,updated_at")
                    .eq("tenant_id", tid).order("updated_at", desc=True).limit(limit).execute().data or [])
            for r in rows:
                items.append({
                    "id":         r.get("id"),
                    "title":      r.get("title") or "Senza titolo",
                    "subtitle":   r.get("status") or "moodboard",
                    "cover_url":  r.get("cover_url"),
                    "updated_at": r.get("updated_at"),
                })
        else:
            # showcase / material_selection — placeholder list (empty for now)
            items = []
    except Exception as e:
        logger.warning(f"list_sources({type}) error: {e}")
        items = []
    return {"items": items, "type": type}


@router.post("/drafts", status_code=201)
async def create_draft(body: DraftCreate, ctx=Depends(get_tenant_context)):
    market = CURATED_MARKETS_BY_CODE.get(body.target_market)
    if not market:
        raise HTTPException(400, "Mercato non riconosciuto")
    if not body.source_type or not body.source_id:
        raise HTTPException(400, "Contenuto base mancante")

    c = db()
    tid = ctx["tenant_id"]
    snapshot = _fetch_source_snapshot(c, tid, body.source_type, body.source_id)
    if body.source_title and not snapshot.get("title"):
        snapshot["title"] = body.source_title

    locale = body.target_locale or market.get("default_locale", "it-IT")
    scope = [s for s in (body.adaptation_scope or []) if s] or [s["key"] for s in ADAPTATION_SCOPES]

    # ── Market Narrative Profile™ — soft cultural influence ─────────────
    profile = market_narrative_provider.get_profile(market["code"])
    influence_block = market_narrative_provider.build_market_influence_block(profile)

    # Suggested vs Selected (per Cultural Pattern Learning™ futuro)
    suggested_mode      = (profile or {}).get("suggested_narrative_mode")
    suggested_intensity = (profile or {}).get("suggested_intensity")
    selected_mode       = body.selected_narrative_mode or suggested_mode
    selected_intensity  = body.selected_intensity      or suggested_intensity
    manual_override     = bool(
        (body.selected_narrative_mode and body.selected_narrative_mode != suggested_mode) or
        (body.selected_intensity      and body.selected_intensity      != suggested_intensity)
    )

    version, meta = await _generate_market_version(
        market, snapshot, scope, locale, body.note,
        market_influence_block=influence_block,
        selected_narrative_mode=selected_mode,
        selected_intensity=selected_intensity,
    )

    did = str(uuid.uuid4())
    row = {
        "id":                 did,
        "tenant_id":          tid,
        "source_type":        body.source_type,
        "source_id":          body.source_id,
        "source_title":       snapshot.get("title"),
        "source_payload":     snapshot,
        "target_market":      market["code"],
        "target_market_label": market["label"],
        "target_locale":      locale,
        "adaptation_scope":   scope,
        "status":             "draft",
        "market_version":     version,
        "generation_meta":    meta,
        "note":               body.note,
        # Market Narrative Profile™ persistence (Phase 1)
        "market_narrative_profile_id": (profile or {}).get("id"),
        "suggested_narrative_mode":    suggested_mode,
        "suggested_intensity":         suggested_intensity,
        "selected_narrative_mode":     selected_mode,
        "selected_intensity":          selected_intensity,
        "manual_override":             manual_override,
        "applied_market_biases":       market_narrative_provider.applied_biases_snapshot(profile),
        "created_by":         ctx.get("profile_id"),
        "created_at":         _iso(),
        "updated_at":         _iso(),
    }
    c.table("cultural_edition_drafts").insert(row).execute()
    return _slim(row)


@router.get("/drafts")
def list_drafts(limit: int = 30, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("cultural_edition_drafts")
            .select("id,source_type,source_id,source_title,target_market,target_market_label,"
                    "target_locale,status,created_at,updated_at,market_version,generation_meta")
            .eq("tenant_id", tid).order("created_at", desc=True).limit(limit).execute().data or [])
    return {"drafts": [_slim(r) for r in rows]}


@router.get("/drafts/{draft_id}")
def get_draft(draft_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    rows = (c.table("cultural_edition_drafts").select("*")
            .eq("id", draft_id).eq("tenant_id", tid).limit(1).execute().data or [])
    if not rows:
        raise HTTPException(404, "Edizione culturale non trovata")
    draft = _slim(rows[0])
    draft["market"] = CURATED_MARKETS_BY_CODE.get(draft.get("target_market"))
    return draft


@router.patch("/drafts/{draft_id}")
def patch_draft(draft_id: str, body: DraftPatch, ctx=Depends(get_tenant_context)):
    c = db()
    tid = ctx["tenant_id"]
    payload: Dict[str, Any] = {"updated_at": _iso()}
    if body.status is not None:
        if body.status not in {"draft", "in_review", "approved", "archived"}:
            raise HTTPException(400, "Stato non valido")
        payload["status"] = body.status
    if body.market_version is not None:
        payload["market_version"] = body.market_version
    if body.note is not None:
        payload["note"] = body.note
    res = (c.table("cultural_edition_drafts").update(payload)
           .eq("id", draft_id).eq("tenant_id", tid).execute())
    if not res.data:
        raise HTTPException(404, "Edizione culturale non trovata")
    return _slim(res.data[0])
