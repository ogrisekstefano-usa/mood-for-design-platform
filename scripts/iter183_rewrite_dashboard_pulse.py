#!/usr/bin/env python3
"""ITER183 · P0.2 · Dashboard pulse + business critical i18n rewrites."""
import json
from pathlib import Path

I18N_DIR = Path("/app/frontend/src/i18n/strings")

IT_DASHBOARD_PULSE = {
    "eyebrow": "Dashboard · stato dei progetti",
    "loading_title": "Caricamento dashboard…",
    "greet": {
        "morning": "Buongiorno",
        "afternoon": "Buon pomeriggio",
        "evening": "Buonasera",
    },
    "summary": {
        "empty": "Nessun Design Journey attivo. Crea un Lead per iniziare.",
        "one": "{n} Design Journey attivo",
        "many": "{n} Design Journey attivi",
        "voices_today": "{n} feedback ricevuti oggi",
        "chapters_waiting": "{n} fasi in attesa",
        "revisions_open": "{n} revisioni aperte",
    },
    "sections": {
        "active": {
            "eyebrow": "Sezione principale",
            "title": "Design Journey attivi",
            "empty": "Nessun Design Journey attivo.",
            "cta": "Crea un nuovo Lead",
        },
        "voices": {
            "eyebrow": "Attività recenti",
            "title": "Feedback di oggi",
        },
        "waiting": {
            "eyebrow": "In attesa di feedback",
            "title": "Fasi condivise · in attesa di feedback",
        },
        "revisions": {
            "eyebrow": "Da rivedere",
            "title": "Revisioni aperte",
        },
        "evolutions": {
            "eyebrow": "Ultimi 7 giorni",
            "title": "Ultime evoluzioni",
        },
        "silent": {
            "eyebrow": "Inattivi",
            "title": "Design Journey™ inattivi",
        },
        "actions": {
            "eyebrow": "Prossime azioni",
            "title": "Dove ripartire",
        },
    },
    "card": {
        "last_voice": "Ultimo feedback · {when}",
        "opening": "In avvio",
    },
    "action": {
        "open_journey": "Apri il Journey",
        "presented_relative": "presentato {when}",
    },
    "relative": {
        "today": "oggi",
        "yesterday": "ieri",
        "days_ago": "{n} giorni fa",
    },
}

EN_DASHBOARD_PULSE = {
    "eyebrow": "Blueprint Dashboard · project cadence",
    "loading_title": "Loading dashboard…",
    "greet": {
        "morning": "Good morning",
        "afternoon": "Good afternoon",
        "evening": "Good evening",
    },
    "summary": {
        "empty": "No Design Journey active yet. Create a Lead to begin.",
        "one": "{n} Design Journey active",
        "many": "{n} Design Journeys active",
        "voices_today": "{n} feedback received today",
        "chapters_waiting": "{n} phases waiting",
        "revisions_open": "{n} revisions open",
    },
    "sections": {
        "active": {
            "eyebrow": "Primary section",
            "title": "Active Design Journeys",
            "empty": "No active Design Journey.",
            "cta": "Create a new Lead",
        },
        "voices": {
            "eyebrow": "Recent activity",
            "title": "Today's feedback",
        },
        "waiting": {
            "eyebrow": "Awaiting feedback",
            "title": "Shared phases · awaiting feedback",
        },
        "revisions": {
            "eyebrow": "To review",
            "title": "Open revisions",
        },
        "evolutions": {
            "eyebrow": "Last 7 days",
            "title": "Recent updates",
        },
        "silent": {
            "eyebrow": "Inactive",
            "title": "Inactive Design Journeys™",
        },
        "actions": {
            "eyebrow": "Next steps",
            "title": "Where to resume",
        },
    },
    "card": {
        "last_voice": "Last feedback · {when}",
        "opening": "Getting started",
    },
    "action": {
        "open_journey": "Open Journey",
        "presented_relative": "presented {when}",
    },
    "relative": {
        "today": "today",
        "yesterday": "yesterday",
        "days_ago": "{n} days ago",
    },
}


def deep_merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            deep_merge(dst[k], v)
        else:
            dst[k] = v


def patch(locale, dashboard_pulse):
    path = I18N_DIR / f"{locale}.json"
    data = json.loads(path.read_text())
    data.setdefault("dashboard", {})
    data["dashboard"]["pulse"] = dashboard_pulse
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"  {locale}: dashboard.pulse rewritten")


patch("it-IT", IT_DASHBOARD_PULSE)
patch("en-US", EN_DASHBOARD_PULSE)
patch("en-GB", EN_DASHBOARD_PULSE)
print("Done.")
