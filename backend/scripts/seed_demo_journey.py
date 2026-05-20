#!/usr/bin/env python3
"""
seed_demo_journey.py — Sprint G.7 supplement.

Crea (idempotente) un Design Journey™ realistico per `client@moodfordesign.com`:
**Villa Riviera** — restyle di una villa ligure a Sanremo, con FRIZIONI
autentiche, revisioni, materiali scartati e direzioni evolute.

NON è una "demo perfetta". È un percorso vivo: la prima moodboard è
troppo fredda, il cliente chiede più calore, una pietra grigia viene
scartata, una palette materica calda emerge in revisione, il living
attende un'alternativa con tessuti più morbidi.

Usage:
    cd /app/backend && python3 scripts/seed_demo_journey.py

Idempotente. Re-run sicuro — riconoscibile via `metadata_json.demo_seed_tag`.

Tabelle scritte (tutte ownership-scoped al tenant MOOD Demo Studio):
  · accounts                  — "Famiglia Bianchi · Villa Riviera"
  · projects                  — "Villa Riviera" (client_user_id = Marco Bianchi)
  · design_journeys           — root del percorso
  · journey_milestones        — 10 capitoli canonici con stati realistici
  · journey_timeline_events   — narrazione in 16 voci editoriali
  · moodboards                — 3 "capitoli" (V1 freddo / V2 materico / V3 alternativa)
  · milestone_versions        — version stack del Moodboard Direction™
  · milestone_feedback        — voci curatoriali (cliente + studio)
"""
from __future__ import annotations

import os
import sys
import uuid
import pathlib
from datetime import datetime, timezone, timedelta

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).resolve().parent.parent / ".env")
from supabase import create_client  # noqa: E402

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
c = create_client(SUPABASE_URL, SERVICE_KEY)

TENANT_SLUG    = "mood-demo-studio-81a09e"
CLIENT_EMAIL   = "client@moodfordesign.com"
DESIGNER_PROFILE_ID = "a0000001-c001-4001-8001-000000000001"  # Elizabeth Whitcomb (lead designer persona)

# Stable seed tag so we can recognise & update existing demo rows.
SEED_TAG = "villa_riviera_g7_demo"


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(d: datetime) -> str:
    return d.isoformat()


# ── Resolve tenant + client profile ──────────────────────────────
def get_tenant():
    r = c.table("tenants").select("id,name,slug").eq("slug", TENANT_SLUG).limit(1).execute()
    if not r.data:
        raise SystemExit(f"Tenant {TENANT_SLUG} not found.")
    return r.data[0]


def get_client_profile(tenant_id: str):
    r = c.table("users_profile").select("id,email,first_name,last_name") \
         .eq("tenant_id", tenant_id).eq("email", CLIENT_EMAIL).limit(1).execute()
    if not r.data:
        raise SystemExit(
            f"Client {CLIENT_EMAIL} not found on tenant. "
            f"Run seed_demo_users.py first.")
    return r.data[0]


# ── Idempotent UPSERT helpers ────────────────────────────────────
def find_account(tenant_id: str):
    r = (c.table("accounts").select("*")
         .eq("tenant_id", tenant_id)
         .eq("account_name", "Famiglia Bianchi · Villa Riviera")
         .limit(1).execute())
    return r.data[0] if r.data else None


def find_project(tenant_id: str, client_user_id: str):
    r = (c.table("projects").select("*")
         .eq("tenant_id", tenant_id)
         .eq("client_user_id", client_user_id)
         .eq("title", "Villa Riviera")
         .limit(1).execute())
    return r.data[0] if r.data else None


def find_journey(tenant_id: str, project_id: str):
    r = (c.table("design_journeys").select("*")
         .eq("tenant_id", tenant_id).eq("project_id", project_id)
         .limit(1).execute())
    return r.data[0] if r.data else None


