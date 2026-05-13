"""Blueprint API — tenant config, branding, theme, locales, navigation, dynamic settings.

Everything that drives UI rendering lives here. NO hardcoded UI tokens.
"""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from middleware.auth import get_current_user, require_roles
from models.schemas import TenantSettingUpsert
from database import db, db_available
from core.modules import get_all_modules, default_enabled_modules
from core.feature_flags import get_all_flags, resolve_flags
from core.permissions import get_role_permissions, is_super_admin
from core.tenant_context import get_tenant_context

router = APIRouter()
logger = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc).isoformat()


def _get_setting(client, tenant_id: str, key: str, default=None):
    r = client.table('tenant_settings').select('value_json').eq('tenant_id', tenant_id).eq('key', key).limit(1).execute()
    if r.data:
        return r.data[0].get('value_json') or default
    return default


def _upsert_setting(client, tenant_id: str, key: str, value: dict):
    existing = client.table('tenant_settings').select('id').eq('tenant_id', tenant_id).eq('key', key).limit(1).execute()
    now = _now()
    if existing.data:
        client.table('tenant_settings').update({'value_json': value, 'updated_at': now}).eq('id', existing.data[0]['id']).execute()
    else:
        client.table('tenant_settings').insert({
            'id': str(uuid.uuid4()), 'tenant_id': tenant_id, 'key': key,
            'value_json': value, 'created_at': now, 'updated_at': now,
        }).execute()


# ── PUBLIC: Resolve tenant by slug (used by signup flows, marketing routing) ─
@router.get("/tenant/by-slug/{slug}")
def get_tenant_by_slug(slug: str):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    client = db()
    r = client.table('tenants').select(
        'id, name, slug, status, logo_url, primary_color, secondary_color, font_heading, font_body, default_language, active_languages'
    ).eq('slug', slug).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    t = r.data[0]
    if t.get('status') != 'active':
        raise HTTPException(403, "Tenant inactive")
    return _enrich_tenant_config(client, t)


def _enrich_tenant_config(client, tenant: dict) -> dict:
    """Merge tenant base columns with tenant_settings (branding, navigation, modules)."""
    tid = tenant['id']
    branding = _get_setting(client, tid, 'branding', {}) or {}
    navigation = _get_setting(client, tid, 'navigation', None)
    modules = _get_setting(client, tid, 'modules', None)
    workflow = _get_setting(client, tid, 'workflow_labels', {}) or {}

    return {
        'id': tid,
        'name': tenant.get('name'),
        'slug': tenant.get('slug'),
        'status': tenant.get('status'),
        'theme': {
            'primary_color': tenant.get('primary_color'),
            'secondary_color': tenant.get('secondary_color'),
            'logo_url': tenant.get('logo_url'),
            'font_heading': tenant.get('font_heading'),
            'font_body': tenant.get('font_body'),
            **(branding.get('theme') or {}),
        },
        'branding': branding,
        'locales': {
            'default': tenant.get('default_language') or 'en-US',
            'available': tenant.get('active_languages') or ['en-US'],
        },
        'navigation': navigation,  # may be None → frontend uses Blueprint API default
        'modules': modules,
        'workflow_labels': workflow,
    }


# ── AUTHED: current tenant config ────────────────────────────────────────────
@router.get("/tenant/me")
def get_my_tenant(ctx: dict = Depends(get_tenant_context)):
    client = db()
    r = client.table('tenants').select('*').eq('id', ctx['tenant_id']).limit(1).execute()
    if not r.data:
        raise HTTPException(404, "Tenant not found")
    cfg = _enrich_tenant_config(client, r.data[0])
    cfg["impersonating"] = ctx.get("impersonating", False)
    return cfg


# ── Module registry resolved for current user ────────────────────────────────
@router.get("/modules")
def get_modules(ctx: dict = Depends(get_tenant_context)):
    """Returns the active module list for current tenant + user permissions filter."""
    client = db()
    enabled_ids = _get_setting(client, ctx['tenant_id'], 'modules.enabled', None) or default_enabled_modules()
    enabled_set = set(enabled_ids)
    user_perms = set(get_role_permissions(ctx.get('role')))

    modules = []
    for m in get_all_modules():
        if m['id'] not in enabled_set:
            continue
        # require_permissions: user must have at least one to see the module (or none required)
        req = m.get('requires_permissions') or []
        if req and not any(p in user_perms for p in req):
            continue
        # filter routes by per-route permissions
        routes = [r for r in (m.get('routes') or []) if not r.get('requires') or all(p in user_perms for p in r['requires'])]
        modules.append({**m, "routes": routes})
    return {"modules": modules, "enabled_ids": list(enabled_set)}


# ── Effective feature flags for current tenant ───────────────────────────────
@router.get("/feature-flags")
def get_feature_flags(ctx: dict = Depends(get_tenant_context)):
    client = db()
    overrides = _get_setting(client, ctx['tenant_id'], 'feature_flags', {}) or {}
    return {"flags": resolve_flags(overrides), "catalog": get_all_flags()}


# ── User capabilities (permissions resolved for client UI gating) ────────────
@router.get("/me/permissions")
def my_permissions(current_user: dict = Depends(get_current_user)):
    return {
        "role": current_user.get('role'),
        "permissions": get_role_permissions(current_user.get('role')),
        "is_super_admin": is_super_admin(current_user.get('role')),
    }


# ── Tenant settings CRUD ─────────────────────────────────────────────────────
@router.get("/settings")
def list_settings(current_user: dict = Depends(get_current_user)):
    client = db()
    r = client.table('tenant_settings').select('key, value_json, updated_at').eq('tenant_id', current_user['tenant_id']).execute()
    return {"data": r.data or []}


@router.put("/settings")
def upsert_setting(body: TenantSettingUpsert,
                   current_user: dict = Depends(require_roles('tenant_admin', 'super_admin', 'editor'))):
    client = db()
    _upsert_setting(client, current_user['tenant_id'], body.key, body.value_json)
    return {"message": "ok", "key": body.key}


