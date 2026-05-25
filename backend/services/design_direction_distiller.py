"""Design Direction™ · Distillation Service · ITER152 Sprint D

Editorial AI distillation of relationship signals into curatorial design
identity moments. Uses Claude Sonnet via Emergent LLM key.

NOT analytics. NOT scoring. The prompt enforces editorial vocabulary:
"Atmosphere emerging", "Material direction stabilising",
"Visual language becoming coherent" — never "user score 72%".

Public entry:
    distil(signals, locale) → dict (atmosphere/material/lifestyle/cultural/
                                    palette/narrative summaries)
"""
from __future__ import annotations
import json
import os
import re
from typing import Any, Dict, List

DEFAULT_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")


def _emergent_key() -> str:
    k = os.environ.get("EMERGENT_LLM_KEY")
    if not k:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    return k


SYSTEM_IT = (
    "Sei il curatore editoriale di MOOD for DESIGN™. Distilli i segnali di "
    "una relazione cliente/studio in un MOMENTO DI IDENTITÀ progettuale. "
    "MAI percentuali, MAI scoring, MAI grafici. Tono editoriale, architettonico, "
    "calmo, curatoriale. Vocabolario tipico: 'atmosfera che emerge', "
    "'direzione materica che si stabilizza', 'linguaggio visivo coerente', "
    "'ospitalità contenuta', 'rituali familiari'. Rispondi SOLO con un JSON "
    "valido (nessun preambolo, nessun markdown, nessun commento)."
)
SYSTEM_EN = (
    "You are the editorial curator of MOOD for DESIGN™. You distil signals from "
    "a client/studio relationship into a DESIGN IDENTITY MOMENT. NEVER use "
    "percentages, scores, charts. Editorial, architectural, calm, curatorial "
    "tone. Typical vocabulary: 'atmosphere emerging', 'material direction "
    "stabilising', 'visual language becoming coherent', 'quiet hospitality', "
    "'family rituals'. Reply ONLY with a valid JSON object (no preface, no "
    "markdown, no commentary)."
)


def _build_user_prompt(signals: List[Dict[str, Any]], locale: str = "it") -> str:
    """Group signals by type, sorted by weight*confidence, and ask the LLM
    for an editorial distillation."""
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for s in signals:
        grouped.setdefault(s.get("signal_type", "other"), []).append(s)
    # rank each group
    for t, arr in grouped.items():
        arr.sort(
            key=lambda x: (x.get("weight", 1.0) * x.get("confidence", 0.5)),
            reverse=True,
        )

    block = []
    for t, arr in grouped.items():
        items = [f"  - {s.get('signal_value') or s.get('signal_key')}"
                 + (f"  · source={s.get('source_type')}" if s.get("source_type") else "")
                 for s in arr[:12]]
        block.append(f"{t.upper()} ({len(arr)} signals)\n" + "\n".join(items))
    body = "\n\n".join(block) if block else "(no signals yet)"

    if locale == "en":
        return (
            "Below are the signals collected so far for one relationship.\n\n"
            f"{body}\n\n"
            "Produce a JSON object with these EXACT keys and shape:\n"
            "{\n"
            "  \"atmosphere\": {\"headline\": \"Warm Contemporary\", "
            "\"narrative\": \"…\", \"chips\": [\"…\", \"…\"]},\n"
            "  \"materials\":  {\"headline\": \"Material direction stabilising\", "
            "\"narrative\": \"…\", \"materials\": [{\"name\": \"Smoked Oak\", "
            "\"tone\": \"dark\"}, {\"name\": \"Travertine\", \"tone\": \"light\"}]},\n"
            "  \"lifestyle\":  {\"headline\": \"Slow Living\", \"narrative\": \"…\", "
            "\"rhythms\": [\"…\", \"…\"]},\n"
            "  \"cultural\":   {\"headline\": \"Milan Editorial\", "
            "\"narrative\": \"…\", \"references\": [\"…\", \"…\"]},\n"
            "  \"palette\":    {\"headline\": \"Quiet warmth\", "
            "\"swatches\": [{\"name\": \"…\", \"hex\": \"#…\"}]},\n"
            "  \"narrative\":  \"One editorial paragraph (~40 words) "
            "synthesising the moment\"\n"
            "}\n\n"
            "Rules: titles in Title Case, narratives 1–2 sentences, no markdown, "
            "no percentages, ALWAYS valid JSON."
        )
    return (
        "Di seguito i segnali raccolti per questa relazione:\n\n"
        f"{body}\n\n"
        "Produci un oggetto JSON con queste CHIAVI ESATTE:\n"
        "{\n"
        "  \"atmosphere\": {\"headline\": \"Warm Contemporary\", "
        "\"narrative\": \"…\", \"chips\": [\"…\", \"…\"]},\n"
        "  \"materials\":  {\"headline\": \"Direzione materica che si stabilizza\", "
        "\"narrative\": \"…\", \"materials\": [{\"name\": \"Rovere fumé\", "
        "\"tone\": \"dark\"}, {\"name\": \"Travertino\", \"tone\": \"light\"}]},\n"
        "  \"lifestyle\":  {\"headline\": \"Vivere lento\", \"narrative\": \"…\", "
        "\"rhythms\": [\"…\", \"…\"]},\n"
        "  \"cultural\":   {\"headline\": \"Milano editoriale\", "
        "\"narrative\": \"…\", \"references\": [\"…\", \"…\"]},\n"
        "  \"palette\":    {\"headline\": \"Calore contenuto\", "
        "\"swatches\": [{\"name\": \"…\", \"hex\": \"#…\"}]},\n"
        "  \"narrative\":  \"Un paragrafo editoriale (~40 parole) che sintetizza "
        "il momento\"\n"
        "}\n\n"
        "Regole: titoli in Title Case, narrazioni 1-2 frasi, niente markdown, "
        "niente percentuali, JSON SEMPRE valido."
    )