# ── Account ──────────────────────────────────────────────────────
def ensure_account(tenant_id: str, client_id: str) -> dict:
    existing = find_account(tenant_id)
    if existing:
        print(f"  ✓ Account già presente: {existing['id']}")
        return existing
    row = {
        "id":              str(uuid.uuid4()),
        "tenant_id":       tenant_id,
        "account_name":    "Famiglia Bianchi · Villa Riviera",
        "account_type":    "household",
        "lifecycle_stage": "active",
        "source":          "referral",
        "country":         "Italia",
        "city":            "Sanremo",
        "language":        "it",
        "locale_code":     "it",
        "primary_owner_id": DESIGNER_PROFILE_ID,
        "relationship_health": "engaged",
        "notes":           "Coppia in pensione, già clienti di una boutique a Milano. Vogliono ridare carattere alla villa di famiglia, mantenendo l'anima ligure.",
        "design_intent_summary": "Atmosfera mediterranea contemporanea, materica e calda. Niente minimalismo freddo.",
        "metadata_json":   {"demo_seed_tag": SEED_TAG},
    }
    c.table("accounts").insert(row).execute()
    print(f"  + Account creato: {row['id']}")
    return row


# ── Project ──────────────────────────────────────────────────────
def ensure_project(tenant_id: str, client_id: str, account_id: str) -> dict:
    existing = find_project(tenant_id, client_id)
    started_at = now() - timedelta(weeks=8)
    if existing:
        print(f"  ✓ Project già presente: {existing['id']}")
        return existing
    row = {
        "id":            str(uuid.uuid4()),
        "tenant_id":     tenant_id,
        "client_user_id": client_id,
        "assigned_to":   DESIGNER_PROFILE_ID,
        "title":         "Villa Riviera",
        "description":   "Restyle integrale di una villa ligure a Sanremo. Living, cucina, due camere, due bagni. La famiglia vive nella villa due weekend al mese.",
        "project_type":  "Residenziale · restyle integrale",
        "status":        "in_review",
        "priority":      "high",
        "budget_range":  "180.000 – 230.000 €",
        "timeline":      "Cantiere previsto 6–8 mesi · sopralluogo Q3",
        "language":      "it",
        "locale_code":   "it",
        "metadata_json": {
            "location": "Sanremo, Liguria",
            "cover_url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
            "demo_seed_tag": SEED_TAG,
            "household_size": 2,
            "weekend_house": True,
        },
        "created_at":    iso(started_at),
        "updated_at":    iso(now() - timedelta(days=2)),
    }
    c.table("projects").insert(row).execute()
    print(f"  + Project creato: {row['id']}")
    return row


# ── Journey + milestones ─────────────────────────────────────────
CANONICAL_MS = [
    {"type": "brief",                "title": "Brief Cliente",
     "description": "La prima conversazione progettuale: obiettivi, atmosfera, ambienti.",
     "open_mode": "inline"},
    {"type": "inspirations",         "title": "Inspirations™",
     "description": "Linguaggio visuale di partenza: riferimenti, atmosfere, suggestioni.",
     "open_mode": "navigate", "linked_route": "/inspirations"},
    {"type": "moodboard_direction",  "title": "Moodboard Direction™",
     "description": "La direzione editoriale prende forma in una composizione narrativa.",
     "open_mode": "navigate", "linked_route": "/moodboards"},
    {"type": "material_direction",   "title": "Material Direction™",
     "description": "Il tavolo materico: pietre, legni, tessuti, palette tattile.",
     "open_mode": "navigate", "linked_route": "/inspirations/materials"},
    {"type": "concept_design",       "title": "Concept Design™",
     "description": "Render, tavole, layout: il progetto trova la sua spazialità.",
     "open_mode": "navigate", "linked_route": "/workspace/projects"},
    {"type": "technical_package",    "title": "Technical Package™",
     "description": "Tavole tecniche, schede, documenti — il progetto pronto per il cantiere.",
     "open_mode": "navigate", "linked_route": "/workspace/projects"},
    {"type": "curated_selections",   "title": "Curated Selections™",
     "description": "Selezioni finali: prodotti scelti, varianti, approvazioni materiche.",
     "open_mode": "navigate", "linked_route": "/inspirations"},
    {"type": "site_evolution",       "title": "Site Evolution™",
     "description": "L'evoluzione reale del progetto, raccontata per immagini.",
     "open_mode": "inline"},
    {"type": "final_presentation",   "title": "Presentazione Finale",
     "description": "L'incontro cinematico in cui il progetto viene celebrato.",
     "open_mode": "navigate", "linked_route": "/inspirations"},
    {"type": "certified_closure",    "title": "Chiusura Certificata",
     "description": "Il progetto entra nella memoria firmata dello studio.",
     "open_mode": "inline"},
]


