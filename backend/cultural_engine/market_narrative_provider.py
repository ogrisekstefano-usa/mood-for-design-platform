"""Layer 5 — Market Narrative Provider™.

Lettura dei `market_narrative_profiles` dalla tabella curata. Fornisce:
  • `get_profile(market_code)` — restituisce dict con bias + curator note + suggerimenti
  • `build_market_influence_block(profile)` — costruisce il blocco di prompt
    che modula (NON sovrascrive) la Brand Voice nell'editorial_interpreter.

PRINCIPIO: soft influence. Il profilo aggiunge una **inclinazione culturale**
al system prompt — la Brand Voice resta sempre rispettata. Esempio:
studio milanese tecnico + Miami → l'output suona milanese-tecnico ma più
caldo/lifestyle, NON diventa magicamente uno studio californiano.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from database import db

logger = logging.getLogger(__name__)

# Cache in-memory (i profili sono pochi, statici, curati).
_PROFILE_CACHE: Dict[str, Dict[str, Any]] = {}


def _row_to_profile(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalizza i campi JSONB del database in liste Python pure."""
    def _as_list(v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                import json
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return []
    return {
        "id":                       row.get("id"),
        "market_code":              row.get("market_code"),
        "label":                    row.get("label"),
        "narrative_direction":      _as_list(row.get("narrative_direction")),
        "narrative_intensity_bias": row.get("narrative_intensity_bias"),
        "vocabulary_bias":          _as_list(row.get("vocabulary_bias")),
        "emotional_bias":           _as_list(row.get("emotional_bias")),
        "hospitality_bias":         _as_list(row.get("hospitality_bias")),
        "luxury_expression":        row.get("luxury_expression"),
        "storytelling_density":     row.get("storytelling_density"),
        "editorial_style":          row.get("editorial_style"),
        "anti_patterns":            _as_list(row.get("anti_patterns")),
        "curator_note":             row.get("curator_note"),
        "suggested_narrative_mode": row.get("suggested_narrative_mode"),
        "suggested_intensity":      row.get("suggested_intensity"),
    }


def get_profile(market_code: str, use_cache: bool = True) -> Optional[Dict[str, Any]]:
    """Read a single curated profile from the database.

    Returns None if no profile is curated for that market_code.
    """
    if not market_code:
        return None
    if use_cache and market_code in _PROFILE_CACHE:
        return _PROFILE_CACHE[market_code]
    try:
        rows = (db().table("market_narrative_profiles").select("*")
                .eq("market_code", market_code).limit(1).execute().data or [])
        if not rows:
            return None
        profile = _row_to_profile(rows[0])
        _PROFILE_CACHE[market_code] = profile
        return profile
    except Exception as e:
        logger.warning(f"market_narrative_provider.get_profile({market_code}) failed: {e}")
        return None


def list_profiles() -> Dict[str, Dict[str, Any]]:
    """Read all curated profiles as a {market_code: profile} dict."""
    try:
        rows = (db().table("market_narrative_profiles").select("*").execute().data or [])
        out = {}
        for r in rows:
            p = _row_to_profile(r)
            out[p["market_code"]] = p
            _PROFILE_CACHE[p["market_code"]] = p
        return out
    except Exception as e:
        logger.warning(f"market_narrative_provider.list_profiles failed: {e}")
        return {}


def build_market_influence_block(profile: Optional[Dict[str, Any]]) -> str:
    """Build the soft-influence block that goes INTO the editorial system prompt.

    The block is phrased as cultural *inclination*, NOT as identity override.
    The studio's Brand Voice keeps the lead — the market only *colours* it.
    """
    if not profile:
        return ""
    lines: list[str] = [
        f"INFLUENZA CULTURALE DEL MERCATO · {profile.get('label')}:",
        "Questa influenza modula il registro SENZA sovrascrivere l'identità dello studio.",
        "La voce dello studio resta dominante, il mercato la colora.",
    ]
    if profile.get("curator_note"):
        lines.append(f"- Direzione editoriale del mercato: {profile['curator_note']}")
    if profile.get("narrative_direction"):
        lines.append("- Inclinazione narrativa: " + ", ".join(profile["narrative_direction"]))
    if profile.get("vocabulary_bias"):
        lines.append("- Lessico da prediligere: " + ", ".join(profile["vocabulary_bias"]))
    if profile.get("emotional_bias"):
        lines.append("- Tonalità emotiva: " + ", ".join(profile["emotional_bias"]))
    if profile.get("hospitality_bias"):
        lines.append("- Profilo ospitalità: " + ", ".join(profile["hospitality_bias"]))
    if profile.get("luxury_expression"):
        lines.append(f"- Espressione del lusso: {profile['luxury_expression']}")
    if profile.get("storytelling_density"):
        lines.append(f"- Densità del racconto: {profile['storytelling_density']}")
    if profile.get("editorial_style"):
        lines.append(f"- Riferimento editoriale: {profile['editorial_style']}")
    if profile.get("anti_patterns"):
        lines.append("- Da evitare per non snaturare questo mercato: " + ", ".join(profile["anti_patterns"]))
    lines.append(
        "REGOLA: l'identità dello studio resta riconoscibile. Il mercato non cancella "
        "la Brand Voice, la *ribilancia* culturalmente."
    )
    return "\n".join(lines)


def applied_biases_snapshot(profile: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Snapshot dei bias effettivamente passati al Layer 3, da persistere
    sulla draft per future analisi (Cultural Pattern Learning™)."""
    if not profile:
        return {}
    return {
        "market_code":         profile.get("market_code"),
        "label":               profile.get("label"),
        "narrative_direction": profile.get("narrative_direction"),
        "vocabulary_bias":     profile.get("vocabulary_bias"),
        "emotional_bias":      profile.get("emotional_bias"),
        "luxury_expression":   profile.get("luxury_expression"),
        "anti_patterns":       profile.get("anti_patterns"),
    }