def _fallback(locale: str) -> Dict[str, Any]:
    """Quiet editorial placeholder when no signals or AI unavailable."""
    if locale == "en":
        return {
            "atmosphere": {
                "headline": "Atmosphere emerging",
                "narrative": "Too early to read a clear atmosphere. We are still listening.",
                "chips": ["Listening", "Curious"],
            },
            "materials": {
                "headline": "Material direction to be revealed",
                "narrative": "First material affinities will appear as the dialogue continues.",
                "materials": [],
            },
            "lifestyle": {"headline": "Rhythm to be discovered",
                          "narrative": "", "rhythms": []},
            "cultural": {"headline": "Cultural register opening",
                         "narrative": "", "references": []},
            "palette": {"headline": "Palette emerging", "swatches": []},
            "narrative": "The studio is listening. A first design direction will "
                         "appear after a few more conversations and references.",
        }
    return {
        "atmosphere": {
            "headline": "Atmosfera in ascolto",
            "narrative": "È ancora presto per leggere un'atmosfera chiara. Lo studio sta ascoltando.",
            "chips": ["In ascolto", "Curiosa"],
        },
        "materials": {
            "headline": "Direzione materica da rivelare",
            "narrative": "Le prime affinità materiche emergeranno con il dialogo.",
            "materials": [],
        },
        "lifestyle": {"headline": "Ritmo da scoprire",
                      "narrative": "", "rhythms": []},
        "cultural": {"headline": "Registro culturale in apertura",
                     "narrative": "", "references": []},
        "palette": {"headline": "Palette in formazione", "swatches": []},
        "narrative": "Lo studio è in ascolto. Una prima direzione progettuale "
                     "emergerà dopo qualche conversazione e qualche riferimento.",
    }


def _extract_json(text: str) -> Dict[str, Any]:
    """Tolerant JSON extractor — handles minor markdown leakage."""
    if not text:
        return {}
    text = text.strip()
    # strip code fences
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    # find first { … last }
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:  # noqa: BLE001
                return {}
    return {}


def distil(signals: List[Dict[str, Any]], locale: str = "it") -> Dict[str, Any]:
    """Public entry. Returns a dict matching the snapshot schema."""
    if not signals:
        return _fallback(locale)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
    except Exception:  # noqa: BLE001
        return _fallback(locale)

    try:
        chat = LlmChat(
            api_key=_emergent_key(),
            session_id=f"design-direction-{signals[0].get('lead_id') or 'x'}",
            system_message=SYSTEM_IT if locale == "it" else SYSTEM_EN,
        ).with_model(*DEFAULT_MODEL)
        prompt = _build_user_prompt(signals, locale)
        # LlmChat is async — wrap in asyncio
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                raise RuntimeError("nested loop")
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        out = loop.run_until_complete(chat.send_message(UserMessage(text=prompt)))
        data = _extract_json(out if isinstance(out, str) else getattr(out, "text", ""))
        if not data or "atmosphere" not in data:
            return _fallback(locale)
        return data
    except Exception as exc:  # noqa: BLE001
        fb = _fallback(locale)
        fb["_ai_error"] = str(exc)[:120]
        return fb