def ensure_journey(tenant_id: str, project_id: str, account_id: str) -> dict:
    started = now() - timedelta(weeks=8)
    existing = find_journey(tenant_id, project_id)
    if existing:
        print(f"  ✓ Journey già presente: {existing['id']}")
        return existing
    j = {
        "id":              str(uuid.uuid4()),
        "tenant_id":       tenant_id,
        "project_id":      project_id,
        "account_id":      account_id,
        "current_milestone_id": None,
        "overall_status":  "in_progress",
        "lifecycle_state": "presenting",   # nuove direzioni condivise
        "started_at":      iso(started),
        "created_by":      DESIGNER_PROFILE_ID,
        "created_at":      iso(started),
        "updated_at":      iso(now() - timedelta(days=2)),
    }
    c.table("design_journeys").insert(j).execute()
    print(f"  + Journey creato: {j['id']}")
    return j


def ensure_milestones(tenant_id: str, journey_id: str) -> list:
    existing = (c.table("journey_milestones").select("*")
                .eq("journey_id", journey_id).execute().data or [])
    if existing:
        print(f"  ✓ Milestones già presenti: {len(existing)}")
        return sorted(existing, key=lambda m: m["order_index"])
    # Plot timestamps over 8 weeks. Each step gets a "started" date.
    start = now() - timedelta(weeks=8)
    plan = [
        # (status, started_offset_days, presented_offset, approved_offset)
        ("approved",    0,  3,  5),    # brief
        ("approved",    6, 12, 14),    # inspirations
        ("in_progress", 16, 22, None), # moodboard_direction (CURRENT, frizione)
        ("in_progress", 23, None, None),# material_direction (avviato in parallelo)
        ("not_started", None, None, None),  # concept
        ("not_started", None, None, None),  # technical
        ("not_started", None, None, None),  # curated
        ("not_started", None, None, None),  # site_evolution
        ("not_started", None, None, None),  # final_presentation
        ("not_started", None, None, None),  # certified_closure
    ]
    rows = []
    for idx, (spec, ms) in enumerate(zip(plan, CANONICAL_MS)):
        status, ds, dp, da = spec
        sa = iso(start + timedelta(days=ds)) if ds is not None else None
        sp = iso(start + timedelta(days=dp)) if dp is not None else None
        ap = iso(start + timedelta(days=da)) if da is not None else None
        rows.append({
            "id":             str(uuid.uuid4()),
            "journey_id":     journey_id,
            "tenant_id":      tenant_id,
            "milestone_type": ms["type"],
            "title":          ms["title"],
            "description":    ms["description"],
            "order_index":    idx,
            "status":         status,
            "started_at":     sa,
            "presented_at":   sp,
            "approved_at":    ap,
            "owner_user_id":  DESIGNER_PROFILE_ID if status != "not_started" else None,
            "metadata": {
                "open_mode":    ms.get("open_mode") or "inline",
                "linked_route": ms.get("linked_route"),
            },
            "created_at":     iso(start),
            "updated_at":     iso(now() - timedelta(days=2)),
        })
    c.table("journey_milestones").insert(rows).execute()
    # Set current_milestone_id to moodboard_direction (index 2)
    cur_mid = rows[2]["id"]
    c.table("design_journeys").update({"current_milestone_id": cur_mid,
                                       "updated_at": iso(now())}) \
                              .eq("id", journey_id).execute()
    print(f"  + 10 milestones create — current: Moodboard Direction™")
    return rows