# ── Default Blueprint navigation (Blueprint OS bootstrap) ────────────────────
DEFAULT_NAVIGATION = {
    "sections": [
        {"id": "main", "items": [
            {"to": "/dashboard", "icon": "LayoutDashboard", "labelKey": "nav.dashboard"},
        ]},
        {"id": "workspace", "labelKey": "nav.section.workspace", "items": [
            {"to": "/workspace/leads", "icon": "Users", "labelKey": "nav.leads"},
            {"to": "/workspace/projects", "icon": "FolderOpen", "labelKey": "nav.projects"},
            {"to": "/workspace/proposals", "icon": "FileText", "labelKey": "nav.proposals"},
        ]},
        {"id": "content", "labelKey": "nav.section.content", "items": [
            {"to": "/moodboards", "icon": "Layers", "labelKey": "nav.moodboards"},
            {"to": "/inspirations", "icon": "BookOpen", "labelKey": "nav.inspirations"},
        ]},
        {"id": "intelligence", "labelKey": "nav.section.intelligence", "items": [
            {"to": "/insights", "icon": "BarChart3", "labelKey": "nav.insights"},
        ]},
        {"id": "system", "labelKey": "nav.section.system", "items": [
            {"to": "/settings", "icon": "Settings", "labelKey": "nav.settings"},
        ]},
    ]
}


@router.get("/navigation")
def get_navigation(current_user: dict = Depends(get_current_user)):
    client = db()
    nav = _get_setting(client, current_user['tenant_id'], 'navigation', None)
    return nav or DEFAULT_NAVIGATION


# ── Dashboard widgets configuration (Blueprint-driven) ───────────────────────
DEFAULT_DASHBOARD = {
    "widgets": [
        {"id": "kpi-leads", "type": "kpi", "source": "/api/insights/dashboard", "metric": "leads.total",
         "labelKey": "dashboard.kpi.leads", "icon": "Users", "tone": "blue"},
        {"id": "kpi-projects", "type": "kpi", "source": "/api/insights/dashboard", "metric": "projects.total",
         "labelKey": "dashboard.kpi.projects", "icon": "FolderOpen", "tone": "purple"},
        {"id": "kpi-proposals", "type": "kpi", "source": "/api/insights/dashboard", "metric": "proposals.total",
         "labelKey": "dashboard.kpi.proposals", "icon": "FileText", "tone": "gold"},
        {"id": "kpi-moodboards", "type": "kpi", "source": "/api/insights/dashboard", "metric": "moodboards.total",
         "labelKey": "dashboard.kpi.moodboards", "icon": "Layers", "tone": "emerald"},
        {"id": "activity-feed", "type": "feed", "source": "/api/insights/activity",
         "labelKey": "dashboard.activity.title", "size": "wide"},
        {"id": "quick-actions", "type": "actions", "labelKey": "dashboard.quick_actions.title", "size": "narrow",
         "actions": [
            {"labelKey": "action.new_lead", "to": "/workspace/leads", "icon": "Users"},
            {"labelKey": "action.new_project", "to": "/workspace/projects", "icon": "FolderOpen"},
            {"labelKey": "action.new_proposal", "to": "/workspace/proposals", "icon": "FileText"},
            {"labelKey": "action.new_moodboard", "to": "/moodboards", "icon": "Layers"},
        ]},
    ]
}


@router.get("/dashboard")
def get_dashboard_config(current_user: dict = Depends(get_current_user)):
    client = db()
    cfg = _get_setting(client, current_user['tenant_id'], 'dashboard', None)
    return cfg or DEFAULT_DASHBOARD


