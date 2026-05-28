"""
ITER160 — Studio Activation Service.

Stateless service around `studio_activation_drafts`. The flow:

  1. Client (no auth) calls POST /api/studio/activation/draft.
     If a `draft_token` is provided and matches an unfinished draft,
     that draft is returned. Otherwise a new draft + token are created.

  2. Each Movement (II / III / IV) calls PATCH …/draft with partial state.
     The service merges and bumps `updated_at` (silent autosave).

  3. POST …/complete consumes the draft and provisions the real tenant.
     (Not implemented yet — Phase 2.)

  4. GET …/manifest returns the static map of archetypes + experiences +
     pre-suggestion logic + the editorial copy keys.
"""
from __future__ import annotations

import secrets
from typing import Optional

from sqlalchemy import text

from database import AsyncSessionLocal


VALID_MOVEMENTS  = {'entrance', 'practice', 'ecosystem', 'identity', 'activate'}
VALID_ARCHETYPES = {
    'interior_studio', 'luxury_showroom', 'architecture_firm',
    'material_gallery', 'design_retail', 'stone_specialist',
}
VALID_EXPERIENCES = {
    'design_journey_os', 'material_intelligence',
    'moodboard_experience', 'showroom_continuity',
    'client_presentation_flow',
}

# Pre-suggested experiences per archetype (see PRD §4.3 / §8.1)
ARCHETYPE_TO_SUGGESTED = {
    'interior_studio':   ['design_journey_os', 'moodboard_experience', 'client_presentation_flow'],
    'luxury_showroom':   ['showroom_continuity', 'material_intelligence', 'client_presentation_flow'],
    'architecture_firm': ['design_journey_os', 'material_intelligence'],
    'material_gallery':  ['material_intelligence', 'showroom_continuity'],
    'design_retail':     ['showroom_continuity', 'client_presentation_flow'],
    'stone_specialist':  ['material_intelligence', 'showroom_continuity'],
}


def new_draft_token() -> str:
    return secrets.token_urlsafe(24)


async def get_or_create_draft(
    *,
    draft_token: Optional[str],
    ip: Optional[str],
    user_agent: Optional[str],
) -> dict:
    """
    Resume an unfinished draft if `draft_token` matches one. Otherwise
    create a fresh draft + token.
    """
    async with AsyncSessionLocal() as s:
        if draft_token:
            row = (await s.execute(
                text("""
                    SELECT id, draft_token, archetype, experiences, payload,
                           current_movement, founder_email, resumed_count,
                           created_at, updated_at, completed_at
                      FROM studio_activation_drafts
                     WHERE draft_token = :tok
                     LIMIT 1
                """),
                {"tok": draft_token},
            )).mappings().first()
            if row and not row['completed_at']:
                # Increment resumed_count silently.
                await s.execute(
                    text("UPDATE studio_activation_drafts "
                         "SET resumed_count = resumed_count + 1, updated_at = NOW() "
                         "WHERE id = :id"),
                    {"id": str(row['id'])},
                )
                await s.commit()
                return _serialize_draft(row, resumed=True)

        # Create a new draft.
        tok = new_draft_token()
        row = (await s.execute(
            text("""
                INSERT INTO studio_activation_drafts
                    (draft_token, ip, user_agent)
                VALUES (:tok, :ip, :ua)
                RETURNING id, draft_token, archetype, experiences, payload,
                          current_movement, founder_email, resumed_count,
                          created_at, updated_at, completed_at
            """),
            {"tok": tok, "ip": ip, "ua": user_agent},
        )).mappings().first()
        await s.commit()
        return _serialize_draft(row, resumed=False)


async def patch_draft(
    *,
    draft_token: str,
    archetype: Optional[str] = None,
    experiences: Optional[list[str]] = None,
    payload_patch: Optional[dict] = None,
    movement: Optional[str] = None,
    founder_email: Optional[str] = None,
) -> dict:
    """
    Merge a partial update into the draft. Unknown values are ignored
    rather than rejected (concierge intercept — never surface 4xx).
    """
    if movement is not None and movement not in VALID_MOVEMENTS:
        movement = None
    if archetype is not None and archetype not in VALID_ARCHETYPES:
        archetype = None
    if experiences is not None:
        experiences = [e for e in experiences if e in VALID_EXPERIENCES]

    async with AsyncSessionLocal() as s:
        # Look up the draft. If absent, create one — the contract is
        # always "the composition continues, never errors".
        row = (await s.execute(
            text("SELECT id, payload FROM studio_activation_drafts "
                 "WHERE draft_token = :tok LIMIT 1"),
            {"tok": draft_token},
        )).mappings().first()
        if not row:
            new = await get_or_create_draft(
                draft_token=None, ip=None, user_agent=None,
            )
            # Recurse once into the new draft.
            return await patch_draft(
                draft_token=new['draft_token'],
                archetype=archetype, experiences=experiences,
                payload_patch=payload_patch, movement=movement,
                founder_email=founder_email,
            )

        # Merge payload (deep-shallow: top-level keys are replaced).
        new_payload = dict(row['payload'] or {})
        if payload_patch:
            for k, v in payload_patch.items():
                new_payload[k] = v

        # Build dynamic UPDATE
        sets: list[str] = ["updated_at = NOW()", "payload = CAST(:payload AS jsonb)"]
        params: dict = {"id": str(row['id']),
                        "payload": _json_dump(new_payload)}
        if archetype is not None:
            sets.append("archetype = :archetype")
            params["archetype"] = archetype
        if experiences is not None:
            sets.append("experiences = :experiences")
            params["experiences"] = experiences
        if movement is not None:
            sets.append("current_movement = :movement")
            params["movement"] = movement
        if founder_email is not None:
            sets.append("founder_email = :em")
            params["em"] = founder_email.lower().strip()

        updated = (await s.execute(
            text(f"""
                UPDATE studio_activation_drafts
                   SET {', '.join(sets)}
                 WHERE id = :id
             RETURNING id, draft_token, archetype, experiences, payload,
                       current_movement, founder_email, resumed_count,
                       created_at, updated_at, completed_at
            """),
            params,
        )).mappings().first()
        await s.commit()
        return _serialize_draft(updated, resumed=False)


