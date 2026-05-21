"""Editorial Taxonomy Localization Layer™ — Sprint JOURNEY-TAXONOMY-I18N
(iter118).

Central registry that decouples technical keys (lifecycle_state,
step_status, crm_stage, etc.) from their editorial labels in 7 locales.

Core principles
───────────────
1. Backend enums stay TECHNICAL (`conversation_open`, `in_progress`, ...).
   The label NEVER leaks into the database or the seed scripts.
2. Editorial labels live HERE. They are governed by Translation Studio™
   in future iterations.
3. The resolver implements the fallback chain:
       requested_locale → en-US → it (source) → key literal
4. Two parallel taxonomies exist for journey lifecycle:
       - 'journey_lifecycle_client'  (softer, narrated for the client)
       - 'journey_lifecycle_studio'  (operational, sharper)
   They share the same technical keys but render different labels.
"""
from __future__ import annotations

from typing import Dict, Optional

# Fallback chain · the resolver walks this order until it finds a label.
TAXONOMY_FALLBACK_CHAIN = ("en-US", "it")
TAXONOMY_SOURCE_LOCALE = "it"   # editorial source

# All editorial taxonomies. Each block is `{ key: { locale: label } }`.
# Keys are deliberately stable (snake_case english) and are the
# contract surface between backend logic and frontend rendering.
TAXONOMY: Dict[str, Dict[str, Dict[str, str]]] = {
    # ── JOURNEY LIFECYCLE · client narration ────────────────────
    "journey_lifecycle_client": {
        "conversation_open": {
            "it":    "La conversazione è iniziata",
            "en-US": "The conversation has begun",
            "en-GB": "The conversation has begun",
            "fr":    "La conversation a commencé",
            "de":    "Das Gespräch hat begonnen",
            "es":    "La conversación ha comenzado",
            "ar":    "بدأ الحوار",
        },
        "in_progress": {
            "it":    "Il viaggio è in corso",
            "en-US": "The journey is unfolding",
            "en-GB": "The journey is unfolding",
            "fr":    "Le voyage est en cours",
            "de":    "Die Reise entfaltet sich",
            "es":    "El viaje está en curso",
            "ar":    "الرحلة جارية",
        },
        "presenting": {
            "it":    "Nuove direzioni condivise",
            "en-US": "New directions shared",
            "en-GB": "New directions shared",
            "fr":    "Nouvelles directions partagées",
            "de":    "Neue Richtungen geteilt",
            "es":    "Nuevas direcciones compartidas",
            "ar":    "اتجاهات جديدة مشتركة",
        },
        "drifting": {
            "it":    "In ascolto del tuo riscontro",
            "en-US": "Listening for your response",
            "en-GB": "Listening for your response",
            "fr":    "À l'écoute de votre retour",
            "de":    "Wartet auf Ihre Rückmeldung",
            "es":    "A la escucha de tu respuesta",
            "ar":    "في انتظار صدى منك",
        },
        "on_pause": {
            "it":    "In pausa",
            "en-US": "On pause",
            "en-GB": "On pause",
            "fr":    "En pause",
            "de":    "Pausiert",
            "es":    "En pausa",
            "ar":    "في توقّف",
        },
        "approved": {
            "it":    "Direzione approvata",
            "en-US": "Direction approved",
            "en-GB": "Direction approved",
            "fr":    "Direction approuvée",
            "de":    "Richtung bestätigt",
            "es":    "Dirección aprobada",
            "ar":    "تمّت الموافقة على الاتجاه",
        },
        "closed": {
            "it":    "Memoria della casa",
            "en-US": "Memory of the home",
            "en-GB": "Memory of the home",
            "fr":    "Mémoire de la maison",
            "de":    "Erinnerung des Hauses",
            "es":    "Memoria de la casa",
            "ar":    "ذاكرة البيت",
        },
        "archived": {
            "it":    "Memoria della casa",
            "en-US": "Memory of the home",
            "en-GB": "Memory of the home",
            "fr":    "Mémoire de la maison",
            "de":    "Erinnerung des Hauses",
            "es":    "Memoria de la casa",
            "ar":    "ذاكرة البيت",
        },
        "editioned": {
            "it":    "Edizione culturale",
            "en-US": "Cultural edition",
            "en-GB": "Cultural edition",
            "fr":    "Édition culturelle",
            "de":    "Kulturelle Edition",
            "es":    "Edición cultural",
            "ar":    "إصدار ثقافي",
        },
        "abandoned": {
            "it":    "Viaggio sospeso",
            "en-US": "Journey suspended",
            "en-GB": "Journey suspended",
            "fr":    "Voyage suspendu",
            "de":    "Reise unterbrochen",
            "es":    "Viaje suspendido",
            "ar":    "رحلة معلّقة",
        },
    },

    # ── JOURNEY LIFECYCLE · studio operational ──────────────────
    "journey_lifecycle_studio": {
        "conversation_open": {
            "it":    "Conversazione aperta",
            "en-US": "Opening Conversation",
            "en-GB": "Opening Conversation",
            "fr":    "Conversation initiale",
            "de":    "Erstes Gespräch",
            "es":    "Conversación inicial",
            "ar":    "محادثة افتتاحية",
        },
        "in_progress": {
            "it":    "Viaggio in corso",
            "en-US": "Journey unfolding",
            "en-GB": "Journey unfolding",
            "fr":    "Voyage en cours",
            "de":    "Reise im Lauf",
            "es":    "Viaje en curso",
            "ar":    "رحلة جارية",
        },
        "presenting": {
            "it":    "Direzione presentata",
            "en-US": "Direction presented",
            "en-GB": "Direction presented",
            "fr":    "Direction présentée",
            "de":    "Richtung präsentiert",
            "es":    "Dirección presentada",
            "ar":    "اتجاه مُقدَّم",
        },
        "drifting": {
            "it":    "In revisione",
            "en-US": "In revision",
            "en-GB": "In revision",
            "fr":    "En révision",
            "de":    "In Überarbeitung",
            "es":    "En revisión",
            "ar":    "قيد المراجعة",
        },
        "on_pause": {
            "it":    "In pausa",
            "en-US": "On pause",
            "en-GB": "On pause",
            "fr":    "En pause",
            "de":    "Pausiert",
            "es":    "En pausa",
            "ar":    "في توقّف",
        },
        "approved": {
            "it":    "Progetto vinto",
            "en-US": "Journey confirmed",
            "en-GB": "Journey confirmed",
            "fr":    "Journey confirmé",
            "de":    "Journey bestätigt",
            "es":    "Journey confirmado",
            "ar":    "Journey مُؤكَّد",
        },
        "closed": {
            "it":    "Archivio firmato",
            "en-US": "Signed archive",
            "en-GB": "Signed archive",
            "fr":    "Archive signée",
            "de":    "Signiertes Archiv",
            "es":    "Archivo firmado",
            "ar":    "أرشيف موقّع",
        },
        "archived": {
            "it":    "Archivio firmato",
            "en-US": "Signed archive",
            "en-GB": "Signed archive",
            "fr":    "Archive signée",
            "de":    "Signiertes Archiv",
            "es":    "Archivo firmado",
            "ar":    "أرشيف موقّع",
        },
        "editioned": {
            "it":    "Edizione culturale",
            "en-US": "Cultural edition",
            "en-GB": "Cultural edition",
            "fr":    "Édition culturelle",
            "de":    "Kulturelle Edition",
            "es":    "Edición cultural",
            "ar":    "إصدار ثقافي",
        },
        "abandoned": {
            "it":    "Journey sospeso",
            "en-US": "Journey paused",
            "en-GB": "Journey paused",
            "fr":    "Journey suspendu",
            "de":    "Journey pausiert",
            "es":    "Journey suspendido",
            "ar":    "Journey مُعلَّق",
        },
    },

    # ── STEP STATUS · the state of a milestone within a journey ──
    "step_status": {
        "not_started": {
            "it":    "Capitolo in attesa",
            "en-US": "Chapter awaiting",
            "en-GB": "Chapter awaiting",
            "fr":    "Chapitre en attente",
            "de":    "Kapitel wartend",
            "es":    "Capítulo a la espera",
            "ar":    "فصل في الانتظار",
        },
        "in_progress": {
            "it":    "Capitolo in lavorazione",
            "en-US": "Chapter in progress",
            "en-GB": "Chapter in progress",
            "fr":    "Chapitre en cours",
            "de":    "Kapitel in Arbeit",
            "es":    "Capítulo en curso",
            "ar":    "فصل قيد العمل",
        },
        "presented": {
            "it":    "Capitolo condiviso",
            "en-US": "Chapter shared",
            "en-GB": "Chapter shared",
            "fr":    "Chapitre partagé",
            "de":    "Kapitel geteilt",
            "es":    "Capítulo compartido",
            "ar":    "فصل مُشترَك",
        },
        "revision_requested": {
            "it":    "In ascolto di una nuova voce",
            "en-US": "Awaiting a new voice",
            "en-GB": "Awaiting a new voice",
            "fr":    "À l'écoute d'une nouvelle voix",
            "de":    "Wartet auf eine neue Stimme",
            "es":    "A la escucha de una nueva voz",
            "ar":    "في انتظار صوت جديد",
        },
        "partially_approved": {
            "it":    "Approvato in parte",
            "en-US": "Partially approved",
            "en-GB": "Partially approved",
            "fr":    "Approuvé en partie",
            "de":    "Teilweise bestätigt",
            "es":    "Aprobado en parte",
            "ar":    "موافقة جزئية",
        },
        "approved": {
            "it":    "Capitolo approvato",
            "en-US": "Chapter approved",
            "en-GB": "Chapter approved",
            "fr":    "Chapitre approuvé",
            "de":    "Kapitel bestätigt",
            "es":    "Capítulo aprobado",
            "ar":    "فصل مُعتمَد",
        },
        "closed": {
            "it":    "Capitolo chiuso",
            "en-US": "Chapter closed",
            "en-GB": "Chapter closed",
            "fr":    "Chapitre clos",
            "de":    "Kapitel abgeschlossen",
            "es":    "Capítulo cerrado",
            "ar":    "فصل مُغلَق",
        },
    },

    # ── JOURNEY MILESTONE labels · the named chapters ───────────
    # These keys mirror what the seed creates in `journey_milestones`.
    "journey_milestone": {
        "brief_opening": {
            "it":    "Brief in apertura",
            "en-US": "Opening Brief",
            "en-GB": "Opening Brief",
            "fr":    "Brief d'ouverture",
            "de":    "Eröffnungs-Brief",
            "es":    "Brief de apertura",
            "ar":    "موجز افتتاحي",
        },
        "inspirations_alignment": {
            "it":    "Allineamento Ispirazioni",
            "en-US": "Inspirations Alignment",
            "en-GB": "Inspirations Alignment",
            "fr":    "Alignement des inspirations",
            "de":    "Inspirations-Abstimmung",
            "es":    "Alineación de inspiraciones",
            "ar":    "محاذاة الإلهامات",
        },
        "moodboard_direction": {
            "it":    "Moodboard Direction",
            "en-US": "Moodboard Direction",
            "en-GB": "Moodboard Direction",
            "fr":    "Direction Moodboard",
            "de":    "Moodboard-Richtung",
            "es":    "Dirección de Moodboard",
            "ar":    "اتجاه اللوح الحسي",
        },
        "material_direction": {
            "it":    "Direzione Materica",
            "en-US": "Material Direction",
            "en-GB": "Material Direction",
            "fr":    "Direction Matières",
            "de":    "Material-Richtung",
            "es":    "Dirección Matérica",
            "ar":    "اتجاه المواد",
        },
        "client_brief": {
            "it":    "Brief Cliente",
            "en-US": "Client Brief",
            "en-GB": "Client Brief",
            "fr":    "Brief Client",
            "de":    "Kunden-Brief",
            "es":    "Brief del cliente",
            "ar":    "موجز العميل",
        },
    },

    # ── CRM STAGE · relationship stages ─────────────────────────
    "crm_stage": {
        "first_contact": {
            "it":    "Primo incontro",
            "en-US": "First encounter",
            "en-GB": "First encounter",
            "fr":    "Première rencontre",
            "de":    "Erste Begegnung",
            "es":    "Primer encuentro",
            "ar":    "اللقاء الأول",
        },
        "in_conversation": {
            "it":    "In conversazione",
            "en-US": "In conversation",
            "en-GB": "In conversation",
            "fr":    "En conversation",
            "de":    "Im Gespräch",
            "es":    "En conversación",
            "ar":    "في حوار",
        },
        "follow_up": {
            "it":    "In ascolto",
            "en-US": "Listening",
            "en-GB": "Listening",
            "fr":    "À l'écoute",
            "de":    "Im Zuhören",
            "es":    "A la escucha",
            "ar":    "في الإصغاء",
        },
        "active_client": {
            "it":    "Cliente attivo",
            "en-US": "Active client",
            "en-GB": "Active client",
            "fr":    "Client actif",
            "de":    "Aktiver Kunde",
            "es":    "Cliente activo",
            "ar":    "عميل نشط",
        },
        "journey_confirmed": {
            "it":    "Journey confermato",
            "en-US": "Journey confirmed",
            "en-GB": "Journey confirmed",
            "fr":    "Journey confirmé",
            "de":    "Journey bestätigt",
            "es":    "Journey confirmado",
            "ar":    "Journey مُؤكَّد",
        },
    },

    # ── COMPANION STATES · client-facing micro-states ───────────
    "companion_state": {
        "feedback":    {"it": "Voce", "en-US": "Voice", "en-GB": "Voice", "fr": "Voix", "de": "Stimme", "es": "Voz", "ar": "صوت"},
        "revision":    {"it": "Revisione", "en-US": "Revision", "en-GB": "Revision", "fr": "Révision", "de": "Überarbeitung", "es": "Revisión", "ar": "مراجعة"},
        "approval":    {"it": "Approvazione", "en-US": "Approval", "en-GB": "Approval", "fr": "Approbation", "de": "Bestätigung", "es": "Aprobación", "ar": "موافقة"},
        "request":     {"it": "Richiesta", "en-US": "Request", "en-GB": "Request", "fr": "Demande", "de": "Anfrage", "es": "Solicitud", "ar": "طلب"},
        "material":    {"it": "Materiale", "en-US": "Material", "en-GB": "Material", "fr": "Matière", "de": "Material", "es": "Material", "ar": "مادة"},
        "variant":     {"it": "Variante", "en-US": "Variant", "en-GB": "Variant", "fr": "Variante", "de": "Variante", "es": "Variante", "ar": "نسخة"},
    },
}


