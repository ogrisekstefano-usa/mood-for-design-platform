"""crm_voice_notes.py — Voice Note ingestion + Whisper transcription.

This router is mounted under /api/relationships in server.py and adds:
  POST /api/relationships/accounts/{aid}/voice-notes
       multipart/form-data: file=<audio> [+ contact_id, project_id,
       moodboard_id, locale, title]

       → uploads to Supabase Storage (`tenant-assets/crm-voice-notes/...`),
       → transcribes with OpenAI Whisper via Emergent Integrations,
       → creates an `interactions` row of type "voice_note" carrying the
         audio_url, duration_sec hint and transcript in report_payload.
"""
from __future__ import annotations

import io
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from dotenv import load_dotenv

from database import db
from core.tenant_context import get_tenant_context

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(tags=["relationships"], prefix="/relationships")

# 25 MB hard limit (matches OpenAI Whisper API)
MAX_AUDIO_BYTES = 25 * 1024 * 1024
ALLOWED_AUDIO_MIME = {
    "audio/webm", "audio/ogg", "audio/mp3", "audio/mpeg",
    "audio/wav", "audio/x-wav", "audio/m4a", "audio/mp4",
}
BUCKET = "tenant-assets"


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ext_for(mime: str, filename: Optional[str]) -> str:
    """Pick a Whisper-friendly extension based on mime/filename."""
    m = (mime or "").lower()
    if "webm" in m:
        return "webm"
    if "ogg" in m:
        return "ogg"
    if "mp4" in m or "m4a" in m:
        return "m4a"
    if "wav" in m:
        return "wav"
    if "mpeg" in m or "mp3" in m:
        return "mp3"
    # Fallback: use original extension if any, else webm.
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in {"webm", "ogg", "mp3", "mp4", "m4a", "wav", "mpeg", "mpga"}:
            return ext
    return "webm"


async def _transcribe(audio_bytes: bytes, filename: str, lang: Optional[str]) -> Dict[str, Any]:
    """Run Whisper STT through emergentintegrations.

    Returns {"text": str, "language": str, "duration": float|None}.
    Never raises — on failure returns {"text": "", "error": "..."}.
    """
    api_key = os.getenv("EMERGENT_LLM_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"text": "", "error": "EMERGENT_LLM_KEY missing"}

    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText  # type: ignore
    except Exception as e:
        logger.exception("emergentintegrations not available")
        return {"text": "", "error": f"integration import failed: {e}"}

    try:
        stt = OpenAISpeechToText(api_key=api_key)
        bio = io.BytesIO(audio_bytes)
        bio.name = filename  # whisper-1 sniffs extension from .name
        kwargs = {
            "file": bio,
            "model": "whisper-1",
            "response_format": "verbose_json",
            "temperature": 0,
        }
        if lang:
            # Whisper accepts ISO-639-1 (e.g. "it", "en")
            kwargs["language"] = lang.split("-")[0].lower()
        response = await stt.transcribe(**kwargs)
        out: Dict[str, Any] = {
            "text": getattr(response, "text", "") or "",
            "language": getattr(response, "language", None) or kwargs.get("language"),
            "duration": getattr(response, "duration", None),
        }
        return out
    except Exception as e:
        logger.exception("Whisper STT call failed")
        return {"text": "", "error": str(e)}


def _row_or_404(c, table: str, row_id: str, tid: str) -> Dict[str, Any]:
    r = (c.table(table).select("*").eq("id", row_id).eq("tenant_id", tid)
         .limit(1).execute().data or [])
    if not r:
        raise HTTPException(404, f"{table} not found")
    return r[0]


@router.post("/accounts/{account_id}/voice-notes", status_code=201)
async def add_voice_note(
    account_id: str,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    locale: Optional[str] = Form(None),
    contact_id: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
    moodboard_id: Optional[str] = Form(None),
    duration_sec: Optional[float] = Form(None),
    ctx=Depends(get_tenant_context),
):
    """Upload + transcribe a voice note, then persist as an interaction.

    Errors:
      400 — invalid mime or empty file
      404 — account not found
      413 — file > 25 MB
    """
    c = db()
    tid = ctx["tenant_id"]
    _row_or_404(c, "accounts", account_id, tid)

    raw = await file.read()
    if not raw:
        raise HTTPException(400, "empty audio payload")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(413, f"audio exceeds {MAX_AUDIO_BYTES // (1024*1024)} MB limit")
    mime = (file.content_type or "").lower()
    if mime and mime not in ALLOWED_AUDIO_MIME and not mime.startswith("audio/"):
        raise HTTPException(400, f"unsupported mime: {mime}")

    ext = _ext_for(mime, file.filename)
    voice_id = str(uuid.uuid4())
    storage_path = f"{tid}/crm-voice-notes/{account_id}/{voice_id}.{ext}"

    # Upload to Supabase Storage
    try:
        c.storage.from_(BUCKET).upload(
            storage_path, raw,
            {"contentType": mime or f"audio/{ext}", "upsert": "false"}
        )
    except Exception as e:
        logger.exception("voice note upload failed")
        raise HTTPException(500, f"storage upload failed: {e}")

    # Public URL (bucket is private — we generate a signed URL with long TTL)
    audio_url: Optional[str] = None
    try:
        signed = c.storage.from_(BUCKET).create_signed_url(storage_path, 60 * 60 * 24 * 365 * 5)
        audio_url = signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl")
    except Exception:
        audio_url = None

    # Transcribe (best-effort)
    transcription = await _transcribe(raw, f"voice.{ext}", locale)

    # Persist the interaction
    iid = str(uuid.uuid4())
    row = {
        "id":               iid,
        "tenant_id":        tid,
        "account_id":       account_id,
        "interaction_type": "voice_note",
        "contact_id":       contact_id,
        "project_id":       project_id,
        "moodboard_id":     moodboard_id,
        "occurred_at":      _iso(),
        "title":            title or "Nota vocale",
        "summary":          (transcription.get("text") or "")[:1200],
        "report_payload":   {
            "voice_note_id": voice_id,
            "transcript":    transcription.get("text") or "",
            "transcript_language": transcription.get("language"),
            "transcript_error":    transcription.get("error"),
            "duration_sec":  duration_sec or transcription.get("duration"),
        },
        "attachments": [{
            "kind":         "audio",
            "url":          audio_url,
            "storage_path": storage_path,
            "bucket":       BUCKET,
            "mime":         mime or f"audio/{ext}",
            "bytes":        len(raw),
            "duration_sec": duration_sec or transcription.get("duration"),
        }],
        "is_automatic": False,
        "created_by":   ctx.get("profile_id"),
        "created_at":   _iso(),
    }
    c.table("interactions").insert(row).execute()

    # Touch account last_activity_at
    c.table("accounts").update({
        "last_activity_at": row["occurred_at"],
        "updated_at":       _iso(),
    }).eq("id", account_id).eq("tenant_id", tid).execute()

    return {"ok": True, "interaction": row, "transcript_ok": bool(transcription.get("text"))}