def manifest() -> dict:
    """
    Static map consumed by the frontend on mount — archetypes (with their
    visual identity hints), experiences, and the editorial copy keys per
    movement. This avoids 30+ /api/site/block round-trips.
    """
    BASE = ("https://ytctctmvgdkmyjrbgmqs.supabase.co/storage/v1/object/public/"
            "cms-assets/848354b9-a43e-4147-bdad-116fb93bd585/site/")
    return {
        "archetypes": [
            {
                "key": "interior_studio",
                "title_key":      "studio.activation.archetype.interior_studio.title",
                "descriptor_key": "studio.activation.archetype.interior_studio.body",
                "image_url":      BASE + "1ae982fb57-3-edited-edited.jpg",
            },
            {
                "key": "luxury_showroom",
                "title_key":      "studio.activation.archetype.luxury_showroom.title",
                "descriptor_key": "studio.activation.archetype.luxury_showroom.body",
                "image_url":      BASE + "597a6ace33-4-edited-edited.jpg",
            },
            {
                "key": "architecture_firm",
                "title_key":      "studio.activation.archetype.architecture_firm.title",
                "descriptor_key": "studio.activation.archetype.architecture_firm.body",
                "image_url":      BASE + "b949d9d0be-5-edited-edited.jpg",
            },
            {
                "key": "material_gallery",
                "title_key":      "studio.activation.archetype.material_gallery.title",
                "descriptor_key": "studio.activation.archetype.material_gallery.body",
                "image_url":      BASE + "e92596565f-2-edited-edited.jpg",
            },
            {
                "key": "design_retail",
                "title_key":      "studio.activation.archetype.design_retail.title",
                "descriptor_key": "studio.activation.archetype.design_retail.body",
                "image_url":      BASE + "51edd9748f-6-edited-edited.jpg",
            },
            {
                "key": "stone_specialist",
                "title_key":      "studio.activation.archetype.stone_specialist.title",
                "descriptor_key": "studio.activation.archetype.stone_specialist.body",
                "image_url":      BASE + "2762bad91b-7-edited-edited.jpg",
            },
        ],
        # Entrance full-bleed photograph (slow Ken-Burns drift on the page)
        "entrance_image_url": BASE + "efce52b92e-AdobeStock_1014843351.jpg",
        "archetype_to_suggested": ARCHETYPE_TO_SUGGESTED,
        "experiences": [
            {"key": "design_journey_os",
             "title_key":      "studio.activation.experience.design_journey_os.title",
             "descriptor_key": "studio.activation.experience.design_journey_os.body"},
            {"key": "material_intelligence",
             "title_key":      "studio.activation.experience.material_intelligence.title",
             "descriptor_key": "studio.activation.experience.material_intelligence.body"},
            {"key": "moodboard_experience",
             "title_key":      "studio.activation.experience.moodboard_experience.title",
             "descriptor_key": "studio.activation.experience.moodboard_experience.body"},
            {"key": "showroom_continuity",
             "title_key":      "studio.activation.experience.showroom_continuity.title",
             "descriptor_key": "studio.activation.experience.showroom_continuity.body"},
            {"key": "client_presentation_flow",
             "title_key":      "studio.activation.experience.client_presentation_flow.title",
             "descriptor_key": "studio.activation.experience.client_presentation_flow.body"},
        ],
        "copy_keys": [
            # Movement I — Entrance
            "studio.activation.entrance.eyebrow",
            "studio.activation.entrance.headline",
            "studio.activation.entrance.sublead",
            "studio.activation.entrance.cta",
            "studio.activation.entrance.return_link",
            "studio.activation.entrance.return_destination",
            # Movement II — Practice
            "studio.activation.practice.eyebrow",
            "studio.activation.practice.headline",
            "studio.activation.practice.sublead",
            "studio.activation.practice.confirm_line",
            "studio.activation.practice.continue_cta",
            "studio.activation.practice.fallback_line",
            "studio.activation.practice.fallback_link",
            # Archetype copy
            *[f"studio.activation.archetype.{k}.title" for k in VALID_ARCHETYPES],
            *[f"studio.activation.archetype.{k}.body"  for k in VALID_ARCHETYPES],
        ],
    }


# ── helpers ───────────────────────────────────────────────────────────
def _serialize_draft(row, *, resumed: bool) -> dict:
    return {
        "id":               str(row['id']),
        "draft_token":      row['draft_token'],
        "archetype":        row['archetype'],
        "experiences":      list(row['experiences'] or []),
        "payload":          row['payload'] or {},
        "current_movement": row['current_movement'],
        "founder_email":    row['founder_email'],
        "resumed_count":    row['resumed_count'],
        "resumed":          resumed,
        "created_at":       row['created_at'].isoformat() if row['created_at'] else None,
        "updated_at":       row['updated_at'].isoformat() if row['updated_at'] else None,
        "completed_at":     row['completed_at'].isoformat() if row['completed_at'] else None,
    }


def _json_dump(d: dict) -> str:
    import json
    return json.dumps(d, default=str, ensure_ascii=False)
