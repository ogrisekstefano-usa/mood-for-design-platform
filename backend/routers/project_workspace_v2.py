"""Phase P0.6.B — Project Workspace Deep Integrations.

Project-scoped enrichment endpoints. Pulls existing entities into the
project shell with hydration + clustering + human-language labels.

Strictly aligned to the real Supabase schema (mig. 021 / 024 / 026):
  · moodboard_candidates(title, description, image_url, reference_type,
                         source_article_id, source_hotspot_id, advisor_note, status)
  · article_hotspots(x_pct, y_pct, reference_type, locale_content,
                     linked_material_id, linked_asset_id, linked_article_id)
  · magazine_articles(slug, cover_url, locale_content, tags, category_slug)
  · material_registry(name, category, finish, dominant_color, tags, metadata_json,
                      primary_asset_id, supplier, status)
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from core.tenant_context import get_tenant_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["project-workspace-v2"])


# ─── Helpers ─────────────────────────────────────────────────────────────

def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _localized(loc: Optional[Dict[str, Any]], field: str, fallback: str = "") -> str:
    """Pick a localized field from a JSONB `locale_content` dict.
    Prefers `it`, then `en`, then any first available locale."""
    if not isinstance(loc, dict):
        return fallback
    for k in ("it", "en"):
        if loc.get(k) and isinstance(loc[k], dict) and loc[k].get(field):
            return loc[k][field]
    for v in loc.values():
        if isinstance(v, dict) and v.get(field):
            return v[field]
    return fallback


def _get_project(c, pid: str, tid: str) -> Dict[str, Any]:
    r = (c.table("projects").select("*").eq("id", pid).eq("tenant_id", tid)
         .limit(1).execute())
    if not r.data:
        raise HTTPException(404, "project not found")
    return r.data[0]


def _project_client_id(project: Dict[str, Any]) -> Optional[str]:
    meta = project.get("metadata_json") or {}
    return (
        meta.get("client_user_id")
        or meta.get("client_profile_id")
        or project.get("client_user_id")
    )


# ═══════════════════════════════════════════════════════════════════════
# 1. INSPIRATIONS TAB — moodboard_candidates hydrated + clustered
# ═══════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/inspirations")
def list_project_inspirations(project_id: str, ctx=Depends(get_tenant_context)):
    """Saved design references for this project — hydrated with the
    originating editorial article + hotspot context + clustered by reference type.
    """
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])

    cands = (c.table("moodboard_candidates").select(
        "id, source_type, source_id, source_article_id, source_hotspot_id, "
        "title, description, image_url, reference_type, "
        "status, advisor_note, assignee_user_id, created_at"
    ).eq("tenant_id", ctx["tenant_id"]).eq("project_id", project_id)
       .order("created_at", desc=True).limit(80).execute().data or [])

    article_ids = list({cc.get("source_article_id") for cc in cands if cc.get("source_article_id")})
    articles_by_id: Dict[str, Dict[str, Any]] = {}
    if article_ids:
        try:
            ar = (c.table("magazine_articles").select(
                "id, slug, cover_url, hero_url, locale_content, category_slug, tags"
            ).in_("id", article_ids).execute().data or [])
            articles_by_id = {a["id"]: a for a in ar}
        except Exception as e:
            logger.warning(f"inspirations: article hydration failed: {e}")

    hotspot_ids = list({cc.get("source_hotspot_id") for cc in cands if cc.get("source_hotspot_id")})
    hotspots_by_id: Dict[str, Dict[str, Any]] = {}
    if hotspot_ids:
        try:
            hr = (c.table("article_hotspots").select(
                "id, x_pct, y_pct, reference_type, locale_content, "
                "linked_material_id, linked_asset_id"
            ).in_("id", hotspot_ids).execute().data or [])
            hotspots_by_id = {h["id"]: h for h in hr}
        except Exception as e:
            logger.warning(f"inspirations: hotspot hydration failed: {e}")

    items: List[Dict[str, Any]] = []
    for cc in cands:
        art = articles_by_id.get(cc.get("source_article_id")) or {}
        hs = hotspots_by_id.get(cc.get("source_hotspot_id")) or {}

        # Atmosphere / clustering tags: reference_type from candidate or hotspot,
        # plus article tags for richer context
        ref_type = (hs.get("reference_type") or cc.get("reference_type") or "atmosphere")
        cluster_tags = [ref_type] + [t for t in (art.get("tags") or []) if t][:2]
        cluster_tags = [t for t in cluster_tags if t]

        items.append({
            "id":             cc["id"],
            "saved_at":       cc.get("created_at"),
            "status":         cc.get("status") or "saved",
            "advisor_note":   cc.get("advisor_note"),
            "source_type":    cc.get("source_type") or "magazine_hotspot",
            "label":          _localized(hs.get("locale_content"), "label",
                                         cc.get("title") or "Riferimento"),
            "description":    _localized(hs.get("locale_content"), "description",
                                         cc.get("description") or ""),
            "image_url":      cc.get("image_url") or art.get("hero_url") or art.get("cover_url"),
            "reference_type": ref_type,
            "atmosphere_tags": cluster_tags,
            "article": {
                "id":         art.get("id"),
                "slug":       art.get("slug"),
                "title":      _localized(art.get("locale_content"), "title", "Articolo"),
                "cover_url":  art.get("cover_url"),
                "category":   art.get("category_slug"),
            } if art else None,
            "hotspot_position": (
                {"x": float(hs["x_pct"]), "y": float(hs["y_pct"])}
                if hs.get("x_pct") is not None and hs.get("y_pct") is not None
                else None
            ),
        })

    # Clustering by reference_type (atmosphere | material | fabric | lighting | …)
    clusters: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        key = it["reference_type"] or "atmosphere"
        clusters.setdefault(key, []).append(it)
    cluster_label_map = {
        "atmosphere":    "Atmosfera",
        "material":      "Materia",
        "fabric":        "Tessuto",
        "lighting":      "Luce",
        "furniture":     "Arredo",
        "finish":        "Finitura",
        "color_palette": "Palette",
        "product":       "Prodotto",
        "custom":        "Riferimento",
    }
    clusters_out = [
        {
            "key":   k,
            "label": cluster_label_map.get(k, k.capitalize()),
            "count": len(v),
            "items": v,
        }
        for k, v in sorted(clusters.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    ]

    return {
        "items":         items,
        "clusters":      clusters_out,
        "total":         len(items),
        "project_title": project.get("title"),
    }


# ═══════════════════════════════════════════════════════════════════════
# 2. TIMELINE TAB — unified human-language project memory
# ═══════════════════════════════════════════════════════════════════════

_EVENT_LABEL_IT = {
    "project.created":              "Progetto creato",
    "project.created_from_lead":    "Progetto avviato da lead qualificato",
    "project.updated":              "Aggiornamento progetto",
    "moodboard.created":            "Nuovo moodboard creato",
    "moodboard.published":          "Moodboard pubblicato",
    "moodboard.block.added":        "Blocco aggiunto al moodboard",
    "moodboard.block.updated":      "Moodboard aggiornato",
    "proposal.created":             "Proposta redatta",
    "proposal.sent":                "Proposta inviata al cliente",
    "proposal.signed":              "Proposta firmata",
    "lead.qualified":               "Lead qualificato",
    "lead.assigned":                "Lead affidato a advisor",
    "inspiration.saved":            "Ispirazione salvata",
    "candidate.added_to_moodboard": "Riferimento integrato nel moodboard",
    "candidate.dismissed":          "Riferimento archiviato",
    "ai_brief.generated":           "AI Studio Brief™ generato",
    "task.created":                 "Nuovo task creato",
    "task.completed":               "Task completato",
    "note.added":                   "Nota aggiunta",
    "message.client_sent":          "Messaggio dal cliente",
    "message.advisor_sent":         "Messaggio dall'advisor",
}


def _humanize(event_type: str, label: Optional[str]) -> str:
    base = _EVENT_LABEL_IT.get(event_type)
    if base:
        return f"{base} · {label}" if label else base
    return label or event_type.replace(".", " ").replace("_", " ").capitalize()


@router.get("/{project_id}/timeline")
def project_timeline(project_id: str,
                     limit: int = Query(100, le=300),
                     ctx=Depends(get_tenant_context)):
    """Unified, human-language timeline merging:
    project_activity + moodboard_candidates + project_ai_briefs + client_messages.
    """
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    tid = ctx["tenant_id"]
    events: List[Dict[str, Any]] = []

    # 1. project_activity (canonical source)
    try:
        rows = (c.table("project_activity").select(
            "id, event_type, label, ref_id, payload, actor_id, created_at"
        ).eq("project_id", project_id).eq("tenant_id", tid)
           .order("created_at", desc=True).limit(limit).execute().data or [])
        for r in rows:
            events.append({
                "id":       f"act-{r['id']}",
                "kind":     "activity",
                "event":    r.get("event_type"),
                "title":    _humanize(r.get("event_type") or "", r.get("label")),
                "ref_id":   r.get("ref_id"),
                "actor_id": r.get("actor_id"),
                "at":       r.get("created_at"),
            })
    except Exception as e:
        logger.warning(f"timeline activity: {e}")

    # 2. Inspirations saved on this project
    try:
        cands = (c.table("moodboard_candidates").select(
            "id, title, description, status, created_at"
        ).eq("project_id", project_id).eq("tenant_id", tid)
           .order("created_at", desc=True).limit(40).execute().data or [])
        for cc in cands:
            label = cc.get("title") or "Riferimento dal Magazine"
            events.append({
                "id":     f"cand-{cc['id']}",
                "kind":   "inspiration",
                "event":  "inspiration.saved",
                "title":  _humanize("inspiration.saved", label),
                "ref_id": cc["id"],
                "at":     cc.get("created_at"),
            })
    except Exception as e:
        logger.warning(f"timeline candidates: {e}")

    # 3. AI Brief snapshots
    try:
        briefs = (c.table("project_ai_briefs").select(
            "id, market, model, created_at, sections"
        ).eq("project_id", project_id).eq("tenant_id", tid)
           .order("created_at", desc=True).limit(10).execute().data or [])
        for b in briefs:
            headline = (b.get("sections") or {}).get("headline") or "Memo strategico"
            events.append({
                "id":     f"brief-{b['id']}",
                "kind":   "ai_brief",
                "event":  "ai_brief.generated",
                "title":  _humanize("ai_brief.generated", f"{headline} · mercato {b.get('market') or 'IT'}"),
                "ref_id": b["id"],
                "at":     b.get("created_at"),
            })
    except Exception as e:
        logger.warning(f"timeline briefs: {e}")

    # 4. Client messages on this project
    client_id = _project_client_id(project)
    try:
        q = (c.table("client_messages").select(
            "id, message_type, sender_user_id, created_at, message_body, project_id"
        ).eq("tenant_id", tid))
        if client_id:
            q = q.or_(f"project_id.eq.{project_id},client_user_id.eq.{client_id}")
        else:
            q = q.eq("project_id", project_id)
        msgs = q.order("created_at", desc=True).limit(40).execute().data or []
        for m in msgs:
            ev = ("message.client_sent" if m.get("message_type") == "client_message"
                  else "message.advisor_sent")
            preview = (m.get("message_body") or "")[:90].strip()
            if len(m.get("message_body") or "") > 90:
                preview += "…"
            events.append({
                "id":     f"msg-{m['id']}",
                "kind":   "message",
                "event":  ev,
                "title":  _humanize(ev, preview or None),
                "ref_id": m["id"],
                "at":     m.get("created_at"),
            })
    except Exception as e:
        logger.warning(f"timeline messages: {e}")

    events.sort(key=lambda x: x.get("at") or "", reverse=True)
    return {"events": events[:limit], "total": len(events)}


# ═══════════════════════════════════════════════════════════════════════
# 3. MATERIALS TAB — registry filtered via metadata_json.linked_project_ids
# ═══════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/materials")
def list_project_materials(project_id: str, ctx=Depends(get_tenant_context)):
    """Materials linked to this project via metadata_json.linked_project_ids
    (soft link convention — kept in JSON to avoid altering the global registry
    schema until materials-project linkage gets first-class treatment).
    """
    c = db()
    _get_project(c, project_id, ctx["tenant_id"])
    rows: List[Dict[str, Any]] = []
    try:
        # All active materials for the tenant — filter project linkage in app code
        # (metadata_json containment requires PostgREST `cs.` filter; safer
        #  to filter post-fetch given low cardinality at MVP scale).
        all_rows = (c.table("material_registry").select(
            "id, slug, name, category, subcategory, finish, supplier, dominant_color, "
            "tags, primary_asset_id, status, metadata_json, created_at"
        ).eq("tenant_id", ctx["tenant_id"]).eq("status", "active")
           .order("created_at", desc=True).limit(500).execute().data or [])
        for r in all_rows:
            meta = r.get("metadata_json") or {}
            linked = meta.get("linked_project_ids") or []
            if project_id in linked:
                rows.append(r)
    except Exception as e:
        logger.warning(f"materials list error: {e}")
        rows = []

    # Hydrate primary asset urls in one round-trip
    asset_ids = list({r.get("primary_asset_id") for r in rows if r.get("primary_asset_id")})
    asset_url_by_id: Dict[str, Optional[str]] = {}
    if asset_ids:
        try:
            assets = (c.table("media_library").select("id, public_url, thumbnail_url")
                     .in_("id", asset_ids).execute().data or [])
            for a in assets:
                asset_url_by_id[a["id"]] = a.get("public_url") or a.get("thumbnail_url")
        except Exception as e:
            logger.warning(f"materials asset hydration: {e}")

    items = []
    for r in rows:
        meta = r.get("metadata_json") or {}
        items.append({
            "id":               r["id"],
            "slug":             r.get("slug"),
            "name":             r.get("name"),
            "category":         r.get("category"),
            "subcategory":      r.get("subcategory"),
            "finish":           r.get("finish"),
            "supplier":         r.get("supplier"),
            "status":           r.get("status") or "active",
            "cover_url":        asset_url_by_id.get(r.get("primary_asset_id")),
            "dominant_color":   r.get("dominant_color"),
            "tags":             r.get("tags") or [],
            "tactile_descriptors": meta.get("tactile_descriptors") or [],
            "atmosphere_tags":  meta.get("atmosphere_tags") or [],
            "related_articles_count":  len(meta.get("linked_article_ids") or []),
            "related_moodboards_count": len(meta.get("linked_moodboard_ids") or []),
            "created_at":       r.get("created_at"),
        })
    return {"items": items, "total": len(items)}


# ═══════════════════════════════════════════════════════════════════════
# 4. PROPOSALS TAB — proposals hydrated with project continuity context
# ═══════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/proposals")
def list_project_proposals(project_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    rows = (c.table("proposals").select("*")
            .eq("tenant_id", ctx["tenant_id"]).eq("project_id", project_id)
            .order("created_at", desc=True).limit(50).execute().data or [])

    try:
        mb_count = len((c.table("moodboards").select("id")
                       .eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"])
                       .execute().data or []))
    except Exception:
        mb_count = 0
    try:
        insp_count = len((c.table("moodboard_candidates").select("id")
                         .eq("project_id", project_id).eq("tenant_id", ctx["tenant_id"])
                         .execute().data or []))
    except Exception:
        insp_count = 0

    items = []
    for r in rows:
        meta = r.get("metadata_json") or {}
        items.append({
            "id":            r["id"],
            "title":         r.get("title"),
            "status":        r.get("status") or "draft",
            "total_value":   r.get("total_value"),
            "currency":      r.get("currency") or "EUR",
            "created_at":    r.get("created_at"),
            "updated_at":    r.get("updated_at"),
            "client_status": meta.get("client_status"),
            "summary":       r.get("summary") or meta.get("summary"),
            "moodboards_referenced": meta.get("moodboards_referenced") or [],
            "materials_referenced":  meta.get("materials_referenced") or [],
        })

    return {
        "items": items,
        "continuity": {
            "moodboards_in_project":    mb_count,
            "inspirations_in_project":  insp_count,
            "project_title":            project.get("title"),
        },
    }


# ═══════════════════════════════════════════════════════════════════════
# 5. CONVERSATIONS TAB — project-scoped messages (contextual feed)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/{project_id}/conversations")
def project_conversations(project_id: str, ctx=Depends(get_tenant_context)):
    c = db()
    project = _get_project(c, project_id, ctx["tenant_id"])
    tid = ctx["tenant_id"]
    client_id = _project_client_id(project)
    advisor_id = project.get("assigned_to") or project.get("assigned_designer_id")

    msgs: List[Dict[str, Any]] = []
    try:
        q = (c.table("client_messages").select(
            "id, message_type, visibility, sender_user_id, recipient_user_id, "
            "client_user_id, message_body, created_at, project_id, status"
        ).eq("tenant_id", tid))
        if client_id:
            q = q.or_(f"project_id.eq.{project_id},client_user_id.eq.{client_id}")
        else:
            q = q.eq("project_id", project_id)
        msgs = q.order("created_at").limit(200).execute().data or []
    except Exception as e:
        logger.warning(f"conversations error: {e}")

    participant_ids = {p for p in [client_id, advisor_id] if p}
    for m in msgs:
        for k in ("sender_user_id", "recipient_user_id"):
            if m.get(k):
                participant_ids.add(m[k])

    profiles_by_id: Dict[str, Dict[str, Any]] = {}
    if participant_ids:
        try:
            pr = (c.table("users_profile").select(
                "id, first_name, last_name, avatar_url, role"
            ).in_("id", list(participant_ids)).eq("tenant_id", tid).execute().data or [])
            profiles_by_id = {p["id"]: p for p in pr}
        except Exception as e:
            logger.warning(f"conversations profile hydration: {e}")

    def _person(uid: Optional[str]) -> Optional[Dict[str, Any]]:
        if not uid or uid not in profiles_by_id:
            return None
        p = profiles_by_id[uid]
        return {
            "id":         p["id"],
            "name":       f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip() or "—",
            "avatar_url": p.get("avatar_url"),
            "role":       p.get("role"),
        }

    out_msgs = []
    for m in msgs:
        out_msgs.append({
            "id":         m["id"],
            "body":       m.get("message_body"),
            "type":       m.get("message_type") or "message",
            "visibility": m.get("visibility") or "client_visible",
            "at":         m.get("created_at"),
            "from":       _person(m.get("sender_user_id")),
            "to":         _person(m.get("recipient_user_id")),
        })

    return {
        "messages":     out_msgs,
        "participants": {
            "client":  _person(client_id),
            "advisor": _person(advisor_id),
        },
        "total":        len(out_msgs),
        "project_id":   project_id,
    }
