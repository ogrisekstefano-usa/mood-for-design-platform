"""ITER148 Sprint A · Seed Relationship Question Catalog v2.

5 gruppi editoriali · 80-90% closed questions.

Idempotente · ON CONFLICT DO UPDATE su question_key e option (question_id, value).

Esegui:  python3 /app/backend/scripts/seed_relationship_catalog_v2.py
"""
from __future__ import annotations
import sys
import json
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND / '.env')

from database import db  # noqa: E402


# ─────────────────────────────────────────────────────────────────────
# CATALOG · 5 groups · all closed questions
# ─────────────────────────────────────────────────────────────────────
CATALOG: list[dict] = [
    {
        "group_key": "atmosphere",
        "display_order": 10,
        "label_default": "Che atmosfera cerchi?",
        "sublabel_default": "L'aria che vuoi respirare nei tuoi spazi.",
        "questions": [
            {
                "question_key": "atmosphere_dominant_v2",
                "question_type": "single_choice",
                "prompt_default": "Scegli l'atmosfera dominante.",
                "helper_default": "Una sola scelta · puoi cambiarla in qualsiasi momento.",
                "is_required": True,
                "display_order": 10,
                "options": [
                    {"value": "warm_enveloping",  "label_default": "Warm & enveloping",
                     "tag_cluster": ["warm_register","layered_register"], "atmosphere": ["warm_editorial"],
                     "cultural_register": "concierge"},
                    {"value": "minimal_silent",   "label_default": "Minimal & silent",
                     "tag_cluster": ["minimal_register","nordic_register"], "atmosphere": ["nordic_silence"],
                     "cultural_register": "editorial"},
                    {"value": "editorial_luxury", "label_default": "Editorial luxury",
                     "tag_cluster": ["editorial_aligned","luxury_segment"], "atmosphere": ["architectural_dawn"],
                     "cultural_register": "editorial",  "luxury_tier": "couture"},
                    {"value": "natural_calm",     "label_default": "Natural calm",
                     "tag_cluster": ["natural_register","slow_living"], "atmosphere": ["warm_editorial"],
                     "cultural_register": "concierge"},
                    {"value": "hospitality_insp", "label_default": "Hospitality inspired",
                     "tag_cluster": ["hospitality_register","public_facing"], "atmosphere": ["midnight_mood"],
                     "cultural_register": "consultative"},
                    {"value": "artistic_eclectic","label_default": "Artistic eclectic",
                     "tag_cluster": ["eclectic_register","collector_mindset"], "atmosphere": ["contemporary_classic"],
                     "cultural_register": "editorial"},
                    {"value": "soft_contemporary","label_default": "Soft contemporary",
                     "tag_cluster": ["contemporary_register","restrained_register"], "atmosphere": ["mid_century_refined"],
                     "cultural_register": "editorial"},
                    {"value": "timeless_elegance","label_default": "Timeless elegance",
                     "tag_cluster": ["classic_register","heritage_aligned"], "atmosphere": ["contemporary_classic"],
                     "cultural_register": "concierge",  "luxury_tier": "atelier"},
                ],
            },
        ],
    },
    {
        "group_key": "materials",
        "display_order": 20,
        "label_default": "Quali materiali ti rappresentano?",
        "sublabel_default": "Scegli fino a 4 · la materia racconta più delle parole.",
        "questions": [
            {
                "question_key": "material_affinities_v2",
                "question_type": "chips",
                "max_selections": 4,
                "prompt_default": "Le tue affinità materiche.",
                "helper_default": "Multi-selezione · fino a 4.",
                "is_required": True,
                "display_order": 10,
                "options": [
                    {"value": "walnut",        "label_default": "Walnut",
                     "tag_cluster": ["warm_materials","craft_oriented"], "material": ["wood"]},
                    {"value": "travertine",    "label_default": "Travertine",
                     "tag_cluster": ["natural_register","tactile_complex"], "material": ["stone"]},
                    {"value": "linen",         "label_default": "Linen",
                     "tag_cluster": ["soft_materials","tactile_warm"], "material": ["textile"]},
                    {"value": "bronze",        "label_default": "Bronze",
                     "tag_cluster": ["luxury_materials","architectural_grade"], "material": ["metal"]},
                    {"value": "marble",        "label_default": "Marble",
                     "tag_cluster": ["luxury_materials","architectural_grade"], "material": ["marble"]},
                    {"value": "smoked_glass",  "label_default": "Smoked glass",
                     "tag_cluster": ["transparent_register","cinematic_register"], "material": ["glass"]},
                    {"value": "natural_oak",   "label_default": "Natural oak",
                     "tag_cluster": ["warm_materials","natural_register"], "material": ["wood"]},
                    {"value": "matte_lacquer", "label_default": "Matte lacquer",
                     "tag_cluster": ["refined_materials","mid_century_register"], "material": ["lacquer"]},
                ],
            },
        ],
    },
    {
        "group_key": "lifestyle",
        "display_order": 30,
        "label_default": "Come vivi gli spazi?",
        "sublabel_default": "I tuoi rituali quotidiani · scegli fino a 3.",
        "questions": [
            {
                "question_key": "lifestyle_rituals",
                "question_type": "chips",
                "max_selections": 3,
                "prompt_default": "Lifestyle · come abiti il tempo.",
                "helper_default": "Multi-selezione · fino a 3.",
                "is_required": True,
                "display_order": 10,
                "options": [
                    {"value": "entertain_frequently", "label_default": "Entertain frequently",
                     "tag_cluster": ["hospitality_lifestyle","social_hosting"], "intent_weight": 0.04},
                    {"value": "family_oriented",     "label_default": "Family oriented",
                     "tag_cluster": ["family_lifestyle","multi_stakeholder"]},
                    {"value": "quiet_retreat",       "label_default": "Quiet retreat",
                     "tag_cluster": ["slow_living","editorial_aligned"]},
                    {"value": "work_from_home",      "label_default": "Work from home",
                     "tag_cluster": ["workspace_lifestyle","hybrid_living"]},
                    {"value": "social_hosting",      "label_default": "Social hosting",
                     "tag_cluster": ["hospitality_lifestyle","entertainment_focus"]},
                    {"value": "slow_living",         "label_default": "Slow living",
                     "tag_cluster": ["slow_living","natural_register"]},
                    {"value": "collector_mindset",   "label_default": "Collector mindset",
                     "tag_cluster": ["collector_mindset","artistic_eclectic"], "luxury_tier": "atelier"},
                ],
            },
        ],
    },
    {
        "group_key": "project_timing",
        "display_order": 40,
        "label_default": "Quando inizia il progetto?",
        "sublabel_default": "Il ritmo del tuo journey.",
        "questions": [
            {
                "question_key": "project_timing",
                "question_type": "single_choice",
                "prompt_default": "Orizzonte temporale.",
                "is_required": True,
                "display_order": 10,
                "options": [
                    {"value": "immediate",        "label_default": "Immediate",
                     "tag_cluster": ["active_phase","near_term_decision"], "intent_weight": 0.12},
                    {"value": "within_3_months",  "label_default": "Within 3 months",
                     "tag_cluster": ["active_phase","near_term_decision"], "intent_weight": 0.10},
                    {"value": "exploring_ideas",  "label_default": "Exploring ideas",
                     "tag_cluster": ["exploration_mode"], "intent_weight": 0.02},
                    {"value": "renovation_planned","label_default":"Renovation planned",
                     "tag_cluster": ["renovation_phase","mid_term_decision"], "intent_weight": 0.07},
                    {"value": "new_construction", "label_default": "New construction",
                     "tag_cluster": ["new_build","architectural_grade"], "intent_weight": 0.08},
                ],
            },
        ],
    },
    {
        "group_key": "budget_range",
        "display_order": 50,
        "label_default": "Il registro del tuo investimento.",
        "sublabel_default": "Nessun numero · solo registro editoriale.",
        "questions": [
            {
                "question_key": "budget_range_v2",
                "question_type": "single_choice",
                "prompt_default": "Registro di investimento.",
                "is_required": True,
                "display_order": 10,
                "options": [
                    {"value": "essential", "label_default": "Essential",
                     "tag_cluster": ["essential_tier","budget_aware"],
                     "luxury_tier": "exploratory"},
                    {"value": "refined",   "label_default": "Refined",
                     "tag_cluster": ["refined_tier","mid_invest"],
                     "luxury_tier": "pret_a_porter"},
                    {"value": "premium",   "label_default": "Premium",
                     "tag_cluster": ["premium_tier","high_invest"],
                     "luxury_tier": "couture",   "intent_weight": 0.06},
                    {"value": "bespoke",   "label_default": "Bespoke",
                     "tag_cluster": ["bespoke_tier","atelier_tier","custom_orientation"],
                     "luxury_tier": "atelier",   "intent_weight": 0.10},
                ],
            },
        ],
    },
]