# ── Moodboards (3 "capitoli" con tensioni) ───────────────────────
def ensure_moodboards(tenant_id: str, project_id: str, journey_id: str,
                     moodboard_milestone_id: str) -> list:
    existing = (c.table("moodboards").select("*")
                .eq("tenant_id", tenant_id).eq("project_id", project_id)
                .execute().data or [])
    if any("Direzione" in (m.get("title") or "") or "capitolo" in (m.get("title") or "").lower()
           for m in existing):
        print(f"  ✓ Moodboards demo già presenti")
        return [m for m in existing
                if "Direzione" in (m.get("title") or "")
                or "capitolo" in (m.get("title") or "").lower()]

    base = now() - timedelta(weeks=8)
    plans = [
        {
            "title":     "Direzione fredda · primo capitolo",
            "status":    "revision_requested",
            "cover_url": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
            "rationale": "Prima esplorazione: palette cementizia, grigio caldo, lucernari, atmosfera contemplativa. La proporzione architettonica vince sulla materia.",
            "palette":   ["#9c9690", "#c4b8a4", "#3d3936", "#e5dfd2"],
            "offset":    18,
            "updated":   24,
        },
        {
            "title":     "Direzione materica · secondo capitolo",
            "status":    "viewed",
            "cover_url": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
            "rationale": "Riallineamento dopo la voce del cliente: travertino chiaro, legno noce europeo, tessuti naturali. Più caldo, più tattile, mediterraneo contemporaneo.",
            "palette":   ["#c9a779", "#7a5c3d", "#e8dec2", "#3a322a"],
            "offset":    35,
            "updated":   42,
        },
        {
            "title":     "Living alternativo · terzo capitolo",
            "status":    "draft",
            "cover_url": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80",
            "rationale": "Alternativa al living richiesta dalla cliente: tessuti più morbidi, bouclé crema, marmo Calacatta sostituito da pietra Pietra Serena.",
            "palette":   ["#e1d5b8", "#a48a6b", "#5d4f3a", "#f4ecda"],
            "offset":    52,
            "updated":   56,
        },
    ]
    out = []
    for p in plans:
        mid = str(uuid.uuid4())
        row = {
            "id":          mid,
            "tenant_id":   tenant_id,
            "project_id":  project_id,
            "journey_id":  journey_id,
            "milestone_id": moodboard_milestone_id,
            "created_by":  DESIGNER_PROFILE_ID,
            "title":       p["title"],
            "description": p["rationale"][:120],
            "status":      p["status"],
            "current_version": 1,
            "cover_strategy": "manual",
            "cover_metadata": {"signed_url": p["cover_url"], "url": p["cover_url"]},
            "ai_metadata":  {"palette": p["palette"], "rationale": p["rationale"]},
            "created_at":  iso(base + timedelta(days=p["offset"])),
            "updated_at":  iso(base + timedelta(days=p["updated"])),
        }
        c.table("moodboards").insert(row).execute()
        out.append(row)
    print(f"  + 3 moodboards create (V1 freddo · V2 materico · V3 alternativa)")
    return out


# ── Milestone versions (chapter stack del Moodboard Direction) ──
def ensure_milestone_versions(tenant_id: str, milestone_id: str, moodboards: list):
    existing = (c.table("milestone_versions").select("id")
                .eq("milestone_id", milestone_id).execute().data or [])
    if existing:
        print(f"  ✓ Milestone versions già presenti: {len(existing)}")
        return
    rows = []
    KINDS = ["initial_direction", "proposed_evolution", "proposed_evolution"]
    for i, mb in enumerate(moodboards):
        rows.append({
            "id":           str(uuid.uuid4()),
            "tenant_id":    tenant_id,
            "milestone_id": milestone_id,
            "chapter_kind": KINDS[i] if i < len(KINDS) else "proposed_evolution",
            "title":        mb["title"],
            "summary":      mb.get("description"),
            "rationale":    (mb.get("ai_metadata") or {}).get("rationale"),
            "palette_hint": ",".join((mb.get("ai_metadata") or {}).get("palette", [])),
            "cover_url":    (mb.get("cover_metadata") or {}).get("signed_url"),
            "created_by":   DESIGNER_PROFILE_ID,
            "created_at":   mb["created_at"],
            "updated_at":   mb["updated_at"],
        })
    c.table("milestone_versions").insert(rows).execute()
    print(f"  + {len(rows)} milestone versions create")