# ── Locale strings (i18n) — Blueprint-driven, DB-overridable ─────────────────
# Default platform strings. Tenants can override via tenant_settings key='i18n.{locale}'
DEFAULT_I18N = {
    "en-US": {
        "common": {"loading": "Loading", "save": "Save", "cancel": "Cancel", "delete": "Delete",
                   "edit": "Edit", "search": "Search", "close": "Close", "new": "New", "actions": "Actions",
                   "all": "All", "noResults": "No results found", "logout": "Logout",
                   "welcome": "Welcome", "submit": "Submit", "back": "Back"},
        "nav": {"dashboard": "Dashboard", "leads": "Leads", "projects": "Projects",
                "proposals": "Proposals", "moodboards": "Moodboards", "inspirations": "Inspirations",
                "insights": "Insights", "settings": "Settings",
                "section.workspace": "Blueprint Workspace", "section.content": "Content",
                "section.intelligence": "Intelligence", "section.system": "System"},
        "auth": {"login.title": "Welcome back", "login.subtitle": "Sign in to your Blueprint workspace.",
                 "login.email": "Email", "login.password": "Password", "login.submit": "Sign in",
                 "login.forgot": "Forgot password?", "login.noAccount": "Don't have an account?",
                 "login.signup": "Create workspace", "login.tagline": "Timeless elegance.",
                 "login.taglineSub": "Blueprint OS™ for Design Excellence",
                 "signup.title": "Create your studio", "signup.subtitle": "Start your Blueprint workspace in seconds.",
                 "signup.firstName": "First name", "signup.lastName": "Last name",
                 "signup.company": "Studio name", "signup.submit": "Create workspace",
                 "signup.hasAccount": "Already have an account?", "signup.signin": "Sign in",
                 "forgot.title": "Reset password", "forgot.subtitle": "We'll send you a reset link.",
                 "forgot.submit": "Send reset link", "forgot.sent": "If the account exists, a reset email has been sent."},
        "dashboard": {"title": "Welcome", "kpi.leads": "Active Leads", "kpi.projects": "Projects",
                      "kpi.proposals": "Proposals", "kpi.moodboards": "Moodboards",
                      "activity.title": "Recent activity", "activity.empty": "No activity yet",
                      "quick_actions.title": "Quick actions"},
        "action": {"new_lead": "New Lead", "new_project": "New Project",
                   "new_proposal": "New Proposal", "new_moodboard": "New Moodboard"},
        "leads": {"title": "Leads", "newLead": "New Lead", "empty": "No leads found.",
                  "emptyCta": "Add your first lead",
                  "field.firstName": "First name", "field.lastName": "Last name",
                  "field.email": "Email", "field.phone": "Phone", "field.country": "Country",
                  "field.city": "City", "field.leadType": "Type", "field.projectType": "Project type",
                  "field.budget": "Budget", "field.timeline": "Timeline", "field.style": "Style preference",
                  "field.notes": "Notes", "field.status": "Status", "field.source": "Source",
                  "field.createdAt": "Created", "type.private_client": "Private Client",
                  "type.ad_partner": "A&D Partner",
                  "status.new": "New", "status.qualified": "Qualified", "status.not_qualified": "Not qualified",
                  "status.contacted": "Contacted", "status.project_opened": "Project opened",
                  "status.archived": "Archived"},
        "projects": {"title": "Projects", "newProject": "New Project", "empty": "No projects found",
                     "emptyCta": "Create your first project",
                     "field.title": "Project title", "field.description": "Description",
                     "field.projectType": "Project type", "field.status": "Status",
                     "field.priority": "Priority", "field.budget": "Budget", "field.timeline": "Timeline",
                     "count": "{n} projects",
                     "status.new": "New", "status.in_review": "In review",
                     "status.brief_completed": "Brief completed", "status.proposal_in_progress": "Proposal in progress",
                     "status.proposal_sent": "Proposal sent", "status.revision_requested": "Revision requested",
                     "status.approved": "Approved", "status.rejected": "Rejected",
                     "status.won": "Won", "status.lost": "Lost", "status.archived": "Archived"},
        "proposals": {"title": "Proposals", "empty": "No proposals yet"},
        "moodboards": {"title": "Moodboards", "subtitle": "Curated visual narratives for your projects.",
                       "empty": "No moodboards yet", "emptyCta": "Create your first moodboard",
                       "new": "New moodboard", "create.title": "New moodboard",
                       "create.titleLabel": "Title", "create.titlePh": "e.g. Living room — Atelier Milano",
                       "create.projectLabel": "Project (optional)", "create.projectPh": "Standalone",
                       "create.submit": "Create",
                       "untitled": "Untitled moodboard",
                       "filter.all": "All", "filter.draft": "Drafts", "filter.sent": "Sent",
                       "filter.viewed": "Viewed", "filter.approved": "Approved",
                       "filter.revision_requested": "Revision", "filter.rejected": "Rejected",
                       "status.draft": "Draft", "status.sent": "In review",
                       "status.viewed": "Viewed", "status.approved": "Approved",
                       "status.revision_requested": "Revision requested", "status.rejected": "Rejected",
                       "editor.back": "Back", "editor.saved": "Saved", "editor.saving": "Saving",
                       "editor.addBlock": "Add block", "editor.inspector": "Block inspector",
                       "editor.noInspector": "No inspector for this block type.",
                       "editor.sendReview": "Send for review", "editor.reject": "Reject",
                       "editor.approve": "Approve", "editor.requestRevision": "Request revision",
                       "editor.share": "Share",
                       "editor.saveFailed": "Save failed — click to retry",
                       "editor.layers": "Layers",
                       "editor.duplicate": "Duplicate",
                       "editor.bringForward": "Bring forward",
                       "editor.sendBackward": "Send backward",
                       "editor.bringToFront": "Bring to front",
                       "editor.sendToBack": "Send to back",
                       "editor.lock": "Lock",
                       "editor.unlock": "Unlock",
                       "editor.show": "Show",
                       "editor.hide": "Hide",
                       "editor.delete": "Delete",
                       "editor.upload": "Upload image",
                       "editor.uploading": "Uploading…",
                       "editor.uploadFailed": "Upload failed",
                       "editor.dropImage": "Drop image or click to upload",
                       "editor.present": "Present",
                       "editor.exitPresent": "Exit presentation",
                       "editor.undo": "Undo",
                       "editor.redo": "Redo",
                       "editor.snap": "Smart snap",
                       "editor.crop": "Crop & focal",
                       "field.fitMode": "Fit mode",
                       "field.fitMode.cover": "Cover",
                       "field.fitMode.contain": "Contain",
                       "field.fitMode.fill": "Fill",
                       "field.focalPoint": "Focal point",
                       "field.zoom": "Zoom",
                       "field.opacity": "Opacity",
                       "field.rotation": "Rotation",
                       "templates.title": "Templates",
                       "templates.eyebrow": "Quick start",
                       "templates.blank": "Blank canvas",
                       "templates.blankDesc": "Start from scratch with an empty canvas.",
                       "templates.startBlank": "Open",
                       "templates.tenantPreset": "Studio preset",
                       "templates.derivedFrom": "Derived from another template",
                       "templates.applyBtn": "Use template",
                       "templates.saveAs": "Save as template",
                       "templates.saveAsTitle": "Save current as template",
                       "templates.slug": "Slug (unique)",
                       "templates.category.luxury_editorial": "Luxury Editorial",
                       "templates.category.hospitality": "Hospitality",
                       "templates.category.residential": "Residential",
                       "templates.category.retail": "Retail",
                       "templates.category.materials_board": "Materials Board",
                       "templates.category.ff_e": "FF&E",
                       "templates.category.concept": "Concept",
                       "editor.openShare": "Open", "editor.shareTitle": "Send to client",
                       "editor.shareEyebrow": "Share link",
                       "block.image": "Image", "block.text": "Text", "block.palette": "Palette",
                       "block.note": "Note", "block.product": "Product", "block.material": "Material",
                       "field.imageUrl": "Image URL", "field.caption": "Caption",
                       "field.text": "Text", "field.size": "Size", "field.note": "Note",
                       "field.colors": "Colors (HEX)", "field.addColor": "Add color",
                       "field.name": "Name", "field.vendor": "Vendor", "field.price": "Price",
                       "field.finish": "Finish", "field.swatch": "Swatch URL",
                       "block.image.placeholder": "Add image URL in the inspector",
                       "block.text.placeholder": "Type your text…",
                       "block.note.placeholder": "Add a note…",
                       "block.product.placeholder": "Product image",
                       "tab.title": "Moodboards"},
        "workspace": {"tab.overview": "Overview", "tab.tasks": "Tasks", "tab.notes": "Notes",
                      "tab.moodboards": "Moodboards", "tab.activity": "Activity",
                      "tab.proposals": "Proposals", "tab.files": "Files",
                      "stat.budget": "Budget", "stat.timeline": "Timeline",
                      "stat.proposals": "Proposals", "stat.moodboards": "Moodboards",
                      "stat.files": "Files", "stat.status": "Status",
                      "tasks.placeholder": "Add a task…", "tasks.add": "Add",
                      "tasks.empty": "No tasks yet.",
                      "notes.placeholder": "Write a note…", "notes.add": "Add note",
                      "notes.empty": "No notes yet.", "notes.pinned": "Pinned",
                      "activity.empty": "No activity yet.",
                      "moodboards.empty": "No moodboards yet.",
                      "lead.convert": "Convert to project",
                      "back.projects": "Projects",
                      "back.leads": "Leads"},
        "inspirations": {"title": "Inspirations", "empty": "No articles yet"},
        "insights": {"title": "Insights"},
        "settings": {"title": "Settings", "branding": "Branding", "locale": "Locale & Languages",
                     "team": "Team",
                     "brand.title": "Brand Studio", "brand.sub": "Theme engine — palette, typography, shape, motion, brand assets.",
                     "pages.title": "Pages Builder", "pages.sub": "Compose homepage, showcase and editorial pages with Blueprint Sections.",
                     "domains.title": "Domains", "domains.sub": "Connect custom domains and subdomains to your workspace.",
                     "locales.sub": "Manage default language and active locales for your studio.",
                     "team.sub": "Invite collaborators and manage roles & permissions."},
        "brandStudio": {"header": "Tenant · Brand Studio", "title": "Theme Engine",
                        "tab.palette": "Palette", "tab.typography": "Typography",
                        "tab.shape": "Shape", "tab.motion": "Motion", "tab.assets": "Assets",
                        "preview": "Live Preview", "presets": "Presets"},
        "domains": {"title": "Domains", "subtitle": "Connect a custom domain or use a Blueprint subdomain for your workspace.",
                    "add": "Add domain", "makePrimary": "Set as primary", "empty": "No domains yet."},
        "admin": {"nav.overview": "Overview", "nav.tenants": "Tenants", "nav.modules": "Modules",
                  "nav.audit": "Audit log", "exit": "Exit to workspace",
                  "overview.title": "Platform Overview",
                  "overview.subtitle": "Real-time intelligence across every tenant on the platform.",
                  "stats.tenants": "Tenants", "stats.users": "Users", "stats.leads": "Leads",
                  "stats.projects": "Projects", "stats.proposals": "Proposals",
                  "stats.moodboards": "Moodboards", "stats.magazine": "Articles",
                  "stats.suspended": "Suspended",
                  "tenants.title": "Tenants", "tenants.new": "New tenant",
                  "tenants.totalSub": "across the platform", "tenants.empty": "No tenants yet",
                  "modules.title": "Module Registry",
                  "modules.sub": "The platform-wide Blueprint module catalog. Activate per tenant from the tenant detail.",
                  "audit.title": "Audit Log",
                  "detail.statusPlan": "Status & Plan", "detail.modules": "Modules",
                  "detail.flags": "Feature Flags", "detail.members": "Members",
                  "impersonate": "Impersonate", "saved": "Saved"},
        "nav.superAdmin": "Super Admin", "nav.section.platform": "Platform",
        "impersonation.active": "Impersonating", "impersonation.stop": "Exit",
        "module.workspace": "Workspace", "module.moodboards": "Moodboards",
        "module.inspirations": "Inspirations", "module.insights": "Insights",
        "module.concierge": "Concierge",
        "form": {"required": "Required", "invalid_email": "Invalid email",
                 "password_min": "Password must be at least 8 characters"},
        "brand": {"name": "MOOD for DESIGN", "tagline": "A Blueprint OS™ Platform"},
    }
}