def upsert_catalog() -> dict:
    client = db()
    groups_in = questions_in = options_in = 0
    groups_up = questions_up = options_up = 0

    for g_spec in CATALOG:
        existing_g = (client.table('relationship_question_groups').select('id')
                      .eq('group_key', g_spec['group_key']).limit(1).execute().data) or []
        g_row = {
            "group_key":             g_spec["group_key"],
            "display_order":         g_spec["display_order"],
            "label_default":         g_spec["label_default"],
            "sublabel_default":      g_spec.get("sublabel_default"),
            "applies_to_lead_type":  g_spec.get("applies_to_lead_type"),
            "is_active":             True,
        }
        if existing_g:
            g_id = existing_g[0]['id']
            client.table('relationship_question_groups').update(g_row).eq('id', g_id).execute()
            groups_up += 1
        else:
            ins = client.table('relationship_question_groups').insert(g_row).execute()
            g_id = ins.data[0]['id']
            groups_in += 1

        for q_spec in g_spec.get('questions', []):
            existing_q = (client.table('relationship_questions').select('id')
                          .eq('question_key', q_spec['question_key']).limit(1).execute().data) or []
            q_row = {
                "group_id":             g_id,
                "question_key":         q_spec["question_key"],
                "question_type":        q_spec["question_type"],
                "max_selections":       q_spec.get("max_selections"),
                "prompt_default":       q_spec["prompt_default"],
                "helper_default":       q_spec.get("helper_default"),
                "is_required":          bool(q_spec.get("is_required")),
                "display_order":        q_spec.get("display_order", 100),
                "applies_to_lead_type": q_spec.get("applies_to_lead_type"),
                "is_active":            True,
            }
            if existing_q:
                q_id = existing_q[0]['id']
                client.table('relationship_questions').update(q_row).eq('id', q_id).execute()
                questions_up += 1
            else:
                ins = client.table('relationship_questions').insert(q_row).execute()
                q_id = ins.data[0]['id']
                questions_in += 1

            for idx, o_spec in enumerate(q_spec.get('options', [])):
                existing_o = (client.table('relationship_question_options').select('id')
                              .eq('question_id', q_id).eq('value', o_spec['value'])
                              .limit(1).execute().data) or []
                o_row = {
                    "question_id":     q_id,
                    "value":           o_spec["value"],
                    "label_default":   o_spec["label_default"],
                    "helper_default":  o_spec.get("helper_default"),
                    "tag_cluster":     o_spec.get("tag_cluster") or [],
                    "atmosphere":      o_spec.get("atmosphere") or [],
                    "material":        o_spec.get("material") or [],
                    "cultural_register": o_spec.get("cultural_register"),
                    "luxury_tier":     o_spec.get("luxury_tier"),
                    "intent_weight":   float(o_spec.get("intent_weight") or 0.0),
                    "image_url":       o_spec.get("image_url"),
                    "display_order":   o_spec.get("display_order", (idx + 1) * 10),
                    "is_active":       True,
                }
                if existing_o:
                    client.table('relationship_question_options').update(o_row)\
                        .eq('id', existing_o[0]['id']).execute()
                    options_up += 1
                else:
                    client.table('relationship_question_options').insert(o_row).execute()
                    options_in += 1

    return {
        "groups": {"inserted": groups_in, "updated": groups_up},
        "questions": {"inserted": questions_in, "updated": questions_up},
        "options": {"inserted": options_in, "updated": options_up},
    }


if __name__ == "__main__":
    print(json.dumps(upsert_catalog(), indent=2))
