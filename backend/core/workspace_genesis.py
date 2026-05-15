"""Workspace Genesis™ — Session C orchestrator.

Given an onboarding payload (private client wizard or A&D professional intake)
this module produces a fully-alive workspace:

  1. Insert lead row (with payload in metadata_json)
  2. Pick a designer persona via round-robin
  3. Create assignment row
  4. Create project shell with semantic title derived from the payload
  5. Create a primary moodboard with 6 curated pages
     (Project Vision / Mood Direction / Materials / Inspirations / Space Planning / Proposal Draft)
  6. Drop a welcome note + tag/palette/text blocks on the Mood Direction page
     so the workspace reads as "intelligent and human", not "auto-generated".

The output is a small dict the API can hand back to the frontend so the
cinematic redirect lands directly on `/projects/:project_id`.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from database import db

logger = logging.getLogger(__name__)
NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731

# Locale-keyed page titles for the 6 curated pages
PAGE_BLUEPRINT: List[Dict[str, Any]] = [
    {
        "key": "vision",
        "page_type": "cover",
        "title": {
            "_default": "Project Vision",
            "it": "Visione del progetto",
            "en-US": "Project Vision", "en-GB": "Project Vision",
            "fr": "Vision du projet", "de": "Projektvision", "es": "Visión del proyecto",
        },
    },
    {
        "key": "mood",
        "page_type": "mood",
        "title": {
            "_default": "Mood Direction",
            "it": "Direzione mood",
            "en-US": "Mood Direction", "en-GB": "Mood Direction",
            "fr": "Direction d'ambiance", "de": "Stimmungsrichtung", "es": "Dirección de mood",
        },
    },
    {
        "key": "materials",
        "page_type": "material_board",
        "title": {
            "_default": "Materials",
            "it": "Materiali",
            "en-US": "Materials", "en-GB": "Materials",
            "fr": "Matériaux", "de": "Materialien", "es": "Materiales",
        },
    },
    {
        "key": "inspirations",
        "page_type": "gallery",
        "title": {
            "_default": "Inspirations",
            "it": "Ispirazioni",
            "en-US": "Inspirations", "en-GB": "Inspirations",
            "fr": "Inspirations", "de": "Inspirationen", "es": "Inspiraciones",
        },
    },
    {
        "key": "space",
        "page_type": "blank",
        "title": {
            "_default": "Space Planning",
            "it": "Pianificazione spazi",
            "en-US": "Space Planning", "en-GB": "Space Planning",
            "fr": "Planification des espaces", "de": "Raumplanung", "es": "Planificación de espacios",
        },
    },
    {
        "key": "proposal",
        "page_type": "proposal_summary",
        "title": {
            "_default": "Proposal Draft",
            "it": "Bozza di proposta",
            "en-US": "Proposal Draft", "en-GB": "Proposal Draft",
            "fr": "Brouillon de proposition", "de": "Vorschlagsentwurf", "es": "Borrador de propuesta",
        },
    },
]


# Aspect / dimensions of pages
PAGE_DIMS = {"aspect_ratio": "portrait_a4", "width": 1400, "height": 2400}


def _pick_text(bag: Dict[str, Any], locale: str, fallback: str = "") -> str:
    if not isinstance(bag, dict):
        return str(bag) if bag else fallback
    if locale in bag and bag[locale]:
        return bag[locale]
    base = locale.split("-")[0]
    if base in bag and bag[base]:
        return bag[base]
    return bag.get("_default") or fallback


def round_robin_designer(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Pick the next demo designer persona by simple rotation based on existing assignment count."""
    client = db()
    # Find all persona designers
    pros = client.table("users_profile").select(
        "id, first_name, last_name, email, avatar_url, metadata_json, role"
    ).eq("tenant_id", tenant_id).eq("role", "designer").execute()
    personas = [p for p in (pros.data or []) if (p.get("metadata_json") or {}).get("persona")]
    if not personas:
        # fall back to any designer in the tenant
        personas = pros.data or []
    if not personas:
        return None
    personas.sort(key=lambda p: (p.get("metadata_json") or {}).get("roundrobin_slot", 99))

    # Count assignments so far → cycle
    a = client.table("lead_assignments").select("id", count="exact") \
        .eq("tenant_id", tenant_id).execute()
    n = a.count if a.count is not None else (len(a.data or []))
    return personas[n % len(personas)]