# Italian translations (default content for IT locale)
DEFAULT_I18N["it"] = {
    "common": {"loading": "Caricamento", "save": "Salva", "cancel": "Annulla", "delete": "Elimina",
               "edit": "Modifica", "search": "Cerca", "close": "Chiudi", "new": "Nuovo", "actions": "Azioni",
               "all": "Tutti", "noResults": "Nessun risultato", "logout": "Esci",
               "welcome": "Benvenuto", "submit": "Invia", "back": "Indietro"},
    "nav": {"dashboard": "Dashboard", "leads": "Lead", "projects": "Progetti",
            "proposals": "Proposte", "moodboards": "Moodboard", "inspirations": "Ispirazioni",
            "insights": "Analytics", "settings": "Impostazioni",
            "section.workspace": "Blueprint Workspace", "section.content": "Contenuti",
            "section.intelligence": "Intelligenza", "section.system": "Sistema"},
    "auth": {"login.title": "Bentornato", "login.subtitle": "Accedi al tuo workspace Blueprint.",
             "login.email": "Email", "login.password": "Password", "login.submit": "Accedi",
             "login.forgot": "Password dimenticata?", "login.noAccount": "Non hai un account?",
             "login.signup": "Crea workspace", "login.tagline": "Eleganza senza tempo.",
             "login.taglineSub": "Blueprint OS™ per l'eccellenza del design",
             "signup.title": "Crea il tuo studio", "signup.subtitle": "Avvia il tuo workspace Blueprint in pochi secondi.",
             "signup.firstName": "Nome", "signup.lastName": "Cognome",
             "signup.company": "Nome dello studio", "signup.submit": "Crea workspace",
             "signup.hasAccount": "Hai già un account?", "signup.signin": "Accedi",
             "forgot.title": "Reimposta password", "forgot.subtitle": "Ti invieremo un link.",
             "forgot.submit": "Invia link", "forgot.sent": "Se l'account esiste, riceverai una email."},
    "dashboard": {"title": "Benvenuto", "kpi.leads": "Lead Attivi", "kpi.projects": "Progetti",
                  "kpi.proposals": "Proposte", "kpi.moodboards": "Moodboard",
                  "activity.title": "Attività recente", "activity.empty": "Nessuna attività",
                  "quick_actions.title": "Azioni rapide"},
    "action": {"new_lead": "Nuovo Lead", "new_project": "Nuovo Progetto",
               "new_proposal": "Nuova Proposta", "new_moodboard": "Nuovo Moodboard"},
    "leads": {"title": "Lead", "newLead": "Nuovo Lead", "empty": "Nessun lead trovato.",
              "emptyCta": "Aggiungi il primo lead",
              "field.firstName": "Nome", "field.lastName": "Cognome",
              "field.email": "Email", "field.phone": "Telefono", "field.country": "Paese",
              "field.city": "Città", "field.leadType": "Tipo", "field.projectType": "Tipo progetto",
              "field.budget": "Budget", "field.timeline": "Tempistica", "field.style": "Stile preferito",
              "field.notes": "Note", "field.status": "Stato", "field.source": "Fonte",
              "field.createdAt": "Creato", "type.private_client": "Cliente Privato",
              "type.ad_partner": "Partner A&D",
              "status.new": "Nuovo", "status.qualified": "Qualificato", "status.not_qualified": "Non qualificato",
              "status.contacted": "Contattato", "status.project_opened": "Progetto aperto",
              "status.archived": "Archiviato"},
    "projects": {"title": "Progetti", "newProject": "Nuovo Progetto", "empty": "Nessun progetto",
                 "emptyCta": "Crea il primo progetto",
                 "field.title": "Titolo progetto", "field.description": "Descrizione",
                 "field.projectType": "Tipologia", "field.status": "Stato",
                 "field.priority": "Priorità", "field.budget": "Budget", "field.timeline": "Tempistica",
                 "count": "{n} progetti",
                 "status.new": "Nuovo", "status.in_review": "In revisione",
                 "status.brief_completed": "Brief completato", "status.proposal_in_progress": "Proposta in corso",
                 "status.proposal_sent": "Proposta inviata", "status.revision_requested": "Revisione richiesta",
                 "status.approved": "Approvato", "status.rejected": "Rifiutato",
                 "status.won": "Vinto", "status.lost": "Perso", "status.archived": "Archiviato"},
    "proposals": {"title": "Proposte", "empty": "Nessuna proposta"},
    "moodboards": {"title": "Moodboard", "subtitle": "Narrazioni visive curate per i tuoi progetti.",
                   "empty": "Nessun moodboard", "emptyCta": "Crea il primo moodboard",
                   "new": "Nuovo moodboard", "create.title": "Nuovo moodboard",
                   "create.titleLabel": "Titolo", "create.titlePh": "es. Soggiorno — Atelier Milano",
                   "create.projectLabel": "Progetto (opzionale)", "create.projectPh": "Standalone",
                   "create.submit": "Crea",
                   "untitled": "Moodboard senza titolo",
                   "filter.all": "Tutti", "filter.draft": "Bozze", "filter.sent": "Inviati",
                   "filter.viewed": "Visti", "filter.approved": "Approvati",
                   "filter.revision_requested": "Revisione", "filter.rejected": "Rifiutati",
                   "status.draft": "Bozza", "status.sent": "In revisione",
                   "status.viewed": "Visto", "status.approved": "Approvato",
                   "status.revision_requested": "Revisione richiesta", "status.rejected": "Rifiutato",
                   "editor.back": "Indietro", "editor.saved": "Salvato", "editor.saving": "Salvataggio",
                   "editor.addBlock": "Aggiungi blocco", "editor.inspector": "Ispettore blocco",
                   "editor.noInspector": "Nessun ispettore per questo tipo di blocco.",
                   "editor.sendReview": "Invia in revisione", "editor.reject": "Rifiuta",
                   "editor.approve": "Approva", "editor.requestRevision": "Richiedi revisione",
                   "editor.share": "Condividi",
                   "editor.saveFailed": "Salvataggio fallito — riprova",
                   "editor.layers": "Livelli",
                   "editor.duplicate": "Duplica",
                   "editor.bringForward": "Porta avanti",
                   "editor.sendBackward": "Porta indietro",
                   "editor.bringToFront": "Porta in primo piano",
                   "editor.sendToBack": "Porta sullo sfondo",
                   "editor.lock": "Blocca",
                   "editor.unlock": "Sblocca",
                   "editor.show": "Mostra",
                   "editor.hide": "Nascondi",
                   "editor.delete": "Elimina",
                   "editor.upload": "Carica immagine",
                   "editor.uploading": "Caricamento…",
                   "editor.uploadFailed": "Caricamento fallito",
                   "editor.dropImage": "Trascina un'immagine o clicca per caricare",
                   "editor.present": "Presenta",
                   "editor.exitPresent": "Esci dalla presentazione",
                   "editor.undo": "Annulla",
                   "editor.redo": "Ripeti",
                   "editor.snap": "Snap intelligente",
                   "editor.crop": "Ritaglio e focal point",
                   "field.fitMode": "Modalità adattamento",
                   "field.fitMode.cover": "Riempi",
                   "field.fitMode.contain": "Adatta",
                   "field.fitMode.fill": "Distorci",
                   "field.focalPoint": "Punto focale",
                   "field.zoom": "Zoom",
                   "field.opacity": "Opacità",
                   "field.rotation": "Rotazione",
                   "templates.title": "Template",
                   "templates.eyebrow": "Avvio rapido",
                   "templates.blank": "Tela vuota",
                   "templates.blankDesc": "Parti da zero con una tela vuota.",
                   "templates.startBlank": "Apri",
                   "templates.tenantPreset": "Preset dello studio",
                   "templates.derivedFrom": "Derivato da un altro template",
                   "templates.applyBtn": "Usa template",
                   "templates.saveAs": "Salva come template",
                   "templates.saveAsTitle": "Salva il moodboard come template",
                   "templates.slug": "Slug (unico)",
                   "templates.category.luxury_editorial": "Editoriale di Lusso",
                   "templates.category.hospitality": "Ospitalità",
                   "templates.category.residential": "Residenziale",
                   "templates.category.retail": "Retail",
                   "templates.category.materials_board": "Materiali",
                   "templates.category.ff_e": "FF&E",
                   "templates.category.concept": "Concept",
                   "editor.openShare": "Apri", "editor.shareTitle": "Invia al cliente",
                   "editor.shareEyebrow": "Link di condivisione",
                   "block.image": "Immagine", "block.text": "Testo", "block.palette": "Palette",
                   "block.note": "Nota", "block.product": "Prodotto", "block.material": "Materiale",
                   "field.imageUrl": "URL immagine", "field.caption": "Didascalia",
                   "field.text": "Testo", "field.size": "Dimensione", "field.note": "Nota",
                   "field.colors": "Colori (HEX)", "field.addColor": "Aggiungi colore",
                   "field.name": "Nome", "field.vendor": "Fornitore", "field.price": "Prezzo",
                   "field.finish": "Finitura", "field.swatch": "URL campione",
                   "block.image.placeholder": "Aggiungi l'URL dell'immagine nell'ispettore",
                   "block.text.placeholder": "Scrivi il tuo testo…",
                   "block.note.placeholder": "Aggiungi una nota…",
                   "block.product.placeholder": "Immagine prodotto",
                   "tab.title": "Moodboard"},
    "workspace": {"tab.overview": "Panoramica", "tab.tasks": "Attività", "tab.notes": "Note",
                  "tab.moodboards": "Moodboard", "tab.activity": "Diario",
                  "tab.proposals": "Proposte", "tab.files": "File",
                  "stat.budget": "Budget", "stat.timeline": "Tempistica",
                  "stat.proposals": "Proposte", "stat.moodboards": "Moodboard",
                  "stat.files": "File", "stat.status": "Stato",
                  "tasks.placeholder": "Aggiungi un'attività…", "tasks.add": "Aggiungi",
                  "tasks.empty": "Nessuna attività.",
                  "notes.placeholder": "Scrivi una nota…", "notes.add": "Aggiungi nota",
                  "notes.empty": "Nessuna nota.", "notes.pinned": "Fissato",
                  "activity.empty": "Nessuna attività registrata.",
                  "moodboards.empty": "Nessun moodboard.",
                  "lead.convert": "Converti in progetto",
                  "back.projects": "Progetti",
                  "back.leads": "Lead"},
    "inspirations": {"title": "Ispirazioni", "empty": "Nessun articolo"},
    "insights": {"title": "Analytics"},
    "settings": {"title": "Impostazioni", "branding": "Branding", "locale": "Lingue e Locale",
                 "team": "Team",
                 "brand.title": "Brand Studio", "brand.sub": "Theme engine — palette, tipografia, forma, motion, asset di brand.",
                 "pages.title": "Costruttore Pagine", "pages.sub": "Componi homepage, showcase e pagine editoriali con Blueprint Sections.",
                 "domains.title": "Domini", "domains.sub": "Connetti domini personalizzati al tuo workspace."},
    "admin": {"nav.overview": "Panoramica", "nav.tenants": "Tenant", "nav.modules": "Moduli",
              "nav.audit": "Audit log", "exit": "Esci dal workspace",
              "overview.title": "Panoramica Piattaforma",
              "overview.subtitle": "Intelligence real-time su ogni tenant della piattaforma.",
              "stats.tenants": "Tenant", "stats.users": "Utenti", "stats.leads": "Lead",
              "stats.projects": "Progetti", "stats.proposals": "Proposte",
              "stats.moodboards": "Moodboard", "stats.magazine": "Articoli",
              "stats.suspended": "Sospesi",
              "tenants.title": "Tenant", "tenants.new": "Nuovo tenant",
              "tenants.totalSub": "sulla piattaforma", "tenants.empty": "Nessun tenant",
              "modules.title": "Registro Moduli",
              "modules.sub": "Catalogo Blueprint dei moduli della piattaforma. Attiva per tenant dal dettaglio.",
              "audit.title": "Audit Log",
              "detail.statusPlan": "Stato e Piano", "detail.modules": "Moduli",
              "detail.flags": "Feature Flag", "detail.members": "Membri",
              "impersonate": "Impersona", "saved": "Salvato"},
    "nav.superAdmin": "Super Admin", "nav.section.platform": "Piattaforma",
    "impersonation.active": "Impersoning", "impersonation.stop": "Esci",
    "module.workspace": "Workspace", "module.moodboards": "Moodboard",
    "module.inspirations": "Inspirations", "module.insights": "Insights",
    "module.concierge": "Concierge",
    "form": {"required": "Campo richiesto", "invalid_email": "Email non valida",
             "password_min": "La password deve avere almeno 8 caratteri"},
    "brand": {"name": "MOOD for DESIGN", "tagline": "A Blueprint OS™ Platform"},
}