# ── Feedback / voci curatoriali ──────────────────────────────────
def ensure_voices(tenant_id: str, milestones: list):
    by_type = {m["milestone_type"]: m for m in milestones}
    mood_mid = by_type["moodboard_direction"]["id"]
    mat_mid  = by_type["material_direction"]["id"]
    brief_mid = by_type["brief"]["id"]

    existing = (c.table("milestone_feedback").select("id")
                .eq("tenant_id", tenant_id)
                .in_("milestone_id", [mood_mid, mat_mid, brief_mid])
                .limit(1).execute().data or [])
    if existing:
        print(f"  ✓ Voci curatoriali già presenti")
        return

    base = now() - timedelta(weeks=8)
    # Use the editorial feedback kinds defined in milestone_dialogue.FEEDBACK_LABEL.
    voices = [
        # Brief — onboarding warmth
        {"mid": brief_mid, "kind": "free_voice", "role": "client",
         "quote": "Vogliamo dare carattere alla villa, ma senza farla diventare uno showroom. È casa nostra di weekend — deve respirare.",
         "off": 1},
        {"mid": brief_mid, "kind": "free_voice", "role": "studio",
         "quote": "Capito. Cercheremo un'atmosfera mediterranea contemporanea, materica, accogliente. Niente effetto rivista.",
         "off": 2},
        # Moodboard direction — la frizione vera
        {"mid": mood_mid, "kind": "wants_more_material", "role": "client",
         "quote": "La prima direzione è bella, ma sento la casa troppo distante. Vorrei più calore, materiali tattili — qualcosa di mediterraneo ma contemporaneo.",
         "off": 25},
        {"mid": mood_mid, "kind": "free_voice", "role": "studio",
         "quote": "Riallineiamo. Stiamo ricomponendo la palette con travertino chiaro e legno noce europeo — più caldo, più tattile.",
         "off": 27},
        {"mid": mood_mid, "kind": "palette_works", "role": "client",
         "quote": "Il secondo capitolo è molto più vicino. Mi piace il travertino. Per il living vorrei vedere un'alternativa con tessuti più morbidi.",
         "off": 43},
        {"mid": mood_mid, "kind": "request_variant", "role": "studio",
         "quote": "Procediamo con una terza esplorazione sul living: bouclé crema, pietra Pietra Serena al posto del Calacatta (anche per restare nel budget).",
         "off": 50},
        # Material direction — voce sul materiale scartato
        {"mid": mat_mid, "kind": "free_voice", "role": "client",
         "quote": "Sulla pietra grigia originale del primo capitolo: dopo aver visto il secondo, non sento più sua giusta. Possiamo scartarla.",
         "off": 44},
        {"mid": mat_mid, "kind": "material_loved", "role": "studio",
         "quote": "Concordo. Pietra grigia scartata. Stiamo richiedendo campioni del travertino al fornitore.",
         "off": 45},
    ]
    rows = []
    for v in voices:
        rows.append({
            "id":           str(uuid.uuid4()),
            "tenant_id":    tenant_id,
            "milestone_id": v["mid"],
            "version_id":   None,
            "kind":         v["kind"],
            "quote":        v["quote"],
            "author_role":  v["role"],
            "author_user_id": None,
            "created_at":   iso(base + timedelta(days=v["off"])),
        })
    c.table("milestone_feedback").insert(rows).execute()
    print(f"  + {len(rows)} voci curatoriali create (cliente + studio, con frizioni reali)")


# ── Timeline events (narrazione editoriale del Journey) ──────────
def ensure_timeline(tenant_id: str, journey_id: str, milestones: list):
    existing = (c.table("journey_timeline_events").select("id")
                .eq("journey_id", journey_id).execute().data or [])
    # Filter to seed-tagged events only (idempotent — distinguishes from F.B feedback narration)
    tagged = [e for e in existing]
    if len(tagged) >= 10:
        print(f"  ✓ Timeline events già presenti ({len(tagged)})")
        return

    by_type = {m["milestone_type"]: m for m in milestones}
    base = now() - timedelta(weeks=8)
    events = [
        (0,  None,                              "journey_started",
         "Il Design Journey™ di Villa Riviera ha avuto inizio. Una conversazione apre il viaggio."),
        (1,  by_type["brief"]["id"],            "milestone_started",
         "Brief Cliente — in apertura. Famiglia Bianchi racconta la sua atmosfera."),
        (5,  by_type["brief"]["id"],            "milestone_approved",
         "Brief Cliente approvato. La direzione è chiara: mediterraneo contemporaneo, materico, caldo."),
        (6,  by_type["inspirations"]["id"],     "milestone_started",
         "Inspirations™ — il linguaggio visuale prende forma."),
        (14, by_type["inspirations"]["id"],     "milestone_approved",
         "Inspirations™ approvate. 18 riferimenti allineati con la famiglia."),
        (16, by_type["moodboard_direction"]["id"], "milestone_started",
         "Moodboard Direction™ — la composizione editoriale prende forma."),
        (22, by_type["moodboard_direction"]["id"], "milestone_presented",
         "Primo capitolo moodboard presentato. Palette cementizia, atmosfera contemplativa."),
        (25, by_type["moodboard_direction"]["id"], "milestone_revision_requested",
         "Cliente chiede una revisione: la prima direzione è troppo fredda. Serve più calore, più materia."),
        (35, by_type["moodboard_direction"]["id"], "milestone_presented",
         "Secondo capitolo moodboard presentato. Travertino chiaro, legno noce, palette materica."),
        (43, None,                              "voice_received",
         "Cliente apprezza il secondo capitolo. Chiede un'alternativa per il living con tessuti più morbidi."),
        (23, by_type["material_direction"]["id"], "milestone_started",
         "Material Direction™ — il tavolo materico apre il suo capitolo, in parallelo alla Moodboard."),
        (44, None,                              "material_rejected",
         "Pietra grigia originale — scartata. Dopo la revisione, non risuona più con la direzione."),
        (45, by_type["material_direction"]["id"], "material_selected",
         "Travertino chiaro selezionato per il bagno padronale. In attesa di campioni dal fornitore."),
        (46, by_type["material_direction"]["id"], "material_selected",
         "Legno noce europeo selezionato per pavimenti e librerie."),
        (50, None,                              "voice_received",
         "Studio risponde: terza esplorazione del living in lavorazione. Bouclé crema, Pietra Serena."),
        (56, by_type["moodboard_direction"]["id"], "milestone_in_progress",
         "Terzo capitolo moodboard in composizione. Alternativa living quasi pronta da presentare."),
    ]
    rows = []
    for off, mid, kind, narrative in events:
        rows.append({
            "id":             str(uuid.uuid4()),
            "journey_id":     journey_id,
            "tenant_id":      tenant_id,
            "milestone_id":   mid,
            "event_type":     kind,
            "narrative_text": narrative,
            "created_by":     DESIGNER_PROFILE_ID,
            "metadata":       {"demo_seed_tag": SEED_TAG},
            "created_at":     iso(base + timedelta(days=off)),
        })
    c.table("journey_timeline_events").insert(rows).execute()
    print(f"  + {len(rows)} eventi timeline creati (8 settimane di evoluzione)")


