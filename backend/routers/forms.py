"""Blueprint Form Engine — CRUD for forms + submission ingest.

Forms:         tenant_settings.key = 'form.{slug}'
Submissions:   tenant_settings.key = 'form_submission.{slug}.{uuid}'
                                     (future-migration to a dedicated table)

Public submission endpoint requires NO auth — only that the tenant exists,
is active, and the form has `status='published'`. Lead-purpose forms ALSO
write a row into the `leads` table for workspace continuity.
"""
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field

from core.permissions import P_TENANT_BRANDING, P_TENANT_SETTINGS
from core.tenant_context import (
    get_tenant_context, get_tenant_settings, upsert_tenant_setting,
    audit_log, require_permission,
)
from core.form_registry import (
    FIELD_TYPES, FIELD_TYPES_BY_KEY, FORM_PURPOSES, FORM_LAYOUTS, FORM_ATMOSPHERES,
    field_known, default_form, validate_submission,
)
from database import db, db_available

router = APIRouter()
logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _form_key(slug: str) -> str:
    return f"form.{slug}"


def _submission_key(form_slug: str, sub_id: str) -> str:
    return f"form_submission.{form_slug}.{sub_id}"


# ── Pydantic models ──────────────────────────────────────────────────────────
class FormUpsert(BaseModel):
    title:       Optional[Dict[str, Any]] = None
    description: Optional[Dict[str, Any]] = None
    purpose:     Optional[str] = None
    status:      Optional[str] = None  # draft | published | archived
    layout:      Optional[str] = None
    atmosphere:  Optional[str] = None
    settings:    Optional[Dict[str, Any]] = None
    ai:          Optional[Dict[str, Any]] = None
    scoring:     Optional[Dict[str, Any]] = None
    integrations:Optional[Dict[str, Any]] = None
    steps:       Optional[List[Dict[str, Any]]] = None


class SubmissionBody(BaseModel):
    answers:  Dict[str, Any] = Field(default_factory=dict)
    meta:     Optional[Dict[str, Any]] = None  # referer, locale, utm, …
    draft:    Optional[bool] = False


# ── Authed: catalog of field types / purposes / layouts ─────────────────────
@router.get("/registry")
def form_registry(ctx: dict = Depends(get_tenant_context)):
    return {
        "field_types": FIELD_TYPES,
        "purposes":    FORM_PURPOSES,
        "layouts":     FORM_LAYOUTS,
        "atmospheres": FORM_ATMOSPHERES,
    }


# ── Authed: list forms ──────────────────────────────────────────────────────
@router.get("")
def list_forms(ctx: dict = Depends(get_tenant_context)):
    client = db()
    r = client.table("tenant_settings").select("key, value_json, updated_at") \
        .eq("tenant_id", ctx["tenant_id"]).like("key", "form.%").execute()
    out = []
    for row in (r.data or []):
        v = row.get("value_json") or {}
        out.append({
            "slug":     v.get("slug") or row["key"].replace("form.", ""),
            "title":    v.get("title"),
            "purpose":  v.get("purpose"),
            "status":   v.get("status", "draft"),
            "steps":    len(v.get("steps") or []),
            "updated_at": row.get("updated_at"),
        })
    return {"data": out}


# ── Authed: read a form ─────────────────────────────────────────────────────
@router.get("/{slug}")
def get_form(slug: str, ctx: dict = Depends(get_tenant_context)):
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Invalid slug")
    form = get_tenant_settings(ctx["tenant_id"], _form_key(slug), None)
    if not form:
        form = default_form(slug)
        form["_seed"] = True
    return form