# ── Resolver ───────────────────────────────────────────────────
def resolve(taxonomy_type: str, key: Optional[str], locale: str,
            fallback: Optional[str] = None) -> str:
    """Resolve an editorial label for the given (type, key, locale).

    Fallback chain:
       requested_locale → en-US → it (source) → fallback param → key literal
    """
    if not key:
        return fallback or ""
    block = TAXONOMY.get(taxonomy_type)
    if not block:
        return fallback or key
    entry = block.get(key)
    if not entry:
        return fallback or key
    return (
        entry.get(locale)
        or entry.get("en-US")
        or entry.get(TAXONOMY_SOURCE_LOCALE)
        or fallback
        or key
    )


def flatten_for_locale(locale: str) -> Dict[str, str]:
    """Returns a flat dotted-key dictionary `taxonomy.{type}.{key}` for the
    given locale, ready to be merged into an i18n payload."""
    flat: Dict[str, str] = {}
    for tax_type, entries in TAXONOMY.items():
        for key, by_locale in entries.items():
            value = (
                by_locale.get(locale)
                or by_locale.get("en-US")
                or by_locale.get(TAXONOMY_SOURCE_LOCALE)
                or key
            )
            flat[f"taxonomy.{tax_type}.{key}"] = value
    return flat


def list_taxonomy_types() -> list[str]:
    return sorted(TAXONOMY.keys())


def list_keys(taxonomy_type: str) -> list[str]:
    return sorted((TAXONOMY.get(taxonomy_type) or {}).keys())


def keys_for_audit() -> list[str]:
    """Returns all `taxonomy.{type}.{key}` strings — used by the Translation
    Studio governance to compute coverage per locale."""
    out: list[str] = []
    for tax_type, entries in TAXONOMY.items():
        for key in entries.keys():
            out.append(f"taxonomy.{tax_type}.{key}")
    return sorted(out)
