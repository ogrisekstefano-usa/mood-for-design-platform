"""
Advisor Network — Partner Advisory System.
... (docstring continues — paths shown WITHOUT the leading /api/ because
this router is mounted under api_router which already has prefix="/api")
"""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import calendar
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from middleware.auth import get_current_user

router = APIRouter(prefix="/advisor", tags=["advisor-network"])


# ── Helpers ─────────────────────────────────────────────────────────────
def _is_superadmin(user: Dict[str, Any]) -> bool:
    return (user.get("role") or "") in ("super_admin", "platform_admin")


def _require_advisor(user: Dict[str, Any]) -> Dict[str, Any]:
    """Return the advisor_profile row for the current user, or 403."""
    if not user:
        raise HTTPException(401, "auth required")
    if _is_superadmin(user):
        # SuperAdmin can impersonate via ?advisor_code; not implemented now.
        raise HTTPException(403, "advisor-only endpoint")
    c = db()
    r = c.table("advisor_profiles").select("*").eq("user_id", user["id"]).limit(1).execute()
    if not r.data:
        raise HTTPException(403, "not an advisor")
    return r.data[0]


def _require_superadmin(user: Dict[str, Any]) -> None:
    if not _is_superadmin(user):
        raise HTTPException(403, "superadmin only")


def _gen_code(prefix: str = "ADV") -> str:
    return f"{prefix}-{secrets.token_hex(3).upper()}"


def _health_label(activity_rate: Optional[float], last_activity_at: Optional[str]) -> str:
    """Editorial health labels — never raw percentages on the UI."""
    if activity_rate is None:
        return "pending"
    if activity_rate >= 0.40:                                    return "healthy"
    if activity_rate >= 0.25:                                    return "stable"
    if activity_rate >= 0.10:                                    return "needs_support"
    if activity_rate > 0:                                        return "at_risk"
    return "dormant"


def _safe_referral_view(row: Dict[str, Any]) -> Dict[str, Any]:
    """Return ONLY non-sensitive tenant info for advisor-facing views."""
    t = row.get("tenants") or row.get("tenant") or {}
    return {
        "id":                    row["id"],
        "tenant_id":             row["tenant_id"],
        "tenant_name":           t.get("name") or row.get("tenant_name"),
        "tenant_city":           t.get("city"),
        "tenant_country":        t.get("country"),
        "referral_code":         row.get("referral_code"),
        "signup_date":           row.get("signup_date"),
        "activation_date":       row.get("activation_date"),
        "subscription_status":   row.get("subscription_status"),
        "discount_applied":      row.get("discount_applied"),
        "commission_percentage": row.get("commission_percentage"),
        "current_health_status": row.get("current_health_status"),
        "last_activity_date":    row.get("last_activity_date"),
        "current_period_start":  row.get("current_period_start"),
        "current_period_end":    row.get("current_period_end"),
        "commission_eligible":   row.get("commission_eligible"),
    }


# ── Pydantic ────────────────────────────────────────────────────────────
class AdvisorCreate(BaseModel):
    user_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    territory: Optional[str] = None
    commission_percentage: float = 15.0
    default_discount_percentage: float = 0.0


class AdvisorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    territory: Optional[str] = None
    status: Optional[str] = None
    commission_percentage: Optional[float] = None
    default_discount_percentage: Optional[float] = None
    payout_cycle_months: Optional[int] = None
    minimum_qualified_months: Optional[int] = None


class ReportCreate(BaseModel):
    tenant_id: Optional[str] = None
    report_type: str = Field(..., pattern=r"^(visit|call|onboarding|training|support|feedback|issue|follow_up)$")
    date: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    adoption_blockers: Optional[str] = None
    support_needed: Optional[str] = None
    outcome: Optional[str] = None
    next_step: Optional[str] = None
    follow_up_date: Optional[str] = None
    attendees: Optional[str] = None


class NoteCreate(BaseModel):
    tenant_id: Optional[str] = None
    note: str
    visibility: str = "advisor_only"


