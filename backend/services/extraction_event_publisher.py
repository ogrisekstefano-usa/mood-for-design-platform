"""KE-001 · Knowledge Engine Extraction Event Publisher.

Append-only stream of extraction lifecycle events into
`extraction_event_log`. Consumed by:
  - KE-002 Control Room (Live Activity Stream, Worker Status, KPI, Warning)
  - Notification Center (M4)
  - Audit Trail

Designed to be graceful: if the table doesn't exist or DB hiccups, the
emit call MUST never raise — the worker keeps running.
"""
from __future__ import annotations
import logging
import os
import socket
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from database import db

logger = logging.getLogger("ke001.events")

# ─── Event kinds (mirrors the SQL CHECK constraint in migration 131) ──
JOB_STARTED       = "JOB_STARTED"
JOB_COMPLETED     = "JOB_COMPLETED"
JOB_FAILED        = "JOB_FAILED"
JOB_STALLED       = "JOB_STALLED"
JOB_RECOVERED     = "JOB_RECOVERED"
JOB_PAUSED        = "JOB_PAUSED"
JOB_RESUMED       = "JOB_RESUMED"
JOB_CANCELLED     = "JOB_CANCELLED"

DOCUMENT_STARTED  = "DOCUMENT_STARTED"
DOCUMENT_FAILED   = "DOCUMENT_FAILED"
DOCUMENT_COMPLETED = "DOCUMENT_COMPLETED"
DOCUMENT_RETRIED  = "DOCUMENT_RETRIED"

PAGE_PROCESSED    = "PAGE_PROCESSED"
STAGE_TRANSITION  = "STAGE_TRANSITION"

IMAGE_FOUND       = "IMAGE_FOUND"
PRODUCT_FOUND     = "PRODUCT_FOUND"
DESIGNER_FOUND    = "DESIGNER_FOUND"
MATERIAL_FOUND    = "MATERIAL_FOUND"
BRAND_ALIAS_FOUND = "BRAND_ALIAS_FOUND"
RELATION_FOUND    = "RELATION_FOUND"

WARNING_CREATED   = "WARNING_CREATED"
ERROR             = "ERROR"


_LOCAL = threading.local()


def worker_id() -> str:
    """Stable identifier of this Python worker (hostname:pid)."""
    if getattr(_LOCAL, "wid", None):
        return _LOCAL.wid
    _LOCAL.wid = f"{socket.gethostname()}:{os.getpid()}"
    return _LOCAL.wid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def emit(
    *,
    tenant_id: str,
    catalog_set_id: str,
    kind: str,
    message: str,
    catalog_document_id: Optional[str] = None,
    job_id: Optional[str] = None,
    entity_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Best-effort insert of a single event row. NEVER raises."""
    row = {
        "tenant_id": tenant_id,
        "catalog_set_id": catalog_set_id,
        "catalog_document_id": catalog_document_id,
        "job_id": job_id,
        "kind": kind,
        "message": message[:400] if message else kind,
        "entity_id": entity_id,
        "payload": payload or {},
        "ts": _now(),
    }
    try:
        db().table("extraction_event_log").insert(row).execute()
    except Exception as ex:
        # Graceful degrade: if the table is missing (rolled-back migration)
        # or a transient DB hiccup, just log. Never break the runner.
        logger.warning(f"emit({kind}) failed: {ex}")
