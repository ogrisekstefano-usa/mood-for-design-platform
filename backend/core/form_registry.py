"""Blueprint Form Engine — server-side field registry + form schema.

Forms are stored per tenant in `tenant_settings` (key pattern `form.{slug}`).
Submissions are stored similarly (`form_submission.{slug}.{uuid}`) — future
migration to a dedicated table is transparent to the API contract.

A form is reusable for: lead generation, project onboarding, moodboard
approvals, proposal approvals, concierge requests, surveys, feedback,
A&D qualification, sourcing requests, vendor applications.

NO hardcoded form. NO tenant-specific logic. Schema-driven.
"""
from typing import Dict, Any, List


# ── Field type registry ──────────────────────────────────────────────────────
# Each field type declares:
#   - `kind`              : payload primitive (string | string[] | number | file | ...)
#   - `supports`          : conditional? scoring? required? media?
#   - `default_validation`: baseline validator hints (frontend respects)
#   - `ui_variants`       : UX presentations the renderer can switch between
FIELD_TYPES: List[Dict[str, Any]] = [
    {
        "type": "short_text",       "kind": "string",
        "label": "Short text",      "category": "text",
        "supports": {"conditional": True, "required": True, "ai_copy": True},
        "ui_variants": ["editorial", "underline", "boxed"],
    },
    {
        "type": "long_text",        "kind": "string",
        "label": "Long text",       "category": "text",
        "supports": {"conditional": True, "required": True, "ai_copy": True},
        "ui_variants": ["editorial", "boxed"],
    },
    {
        "type": "email",            "kind": "string",
        "label": "Email",           "category": "contact",
        "supports": {"conditional": True, "required": True},
        "default_validation": {"format": "email"},
    },
    {
        "type": "phone",            "kind": "string",
        "label": "Phone",           "category": "contact",
        "supports": {"conditional": True, "required": True},
    },
    {
        "type": "country",          "kind": "string",
        "label": "Country",         "category": "contact",
        "supports": {"conditional": True, "required": True},
    },
    {
        "type": "single_choice",    "kind": "string",
        "label": "Single choice",   "category": "select",
        "supports": {"conditional": True, "required": True, "scoring": True},
        "ui_variants": ["pills", "list", "cards"],
    },
    {
        "type": "multi_choice",     "kind": "string[]",
        "label": "Multi choice",    "category": "select",
        "supports": {"conditional": True, "required": True, "scoring": True},
        "ui_variants": ["pills", "list", "cards"],
    },
    {
        "type": "style_cards",      "kind": "string[]",
        "label": "Style cards",     "category": "visual",
        "description": "Image-driven multi-select for aesthetic/style preferences",
        "supports": {"conditional": True, "required": True, "scoring": True, "media": True},
        "ui_variants": ["gallery", "compact"],
    },
    {
        "type": "mood_cards",       "kind": "string[]",
        "label": "Mood cards",      "category": "visual",
        "description": "Emotional / atmospheric selection (calm / dramatic / warm / ...)",
        "supports": {"conditional": True, "required": True, "scoring": True, "media": True},
    },
    {
        "type": "image_choice",     "kind": "string",
        "label": "Image choice",    "category": "visual",
        "supports": {"conditional": True, "required": True, "media": True},
    },
    {
        "type": "slider",           "kind": "number",
        "label": "Slider",          "category": "numeric",
        "supports": {"conditional": True, "required": True, "scoring": True},
        "default_validation": {"min": 0, "max": 100, "step": 1},
    },
    {
        "type": "budget_slider",    "kind": "number",
        "label": "Budget",          "category": "numeric",
        "description": "Currency-aware slider with snap points",
        "supports": {"conditional": True, "required": True, "scoring": True},
    },
    {
        "type": "timeline_picker",  "kind": "string",
        "label": "Timeline",        "category": "schedule",
        "supports": {"conditional": True, "required": True},
        "ui_variants": ["months", "quarters", "free_text"],
    },
    {
        "type": "scale",            "kind": "number",
        "label": "1-5 scale",       "category": "feedback",
        "supports": {"conditional": True, "required": True, "scoring": True},
    },
    {
        "type": "file_upload",      "kind": "file",
        "label": "File upload",     "category": "media",
        "supports": {"conditional": True, "required": False, "media": True},
        "default_validation": {"max_size_mb": 20, "accept": ["image/*", "application/pdf"]},
    },
    {
        "type": "signature",        "kind": "string",
        "label": "Signature",       "category": "compliance",
        "supports": {"conditional": True, "required": True},
        "coming_soon": True,
    },
    {
        "type": "consent",          "kind": "boolean",
        "label": "Consent",         "category": "compliance",
        "supports": {"conditional": True, "required": True},
    },
    {
        "type": "statement",        "kind": "void",
        "label": "Statement",       "category": "presentation",
        "description": "Pure editorial copy block — no input. Use for intros, dividers, reassurance.",
        "supports": {"conditional": True},
    },
]

