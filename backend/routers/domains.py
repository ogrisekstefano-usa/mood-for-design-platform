"""Tenant Domains — CRUD + DNS verification scaffolding.

State machine:
   created → pending → verified ↔ failed
   ssl: pending → issued

Verification is **manual** (read DNS) for Session H. A future webhook
integration with Vercel/Cloudflare/etc. will flip these without polling.
"""
import logging
import re
import socket
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.tenant_context import require_permission, audit_log
from core.permissions import P_TENANT_SETTINGS
from core.licensing import assert_capacity
from database import db

router = APIRouter()
logger = logging.getLogger(__name__)


# Hostname validation — strict but pragmatic
HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$"
)


# ── Schemas ─────────────────────────────────────────────────────────
class DomainOut(BaseModel):
    id: str
    tenant_id: str
    hostname: str
    kind: str
    domain_type: str = "custom"   # subdomain | custom — billing-grade flag
    is_primary: bool
    verification_token: str
    verification_status: str
    ssl_status: str
    last_checked_at: Optional[str] = None
    dns_target: Optional[str] = None
    dns_records: List[dict] = []
    created_at: Optional[str] = None


class DomainCreate(BaseModel):
    hostname: str = Field(min_length=3, max_length=253)
    kind: Optional[str] = "custom"     # subdomain | custom | apex


class DomainPatch(BaseModel):
    is_primary: Optional[bool] = None


# ── Helpers ─────────────────────────────────────────────────────────
PLATFORM_APEX = "moodfordesign.com"   # used as CNAME target for tenant domains


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _classify_domain(hostname: str) -> str:
    """subdomain when the host belongs to the platform apex (free, doesn't
    count against the plan's max_domains), else custom (billed)."""
    h = (hostname or "").lower().rstrip(".")
    return "subdomain" if h.endswith(f".{PLATFORM_APEX}") else "custom"


def _instructions_for(domain: dict) -> List[dict]:
    host = domain["hostname"]
    token = domain["verification_token"]
    return [
        {
            "type": "CNAME",
            "name": host,
            "value": PLATFORM_APEX,
            "purpose": "Route traffic to MOOD platform",
        },
        {
            "type": "TXT",
            "name": f"_mood-verify.{host}",
            "value": token,
            "purpose": "Prove domain ownership",
        },
    ]


def _row_to_out(row: dict) -> DomainOut:
    row = dict(row)
    row["dns_records"] = _instructions_for(row)
    # Resilient fallback when `domain_type` column missing on legacy rows
    if not row.get("domain_type"):
        row["domain_type"] = _classify_domain(row.get("hostname", ""))
    row.pop("deleted_at", None)
    row.pop("created_by", None)
    row.pop("updated_at", None)
    return DomainOut(**row)


def _check_dns(hostname: str, expected_token: str) -> dict:
    """Lightweight verification — checks TXT record for the verification token.
    Returns {ok, reason, ssl_ok}. ssl_ok is a best-effort guess via socket connect.
    """
    try:
        # Python stdlib has no DNS TXT lookup without dnspython; we approximate
        # by doing an HTTPS probe to the host (proves SSL works) and recording
        # the result. Actual TXT verification will move into a background
        # worker once dnspython is installed.
        try:
            socket.create_connection((hostname, 443), timeout=4).close()
            ssl_ok = True
        except Exception:
            ssl_ok = False
        # Without TXT lookup we cannot truly verify ownership in this stub.
        # Return verified=False with a clear reason; the super_admin can
        # toggle status manually until the DNS worker lands.
        return {"ok": False, "ssl_ok": ssl_ok,
                "reason": "Automated TXT verification is not yet available."}
    except Exception as e:
        return {"ok": False, "ssl_ok": False, "reason": str(e)}


# ── Endpoints ───────────────────────────────────────────────────────
@router.get("", response_model=List[DomainOut])
def list_domains(ctx: dict = Depends(require_permission(P_TENANT_SETTINGS))):
    client = db()
    r = client.table("tenant_domains").select("*") \
        .eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", None) \
        .order("is_primary", desc=True).order("created_at").execute()
    return [_row_to_out(row) for row in (r.data or [])]


