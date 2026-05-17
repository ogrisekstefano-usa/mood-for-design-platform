"""Editorial Prompt Composer™ — modular composition for market-native variants.

NOT a generic AI writing wrapper. Each module returns a **structured prompt
fragment** carrying a specific layer of editorial intelligence:

  master_direction      — the central editorial intent (Master)
  market_lens           — the market's cultural register
  hospitality_logic     — how the market expects to be welcomed
  luxury_perception     — what counts as luxury HERE (≠ everywhere)
  material_vocabulary   — the materials the market actually recognises
  sensory_atmosphere    — light, tactility, spatial feeling, emotional pacing
  cta_psychology        — how invitations should be staged
  seo_intent            — editorial-grade intent (NOT keyword spam)
  memory_injector       — accumulated Market Learning patterns
  editorial_runtime     — system instructions + output contract

The composer cuts a single, culturally-rich brief. Never a generic prompt.
"""
from .editorial_runtime import build_composition_context, compose_brief

__all__ = ["build_composition_context", "compose_brief"]