FIELD_TYPES_BY_KEY = {f["type"]: f for f in FIELD_TYPES}


def field_known(field_type: str) -> bool:
    return field_type in FIELD_TYPES_BY_KEY


# ── Form purposes (intent → workspace integration hints) ────────────────────
FORM_PURPOSES = [
    {"id": "lead",              "label": "Lead generation",        "writes_to": "leads"},
    {"id": "design_request",    "label": "Design request",         "writes_to": "leads+projects"},
    {"id": "onboarding",        "label": "Client onboarding",      "writes_to": "projects"},
    {"id": "moodboard_approval","label": "Moodboard approval",     "writes_to": "moodboard_approvals"},
    {"id": "proposal_approval", "label": "Proposal approval",      "writes_to": "proposal_signoffs"},
    {"id": "concierge",         "label": "Concierge request",      "writes_to": "concierge_requests"},
    {"id": "survey",            "label": "Survey",                 "writes_to": "form_submissions"},
    {"id": "feedback",          "label": "Feedback",               "writes_to": "form_submissions"},
    {"id": "vendor_application","label": "Vendor application",     "writes_to": "form_submissions"},
    {"id": "sourcing_request",  "label": "Sourcing request",       "writes_to": "form_submissions"},
]


# ── Form layout / atmosphere variants ───────────────────────────────────────
FORM_LAYOUTS = ["editorial", "split_screen", "fullscreen", "single_step", "concierge"]
FORM_ATMOSPHERES = ["cinematic", "calm", "editorial", "concierge", "showroom"]