# British English — overrides for regional vocabulary
DEFAULT_I18N["en-GB"] = {
    **{k: v for k, v in DEFAULT_I18N["en-US"].items()},
    "leads": {**DEFAULT_I18N["en-US"]["leads"],
              "field.projectType": "Project enquiry type"},
    "auth": {**DEFAULT_I18N["en-US"]["auth"], "signup.company": "Practice name"},
}
# French
DEFAULT_I18N["fr"] = {
    "common": {"loading": "Chargement", "save": "Enregistrer", "cancel": "Annuler", "delete": "Supprimer",
               "edit": "Modifier", "search": "Rechercher", "close": "Fermer", "new": "Nouveau", "actions": "Actions",
               "all": "Tous", "noResults": "Aucun résultat", "logout": "Déconnexion",
               "welcome": "Bienvenue", "submit": "Envoyer", "back": "Retour"},
    "nav": {"dashboard": "Tableau de bord", "leads": "Prospects", "projects": "Projets",
            "proposals": "Propositions", "moodboards": "Moodboards", "inspirations": "Inspirations",
            "insights": "Analyses", "settings": "Réglages",
            "section.workspace": "Blueprint Workspace", "section.content": "Contenu",
            "section.intelligence": "Intelligence", "section.system": "Système"},
    "auth": {"login.title": "Bon retour", "login.subtitle": "Accédez à votre Blueprint.",
             "login.email": "Email", "login.password": "Mot de passe", "login.submit": "Se connecter",
             "login.forgot": "Mot de passe oublié ?", "login.noAccount": "Pas de compte ?",
             "login.signup": "Créer un espace", "login.tagline": "L'élégance intemporelle.",
             "login.taglineSub": "Blueprint OS™ pour l'excellence du design",
             "signup.title": "Créez votre studio", "signup.subtitle": "Démarrez en quelques secondes.",
             "signup.firstName": "Prénom", "signup.lastName": "Nom",
             "signup.company": "Nom du studio", "signup.submit": "Créer",
             "signup.hasAccount": "Déjà un compte ?", "signup.signin": "Se connecter",
             "forgot.title": "Réinitialiser", "forgot.subtitle": "Nous enverrons un lien.",
             "forgot.submit": "Envoyer", "forgot.sent": "Email envoyé si le compte existe."},
    "dashboard": {"title": "Bienvenue", "kpi.leads": "Prospects actifs", "kpi.projects": "Projets",
                  "kpi.proposals": "Propositions", "kpi.moodboards": "Moodboards",
                  "activity.title": "Activité récente", "activity.empty": "Aucune activité",
                  "quick_actions.title": "Actions rapides"},
    "action": {"new_lead": "Nouveau prospect", "new_project": "Nouveau projet",
               "new_proposal": "Nouvelle proposition", "new_moodboard": "Nouveau moodboard"},
    "leads": {"title": "Prospects", "newLead": "Nouveau", "empty": "Aucun prospect.",
              "emptyCta": "Ajouter le premier",
              "field.firstName": "Prénom", "field.lastName": "Nom", "field.email": "Email",
              "field.phone": "Téléphone", "field.country": "Pays", "field.city": "Ville",
              "field.leadType": "Type", "field.projectType": "Type de projet",
              "field.budget": "Budget", "field.timeline": "Délai", "field.style": "Style",
              "field.notes": "Notes", "field.status": "Statut", "field.source": "Source",
              "field.createdAt": "Créé",
              "type.private_client": "Client privé", "type.ad_partner": "Partenaire A&D",
              "status.new": "Nouveau", "status.qualified": "Qualifié", "status.not_qualified": "Non qualifié",
              "status.contacted": "Contacté", "status.project_opened": "Projet ouvert", "status.archived": "Archivé"},
    "projects": {"title": "Projets", "newProject": "Nouveau projet", "empty": "Aucun projet",
                 "emptyCta": "Créer", "count": "{n} projets",
                 "field.title": "Titre", "field.description": "Description",
                 "field.projectType": "Type", "field.status": "Statut", "field.priority": "Priorité",
                 "field.budget": "Budget", "field.timeline": "Délai",
                 "status.new": "Nouveau", "status.in_review": "En revue",
                 "status.brief_completed": "Brief terminé", "status.proposal_in_progress": "Proposition en cours",
                 "status.proposal_sent": "Proposition envoyée", "status.revision_requested": "Révision demandée",
                 "status.approved": "Approuvé", "status.rejected": "Rejeté",
                 "status.won": "Gagné", "status.lost": "Perdu", "status.archived": "Archivé"},
    "proposals": {"title": "Propositions", "empty": "Aucune proposition"},
    "moodboards": {"title": "Moodboards", "empty": "Aucun moodboard"},
    "inspirations": {"title": "Inspirations", "empty": "Aucun article"},
    "insights": {"title": "Analyses"},
    "settings": {"title": "Réglages", "branding": "Identité", "locale": "Langues", "team": "Équipe"},
    "form": {"required": "Requis", "invalid_email": "Email invalide",
             "password_min": "Au moins 8 caractères"},
    "brand": {"name": "MOOD for DESIGN", "tagline": "A Blueprint OS™ Platform"},
}
# German
DEFAULT_I18N["de"] = {
    "common": {"loading": "Lädt", "save": "Speichern", "cancel": "Abbrechen", "delete": "Löschen",
               "edit": "Bearbeiten", "search": "Suchen", "close": "Schließen", "new": "Neu", "actions": "Aktionen",
               "all": "Alle", "noResults": "Keine Ergebnisse", "logout": "Abmelden",
               "welcome": "Willkommen", "submit": "Senden", "back": "Zurück"},
    "nav": {"dashboard": "Dashboard", "leads": "Leads", "projects": "Projekte",
            "proposals": "Angebote", "moodboards": "Moodboards", "inspirations": "Inspirationen",
            "insights": "Analyse", "settings": "Einstellungen",
            "section.workspace": "Blueprint Workspace", "section.content": "Inhalte",
            "section.intelligence": "Intelligence", "section.system": "System"},
    "auth": {"login.title": "Willkommen zurück", "login.subtitle": "Melden Sie sich an.",
             "login.email": "E-Mail", "login.password": "Passwort", "login.submit": "Anmelden",
             "login.forgot": "Passwort vergessen?", "login.noAccount": "Kein Konto?",
             "login.signup": "Workspace erstellen", "login.tagline": "Zeitlose Eleganz.",
             "login.taglineSub": "Blueprint OS™ für Design-Exzellenz",
             "signup.title": "Studio erstellen", "signup.subtitle": "In Sekunden starten.",
             "signup.firstName": "Vorname", "signup.lastName": "Nachname",
             "signup.company": "Studio-Name", "signup.submit": "Erstellen",
             "signup.hasAccount": "Bereits ein Konto?", "signup.signin": "Anmelden",
             "forgot.title": "Passwort zurücksetzen", "forgot.subtitle": "Wir senden einen Link.",
             "forgot.submit": "Senden", "forgot.sent": "E-Mail gesendet, falls das Konto existiert."},
    "dashboard": {"title": "Willkommen", "kpi.leads": "Aktive Leads", "kpi.projects": "Projekte",
                  "kpi.proposals": "Angebote", "kpi.moodboards": "Moodboards",
                  "activity.title": "Aktivität", "activity.empty": "Keine Aktivität",
                  "quick_actions.title": "Schnellaktionen"},
    "action": {"new_lead": "Neuer Lead", "new_project": "Neues Projekt",
               "new_proposal": "Neues Angebot", "new_moodboard": "Neues Moodboard"},
    "leads": {"title": "Leads", "newLead": "Neu", "empty": "Keine Leads.", "emptyCta": "Ersten hinzufügen",
              "field.firstName": "Vorname", "field.lastName": "Nachname", "field.email": "E-Mail",
              "field.phone": "Telefon", "field.country": "Land", "field.city": "Stadt",
              "field.leadType": "Typ", "field.projectType": "Projekttyp",
              "field.budget": "Budget", "field.timeline": "Zeitplan", "field.style": "Stil",
              "field.notes": "Notizen", "field.status": "Status", "field.source": "Quelle",
              "field.createdAt": "Erstellt", "type.private_client": "Privatkunde",
              "type.ad_partner": "A&D Partner",
              "status.new": "Neu", "status.qualified": "Qualifiziert", "status.not_qualified": "Nicht qualifiziert",
              "status.contacted": "Kontaktiert", "status.project_opened": "Projekt eröffnet",
              "status.archived": "Archiviert"},
    "projects": {"title": "Projekte", "newProject": "Neues Projekt", "empty": "Keine Projekte",
                 "emptyCta": "Erstellen", "count": "{n} Projekte",
                 "field.title": "Titel", "field.description": "Beschreibung",
                 "field.projectType": "Typ", "field.status": "Status", "field.priority": "Priorität",
                 "field.budget": "Budget", "field.timeline": "Zeitplan",
                 "status.new": "Neu", "status.in_review": "Prüfung",
                 "status.brief_completed": "Brief fertig", "status.proposal_in_progress": "Angebot läuft",
                 "status.proposal_sent": "Angebot gesendet", "status.revision_requested": "Revision angefragt",
                 "status.approved": "Genehmigt", "status.rejected": "Abgelehnt",
                 "status.won": "Gewonnen", "status.lost": "Verloren", "status.archived": "Archiviert"},
    "proposals": {"title": "Angebote", "empty": "Keine Angebote"},
    "moodboards": {"title": "Moodboards", "empty": "Keine Moodboards"},
    "inspirations": {"title": "Inspirationen", "empty": "Keine Artikel"},
    "insights": {"title": "Analyse"},
    "settings": {"title": "Einstellungen", "branding": "Branding", "locale": "Sprachen", "team": "Team"},
    "form": {"required": "Pflichtfeld", "invalid_email": "Ungültige E-Mail",
             "password_min": "Mindestens 8 Zeichen"},
    "brand": {"name": "MOOD for DESIGN", "tagline": "A Blueprint OS™ Platform"},
}
# Spanish
DEFAULT_I18N["es"] = {
    "common": {"loading": "Cargando", "save": "Guardar", "cancel": "Cancelar", "delete": "Eliminar",
               "edit": "Editar", "search": "Buscar", "close": "Cerrar", "new": "Nuevo", "actions": "Acciones",
               "all": "Todos", "noResults": "Sin resultados", "logout": "Cerrar sesión",
               "welcome": "Bienvenido", "submit": "Enviar", "back": "Volver"},
    "nav": {"dashboard": "Panel", "leads": "Leads", "projects": "Proyectos",
            "proposals": "Propuestas", "moodboards": "Moodboards", "inspirations": "Inspiraciones",
            "insights": "Análisis", "settings": "Ajustes",
            "section.workspace": "Blueprint Workspace", "section.content": "Contenido",
            "section.intelligence": "Inteligencia", "section.system": "Sistema"},
    "auth": {"login.title": "Bienvenido de nuevo", "login.subtitle": "Accede a tu workspace.",
             "login.email": "Email", "login.password": "Contraseña", "login.submit": "Acceder",
             "login.forgot": "¿Olvidaste tu contraseña?", "login.noAccount": "¿No tienes cuenta?",
             "login.signup": "Crear workspace", "login.tagline": "Elegancia atemporal.",
             "login.taglineSub": "Blueprint OS™ para la excelencia del diseño",
             "signup.title": "Crea tu estudio", "signup.subtitle": "Empieza en segundos.",
             "signup.firstName": "Nombre", "signup.lastName": "Apellido",
             "signup.company": "Nombre del estudio", "signup.submit": "Crear",
             "signup.hasAccount": "¿Ya tienes cuenta?", "signup.signin": "Acceder",
             "forgot.title": "Restablecer", "forgot.subtitle": "Enviaremos un enlace.",
             "forgot.submit": "Enviar", "forgot.sent": "Email enviado si la cuenta existe."},
    "dashboard": {"title": "Bienvenido", "kpi.leads": "Leads activos", "kpi.projects": "Proyectos",
                  "kpi.proposals": "Propuestas", "kpi.moodboards": "Moodboards",
                  "activity.title": "Actividad reciente", "activity.empty": "Sin actividad",
                  "quick_actions.title": "Acciones rápidas"},
    "action": {"new_lead": "Nuevo lead", "new_project": "Nuevo proyecto",
               "new_proposal": "Nueva propuesta", "new_moodboard": "Nuevo moodboard"},
    "leads": {"title": "Leads", "newLead": "Nuevo", "empty": "Sin leads.", "emptyCta": "Añadir el primero",
              "field.firstName": "Nombre", "field.lastName": "Apellido", "field.email": "Email",
              "field.phone": "Teléfono", "field.country": "País", "field.city": "Ciudad",
              "field.leadType": "Tipo", "field.projectType": "Tipo de proyecto",
              "field.budget": "Presupuesto", "field.timeline": "Plazo", "field.style": "Estilo",
              "field.notes": "Notas", "field.status": "Estado", "field.source": "Fuente",
              "field.createdAt": "Creado", "type.private_client": "Cliente privado",
              "type.ad_partner": "Partner A&D",
              "status.new": "Nuevo", "status.qualified": "Cualificado", "status.not_qualified": "No cualificado",
              "status.contacted": "Contactado", "status.project_opened": "Proyecto abierto",
              "status.archived": "Archivado"},
    "projects": {"title": "Proyectos", "newProject": "Nuevo proyecto", "empty": "Sin proyectos",
                 "emptyCta": "Crear", "count": "{n} proyectos",
                 "field.title": "Título", "field.description": "Descripción",
                 "field.projectType": "Tipo", "field.status": "Estado", "field.priority": "Prioridad",
                 "field.budget": "Presupuesto", "field.timeline": "Plazo",
                 "status.new": "Nuevo", "status.in_review": "En revisión",
                 "status.brief_completed": "Brief completado", "status.proposal_in_progress": "Propuesta en curso",
                 "status.proposal_sent": "Propuesta enviada", "status.revision_requested": "Revisión solicitada",
                 "status.approved": "Aprobado", "status.rejected": "Rechazado",
                 "status.won": "Ganado", "status.lost": "Perdido", "status.archived": "Archivado"},
    "proposals": {"title": "Propuestas", "empty": "Sin propuestas"},
    "moodboards": {"title": "Moodboards", "empty": "Sin moodboards"},
    "inspirations": {"title": "Inspiraciones", "empty": "Sin artículos"},
    "insights": {"title": "Análisis"},
    "settings": {"title": "Ajustes", "branding": "Branding", "locale": "Idiomas", "team": "Equipo"},
    "form": {"required": "Campo obligatorio", "invalid_email": "Email no válido",
             "password_min": "Mínimo 8 caracteres"},
    "brand": {"name": "MOOD for DESIGN", "tagline": "A Blueprint OS™ Platform"},
}