# ── Site Evolution™ entries (Sprint G.8) ─────────────────────────
def ensure_site_evolution(tenant_id: str, journey_id: str, milestones: list):
    """Seed 8 momenti reali del cantiere — sopralluoghi, demolizioni,
    arrivo materiali, installazioni. Sobrio, documentaristico.
    """
    by_type = {m["milestone_type"]: m for m in milestones}
    se_ms = by_type.get("site_evolution")
    if not se_ms:
        return

    existing = (c.table("journey_timeline_events").select("id")
                .eq("journey_id", journey_id)
                .eq("event_type", "site_evolution").execute().data or [])
    if existing:
        print(f"  ✓ Site Evolution™ già seedato ({len(existing)} momenti)")
        return

    base = now() - timedelta(weeks=8)
    entries = [
        # 1. Primo sopralluogo
        {"off": 4, "space": "living", "kind": "site_visit",
         "title": "Primo sopralluogo · Living",
         "narrative": "Sopralluogo iniziale della villa. Misurazioni del living, verifica dell'altezza del soffitto a vela, registrazione della luce naturale lungo l'arco della giornata.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
             "caption": "Living prima dell'intervento"},
            {"url": "https://images.unsplash.com/photo-1567016526105-22da7c13161a?auto=format&fit=crop&w=1400&q=80",
             "caption": "Vista verso il mare"},
         ],
         "before": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80"},
        # 2. Demolizioni
        {"off": 33, "space": "kitchen", "kind": "demolition",
         "title": "Demolizioni · Cucina e parete divisoria",
         "narrative": "Rimossa la parete divisoria tra cucina e living per aprire il volume sulla terrazza. Recuperate due travi originali in rovere, da reintegrare nel disegno finale.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1581094488379-6b0d4cf4b8a8?auto=format&fit=crop&w=1400&q=80",
             "caption": "Demolizione parete divisoria"},
         ]},
        # 3. Showroom visit per il travertino
        {"off": 40, "space": "master_bath", "kind": "showroom",
         "title": "Showroom · Campioni travertino",
         "narrative": "Visita allo showroom del fornitore per i campioni di travertino chiaro. Selezionata la lastra con venatura orizzontale per la parete del bagno padronale.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1400&q=80",
             "caption": "Lastra di travertino selezionata"},
         ],
         "materials": ["travertino_chiaro"]},
        # 4. Mockup palette
        {"off": 47, "space": "living", "kind": "mockup",
         "title": "Mockup palette · Living",
         "narrative": "Mockup in scala 1:1 della palette materica del living. Travertino chiaro, rovere termotrattato, lino grezzo accostati alla luce naturale di mezzogiorno.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80",
             "caption": "Mockup materico in luce naturale"},
         ]},
        # 5. Pietra arrivata
        {"off": 49, "space": "master_bath", "kind": "delivery",
         "title": "Arrivo travertino in showroom",
         "narrative": "Le lastre di travertino chiaro sono arrivate in showroom. Catalogazione completa, verifica delle venature, taglio programmato per la prossima settimana.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1400&q=80",
             "caption": "Lastre di travertino in showroom"},
         ],
         "materials": ["travertino_chiaro"]},
        # 6. Sopralluogo elettrico
        {"off": 51, "space": "living", "kind": "test",
         "title": "Verifica illuminazione · Living",
         "narrative": "Test della temperatura di colore lungo la fascia delle dieci di sera. Confermata la scelta 2700K per i punti d'angolo, 3000K per la parete in travertino.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1400&q=80",
             "caption": "Test illuminazione serale"},
         ]},
        # 7. Installazione cucina (recent)
        {"off": 54, "space": "kitchen", "kind": "installation",
         "title": "Inizio installazione · Cucina",
         "narrative": "Posa dei moduli inferiori della cucina. Il piano in pietra Pietra Serena è previsto per la prossima settimana, dopo la rettifica delle giunzioni.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",
             "caption": "Moduli cucina posati"},
         ]},
        # 8. Terrazza — sopralluogo finale prima del progetto
        {"off": 56, "space": "terrace", "kind": "site_visit",
         "title": "Sopralluogo terrazza · vista finale",
         "narrative": "Sopralluogo della terrazza prima del nuovo progetto di pavimentazione esterna. Verifica della pendenza, registrazione della vista sul mare al tramonto.",
         "photos": [
            {"url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
             "caption": "Vista terrazza al tramonto"},
         ]},
    ]
    rows = []
    for e in entries:
        ts = iso(base + timedelta(days=e["off"]))
        metadata = {
            "kind":         "site_evolution",
            "space_key":    e["space"],
            "title":        e["title"],
            "narrative":    e["narrative"],
            "visit_kind":   e["kind"],
            "occurred_at":  ts,
            "photos":       e.get("photos", []),
            "before_url":   e.get("before"),
            "after_url":    e.get("after"),
            "materials_linked": e.get("materials", []),
            "author_role":  "studio",
        }
        rows.append({
            "id":             str(uuid.uuid4()),
            "tenant_id":      tenant_id,
            "journey_id":     journey_id,
            "milestone_id":   se_ms["id"],
            "event_type":     "site_evolution",
            "narrative_text": e["title"],
            "created_by":     DESIGNER_PROFILE_ID,
            "metadata":       metadata,
            "created_at":     ts,
        })
    c.table("journey_timeline_events").insert(rows).execute()

    # Activate the milestone
    c.table("journey_milestones").update({
        "status":     "in_progress",
        "started_at": iso(base + timedelta(days=4)),
        "updated_at": iso(now()),
    }).eq("id", se_ms["id"]).execute()
    print(f"  + {len(rows)} momenti di Site Evolution™ seedati (5 spazi)")


