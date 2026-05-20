"""Insights — dashboard KPI + activity feed + studio overview."""
from datetime import datetime, timedelta, timezone
from collections import Counter
from fastapi import APIRouter, Depends, Query
from middleware.auth import get_current_user
from core.tenant_context import get_tenant_context, require_permission
from core.permissions import P_INSIGHTS_READ
from database import db

router = APIRouter()


def _count(table, tenant_id, filters=None):
    try:
        client = db()
        q = client.table(table).select('id', count='exact').eq('tenant_id', tenant_id)
        for k, v in (filters or {}).items():
            q = q.eq(k, v)
        r = q.execute()
        return r.count or 0
    except Exception:
        return 0


def _safe_select(table: str, tenant_id: str, fields: str,
                 limit: int = 1000, since_iso: str = None):
    try:
        q = (db().table(table).select(fields)
             .eq('tenant_id', tenant_id))
        if since_iso:
            q = q.gte('created_at', since_iso)
        return q.limit(limit).execute().data or []
    except Exception:
        return []


@router.get("/dashboard")
def dashboard(current_user: dict = Depends(require_permission(P_INSIGHTS_READ))):
    tid = current_user['tenant_id']
    return {
        "leads": {
            "total": _count('leads', tid),
            "new": _count('leads', tid, {'status': 'new'}),
            "qualified": _count('leads', tid, {'status': 'qualified'}),
        },
        "projects": {
            "total": _count('projects', tid),
            "in_progress": _count('projects', tid, {'status': 'proposal_in_progress'}),
            "won": _count('projects', tid, {'status': 'won'}),
        },
        "proposals": {
            "total": _count('proposals', tid),
            "sent": _count('proposals', tid, {'status': 'sent'}),
            "approved": _count('proposals', tid, {'status': 'approved'}),
        },
        "moodboards": {
            "total": _count('moodboards', tid),
        },
    }


