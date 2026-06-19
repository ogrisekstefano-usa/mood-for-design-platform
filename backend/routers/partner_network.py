"""PARTNER NETWORK SPRINT — Fase 3, 5, 6.

Endpoints
─────────
PUBLIC (anonymous):
  POST /api/partner/apply
       Salva la candidatura come leads.lead_type = 'partner_application'

AUTHENTICATED (studio team):
  GET  /api/partner-network/partners          lista partner filtrata per status
  PATCH /api/partner-network/partners/{id}/status   transizione stato
  GET  /api/partner-network/journeys          lista DJ disponibili per assegnazione
  POST /api/partner-network/partners/{id}/assign    assegna partner a DJ come contributor
  DELETE /api/partner-network/partners/{id}/assignment/{journey_id}   rimuove da DJ

Regole architetturali:
  - Un partner NON crea account, contact, project, auth.user
  - leads.lead_type = 'partner_application' è la Source of Truth pre-approvazione
  - users_profile.role = 'ad_partner' è la Source of Truth post-invito
  - design_journey_assignments.assignment_role = 'contributor' per partecipazione DJ
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, validator

from core.permissions import P_LEADS_READ, P_LEADS_WRITE, P_PROJECTS_READ
from core.tenant_context import require_permission
from core.journey_assignments import add_assignment, revoke_assignment, ROLE_CONTRIBUTOR
from database import db

router = APIRouter()
log = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Pydantic models ──────────────────────────────────────────────────────────

class PartnerApplyBody(BaseModel):
    """Campi del form /partner-application (pubblico)."""
    tenant_slug: str
    first_name: str
    last_name: str
    company_name: str
    email: str
    phone: Optional[str] = None
    professional_category: Optional[str] = None
    company_website: Optional[str] = None
    portfolio_url: Optional[str] = None
    territory: Optional[str] = None
    collaboration_intent: Optional[str] = None
    notes: Optional[str] = None
    # Campi opzionali in metadata_json
    instagram_url: Optional[str] = None
    linkedin_url: Optional[str] = None

    @validator('first_name', 'last_name', 'company_name', 'email')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Campo obbligatorio')
        return v.strip()


class PartnerStatusBody(BaseModel):
    status: str  # applied | review | approved | active | archived

    @validator('status')
    def valid_status(cls, v):
        allowed = {'applied', 'review', 'approved', 'active', 'archived'}
        if v not in allowed:
            raise ValueError(f'Status deve essere uno di: {allowed}')
        return v


class PartnerAssignBody(BaseModel):
    journey_id: str
    notes: Optional[str] = None


# ─── FASE 3 — Endpoint pubblico: salva candidatura ────────────────────────────

@router.post("/partner/apply", status_code=201, tags=["partner-network"])
def partner_apply(body: PartnerApplyBody):
    """
    Ricezione candidatura pubblica da /partner-application.

    Crea ESCLUSIVAMENTE: leads.lead_type = 'partner_application'
    NON crea: account, contact, project, design_journey, auth.user
    """
    client = db()

    # Risolvi tenant_id dallo slug
    t_res = client.table('tenants').select('id').eq('slug', body.tenant_slug).limit(1).execute()
    if not t_res.data:
        raise HTTPException(404, "Studio non trovato")
    tenant_id = t_res.data[0]['id']

    # Deduplicazione soft: se esiste già una candidatura attiva da questa email, aggiorna
    existing = (client.table('leads')
                .select('id, progression_state, metadata_json')
                .eq('tenant_id', tenant_id)
                .eq('email', body.email.lower().strip())
                .eq('lead_type', 'partner_studio')
                .limit(1)
                .execute())

    metadata = {}
    if body.instagram_url:
        metadata['instagram_url'] = body.instagram_url
    if body.linkedin_url:
        metadata['linkedin_url'] = body.linkedin_url
    metadata['partner_status'] = 'applied'   # tracciamento status partner (indipendente da progression_state)
    if body.territory:
        metadata['territory'] = body.territory

    if existing.data:
        # Aggiorna la candidatura esistente (non duplicare)
        lead_id = existing.data[0]['id']
        client.table('leads').update({
            'first_name':            body.first_name,
            'last_name':             body.last_name,
            'company_name':          body.company_name,
            'phone':                 body.phone,
            'professional_category': body.professional_category,
            'company_website':       body.company_website,
            'portfolio_url':         body.portfolio_url,
            'collaboration_intent':  body.collaboration_intent,
            'notes':                 body.notes,
            'metadata_json':         metadata,
            'updated_at':            _now(),
        }).eq('id', lead_id).execute()
        return {
            "status": "updated",
            "partner_id": lead_id,
            "message": "Candidatura aggiornata con successo.",
        }

    # Crea nuovo lead partner
    lead_id = str(uuid.uuid4())
    row = {
        'id':                    lead_id,
        'tenant_id':             tenant_id,
        'lead_type':             'partner_studio',    # ENUM: lead_type valido per partner
        'progression_state':     'lead',              # TEXT: default, CHECK constraint rispettato
        'pipeline_stage':        'lead_captured',
        'first_name':            body.first_name,
        'last_name':             body.last_name,
        'email':                 body.email.lower().strip(),
        'company_name':          body.company_name,
        'phone':                 body.phone,
        'professional_category': body.professional_category,
        'company_website':       body.company_website,
        'portfolio_url':         body.portfolio_url,
        'collaboration_intent':  body.collaboration_intent,
        'notes':                 body.notes,
        'metadata_json':         metadata,
        'created_at':            _now(),
        'updated_at':            _now(),
    }

    client.table('leads').insert(row).execute()
    log.info("partner_apply: new lead %s (%s %s) for tenant %s",
             lead_id, body.first_name, body.last_name, tenant_id)

    return {
        "status": "created",
        "partner_id": lead_id,
        "message": "Candidatura ricevuta con successo.",
    }


# ─── FASE 5 — Partner Network (autenticato) ──────────────────────────────────

@router.get("/partner-network/partners", tags=["partner-network"])
def list_partners(
    status: Optional[str] = Query(None, description="Filtra per stato: applied|review|approved|active|archived"),
    q: Optional[str] = Query(None, description="Ricerca libera"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: dict = Depends(require_permission(P_LEADS_READ)),
):
    """Lista partner filtrata — leads.lead_type = 'partner_studio'."""
    client = db()
    tenant_id = ctx['tenant_id']

    query = (client.table('leads')
             .select(
                 'id, first_name, last_name, email, company_name, '
                 'professional_category, collaboration_intent, '
                 'portfolio_url, company_website, phone, notes, '
                 'progression_state, lead_type, metadata_json, '
                 'created_at, updated_at'
             )
             .eq('tenant_id', tenant_id)
             .eq('lead_type', 'partner_studio'))

    if q and q.strip():
        term = q.strip()
        query = query.or_(
            f'first_name.ilike.%{term}%,'
            f'last_name.ilike.%{term}%,'
            f'email.ilike.%{term}%,'
            f'company_name.ilike.%{term}%'
        )

    query = query.order('created_at', desc=True).range(offset, offset + limit - 1)
    res = query.execute()
    all_partners = res.data or []

    # Filtra per partner_status in metadata_json (non in DB) dopo il fetch
    if status:
        all_partners = [p for p in all_partners
                        if (p.get('metadata_json') or {}).get('partner_status') == status]

    # Aggiungi campo territory estratto da metadata_json per comodità del frontend
    for p in all_partners:
        meta = p.get('metadata_json') or {}
        p['territory']      = meta.get('territory')
        p['partner_status'] = meta.get('partner_status', 'applied')

    # Conteggio per stato
    status_counts: dict = {}
    all_res = (client.table('leads')
               .select('metadata_json')
               .eq('tenant_id', tenant_id)
               .eq('lead_type', 'partner_studio')
               .execute())
    for row in (all_res.data or []):
        s = (row.get('metadata_json') or {}).get('partner_status', 'applied')
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "partners": all_partners,
        "total": len(all_partners),
        "status_counts": status_counts,
    }


@router.patch("/partner-network/partners/{partner_id}/status", tags=["partner-network"])
def update_partner_status(
    partner_id: str,
    body: PartnerStatusBody,
    ctx: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """Transizione stato partner via metadata_json.partner_status."""
    client = db()
    tenant_id = ctx['tenant_id']

    res = (client.table('leads')
           .select('id, metadata_json, lead_type, first_name, last_name, email')
           .eq('id', partner_id)
           .eq('tenant_id', tenant_id)
           .eq('lead_type', 'partner_studio')
           .limit(1)
           .execute())

    if not res.data:
        raise HTTPException(404, "Partner non trovato")

    existing_meta = res.data[0].get('metadata_json') or {}
    updated_meta  = {**existing_meta, 'partner_status': body.status}

    update_res = (client.table('leads')
                  .update({
                      'metadata_json': updated_meta,
                      'updated_at':    _now(),
                  })
                  .eq('id', partner_id)
                  .execute())

    log.info("partner status update: %s → %s (tenant=%s)", partner_id, body.status, tenant_id)
    return {"partner_id": partner_id, "status": body.status}


# ─── FASE 6 — DJ Integration ─────────────────────────────────────────────────

@router.get("/partner-network/journeys", tags=["partner-network"])
def list_assignable_journeys(
    ctx: dict = Depends(require_permission(P_PROJECTS_READ)),
):
    """Lista Design Journey aperti a cui un partner può essere assegnato."""
    client = db()
    tenant_id = ctx['tenant_id']

    res = (client.table('design_journeys')
           .select('id, lifecycle_state, overall_status, created_at, project_id')
           .eq('tenant_id', tenant_id)
           .in_('lifecycle_state', ['conversation_open', 'active', 'draft', 'in_progress', 'open'])
           .order('created_at', desc=True)
           .limit(100)
           .execute())

    return {"journeys": res.data or []}


@router.post("/partner-network/partners/{partner_id}/assign", tags=["partner-network"])
def assign_partner_to_journey(
    partner_id: str,
    body: PartnerAssignBody,
    ctx: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """
    Assegna un partner approvato a un Design Journey come contributor.

    Regole:
    - Il partner deve avere progression_state in ('approved', 'active')
    - Il partner deve avere un users_profile (cercato per email)
    - Usa add_assignment() dal core esistente (nessuna modifica schema)
    - assignment_role = 'contributor'
    """
    client = db()
    tenant_id = ctx['tenant_id']
    actor_user_id = ctx.get('profile_id')

    # Verifica partner
    p_res = (client.table('leads')
             .select('id, first_name, last_name, email, progression_state, metadata_json, lead_type')
             .eq('id', partner_id)
             .eq('tenant_id', tenant_id)
             .eq('lead_type', 'partner_studio')
             .limit(1)
             .execute())

    if not p_res.data:
        raise HTTPException(404, "Partner non trovato")

    partner = p_res.data[0]
    partner_status = (partner.get('metadata_json') or {}).get('partner_status', 'applied')
    if partner_status not in ('approved', 'active'):
        raise HTTPException(400, "Il partner deve essere in stato 'approved' o 'active' per essere assegnato a un DJ.")

    # Cerca users_profile per email (il partner deve essere stato invitato alla piattaforma)
    up_res = (client.table('users_profile')
              .select('id, role, status')
              .eq('tenant_id', tenant_id)
              .eq('email', partner['email'])
              .limit(1)
              .execute())

    if not up_res.data:
        raise HTTPException(
            400,
            "Il partner non ha ancora un account sulla piattaforma. "
            "Invitalo prima tramite Impostazioni → Membri."
        )

    profile_id = up_res.data[0]['id']

    # Verifica che il DJ esista e appartenga al tenant
    dj_res = (client.table('design_journeys')
              .select('id, title, status')
              .eq('id', body.journey_id)
              .eq('tenant_id', tenant_id)
              .limit(1)
              .execute())

    if not dj_res.data:
        raise HTTPException(404, "Design Journey non trovato")

    # Assegna tramite il core esistente
    try:
        assignment = add_assignment(
            tenant_id=tenant_id,
            journey_id=body.journey_id,
            user_id=profile_id,
            role=ROLE_CONTRIBUTOR,
            actor_user_id=actor_user_id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Aggiorna lo stato del partner ad 'active' se era 'approved'
    if partner_status == 'approved':
        existing_meta = partner.get('metadata_json') or {}
        client.table('leads').update({
            'metadata_json': {**existing_meta, 'partner_status': 'active'},
            'updated_at': _now(),
        }).eq('id', partner_id).execute()

    log.info("partner %s (%s) assigned to DJ %s as contributor", partner_id, partner['email'], body.journey_id)
    return {
        "assignment_id": assignment.get('id'),
        "partner_id": partner_id,
        "journey_id": body.journey_id,
        "role": ROLE_CONTRIBUTOR,
        "message": f"{partner['first_name']} {partner['last_name']} assegnato al Design Journey come contributor.",
    }


@router.delete("/partner-network/partners/{partner_id}/assignment/{journey_id}", tags=["partner-network"])
def remove_partner_from_journey(
    partner_id: str,
    journey_id: str,
    ctx: dict = Depends(require_permission(P_LEADS_WRITE)),
):
    """Rimuove un partner da un Design Journey."""
    client = db()
    tenant_id = ctx['tenant_id']
    actor_user_id = ctx.get('profile_id')

    # Cerca il partner
    p_res = (client.table('leads')
             .select('id, email, first_name, last_name')
             .eq('id', partner_id)
             .eq('tenant_id', tenant_id)
             .eq('lead_type', 'partner_studio')
             .limit(1)
             .execute())
    if not p_res.data:
        raise HTTPException(404, "Partner non trovato")

    # Cerca users_profile per email
    up_res = (client.table('users_profile')
              .select('id')
              .eq('tenant_id', tenant_id)
              .eq('email', p_res.data[0]['email'])
              .limit(1)
              .execute())
    if not up_res.data:
        raise HTTPException(404, "Il partner non ha un account sulla piattaforma")

    profile_id = up_res.data[0]['id']

    try:
        revoke_assignment(
            tenant_id=tenant_id,
            journey_id=journey_id,
            user_id=profile_id,
            role=ROLE_CONTRIBUTOR,
            actor_user_id=actor_user_id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    log.info("partner %s removed from DJ %s", partner_id, journey_id)
    return {"removed": True, "partner_id": partner_id, "journey_id": journey_id}
