#!/usr/bin/env python3
"""ITER183 · P0.1.b · final-mile polish for derived locales."""
import json
from pathlib import Path

I18N_DIR = Path("/app/frontend/src/i18n/strings")

CASCADE = {
    "en-GB": {
        "No active journey registered with this relationship.":
            "No Design Journey open for this Account.",
        "Principal relationship": "Principal Account",
        "No record of this relationship has yet been registered.":
            "No activity logged for this Account yet.",
        "An Account is a relationship — a client, a practice, a household. Contacts are the people inside that relationship.":
            "An Account groups your business with a client, practice, or household. Contacts are the people inside that Account.",
        "All stages in the relationship": "All stages",
        "Relationship Graph™ · editorial cartography": "CRM Network · Account map",
    },
    "es-ES": {
        "Relationship Graph™ · territorio relacional y oficio editorial":
            "CRM Network · Mapa de cuentas",
    },
    "de-DE": {
        "Relationship Graph™ · redaktionelle Kartografie":
            "CRM Network · Account-Karte",
    },
    "fr-FR": {
        "Relationship Graph™ · la cartographie du regard éditorial":
            "CRM Network · Carte des comptes",
        "Séquence visuelle\n\n\nThis rewrite transforms the Italian \"Capitolo\" (chapter) int":
            "Phase",
    },
    "ar": {
        "Relationship Graph™ · خريطة السرد والحضور":
            "CRM Network · خريطة الحسابات",
    },
}


def replace_values(obj, mapping):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v in mapping:
                obj[k] = mapping[v]
            else:
                replace_values(v, mapping)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str) and v in mapping:
                obj[i] = mapping[v]
            else:
                replace_values(v, mapping)


for locale, mapping in CASCADE.items():
    path = I18N_DIR / f"{locale}.json"
    data = json.loads(path.read_text())
    replace_values(data, mapping)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"{locale}: applied {len(mapping)} replacements")
