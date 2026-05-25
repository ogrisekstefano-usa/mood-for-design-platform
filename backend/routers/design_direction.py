"""Design Direction™ Router · ITER152 Sprint D

Endpoints (mounted on `/api/direction`):

  CLIENT side:
    GET  /me                          → distilled snapshot for current client
    POST /signals                     → push a signal manually (rare)

  STUDIO side:
    GET  /lead/{lead_id}              → snapshot for a relationship
    GET  /lead/{lead_id}/signals      → raw signals (designer intelligence panel)
    POST /lead/{lead_id}/distil       → force a fresh AI distillation

Side-loaders (auto-ingest):
  - onboarding answers (relationship_answer_events)
  - conversation memory fragments (relationship_memory_fragments)
  - design journey events
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path
from pydantic import BaseModel

from core.tenant_context import get_tenant_context
from database import db
from services.design_direction_distiller import distil

router = APIRouter()

_STUDIO_ROLES = {
    "designer", "creative_director", "interior_designer",
    "studio_member", "tenant_admin", "super_admin",
}


def _iso() -> str: return datetime.now(timezone.utc).isoformat()


def _require_client(ctx: dict) -> str:
    role = (ctx.get("role") or "").lower()
    if role not in {"client", "tenant_admin", "super_admin"}:
        raise HTTPException(403, "Client surface only.")
    pid = ctx.get("profile_id")
    if not pid:
        raise HTTPException(401, "Missing profile context.")
    return pid


def _require_studio(ctx: dict):
    if (ctx.get("role") or "").lower() not in _STUDIO_ROLES:
        raise HTTPException(403, "Studio surface only.")


def _client_lead(c, tenant_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
    try:
        prof = (c.table("users_profile").select("email")
                .eq("id", profile_id).limit(1).execute())
        email = prof.data[0]["email"] if prof.data else None
        if email:
            r = (c.table("leads").select("id,contact_email,name")
                 .eq("tenant_id", tenant_id).eq("contact_email", email)
                 .order("updated_at", desc=True).limit(1).execute())
            if r.data:
                return r.data[0]
    except Exception:  # noqa: BLE001
        pass
    return None


# ─────────────────────────────────────────────────────────────────────
# Signal harvester — read-only side-loaders that translate existing
# domain tables into normalised signals on the fly.
# ─────────────────────────────────────────────────────────────────────
_MATERIAL_KEYWORDS = {
    "rovere": ("oak", "Rovere"),
    "oak": ("oak", "Oak"),
    "travertino": ("travertine", "Travertino"),
    "travertine": ("travertine", "Travertine"),
    "noce": ("walnut", "Noce"),
    "walnut": ("walnut", "Walnut"),
    "lino": ("linen", "Lino"),
    "linen": ("linen", "Linen"),
    "marmo": ("marble", "Marmo"),
    "marble": ("marble", "Marble"),
    "ottone": ("brass", "Ottone"),
    "brass": ("brass", "Brass"),
    "pietra": ("limestone", "Pietra"),
    "limestone": ("limestone", "Limestone"),
    "terrazzo": ("terrazzo", "Terrazzo"),
    "ardesia": ("slate", "Ardesia"),
    "slate": ("slate", "Slate"),
}
_LIFESTYLE_KEYWORDS = {
    "slow": ("slow_living", "Slow Living"),
    "tranquill": ("slow_living", "Vivere tranquillo"),
    "famigl": ("family_rituals", "Rituali familiari"),
    "ospit": ("hospitality_oriented", "Vocazione ospitale"),
    "lavor": ("work_oriented", "Spazio di lavoro"),
}
_ATMOSPHERE_KEYWORDS = {
    "warm": ("warm_contemporary", "Warm Contemporary"),
    "contemporan": ("warm_contemporary", "Warm Contemporary"),
    "minimal": ("sculptural_minimalism", "Sculptural Minimalism"),
    "scandi": ("scandinavian_calm", "Scandinavian Calm"),
    "mediterraneo": ("mediterranean_calm", "Mediterranean Calm"),
    "boutique": ("quiet_hospitality", "Quiet Hospitality"),
}


def _signals_from_messages(c, tenant_id: str, lead_id: str) -> List[Dict[str, Any]]:
    """Extract material/lifestyle/atmosphere mentions from client messages
    and memory fragments."""
    rows: List[Dict[str, Any]] = []

    # Memory fragments first (already distilled)
    try:
        mem = (c.table("relationship_memory_fragments").select("*")
               .eq("tenant_id", tenant_id).eq("lead_id", lead_id)
               .order("created_at", desc=True).limit(20).execute()).data or []
        for m in mem:
            text = (m.get("body") or "").lower()
            for kw, (key, lbl) in _MATERIAL_KEYWORDS.items():
                if kw in text:
                    rows.append({
                        "signal_type": "materials",
                        "signal_key": key,
                        "signal_value": lbl,
                        "confidence": 0.7,
                        "weight": float(m.get("signal_strength") or 0.6),
                        "source_type": "conversation",
                    })
            for kw, (key, lbl) in _LIFESTYLE_KEYWORDS.items():
                if kw in text:
                    rows.append({
                        "signal_type": "lifestyle", "signal_key": key,
                        "signal_value": lbl, "confidence": 0.6, "weight": 0.7,
                        "source_type": "conversation",
                    })
            for kw, (key, lbl) in _ATMOSPHERE_KEYWORDS.items():
                if kw in text:
                    rows.append({
                        "signal_type": "atmosphere", "signal_key": key,
                        "signal_value": lbl, "confidence": 0.65, "weight": 0.8,
                        "source_type": "conversation",
                    })
    except Exception:  # noqa: BLE001
        pass

    # Client messages directly
    try:
        thr = (c.table("relationship_threads").select("id")
               .eq("tenant_id", tenant_id).eq("lead_id", lead_id).limit(1).execute())
        if thr.data:
            msgs = (c.table("relationship_messages")
                    .select("content,sender_type,created_at")
                    .eq("thread_id", thr.data[0]["id"])
                    .eq("sender_type", "client")
                    .order("created_at", desc=True).limit(50).execute()).data or []
            for m in msgs:
                text = (m.get("content") or "").lower()
                for kw, (key, lbl) in _MATERIAL_KEYWORDS.items():
                    if kw in text:
                        rows.append({
                            "signal_type": "materials", "signal_key": key,
                            "signal_value": lbl, "confidence": 0.55, "weight": 0.6,
                            "source_type": "conversation",
                        })
                for kw, (key, lbl) in _ATMOSPHERE_KEYWORDS.items():
                    if kw in text:
                        rows.append({
                            "signal_type": "atmosphere", "signal_key": key,
                            "signal_value": lbl, "confidence": 0.5, "weight": 0.55,
                            "source_type": "conversation",
                        })
    except Exception:  # noqa: BLE001
        pass

    return rows


def _signals_from_intake(c, tenant_id: str, lead_id: str) -> List[Dict[str, Any]]:
    """Onboarding intake answers via relationship_answer_events."""
    rows: List[Dict[str, Any]] = []
    try:
        ans = (c.table("relationship_answer_events")
               .select("question_key, option_value, raw_value, group_key, occurred_at")
               .eq("tenant_id", tenant_id).eq("lead_id", lead_id)
               .order("occurred_at", desc=True).limit(80).execute()).data or []
        for a in ans:
            v = (a.get("option_value") or a.get("raw_value") or "").lower()
            qk = (a.get("question_key") or "").lower()
            gk = (a.get("group_key") or "").lower()
            # Heuristic: map by group_key/question_key
            t = None
            if "atmospher" in gk or "atmospher" in qk:
                t = "atmosphere"
            elif "material" in gk or "material" in qk:
                t = "materials"
            elif "lifestyle" in gk or "rhythm" in gk or "famil" in gk:
                t = "lifestyle"
            elif "culture" in gk or "cultural" in gk:
                t = "cultural_register"
            if t and v:
                rows.append({
                    "signal_type": t,
                    "signal_key": v.replace(" ", "_")[:80],
                    "signal_value": (a.get("option_value") or a.get("raw_value")),
                    "confidence": 0.85,
                    "weight": 1.0,
                    "source_type": "onboarding",
                })
    except Exception:  # noqa: BLE001
        pass
    return rows


def _ingested_signals(c, tenant_id: str, lead_id: str) -> List[Dict[str, Any]]:
    """Persisted signals (manual or earlier auto-ingest)."""
    try:
        r = (c.table("relationship_direction_signals").select("*")
             .eq("tenant_id", tenant_id).eq("lead_id", lead_id)
             .order("created_at", desc=True).limit(120).execute())
        return r.data or []
    except Exception:  # noqa: BLE001
        return []


def _collect_all_signals(c, tenant_id: str, lead_id: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    out.extend(_ingested_signals(c, tenant_id, lead_id))
    out.extend(_signals_from_intake(c, tenant_id, lead_id))
    out.extend(_signals_from_messages(c, tenant_id, lead_id))
    # Deduplicate by (type,key) keeping highest weight
    dedup: Dict[tuple, Dict[str, Any]] = {}
    for s in out:
        k = (s.get("signal_type"), s.get("signal_key"))
        prev = dedup.get(k)
        if not prev or (s.get("weight", 0) > prev.get("weight", 0)):
            dedup[k] = s
    return list(dedup.values())


def _latest_snapshot(c, tenant_id: str, lead_id: Optional[str],
                     client_id: Optional[str]) -> Optional[Dict[str, Any]]:
    try:
        q = (c.table("relationship_direction_snapshots").select("*")
             .eq("tenant_id", tenant_id)
             .order("created_at", desc=True).limit(1))
        if lead_id:
            q = q.eq("lead_id", lead_id)
        elif client_id:
            q = q.eq("client_profile_id", client_id)
        else:
            return None
        r = q.execute()
        return r.data[0] if r.data else None
    except Exception:  # noqa: BLE001
        return None


def _persist_snapshot(c, *, tenant_id: str, lead_id: Optional[str],
                      client_id: Optional[str], summary: Dict[str, Any],
                      signals_count: int, created_by: Optional[str]) -> Dict[str, Any]:
    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "lead_id": lead_id,
        "client_profile_id": client_id,
        "atmosphere_summary": summary.get("atmosphere") or {},
        "material_summary":   summary.get("materials") or {},
        "lifestyle_summary":  summary.get("lifestyle") or {},
        "cultural_summary":   summary.get("cultural")  or {},
        "palette_summary":    summary.get("palette")   or {},
        "narrative_summary":  summary.get("narrative") or None,
        "signals_count": signals_count,
        "generated_by": "claude-sonnet-4-5",
        "created_by": created_by,
        "created_at": _iso(),
    }
    row = {k: v for k, v in row.items() if v is not None}
    c.table("relationship_direction_snapshots").insert(row).execute()
    return row


# ─────────────────────────────────────────────────────────────────────
# CLIENT endpoints
# ─────────────────────────────────────────────────────────────────────
@router.get("/me")
def my_direction(ctx: dict = Depends(get_tenant_context)):
    """Return the client's current Design Direction™ snapshot.

    If no snapshot has been generated yet but signals exist, computes a
    fresh one on the fly and persists it.
    """
    profile_id = _require_client(ctx)
    c = db()
    lead = _client_lead(c, ctx["tenant_id"], profile_id)
    lead_id = (lead or {}).get("id")

    snap = _latest_snapshot(c, ctx["tenant_id"], lead_id, profile_id)
    if snap:
        return {"snapshot": snap, "lead_id": lead_id, "cached": True}

    signals = _collect_all_signals(c, ctx["tenant_id"], lead_id) if lead_id else []
    summary = distil(signals, locale="it")
    if lead_id or profile_id:
        try:
            snap = _persist_snapshot(
                c, tenant_id=ctx["tenant_id"], lead_id=lead_id,
                client_id=profile_id, summary=summary,
                signals_count=len(signals), created_by=profile_id,
            )
        except Exception:  # noqa: BLE001
            snap = {**summary, "signals_count": len(signals)}
    else:
        snap = {**summary, "signals_count": len(signals)}
    return {"snapshot": snap, "lead_id": lead_id, "cached": False}


# ─────────────────────────────────────────────────────────────────────
# STUDIO endpoints
# ─────────────────────────────────────────────────────────────────────
@router.get("/lead/{lead_id}")
def lead_direction(lead_id: str = Path(...),
                   ctx: dict = Depends(get_tenant_context)):
    _require_studio(ctx)
    c = db()
    snap = _latest_snapshot(c, ctx["tenant_id"], lead_id, None)
    if not snap:
        signals = _collect_all_signals(c, ctx["tenant_id"], lead_id)
        summary = distil(signals, locale="it")
        snap = _persist_snapshot(
            c, tenant_id=ctx["tenant_id"], lead_id=lead_id, client_id=None,
            summary=summary, signals_count=len(signals),
            created_by=ctx.get("profile_id"),
        )
    return {"snapshot": snap, "lead_id": lead_id}


@router.get("/lead/{lead_id}/signals")
def lead_signals(lead_id: str = Path(...),
                 ctx: dict = Depends(get_tenant_context)):
    """Designer intelligence panel — raw signals grouped by type."""
    _require_studio(ctx)
    c = db()
    signals = _collect_all_signals(c, ctx["tenant_id"], lead_id)
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for s in signals:
        grouped.setdefault(s.get("signal_type", "other"), []).append(s)
    for arr in grouped.values():
        arr.sort(key=lambda x: (x.get("weight", 1.0) * x.get("confidence", 0.5)),
                 reverse=True)
    return {"data": grouped, "count": len(signals)}


@router.post("/lead/{lead_id}/distil")
def force_distil(lead_id: str = Path(...),
                 ctx: dict = Depends(get_tenant_context)):
    """Force-regenerate the AI distillation."""
    _require_studio(ctx)
    c = db()
    signals = _collect_all_signals(c, ctx["tenant_id"], lead_id)
    summary = distil(signals, locale="it")
    snap = _persist_snapshot(
        c, tenant_id=ctx["tenant_id"], lead_id=lead_id, client_id=None,
        summary=summary, signals_count=len(signals),
        created_by=ctx.get("profile_id"),
    )
    return {"snapshot": snap, "signals_count": len(signals)}


class _SignalBody(BaseModel):
    signal_type: str
    signal_key: str
    signal_value: Optional[str] = None
    confidence: Optional[float] = 0.6
    weight: Optional[float] = 1.0
    source_type: Optional[str] = "manual"


@router.post("/signals", status_code=201)
def add_signal(body: _SignalBody, ctx: dict = Depends(get_tenant_context)):
    role = (ctx.get("role") or "").lower()
    if role == "client":
        profile_id = ctx["profile_id"]
        c = db()
        lead = _client_lead(c, ctx["tenant_id"], profile_id)
        lead_id = (lead or {}).get("id")
        client_id = profile_id
    else:
        _require_studio(ctx)
        # Studio-side: must provide lead_id via metadata (Sprint D MVP: ignore)
        raise HTTPException(400, "Studio side must use /lead/{id}/distil.")

    c.table("relationship_direction_signals").insert({
        "id": str(uuid.uuid4()),
        "tenant_id": ctx["tenant_id"],
        "lead_id": lead_id,
        "client_profile_id": client_id,
        "signal_type": body.signal_type,
        "signal_key": body.signal_key,
        "signal_value": body.signal_value,
        "confidence": body.confidence,
        "weight": body.weight,
        "source_type": body.source_type,
    }).execute()
    return {"ok": True}
