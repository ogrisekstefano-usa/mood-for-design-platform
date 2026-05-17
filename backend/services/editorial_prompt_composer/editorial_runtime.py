"""editorial_runtime — orchestrator: system instructions + output contract.

Cuts the final composition brief by stitching all module fragments. The
result is a SINGLE, culturally-rich brief delivered to the editorial
engine as one system message + one user message — never a generic prompt.

Outputs must be STRICT JSON matching the OUTPUT_CONTRACT.
"""
from typing import Any, Dict, Optional
import json

from . import (
    master_direction, market_lens, hospitality_logic,
    luxury_perception, material_vocabulary, sensory_atmosphere,
    cta_psychology, seo_intent, memory_injector,
)


SYSTEM_INSTRUCTIONS = """\
You are MOOD for DESIGN™'s Editorial Director — an in-house editorial
intelligence trained on luxury interior design publishing. You write FOR
specific markets, not in generic "international English". Your prose
must read as if written by a local editorial director with real
architectural sensibility.

NON-NEGOTIABLE RULES
1. Never translate. Reinterpret. Variants for different markets MUST
   diverge in tone, pacing, hospitality codes, luxury framing, and
   material vocabulary — not just language.
2. Honour the hospitality_logic.welcome_register absolutely. The first
   paragraph IS the welcome.
3. Treat luxury_perception.anti_signal items as a lexical allergy.
4. Use material_vocabulary.palette for tactile references; treat
   lexicon.AVOID words as forbidden.
5. Let sensory_atmosphere INHABIT the prose — never describe atmosphere
   directly. Pace sentences to atmosphere.emotional_pacing.
6. CTAs are editorial transitions, not buttons. Frame each CTA with a
   1-2 sentence paragraph that earns the invitation.
7. SEO serves the editorial, never vice versa. Headlines are headlines,
   not keyword stacks. Meta description ≤ 155 chars, narrative voice.
8. Output STRICT JSON. No prose outside JSON. No commentary.
"""

OUTPUT_CONTRACT = {
    "title":          "string — published, editorial-grade headline in target_locale",
    "excerpt":        "string — 1-2 sentence dek in target_locale",
    "body_blocks":    "array of blocks: [{type:'paragraph'|'h2'|'pullquote', text:'…'}]",
    "cultural_angle": "string — 1-sentence editorial pitch (in target_locale)",
    "tone_label":     "string — value_key from the editorial_tone lookup (e.g. 'prestige_restraint')",
    "pacing_label":   "string — value_key from the editorial_pacing lookup (e.g. 'ceremonial')",
    "cta_set": [
        {
            "id":                 "string — slug, unique within variant",
            "tier":               "soft|medium|strong",
            "label":              "string — market-native CTA label",
            "action":             "string — concrete action key",
            "cta_intent":         "string — one of preferred_intents",
            "framing_paragraph":  "string — 1-2 sentence editorial transition",
        }
    ],
    "seo": {
        "seo_title":         "string — headline that reads like a magazine cover",
        "meta_description":  "string ≤ 155 chars — narrative",
        "hreflang":          "string — BCP-47 target locale",
        "focus_intent":      "string — single noun phrase",
    },
}


def build_composition_context(
    master: Dict[str, Any],
    market: Dict[str, Any],
    target_locale: str,
    sub_region: Optional[Dict[str, Any]] = None,
    tenant_id: Optional[str] = None,
    cta_seed: Optional[list] = None,
) -> Dict[str, Any]:
    """Stitch every module's fragment. Returns the composition context
    used both for the prompt and for the audit trail."""
    fragments = [
        master_direction.fragment(master),
        market_lens.fragment(market, sub_region),
        hospitality_logic.fragment(market, sub_region),
        luxury_perception.fragment(market),
        material_vocabulary.fragment(market),
        sensory_atmosphere.fragment(market, sub_region),
        cta_psychology.fragment(market, cta_seed),
        seo_intent.fragment(master, market, target_locale),
    ]
    if tenant_id:
        fragments.append(memory_injector.fragment(tenant_id, str(market["id"])))
    return {
        "target_locale":  target_locale,
        "fragments":      fragments,
        "output_contract": OUTPUT_CONTRACT,
    }


def compose_brief(context: Dict[str, Any], task: str = "compose") -> Dict[str, str]:
    """Render the system + user messages from a composition context.

    `task` ∈ {'compose', 'refine_angle', 'rebalance_tone', 'internal_translation'}.
    """
    task_directives = {
        "compose": (
            "Compose the FIRST market-native variant for this Editorial Direction. "
            "Honour every module. Output JSON matching OUTPUT_CONTRACT exactly."
        ),
        "refine_angle": (
            "An editor has REQUESTED revisions to refine the editorial angle. "
            "Read the revision_options carefully; produce a revised variant "
            "that addresses every option without losing the Master Direction. "
            "Output JSON matching OUTPUT_CONTRACT."
        ),
        "rebalance_tone": (
            "An editor wants the hospitality tone rebalanced. Adjust pacing, "
            "luxury framing, and CTA framing only — keep title and core "
            "argument. Output JSON matching OUTPUT_CONTRACT."
        ),
        "internal_translation": (
            "Produce an INTERNAL UNDERSTANDING TRANSLATION of the variant in "
            "the Blueprint editor's locale. This translation is for editorial "
            "review ONLY — it will NEVER be published, indexed, or served. "
            "Mirror title/excerpt/body_blocks faithfully; do NOT improve, "
            "shorten or stylise. Output JSON: "
            "{title, excerpt, body_blocks, _notice}."
        ),
    }
    user_msg = (
        f"TASK: {task_directives.get(task, task_directives['compose'])}\n\n"
        f"TARGET_LOCALE: {context['target_locale']}\n\n"
        f"COMPOSITION CONTEXT (modular):\n{json.dumps(context['fragments'], ensure_ascii=False, indent=2)}\n\n"
        f"OUTPUT_CONTRACT:\n{json.dumps(context['output_contract'], indent=2)}\n\n"
        "Return JSON ONLY. No prose outside the JSON object."
    )
    return {"system": SYSTEM_INSTRUCTIONS, "user": user_msg}
