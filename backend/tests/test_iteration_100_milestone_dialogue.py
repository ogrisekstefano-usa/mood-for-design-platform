"""Iter100 · Sprint F.B — Immersive Project Dialogue.

Coverage:
  • Backend endpoints for milestone dialogue (versions + feedback +
    rationale + project memory).
  • Editorial Italian lexicon — NO V1/V2, NO approve/reject, NO comment.
  • Chapter creation emits a narrative event on the journey timeline.
  • Feedback emits a "client voice" narrative.
  • Rationale persisted on projects.metadata_json.rationale_json with
    structured editorial keys (direzione narrativa, materia, atmosfera…).
  • Frontend MilestoneDialogue component mounted in DesignJourneyTab.
"""
import os
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

REPO = Path(__file__).resolve().parent.parent.parent
FRONTEND = REPO / "frontend" / "src"
load_dotenv(REPO / "frontend" / ".env")

API = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
LOGIN = "demo@moodfordesign.com"
PWD = "Blueprint2024!"


FORBIDDEN_TERMS = [
    "task", "sprint", "kanban", "workflow", "dashboard widget",
    "ticket", "todo", "doing", "done",
    "approve button", "reject button",
    "v1", "v2", "v3", "revision history", "compare revisions",
    "add comment", "change request", "pending review",
    "upload center", "attachment center", "audit log",
    "file management", "review queue",
]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/api/auth/login",
                      json={"email": LOGIN, "password": PWD}, timeout=20)
    r.raise_for_status()
    return r.json()["session"]["access_token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def context(token):
    """Resolve a real (project, milestone) pair."""
    r = requests.get(f"{API}/api/projects?limit=1", headers=H(token), timeout=20)
    pid = r.json()["data"][0]["id"]
    j = requests.get(f"{API}/api/projects/{pid}/journey", headers=H(token), timeout=20).json()
    moodboard_dir = next(m for m in j["milestones"]
                         if m["milestone_type"] == "moodboard_direction")
    return {"project_id": pid, "milestone_id": moodboard_dir["id"]}


# ─── Dialogue lexicon ─────────────────────────────────────────────
def test_get_dialogue_returns_editorial_lexicon(token, context):
    r = requests.get(f"{API}/api/milestones/{context['milestone_id']}/dialogue",
                     headers=H(token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "chapters" in body and "feedback" in body and "lexicon" in body
    lex = body["lexicon"]
    # Editorial Italian chapter labels
    for kind, label in [
        ('initial_direction',         'Direzione iniziale'),
        ('proposed_evolution',         'Evoluzione proposta'),
        ('shared_variant',             'Variante condivisa'),
        ('material_revision',          'Revisione materica'),
        ('new_interpretation',         'Nuova interpretazione'),
        ('final_direction',            'Direzione finale'),
    ]:
        assert lex["chapter_kinds"].get(kind) == label
    # 9 client feedback labels (the 9 CTAs)
    for kind, label in [
        ('embraces',            'Questa direzione mi rappresenta'),
        ('explore_atmosphere',  'Vorrei approfondire questa atmosfera'),
        ('request_variant',     'Possiamo esplorare una variante?'),
        ('material_loved',      'Questo materiale mi convince'),
        ('wants_lighter',       'Vorrei una proposta più luminosa'),
        ('storytelling_strong', 'Questa soluzione racconta bene il progetto'),
        ('palette_works',       'Questa palette funziona molto bene'),
        ('request_detail',      'Vorrei approfondire questo dettaglio'),
    ]:
        assert lex["feedback_kinds"].get(kind) == label, (
            f"Missing or wrong feedback label for {kind}"
        )


# ─── Chapter creation ─────────────────────────────────────────────
def test_create_chapter_with_italian_kind(token, context):
    r = requests.post(
        f"{API}/api/milestones/{context['milestone_id']}/versions",
        headers=H(token),
        json={
            "chapter_kind": "proposed_evolution",
            "title": "Luce mediterranea",
            "summary": "Tonalità più calda, materia opaca.",
            "rationale": "La luce diventa parte attiva del progetto.",
        },
        timeout=20,
    )
    assert r.status_code == 200, r.text
    item = r.json()["item"]
    assert item["chapter_label"] == "Evoluzione proposta"
    assert item["title"] == "Luce mediterranea"


def test_create_chapter_rejects_v1_style_kind(token, context):
    r = requests.post(
        f"{API}/api/milestones/{context['milestone_id']}/versions",
        headers=H(token),
        json={"chapter_kind": "v1", "title": "x"},
        timeout=20,
    )
    assert r.status_code == 400, "Must reject non-editorial chapter_kind"


# ─── Feedback ─────────────────────────────────────────────────────
def test_create_feedback_with_curatorial_kind(token, context):
    r = requests.post(
        f"{API}/api/milestones/{context['milestone_id']}/feedback",
        headers=H(token),
        json={"kind": "palette_works", "author_role": "client"},
        timeout=20,
    )
    assert r.status_code == 200
    item = r.json()["item"]
    assert item["kind_label"] == "Questa palette funziona molto bene"
    assert item["tone"] in {"embrace", "curious", "reorient", "voice"}


def test_create_feedback_rejects_enterprise_kind(token, context):
    r = requests.post(
        f"{API}/api/milestones/{context['milestone_id']}/feedback",
        headers=H(token),
        json={"kind": "approved", "author_role": "client"},
        timeout=20,
    )
    assert r.status_code == 400


def test_feedback_emits_client_voice_event(token, context):
    """Feedback must surface as a narrative event in the journey timeline."""
    pid = context["project_id"]
    requests.post(
        f"{API}/api/milestones/{context['milestone_id']}/feedback",
        headers=H(token),
        json={"kind": "embraces", "author_role": "client"},
        timeout=20,
    )
    j = requests.get(f"{API}/api/projects/{pid}/journey", headers=H(token), timeout=20).json()
    texts = " ".join(e.get("narrative_text", "") for e in j["timeline"])
    assert "Voce del cliente" in texts or "Questa direzione mi rappresenta" in texts


# ─── Rationale ────────────────────────────────────────────────────
def test_put_rationale_persists_editorial_keys(token, context):
    pid = context["project_id"]
    payload = {
        "narrative_direction": "Materia, luce, silenzio.",
        "material_logic":      "Pietra naturale, legno tagliato a mano.",
        "desired_atmosphere":  "Quasi monastico ma caldo.",
        "context_relation":    "Dialoga col bosco antistante.",
        "cultural_coherence":  "Continuità con la tradizione mediterranea.",
        "client_perception":   "Il cliente cerca rifugio editoriale.",
        "project_language":    "Linguaggio sottrattivo, atmosfera densa.",
    }
    r = requests.put(f"{API}/api/projects/{pid}/rationale",
                     headers=H(token), json=payload, timeout=20)
    assert r.status_code == 200
    rationale = r.json()["rationale"]
    for k, v in payload.items():
        assert rationale.get(k) == v
    # GET round-trip
    r2 = requests.get(f"{API}/api/projects/{pid}/rationale",
                      headers=H(token), timeout=20).json()
    assert r2["rationale"]["narrative_direction"] == payload["narrative_direction"]


# ─── Project Memory ───────────────────────────────────────────────
def test_project_memory_returns_narrative_entries(token, context):
    pid = context["project_id"]
    r = requests.get(f"{API}/api/projects/{pid}/memory",
                     headers=H(token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert "memory" in body
    assert isinstance(body["memory"], list)
    if body["memory"]:
        e = body["memory"][0]
        assert "narrative" in e
        assert "kind" in e
        # Editorial guard on the memory itself
        text = (e.get("narrative") or "").lower()
        for bad in FORBIDDEN_TERMS:
            assert bad not in text, f"Forbidden term '{bad}' in memory narrative"


# ─── Frontend mount + lexicon presence ────────────────────────────
def _read(*parts):
    return FRONTEND.joinpath(*parts).read_text(encoding="utf-8")


def test_milestone_dialogue_component_exists_and_mounted():
    p = FRONTEND / "components" / "journey" / "MilestoneDialogue.jsx"
    assert p.exists()
    djt = _read("pages", "workspace", "DesignJourneyTab.jsx")
    assert "MilestoneDialogue" in djt
    assert "milestoneId={active.id}" in djt


def test_frontend_component_uses_editorial_italian_labels():
    src = _read("components", "journey", "MilestoneDialogue.jsx")
    # Required Italian copy
    for phrase in (
        "I capitoli condivisi",
        "Conversazione progettuale",
        "Una voce libera",
        "Aggiungi un capitolo",
        "Voce del cliente",
        "Nuovo capitolo progettuale",
    ):
        assert phrase in src, f"Missing editorial phrase '{phrase}'"
    # NO enterprise vocabulary
    low = src.lower()
    for bad in ("v1", "v2", "v3", "approve", "reject", "add comment",
                "kanban", "workflow", "dashboard widget"):
        assert bad not in low, f"Forbidden term '{bad}' in MilestoneDialogue.jsx"


def test_frontend_renders_all_9_client_ctas():
    src = _read("components", "journey", "MilestoneDialogue.jsx")
    # The 9 editorial CTAs must be wired via feedback-cta-* testids in the
    # render loop. We assert each kind is referenced (not duplicated) via
    # the feedback-cta-${kind} testid pattern + the loop maps lexicon keys.
    for kind in (
        "embraces", "explore_atmosphere", "request_variant", "material_loved",
        "wants_lighter", "storytelling_strong", "wants_more_material",
        "palette_works", "request_detail", "free_voice",
    ):
        # The CTAs come from the lexicon loop, so we check the testid suffix.
        assert f"feedback-cta-{kind}" in src or kind == "free_voice"
    # Special voice CTA explicitly rendered outside the loop
    assert "feedback-cta-free-voice" in src
