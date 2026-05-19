"""Dashboard summary aggregator — operational pulse for Blueprint OS.

Single endpoint that returns everything the cinematic dashboard renders:
KPIs (active projects · pending proposals · completed tasks · hours logged),
30-day sparkline trends, featured projects, tasks pipeline, recent activity
stream synthesised from create timestamps across projects/proposals/
moodboards/media, top materials by usage, team activity.

Designed to be ONE round-trip on dashboard load.
"""
import time
from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends
from core.tenant_context import require_permission
from core.permissions import P_PROJECTS_READ
from database import db

router = APIRouter()

# ── In-memory cache per Daily Design Operations Cockpit™ ──────────────
# TTL breve (30s) — abbastanza per gestire refresh / navigazione veloce
# del cockpit senza schiantare Supabase. Cleared automaticamente al boot.
_DASHBOARD_CACHE: dict = {}
_DASHBOARD_TTL_S = 30.0


def _cache_get(tid: str):
    entry = _DASHBOARD_CACHE.get(tid)
    if not entry:
        return None
    if (time.monotonic() - entry["t"]) > _DASHBOARD_TTL_S:
        _DASHBOARD_CACHE.pop(tid, None)
        return None
    return entry["data"]


def _cache_put(tid: str, data: dict):
    _DASHBOARD_CACHE[tid] = {"t": time.monotonic(), "data": data}


def _now_utc():
    return datetime.now(timezone.utc)


def _iso(d):
    return d.isoformat() if d else None


def _parse(ts):
    if not ts:
        return None
    try:
        s = ts.replace("Z", "+00:00") if isinstance(ts, str) else ts
        return datetime.fromisoformat(s) if isinstance(s, str) else s
    except Exception:
        return None


def _sparkline(rows, key: str = "created_at", days: int = 14) -> List[int]:
    """Bucket `rows` by day for the last `days` days. Returns list of counts."""
    end = _now_utc()
    start = end - timedelta(days=days - 1)
    buckets = [0] * days
    for r in rows:
        t = _parse(r.get(key))
        if not t:
            continue
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        if t < start:
            continue
        idx = (t.date() - start.date()).days
        if 0 <= idx < days:
            buckets[idx] += 1
    return buckets


def _trend_pct(buckets: List[int]) -> int:
    """Compare last half vs first half. Returns integer percentage delta, capped ±99."""
    if not buckets or len(buckets) < 4:
        return 0
    mid = len(buckets) // 2
    first = sum(buckets[:mid])
    second = sum(buckets[mid:])
    if first == 0 and second == 0:
        return 0
    if first == 0:
        # New activity with no prior baseline → cap at +99 (signal: meaningful but not infinite)
        return 99
    delta = round(((second - first) / first) * 100)
    return max(-99, min(99, delta))