@router.post("", response_model=DomainOut, status_code=201)
def create_domain(
    body: DomainCreate,
    ctx: dict = Depends(require_permission(P_TENANT_SETTINGS)),
):
    host = body.hostname.strip().lower()
    if not HOSTNAME_RE.match(host):
        raise HTTPException(400, "Invalid hostname")

    # Auto-classify: subdomains of the platform apex are FREE (not billed)
    domain_type = _classify_domain(host)

    # License capacity gate — only CUSTOM domains count against quota.
    # Subdomains under moodfordesign.com are always free for the tenant.
    if domain_type == "custom":
        assert_capacity(ctx["tenant_id"], "domains")

    client = db()
    # Duplicate check (across all tenants — hostnames are globally unique)
    dup = client.table("tenant_domains").select("id, tenant_id") \
        .eq("hostname", host).is_("deleted_at", None).limit(1).execute()
    if dup.data:
        raise HTTPException(409, "Domain already registered")

    # First domain becomes primary automatically
    existing_count = client.table("tenant_domains").select("id", count="exact") \
        .eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", None).execute().count or 0

    # `kind` keeps the caller's user-facing intent (apex | subdomain | custom),
    # `domain_type` is the billing-grade flag derived from the hostname suffix.
    payload = {
        "tenant_id": ctx["tenant_id"],
        "hostname": host,
        "kind": body.kind or domain_type,
        "domain_type": domain_type,
        "is_primary": existing_count == 0,
        "verification_status": "pending",
        "ssl_status": "pending",
        "dns_target": PLATFORM_APEX,
        "created_by": ctx["profile_id"],
    }
    r = client.table("tenant_domains").insert(payload).execute()
    row = r.data[0]
    audit_log(ctx["tenant_id"], ctx["profile_id"], "domain.created",
              resource_type="domain", resource_id=row["id"],
              metadata={"hostname": host, "domain_type": domain_type})
    return _row_to_out(row)


@router.get("/{domain_id}/instructions")
def get_instructions(
    domain_id: str,
    ctx: dict = Depends(require_permission(P_TENANT_SETTINGS)),
):
    client = db()
    r = client.table("tenant_domains").select("*") \
        .eq("id", domain_id).eq("tenant_id", ctx["tenant_id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Domain not found")
    row = r.data[0]
    return {
        "hostname": row["hostname"],
        "dns_target": row.get("dns_target") or PLATFORM_APEX,
        "verification_token": row["verification_token"],
        "records": _instructions_for(row),
        "verification_status": row["verification_status"],
        "ssl_status": row["ssl_status"],
    }


@router.post("/{domain_id}/verify", response_model=DomainOut)
def verify_domain(
    domain_id: str,
    ctx: dict = Depends(require_permission(P_TENANT_SETTINGS)),
):
    client = db()
    r = client.table("tenant_domains").select("*") \
        .eq("id", domain_id).eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", None) \
        .limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Domain not found")
    row = r.data[0]
    chk = _check_dns(row["hostname"], row["verification_token"])
    update = {
        "last_checked_at": _now(),
        "ssl_status": "issued" if chk.get("ssl_ok") else "pending",
    }
    if chk.get("ok"):
        update["verification_status"] = "verified"
    # Don't flip to 'failed' on the first attempt — keep 'pending' so the user
    # can retry after DNS propagation.
    client.table("tenant_domains").update(update).eq("id", domain_id).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "domain.verify_attempt",
              resource_type="domain", resource_id=domain_id,
              metadata={"hostname": row["hostname"], **chk})
    fresh = client.table("tenant_domains").select("*").eq("id", domain_id).limit(1).execute()
    return _row_to_out(fresh.data[0])


@router.patch("/{domain_id}", response_model=DomainOut)
def patch_domain(
    domain_id: str,
    body: DomainPatch,
    ctx: dict = Depends(require_permission(P_TENANT_SETTINGS)),
):
    client = db()
    r = client.table("tenant_domains").select("*") \
        .eq("id", domain_id).eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", None) \
        .limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Domain not found")
    row = r.data[0]
    update = {}
    if body.is_primary is True:
        # Clear primary on siblings first
        client.table("tenant_domains").update({"is_primary": False}) \
            .eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", None).execute()
        update["is_primary"] = True
    elif body.is_primary is False:
        update["is_primary"] = False
    if not update:
        return _row_to_out(row)
    client.table("tenant_domains").update(update).eq("id", domain_id).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "domain.updated",
              resource_type="domain", resource_id=domain_id,
              metadata=update)
    fresh = client.table("tenant_domains").select("*").eq("id", domain_id).limit(1).execute()
    return _row_to_out(fresh.data[0])


@router.delete("/{domain_id}")
def delete_domain(
    domain_id: str,
    ctx: dict = Depends(require_permission(P_TENANT_SETTINGS)),
):
    client = db()
    r = client.table("tenant_domains").select("id, hostname, is_primary") \
        .eq("id", domain_id).eq("tenant_id", ctx["tenant_id"]).is_("deleted_at", None) \
        .limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Domain not found")
    row = r.data[0]
    # Soft delete
    client.table("tenant_domains").update({"deleted_at": _now()}).eq("id", domain_id).execute()
    audit_log(ctx["tenant_id"], ctx["profile_id"], "domain.deleted",
              resource_type="domain", resource_id=domain_id,
              metadata={"hostname": row["hostname"]})
    return {"deleted": True, "id": domain_id}
