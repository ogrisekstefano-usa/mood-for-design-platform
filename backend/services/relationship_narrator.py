"""Relationship Narrator™ · ITER150 Sprint A

Server-side editorial sentence generator for relationship events. Turns
raw event types into living narrative the designer sees in their
Live Timeline™ — NOT log lines, NOT admin feed rows.

Examples:
  briefing_completed →
    "Sofia ha completato il briefing iniziale."
  moodboard_viewed (returning visit) →
    "Sofia è tornata sul moodboard dopo 3 giorni."
  call_requested →
    "Sofia ha richiesto una call · proposti 2 slot."
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional


def _format_gap(seconds: int, locale: str = "it") -> str:
    """Editorial gap formatter (returning client narrative)."""
    if seconds < 60:
        return "ora" if locale == "it" else "now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min fa" if locale == "it" else f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} ore fa" if locale == "it" else f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "ieri" if locale == "it" else "yesterday"
    if days < 30:
        return f"{days} giorni fa" if locale == "it" else f"{days} days ago"
    months = days // 30
    return f"{months} mesi fa" if locale == "it" else f"{months}mo ago"


def narrate(
    event_type: str,
    actor_label: Optional[str] = None,
    *,
    payload: Optional[dict] = None,
    locale: str = "it",
    previous_event_at: Optional[datetime] = None,
) -> str:
    """Produce an editorial sentence for the event.

    `previous_event_at` allows the narrator to detect "returning" patterns
    ("Sofia è tornata sul moodboard dopo 3 giorni").
    """
    p = payload or {}
    who = actor_label or ("il cliente" if locale == "it" else "the client")

    gap_phrase = ""
    if previous_event_at:
        try:
            delta = datetime.now(timezone.utc) - previous_event_at
            if delta.total_seconds() > 3600 * 24:  # > 24h
                gap_phrase = (
                    f" dopo {_format_gap(int(delta.total_seconds()), locale)}"
                    if locale == "it"
                    else f" after {_format_gap(int(delta.total_seconds()), locale)}"
                )
        except Exception:  # noqa: BLE001
            pass

    et = event_type or ""

    if locale == "it":
        sentences = {
            "briefing_started":
                f"{who} ha iniziato il briefing.",
            "briefing_completed":
                f"{who} ha completato il briefing iniziale.",
            "message_sent":
                f"{who} ha inviato un messaggio.",
            "call_requested":
                f"{who} ha richiesto una call"
                + (f" · {len(p.get('preferred_slots', []))} slot proposti."
                   if p.get("preferred_slots") else "."),
            "moodboard_viewed":
                (f"{who} è tornato sul moodboard{gap_phrase}."
                 if gap_phrase else f"{who} sta esplorando il moodboard."),
            "proposal_opened":
                f"{who} ha aperto la proposta.",
            "approval_requested":
                "Approvazione richiesta al cliente.",
            "approval_confirmed":
                f"{who} ha approvato.",
            "designer_assigned":
                f"Designer assegnato · {p.get('designer_label') or 'studio'}.",
            "designer_changed":
                f"Designer riassegnato a {p.get('designer_label') or 'un nuovo referente'}.",
            "timeline_progressed":
                f"Journey avanzata · {p.get('stage_label') or 'nuovo stage'}.",
            "file_uploaded":
                f"{who} ha caricato {p.get('file_label') or 'un file'}.",
            "client_returned":
                f"{who} è tornato{gap_phrase}.",
            "project_direction_updated":
                "Direzione del progetto aggiornata.",
            "status_changed":
                f"Stato aggiornato · {p.get('status_label') or p.get('status_key') or 'nuovo stato'}.",
            "journey_resumed":
                f"{who} ha ripreso il journey{gap_phrase}.",
        }
    else:
        sentences = {
            "briefing_started":
                f"{who} started the briefing.",
            "briefing_completed":
                f"{who} completed the initial briefing.",
            "message_sent":
                f"{who} sent a message.",
            "call_requested":
                f"{who} requested a call"
                + (f" · {len(p.get('preferred_slots', []))} slots proposed."
                   if p.get("preferred_slots") else "."),
            "moodboard_viewed":
                (f"{who} returned to the moodboard{gap_phrase}."
                 if gap_phrase else f"{who} is exploring the moodboard."),
            "proposal_opened":
                f"{who} opened the proposal.",
            "approval_requested":
                "Approval requested from client.",
            "approval_confirmed":
                f"{who} approved.",
            "designer_assigned":
                f"Designer assigned · {p.get('designer_label') or 'studio'}.",
            "designer_changed":
                f"Designer reassigned to {p.get('designer_label') or 'a new lead'}.",
            "timeline_progressed":
                f"Journey progressed · {p.get('stage_label') or 'new stage'}.",
            "file_uploaded":
                f"{who} uploaded {p.get('file_label') or 'a file'}.",
            "client_returned":
                f"{who} returned{gap_phrase}.",
            "project_direction_updated":
                "Project direction updated.",
            "status_changed":
                f"Status updated · {p.get('status_label') or p.get('status_key') or 'new status'}.",
            "journey_resumed":
                f"{who} resumed the journey{gap_phrase}.",
        }

    return sentences.get(et, f"{who} · {et.replace('_', ' ')}.")


# Status-bar progression hints. When an event fires, the engine bumps
# the relationship_status using this map. None = no change.
EVENT_TO_STATUS = {
    "briefing_started":         "awaiting_brief",
    "briefing_completed":       "reviewing_answers",
    "moodboard_viewed":         None,  # passive event, no bar progression
    "message_sent":             None,
    "call_requested":           None,
    "designer_assigned":        None,
    "proposal_opened":          "proposal_shared",
    "approval_requested":       "approval_pending",
    "approval_confirmed":       "journey_complete",
    "project_direction_updated":"preparing_direction",
    "timeline_progressed":      None,
}


STATUS_LABELS = {
    "awaiting_brief":         {"it": "In attesa del brief",      "en": "Awaiting brief"},
    "reviewing_answers":      {"it": "Lettura risposte",          "en": "Reviewing answers"},
    "preparing_direction":    {"it": "Preparazione direzione",    "en": "Preparing direction"},
    "waiting_client_feedback":{"it": "In attesa di feedback",     "en": "Waiting client feedback"},
    "proposal_shared":        {"it": "Proposta condivisa",        "en": "Proposal shared"},
    "approval_pending":       {"it": "Approvazione in sospeso",   "en": "Approval pending"},
    "journey_complete":       {"it": "Journey completata",        "en": "Journey complete"},
}
