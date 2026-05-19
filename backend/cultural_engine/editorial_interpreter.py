"""Layer 3 — Editorial Interpretation™ + Layer 4 — Narrative Mode™.

LLM (Claude Sonnet 4.5) trasforma signals + descriptors + market resonance
in narrativa editoriale italiana, modulata da:

  • brand_voice          (persistente, configurazione studio)
  • narrative_mode       (contestuale, scelta utente)
  • narrative_intensity  (Minimal / Balanced / Editorial / Cinematic)
  • presentation_context (Internal Review · Client Presentation · …)

ZERO jargon AI, percentuali secondarie, registro adattato alla direzione.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ── Taxonomy Narrative Mode™ ──────────────────────────────────────────
NARRATIVE_MODES: Dict[str, str] = {
    "strategic":         "tono strategico, sintetico, orientato a decisioni progettuali",
    "technical":         "tono tecnico, preciso, vocabolario architettonico, ZERO metafore",
    "emotional":         "tono emozionale ma misurato, evoca sensazioni senza romanticismo forzato",
    "cinematic":         "tono cinematografico, immersivo, narrativo come scene magazine",
    "hospitality":       "tono ospitale, caldo, orientato all'esperienza dell'ospite",
    "luxury_editorial":  "tono editoriale luxury, magazine alta gamma, registro raffinato",
    "commercial_soft":   "tono commerciale morbido, accessibile, rassicurante",
    "cultural_analyst":  "tono consulenziale internazionale, riferimenti culturali e di mercato",
    "minimal_executive": "tono minimal executive, brevissimo, una frase essenziale",
}

NARRATIVE_INTENSITY: Dict[str, str] = {
    "minimal":   "lunghezza essenziale: 1 frase sola per ogni campo, niente ridondanza",
    "balanced":  "lunghezza misurata: 1-2 frasi dense per ogni campo",
    "editorial": "lunghezza editoriale: 2-3 frasi per body, 1 per spatial/atmosphere",
    "cinematic": "lunghezza distesa: 3-4 frasi narrative per body, ritmo riflessivo",
}

PRESENTATION_CONTEXTS: Dict[str, str] = {
    "internal_review":       "registro interno di review tecnica, sintetico",
    "client_presentation":   "registro per presentazione cliente, immersivo ma chiaro",
    "showroom_presentation": "registro showroom, commerciale soft e rassicurante",
    "cultural_edition":      "registro consulenziale internazionale, market-aware",
    "editorial_article":     "registro magazine editoriale alta gamma",
    "moodboard_narrative":   "registro moodboard, evocativo e visuale",
    "design_review":         "registro design review, osservazioni progettuali",
    "hospitality_pitch":     "registro pitch hospitality, ospitalità ed esperienza",
}

BRAND_VOICE_PERSONALITIES = {
    "strategic":          "comunicazione strategica, orientata a decisioni",
    "technical":          "comunicazione tecnica, vocabolario architettonico",
    "editorial":          "comunicazione editoriale, registro magazine",
    "hospitality":        "comunicazione hospitality, calore e esperienza",
    "commercial_soft":    "comunicazione commerciale morbida",
    "luxury":             "comunicazione luxury, registro raffinato",
    "minimal_executive":  "comunicazione minimal executive, brevissimo",
    "cultural_consultant": "comunicazione da consulente culturale internazionale",
}

BRAND_VOCABULARY_STYLES = {
    "architecture_studio":       "vocabolario architettonico",
    "interior_design":           "vocabolario interior design",
    "luxury_hospitality":        "vocabolario luxury hospitality",
    "executive":                 "vocabolario executive",
    "editorial_magazine":        "vocabolario editoriale magazine",
    "retail_showroom":           "vocabolario retail showroom",
    "international_consultancy": "vocabolario consulenza internazionale",
}

BRAND_INTERPRETATION_DENSITY = {
    "concise":       "interpretazioni concise, ZERO ridondanze",
    "standard":      "interpretazioni standard, dense ma non lunghe",
    "deep_analysis": "interpretazioni approfondite, analitiche",
}


def _build_brand_voice_block(brand_voice: Optional[Dict[str, Any]]) -> str:
    if not brand_voice:
        return ""
    lines: List[str] = ["IDENTITÀ COMUNICATIVA DELLO STUDIO (sempre rispettata):"]
    if brand_voice.get("communication_personality"):
        k = brand_voice["communication_personality"]
        if k in BRAND_VOICE_PERSONALITIES:
            lines.append(f"- Personalità: {BRAND_VOICE_PERSONALITIES[k]}")
    if brand_voice.get("vocabulary_style"):
        k = brand_voice["vocabulary_style"]
        if k in BRAND_VOCABULARY_STYLES:
            lines.append(f"- Lessico: {BRAND_VOCABULARY_STYLES[k]}")
    if brand_voice.get("narrative_intensity"):
        k = brand_voice["narrative_intensity"]
        if k in NARRATIVE_INTENSITY:
            lines.append(f"- Intensità abituale: {NARRATIVE_INTENSITY[k]}")
    if brand_voice.get("interpretation_density"):
        k = brand_voice["interpretation_density"]
        if k in BRAND_INTERPRETATION_DENSITY:
            lines.append(f"- Densità interpretativa: {BRAND_INTERPRETATION_DENSITY[k]}")
    return "\n".join(lines) if len(lines) > 1 else ""


def _build_narrative_directive(narrative_mode: Optional[str], intensity: Optional[str],
                                presentation_context: Optional[str]) -> str:
    parts: List[str] = []
    if narrative_mode and narrative_mode in NARRATIVE_MODES:
        parts.append(f"DIREZIONE EDITORIALE PER QUESTO CONTENUTO: {NARRATIVE_MODES[narrative_mode]}")
    if intensity and intensity in NARRATIVE_INTENSITY:
        parts.append(f"INTENSITÀ NARRATIVA: {NARRATIVE_INTENSITY[intensity]}")
    if presentation_context and presentation_context in PRESENTATION_CONTEXTS:
        parts.append(f"CONTESTO DI PRESENTAZIONE: {PRESENTATION_CONTEXTS[presentation_context]}")
    return "\n".join(parts)


SYSTEM_PROMPT_BASE = (
    "Sei la voce editoriale di MOOD for DESIGN, una piattaforma per studi di "
    "interior design internazionali. Devi interpretare la lettura culturale "
    "di un riferimento (signals architettonici + mercato di affinità) come "
    "farebbe un design strategist editoriale.\n\n"
    "REGOLE NON NEGOZIABILI:\n"
    "- Mai usare jargon AI: niente 'AI', 'score', 'prediction', 'machine learning', 'algoritmo', 'classificazione', 'temperature', 'prompt'\n"
    "- Mai usare percentuali nel testo (le percentuali appaiono altrove nell'UI, piccole, secondarie)\n"
    "- Mai dire 'questa immagine è X%/somiglia a X%' — interpreta culturalmente\n"
    "- Tono: rispetta SEMPRE la direzione editoriale ricevuta\n"
    "- Riduci metafore, romanticismo forzato e luxury poetry a meno che non sia esplicitamente richiesto (cinematic / luxury_editorial)\n"
    "- Niente bullet, niente markdown, niente elenchi\n"
    "- Il primo mercato (più affine) può essere nominato; i successivi a frase opzionale\n\n"
    "Restituisci SOLO un oggetto JSON valido nel formato:\n"
    "{\n"
    '  "headline": "frase di apertura — lunghezza adattata all\'intensità",\n'
    '  "body":     "1-4 frasi narrative — lunghezza adattata all\'intensità",\n'
    '  "spatial_reading":   "una frase: comportamento spaziale dominante",\n'
    '  "atmosphere_language": "una frase: linguaggio atmosferico"\n'
    "}\n"
)


def _build_system_prompt(brand_voice: Optional[Dict[str, Any]],
                         narrative_mode: Optional[str],
                         intensity: Optional[str],
                         presentation_context: Optional[str]) -> str:
    blocks = [SYSTEM_PROMPT_BASE]
    bv = _build_brand_voice_block(brand_voice)
    if bv:
        blocks.append(bv)
    nd = _build_narrative_directive(narrative_mode, intensity, presentation_context)
    if nd:
        blocks.append(nd)
    return "\n\n".join(blocks)


def _build_user_message(signals: Dict[str, Any],
                        activated: List[Dict[str, Any]],
                        markets: List[Dict[str, Any]]) -> str:
    top_descriptors = [d["label"] for d in activated[:6]]
    top_markets = markets[:3]
    parts = ["LETTURA CULTURALE — input strutturato.\n"]
    if signals.get("summary"):
        parts.append(f"Lettura visiva neutra: {signals['summary']}")
    if signals.get("room_typology") and signals["room_typology"] != "undefined":
        parts.append(f"Tipologia rilevata: {signals['room_typology']}")
    if signals.get("climate_cues"):
        parts.append(f"Climate cues: {', '.join(signals['climate_cues'])}")
    if top_descriptors:
        parts.append("Descrittori culturali attivi (in ordine di forza): " + ", ".join(top_descriptors))
    if top_markets:
        m_lines = []
        for m in top_markets:
            line = f"{m['market_label']}"
            if m.get("contributors"):
                line += f" — coerenza con {', '.join(m['contributors'][:3])}"
            if m.get("narrative"):
                line += f" ({m['narrative']})"
            m_lines.append(line)
        parts.append("Mercati di affinità (in ordine):\n- " + "\n- ".join(m_lines))
    parts.append(
        "\nProduci ora l'interpretazione editoriale come da schema, rispettando la direzione editoriale ricevuta."
    )
    return "\n".join(parts)


def _fallback(signals: Dict[str, Any], activated: List[Dict[str, Any]],
              markets: List[Dict[str, Any]]) -> Dict[str, str]:
    top = (markets[0] if markets else {}) or {}
    second = (markets[1] if len(markets) > 1 else {}) or {}
    top_label = top.get("market_label", "il mercato di affinità")
    second_phrase = ""
    if second.get("market_label") and second.get("percentage", 0) >= 50:
        second_phrase = f" e una più discreta vicinanza a {second['market_label']}"
    descriptors = ", ".join(d["label"] for d in activated[:3]) or "una lettura culturale ancora in costruzione"
    return {
        "headline":            f"Lettura culturale coerente con {top_label}.",
        "body":                f"Il riferimento mostra {descriptors}{second_phrase}. La grammatica spaziale richiama un lifestyle più vicino a questa cultura abitativa che alle altre.",
        "spatial_reading":     (signals.get("summary") or "Comportamento spaziale in lettura."),
        "atmosphere_language": top.get("narrative") or "Atmosfera in attesa di analisi completa.",
    }


async def interpret(signals: Dict[str, Any], activated: List[Dict[str, Any]],
                    markets: List[Dict[str, Any]],
                    brand_voice: Optional[Dict[str, Any]] = None,
                    narrative_mode: Optional[str] = None,
                    narrative_intensity: Optional[str] = None,
                    presentation_context: Optional[str] = None) -> Dict[str, Any]:
    """Returns editorial interpretation tuned by Brand Voice + Narrative Mode."""
    fb = _fallback(signals, activated, markets)
    key = os.environ.get("EMERGENT_LLM_KEY")
    meta_extra = {
        "narrative_mode":       narrative_mode,
        "intensity":            narrative_intensity,
        "presentation_context": presentation_context,
        "brand_voice_applied":  bool(brand_voice),
    }
    if not key:
        return {**fb, "provider": "fallback", "model": "fallback", "fallback": True, **meta_extra}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        system_prompt = _build_system_prompt(brand_voice, narrative_mode, narrative_intensity, presentation_context)
        chat = (
            LlmChat(api_key=key, session_id=f"cult-{uuid.uuid4().hex[:10]}",
                    system_message=system_prompt)
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
            .with_params(max_tokens=700)
        )
        raw = await chat.send_message(UserMessage(text=_build_user_message(signals, activated, markets)))
        text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return {**fb, "provider": "claude-fallback", "model": "claude-sonnet-4-5", "fallback": True, **meta_extra}
        parsed = json.loads(m.group(0))
        return {
            "headline":            (parsed.get("headline") or fb["headline"]).strip()[:240],
            "body":                (parsed.get("body") or fb["body"]).strip()[:800],
            "spatial_reading":     (parsed.get("spatial_reading") or fb["spatial_reading"]).strip()[:320],
            "atmosphere_language": (parsed.get("atmosphere_language") or fb["atmosphere_language"]).strip()[:320],
            "provider":            "anthropic",
            "model":               "claude-sonnet-4-5-20250929",
            "fallback":            False,
            **meta_extra,
        }
    except Exception as e:
        logger.warning(f"editorial interpreter failed: {e}")
        return {**fb, "provider": "fallback", "model": "fallback", "fallback": True,
                "error": str(e)[:200], **meta_extra}