def derive_project_title(payload: Dict[str, Any], locale: str) -> str:
    """Build a humane project title from the payload (not 'Project #421')."""
    space = payload.get("space_type") or payload.get("typology") or ""
    mood  = payload.get("mood") or payload.get("style") or ""
    city  = payload.get("city") or payload.get("location") or ""
    first = payload.get("first_name") or ""
    parts = []
    if space: parts.append(space.capitalize())
    if mood:  parts.append(f"· {mood.capitalize()}")
    if city:  parts.append(f"· {city}")
    title = " ".join(parts).strip()
    if not title:
        title = (
            "Nuovo progetto" if locale.startswith("it") else
            "Nouveau projet" if locale == "fr" else
            "Neues Projekt" if locale == "de" else
            "Nuevo proyecto" if locale == "es" else
            "New project"
        )
    if first:
        title = f"{title} — {first}"
    return title[:200]


def _create_mood_blocks(page_id: str, tenant_id: str, payload: Dict[str, Any], locale: str) -> List[Dict[str, Any]]:
    """Drop a welcome note + a mood text + a palette block on the Mood page."""
    moods = payload.get("moods") or payload.get("mood_tags") or []
    if isinstance(moods, str):
        moods = [moods]
    palette = payload.get("palette") or payload.get("colors") or ["#1A1A1A", "#C9A36E", "#EFEBE4", "#7A7165"]
    style = payload.get("style") or payload.get("mood") or ""

    welcome_map = {
        "it": "Benvenuto. Questo è il primo punto di partenza del tuo progetto. Possiamo modificarlo insieme.",
        "en-US": "Welcome. This is the first point of departure for your project. We can shape it together.",
        "en-GB": "Welcome. This is the first point of departure for your project. We can shape it together.",
        "fr": "Bienvenue. Voici le point de départ de votre projet — nous pouvons l'affiner ensemble.",
        "de": "Willkommen. Hier startet dein Projekt — wir formen es gemeinsam.",
        "es": "Bienvenido. Este es el primer punto de partida de tu proyecto — podemos darle forma juntos.",
    }
    welcome = welcome_map.get(locale) or welcome_map.get(locale.split("-")[0]) or welcome_map["en-US"]

    blocks: List[Dict[str, Any]] = []
    now = NOW()

    def _block(btype: str, title: Optional[str], content: Optional[str],
               x: int, y: int, w: int, h: int, z: int, style_json=None, meta=None):
        return {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "moodboard_id": None,  # set by caller
            "page_id": page_id,
            "type": btype,
            "title": title,
            "content": content,
            "position_json": {"x": x, "y": y, "width": w, "height": h, "z_index": z},
            "style_json": style_json or {},
            "metadata_json": meta or {},
            "sort_order": z,
            "created_at": now, "updated_at": now,
        }

    # Welcome note (sticky-note style)
    blocks.append(_block(
        "note", "Welcome", welcome,
        80, 80, 420, 180, 10,
        style_json={"background": "#FBF7F0", "color": "#1A1A1A"},
        meta={"seeded": True, "kind": "welcome_note"},
    ))

    # Style headline
    if style:
        blocks.append(_block(
            "text", None, style.upper(),
            560, 80, 600, 140, 11,
            style_json={"typography": {"font_family": "display", "font_size": 56, "letter_spacing": 80}},
            meta={"seeded": True, "kind": "style_keyword"},
        ))

    # Mood keywords text
    if moods:
        blocks.append(_block(
            "text", None, " · ".join([str(m).capitalize() for m in moods]),
            560, 250, 600, 80, 12,
            style_json={"typography": {"font_family": "body", "letter_spacing": 200}},
            meta={"seeded": True, "kind": "mood_tags"},
        ))

    # Palette block — stored as a 'text' or 'note' for now (no dedicated palette type),
    # but with metadata so the editor can later render it visually.
    if palette:
        blocks.append(_block(
            "note", "Palette", " ".join(list(palette)[:6]),
            80, 320, 600, 180, 13,
            style_json={"background": "#1A1A1A", "color": "#EFEBE4", "kind": "palette"},
            meta={"seeded": True, "kind": "seed_palette", "colors": list(palette)[:6]},
        ))
    return blocks