# ── Default form templates (seed when first GET on unknown slug) ─────────────
def default_form(slug: str) -> Dict[str, Any]:
    """Return a baseline 'design_request' form seed — replace via PUT."""
    import uuid
    return {
        "slug":  slug,
        "title": {"_default": slug.replace("-", " ").title()},
        "purpose": "design_request",
        "status": "draft",        # draft | published
        "layout": "editorial",
        "atmosphere": "cinematic",
        "settings": {
            "show_progress":     True,
            "allow_draft_save":  True,
            "show_back_button":  True,
            "shuffle_questions": False,
            "submit_label":      {"_default": "Submit"},
            "thank_you": {
                "headline": {"_default": "Thank you."},
                "subline":  {"_default": "We've received your request and will be in touch shortly."},
                "redirect_url": None,
                "delay_ms": 0,
            },
        },
        "ai":  {
            "field_suggestions": False,
            "question_generation": False,
            "copy_enhancement": False,
            "auto_localize": False,
            "scoring": False,
        },
        "scoring": {"rules": []},                       # placeholder for future
        "integrations": {"crm": None, "email": None},   # placeholder
        "steps": [
            {
                "id": str(uuid.uuid4()),
                "title":      {"_default": "About you"},
                "description":{"_default": "A few essentials so we can introduce ourselves properly."},
                "fields": [
                    {"id": str(uuid.uuid4()), "type": "short_text", "key": "first_name",
                     "label": {"_default": "First name"}, "required": True},
                    {"id": str(uuid.uuid4()), "type": "short_text", "key": "last_name",
                     "label": {"_default": "Last name"}, "required": True},
                    {"id": str(uuid.uuid4()), "type": "email",      "key": "email",
                     "label": {"_default": "Email"},     "required": True},
                ],
            },
            {
                "id": str(uuid.uuid4()),
                "title":      {"_default": "About your project"},
                "description":{"_default": "Help us understand the canvas."},
                "fields": [
                    {"id": str(uuid.uuid4()), "type": "single_choice", "key": "project_type",
                     "label": {"_default": "What kind of project is this?"}, "required": True,
                     "ui": "cards",
                     "options": [
                         {"value": "residential", "label": {"_default": "Residential"}},
                         {"value": "hospitality", "label": {"_default": "Hospitality"}},
                         {"value": "retail",      "label": {"_default": "Retail"}},
                         {"value": "office",      "label": {"_default": "Office"}},
                     ]},
                    {"id": str(uuid.uuid4()), "type": "budget_slider", "key": "budget",
                     "label": {"_default": "Indicative budget"},
                     "validation": {"min": 5000, "max": 5000000, "step": 5000, "currency": "EUR"}},
                    {"id": str(uuid.uuid4()), "type": "timeline_picker", "key": "timeline",
                     "label": {"_default": "Desired timeline"}},
                ],
            },
            {
                "id": str(uuid.uuid4()),
                "title":      {"_default": "Aesthetic direction"},
                "description":{"_default": "Pick what resonates — we'll calibrate."},
                "fields": [
                    {"id": str(uuid.uuid4()), "type": "style_cards", "key": "style_preferences",
                     "label": {"_default": "Style preferences"},
                     "options": [
                         {"value": "minimal",      "label": {"_default": "Minimal"}, "image": None},
                         {"value": "classical",    "label": {"_default": "Classical"}, "image": None},
                         {"value": "japandi",      "label": {"_default": "Japandi"}, "image": None},
                         {"value": "industrial",   "label": {"_default": "Industrial"}, "image": None},
                         {"value": "art_deco",     "label": {"_default": "Art Deco"}, "image": None},
                         {"value": "mediterranean","label": {"_default": "Mediterranean"}, "image": None},
                     ]},
                ],
            },
            {
                "id": str(uuid.uuid4()),
                "title":      {"_default": "Anything else?"},
                "fields": [
                    {"id": str(uuid.uuid4()), "type": "long_text", "key": "notes",
                     "label": {"_default": "Notes"}, "required": False},
                    {"id": str(uuid.uuid4()), "type": "file_upload", "key": "references",
                     "label": {"_default": "Reference files (plans, inspiration)"},
                     "required": False},
                    {"id": str(uuid.uuid4()), "type": "consent", "key": "consent",
                     "label": {"_default": "I agree to be contacted about my request."}, "required": True},
                ],
            },
        ],
        "created_at": None,
        "updated_at": None,
    }


# ── Submission helpers ──────────────────────────────────────────────────────
def evaluate_conditional(rule: Dict[str, Any], answers: Dict[str, Any]) -> bool:
    """Evaluate a single visibility rule.

    Shape: { field: 'project_type', op: 'equals'|'not_equals'|'in'|'not_in'|'gt'|'lt'|'truthy', value }
    """
    if not rule or "field" not in rule:
        return True
    op = rule.get("op", "equals")
    target = answers.get(rule["field"])
    val = rule.get("value")
    if op == "equals":
        return target == val
    if op == "not_equals":
        return target != val
    if op == "in":
        return target in (val or [])
    if op == "not_in":
        return target not in (val or [])
    if op == "gt":
        try:
            return float(target) > float(val)
        except (TypeError, ValueError):
            return False
    if op == "lt":
        try:
            return float(target) < float(val)
        except (TypeError, ValueError):
            return False
    if op == "truthy":
        return bool(target)
    return True


def validate_submission(form: Dict[str, Any], answers: Dict[str, Any]) -> List[str]:
    """Return list of error strings (empty = valid)."""
    errors = []
    for step in form.get("steps", []):
        # Skip step if visibility rule fails
        if step.get("visibility") and not evaluate_conditional(step["visibility"], answers):
            continue
        for field in step.get("fields", []):
            if field.get("visibility") and not evaluate_conditional(field["visibility"], answers):
                continue
            ftype = field.get("type")
            key = field.get("key") or field.get("id")
            value = answers.get(key)
            if field.get("required") and (value is None or value == "" or value == []):
                label = field.get("label", {}).get("_default") or key
                errors.append(f"Field '{label}' is required")
                continue
            if ftype == "email" and value:
                import re
                if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", str(value)):
                    errors.append(f"Invalid email: {value}")
    return errors
