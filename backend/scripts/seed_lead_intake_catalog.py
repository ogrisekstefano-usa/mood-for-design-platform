"""ITER148 · Phase 1 · Seed Closed-Question Catalog v2.

15 domande chiuse + 1 narrative open · idempotente (ON CONFLICT).

Architettura editoriale, NON enterprise:
  - Ogni opzione mappa a:
      tag_cluster        → behavioral_tags (max statistical signal)
      atmosphere         → atmosphere_signals
      material           → material_signals
      cultural_register  → 'editorial'|'concierge'|'consultative'|'discovery'
      luxury_tier        → 'atelier'|'couture'|'pret_a_porter'|'exploratory'
      intent_weight      → contribuisce a progression_score (0.0 - 0.2 cap)

Esegui:  python3 /app/backend/scripts/seed_lead_intake_catalog.py
"""
from __future__ import annotations

import os
import sys
import json
from pathlib import Path

# bootstrap
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND / '.env')

from database import db  # noqa: E402


# ─────────────────────────────────────────────────────────────────────
# QUESTION CATALOG · 15 closed + 1 optional open
# ─────────────────────────────────────────────────────────────────────
QUESTIONS: list[dict] = [
    # ── SECTION A · SPACE (5) ───────────────────────────────────────
    {
        "question_key": "space_typology",
        "section_key": "space",
        "question_type": "single",
        "max_selections": None,
        "is_required": True,
        "display_order": 10,
        "applies_to_lead_type": "private_client",
        "options": [
            {"value": "residence",          "tag_cluster": ["residential","private_living"]},
            {"value": "apartment",          "tag_cluster": ["residential","urban_living"]},
            {"value": "villa",              "tag_cluster": ["residential","large_estate","architectural_grade"]},
            {"value": "penthouse",          "tag_cluster": ["residential","urban_living","high_invest"]},
            {"value": "showroom",           "tag_cluster": ["retail","public_facing","brand_narrative"]},
            {"value": "hospitality_hotel",  "tag_cluster": ["hospitality","public_facing","complex_brief"]},
            {"value": "hospitality_restaurant","tag_cluster":["hospitality","public_facing","sensorial_focus"]},
            {"value": "office",             "tag_cluster": ["corporate","workspace"]},
            {"value": "retail",             "tag_cluster": ["retail","public_facing","brand_narrative"]},
            {"value": "yacht",              "tag_cluster": ["mobility","luxury_segment","compact_complex"]},
            {"value": "dedicated_space",    "tag_cluster": ["specialty","custom_brief"]},
        ],
    },
    {
        "question_key": "space_size",
        "section_key": "space",
        "question_type": "single",
        "is_required": True,
        "display_order": 20,
        "options": [
            {"value": "under_80",   "tag_cluster": ["compact_scale"]},
            {"value": "80_150",    "tag_cluster": ["mid_scale"]},
            {"value": "150_300",   "tag_cluster": ["generous_scale"]},
            {"value": "300_600",   "tag_cluster": ["large_scale","complex_brief"]},
            {"value": "over_600",  "tag_cluster": ["extra_large_scale","complex_brief","architectural_grade"]},
        ],
    },
    {
        "question_key": "space_phase",
        "section_key": "space",
        "question_type": "single",
        "is_required": True,
        "display_order": 30,
        "options": [
            {"value": "ideation",         "tag_cluster": ["early_phase","exploration_mode"],
             "intent_weight": 0.03},
            {"value": "renovation",       "tag_cluster": ["renovation_phase","active_phase"],
             "intent_weight": 0.08},
            {"value": "new_build",        "tag_cluster": ["new_build","architectural_grade"],
             "intent_weight": 0.08},
            {"value": "restyling",        "tag_cluster": ["restyling","light_touch"],
             "intent_weight": 0.06},
            {"value": "post_acquisition", "tag_cluster": ["post_acquisition","near_term_decision"],
             "intent_weight": 0.1},
        ],
    },
    {
        "question_key": "space_ownership",
        "section_key": "space",
        "question_type": "single",
        "is_required": False,
        "display_order": 40,
        "options": [
            {"value": "owner",            "tag_cluster": ["owner_decision_maker"], "intent_weight": 0.04},
            {"value": "tenant",           "tag_cluster": ["tenant","constrained_decision"]},
            {"value": "family_property",  "tag_cluster": ["family_decision","multi_stakeholder"]},
            {"value": "investor",         "tag_cluster": ["investor","yield_orientation"], "intent_weight": 0.04},
            {"value": "corporate",        "tag_cluster": ["corporate_decision","multi_stakeholder"]},
        ],
    },
    {
        "question_key": "space_location_type",
        "section_key": "space",
        "question_type": "single",
        "is_required": False,
        "display_order": 50,
        "options": [
            {"value": "city_center",       "tag_cluster": ["urban_center","brand_visibility"]},
            {"value": "residential_area",  "tag_cluster": ["residential_calm"]},
            {"value": "seaside",           "tag_cluster": ["seaside","mediterranean_register"],
             "atmosphere": ["mediterranean_light"]},
            {"value": "countryside",       "tag_cluster": ["countryside","slow_living"],
             "atmosphere": ["warm_editorial"]},
            {"value": "mountain",          "tag_cluster": ["mountain","alpine_register"],
             "atmosphere": ["nordic_silence"]},
            {"value": "historic_district", "tag_cluster": ["historic","heritage_brief"],
             "atmosphere": ["contemporary_classic"]},
        ],
    },

    # ── SECTION B · ATMOSPHERE (3) ──────────────────────────────────
    {
        "question_key": "atmosphere_dominant",
        "section_key": "atmosphere",
        "question_type": "multi",
        "max_selections": 3,
        "is_required": True,
        "display_order": 110,
        "options": [
            {"value": "nordic_silence",       "tag_cluster": ["nordic_register","minimalist_register"],
             "atmosphere": ["nordic_silence"]},
            {"value": "warm_editorial",       "tag_cluster": ["warm_register","editorial_aligned"],
             "atmosphere": ["warm_editorial"]},
            {"value": "architectural_dawn",   "tag_cluster": ["architectural_register","light_aware"],
             "atmosphere": ["architectural_dawn"]},
            {"value": "midnight_mood",        "tag_cluster": ["cinematic_register","dramatic_aligned"],
             "atmosphere": ["midnight_mood"]},
            {"value": "mediterranean_light",  "tag_cluster": ["mediterranean_register","sun_aware"],
             "atmosphere": ["mediterranean_light"]},
            {"value": "japandi",              "tag_cluster": ["japandi_register","minimalist_register","tactile_calm"],
             "atmosphere": ["japandi"]},
            {"value": "brutalist_calm",       "tag_cluster": ["brutalist_register","architectural_grade"],
             "atmosphere": ["brutalist_calm"]},
            {"value": "mid_century_refined",  "tag_cluster": ["mid_century_register","craft_oriented"],
             "atmosphere": ["mid_century_refined"]},
            {"value": "contemporary_classic", "tag_cluster": ["classic_register","heritage_aligned"],
             "atmosphere": ["contemporary_classic"]},
        ],
    },
    {
        "question_key": "mood_register",
        "section_key": "atmosphere",
        "question_type": "single",
        "is_required": True,
        "display_order": 120,
        "options": [
            {"value": "minimal",    "tag_cluster": ["minimal_register"], "cultural_register": "editorial"},
            {"value": "layered",    "tag_cluster": ["layered_register","narrative_rich"], "cultural_register": "concierge"},
            {"value": "bold",       "tag_cluster": ["bold_register","statement_oriented"], "cultural_register": "consultative"},
            {"value": "restrained", "tag_cluster": ["restrained_register","editorial_aligned"], "cultural_register": "editorial"},
            {"value": "sensorial",  "tag_cluster": ["sensorial_register","tactile_complex"], "cultural_register": "concierge"},
        ],
    },
    {
        "question_key": "light_preference",
        "section_key": "atmosphere",
        "question_type": "single",
        "is_required": False,
        "display_order": 130,
        "options": [
            {"value": "cinematic_dim",      "tag_cluster": ["cinematic_light"], "atmosphere": ["midnight_mood"]},
            {"value": "natural_north",      "tag_cluster": ["northern_light"], "atmosphere": ["nordic_silence"]},
            {"value": "mediterranean_bright","tag_cluster": ["mediterranean_light"], "atmosphere": ["mediterranean_light"]},
            {"value": "mixed_warm",         "tag_cluster": ["warm_light","layered_register"], "atmosphere": ["warm_editorial"]},
            {"value": "dramatic_contrast",  "tag_cluster": ["dramatic_light","statement_oriented"], "atmosphere": ["midnight_mood"]},
        ],
    },

    # ── SECTION C · MATERIAL (2) ────────────────────────────────────
    {
        "question_key": "material_affinities",
        "section_key": "material",
        "question_type": "multi",
        "max_selections": 4,
        "is_required": True,
        "display_order": 210,
        "options": [
            {"value": "marble",             "tag_cluster": ["luxury_materials","tactile_complex","architectural_grade"],
             "material": ["marble"]},
            {"value": "natural_wood",       "tag_cluster": ["warm_materials","craft_oriented"],
             "material": ["wood"]},
            {"value": "brushed_metal",      "tag_cluster": ["architectural_grade","industrial_register"],
             "material": ["metal"]},
            {"value": "textile_natural",    "tag_cluster": ["soft_materials","tactile_warm"],
             "material": ["textile"]},
            {"value": "glass",              "tag_cluster": ["transparent_register","architectural_grade"],
             "material": ["glass"]},
            {"value": "concrete",           "tag_cluster": ["brutalist_register","architectural_grade"],
             "material": ["concrete"]},
            {"value": "stone_porous",       "tag_cluster": ["natural_register","tactile_complex"],
             "material": ["stone"]},
            {"value": "leather",            "tag_cluster": ["luxury_materials","tactile_warm"],
             "material": ["leather"]},
            {"value": "ceramic_artisan",    "tag_cluster": ["craft_oriented","artisanal_register"],
             "material": ["ceramic"]},
            {"value": "lacquered_surfaces", "tag_cluster": ["refined_materials","mid_century_register"],
             "material": ["lacquer"]},
        ],
    },
    {
        "question_key": "material_avoid",
        "section_key": "material",
        "question_type": "multi",
        "max_selections": 3,
        "is_required": False,
        "display_order": 220,
        "options": [
            {"value": "chrome",             "tag_cluster": ["avoid_chrome"]},
            {"value": "high_gloss",         "tag_cluster": ["avoid_gloss","restrained_register"]},
            {"value": "industrial_steel",   "tag_cluster": ["avoid_industrial"]},
            {"value": "plastic_composite",  "tag_cluster": ["avoid_synthetic","natural_register"]},
            {"value": "none",               "tag_cluster": ["material_open"]},
        ],
    },

    # ── SECTION D · CULTURAL & DECISIONAL (3) ───────────────────────
    {
        "question_key": "cultural_register_preference",
        "section_key": "cultural",
        "question_type": "single",
        "is_required": True,
        "display_order": 310,
        "options": [
            {"value": "editorial",    "tag_cluster": ["editorial_aligned"],   "cultural_register": "editorial"},
            {"value": "concierge",    "tag_cluster": ["concierge_aligned"],   "cultural_register": "concierge"},
            {"value": "consultative", "tag_cluster": ["consultative_aligned"],"cultural_register": "consultative"},
            {"value": "discovery",    "tag_cluster": ["discovery_phase"],     "cultural_register": "discovery"},
        ],
    },
    {
        "question_key": "decision_horizon",
        "section_key": "cultural",
        "question_type": "single",
        "is_required": True,
        "display_order": 320,
        "options": [
            {"value": "immediate",    "tag_cluster": ["active_phase","near_term_decision"], "intent_weight": 0.12},
            {"value": "within_3m",    "tag_cluster": ["active_phase","near_term_decision"], "intent_weight": 0.1},
            {"value": "within_6m",    "tag_cluster": ["mid_term_decision"],                 "intent_weight": 0.06},
            {"value": "within_year",  "tag_cluster": ["long_horizon"],                      "intent_weight": 0.03},
            {"value": "exploring",    "tag_cluster": ["exploration_mode"],                  "intent_weight": 0.01},
        ],
    },
    {
        "question_key": "budget_register",
        "section_key": "cultural",
        "question_type": "single",
        "is_required": True,
        "display_order": 330,
        "options": [
            {"value": "atelier",        "tag_cluster": ["atelier_tier","high_invest","custom_orientation"],
             "luxury_tier": "atelier",        "intent_weight": 0.08},
            {"value": "couture",        "tag_cluster": ["couture_tier","high_invest"],
             "luxury_tier": "couture",        "intent_weight": 0.06},
            {"value": "pret_a_porter",  "tag_cluster": ["pret_a_porter_tier","mid_invest"],
             "luxury_tier": "pret_a_porter",  "intent_weight": 0.03},
            {"value": "exploratory",    "tag_cluster": ["exploratory_tier","budget_undefined"],
             "luxury_tier": "exploratory"},
        ],
    },

    # ── SECTION E · ENGAGEMENT (2) ──────────────────────────────────
    {
        "question_key": "preferred_cadence",
        "section_key": "engagement",
        "question_type": "single",
        "is_required": False,
        "display_order": 410,
        "options": [
            {"value": "weekly",      "tag_cluster": ["editorial_cadence","high_engagement_potential"], "intent_weight": 0.05},
            {"value": "biweekly",    "tag_cluster": ["editorial_cadence","mid_engagement_potential"], "intent_weight": 0.03},
            {"value": "monthly",     "tag_cluster": ["editorial_cadence","calm_engagement"]},
            {"value": "on_my_pace",  "tag_cluster": ["on_demand_engagement"]},
        ],
    },
    {
        "question_key": "preferred_channel",
        "section_key": "engagement",
        "question_type": "single",
        "is_required": False,
        "display_order": 420,
        "options": [
            {"value": "editorial_email", "tag_cluster": ["channel_email","editorial_aligned"]},
            {"value": "studio_visit",    "tag_cluster": ["channel_in_person","concierge_aligned"],   "intent_weight": 0.05},
            {"value": "video_call",      "tag_cluster": ["channel_video","consultative_aligned"]},
            {"value": "whatsapp_concierge","tag_cluster": ["channel_whatsapp","concierge_aligned"]},
            {"value": "written",         "tag_cluster": ["channel_written","editorial_aligned"]},
        ],
    },

    # ── SECTION F · NARRATIVE (1 open · OPTIONAL enrichment) ────────
    {
        "question_key": "narrative_seed",
        "section_key": "narrative",
        "question_type": "open",
        "is_required": False,
        "display_order": 510,
        "options": [],
    },
]


def upsert_questions() -> dict:
    client = db()
    inserted = 0
    updated = 0
    for q in QUESTIONS:
        existing = (client.table('lead_intake_questions')
                    .select('id')
                    .eq('question_key', q['question_key'])
                    .limit(1).execute().data) or []
        row = {
            "question_key":         q["question_key"],
            "section_key":          q["section_key"],
            "question_type":        q["question_type"],
            "max_selections":       q.get("max_selections"),
            "options":              q.get("options") or [],
            "is_required":          bool(q.get("is_required")),
            "display_order":        int(q.get("display_order", 100)),
            "applies_to_lead_type": q.get("applies_to_lead_type"),
            "is_active":            True,
        }
        if existing:
            client.table('lead_intake_questions').update(row)\
                .eq('id', existing[0]['id']).execute()
            updated += 1
        else:
            client.table('lead_intake_questions').insert(row).execute()
            inserted += 1
    return {"inserted": inserted, "updated": updated, "total": len(QUESTIONS)}


if __name__ == "__main__":
    result = upsert_questions()
    print(json.dumps(result, indent=2))
