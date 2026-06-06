"""
Speech-to-Text · admin-only endpoint backed by OpenAI Whisper via Emergent LLM Key.

Used by the CRM voice-note flow: an advisor records a short audio note in the
browser, uploads it as multipart/form-data, and gets back the transcription
that they can proof-read before saving.

POST /api/transcribe
  multipart/form-data:
    file:     audio blob (webm/mp3/m4a/wav/mp4/mpeg/mpga, ≤25MB)
    language: ISO-639-1 (optional, defaults to "it")
  → 200 { "text": "...transcription..." }
  → 400 if file missing or too large
  → 502 if STT backend failed
"""
from __future__ import annotations

import io
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from emergentintegrations.llm.openai import OpenAISpeechToText

from ._advisor_scope import require_advisor_scope

router = APIRouter()
log = logging.getLogger("transcribe")

MAX_BYTES = 25 * 1024 * 1024
ALLOWED_MIMES = {
    "audio/webm", "audio/ogg", "audio/wav", "audio/x-wav",
    "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a", "audio/x-m4a",
    "video/webm",  # browsers often send recorder blobs as video/webm
}


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form("it"),
    scope: dict = Depends(require_advisor_scope),
):
    if not file:
        raise HTTPException(400, "Missing audio file")

    # Light validation — Whisper itself accepts more formats than what the
    # browser typically produces, so we only reject obviously wrong ones.
    if file.content_type and file.content_type.lower() not in ALLOWED_MIMES:
        log.warning("transcribe · unexpected mime %s", file.content_type)
        # Don't reject, Whisper is forgiving — but log.

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(400, "Empty audio file")
    if len(data) > MAX_BYTES:
        raise HTTPException(400, f"Audio exceeds {MAX_BYTES // (1024*1024)}MB limit")

    api_key = os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(502, "STT key not configured")

    # Whisper accepts a file-like object with a `name` attribute (used for ext sniffing)
    filename = file.filename or "voice.webm"
    buf = io.BytesIO(data)
    buf.name = filename

    try:
        stt = OpenAISpeechToText(api_key=api_key)
        response = await stt.transcribe(
            file=buf,
            model="whisper-1",
            response_format="json",
            language=(language or "it").lower()[:2] or None,
        )
        text = getattr(response, "text", "") or ""
    except Exception as e:  # noqa: BLE001 — surface to advisor cleanly
        log.exception("transcribe failed")
        raise HTTPException(502, f"Transcription failed: {e}")

    return {"text": text.strip(), "language": (language or "it")}