# ── Main ─────────────────────────────────────────────────────────
def main():
    print("\n🌱 Seeding Villa Riviera™ — un Journey vero, con frizioni vere.\n")
    tenant = get_tenant()
    print(f"Tenant: {tenant['name']} ({tenant['id']})")
    client_profile = get_client_profile(tenant["id"])
    print(f"Client: {client_profile['email']} ({client_profile['id']})\n")

    account = ensure_account(tenant["id"], client_profile["id"])
    project = ensure_project(tenant["id"], client_profile["id"], account["id"])
    journey = ensure_journey(tenant["id"], project["id"], account["id"])
    milestones = ensure_milestones(tenant["id"], journey["id"])

    moodboard_milestone = next(m for m in milestones
                               if m["milestone_type"] == "moodboard_direction")
    moodboards = ensure_moodboards(tenant["id"], project["id"], journey["id"],
                                    moodboard_milestone["id"])
    ensure_milestone_versions(tenant["id"], moodboard_milestone["id"], moodboards)
    ensure_voices(tenant["id"], milestones)
    ensure_timeline(tenant["id"], journey["id"], milestones)
    ensure_site_evolution(tenant["id"], journey["id"], milestones)

    print("\n✓ Seed completato. Villa Riviera™ è viva nel Companion del cliente Marco.\n")
    print(f"  Project ID: {project['id']}")
    print(f"  Journey ID: {journey['id']}\n")


if __name__ == "__main__":
    main()