@router.get("/activity")
def recent_activity(limit: int = Query(15, le=50), current_user: dict = Depends(require_permission(P_INSIGHTS_READ))):
    client = db()
    tid = current_user['tenant_id']
    # Pull latest events from multiple sources, merge in-memory.
    leads = client.table('leads').select('id, first_name, last_name, email, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []
    projects = client.table('projects').select('id, title, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []
    proposals = client.table('proposals').select('id, title, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []
    moodboards = client.table('moodboards').select('id, title, status, created_at').eq('tenant_id', tid).order('created_at', desc=True).limit(limit).execute().data or []

    events = []
    for l in leads:
        name = (l.get('first_name') or '') + ' ' + (l.get('last_name') or '')
        events.append({"type": "lead", "id": l['id'], "title": name.strip() or l.get('email', ''),
                       "status": l.get('status'), "created_at": l['created_at'], "tone": "blue"})
    for p in projects:
        events.append({"type": "project", "id": p['id'], "title": p.get('title'),
                       "status": p.get('status'), "created_at": p['created_at'], "tone": "purple"})
    for p in proposals:
        events.append({"type": "proposal", "id": p['id'], "title": p.get('title'),
                       "status": p.get('status'), "created_at": p['created_at'], "tone": "gold"})
    for m in moodboards:
        events.append({"type": "moodboard", "id": m['id'], "title": m.get('title'),
                       "status": m.get('status'), "created_at": m['created_at'], "tone": "emerald"})

    events.sort(key=lambda e: e['created_at'] or '', reverse=True)
    return {"data": events[:limit]}


# ─── Studio Overview — cinematic KPI atlas ──────────────────────────
# Editorial Italian framing. Real DB data only. No hardcoded numbers.

@router.get("/studio-overview")
def studio_overview(
    current_user: dict = Depends(require_permission(P_INSIGHTS_READ)),
):
    """Studio-wide insights — real aggregates from MongoDB/Supabase.

    Returns:
      • headline counters (projects, moodboards, inspirations, journeys,
        milestones approved/in-progress, members, accounts)
      • timeline series (last 12 weeks: projects + moodboards + milestones)
      • milestone state distribution (10 phases × current statuses)
      • activity surface (last 30d): events per day
      • top tags / palettes / brands (curatorial signature)
      • most active members (by created records)
    """
    tid = current_user['tenant_id']
    now = datetime.now(timezone.utc)
    twelve_weeks_ago = now - timedelta(weeks=12)
    thirty_days_ago  = now - timedelta(days=30)

    # ── 1) Headline counters ──────────────────────────────────────
    headline = {
        "projects":           _count('projects',         tid),
        "projects_in_progress": _count('projects',       tid, {'status': 'proposal_in_progress'}),
        "projects_won":       _count('projects',         tid, {'status': 'won'}),
        "moodboards":         _count('moodboards',       tid),
        "inspirations":       _count('media_library',    tid),
        "accounts":           _count('crm_accounts',     tid),
        "leads":              _count('leads',            tid),
        "design_journeys":    _count('design_journeys',  tid),
        "milestones_approved": _count('journey_milestones', tid, {'status': 'approved'}),
        "milestones_in_progress": _count('journey_milestones', tid, {'status': 'in_progress'}),
        "members":            _count('tenant_memberships', tid),
    }

    # ── 2) Last 12 weeks timeline (projects + moodboards + milestones) ─
    twelve_iso = twelve_weeks_ago.isoformat()
    projects   = _safe_select('projects',  tid, 'id, created_at, status',
                              limit=1000, since_iso=twelve_iso)
    moodboards = _safe_select('moodboards', tid, 'id, created_at',
                              limit=2000, since_iso=twelve_iso)
    milestones = _safe_select('journey_milestones', tid,
                              'id, created_at, status',
                              limit=2000, since_iso=twelve_iso)

    def _week_label(d: datetime) -> str:
        iso = d.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"

    weeks = []
    for i in range(11, -1, -1):
        wk_start = now - timedelta(weeks=i)
        weeks.append(_week_label(wk_start))

    def _bin(rows):
        c = Counter()
        for r in rows:
            try:
                ts = (r.get('created_at') or '').split('+')[0].split('Z')[0]
                d = datetime.fromisoformat(ts.replace('T', ' ').split('.')[0])
                d = d.replace(tzinfo=timezone.utc)
            except Exception:
                continue
            c[_week_label(d)] += 1
        return [c.get(w, 0) for w in weeks]

    timeline = {
        "weeks":      weeks,
        "projects":   _bin(projects),
        "moodboards": _bin(moodboards),
        "milestones": _bin(milestones),
    }

    # ── 3) Milestone state distribution (current pulse) ──────────
    all_ms = _safe_select('journey_milestones', tid,
                          'id, milestone_type, status', limit=4000)
    by_type_status: dict = {}
    for m in all_ms:
        t = m.get('milestone_type') or 'unknown'
        s = m.get('status') or 'unknown'
        by_type_status.setdefault(t, Counter())[s] += 1

    milestone_pulse = []
    for t, counter in by_type_status.items():
        milestone_pulse.append({
            "milestone_type": t,
            "total":          sum(counter.values()),
            "by_status":      dict(counter),
        })
    milestone_pulse.sort(key=lambda x: x['total'], reverse=True)

    # ── 4) Activity surface — last 30d events per day ────────────
    j_events = _safe_select('journey_timeline_events', tid,
                            'id, event_type, created_at',
                            limit=2000, since_iso=thirty_days_ago.isoformat())
    days = [(now - timedelta(days=i)).strftime('%Y-%m-%d')
            for i in range(29, -1, -1)]
    day_counter: Counter = Counter()
    for ev in j_events:
        try:
            d = (ev.get('created_at') or '')[:10]
            if d in days:
                day_counter[d] += 1
        except Exception:
            pass
    activity_surface = {
        "days":   days,
        "events": [day_counter.get(d, 0) for d in days],
        "total":  sum(day_counter.values()),
    }

    # ── 5) Top inspirations tags / brands (curatorial signature) ──
    # Inspirations live in `media_library` for this tenant. Tags and
    # brand may live inside `cultural_reading` JSONB.
    insp = _safe_select('media_library', tid,
                        'id, cultural_reading', limit=1500)
    tag_counter:    Counter = Counter()
    brand_counter:  Counter = Counter()
    color_counter:  Counter = Counter()
    for r in insp:
        cr = r.get('cultural_reading') or {}
        if not isinstance(cr, dict):
            continue
        for tg in (cr.get('tags') or []):
            if tg:
                tag_counter[str(tg)] += 1
        for tg in (cr.get('keywords') or []):
            if tg:
                tag_counter[str(tg)] += 1
        b = cr.get('brand') or cr.get('source')
        if b:
            brand_counter[str(b)] += 1
        col = cr.get('color_family') or cr.get('dominant_color')
        if col:
            color_counter[str(col)] += 1

    signature = {
        "tags":    [{"label": k, "count": v} for k, v in tag_counter.most_common(10)],
        "brands":  [{"label": k, "count": v} for k, v in brand_counter.most_common(8)],
        "colors":  [{"label": k, "count": v} for k, v in color_counter.most_common(8)],
    }

    # ── 6) Most active members (by created records last 90d) ─────
    ninety = now - timedelta(days=90)
    ninety_iso = ninety.isoformat()
    p_recent = _safe_select('projects', tid, 'id, created_by',
                            limit=500, since_iso=ninety_iso)
    m_recent = _safe_select('moodboards', tid, 'id, created_by',
                            limit=1500, since_iso=ninety_iso)
    member_counter: Counter = Counter()
    for row in p_recent + m_recent:
        if row.get('created_by'):
            member_counter[row['created_by']] += 1

    # Resolve member names
    member_ids = list(member_counter.keys())[:10]
    members_meta = []
    if member_ids:
        try:
            rows = (db().table('users').select('id, full_name, email, avatar_url')
                    .in_('id', member_ids).limit(20).execute().data or [])
            for u in rows:
                members_meta.append({
                    "id":         u['id'],
                    "name":       u.get('full_name') or u.get('email') or 'Membro',
                    "avatar_url": u.get('avatar_url'),
                    "count":      member_counter.get(u['id'], 0),
                })
        except Exception:
            pass
    members_meta.sort(key=lambda x: x['count'], reverse=True)

    return {
        "headline":         headline,
        "timeline":         timeline,
        "milestone_pulse":  milestone_pulse,
        "activity_surface": activity_surface,
        "signature":        signature,
        "active_members":   members_meta[:5],
        "generated_at":     now.isoformat(),
    }