def generate(
    tenant_id: str,
    profile_id: str,
    payload: Dict[str, Any],
    locale: str = "it",
    lead_type: str = "private_client",
) -> Dict[str, Any]:
    """Run the full Workspace Genesis pipeline.

    Returns:
        {
          'lead_id', 'project_id', 'moodboard_id', 'assigned_to': {profile fields},
          'pages': [...], 'narrative': [...]   # cinematic loading messages
        }
    """
    client = db()
    now = NOW()

    # 1) Lead
    lead_id = str(uuid.uuid4())
    full_email = payload.get("email") or ""
    client.table("leads").insert({
        "id": lead_id,
        "tenant_id": tenant_id,
        "first_name": payload.get("first_name"),
        "last_name":  payload.get("last_name"),
        "email":      full_email or None,
        "phone":      payload.get("phone"),
        "lead_type":  lead_type,
        "source":     payload.get("source") or "storefront_wizard",
        "status":     "qualified",
        "language":   (locale.split("-")[0] if locale else "en"),
        "country":    payload.get("country"),
        "city":       payload.get("city"),
        "project_type":     payload.get("space_type") or payload.get("typology"),
        "budget_range":     payload.get("budget"),
        "timeline":         payload.get("timeline"),
        "style_preference": payload.get("style") or payload.get("mood"),
        "notes":            payload.get("notes"),
        "metadata_json":    {**payload, "wizard_completed_at": now},
        "created_at": now, "updated_at": now,
    }).execute()

    # 2) Round-robin designer
    designer = round_robin_designer(tenant_id) or {}
    assigned_profile_id = designer.get("id")
    if assigned_profile_id:
        client.table("lead_assignments").insert({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "lead_id":   lead_id,
            "profile_id": assigned_profile_id,
            "assigned_at": now,
            "assigned_by": None,
            "assignment_kind": "auto_round_robin",
        }).execute()
        # mirror on lead.assigned_to (fast read)
        client.table("leads").update({"assigned_to": assigned_profile_id, "updated_at": now}) \
            .eq("id", lead_id).execute()

    # 3) Project shell
    project_id = str(uuid.uuid4())
    project_title = derive_project_title(payload, locale)
    client.table("projects").insert({
        "id": project_id,
        "tenant_id": tenant_id,
        "title":       project_title,
        "description": payload.get("notes") or None,
        "project_type": payload.get("space_type") or payload.get("typology"),
        "priority": "normal",
        "status": "new",
        "budget_range": payload.get("budget"),
        "timeline":     payload.get("timeline"),
        "language":     (locale.split("-")[0] if locale else "en"),
        "lead_id":      lead_id,
        "client_user_id": profile_id,
        "assigned_to": assigned_profile_id,
        "metadata_json": {
            "seeded_via": "workspace_genesis",
            "onboarding_payload": payload,
        },
        "created_at": now, "updated_at": now,
    }).execute()

    # 4) Primary moodboard
    mb_id = str(uuid.uuid4())
    client.table("moodboards").insert({
        "id": mb_id,
        "tenant_id": tenant_id,
        "project_id": project_id,
        "title": project_title,
        "description": "Auto-generated by Workspace Genesis",
        "status": "draft",
        "ai_metadata": {"seeded": True, "seed_locale": locale},
        "created_at": now, "updated_at": now,
    }).execute()

    # 5) Pages + welcome blocks on Mood
    pages_out = []
    mood_page_id = None
    for idx, blueprint in enumerate(PAGE_BLUEPRINT):
        page_id = str(uuid.uuid4())
        page_title = _pick_text(blueprint["title"], locale, blueprint["title"]["_default"])
        client.table("moodboard_pages").insert({
            "id": page_id,
            "tenant_id": tenant_id,
            "moodboard_id": mb_id,
            "title": page_title,
            "page_type": blueprint["page_type"],
            "aspect_ratio": PAGE_DIMS["aspect_ratio"],
            "width": PAGE_DIMS["width"], "height": PAGE_DIMS["height"],
            "sort_order": idx,
            "hidden_in_presentation": False,
            "created_at": now, "updated_at": now,
        }).execute()
        pages_out.append({"id": page_id, "key": blueprint["key"], "title": page_title})
        if blueprint["key"] == "mood":
            mood_page_id = page_id

    # Set current_page_id on moodboard (cover)
    if pages_out:
        client.table("moodboards").update({"current_page_id": pages_out[0]["id"]}) \
            .eq("id", mb_id).execute()

    # 6) Mood Direction page blocks
    if mood_page_id:
        blocks = _create_mood_blocks(mood_page_id, tenant_id, payload, locale)
        for b in blocks:
            b["moodboard_id"] = mb_id
            client.table("moodboard_elements").insert(b).execute()

    # Cinematic narrative messages (used by frontend overlay)
    narrative_map = {
        "it":    ["Preparo l'atmosfera del tuo progetto…",
                  "Organizzo le ispirazioni…",
                  "Costruisco la tua prima direzione mood…",
                  "Il tuo Blueprint è pronto."],
        "en-US": ["Preparing your project atmosphere…",
                  "Organising your inspirations…",
                  "Crafting your first mood direction…",
                  "Your Blueprint is ready."],
        "en-GB": ["Preparing your project atmosphere…",
                  "Organising your inspirations…",
                  "Crafting your first mood direction…",
                  "Your Blueprint is ready."],
        "fr":    ["Je prépare l'atmosphère de votre projet…",
                  "J'organise vos inspirations…",
                  "Je crée votre première direction d'ambiance…",
                  "Votre Blueprint est prêt."],
        "de":    ["Bereite die Atmosphäre deines Projekts vor…",
                  "Ordne deine Inspirationen…",
                  "Erstelle deine erste Stimmungsrichtung…",
                  "Dein Blueprint ist bereit."],
        "es":    ["Preparo la atmósfera de tu proyecto…",
                  "Organizo tus inspiraciones…",
                  "Construyo tu primera dirección de mood…",
                  "Tu Blueprint está listo."],
    }
    narrative = narrative_map.get(locale) or narrative_map.get(locale.split("-")[0]) or narrative_map["en-US"]

    return {
        "lead_id": lead_id,
        "project_id": project_id,
        "moodboard_id": mb_id,
        "project_title": project_title,
        "assigned_to": {
            "id": designer.get("id"),
            "first_name": designer.get("first_name"),
            "last_name": designer.get("last_name"),
            "email": designer.get("email"),
            "avatar_url": designer.get("avatar_url"),
            "role_label": _pick_text((designer.get("metadata_json") or {}).get("role_label", {}), locale, "Designer"),
            "bio_short":  _pick_text((designer.get("metadata_json") or {}).get("bio_short", {}), locale, ""),
            "online_status": (designer.get("metadata_json") or {}).get("online_status", "available"),
            "languages": (designer.get("metadata_json") or {}).get("languages", []),
        } if designer else None,
        "pages": pages_out,
        "narrative": narrative,
    }