LOCALE_FALLBACK = "en-US"


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _flatten(d: dict, prefix: str = "") -> dict:
    """Flatten nested dict to dotted keys."""
    out = {}
    for k, v in d.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(_flatten(v, key + "."))
        else:
            out[key] = v
    return out


@router.get("/i18n/{locale}")
def get_locale_strings(
    locale: str,
    tenant_slug: str = Query(None),
):
    """Returns flattened translation map for a locale.
    Optionally tenant-specific overrides if tenant_slug is provided (or via auth)."""
    base = DEFAULT_I18N.get(locale) or DEFAULT_I18N.get(LOCALE_FALLBACK, {})

    overrides = {}
    if db_available() and tenant_slug:
        client = db()
        t = client.table('tenants').select('id').eq('slug', tenant_slug).limit(1).execute()
        if t.data:
            ov = _get_setting(client, t.data[0]['id'], f'i18n.{locale}', None)
            if ov:
                overrides = ov

    merged = _deep_merge(base, overrides)
    return {
        "locale": locale,
        "fallback": LOCALE_FALLBACK if locale not in DEFAULT_I18N else None,
        "messages": _flatten(merged),
    }


@router.get("/i18n")
def list_locales():
    """Returns available platform locales."""
    return {
        "locales": [
            {"code": "en-US", "label": "English (US)", "native": "English (US)"},
            {"code": "en-GB", "label": "English (UK)", "native": "English (UK)"},
            {"code": "it", "label": "Italian", "native": "Italiano"},
            {"code": "fr", "label": "French", "native": "Français"},
            {"code": "de", "label": "German", "native": "Deutsch"},
            {"code": "es", "label": "Spanish", "native": "Español"},
        ],
        "default": LOCALE_FALLBACK,
    }
