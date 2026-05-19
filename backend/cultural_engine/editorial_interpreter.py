"""Layer 3 — Editorial Interpretation™.

LLM (Claude Sonnet 4.5) trasforma signals + mapped descriptors + market
resonance in una breve narrativa editoriale italiana — tono Monocle/AD,
ZERO jargon AI, percentuali secondarie.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "Sei la voce editoriale di MOOD for DESIGN, una piattaforma per studi di "
    "interior design internazionali. Devi interpretare la lettura culturale "
    "di un riferimento (signals architettonici + mercato di affinità) come "
    "farebbe un design strategist editoriale per una rivista come "
    "Architectural Digest, Monocle o Sight Unseen.\n\n"
    "REGOLE NON NEGOZIABILI:\n"
    "- Mai usare jargon AI: niente 'AI', 'score', 'prediction', 'machine learning', 'algoritmo', 'classificazione'\n"
    "- Mai usare percentuali nel testo (le percentuali appaiono altrove nell'UI, piccole, secondarie)\n"
    "- Mai dire 'questa immagine è X%/somiglia a X%' — interpreta culturalmente\n"
    "- Tono: consulenziale, colto, italiano editoriale\n"
    "- Lunghezza: 2-3 frasi totali, dense, eleganti\n"
    "- Niente bullet, niente markdown, niente elenchi\n"
    "- Il primo mercato (più affine) può essere nominato; i successivi a frase opzionale\n\n"
    "Restituisci SOLO un oggetto JSON valido nel formato:\n"
    "{\n"
    '  "headline": "una frase di apertura, 8-14 parole, identifica la natura culturale del riferimento",\n'
    '  "body":     "1-2 frasi narrative, spiegano perché senza mai usare numeri",\n'
    '  "spatial_reading":   "una frase: comportamento spaziale dominante",\n'
    '  "atmosphere_language": "una frase: linguaggio atmosferico"\n'
    "}\n"
)


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
        "\nProduci ora l'interpretazione editoriale come da schema. Mai numeri, mai jargon AI."
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
                    markets: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Returns {headline, body, spatial_reading, atmosphere_language, provider, model, fallback}."""
    fb = _fallback(signals, activated, markets)
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return {**fb, "provider": "fallback", "model": "fallback", "fallback": True}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        chat = (
            LlmChat(api_key=key, session_id=f"cult-{uuid.uuid4().hex[:10]}",
                    system_message=SYSTEM_PROMPT)
            .with_model("anthropic", "claude-sonnet-4-5-20250929")
            .with_params(max_tokens=600)
        )
        raw = await chat.send_message(UserMessage(text=_build_user_message(signals, activated, markets)))
        text = raw if isinstance(raw, str) else getattr(raw, "text", str(raw))
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return {**fb, "provider": "claude-fallback", "model": "claude-sonnet-4-5", "fallback": True}
        parsed = json.loads(m.group(0))
        return {
            "headline":            (parsed.get("headline") or fb["headline"]).strip()[:200],
            "body":                (parsed.get("body") or fb["body"]).strip()[:600],
            "spatial_reading":     (parsed.get("spatial_reading") or fb["spatial_reading"]).strip()[:300],
            "atmosphere_language": (parsed.get("atmosphere_language") or fb["atmosphere_language"]).strip()[:300],
            "provider": "anthropic",
            "model":    "claude-sonnet-4-5-20250929",
            "fallback": False,
        }
    except Exception as e:
        logger.warning(f"editorial interpreter failed: {e}")
        return {**fb, "provider": "fallback", "model": "fallback", "fallback": True, "error": str(e)[:200]}