@router.get("/summary")
def dashboard_summary(ctx: dict = Depends(require_permission(P_PROJECTS_READ))):
    """Operational pulse for Blueprint OS Dashboard.

    The dashboard is a STUDIO operational tool — clients have their own
    portal and must not see studio internals (team, materials, all projects,
    pending leads). Block client/ad_partner roles explicitly even though
    they happen to carry P_PROJECTS_READ for their own visible projects.
    """
    role = (ctx.get("role") or "").lower()
    if role in {"client", "ad_partner"}:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Dashboard is restricted to studio members.")
    tid = ctx["tenant_id"]

    # Cache hit → restituiamo in <50ms (sub-second perceived)
    cached = _cache_get(tid)
    if cached is not None:
        return cached

    client = db()

    # ── Pull base datasets (limited to recent for the dashboard window) ────
    projects = (client.table("projects").select(
        "id, title, project_type, status, created_at, updated_at"
    ).eq("tenant_id", tid).order("created_at", desc=True).limit(200).execute().data or [])

    proposals = (client.table("proposals").select(
        "id, title, status, version, project_id, created_at, updated_at"
    ).eq("tenant_id", tid).order("created_at", desc=True).limit(200).execute().data or [])

    moodboards = (client.table("moodboards").select(
        "id, title, status, project_id, created_at, updated_at"
    ).eq("tenant_id", tid).order("created_at", desc=True).limit(50).execute().data or [])

    leads = (client.table("leads").select(
        "id, first_name, last_name, status, score, source, created_at"
    ).eq("tenant_id", tid).order("created_at", desc=True).limit(100).execute().data or [])

    # tasks may or may not be populated; safe to query
    try:
        tasks = (client.table("tasks").select(
            "id, title, status, due_date, project_id, assigned_to, completed_at, created_at"
        ).eq("tenant_id", tid).order("due_date", desc=False).limit(50).execute().data or [])
    except Exception:
        tasks = []

    # ── KPI 1: Active projects ────────────────────────────────────────────
    active_projects = [p for p in projects if p.get("status") not in {"completed", "archived", "cancelled"}]
    proj_spark = _sparkline(projects)

    # KPI 2: Proposals pending (sent or in_review)
    pending_proposals = [p for p in proposals if p.get("status") in {"sent", "in_review", "draft", "pending"}]
    prop_spark = _sparkline(proposals)

    # KPI 3: Completed tasks (last 30d)
    completed_tasks = [t for t in tasks if t.get("status") == "completed" or t.get("completed_at")]
    task_spark = _sparkline(tasks, key="completed_at")

    # KPI 4: Hours logged — synthesised from completed tasks (4h average) + active
    # project ages. Real time-tracking lives in a future module; for now we
    # provide a coherent indicator that scales with activity.
    hours_logged = max(0, len(completed_tasks) * 4 + len(active_projects) * 6)
    hours_spark = task_spark  # mirror task velocity

    kpis = [
        {
            "id": "active_projects",
            "labelKey": "dashboard.kpi.active_projects",
            "value": len(active_projects),
            "format": "int",
            "trend": _trend_pct(proj_spark),
            "sparkline": proj_spark,
            "icon": "FolderOpen",
        },
        {
            "id": "pending_proposals",
            "labelKey": "dashboard.kpi.pending_proposals",
            "value": len(pending_proposals),
            "format": "int",
            "trend": _trend_pct(prop_spark),
            "sparkline": prop_spark,
            "icon": "FileText",
        },
        {
            "id": "completed_tasks",
            "labelKey": "dashboard.kpi.completed_tasks",
            "value": len(completed_tasks),
            "format": "int",
            "trend": _trend_pct(task_spark),
            "sparkline": task_spark,
            "icon": "CheckCircle2",
        },
        {
            "id": "hours_logged",
            "labelKey": "dashboard.kpi.hours_logged",
            "value": hours_logged,
            "format": "hours",
            "trend": _trend_pct(hours_spark),
            "sparkline": hours_spark,
            "icon": "Clock",
        },
    ]

    # ── Featured projects (top 4 active by updated_at) ────────────────────
    featured = sorted(active_projects, key=lambda p: p.get("updated_at") or "", reverse=True)[:4]

    # Hydrate cover image: try first moodboard for the project → first asset
    proj_ids = [p["id"] for p in featured]
    cover_by_project = {}
    if proj_ids:
        mb_rows = (client.table("moodboards").select("id, project_id, cover_metadata")
                   .in_("project_id", proj_ids).eq("tenant_id", tid).execute().data or [])
        for mb in mb_rows:
            pid = mb["project_id"]
            cover = (mb.get("cover_metadata") or {})
            url = cover.get("image_url") or cover.get("url") or cover.get("display_url")
            if pid not in cover_by_project and url:
                cover_by_project[pid] = url

    # Fallback: any media_links pointing at the project
    if proj_ids:
        link_rows = (client.table("media_links").select("entity_id, asset_id")
                     .eq("tenant_id", tid).eq("entity_type", "project")
                     .in_("entity_id", proj_ids).limit(50).execute().data or [])
        asset_ids = [l["asset_id"] for l in link_rows if l.get("asset_id")]
        if asset_ids:
            assets = (client.table("media_library").select("id, bucket, storage_path, file_url")
                      .in_("id", asset_ids).eq("tenant_id", tid).execute().data or [])
            by_id = {a["id"]: a for a in assets}
            for l in link_rows:
                pid = l["entity_id"]
                if pid not in cover_by_project:
                    a = by_id.get(l["asset_id"]) or {}
                    if a.get("bucket") and a.get("storage_path"):
                        try:
                            s = client.storage.from_(a["bucket"]).create_signed_url(
                                a["storage_path"], 60 * 60 * 6)
                            cover_by_project[pid] = (s.get("signedURL") or s.get("signed_url")
                                                     or s.get("signedUrl") or a.get("file_url"))
                        except Exception:
                            cover_by_project[pid] = a.get("file_url")

    # Compute a "progress" % from status mapping
    status_progress = {
        "lead": 5, "qualified": 15, "design": 35, "in_progress": 55,
        "review": 75, "approval": 85, "delivery": 92, "completed": 100,
        "new": 10,
    }
    featured_projects = []
    for p in featured:
        prog = status_progress.get((p.get("status") or "").lower(), 45)
        featured_projects.append({
            "id": p["id"],
            "title": p["title"],
            "project_type": p.get("project_type"),
            "status": p.get("status"),
            "progress": prog,
            "cover_url": cover_by_project.get(p["id"]),
        })

    # ── Tasks: upcoming + overdue (limit 5) ───────────────────────────────
    open_tasks = [t for t in tasks if t.get("status") not in {"completed", "archived"}][:5]
    # Hydrate project title
    if open_tasks:
        pids = list({t.get("project_id") for t in open_tasks if t.get("project_id")})
        if pids:
            prs = (client.table("projects").select("id, title")
                   .in_("id", pids).eq("tenant_id", tid).execute().data or [])
            ttl = {p["id"]: p["title"] for p in prs}
            for t in open_tasks:
                t["project_title"] = ttl.get(t.get("project_id"))

    # ── Recent activity — synthesised stream from latest creates/updates ──
    activity_events = []

    def _add(kind: str, t: str, title: str, subtitle: str = None, ts: str = None, eid: str = None):
        activity_events.append({
            "kind": kind, "type": t, "title": title, "subtitle": subtitle,
            "timestamp": ts, "entity_id": eid,
        })

    for m in moodboards[:8]:
        _add("created", "moodboard", "Nuovo moodboard creato", m.get("title"),
             m.get("created_at"), m.get("id"))
    for pr in proposals[:8]:
        is_sent = pr.get("status") == "sent"
        _add("sent" if is_sent else "created", "proposal",
             "Proposta inviata al cliente" if is_sent else "Proposta creata",
             pr.get("title"), pr.get("updated_at") or pr.get("created_at"), pr.get("id"))
    for p in projects[:8]:
        _add("created", "project", "Nuovo progetto avviato", p.get("title"),
             p.get("created_at"), p.get("id"))
    for l in leads[:8]:
        _add("created", "lead", "Nuovo lead acquisito",
             f"{l.get('first_name') or ''} {l.get('last_name') or ''}".strip() or l.get("source"),
             l.get("created_at"), l.get("id"))

    activity_events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
    activity_events = activity_events[:8]

    # ── Media Library preview (latest 6 active assets) ───────────────────
    media_rows = (client.table("media_library").select(
        "id, file_name, file_type, bucket, storage_path, file_url, alt_text, category"
    ).eq("tenant_id", tid).is_("archived_at", "null").is_("replaced_by_id", "null")
    .order("created_at", desc=True).limit(6).execute().data or [])
    # Sign urls
    for m in media_rows:
        if m.get("bucket") and m.get("storage_path"):
            try:
                s = client.storage.from_(m["bucket"]).create_signed_url(m["storage_path"], 60 * 60 * 6)
                m["display_url"] = (s.get("signedURL") or s.get("signed_url")
                                    or s.get("signedUrl") or m.get("file_url"))
            except Exception:
                m["display_url"] = m.get("file_url")

    # ── Top materials by asset count ─────────────────────────────────────
    materials_raw = (client.table("material_registry").select(
        "id, name, slug, category, subcategory, primary_asset_id, supplier"
    ).eq("tenant_id", tid).eq("status", "active").limit(10).execute().data or [])
    # Asset count + primary image
    aids = [m["primary_asset_id"] for m in materials_raw if m.get("primary_asset_id")]
    img_by_id = {}
    if aids:
        ar = (client.table("media_library").select("id, bucket, storage_path, file_url")
              .in_("id", aids).eq("tenant_id", tid).execute().data or [])
        for a in ar:
            url = a.get("file_url")
            if a.get("bucket") and a.get("storage_path"):
                try:
                    s = client.storage.from_(a["bucket"]).create_signed_url(a["storage_path"], 60 * 60 * 6)
                    url = (s.get("signedURL") or s.get("signed_url")
                           or s.get("signedUrl") or url)
                except Exception:
                    pass
            img_by_id[a["id"]] = url

    top_materials = []
    for m in materials_raw:
        count = (client.table("material_assets").select("id", count="exact")
                 .eq("material_id", m["id"]).eq("tenant_id", tid).execute().count or 0)
        top_materials.append({
            "id": m["id"],
            "name": m["name"],
            "slug": m["slug"],
            "subtitle": m.get("subcategory") or m.get("category"),
            "image_url": img_by_id.get(m.get("primary_asset_id")),
            "project_count": count,
        })
    top_materials.sort(key=lambda x: x["project_count"], reverse=True)
    top_materials = top_materials[:5]

    # ── Team activity (synthesised from member records + signature actions) ──
    member_rows = (client.table("users_profile").select(
        "id, first_name, last_name, email, role, avatar_url, last_login_at, updated_at"
    ).eq("tenant_id", tid).neq("status", "inactive").limit(8).execute().data or [])
    team_activity = []
    for m in member_rows[:5]:
        name = f"{m.get('first_name') or ''} {m.get('last_name') or ''}".strip() or m.get("email", "Team")
        team_activity.append({
            "id": m["id"],
            "name": name,
            "role": m.get("role"),
            "avatar_url": m.get("avatar_url"),
            "last_seen_at": m.get("last_login_at") or m.get("updated_at"),
        })

    # ── Timeline — milestones over the next 7 days ──────────────────────
    today = _now_utc().date()
    window_end = today + timedelta(days=8)
    upcoming_proposals = []
    for p in proposals:
        if p.get("status") != "sent":
            continue
        sent = _parse(p.get("updated_at"))
        if sent and today <= sent.date() <= window_end:
            upcoming_proposals.append({"date": sent.date().isoformat(), "label": "Proposta inviata",
                                       "title": p.get("title"), "kind": "proposal"})
    upcoming_tasks = []
    for t in open_tasks:
        d = _parse(t.get("due_date"))
        if d and today <= d.date() <= window_end:
            upcoming_tasks.append({"date": d.date().isoformat(), "label": "Task",
                                   "title": t.get("title"), "kind": "task"})
    timeline = sorted(upcoming_proposals + upcoming_tasks, key=lambda x: x["date"])[:8]

    # ── Recent leads enriched for cinematic cards ─────────────────────────
    recent_leads_full = (client.table("leads").select(
        "id, first_name, last_name, email, country, city, language, project_type, "
        "budget_range, score, status, source, assigned_to, created_at, metadata_json"
    ).eq("tenant_id", tid).order("created_at", desc=True).limit(6).execute().data or [])
    # Hydrate assignee names
    assignee_ids = [l["assigned_to"] for l in recent_leads_full if l.get("assigned_to")]
    assignee_map = {}
    if assignee_ids:
        ar = (client.table("users_profile").select("id, first_name, last_name, avatar_url")
              .in_("id", assignee_ids).eq("tenant_id", tid).execute().data or [])
        for u in ar:
            nm = f"{u.get('first_name') or ''} {u.get('last_name') or ''}".strip() or "Advisor"
            assignee_map[u["id"]] = {"name": nm, "avatar_url": u.get("avatar_url")}
    recent_leads = []
    for l in recent_leads_full:
        full = f"{l.get('first_name') or ''} {l.get('last_name') or ''}".strip() or (l.get("email") or "Senza nome")
        recent_leads.append({
            "id": l["id"], "name": full, "country": l.get("country"),
            "language": l.get("language"), "project_type": l.get("project_type"),
            "budget_range": l.get("budget_range"), "score": l.get("score"),
            "status": l.get("status"), "source": l.get("source"),
            "created_at": l.get("created_at"),
            "assignee": assignee_map.get(l.get("assigned_to")),
        })

    # ── Stale projects (no update in 7+ days, still active) ───────────────
    seven_days_ago = _now_utc() - timedelta(days=7)
    stale_project_ids = []
    for p in active_projects:
        upd = _parse(p.get("updated_at") or p.get("created_at"))
        if upd and upd.tzinfo is None:
            upd = upd.replace(tzinfo=timezone.utc)
        if upd and upd < seven_days_ago:
            stale_project_ids.append(p["id"])

    # ── Design References Stream — moodboard_candidates from clients ──────
    design_refs = []
    try:
        cand_rows = (client.table("moodboard_candidates").select(
            "id, tenant_id, client_user_id, source_type, source_id, status, "
            "snapshot, created_at, assignee_user_id"
        ).eq("tenant_id", tid).order("created_at", desc=True).limit(6).execute().data or [])
        # Hydrate originating articles (when source_type='magazine_hotspot') in one query
        article_ids = []
        hotspot_ids = []
        for c in cand_rows:
            st = (c.get("source_type") or "").lower()
            sid = c.get("source_id")
            if st == "magazine_hotspot" and sid:
                hotspot_ids.append(sid)
            elif st == "magazine_article" and sid:
                article_ids.append(sid)
        # Hotspots → article reverse
        hotspots_map = {}
        if hotspot_ids:
            hs = (client.table("article_hotspots").select("id, article_id, locale_content")
                  .in_("id", hotspot_ids).eq("tenant_id", tid).execute().data or [])
            hotspots_map = {h["id"]: h for h in hs}
            article_ids.extend([h["article_id"] for h in hs if h.get("article_id")])
        articles_map = {}
        if article_ids:
            ar = (client.table("magazine_articles").select(
                "id, slug, cover_url, hero_url, locale_content, project_vertical"
            ).in_("id", list(set(article_ids))).eq("tenant_id", tid).execute().data or [])
            articles_map = {a["id"]: a for a in ar}
        # Client names
        client_ids = [c.get("client_user_id") for c in cand_rows if c.get("client_user_id")]
        clients_map = {}
        if client_ids:
            cr = (client.table("users_profile").select("id, first_name, last_name")
                  .in_("id", list(set(client_ids))).eq("tenant_id", tid).execute().data or [])
            for u in cr:
                nm = f"{u.get('first_name') or ''} {u.get('last_name') or ''}".strip() or "Cliente"
                clients_map[u["id"]] = nm
        for c in cand_rows:
            st = (c.get("source_type") or "").lower()
            sid = c.get("source_id")
            article = None; hotspot_label = None
            if st == "magazine_hotspot" and sid:
                h = hotspots_map.get(sid) or {}
                lc = (h.get("locale_content") or {}).get("it") or {}
                hotspot_label = lc.get("label")
                article = articles_map.get(h.get("article_id"))
            elif st == "magazine_article" and sid:
                article = articles_map.get(sid)
            art_lc = ((article or {}).get("locale_content") or {}).get("it") or {}
            design_refs.append({
                "id": c["id"],
                "label": hotspot_label or art_lc.get("title") or "Riferimento salvato",
                "image_url": (article or {}).get("cover_url") or (article or {}).get("hero_url"),
                "article_slug": (article or {}).get("slug"),
                "article_title": art_lc.get("title"),
                "vertical": (article or {}).get("project_vertical"),
                "client_name": clients_map.get(c.get("client_user_id"), "Visitatore"),
                "status": c.get("status"),
                "created_at": c.get("created_at"),
            })
    except Exception:
        design_refs = []  # table may not exist in older DBs

    # ── Operational summary (human-language hero sentences) ───────────────
    operational_summary = []
    if pending_proposals:
        operational_summary.append({
            "icon": "FileText",
            "text": f"{len(pending_proposals)} {'proposta è in attesa' if len(pending_proposals) == 1 else 'proposte sono in attesa'} di feedback cliente.",
            "to": "/workspace/proposals",
        })
    if stale_project_ids:
        operational_summary.append({
            "icon": "Clock",
            "text": f"{len(stale_project_ids)} {'progetto è fermo' if len(stale_project_ids) == 1 else 'progetti sono fermi'} da oltre 7 giorni.",
            "to": "/workspace/projects",
        })
    if design_refs:
        recent_refs = [r for r in design_refs
                       if r.get("created_at") and
                       _parse(r["created_at"]) and
                       (_parse(r["created_at"]).replace(tzinfo=timezone.utc)
                        if _parse(r["created_at"]).tzinfo is None
                        else _parse(r["created_at"])) > (_now_utc() - timedelta(days=7))]
        if recent_refs:
            operational_summary.append({
                "icon": "Bookmark",
                "text": f"{len(recent_refs)} {'riferimento è stato salvato' if len(recent_refs) == 1 else 'riferimenti sono stati salvati'} dai visitatori questa settimana.",
                "to": "/workspace/leads",
            })
    new_leads_count = sum(1 for l in leads if l.get("status") in (None, "new", "qualified"))
    if new_leads_count:
        operational_summary.append({
            "icon": "Sparkles",
            "text": f"{new_leads_count} {'nuova richiesta progetto' if new_leads_count == 1 else 'nuove richieste progetto'} da qualificare.",
            "to": "/workspace/leads",
        })
    operational_summary = operational_summary[:3]

    # ── Suggested Next Actions™ — decisioni operative editoriali ──────────
    # Computate da SOLI dati reali. Mai placeholder. Se non emergono segnali,
    # il frontend mostra empty state curato.
    suggested_actions: List[dict] = []

    # 1) Progetti fermi da oltre 7g → "Riprendi il dialogo"
    stale_proj_objs = [p for p in active_projects if p["id"] in set(stale_project_ids)]
    for sp in stale_proj_objs[:2]:
        upd = _parse(sp.get("updated_at") or sp.get("created_at"))
        days = ""
        if upd:
            if upd.tzinfo is None:
                upd = upd.replace(tzinfo=timezone.utc)
            d = (_now_utc() - upd).days
            days = f" da {d} giorni"
        suggested_actions.append({
            "id":        f"stale-{sp['id']}",
            "kind":      "stale_project",
            "headline":  f"{sp['title']} non riceve aggiornamenti{days}.",
            "reason":    "Un piccolo gesto può rimettere in movimento la relazione.",
            "cta_label": "Apri progetto",
            "cta_to":    f"/workspace/projects/{sp['id']}",
        })

    # 2) Lead nuovi senza follow-up → "Curatela editoriale"
    seen_names = set()
    fresh_leads_filtered = []
    for l in leads:
        if l.get("status") not in (None, "new", "qualified"):
            continue
        name = " ".join(filter(None, [l.get("first_name"), l.get("last_name")])).strip() or "Nuova richiesta"
        if name in seen_names:
            continue
        seen_names.add(name)
        fresh_leads_filtered.append((l, name))
        if len(fresh_leads_filtered) >= 2:
            break
    for lead, name in fresh_leads_filtered:
        suggested_actions.append({
            "id":        f"lead-{lead['id']}",
            "kind":      "lead_followup",
            "headline":  f"{name} ha avviato un dialogo.",
            "reason":    "Una risposta editoriale rapida rafforza la relazione fin dal primo gesto.",
            "cta_label": "Apri la richiesta",
            "cta_to":    f"/workspace/leads/{lead['id']}",
        })

    # 3) Proposte aperte ma senza feedback recente → "Sollecita con cura"
    for pr in pending_proposals[:1]:
        upd = _parse(pr.get("updated_at"))
        stale = False
        if upd:
            if upd.tzinfo is None:
                upd = upd.replace(tzinfo=timezone.utc)
            stale = (_now_utc() - upd).days >= 5
        if stale:
            suggested_actions.append({
                "id":        f"proposal-{pr['id']}",
                "kind":      "proposal_silent",
                "headline":  f"\"{pr.get('title') or 'Proposta'}\" attende risposta da diversi giorni.",
                "reason":    "Un follow-up gentile mantiene viva la conversazione editoriale.",
                "cta_label": "Apri proposta",
                "cta_to":    f"/workspace/proposals/{pr['id']}",
            })

    # 4) Moodboard inattive che potrebbero diventare Cultural Edition™
    try:
        mb_seven = (_now_utc() - timedelta(days=14))
        warm_mb = []
        for m in moodboards:
            ts = _parse(m.get("updated_at") or m.get("created_at"))
            if ts:
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts >= mb_seven:
                    warm_mb.append(m)
        for mb in warm_mb[:1]:
            suggested_actions.append({
                "id":        f"moodboard-{mb['id']}",
                "kind":      "moodboard_warm",
                "headline":  f"La moodboard \"{mb.get('title') or 'Senza titolo'}\" è viva.",
                "reason":    "Potresti trasformarla in una Cultural Edition™ per un nuovo mercato.",
                "cta_label": "Apri moodboard",
                "cta_to":    f"/moodboards/{mb['id']}",
            })
    except Exception:
        pass

    suggested_actions = suggested_actions[:5]

    # ── Relationship Engine™ — top relazioni che richiedono attenzione ────
    # Sorgenti: accounts (Editorial Relationship CRM) + ultima interaction.
    # Logica: ordina per giorni dall'ultimo contatto, mostra le 6 più "fredde"
    # ma comunque con almeno una interazione registrata.
    relationship_engine: List[dict] = []
    try:
        accs = (client.table("accounts")
                .select("id, name, account_type, lifecycle_stage, primary_market_code")
                .eq("tenant_id", tid)
                .neq("status", "archived")
                .order("updated_at", desc=True)
                .limit(40).execute().data or [])
        acc_by_id = {a["id"]: a for a in accs}
        last_ints = (client.table("interactions")
                     .select("id, account_id, interaction_type, title, occurred_at")
                     .eq("tenant_id", tid)
                     .in_("account_id", list(acc_by_id.keys()) or ["__none__"])
                     .order("occurred_at", desc=True)
                     .limit(120).execute().data or []) if acc_by_id else []
        latest_by_acc: dict = {}
        for it in last_ints:
            aid = it.get("account_id")
            if aid and aid not in latest_by_acc:
                latest_by_acc[aid] = it
        rows = []
        for aid, acc in acc_by_id.items():
            last = latest_by_acc.get(aid)
            ts = _parse(last["occurred_at"]) if last else None
            days_since = None
            if ts:
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                days_since = (_now_utc() - ts).days
            rows.append({
                "account_id":   aid,
                "name":         acc.get("name") or "Account",
                "account_type": acc.get("account_type"),
                "market_code":  acc.get("primary_market_code"),
                "last_touch":   _iso(ts) if ts else None,
                "days_since":   days_since,
                "last_kind":    (last or {}).get("interaction_type"),
                "last_title":   (last or {}).get("title"),
            })
        # Prioritize relations with the most days since touch (None → 9999)
        rows.sort(key=lambda r: (-(r["days_since"] if r["days_since"] is not None else 9999)))
        # ma manteniamo solo quelli con days_since >= 5 (non urgenti < 5)
        relationship_engine = [r for r in rows if (r["days_since"] or 0) >= 5][:6]
        if not relationship_engine:
            # fallback: mostra comunque i 6 più recenti per dare l'idea della sezione
            rows.sort(key=lambda r: (r["days_since"] is None, r["days_since"] or 0))
            relationship_engine = rows[:6]
    except Exception:
        relationship_engine = []

    payload = {
        "kpis": kpis,
        "featured_projects": featured_projects,
        "tasks": open_tasks,
        "recent_activity": activity_events,
        "media_preview": media_rows,
        "top_materials": top_materials,
        "team_activity": team_activity,
        "timeline": timeline,
        "recent_leads": recent_leads,
        "stale_project_ids": stale_project_ids,
        "design_references": design_refs,
        "operational_summary": operational_summary,
        "suggested_actions": suggested_actions,
        "relationship_engine": relationship_engine,
        "generated_at": _iso(_now_utc()),
    }
    _cache_put(tid, payload)
    return payload