class CommissionAction(BaseModel):
    status: str  # approved | paid
    revenue_base: Optional[float] = None


class ReferralClaim(BaseModel):
    tenant_id: str
    referral_code: str


# ════════════════════════════════════════════════════════════════════════
# ADVISOR · self-service
# ════════════════════════════════════════════════════════════════════════
@router.get("/me")
def get_my_profile(user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    c = db()
    refs = c.table("advisor_referrals").select("*").eq("advisor_id", adv["id"]).execute().data or []
    # Health breakdown for the overview card.
    counts = {"healthy": 0, "stable": 0, "needs_support": 0, "at_risk": 0, "dormant": 0, "pending": 0}
    for r in refs: counts[r.get("current_health_status") or "pending"] = counts.get(r.get("current_health_status") or "pending", 0) + 1
    base_origin = "https://content-hub-pro-22.preview.emergentagent.com"
    return {
        "advisor": adv,
        "magic_link": f"{base_origin}/auth/signup?ref={adv['advisor_code']}",
        "referrals_total": len(refs),
        "health_breakdown": counts,
    }


@router.get("/referrals")
def list_my_referrals(user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    c = db()
    # Join tenant safe fields
    refs = c.table("advisor_referrals").select("*, tenants(name)") \
        .eq("advisor_id", adv["id"]).order("created_at", desc=True).execute().data or []
    return {"referrals": [_safe_referral_view(r) for r in refs]}


@router.get("/referrals/{rid}")
def get_referral_detail(rid: str, user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    c = db()
    r = c.table("advisor_referrals").select("*, tenants(name)") \
        .eq("id", rid).eq("advisor_id", adv["id"]).limit(1).execute().data
    if not r:
        raise HTTPException(404, "referral not found")
    months = c.table("advisor_activity_months").select("*") \
        .eq("advisor_referral_id", rid).order("year", desc=True).order("month", desc=True) \
        .limit(12).execute().data or []
    reports = c.table("advisor_reports").select("*") \
        .eq("advisor_id", adv["id"]).eq("tenant_id", r[0]["tenant_id"]) \
        .order("date", desc=True).execute().data or []
    return {"referral": _safe_referral_view(r[0]), "months": months, "reports": reports}


@router.post("/reports")
def create_report(body: ReportCreate, user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    payload = body.dict()
    payload["advisor_id"] = adv["id"]
    if not payload.get("date"):
        payload["date"] = date.today().isoformat()
    c = db()
    r = c.table("advisor_reports").insert(payload).execute()
    return {"report": r.data[0]}


@router.get("/reports")
def list_my_reports(user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    c = db()
    rs = c.table("advisor_reports").select("*").eq("advisor_id", adv["id"]) \
        .order("date", desc=True).limit(200).execute().data or []
    return {"reports": rs}


@router.patch("/reports/{rid}")
def update_report(rid: str, body: ReportCreate, user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    c = db()
    existing = c.table("advisor_reports").select("id").eq("id", rid).eq("advisor_id", adv["id"]).limit(1).execute()
    if not existing.data: raise HTTPException(404, "report not found")
    upd = {k: v for k, v in body.dict().items() if v is not None}
    r = c.table("advisor_reports").update(upd).eq("id", rid).execute()
    return {"report": r.data[0] if r.data else None}


@router.post("/notes")
def create_note(body: NoteCreate, user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    payload = body.dict()
    payload["advisor_id"] = adv["id"]
    c = db()
    r = c.table("advisor_notes").insert(payload).execute()
    return {"note": r.data[0]}


@router.get("/notes")
def list_my_notes(user: Dict[str, Any] = Depends(get_current_user)):
    adv = _require_advisor(user)
    c = db()
    rs = c.table("advisor_notes").select("*").eq("advisor_id", adv["id"]) \
        .order("created_at", desc=True).limit(200).execute().data or []
    return {"notes": rs}


# ════════════════════════════════════════════════════════════════════════
# Public referral flow
# ════════════════════════════════════════════════════════════════════════
@router.get("/referral/{code}/preview")
def referral_preview(code: str):
    """Public landing — shows advisor name + active discount (no PII)."""
    c = db()
    r = c.table("advisor_profiles").select("advisor_code, name, territory, default_discount_percentage, status") \
        .eq("advisor_code", code).limit(1).execute().data
    if not r or r[0].get("status") != "active":
        raise HTTPException(404, "referral code not valid")
    return {
        "advisor_code": r[0]["advisor_code"],
        "advisor_name": r[0]["name"],
        "territory":    r[0].get("territory"),
        "discount":     float(r[0].get("default_discount_percentage") or 0),
    }


@router.post("/referral/claim")
def referral_claim(body: ReferralClaim, user: Dict[str, Any] = Depends(get_current_user)):
    """Attach a freshly-created tenant to an advisor code. Called from
    onboarding after the tenant is provisioned. Locks attribution
    permanently (UNIQUE constraint on tenant_id)."""
    c = db()
    adv = c.table("advisor_profiles").select("*").eq("advisor_code", body.referral_code).limit(1).execute().data
    if not adv: raise HTTPException(404, "advisor code not found")
    if adv[0].get("status") != "active": raise HTTPException(400, "advisor not active")
    # Reject duplicate attribution (UNIQUE constraint also guards at DB level)
    existing = c.table("advisor_referrals").select("id").eq("tenant_id", body.tenant_id).limit(1).execute().data
    if existing: raise HTTPException(409, "tenant already attributed")
    payload = {
        "advisor_id": adv[0]["id"],
        "tenant_id":  body.tenant_id,
        "referral_code": body.referral_code,
        "signup_date":   datetime.now(timezone.utc).isoformat(),
        "discount_applied":      float(adv[0].get("default_discount_percentage") or 0),
        "commission_percentage": float(adv[0].get("commission_percentage") or 0),
        "subscription_status":   "trial",
        "current_period_start":  datetime.now(timezone.utc).isoformat(),
        "current_period_end":    (datetime.now(timezone.utc) + timedelta(days=180)).isoformat(),
    }
    r = c.table("advisor_referrals").insert(payload).execute()
    return {"referral": r.data[0]}


# ════════════════════════════════════════════════════════════════════════
# SuperAdmin
# ════════════════════════════════════════════════════════════════════════
@router.get("/admin/overview")
def admin_overview(user: Dict[str, Any] = Depends(get_current_user)):
    _require_superadmin(user)
    c = db()
    advs = c.table("advisor_profiles").select("id, status").execute().data or []
    refs = c.table("advisor_referrals").select("id, current_health_status, commission_eligible").execute().data or []
    elig_periods = c.table("advisor_commission_periods").select("status, commission_amount").execute().data or []
    return {
        "advisors_total":          len(advs),
        "advisors_active":         len([a for a in advs if a.get("status") == "active"]),
        "referrals_total":         len(refs),
        "referrals_at_risk":       len([r for r in refs if r.get("current_health_status") in ("at_risk", "dormant", "needs_support")]),
        "referrals_eligible":      len([r for r in refs if r.get("commission_eligible")]),
        "pending_commissions":     len([p for p in elig_periods if p.get("status") == "eligible"]),
        "total_commission_estimate": float(sum((p.get("commission_amount") or 0) for p in elig_periods if p.get("status") in ("eligible", "approved"))),
    }


@router.get("/admin/advisors")
def admin_list_advisors(user: Dict[str, Any] = Depends(get_current_user)):
    _require_superadmin(user)
    c = db()
    advs = c.table("advisor_profiles").select("*").order("created_at", desc=True).execute().data or []
    # Attach referral counts
    for a in advs:
        r = c.table("advisor_referrals").select("id, current_health_status").eq("advisor_id", a["id"]).execute().data or []
        a["_referrals"] = len(r)
        a["_at_risk"]   = len([x for x in r if x.get("current_health_status") in ("at_risk", "dormant", "needs_support")])
    return {"advisors": advs}


@router.post("/admin/advisors")
def admin_create_advisor(body: AdvisorCreate, user: Dict[str, Any] = Depends(get_current_user)):
    _require_superadmin(user)
    c = db()
    code = _gen_code()
    payload = body.dict()
    payload["advisor_code"] = code
    r = c.table("advisor_profiles").insert(payload).execute()
    return {"advisor": r.data[0]}


@router.patch("/admin/advisors/{aid}")
def admin_update_advisor(aid: str, body: AdvisorUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    _require_superadmin(user)
    upd = {k: v for k, v in body.dict().items() if v is not None}
    if not upd: return {"advisor": None}
    c = db()
    r = c.table("advisor_profiles").update(upd).eq("id", aid).execute()
    return {"advisor": r.data[0] if r.data else None}


@router.get("/admin/advisors/{aid}")
def admin_advisor_detail(aid: str, user: Dict[str, Any] = Depends(get_current_user)):
    _require_superadmin(user)
    c = db()
    adv = c.table("advisor_profiles").select("*").eq("id", aid).limit(1).execute().data
    if not adv: raise HTTPException(404, "advisor not found")
    refs = c.table("advisor_referrals").select("*, tenants(name)") \
        .eq("advisor_id", aid).order("created_at", desc=True).execute().data or []
    periods = c.table("advisor_commission_periods").select("*").eq("advisor_id", aid) \
        .order("period_start", desc=True).execute().data or []
    reports = c.table("advisor_reports").select("*").eq("advisor_id", aid) \
        .order("date", desc=True).limit(50).execute().data or []
    return {
        "advisor":  adv[0],
        "referrals": [_safe_referral_view(r) for r in refs],
        "commission_periods": periods,
        "reports": reports,
    }


# ── Activity / Commission computation ──────────────────────────────────
@router.post("/admin/compute-month")
def admin_compute_month(year: Optional[int] = None,
                        month: Optional[int] = None,
                        user: Dict[str, Any] = Depends(get_current_user)):
    """Recompute monthly active days for every referral in the given month
    (default = current month)."""
    _require_superadmin(user)
    now = datetime.now(timezone.utc)
    y, m = year or now.year, month or now.month
    days_in_m = calendar.monthrange(y, m)[1]
    m_start = datetime(y, m, 1, tzinfo=timezone.utc)
    m_end   = datetime(y, m, days_in_m, 23, 59, 59, tzinfo=timezone.utc)

    c = db()
    refs = c.table("advisor_referrals").select("id, tenant_id").execute().data or []
    written = 0
    for ref in refs:
        # Count distinct event dates for the tenant in [m_start, m_end]
        evs = c.table("tenant_activity_events").select("created_at") \
            .eq("tenant_id", ref["tenant_id"]) \
            .gte("created_at", m_start.isoformat()) \
            .lte("created_at", m_end.isoformat()) \
            .execute().data or []
        active_days = len({(e["created_at"] or "")[:10] for e in evs})
        rate = active_days / days_in_m if days_in_m else 0.0
        qualifies = rate >= 0.25
        row = {
            "advisor_referral_id": ref["id"],
            "year":                y,
            "month":               m,
            "active_days":         active_days,
            "days_in_month":       days_in_m,
            "activity_rate":       round(rate, 4),
            "qualifies_activity_threshold": qualifies,
            "computed_at":         datetime.now(timezone.utc).isoformat(),
        }
        c.table("advisor_activity_months").upsert(row, on_conflict="advisor_referral_id,year,month").execute()
        # Update referral health snapshot
        c.table("advisor_referrals").update({
            "current_health_status": _health_label(rate, None),
            "last_activity_date":    m_end.isoformat() if evs else ref.get("last_activity_date"),
        }).eq("id", ref["id"]).execute()
        written += 1
    return {"computed": written, "year": y, "month": m, "days_in_month": days_in_m}


@router.post("/admin/compute-commission")
def admin_compute_commission(user: Dict[str, Any] = Depends(get_current_user)):
    """For each referral whose current_period_end ≤ now, compute commission."""
    _require_superadmin(user)
    c = db()
    refs = c.table("advisor_referrals").select("*").execute().data or []
    now = datetime.now(timezone.utc)
    out = []
    for ref in refs:
        end_iso = ref.get("current_period_end")
        if not end_iso: continue
        end_dt = datetime.fromisoformat(end_iso.replace("Z", "+00:00")) if isinstance(end_iso, str) else end_iso
        if end_dt > now: continue
        start_dt = datetime.fromisoformat((ref["current_period_start"] or "").replace("Z", "+00:00"))
        # Pull months in the window
        months = c.table("advisor_activity_months").select("*") \
            .eq("advisor_referral_id", ref["id"]).execute().data or []
        relevant = [m for m in months
                    if datetime(m["year"], m["month"], 1, tzinfo=timezone.utc) >= start_dt
                    and datetime(m["year"], m["month"], 1, tzinfo=timezone.utc) <= end_dt]
        qualified = sum(1 for m in relevant if m.get("qualifies_activity_threshold"))
        # Find threshold from advisor profile
        adv = c.table("advisor_profiles").select("minimum_qualified_months") \
            .eq("id", ref["advisor_id"]).limit(1).execute().data
        min_q = (adv[0].get("minimum_qualified_months") if adv else 6) or 6
        eligible = qualified >= min_q
        rev_base = 0.0  # subscription_amount source not yet wired
        commission_amount = rev_base * (float(ref.get("commission_percentage") or 0) / 100.0) if eligible else 0
        period_row = {
            "advisor_id":            ref["advisor_id"],
            "advisor_referral_id":   ref["id"],
            "period_start":          start_dt.date().isoformat(),
            "period_end":            end_dt.date().isoformat(),
            "months_qualified":      qualified,
            "months_total":          len(relevant),
            "revenue_base":          rev_base,
            "commission_percentage": ref.get("commission_percentage"),
            "commission_amount":     commission_amount,
            "status":                "eligible" if eligible else "not_eligible",
            "computed_at":           datetime.now(timezone.utc).isoformat(),
        }
        c.table("advisor_commission_periods").upsert(period_row, on_conflict="advisor_referral_id,period_start").execute()
        c.table("advisor_referrals").update({
            "commission_eligible": eligible,
            "current_period_start": end_dt.isoformat(),
            "current_period_end":   (end_dt + timedelta(days=180)).isoformat(),
        }).eq("id", ref["id"]).execute()
        out.append({"referral_id": ref["id"], "qualified": qualified, "min_required": min_q, "eligible": eligible})
    return {"processed": len(out), "details": out}


@router.patch("/admin/commissions/{cid}")
def admin_update_commission(cid: str, body: CommissionAction,
                            user: Dict[str, Any] = Depends(get_current_user)):
    _require_superadmin(user)
    if body.status not in ("approved", "paid", "not_eligible"):
        raise HTTPException(400, "invalid status")
    c = db()
    upd: Dict[str, Any] = {"status": body.status}
    now = datetime.now(timezone.utc).isoformat()
    if body.status == "approved":
        upd["approved_by"] = user["id"]
        upd["approved_at"] = now
    if body.status == "paid":
        upd["paid_at"] = now
    if body.revenue_base is not None:
        upd["revenue_base"] = body.revenue_base
    r = c.table("advisor_commission_periods").update(upd).eq("id", cid).execute()
    return {"commission_period": r.data[0] if r.data else None}


# ── Activity emission helper (called from other routers later) ─────────
def emit_tenant_activity(tenant_id: str, event_type: str, user_id: Optional[str] = None):
    """Fire-and-forget. Called by other modules to record meaningful events."""
    try:
        db().table("tenant_activity_events").insert({
            "tenant_id":  tenant_id,
            "user_id":    user_id,
            "event_type": event_type,
        }).execute()
    except Exception:
        pass