# ── Authed: upsert a form ───────────────────────────────────────────────────
@router.put("/{slug}")
def upsert_form(slug: str, body: FormUpsert,
                ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Invalid slug")
    existing = get_tenant_settings(ctx["tenant_id"], _form_key(slug), None) or default_form(slug)
    existing.pop("_seed", None)
    payload = body.model_dump(exclude_none=True)

    # Validate field types on steps
    if "steps" in payload:
        clean_steps = []
        for step in payload["steps"]:
            fields = []
            for f in step.get("fields") or []:
                if not field_known(f.get("type")):
                    raise HTTPException(400, f"Unknown field type: {f.get('type')}")
                fields.append({**f, "id": f.get("id") or str(uuid.uuid4()),
                               "key": f.get("key") or (f.get("id") or "").replace("-", "_")})
            clean_steps.append({**step, "id": step.get("id") or str(uuid.uuid4()), "fields": fields})
        payload["steps"] = clean_steps

    merged = {**existing, **payload, "slug": slug, "updated_at": _now()}
    if "created_at" not in merged or merged["created_at"] is None:
        merged["created_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _form_key(slug), merged)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "form.update",
              resource_type="form", resource_id=slug, metadata={"keys": list(payload.keys())})
    return merged


# ── Authed: duplicate / reset / delete ──────────────────────────────────────
@router.post("/{slug}/duplicate")
def duplicate_form(slug: str, body: dict = Body(default={}),
                   ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    src = get_tenant_settings(ctx["tenant_id"], _form_key(slug), None)
    if not src:
        raise HTTPException(404, "Form not found")
    new_slug = (body.get("slug") or f"{slug}-copy").lower()
    if not _SLUG_RE.match(new_slug):
        raise HTTPException(400, "Invalid target slug")
    clone = {**src, "slug": new_slug, "status": "draft", "created_at": _now(), "updated_at": _now()}
    upsert_tenant_setting(ctx["tenant_id"], _form_key(new_slug), clone)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "form.duplicate",
              resource_type="form", resource_id=new_slug, metadata={"source": slug})
    return clone


@router.post("/{slug}/reset")
def reset_form(slug: str,
               ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    fresh = default_form(slug)
    fresh["created_at"] = _now()
    fresh["updated_at"] = _now()
    upsert_tenant_setting(ctx["tenant_id"], _form_key(slug), fresh)
    audit_log(ctx["tenant_id"], ctx["profile_id"], "form.reset",
              resource_type="form", resource_id=slug)
    return fresh


@router.delete("/{slug}")
def delete_form(slug: str,
                ctx: dict = Depends(require_permission(P_TENANT_BRANDING))):
    client = db()
    client.table("tenant_settings").delete() \
        .eq("tenant_id", ctx["tenant_id"]).eq("key", _form_key(slug)).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "form.delete",
              resource_type="form", resource_id=slug)
    return {"message": "deleted"}


# ── Authed: list submissions for a form ─────────────────────────────────────
@router.get("/{slug}/submissions")
def list_submissions(slug: str, ctx: dict = Depends(get_tenant_context)):
    client = db()
    r = client.table("tenant_settings").select("key, value_json, updated_at") \
        .eq("tenant_id", ctx["tenant_id"]).like("key", f"form_submission.{slug}.%") \
        .order("updated_at", desc=True).limit(200).execute()
    out = []
    for row in (r.data or []):
        v = row.get("value_json") or {}
        out.append({
            "id":      v.get("id") or row["key"].split(".")[-1],
            "answers": v.get("answers", {}),
            "meta":    v.get("meta", {}),
            "draft":   v.get("draft", False),
            "submitted_at": v.get("submitted_at"),
        })
    return {"data": out}


# ── PUBLIC: serve a published form ──────────────────────────────────────────
@router.get("/public/{tenant_slug}/{form_slug}")
def public_get_form(tenant_slug: str, form_slug: str):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    t = client.table("tenants").select("id, status").eq("slug", tenant_slug).limit(1).execute()
    if not t.data:
        d = client.table("tenant_domains").select("tenant_id").eq("domain", tenant_slug).limit(1).execute()
        if not d.data:
            raise HTTPException(404, "Tenant not found")
        t = client.table("tenants").select("id, status").eq("id", d.data[0]["tenant_id"]).limit(1).execute()
        if not t.data:
            raise HTTPException(404, "Tenant not found")
    if t.data[0].get("status") != "active":
        raise HTTPException(403, "Tenant inactive")

    tid = t.data[0]["id"]
    r = client.table("tenant_settings").select("value_json") \
        .eq("tenant_id", tid).eq("key", _form_key(form_slug)).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Form not found")
    form = r.data[0].get("value_json") or {}
    if form.get("status") != "published":
        raise HTTPException(403, "Form not published")
    # Strip internal fields for public consumption
    public_form = {k: v for k, v in form.items() if k not in ("scoring", "integrations", "ai")}
    return public_form


# ── PUBLIC: submit a response ───────────────────────────────────────────────
@router.post("/public/{tenant_slug}/{form_slug}/submit")
def public_submit_form(tenant_slug: str, form_slug: str, body: SubmissionBody):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    t = client.table("tenants").select("id, status").eq("slug", tenant_slug).limit(1).execute()
    if not t.data:
        d = client.table("tenant_domains").select("tenant_id").eq("domain", tenant_slug).limit(1).execute()
        if not d.data:
            raise HTTPException(404, "Tenant not found")
        t = client.table("tenants").select("id, status").eq("id", d.data[0]["tenant_id"]).limit(1).execute()
        if not t.data:
            raise HTTPException(404, "Tenant not found")
    if t.data[0].get("status") != "active":
        raise HTTPException(403, "Tenant inactive")

    tid = t.data[0]["id"]
    # Pull form
    fr = client.table("tenant_settings").select("value_json") \
        .eq("tenant_id", tid).eq("key", _form_key(form_slug)).limit(1).execute()
    if not fr.data:
        raise HTTPException(404, "Form not found")
    form = fr.data[0].get("value_json") or {}
    if form.get("status") != "published":
        raise HTTPException(403, "Form not published")

    # Validate
    if not body.draft:
        errors = validate_submission(form, body.answers or {})
        if errors:
            raise HTTPException(422, {"errors": errors})

    # Persist submission
    sub_id = str(uuid.uuid4())
    submission = {
        "id":      sub_id,
        "form_slug": form_slug,
        "answers": body.answers or {},
        "meta":    body.meta or {},
        "draft":   bool(body.draft),
        "submitted_at": _now(),
    }
    upsert_tenant_setting(tid, _submission_key(form_slug, sub_id), submission)

    # Lead-purpose: also write to `leads` table (best effort)
    purpose = form.get("purpose")
    if purpose in ("lead", "design_request") and not body.draft:
        try:
            answers = body.answers or {}
            client.table("leads").insert({
                "id":          str(uuid.uuid4()),
                "tenant_id":   tid,
                "first_name":  answers.get("first_name") or "",
                "last_name":   answers.get("last_name") or "",
                "email":       answers.get("email"),
                "phone":       answers.get("phone"),
                "country":     answers.get("country"),
                "city":        answers.get("city"),
                "lead_type":   "private_client",
                "project_type":answers.get("project_type"),
                "budget_range":str(answers.get("budget")) if answers.get("budget") is not None else None,
                "timeline":    answers.get("timeline"),
                "style_preference": ", ".join(answers.get("style_preferences") or []) if isinstance(answers.get("style_preferences"), list) else answers.get("style_preferences"),
                "notes":       answers.get("notes"),
                "status":      "new",
                "source":      f"form:{form_slug}",
                "metadata_json": {"submission_id": sub_id, "form_slug": form_slug, "purpose": purpose},
                "created_at":  _now(),
            }).execute()
        except Exception as e:
            logger.warning(f"Lead row insert failed for submission {sub_id}: {e}")

    # Audit (no profile_id since public)
    audit_log(tid, None, "form.submit",
              resource_type="form", resource_id=form_slug,
              metadata={"submission_id": sub_id, "draft": body.draft})

    return {"submission_id": sub_id, "thank_you": form.get("settings", {}).get("thank_you", {})}
